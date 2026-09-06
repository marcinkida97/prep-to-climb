<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Guard Sign-In/Sign-Up Against Supabase Outage

- **Plan**: context/changes/auth-outage-error-handling/plan.md
- **Scope**: Phase 3 of 3 (added and completed post-review; Phases 1-2 already reviewed in impl-review.md)
- **Date**: 2026-09-06
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Untested branches: "Supabase not configured" and missing form fields

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/pages/api/auth/signin.test.ts, src/pages/api/auth/signup.test.ts
- **Detail**: Both test files cover the two Testing Strategy cases (thrown error → generic message, resolved `{error}` → verbatim message) but neither covers the `if (!supabase)` "not configured" branch (signin.ts:10-12, signup.ts:10-12) or a missing/null form field. A regression that breaks either of those would ship undetected. Not a plan violation — the Testing Strategy spec only asked for the two cases implemented — but a real coverage gap in the safety net this phase is meant to build.
- **Fix**: Add one more case per file mocking `createClient` to return `null` and asserting the "Supabase is not configured" redirect.
- **Decision**: FIXED — added `"redirects when Supabase is not configured"` case to both signin.test.ts and signup.test.ts; `npm run test` now shows 6 passing.

### F2 — vitest.config.ts change undocumented in Phase 3's plan text

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: vitest.config.ts:13
- **Detail**: The `exclude: ["node_modules/**", "dist/**", "e2e/**"]` addition was necessary (Vitest's default include glob was also matching the Playwright spec in `e2e/`, crashing `npm run test`) and was called out in the commit message, but Phase 3's "Changes Required" section in plan.md was never updated to mention touching this file.
- **Fix**: Add a short line to Phase 3's Changes Required in plan.md documenting the vitest.config.ts fix and why it was needed, so the plan stays the accurate record of what shipped.
- **Decision**: FIXED — added "3. Scope Vitest away from the Playwright suite" to Phase 3's Changes Required in plan.md.

### F3 — exclude replaces Vitest's defaultExclude instead of extending it

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: vitest.config.ts:13
- **Detail**: The new `exclude` array fully replaces Vitest's built-in `defaultExclude` (which also drops `.git`/`.cache` dirs and `*.config.*` files from discovery) rather than extending it. Low risk today since nothing else matches the test glob, but it's a latent gap as the repo grows.
- **Fix**: Import `configDefaults` from `vitest/config` and use `exclude: [...configDefaults.exclude, "e2e/**"]`.
- **Decision**: FIXED — vitest.config.ts updated; `npm run test`/`lint`/`build` all still pass.
