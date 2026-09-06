# Guard Sign-In/Sign-Up Against Supabase Outage — Implementation Plan

## Overview

Add a try/catch guard around the Supabase auth call in `signin.ts` and
`signup.ts` so that a live Supabase outage (network unreachable, DNS
failure, timeout — a *thrown* exception, not the SDK's normal resolved
`{ error }` shape) produces the same user-facing redirect-with-message
behavior the handlers already give for a resolved auth error, instead of an
unhandled exception.

## Current State Analysis

Both handlers already handle the SDK's resolved-error case correctly:
`signin.ts:13-17` and `signup.ts:13-17` check `if (error)` after awaiting
`supabase.auth.signInWithPassword` / `signUp`, and redirect to
`/auth/{signin|signup}?error=<message>`. What's missing is a guard for the
case where that same awaited call *throws* instead of resolving — which
happens when Supabase is genuinely unreachable rather than rejecting a bad
credential. An uncaught throw here propagates out of the exported `POST`
handler with no user-facing redirect at all.

### Key Discoveries:

- `src/pages/api/auth/signin.ts:13` and `src/pages/api/auth/signup.ts:13` — the only unguarded awaits; the missing-env-var case (`createClient` returning `null`) is already separately guarded at lines 10-12 of each file, so it does not need to change.
- No `console.*` call exists anywhere in `src/` today (`grep -rn "console\." src/` → no matches) — the logging added here will be the first, so there's no existing convention to match beyond "use `console.error`, Cloudflare Workers ships it to observability by default."
- No shared error-handling utility exists anywhere in `src/lib/` or `src/pages/api/` (confirmed in `research.md`) — per the user's confirmed decision, the fix stays as duplicated inline try/catch in each file, matching the existing non-abstracted repo style rather than introducing the first shared abstraction for two call sites.
- `src/pages/api/auth/signout.ts` has the identical unguarded-await shape but is explicitly out of scope for this change (confirmed decision) since test-plan.md's Risk #7 names only sign-in/sign-up.
- No test infrastructure exists in the repo at all: no `vitest` (or any test runner) in `package.json`, no `vitest.config.*`, no `test` script, no `*.test.ts` files anywhere (confirmed via `research.md` and a fresh check of `package.json`). The Testing Strategy below specifies a unit test that needs Vitest to exist to ever run — so this plan adds a phase to install and configure it, scoped to exactly what that one test needs (Node environment, no DOM), without authoring the test itself.
- `astro.config.mjs` has no test-related config; `tsconfig.json` defines the `@/*` → `./src/*` path alias Vitest will need to resolve the same way the app does. Astro ships a `getViteConfig` helper (from `astro/config`) meant for exactly this, but **it does not work in this repo**: reusing the project's real Vite pipeline pulls in the `@astrojs/cloudflare` adapter plugin, which hard-validates SSR environment options and rejects the ones Vitest itself sets — `npm run test` fails at startup (exit 1) before any test runs. Discovered during Phase 1 implementation; see the updated Contract below.
- `eslint.config.js` sets `"no-console": "warn"` (not `"error"`), and CI's `npm run lint` step (`eslint .`, no `--max-warnings=0`) doesn't fail on warnings — so the `console.error` calls added in the guard fix (Phase 2) won't break the lint gate.

## Desired End State

Given a Supabase client whose `signInWithPassword` (or `signUp`) call
*throws* rather than resolving with `{ error }`, the handler:

1. Catches the throw before it escapes the `POST` export.
2. Logs the underlying error server-side via `console.error` (so an actual
   outage is visible in Cloudflare Workers logs, not just inferred from
   user reports).
3. Redirects to `/auth/{signin|signup}?error=<generic message>`, where the
   generic message is a fixed, user-appropriate string — distinct from the
   verbatim `error.message` used for the resolved-error case, which is
   left unchanged.

