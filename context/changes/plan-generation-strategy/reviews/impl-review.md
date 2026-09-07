<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Smarter Weekly-Plan Generation

- **Plan**: context/changes/plan-generation-strategy/plan.md
- **Scope**: Phase 5 of 5 (full plan review)
- **Date**: 2026-09-07
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — `ExerciseLibraryError` swallows the underlying Supabase error

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/plan-generator/exercise-library.ts:44-51
- **Detail**: `ExerciseLibraryError extends Error {}` takes no `cause` and never sets `this.name`, so a real Supabase failure surfaces only as a generic `"Failed to load the exercise library"` message with `error.name === "Error"`. The sibling `PlanPersistenceError` in `src/lib/plan-persistence.ts` already establishes the pattern this repo uses for wrapping Postgrest errors: it accepts a `cause` and stores `causeDetail = JSON.stringify(cause)` for debugging, plus sets `this.name` in its constructor. `exercise-library.ts` doesn't follow that precedent.
- **Fix**: Give `ExerciseLibraryError` a constructor that accepts the Postgrest error, sets `this.name = "ExerciseLibraryError"`, and stores a `causeDetail` the same way `PlanPersistenceError` does, then pass the real `error` into it at the throw site.
- **Decision**: FIXED — constructor now mirrors `PlanPersistenceError` exactly (cause param, `causeDetail`, `this.name`); throw site passes the real error. Verified lint/test/build all still green.

### F2 — Assembler trusts `primaryGoal` is already validated

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/plan-generator/index.ts:27-33, 175
- **Detail**: `GOAL_DAY_MODALITIES[primaryGoal]` and `GOAL_SUMMARIES[questionnaire.primaryGoal]` will throw an unguarded `TypeError` if `primaryGoal` is ever outside the 5 known values. Today this can't happen — `generate.ts`'s `validateQuestionnaireRequest` checks `primaryGoal` against `PRIMARY_GOALS` before the assembler ever runs, matching this repo's "validate only at system boundaries" convention (AGENTS.md). Confirmed correct behavior, not a bug — just undocumented as an invariant.
- **Fix**: Optional — add a one-line comment above `GOAL_DAY_MODALITIES`/`GOAL_SUMMARIES` noting that `primaryGoal` is assumed pre-validated by the API boundary, matching how `index.ts` already comments the acute-injury guardrail.
- **Decision**: FIXED — added the invariant comment above `GOAL_DAY_MODALITIES`.

## Reviewer notes (not findings — confirmed correct, no action needed)

- **Plan Adherence**: all 5 phases' Contract/Intent match their actual implementation exactly, including the assembler's grade/equipment/chronic-exclusion filtering, the acute-injury conservative fallback (never substitutes within the same modality), the soft training-age gate (caution note appended, never removes the exercise), and the `sessionsPerWeek` day-bounding via the documented priority order.
- **Documented adaptations verified as fully resolved, not left as permanent placeholders**: (1) `templates.ts`/`injury-rules.ts` deletion deferred from Phase 2 to Phase 3 — confirmed both files are gone and no `PLAN_TEMPLATES`/`INJURY_RULES` references remain anywhere in `src/`. (2) `QuestionnaireResponseInput`'s Phase-4 type fields pulled forward into Phase 3 with mechanical-only patches to `generate.ts`/`plan-persistence.ts`/`QuestionnaireForm.tsx`/`dashboard.astro`/`WeeklyPlanView.tsx` — confirmed Phase 4 subsequently added real validation (`validateQuestionnaireRequest`) and real form controls (training age, sessions/week, equipment, goal, per-injury acute/chronic toggle), replacing the Phase 3 placeholder defaults entirely.
- **Pre-existing, unrelated TypeScript errors** (confirmed present before this change via `git stash` at session start) were independently re-verified via `tsc --noEmit`: the `nextGrade: string` literal-union mismatch in `QuestionnaireForm.tsx:61` and the five `jsonResponse<PlanQuestionnaireResponse>` generic-arity errors in `generate.ts` are present in identical form/count/location — not introduced or worsened by this change.
- **Security**: the auth check (`context.locals.user`) in `generate.ts` is intact and backed by `PROTECTED_ROUTES` in `middleware.ts`; the migration's static seed-data array literals carry no injection risk (hand-authored, not user-derived); `exercise_library`'s RLS grants `select`-only to `authenticated`, no insert/update/delete.
- **Data safety**: the destructive `delete from questionnaire_responses` before adding `NOT NULL` columns matches the plan's documented one-way migration design, and cascade ordering is correct given the existing `ON DELETE CASCADE` chain from the first migration.
- **Scope discipline**: the two ripple files not named in any phase's "Changes Required" (`WeeklyPlanView.tsx`, `dashboard.astro`) received only minimal, necessary mechanical patches (a display-mapping fix and four blank-draft fields, respectively) required by the type changes — not scope creep.
- **Success criteria**: `npx astro sync`, `npm run lint` (0 errors), `npm run build`, and `npm run test` (42/42) all re-verified green at current HEAD; all manual Progress items are checked with recorded evidence in `verification.md` and cross-referenced against a green CI run on the deployed commit.
