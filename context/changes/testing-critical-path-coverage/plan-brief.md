# Testing Critical Path Coverage — Plan Brief

> Full plan: `context/changes/testing-critical-path-coverage/plan.md`

## What & Why

This is `test-plan.md` §3 Phase 1: write the tests that defend the two
confirmed core-flow failures — plan generation returning an unhandled 500
(Risk #1) and users being unable to log in (Risk #3) — and lock that
coverage into CI. Both risks trace to a real recorded incident
(`context/foundation/improvements.md`) and a real gap in the current test
suite (three auth tests exist but only cover failure paths; zero tests
exist for plan generation).

## Starting Point

Vitest and Playwright harnesses already exist (from `auth-outage-error-handling`
and `playwright-e2e-foundation`), and three auth-route tests already
cover Supabase-outage/bad-credential failure paths. But: no test exercises
a successful login or middleware's allow-branch; no test exists anywhere
near plan generation; a previously-reviewed defect in the generator
(silent wrong-template fallback for an unmatched grade) was made
unreachable via route validation but never removed or tested; and
`npm run test` isn't wired into CI at all.

## Desired End State

The plan generator and its route have full unit+integration coverage
including the input-validation boundary and a persistence-failure case;
a real e2e login against a local Supabase instance proves middleware
correctly gates both `/dashboard` and `/api/plans` in both directions;
`npm run test` is a required CI step; and `test-plan.md`'s cookbook and
gate tables reflect what actually shipped.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Login/session test layer | E2E (Playwright), not integration/MSW | User's explicit preference, overriding the cheaper-layer default; requires a real test-user strategy to be resolved |
| Test-user provisioning | Local Supabase CLI stack (already scaffolded), seeded via a Playwright global-setup script | Already a devDependency, zero secrets to manage, and local email-confirmation is disabled so signup is immediately usable |
| Generator's latent fallback/crash defect | Pin current behavior in a unit test, flag as a follow-up | Documents the real regression risk cheaply without silently changing production behavior under the guise of test-writing (that's Lesson 5's job) |
| Grade×injury matrix scope | One case per grade + one per injury + a couple combined | Covers every branch in the two independent lookups without a combinatorial (hundreds-of-cases) suite |
| Expected-value oracle | Independently authored from the archived business-rule spec, not from reading the generator's current output | Avoids the oracle problem — a real regression in the mapping logic must actually fail a test |
| Persistence failures in `/api/plans/generate` | In scope for this phase | Same route, same catch-all this phase is already testing; from the user's view it's still "no plan despite completing the flow" |
| Middleware branches covered | Both `/dashboard` (redirect) and `/api/plans` (401 JSON) | Both are live production behavior in the file this phase is already touching |
| Validation edge-case depth | One representative case per branch | Proves each of the 7 validation branches (plus 415/malformed-JSON) actually rejects, without exhaustive fuzzing |
| MSW | Not adopted | Login/session moved to e2e; route tests satisfy the "mock only at the Supabase boundary" principle by faking `createClient()`'s return value instead |
| CI wiring timing | Now, in this phase | `test-plan.md` §5 already states the unit+integration gate becomes required once this phase lands |

## Scope

**In scope:**
- Unit tests for `src/lib/plan-generator/index.ts` (matrix + latent-defect pin)
- Integration tests for `src/pages/api/plans/generate.ts` (validation, auth, success, persistence failure)
- `npm run test` wired into the `ci` CI job as a required step
- Local Supabase CLI startup + test-user seeding for e2e (global setup, CI steps)
- One new e2e spec proving real login + middleware allow/deny on both protected-route branches
- `test-plan.md` §3/§4/§5/§6 corrections

**Out of scope:**
- The full login→questionnaire→plan seam e2e test (Risk #2, Phase 2)
- Cross-session plan persistence round-trip (Risk #5) and cross-user IDOR (Risk #6)
- Fixing the generator's latent fallback/crash defect (documented, not fixed)
- MSW, cross-browser Playwright projects, exhaustive cartesian input testing

## Architecture / Approach

Two independent workstreams, each locked into CI as it lands: (1) plan
generation gets unit tests for the pure mapping logic plus integration
tests for the route, faking only the Supabase client's return value —
then `npm run test` goes into the `ci` job immediately. (2) Login/session
gets a real local Supabase instance (already scaffolded, never started
before), a Playwright global-setup script that seeds a fixed test user
via the Supabase Admin API, and a new e2e spec that logs in for real and
checks middleware's decision on both route types. A final phase updates
`test-plan.md`'s cookbook and tables to match.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Plan-generation risk coverage | Unit + integration tests for the generator and its route | Deriving expected values independently without falling into the oracle problem |
| 2. CI wiring (unit+integration) | `npm run test` required in the `ci` job | None significant |
| 3. Local Supabase test-user infra | Global setup + CI steps to start Supabase and seed a user | CI runner Docker/startup time; keeping local-stack values out of hardcoded secrets |
| 4. Login/session e2e coverage | New spec: real login, both middleware branches, both directions | Scoping the API-route assertion to "not 401" without drifting into full generation-success testing |
| 5. Cookbook + test-plan.md sync | §3/§4/§5/§6 updated to match what shipped | None significant |

**Prerequisites:** None beyond what's already in the repo (`supabase` CLI devDependency, existing migrations).
**Estimated effort:** ~2-3 sessions across 5 phases; Phase 3/4 (real Supabase e2e infra) is the novel, riskier part.

## Open Risks & Assumptions

- Assumes `npx supabase start` runs reliably within CI's runner (Docker-based, ubuntu-latest) — untested until Phase 3.
- Assumes the archived business-rule spec's stated intent is still accurate enough to derive independent expected values from — if it's drifted from what the templates actually encode, Phase 1's oracle-sourcing decision needs revisiting.
- The generator's pinned latent defect remains a live (if currently unreachable) production risk until a future change fixes it — this plan deliberately does not close that gap, only documents it.

## Success Criteria (Summary)

- `npm run test` and `npm run test:e2e` both pass locally and in CI, with the new tests included
- A malformed questionnaire submission, a persistence failure, and an unmatched-grade edge case in plan generation all produce a distinguishable, non-500-surprise, or explicitly-pinned result
- A real login is proven — via a real local Supabase session, not a mock — to unlock both `/dashboard` and `/api/plans`