Verification: with the Supabase client's `signInWithPassword`/`signUp`
mocked to reject, the handler must not throw out of `POST`, and must
return a redirect Response whose `error` query param is the fixed generic
string (see Testing Strategy — the test itself is authored later, in
Lesson 2's `/10x-tdd`, not in this implementation).

## What We're NOT Doing

- Not touching `signout.ts` — same class of gap, deliberately left for a
  separate, later fix (confirmed decision).
- Not sanitizing or changing the resolved-`{error}` path — `error.message`
  continues to be shown verbatim exactly as it is today (confirmed
  decision); only the newly-caught thrown-exception path gets the generic
  message.
- Not introducing a shared error-handling helper/module — the guard is
  duplicated inline in both files (confirmed decision).
- Not authoring the unit test file itself — per `AGENTS.md` Module 3
  Lesson 1 boundaries ("Do not write test code. That is Lesson 2"), this
  plan specifies the test's target, mocking strategy, and assertions (see
  Testing Strategy) but the actual test file is written under `/10x-tdd`.
  Installing and configuring the Vitest *harness* (Phase 1 below) is
  infrastructure/tooling, not test-code authoring, so it stays in scope
  here.
- Not adding `jsdom` or `@testing-library/*` — the Risk #7 test runs a
  plain server-side handler function, no DOM involved. Those packages
  are for component-level tests and remain the concern of whichever
  change tackles that (test-plan.md Phase 1's other risks, #1/#3).
- Not wiring the new `test` script into CI (`.github/workflows/ci.yml`) —
  per `test-plan.md` §5, the unit+integration gate becomes `required`
  only "after §3 Phase 1"; CI wiring is that phase's job (or Phase 4's),
  not this one's.
- Not adding a structured alerting/observability pipeline for the new log
  line — `console.error` alone, per the confirmed decision; no new infra.

## Implementation Approach

Symmetric, minimal change to both files: wrap the existing
`await supabase.auth.signIn.../.signUp(...)` line in a try/catch. On
catch, `console.error` the underlying error with enough context to
identify it as an auth-outage event, then return the same
`context.redirect(...)` shape already used two lines below for the
resolved-error case, but with a fixed generic message instead of
`error.message`.

## Phase 1: Set up Vitest test infrastructure

### Overview

Install and configure Vitest so the unit test specified in Testing
Strategy (below) has somewhere to run, without authoring that test file
here — this phase is tooling/config only, not test-code authoring, so it
does not conflict with the `AGENTS.md` Lesson 1 boundary. Scoped
minimally to what a server-side handler test needs: no `jsdom`, no
`@testing-library/*`, no CI wiring (all out of scope, see What We're NOT
Doing).

### Changes Required:

#### 1. Add Vitest as a dev dependency and script

**File**: `package.json`

**Intent**: Make Vitest runnable locally via `npm run test`.

