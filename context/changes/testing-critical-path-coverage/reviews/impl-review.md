<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Testing Critical Path Coverage

- **Plan**: context/changes/testing-critical-path-coverage/plan.md
- **Scope**: Phase 5 of 5 (full plan review)
- **Date**: 2026-09-07
- **Verdict**: REJECTED
- **Findings**: 1 critical, 0 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

Notes on non-PASS dimensions:

- **Safety & Quality FAIL**: driven entirely by F1 below — a real but narrowly-scoped and cheap-to-fix gap in test-only tooling (`e2e/global-setup.ts`), not a defect in shipped application code (no `src/` production file was touched by this change).
- **Success Criteria WARNING**: all automated checks that could be run locally passed (`npm run test` 43/43, `npm run lint` 0 errors, `npm run test:e2e` 5/5 against a real local Supabase instance, `.github/workflows/ci.yml` validated as syntactically correct YAML). Two Progress items (3.3, 4.2) remain genuinely unverifiable until this branch is pushed and the `e2e` CI job actually runs — this is a known, already-disclosed limitation, not a failure. F2 (a stale doc line, pre-existing and outside this phase's contract) is also folded in here.
- Three deliberate adaptations from the plan's literal text were verified as sound rather than penalized: `e2e/global-setup.ts` skips (warns, doesn't throw) when Supabase env vars are absent — preserves the pre-existing zero-config e2e test; `.github/workflows/ci.yml` excludes `vector`/`edge-runtime` containers — neither is used by this app; `e2e/login-session.spec.ts` asserts exactly `400` rather than "not 401" — strictly stronger than the plan asked for.

## Findings

### F1 — No guardrail against seeding a real/production Supabase project

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: e2e/global-setup.ts:22-32

- **Detail**: `global-setup.ts` only checks that `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are *present* before calling `supabaseAdmin.auth.admin.createUser(...)` with the fixed, publicly-committed credentials from `e2e/fixtures/test-user.ts` (`e2e-login@preptoclimb.local` / `e2e-test-password-1`). There is no check that the URL is actually the local Supabase stack. If a developer's `.env` (or a misconfigured CI secret) happens to hold a real hosted project's `SUPABASE_URL`/service-role key — plausible, since many teams keep real dev/staging credentials in `.env` for day-to-day `npm run dev` work — running `npm run test:e2e` would silently create a real account with a known, low-entropy password in a live system. Because the password is committed to the repo, anyone who reads it could sign in to that account on the real project.

- **Fix**: Add a guard in `e2e/global-setup.ts` that refuses to proceed unless `SUPABASE_URL` is clearly local (matches `127.0.0.1`/`localhost`), before constructing the admin client.
  ```ts
  const isLocalSupabaseUrl = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(supabaseUrl);
  if (!isLocalSupabaseUrl) {
    throw new Error(
      `Refusing to seed the e2e test user against a non-local Supabase URL (${supabaseUrl}). ` +
        "This script only supports the local `supabase start` stack — never point it at a hosted project.",
    );
  }
  ```
- **Decision**: FIXED — switched to `new URL(supabaseUrl).hostname` check (the initial regex draft had a bug: it required a trailing slash, which would have rejected the real local URL format `http://127.0.0.1:54321`; caught and corrected before landing). Re-verified against a real local Supabase instance: all 5 e2e tests still pass.

### F2 — test-plan.md §4 Playwright row still reads "none yet — see Phase 2"

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/foundation/test-plan.md §4 (Stack table)

- **Detail**: Playwright is now used by this phase's own `e2e/login-session.spec.ts`, but the §4 stack table's Playwright row still says "none yet — see Phase 2" (Playwright itself was actually installed by the separate, earlier `playwright-e2e-foundation` change, and this phase's contract for §4 only named the MSW row for correction — so this is a pre-existing staleness, not something this phase's plan asked to fix). Flagged for completeness, not a phase-5 contract violation.
- **Fix**: Update the Playwright row's version/notes cell to reflect that it's in active use (e.g. `^1.63.0 — in use since playwright-e2e-foundation; authenticated pattern added §3 Phase 1`).
- **Decision**: FIXED
