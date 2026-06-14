<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Minimal Plan Persistence Contract

- **Plan**: `context/changes/minimal-plan-persistence-contract/plan.md`
- **Scope**: Full plan review
- **Date**: 2026-06-14
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | FAIL |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | FAIL |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Save flow is not a single logical write

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Architecture
- **Location**: src/lib/plan-persistence.ts:108
- **Detail**: The plan explicitly requires questionnaire replacement and active-plan replacement to happen inside one logical write flow. The implementation performs separate `upsert` / `update` / `insert` calls and then tries to repair failures with best-effort rollback at lines 246-266. Under partial failure or concurrent requests, that rollback can restore an old questionnaire row after a newer plan has already been created, leaving questionnaire state and the active plan out of sync.
- **Fix A ⭐ Recommended**: Move the replace flow into one database transaction, exposed as a Postgres function/RPC, then call that once from the persistence module.
  - Strength: Matches the plan's sequencing requirement and removes the partial-rollback race at the source.
  - Tradeoff: Pushes more logic into SQL and adds one extra DB contract.
  - Confidence: HIGH — the current failure mode comes directly from the multi-call orchestration in this file.
  - Blind spot: I did not execute a concurrent-write repro against a live Supabase instance here.
- **Fix B**: Keep the client-orchestrated flow, but version questionnaire data and bind plans to a concrete questionnaire snapshot instead of `user_id`.
  - Strength: Preserves most of the current TypeScript structure.
  - Tradeoff: More schema and code churn than the current MVP needs, and it still leaves cross-call consistency harder to reason about.
  - Confidence: MEDIUM — it can work, but it is a larger redesign.
  - Blind spot: Not verified against the next planned slice's payload shape.
- **Decision**: FIXED via Fix A

### F2 — Phase 1 drifted from the planned Supabase config touchpoint

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: supabase/seed.sql:1
- **Detail**: Phase 1 planned a review/alignment touch on `supabase/config.toml`, but the implementation left config unchanged and instead added `supabase/seed.sql`. This is probably the right practical move because `config.toml` already had migrations and seed paths configured, but the plan was not updated to reflect that substitution.
- **Fix**: Update the plan with a short addendum explaining that `supabase/config.toml` already satisfied the contract and `seed.sql` was added only to support `supabase db reset`.
- **Decision**: FIXED

### F3 — Manual smoke verification is marked done without retained evidence

- **Severity**: 👀 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/minimal-plan-persistence-contract/plan.md:266
- **Detail**: Item 3.4 is checked off, but the repo does not retain any runtime evidence that an authenticated save/read cycle was actually executed. The code shape supports the claim, but the review cannot confirm the manual run itself.
- **Fix**: Add a short verification note to the change folder with the request used and the observed success response.
- **Decision**: FIXED