**Contract**: Add `vitest` to `devDependencies` at a version compatible with the existing `"overrides": { "vite": "^7.3.2" }` pin (Vitest's peer range must include Vite 7). Add two scripts: `"test": "vitest run"` (single pass, CI-style) and `"test:watch": "vitest"` (interactive).

#### 2. Add Vitest config

**File**: `vitest.config.ts` (new)

**Intent**: Resolve the `@/*` alias the same way the app does, and make the harness pass with zero test files so it's verifiable before Lesson 2 adds any — without loading `astro.config.mjs` (see Key Discoveries: `getViteConfig` is blocked by the `@astrojs/cloudflare` adapter plugin in this repo).

**Contract** (implemented; deviates from the originally planned `getViteConfig` approach — see Key Discoveries):
```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    passWithNoTests: true,
  },
});
```
A plain `defineConfig` from `vitest/config` avoids the triple-slash `/// <reference types="vitest/config" />` some Astro docs use — that comment form trips this repo's `@typescript-eslint/triple-slash-reference` lint rule and isn't needed here since `vitest/config`'s own `defineConfig` already carries the merged `test` field types.

### Success Criteria:

#### Automated Verification:

- `npm install` completes cleanly with `vitest` added
- `npx astro sync` still passes
- `npm run lint` still passes (new `vitest.config.ts` type-checks under the existing strict ESLint config)
- `npm run build` still passes
- `npm run test` exits `0` (via `passWithNoTests`, with zero test files present)

#### Manual Verification:

- Run `npm run test` locally and confirm the output explicitly reports zero test files found (not an error/crash) — proving the harness is wired and ready for `/10x-tdd` to add the Risk #7 test into.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Guard both auth handlers against thrown Supabase errors

### Overview

Add the try/catch guard to `signin.ts` and `signup.ts`, each producing an
identical logged-and-redirected outcome for a thrown error from the
Supabase call.

### Changes Required:

#### 1. Sign-in handler

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Wrap the `signInWithPassword` call so a thrown error (Supabase
unreachable) is logged and redirected with a generic message, instead of
propagating out of the handler.

**Contract**: The existing `const { error } = await supabase.auth.signInWithPassword(...)` on line 13, followed by the `if (error)` redirect on lines 15-16, must be enclosed in a try/catch. The catch block calls `console.error` with the caught error and enough identifying context (e.g. a string tag like `"signin: supabase call failed"` plus the error itself), then returns `context.redirect(`/auth/signin?error=${encodeURIComponent("Unable to reach the authentication service — please try again shortly.")}`)`. The resolved-error branch (lines 15-16) and the success branch (line 19) are unchanged.

#### 2. Sign-up handler

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Same guard, mirrored for the sign-up flow.

**Contract**: Same shape as signin.ts — wrap the `await supabase.auth.signUp(...)` call in try/catch, `console.error` on catch with a distinguishing tag (e.g. `"signup: supabase call failed"`), then `context.redirect(`/auth/signup?error=${encodeURIComponent("Unable to reach the authentication service — please try again shortly.")}`)`. Resolved-error branch (lines 15-16) and success redirect (line 19) unchanged.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Type checking is current: `npx astro sync` runs cleanly (no route/env changes here, but this repo's convention per `AGENTS.md` is to run it before lint/build after any src change)

#### Manual Verification:

- Simulate a Supabase-unreachable condition locally (e.g. temporarily point `SUPABASE_URL` at an unroutable address, or unplug network) and submit the sign-in form: confirm the browser lands back on `/auth/signin` with the generic message rendered via `ServerError`, not a crashed/blank page or an unhandled-exception error screen.
- Repeat for sign-up, confirm landing on `/auth/signup` with the same generic message.
- Confirm a normal wrong-password attempt (resolved `{error}` path, Supabase reachable) still shows the original Supabase message verbatim — unchanged from current behavior.
- Confirm the `console.error` line appears in the dev server output (`npm run dev` terminal) when the outage is simulated.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Phase 3: Author regression tests for the outage guard

### Overview

Author the unit tests specified in Testing Strategy (below) for the
Phase 2 guard, now that Lesson 2 (`/10x-tdd`) has been reached. This
phase was not originally tracked with Progress rows — Phase 2 already
shipped the production guard, so the tests below are regression
coverage for existing behavior, authored via `/10x-implement` rather
than true test-first TDD (the failing-test-leads-code ordering no
longer applies once the code already exists).

### Changes Required:

#### 1. Sign-in regression tests

**File**: `src/pages/api/auth/signin.test.ts` (new)

**Intent**: Pin the Phase 2 behavior so a future refactor can't silently
regress it.

**Contract**: Per Testing Strategy below — mock `@/lib/supabase`'s
`createClient`; one case asserts a rejected `signInWithPassword` call
redirects to `/auth/signin` with the fixed generic message; a second
case asserts a resolved `{ error }` still redirects with the verbatim
`error.message`, proving the resolved-error path is untouched.

#### 2. Sign-up regression tests

**File**: `src/pages/api/auth/signup.test.ts` (new)

**Intent**: Mirror the sign-in tests for the sign-up handler.

**Contract**: Same shape as `signin.test.ts`, targeting `signup.ts`'s
`POST` export and its `signUp` mock.

#### 3. Scope Vitest away from the Playwright suite

**File**: `vitest.config.ts`

**Intent**: `npm run test` failed once real test files existed — Vitest's
default include glob was also matching the Playwright spec in `e2e/`
(`test.describe()` from `@playwright/test` throws when invoked outside
a Playwright run). Discovered during Phase 3 implementation, not
anticipated when this plan was written.

**Contract**: Add `exclude: [...configDefaults.exclude, "e2e/**"]`
(importing `configDefaults` from `vitest/config`) to `test` in
`vitest.config.ts` so Vitest only discovers real Vitest specs while
keeping Vitest's own default exclusions intact.

### Success Criteria:

#### Automated Verification:

- `npm run test` exits `0` with the new test files discovered and passing (no longer relying on `passWithNoTests`)
- Lint passes: `npm run lint`
- Build passes: `npm run build`
- `npx astro sync` runs cleanly

#### Manual Verification:

- Run `npm run test` locally and confirm the output lists the new `signin.test.ts` / `signup.test.ts` test cases by name as passing (not just "no test files found").

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

Per `AGENTS.md` Module 3 Lesson 1 boundaries, this plan specifies the test
contract but does not author the test file — that's Lesson 2's
`/10x-tdd`. Phase 1 leaves the Vitest harness installed and verified so
that work has somewhere to run immediately. The cheapest test (per
`research.md` and `test-plan.md`'s own Risk #7 row) is:

### Unit Tests (spec for later authoring):

- Target: the exported `POST` handler in `signin.ts` (and mirrored for `signup.ts`).
- Mock `@/lib/supabase`'s `createClient` to return a fake client whose `auth.signInWithPassword` (or `auth.signUp`) is `vi.fn().mockRejectedValue(new Error("network unreachable"))`.
- Build a minimal fake Astro `APIContext`: a `Request` with form-encoded `email`/`password` body, a stub `cookies`, and a `redirect` spy (or capture the returned `Response` and assert on its `Location` header / status, depending on how `context.redirect` is exercised in the fake context).
- Call `POST(context)` directly — no server, no network, no Playwright.
- Assert: the call does not throw out of `POST`; the returned/observed redirect target is `/auth/signin?error=...` (or `/auth/signup?error=...`) with the fixed generic message, URL-encoded.
- A second case (regression guard, not new behavior): mock the same client to resolve with `{ error: { message: "Invalid login credentials" } }` and assert the redirect still carries that verbatim message — proving the resolved-error path was untouched by this change.
- Suggested location/naming (for whoever authors it under `/10x-tdd`): colocated `src/pages/api/auth/signin.test.ts` / `signup.test.ts`, runnable via `npm run test` once added — no new convention beyond what Phase 1 already wires up.

### Manual Testing Steps:

1. Point `SUPABASE_URL` (or block network access to it) so the auth call cannot reach Supabase, run `npm run dev`, submit sign-in — confirm generic-message redirect, not a crash.
2. Repeat for sign-up.
3. Restore normal Supabase access, submit sign-in with a wrong password — confirm the original (unchanged) Supabase message still appears.
4. Check terminal output for the `console.error` line during step 1/2.

## Performance Considerations

None — a try/catch and a single log call add negligible overhead to an
already-network-bound request.

## Migration Notes

None — no data model or schema involved.

## References

- Research: `context/changes/auth-outage-error-handling/research.md`
- Risk source: `context/foundation/test-plan.md` §2 Risk #7, Risk Response Guidance row #7
- Incident origin: `context/foundation/improvements.md:6`
- Vitest config: plain `defineConfig` from `vitest/config` with a manual `@/*` alias (Phase 1's `vitest.config.ts`) — `astro/config`'s `getViteConfig` helper was tried first but is incompatible with the `@astrojs/cloudflare` adapter in this repo (see Key Discoveries)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Set up Vitest test infrastructure

#### Automated

- [x] 1.1 `npm install` completes cleanly with `vitest` added — 297a13d
- [x] 1.2 `npx astro sync` runs cleanly — 297a13d
- [x] 1.3 Lint passes: `npm run lint` — 297a13d
- [x] 1.4 Build passes: `npm run build` — 297a13d
- [x] 1.5 `npm run test` exits 0 with zero test files (`passWithNoTests`) — 297a13d

#### Manual

- [x] 1.6 `npm run test` output confirmed to report zero test files found, not an error — 297a13d

### Phase 2: Guard both auth handlers against thrown Supabase errors

#### Automated

- [x] 2.1 Lint passes: `npm run lint` — 87f53cf
- [x] 2.2 Build passes: `npm run build` — 87f53cf
- [x] 2.3 `npx astro sync` runs cleanly — 87f53cf

#### Manual

- [x] 2.4 Simulated Supabase outage on sign-in redirects with generic message, no crash — 87f53cf
- [x] 2.5 Simulated Supabase outage on sign-up redirects with generic message, no crash — 87f53cf
- [x] 2.6 Normal wrong-password sign-in still shows original verbatim Supabase message — 87f53cf
- [x] 2.7 `console.error` line observed in dev server output during simulated outage — 87f53cf

### Phase 3: Author regression tests for the outage guard

#### Automated

- [x] 3.1 `npm run test` exits 0 with `signin.test.ts` / `signup.test.ts` discovered and passing — 24b39c5
- [x] 3.2 Lint passes: `npm run lint` — 24b39c5
- [x] 3.3 Build passes: `npm run build` — 24b39c5
- [x] 3.4 `npx astro sync` runs cleanly — 24b39c5

#### Manual

- [x] 3.5 `npm run test` output lists the new test cases by name as passing — 24b39c5
