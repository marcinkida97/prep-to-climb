<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Guard Sign-In/Sign-Up Against Supabase Outage

- **Plan**: context/changes/auth-outage-error-handling/plan.md
- **Scope**: Phase 1 of 2, Phase 2 of 2 (full plan)
- **Date**: 2026-09-06
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — console.error logs the raw caught error object instead of a sanitized message

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/signin.ts:20, src/pages/api/auth/signup.ts:20
- **Detail**: The catch block logs the raw `err` object (`console.error("signin: supabase call failed", err)`). No credential leak today — `email`/`password` are never concatenated into the logged value, and the redirect message to the client is correctly a fixed literal, not derived from `err`. But logging the raw error object trusts an unenforced assumption that supabase-js's thrown errors never attach request context (URL, headers, body) — true today, not guaranteed on a future supabase-js upgrade. These logs land in Cloudflare Workers' observability output.
- **Fix**: Log a sanitized subset instead: `console.error("signin: supabase call failed", err instanceof Error ? err.message : String(err));` (mirror in signup.ts).
- **Decision**: FIXED

### F2 — signout.ts has the identical unguarded-await gap, left open by design

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/auth/signout.ts:7
- **Detail**: `await supabase.auth.signOut()` is still unguarded. This was an explicit, confirmed exclusion in the plan ("Not touching signout.ts... deliberately left for a separate, later fix") — not a defect in this change — but after this change lands, two of the three auth routes handle the outage risk and one doesn't, which is worth tracking so it isn't forgotten.
- **Fix**: Track as a follow-up change (new `/10x-new`) to add the same try/catch guard to signout.ts; not required for this change since it was explicitly out of scope by design.
- **Decision**: FIXED (user chose to fix now, expanding scope beyond the original plan — see triage). Applied: wrapped `supabase.auth.signOut()` in try/catch, logging a sanitized message on failure (matching F1's fix) and still redirecting to `/` regardless, since signout has no user-facing error-message convention to preserve and should degrade gracefully.
