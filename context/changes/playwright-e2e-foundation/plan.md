# Playwright E2E Foundation Implementation Plan

## Overview

Stand up a Playwright test harness for this project and author one
reference e2e test whose job is to prove the harness works and to set the
convention future e2e authors copy. Wire it into CI. This is
infrastructure-only: it deliberately does not attempt the risk-mapped
login→questionnaire→plan flow that `test-plan.md` §3 Phase 2 ultimately
wants — that flow needs a test-user/Supabase strategy decision this change
is scoped to avoid.

## Current State Analysis

No e2e tooling exists in this repo today: no `@playwright/test` dependency,
no config, no `e2e/` directory. Vitest was set up separately in the
`auth-outage-error-handling` change for unit-level tests colocated in
`src/`; Playwright is a second, independent test runner and does not share
that config.

The flow this seed test touches: `src/middleware.ts` guards `/dashboard`
and `/api/plans` — an unauthenticated request to a protected page redirects
to `/auth/signin` (`context.redirect("/auth/signin")`). The sign-in page
(`src/pages/auth/signin.astro`) renders `SignInForm`, whose fields
(`src/components/auth/FormField.tsx`) each pair a `<label htmlFor>` with
an `<input id>` — `Email` and `Password` labels are exact accessible names,
and the submit button's accessible name is `Sign in`. None of this touches
Supabase: `src/lib/supabase.ts`'s `createClient` returns `null` whenever
`SUPABASE_URL`/`SUPABASE_KEY` aren't set, and `middleware.ts` treats a
`null` client as `context.locals.user = null` — i.e. always logged out.
That means this seed test needs **zero Supabase configuration** to pass,
in CI or locally.

## Desired End State

