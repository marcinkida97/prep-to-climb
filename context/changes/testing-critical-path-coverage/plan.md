# Testing Critical Path Coverage Implementation Plan

## Overview

This is `context/foundation/test-plan.md` §3 Phase 1: stand up the test
coverage that defends the two confirmed core-flow failures — plan
generation (Risk #1) and login/session (Risk #3) — at the cheapest layer
that gives real signal, and wire that suite into CI as a required gate.
The Vitest and Playwright harnesses already exist from prior changes;
this plan writes the actual tests that were never authored and extends
the e2e harness with a real login capability it didn't have.

## Current State Analysis

**Plan generation (Risk #1).** `/api/plans/generate.ts` validates
`climbingGrade` and `injuryLimitations` strictly before calling
`generateWeeklyPlan` — every malformed/out-of-domain value is rejected
with 400 today. But the generator itself
(`src/lib/plan-generator/index.ts:16-23`) still contains the exact defect
class from the recorded incident (`context/foundation/improvements.md`
item 1, "Failed to generate weekly plan occurred (HTTP 500)"): an
unmatched grade silently falls back to `PLAN_TEMPLATES[0]` instead of
erroring, and an injury id absent from `INJURY_RULES` would throw an
uncaught `TypeError` (`index.ts:35`). A prior implementation review
(`context/archive/2026-06-14-first-weekly-plan-flow/reviews/impl-review.md`
finding F2) flagged this exact class of gap and marked it "FIXED" — but
the fix was route-level validation making the branch unreachable today,
not removal of the branch itself. Zero tests exist anywhere near
`src/lib/plan-generator/` or `src/pages/api/plans/`.

**Login/session (Risk #3).** `middleware.ts` gates `/dashboard` and
`/api/plans` by calling `supabase.auth.getUser()`; page routes get
redirected to `/auth/signin` on failure, API routes get a raw 401 JSON.
The three existing auth tests (`signin.test.ts`, `signup.test.ts`,
`confirm.test.ts`) cover only failure paths (bad credentials, Supabase
unreachable, not configured) by mocking the internal `@/lib/supabase`
module entirely — none of them prove a real session gets established or
that middleware's allow-branch works. `e2e/dashboard-access.spec.ts`
covers only the unauthenticated redirect. No test anywhere exercises a
successful login.

### Key Discoveries:

- `src/middleware.ts:4` — `PROTECTED_ROUTES = ["/dashboard", "/api/plans"]`; `:18-28` — page routes redirect, `/api/*` routes get raw 401 JSON.
- `src/lib/supabase.ts:8-11` — `createClient` returns `null` (no throw) when `SUPABASE_URL`/`SUPABASE_KEY` are absent; when present, uses `@supabase/ssr`'s `createServerClient`, whose `setAll` callback writes the session cookie onto `context.cookies` as a side effect of `signInWithPassword`.
- `src/pages/api/plans/generate.ts:10-12` duplicates the auth check middleware already performs — both must independently deny an unauthenticated request.
- `src/pages/api/plans/generate.ts:87-129` (`validateQuestionnaireRequest`) has 7 distinct 400-returning branches, plus the 415 content-type check (`:14-23`) and the malformed-JSON 400 (`:25-36`).
- `src/lib/plan-persistence.ts:97-132` (`saveCurrentPlan`) calls `supabase.rpc("replace_current_plan", {...})`; a resolved `{ error }` throws `PlanPersistenceError`, which `generate.ts:71-83`'s catch-all turns into a 500 with `error.message` — the same catch-all a generation failure would hit, so a persistence throw looks identical to a generation failure from the client's perspective.
- `CLIMBING_GRADES` (`src/lib/plan-types.ts:3-4`) has exactly 6 values; `INJURY_OPTIONS`/`InjuryOptionId` (`src/lib/injury-options.ts`) has exactly 6 ids; `PLAN_TEMPLATES` (`src/lib/plan-generator/templates.ts`) has 3 templates whose `gradeMatches` arrays partition all 6 grades with no overlap or gap today.
- `supabase/config.toml` — a local Supabase CLI stack is already scaffolded (`config.toml`, `migrations/`, `seed.sql`) but never started/used by any test. `[auth.email] enable_confirmations = false` (`config.toml:209`) — a local signup is immediately usable with no confirmation step, which is what makes test-user seeding tractable.
- `.github/workflows/ci.yml` — the `e2e` job never sets `SUPABASE_URL`/`SUPABASE_KEY`, matching `playwright-e2e-foundation`'s deliberate always-logged-out scope. The `ci` job has no test-running step at all — `npm run test` (Vitest) is not wired into CI anywhere.
- `astro.config.mjs:18-20` declares `SUPABASE_URL`/`SUPABASE_KEY` as `context: "server", access: "secret"` — the existing `ci` job's `build` step already proves these are readable from plain GitHub Actions `env:` (process env), not from `.dev.vars`, since `astro dev`/`astro build` run as a Vite/Node process, not through Wrangler. The e2e job's Playwright `webServer` (`npm run dev`) will inherit the same mechanism.
- `context/archive/2026-06-14-first-weekly-plan-flow/plan.md:216-224` describes the *intent* behind template/injury-rule content (deterministic grade→template selection, body-part/injury-type conflict → substitution) but does not give a literal expected-value table — the exact per-exercise substitutions live only in `injury-rules.ts`/`templates.ts` themselves.

## Desired End State

- `src/lib/plan-generator/` and `/api/plans/generate` have unit +
  integration test coverage for the valid input domain, the validation
  boundary, and the persistence-failure path; the generator's two latent
  fallback/crash branches are pinned by an explicit test rather than
  silently undocumented.
- A real login, performed through the UI against a local Supabase
  instance, is proven to establish a session that `middleware.ts` reads
  correctly for both a page route (`/dashboard`) and an API route
  (`/api/plans`), for both the allow and deny cases.
- `npm run test` runs as a required step in the `ci` GitHub Actions job.
- `test-plan.md` §3 Phase 1's test-types cell, §5's unit+integration gate,
  and §6.1/§6.2/§6.3/§6.4 reflect what was actually built.

**Verification**: `npm run test` and `npm run test:e2e` both pass locally
and in CI; `npm run lint` and `npm run build` remain green.

## What We're NOT Doing

- Not writing the login→questionnaire→plan full-seam e2e test (Risk #2) —
  that is test-plan.md §3 Phase 2's job. This phase's e2e login test
  proves the *authorization gate* (does an authenticated request get
  past `middleware.ts`), not that plan generation succeeds end-to-end
  through the UI.
- Not asserting a full 200 from an authenticated `/api/plans/generate`
  call in the e2e test — a deliberately minimal/invalid body is enough to
  prove the request got past the 401 gate; a real generation+persistence
  success assertion belongs to Phase 2's seam test.
- Not testing cross-session plan persistence/round-trip (Risk #5) or
  cross-user data ownership (Risk #6) — those are Phase 2 and Phase 3.
- Not fixing the plan-generator's silent-fallback defect or adding a
  thrown error for an unmatched grade/unknown injury id. This phase pins
  today's actual behavior in a test and flags it as a known gap; changing
  production behavior in response to a test finding is the bug-to-fix
  workflow (Lesson 5), not this one.
- Not adding MSW. The chosen login/session test strategy uses a real
  local Supabase instance (e2e) rather than HTTP-boundary interception,
  and the plan-generation route tests achieve the same "mock only at the
  Supabase boundary" principle by faking the `createClient()` return
  value — no new mocking library needed. `test-plan.md` §4 is updated to
  reflect this rather than left as a stale "see Phase 1" placeholder.
- Not adding cross-browser Playwright projects — Chromium only, matching
  `playwright-e2e-foundation`'s existing scope.
- Not testing the full grade×injury cartesian product — representative
  cases only (see Phase 1).
- Not touching `signout.ts` or the `/api/plans/smoke.ts` dead route.

## Implementation Approach

Two independent workstreams land in sequence, each locked into CI as it
lands rather than batched at the end:

1. **Plan generation (Risk #1)** — pure-function unit tests for the
   generator plus route-level integration tests that fake only the
   Supabase client boundary, then wire `npm run test` into the `ci` job
   immediately so this coverage is enforced right away.
2. **Login/session (Risk #3)** — stand up a local-Supabase-backed test
   user (global Playwright setup + a new CI step in the `e2e` job), then
   author the e2e spec that proves a real login is recognized by
   `middleware.ts` on both a page route and an API route.

A final sub-phase folds both workstreams' real patterns back into
`test-plan.md`'s cookbook (§6) and closes out the strategy-table
placeholders (§3, §5) that named this phase.

## Phase 1: Plan-generation risk coverage (Risk #1)

### Overview

Unit-test the generator's pure mapping logic (including its two latent
fallback/crash branches) and integration-test the `/api/plans/generate`
route's validation, auth guard, success, and persistence-failure paths —
faking only the Supabase client boundary, following the pattern the
existing auth tests already use.

### Changes Required:

#### 1. Plan-generator unit tests

**File**: `src/lib/plan-generator/index.test.ts` (new)

**Intent**: Prove `generateWeeklyPlan` produces the correct template and
injury substitutions across the real input domain, and pin its two
currently-unreachable-via-the-route fallback/crash branches so a future
change can't silently reopen the recorded incident without a test
noticing.

**Contract**: One case per climbing grade (6, proving each grade selects
its intended template — expected template/substitution values must be
derived independently from `context/archive/2026-06-14-first-weekly-plan-flow/plan.md`'s
stated business intent plus the template's own exercise semantics, not
by reading `injury-rules.ts`'s current output and asserting it matches
itself); one case per injury option (6, proving substitution fires for a
conflicting exercise and leaves non-conflicting ones untouched); 2-3
multi-injury combination cases; one zero-injury baseline. Two additional
pinning cases call `generateWeeklyPlan` with a type-widened out-of-domain
grade and an unknown injury id respectively, asserting today's actual
behavior (silent fallback to the first template; the `TypeError`) so a
regression is visible even though the live route can't currently trigger
either path.

#### 2. Plan-generation route integration tests

**File**: `src/pages/api/plans/generate.test.ts` (new)

**Intent**: Prove the route rejects every invalid-input shape with a
handled error (never an unhandled 500) and that both a generation success
and a persistence failure are handled distinctly and correctly, using the
same "fake `createClient`'s return value" pattern the existing auth tests
already establish — never mocking `@/lib/plan-generator` or
`@/lib/plan-persistence` internally.

**Contract**: One test per `validateQuestionnaireRequest` branch (7) plus
the content-type 415 and malformed-JSON 400 checks — each asserting the
specific 400/415 status and error message, not just "not 200". One
unauthenticated-request test asserting 401 without needing a real
session. One Supabase-not-configured test asserting 503. One success-path
test with a fake Supabase client whose `.rpc()` and `.from()` chain
resolve realistic data, asserting 200 and that `saveCurrentPlan` was
called with the generator's actual output. One persistence-failure test
with the fake client's `.rpc()` resolving `{ error: {...} }`, asserting
500 with the `PlanPersistenceError` message — proving this failure mode
(a successful generation that fails to save) is distinguishable from a
generation failure only by its message, which is itself worth confirming
since both currently share one catch-all.

### Success Criteria:

#### Automated Verification:

- [ ] `npm run test` passes with the new generator and route test files included
- [ ] `npm run lint` passes
- [ ] `npx astro sync` runs cleanly (no schema/type drift introduced)

#### Manual Verification:

- [ ] Reviewer confirms the grade/injury expected values in the new unit tests were derived from the archived business-rule spec, not copied from `injury-rules.ts`'s current output
- [ ] Reviewer confirms the two pinning tests' assertions describe today's actual (imperfect) behavior rather than the desired behavior, and are clearly commented as a known follow-up rather than an endorsed contract

---

## Phase 2: CI wiring for the unit + integration gate

### Overview

Lock Phase 1's coverage into CI immediately rather than waiting for a
later "gates" phase — `test-plan.md` §5 already states this gate becomes
required once this phase lands.

### Changes Required:

#### 1. Unit + integration test step

**File**: `.github/workflows/ci.yml`

**Intent**: Make `npm run test` a required step in the existing `ci` job
so a broken unit/integration test fails the same PR check lint and build
already do.

**Contract**: Add a `- run: npm run test` step to the `ci` job, after
`npm run lint` and before `npm run build` (fail fast on logic errors
before spending time on the slower build step). No new secrets needed —
every test in this phase fakes the Supabase boundary, matching the
existing `signin.test.ts`/`signup.test.ts`/`confirm.test.ts` pattern.

### Success Criteria:

#### Automated Verification:

- [ ] A deliberately broken test (temporary, reverted before merge) causes the `ci` job to fail in a local `act`/PR dry run, confirming the step is wired correctly
- [ ] `npm run test`, `npm run lint`, and `npm run build` all pass in the final `ci` job run

#### Manual Verification:

- [ ] Reviewer confirms the new step's position (after lint, before build) matches the intended fail-fast ordering

---

## Phase 3: Local Supabase test-user infrastructure

### Overview

Stand up the plumbing the Phase 4 e2e test needs: a real, seeded test
user in a real local Supabase instance, available both to a developer
running `npm run test:e2e` locally and to the `e2e` CI job.

### Changes Required:

#### 1. Test-user constants

**File**: `e2e/fixtures/test-user.ts` (new)

**Intent**: Give the global-setup script and the spec file a single
shared source of truth for the seeded test user's credentials.

**Contract**: Export a fixed, non-secret local-only email/password pair
(this is a local Supabase dev-stack credential, not a real account — safe
to commit, consistent with the "no hardcoded Supabase URLs/keys" rule
applying to *production* secrets, not local-dev-only fixture data).

#### 2. Playwright global setup

**File**: `e2e/global-setup.ts` (new)

**Intent**: Idempotently ensure the test user from `test-user.ts` exists
in whichever local Supabase instance `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`
point at, before any spec runs.

**Contract**: A Playwright `globalSetup` function using
`@supabase/supabase-js`'s `createClient(url, serviceRoleKey)` and
`auth.admin.createUser({ email, password, email_confirm: true })`,
tolerating an "already exists" error as success (so repeated local runs
don't fail). Reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from
`process.env` directly — this is a Node-side setup script, not part of
the app's `astro:env` schema, so it isn't declared in `astro.config.mjs`.

#### 3. Playwright config wiring

**File**: `playwright.config.ts`

**Intent**: Run the new global setup before any test.

**Contract**: Add `globalSetup: "./e2e/global-setup.ts"` to the
`defineConfig(...)` call.

#### 4. CI: start local Supabase and export its connection details

**File**: `.github/workflows/ci.yml`

**Intent**: Give the `e2e` job a real, migrated local Supabase instance
and the credentials both the app (`SUPABASE_URL`/`SUPABASE_KEY`, anon
scope) and the global-setup script (`SUPABASE_SERVICE_ROLE_KEY`) need,
captured dynamically rather than hardcoded.

**Contract**: Before the `npm run test:e2e` step, add: `npx supabase
start` (applies `supabase/migrations` automatically on a fresh runner —
Docker is preinstalled on `ubuntu-latest`), then a step that runs
`npx supabase status -o json` and writes `SUPABASE_URL` (the local API
URL), `SUPABASE_KEY` (the anon key), and `SUPABASE_SERVICE_ROLE_KEY`
into `$GITHUB_ENV` so subsequent steps (including the `npm run test:e2e`
step, whose spawned `npm run dev` inherits process env) see them. No
`.dev.vars` involvement, matching the existing `build` step's
plain-env-var precedent.

#### 5. Local dev documentation

**File**: `.env.example`

**Intent**: Let a developer running the new e2e test locally know
`SUPABASE_SERVICE_ROLE_KEY` is expected (in addition to the existing
`SUPABASE_URL`/`SUPABASE_KEY`), sourced from their own `supabase start`
output.

**Contract**: Add a `SUPABASE_SERVICE_ROLE_KEY=###` line with a one-line
comment pointing at `supabase status`.

### Success Criteria:

#### Automated Verification:

- [ ] `npx supabase start` succeeds locally and `supabase/migrations` apply cleanly
- [ ] Running `npm run test:e2e` locally (with `SUPABASE_URL`/`SUPABASE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` exported from `supabase status`) executes global setup without error, confirmed via a temporary log line (removed before merge)
- [ ] The `e2e` CI job's new Supabase-start step succeeds and populates `$GITHUB_ENV`

#### Manual Verification:

- [ ] Reviewer confirms no real/production Supabase credential appears anywhere in the diff — only local-stack values captured at CI runtime

---

## Phase 4: Login/session e2e coverage (Risk #3)

### Overview

Prove `middleware.ts` correctly reads a real session for both branches
(page redirect, API 401) in both directions (allow, deny), using the test
user Phase 3 seeded.

### Changes Required:

#### 1. Login/session e2e spec

**File**: `e2e/login-session.spec.ts` (new)

**Intent**: Close the gap the research confirmed: no test anywhere
exercises a successful login or the middleware's allow-branch, for
either protected-route type.

**Contract**: A `test.describe` block with: (1) filling and submitting
the real sign-in form (`getByLabel`/`getByRole`, matching
`dashboard-access.spec.ts`'s locator convention) with the Phase 3 test
user's credentials, asserting the resulting URL is `/dashboard` and that
authenticated dashboard content is visible (not the sign-in form) — this
is the page-route allow case; (2) an authenticated `request.post()` to
`/api/plans/generate` (Playwright's `APIRequestContext`, reusing the
browser context's session cookie) with a deliberately minimal/invalid
body, asserting the response status is anything *other than* 401 — this
proves middleware's allow-branch for the API-route type without
re-testing generation logic (already covered in Phase 1) or asserting a
full success (deliberately out of scope, see "What We're NOT Doing");
(3) the equivalent unauthenticated `request.post()` to the same endpoint,
asserting 401 — completing the API-route deny case (`dashboard-access.spec.ts`
already covers the page-route deny case).

### Success Criteria:

#### Automated Verification:

- [ ] `npm run test:e2e` passes locally against a `supabase start` instance
- [ ] The `e2e` CI job passes with the new spec included

#### Manual Verification:

- [ ] A human runs `npm run test:e2e` locally at least once against a freshly-started local Supabase instance (not just CI) to confirm the global-setup + login flow works outside CI's environment
- [ ] Reviewer confirms the API-route assertion is genuinely scoped to "not 401" rather than accidentally asserting a full generation success

---

## Phase 5: Cookbook and test-plan.md sync

### Overview

Fold both workstreams' real patterns back into `test-plan.md` so future
contributors (and `/10x-tdd` in Lesson 2) have a working reference
instead of `TBD` placeholders, and correct the strategy tables this phase
touches.

### Changes Required:

#### 1. Cookbook patterns

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the `TBD — see §3 Phase 1` placeholders this phase
resolves with the actual location/naming/reference-test/run-command
pattern, and note the API-endpoint pattern.

**Contract**: §6.1 (unit test) references `src/lib/plan-generator/index.test.ts`
as the reference test and states the "no exact-value oracle from the code
under test" rule this phase followed. §6.2 (integration test) references
`src/pages/api/plans/generate.test.ts` and states the "fake only
`createClient`'s return value" boundary rule. §6.4 (new API endpoint)
points at the same file as its reference. §6.3 (e2e) gets an added note
for the authenticated-test pattern: `e2e/global-setup.ts` +
`e2e/fixtures/test-user.ts`, and the CI local-Supabase-start sequence.

#### 2. Strategy table corrections

**File**: `context/foundation/test-plan.md`

**Intent**: Keep §3 and §5 accurate now that this phase's actual test
types and gate status are known.

**Contract**: §3 Phase 1's "Test types" cell becomes `unit + integration
+ e2e` (the login/session work landed as e2e, not integration, per this
plan's design decision). §5's `unit + integration` gate row's
"Required?" cell becomes `required` (dropping the `after §3 Phase 1`
qualifier, since Phase 1 now has landed). §4's `API mocking` / MSW row is
corrected from `none yet — see Phase 1` to a short note that Phase 1
resolved the mocking-boundary need without adding MSW (see "What We're
NOT Doing"). Do not touch §3's `Status` column — that transition to
`complete` is the `/10x-test-plan` orchestrator's job on its next
invocation, not this plan's.

### Success Criteria:

#### Automated Verification:

- [ ] `test-plan.md` still renders as valid Markdown (no broken tables)

#### Manual Verification:

- [ ] A reader who has not seen this change can read §6.1/§6.2/§6.3/§6.4 alone and know where to add the next test of each kind
- [ ] §3/§4/§5 accurately describe what actually shipped, with no stale "see Phase 1" references left for work this phase completed

---

## Testing Strategy

### Unit Tests:

- Pure `generateWeeklyPlan` mapping logic: template selection per grade, injury substitution per injury option, multi-injury combination, zero-injury baseline, and the two latent fallback/crash branches (pinned, not fixed).

### Integration Tests:

- `/api/plans/generate` route: every validation branch, the auth guard, the Supabase-not-configured guard, a generation+persistence success, and a persistence failure — all faking only the `createClient()` boundary.

### E2E Tests:

- Real login through the UI against a local Supabase instance, then both protected-route branches (page redirect, API 401) checked in both directions (allow, deny) using that real session.

### Manual Testing Steps:

1. Run `supabase start`, then `npm run test:e2e` locally; confirm the login spec passes against a real (local) backend.
2. Run `npm run test`; confirm the new generator and route tests pass and the persistence-failure case's error message matches what a real user would see.
3. Temporarily break one validation branch in `generate.ts` and confirm the corresponding new test catches it, then revert.

## Migration Notes

No data migration. `supabase/migrations` already define the schema this
phase's e2e test relies on; no new migration is introduced.

## References

- Test strategy source: `context/foundation/test-plan.md` §2 (Risk Map), §3 Phase 1 row, Risk Response Guidance for Risks #1 and #3
- Prior related work: `context/changes/playwright-e2e-foundation/plan.md` (Playwright harness, deliberately deferred the real-login case this plan now closes)
- Recorded incident: `context/foundation/improvements.md` item 1
- Prior review flagging the generator's latent gap: `context/archive/2026-06-14-first-weekly-plan-flow/reviews/impl-review.md` finding F2
- Business-rule intent for the generator: `context/archive/2026-06-14-first-weekly-plan-flow/plan.md:202-260`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Plan-generation risk coverage (Risk #1)

#### Automated

- [x] 1.1 `npm run test` passes with the new generator and route test files included
- [x] 1.2 `npm run lint` passes
- [x] 1.3 `npx astro sync` runs cleanly (no schema/type drift introduced)

#### Manual

- [x] 1.4 Reviewer confirms the grade/injury expected values in the new unit tests were derived from the archived business-rule spec, not copied from `injury-rules.ts`'s current output
- [x] 1.5 Reviewer confirms the two pinning tests' assertions describe today's actual (imperfect) behavior rather than the desired behavior, and are clearly commented as a known follow-up rather than an endorsed contract

### Phase 2: CI wiring for the unit + integration gate

#### Automated

- [ ] 2.1 A deliberately broken test (temporary, reverted before merge) causes the `ci` job to fail in a local `act`/PR dry run, confirming the step is wired correctly
- [ ] 2.2 `npm run test`, `npm run lint`, and `npm run build` all pass in the final `ci` job run

#### Manual

- [ ] 2.3 Reviewer confirms the new step's position (after lint, before build) matches the intended fail-fast ordering

### Phase 3: Local Supabase test-user infrastructure

#### Automated

- [ ] 3.1 `npx supabase start` succeeds locally and `supabase/migrations` apply cleanly
- [ ] 3.2 Running `npm run test:e2e` locally (with `SUPABASE_URL`/`SUPABASE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` exported from `supabase status`) executes global setup without error, confirmed via a temporary log line (removed before merge)
- [ ] 3.3 The `e2e` CI job's new Supabase-start step succeeds and populates `$GITHUB_ENV`

#### Manual

- [ ] 3.4 Reviewer confirms no real/production Supabase credential appears anywhere in the diff — only local-stack values captured at CI runtime

### Phase 4: Login/session e2e coverage (Risk #3)

#### Automated

- [ ] 4.1 `npm run test:e2e` passes locally against a `supabase start` instance
- [ ] 4.2 The `e2e` CI job passes with the new spec included

#### Manual

- [ ] 4.3 A human runs `npm run test:e2e` locally at least once against a freshly-started local Supabase instance (not just CI) to confirm the global-setup + login flow works outside CI's environment
- [ ] 4.4 Reviewer confirms the API-route assertion is genuinely scoped to "not 401" rather than accidentally asserting a full generation success

### Phase 5: Cookbook and test-plan.md sync

#### Automated

- [ ] 5.1 `test-plan.md` still renders as valid Markdown (no broken tables)

#### Manual

- [ ] 5.2 A reader who has not seen this change can read §6.1/§6.2/§6.3/§6.4 alone and know where to add the next test of each kind
- [ ] 5.3 §3/§4/§5 accurately describe what actually shipped, with no stale "see Phase 1" references left for work this phase completed
