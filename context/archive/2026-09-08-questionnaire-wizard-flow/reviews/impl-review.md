<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Multi-Step Questionnaire Wizard

- **Plan**: context/changes/questionnaire-wizard-flow/plan.md
- **Scope**: Phase 1-3 of 3 (full plan)
- **Date**: 2026-09-08
- **Verdict**: REJECTED
- **Findings**: 1 critical, 1 warning, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Enter key in injury search submits the plan prematurely

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/plans/QuestionnaireStepInjuries.tsx:104-113 (search input); src/components/plans/QuestionnaireForm.tsx:96-118 (handleSubmit)
- **Detail**: The new search `<input type="text">` on the injuries step has no `onKeyDown` guard and sits inside the wizard `<form>`. Pressing Enter while typing a search term triggers native implicit form submission. Since `getStepErrors("injuries", draft)` always returns `{}` (no required fields on this step), `handleSubmit` sees `isLastStep === true` and calls `onSubmit(...)` immediately — firing the real `/api/plans/generate` request with whatever `injuryLimitations` happen to be toggled at that instant, before the user finished searching for and selecting the injury they were looking for. Injury status drives the exercise-substitution safety logic downstream, so submitting with an incomplete injury list is a real data-safety concern, not just a UX papercut. This is a materially new risk introduced by this phase: the old single-page form had no free-text search field, so there was no interaction pattern where a user habitually types-then-hits-Enter expecting a "confirm search" action instead of "submit the whole questionnaire."
- **Fix**: Add `onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}` to the search input in `QuestionnaireStepInjuries.tsx`.
  - Strength: One isolated element change; browser Enter-submits-form behavior is well understood, so this fully closes the gap.
  - Tradeoff: None significant — the search input has no other reason to handle Enter.
  - Confidence: HIGH — narrowly scoped, no other code path depends on Enter behavior in this input.
  - Blind spot: Doesn't add a regression test; worth a follow-up e2e case ("pressing Enter in the injury search box does not submit the questionnaire") so this can't silently regress.
- **Decision**: FIXED — added `onKeyDown` guard to `QuestionnaireStepInjuries.tsx`'s search input.

### F2 — Back button stays enabled during in-flight submission

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/plans/QuestionnaireForm.tsx:174-184
- **Detail**: The submit button is `disabled={pending}` (line 188) but the Back button has no such guard. While the final submit request is in flight, a user can click Back to land on step 2, where the same button re-renders as "Next" — but `pending` is still `true`, so it shows a disabled "Generating your weekly plan..." label next to step-2 fields, a confusing state. If the in-flight request then resolves successfully, `DashboardPlanShell.tsx` hides the whole wizard panel out from under the user mid-navigation.
- **Fix**: Add `disabled={pending}` to the Back button, matching the submit button's existing guard.
  - Strength: Mirrors an existing, already-correct pattern one button over.
  - Tradeoff: None.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED — added `disabled={pending}` to the Back button in `QuestionnaireForm.tsx`.

### F3 — Acute/chronic toggle buttons lack aria-pressed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Accessibility)
- **Location**: src/components/plans/QuestionnaireStepInjuries.tsx:69-80
- **Detail**: The acute/chronic status toggle conveys the active status only via a background-color class; there's no `aria-pressed` (or `role="radiogroup"`), so screen-reader users can't perceive which status is currently selected. Note: this exact markup was carried over verbatim from the pre-wizard single-page form (not newly introduced by this phase), but it's now easier to fix in isolation since it lives in its own small component.
- **Fix**: Add `aria-pressed={declared.status === status}` to each status button.
  - Strength: One-attribute addition, no visual/behavioral change.
  - Tradeoff: None.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED — added `aria-pressed` to the status toggle buttons in `QuestionnaireStepInjuries.tsx`.

### F4 — Step transitions have no aria-live announcement or focus management

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Accessibility)
- **Location**: src/components/plans/QuestionnaireForm.tsx:129-131
- **Detail**: The "Step X of 3: <title>" indicator is a plain `<p>` with no `aria-live` region, and clicking Next/Back doesn't move focus to the new step's heading or first field. Screen-reader and keyboard users may not notice the step actually changed. This is new UI introduced by this phase (the single-page form had no steps to announce).
- **Fix**: Add `aria-live="polite"` to the step-indicator paragraph; optionally move focus to the new step's first control after `setStepIndex` changes.
- **Decision**: FIXED — added `aria-live="polite"` to the step-indicator paragraph in `QuestionnaireForm.tsx` (focus management left as a future enhancement, not applied).

### F5 — handleSubmit has no explicit re-entrancy guard

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/plans/QuestionnaireForm.tsx:96-118
- **Detail**: `handleSubmit` relies solely on the submit button's `disabled={pending}` to prevent double-submission; there's no `if (pending) return;` inside the handler itself. Safe today under normal React click semantics, but no defense-in-depth if this component is ever wired differently. Matches the original single-page form's behavior — not a regression.
- **Fix**: Add `if (pending) return;` at the top of `handleSubmit` as a cheap extra safeguard.
- **Decision**: FIXED — added the re-entrancy guard to `handleSubmit` in `QuestionnaireForm.tsx`.

### F6 — sessionsPerWeek validation accepts fractional values

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/questionnaire-wizard-validation.ts:25-27
- **Detail**: The range check (`=== "" || < 1 || > 7`) has no integer check, so `3.5` would pass. This is the exact validation logic carried over from the original `handleSubmit` (the plan's "Validation error wording" contract required reusing it verbatim) — not a new gap, but worth noting since the input control is a plain `type="number"` without a `step` constraint.
- **Fix**: Add `!Number.isInteger(draft.sessionsPerWeek)` to the condition, if fractional values are undesirable downstream. Low priority — no evidence this is currently reachable via the UI's number input in practice.
- **Decision**: FIXED — added the integer check to `questionnaire-wizard-validation.ts` plus a regression test in `questionnaire-wizard-validation.test.ts`.

## Additional notes

**Plan drift**: none. Both sub-agent passes confirm all three phases match `plan.md`'s stated intent exactly, including the two flagged Critical Implementation Details (default `"chronic"` status on new injury selection, exact validation error wording reuse). No unplanned files, no scope creep. All "What We're NOT Doing" boundaries (`generate.ts`, `plan-types.ts`, `plan-flow-types.ts`, `DashboardPlanShell.tsx`, no new dependency, no `jsdom`/RTL) were confirmed untouched.

**Success Criteria state**: Automated — lint/build/unit tests pass cleanly (59/59 tests). The e2e spec (3.2) has not been run to a pass anywhere yet — it fails in this sandbox purely because no local Supabase is configured, at the identical auth boundary as the pre-existing `e2e/login-session.spec.ts`; this is an environment gap, not a code defect, but it means the e2e spec is unverified, not verified. Manual verification items (1.4-1.6, 2.4-2.7, 3.5) are honestly left unchecked (not rubber-stamped) — the user deferred manual testing to review after implementation.