- `npm run test:e2e` runs Playwright locally, auto-starting `npm run dev`
  (Astro's dev server on `http://localhost:4321`) if it isn't already
  running, and passes with one green spec file covering two cases.
- A new `e2e` job in `.github/workflows/ci.yml` runs the same suite on
  every push/PR, independent of and parallel to the existing `ci` job, with
  no Supabase secrets required.
- `context/foundation/test-plan.md` §6.3 documents the real pattern
  (location, naming, reference test, run command) instead of the `TBD`
  placeholder.

### Key Discoveries:

- `src/lib/supabase.ts:9-11` — `createClient` returns `null` when
  `SUPABASE_URL`/`SUPABASE_KEY` are unset; `src/middleware.ts:9-13` treats
  that as an always-logged-out session. The CI `e2e` job can therefore
  run `astro dev` with no Supabase secrets at all — the redirect-guard
  behavior this seed test asserts is exactly what happens by default.
- `tsconfig.json`'s `include` is `["**/*"]` (no `src/`-only restriction),
  and `eslint.config.js`'s `baseConfig` uses `projectService: true` with
  `tseslint.configs.strictTypeChecked` applied with no file-path
  restriction — so `e2e/**/*.ts` is linted under the same strict
  TypeScript-ESLint rules as the rest of the repo (no implicit `any`,
  no floating promises, etc.), not a separate looser config.
- `.gitignore` already feeds `eslint.config.js` via `includeIgnoreFile`
  — anything added to `.gitignore` (Playwright's report/output dirs) is
  automatically excluded from lint too, no separate ESLint ignore needed.
- `src/components/auth/FormField.tsx:24-25` pairs `<label htmlFor={id}>`
  with `<input id={id}>` — `Email` and `Password` are stable accessible
  names via `getByLabel`, avoiding brittle CSS selectors in the seed test.

## What We're NOT Doing

- Not authoring the login→questionnaire→plan flow test (`test-plan.md`
  Risk #2) — that's Phase 2's job and needs its own test-user/Supabase
  strategy decision (local Supabase stack vs. hosted test account),
  deliberately deferred, not decided here.
- Not adding a test-user or Supabase seeding mechanism of any kind — the
  seed test only exercises the unauthenticated path.
- Not running against `npm run preview` (the built Cloudflare Workers
  output) — the harness targets `npm run dev` only, per the confirmed
  decision.
- Not adding multi-browser projects (Firefox, WebKit) — chromium only,
  per the confirmed decision.
- Not touching `README.md` — `test-plan.md` §6 is this repo's designated
  place for "how do I add a test for X," per `AGENTS.md`.
- Not flipping `test-plan.md` §3 Phase 2's status or §5's "e2e on critical
  flows" `Required?` column — neither risk coverage nor the persistence
  round-trip this change leaves untouched, so those stay exactly as they
  are; only §6.3 (the cookbook pattern) is updated.
- Not adding Playwright browser-binary caching in CI — a runtime
  optimization with no bearing on correctness, out of scope for a seed
  test.

## Implementation Approach

Four phases, each independently verifiable: install and configure the
harness (nothing runnable yet depends on app behavior beyond the dev
server starting), author the seed test against the already-graceful
logged-out path, wire CI using the exact same `webServer`-driven command
so there is no CI-only behavior to debug separately, then document the
pattern in `test-plan.md` §6.3.

## Phase 1: Install & configure Playwright

### Overview

Add the Playwright test runner, its config, and the npm script that runs
it — no test files yet. Verifiable on its own via Playwright's built-in
"list tests" behavior against an empty `e2e/` directory.

### Changes Required:

#### 1. Add Playwright as a dev dependency and script

**File**: `package.json`

**Intent**: Make Playwright runnable locally and in CI via `npm run test:e2e`.

**Contract**: Add `@playwright/test` to `devDependencies` (current stable
release at implementation time — run `npm install -D @playwright/test`
rather than hand-picking a version). Add one script: `"test:e2e": "playwright test"`.

#### 2. Add Playwright config

**File**: `playwright.config.ts` (new, repo root)

**Intent**: Point Playwright at `e2e/`, run only chromium, and auto-manage
the dev server so `npm run test:e2e` works unattended (locally or in CI)
without a manual "start the server first" step.

**Contract**:
```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:4321",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```
No `SUPABASE_URL`/`SUPABASE_KEY` env is passed to the `webServer` command
— per Key Discoveries, the app runs correctly in an always-logged-out mode
without them, which is exactly the state this phase's seed test needs.

#### 3. Ignore Playwright's local artifacts

**File**: `.gitignore`

**Intent**: Keep Playwright's generated report/output directories out of
version control (and, via `includeIgnoreFile`, out of ESLint's scope too).

**Contract**: Append a `# playwright` section with `/playwright-report/`,
`/test-results/`, and `/blob-report/`.

### Success Criteria:

#### Automated Verification:

- `npm install` completes cleanly with `@playwright/test` added
- `npx playwright install --with-deps chromium` completes (one-time browser binary install)
- `npm run lint` still passes
- `npm run build` still passes
- `npm run test:e2e` runs and reports zero tests found (empty `e2e/`), exits `0`

#### Manual Verification:

- Run `npm run test:e2e` locally and confirm it starts the dev server, reports "no tests found" (not a crash), and shuts the server back down.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Author the reference seed test

### Overview

One spec file, two test cases, both against the already-graceful
logged-out path: visiting the protected dashboard redirects to sign-in,
and the sign-in page renders the expected form. This is the pattern future
e2e authors copy — accessible-role/label locators, one `test.describe`
block, one behavior per `test()`.

### Changes Required:

#### 1. Reference e2e spec

**File**: `e2e/dashboard-access.spec.ts` (new)

**Intent**: Prove the harness end-to-end against real app behavior (not a
placeholder assertion), and demonstrate the locator style (accessible
name, not CSS class) future specs should follow.

**Contract**: A `test.describe("protected dashboard access")` block with
two `test()` cases:
1. Navigating to `/dashboard` while unauthenticated ends on
   `/auth/signin` — assert via `expect(page).toHaveURL(/\/auth\/signin/)`.
2. On that same sign-in page, the form is rendered — assert
   `page.getByLabel("Email")`, `page.getByLabel("Password")`, and
   `page.getByRole("button", { name: "Sign in" })` are each visible.

Written as `async ({ page }) => { ... }` test callbacks (Playwright's
standard signature) so the strict-type-checked ESLint config (see Key
Discoveries) has no untyped/`any` surface to flag.

### Success Criteria:

#### Automated Verification:

- `npm run test:e2e` passes both test cases
- `npm run lint` passes on the new spec file
- `npm run build` still passes

#### Manual Verification:

- Run `npm run test:e2e` and read the HTML report (`playwright-report/index.html`) to confirm both named test cases ran and passed, not just an aggregate "1 passed".

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Wire CI

### Overview

Add a dedicated `e2e` job to the existing CI workflow, parallel to the
current `ci` job, using the exact same `npm run test:e2e` command a local
run would use — no CI-specific script or behavior to diverge from what
was just verified locally.

### Changes Required:

#### 1. New CI job

**File**: `.github/workflows/ci.yml`

**Intent**: Run the e2e suite on every push/PR to `master`, as its own job
so an e2e failure is attributed separately from lint/build.

**Contract**: A second top-level job (e.g. `e2e`) alongside the existing
`ci` job, not nested under it. Steps: checkout, `actions/setup-node@v4`
(node 22, npm cache — matching the existing job), `npm ci`, `npx astro
sync` (matching this repo's convention of running it before any
build/dev/lint step), `npx playwright install --with-deps chromium`, then
`npm run test:e2e`. No `SUPABASE_URL`/`SUPABASE_KEY` secrets are passed to
this job — per Key Discoveries, the seed test only needs the
always-logged-out default behavior. On failure, upload
`playwright-report/` as a workflow artifact (`actions/upload-artifact@v4`,
`if: failure()`) so a failing run's report is inspectable without
re-running locally.

### Success Criteria:

#### Automated Verification:

- `.github/workflows/ci.yml` is valid YAML and the new job appears distinct from the existing `ci` job
- A pushed commit (or a local `act`/dry-run equivalent, if available) shows the `e2e` job installing browsers and running `npm run test:e2e` to completion

#### Manual Verification:

- Open the Actions run for this change's PR and confirm the `e2e` job ran in parallel with `ci`, both test cases show as passed, and no Supabase-secret-related warnings appear in the log.
- Intentionally break the seed test locally (e.g. change an expected label), push, and confirm the `e2e` job fails and the `playwright-report` artifact is attached to the failed run; then revert.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Update test-plan.md cookbook

### Overview

Replace the §6.3 `TBD` placeholder with the real pattern this change
establishes, so the next contributor (or `/10x-tdd`/`/10x-e2e`) has an
actual answer instead of a pointer to a not-yet-implemented phase.

### Changes Required:

#### 1. Cookbook entry

**File**: `context/foundation/test-plan.md`

**Intent**: Document location, naming, reference test, and run command
for e2e tests, and flag explicitly that Risk #2's real flow is still
unaddressed.

**Contract**: Replace the §6.3 body (currently `- TBD — see §3 Phase 2
(login→questionnaire→plan seam smoke, Risk #2).`) with prose covering:
location `e2e/`, naming `*.spec.ts`, reference test
`e2e/dashboard-access.spec.ts`, run command `npm run test:e2e` (auto-starts
`npm run dev` via `webServer`, no manual server start needed), CI: runs as
a dedicated `e2e` job in `.github/workflows/ci.yml` needing no Supabase
secrets for the current (logged-out-only) suite. Add one sentence noting
this cookbook entry covers the *harness pattern* only — the risk-mapped
Phase 2 flow (Risk #2, login→questionnaire→plan) still needs its own test
and a test-user/Supabase strategy decision, not yet made.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes (markdown is prettier-formatted per `.prettierrc.json`)

#### Manual Verification:

- Read the updated §6.3 and confirm it gives a future contributor everything needed to add a new e2e test without re-deriving the pattern (location, naming, reference file, run command).

**Implementation Note**: After completing this phase and all automated verification passes, this plan is complete.

---

## Testing Strategy

### Unit Tests:

- None — this change adds no unit-testable logic; Phase 2's spec file is
  itself the test.

### Integration Tests:

- None — out of scope; the seed test is the only test this change adds.

### Manual Testing Steps:

1. `npm run test:e2e` locally — confirm both seed-test cases pass and the dev server is auto-started/torn down.
2. Open `playwright-report/index.html` and confirm both named cases are visible.
3. Push the branch and confirm the new `e2e` CI job runs green alongside the existing `ci` job.
4. Temporarily break one assertion (e.g. change `"Sign in"` to a wrong string), confirm the CI job fails and the report artifact is attached, then revert.

## Performance Considerations

Chromium-only and dev-server-only (no build step) keeps this fast — a
single-spec run should complete in well under a minute locally and in CI.

## Migration Notes

None — purely additive tooling and config; no data or schema involved.

## References

- Risk context: `context/foundation/test-plan.md` §3 Phase 2, §6.3
- Related prior change (Vitest infra precedent): `context/changes/auth-outage-error-handling/plan.md` Phase 1
- Middleware/auth-gating behavior: `src/middleware.ts`, `src/lib/supabase.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Install & configure Playwright

#### Automated

- [x] 1.1 `npm install` completes cleanly with `@playwright/test` added — 59ebec4
- [x] 1.2 `npx playwright install --with-deps chromium` completes — 59ebec4
- [x] 1.3 `npm run lint` still passes — 59ebec4
- [x] 1.4 `npm run build` still passes — 59ebec4
- [x] 1.5 `npx playwright test --list` reports "Total: 0 tests in 0 files" (adapted — Playwright has no `passWithNoTests` equivalent; `npm run test:e2e` itself exits 1 on zero spec files by design, confirmed exit-0 verification deferred to Phase 2 once a real spec exists) — 59ebec4

#### Manual

- [x] 1.6 `npm run test:e2e` confirmed to start/stop the dev server and report "no tests found," not a crash — 59ebec4

### Phase 2: Author the reference seed test

#### Automated

- [x] 2.1 `npm run test:e2e` passes both test cases — 07a5527
- [x] 2.2 `npm run lint` passes on the new spec file — 07a5527
- [x] 2.3 `npm run build` still passes — 07a5527

#### Manual

- [x] 2.4 HTML report confirmed to show both named test cases passing — 07a5527

### Phase 3: Wire CI

#### Automated

- [x] 3.1 `.github/workflows/ci.yml` valid YAML with a distinct `e2e` job — 7d2d78f
- [x] 3.2 CI run shows the `e2e` job installing browsers and completing `npm run test:e2e` — 7d2d78f

#### Manual

- [x] 3.3 Actions run confirmed: `e2e` job green in parallel with `ci`, no Supabase-secret warnings — 7d2d78f
- [x] 3.4 Intentional break confirmed to fail the job and attach the `playwright-report` artifact; reverted — 7d2d78f

### Phase 4: Update test-plan.md cookbook

#### Automated

- [x] 4.1 `npm run lint` passes

#### Manual

- [x] 4.2 Updated §6.3 read back and confirmed self-sufficient for the next contributor
