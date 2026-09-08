# Multi-Step Questionnaire Wizard Implementation Plan

## Overview

Turn the existing single-page questionnaire (`src/components/plans/QuestionnaireForm.tsx`) into a
3-step wizard — climbing profile, training context, injuries — and replace the injuries step's
plain 20-item checkbox list with a searchable multi-select, while keeping the acute/chronic status
toggle exactly as it works today. No backend, schema, or persistence contract changes.

## Current State Analysis

`QuestionnaireForm.tsx` (379 lines) is a single `<form>` collecting six fields in one screen:
climbing grade, training age, sessions/week, primary goal, equipment access (checkbox group), and
injury limitations (a checkbox list over `INJURY_OPTIONS`, 20 entries across 8 body regions, each
togglable between `"acute"`/`"chronic"` via inline buttons that only appear once an injury is
checked). Validation happens once, in `handleSubmit`, covering the four required scalar fields;
`equipmentAccess` and `injuryLimitations` have no required-field validation.

The form is fully controlled from its parent, `DashboardPlanShell.tsx`: `draftQuestionnaire` state
is lifted there, `onChange`/`onSubmit`/`error`/`pending` are passed down as props, and submission
is one atomic `POST /api/plans/generate` call. The API (`generate.ts`) validates the whole
`QuestionnaireResponseInput` object in one pass and returns a single string error on the first
validation failure — there is no per-field error map and no partial-submission support.

No wizard, multi-step, or searchable-select pattern exists anywhere in the codebase.
`src/components/ui/` has only `button.tsx` and an unrelated Astro badge; no combobox/popover
library (`cmdk`, `react-select`, `downshift`, `fuse.js`, `@radix-ui/react-select`,
`@radix-ui/react-popover`) is installed. No `*.test.tsx` files exist yet — no React
component-level test pattern is established, and `context/foundation/test-plan.md` §4 notes no
`jsdom`/`@testing-library/*` is installed (Node-only Vitest environment today).

### Key Discoveries:

- `DashboardPlanShell.tsx` passes exactly five props to the form (`error`, `pending`, `value`,
  `onChange`, `onSubmit`) and does nothing else with it — this contract can stay unchanged, so the
  wizard is entirely containable inside `QuestionnaireForm.tsx` and new sibling files.
- Toggling an injury on today defaults its status to `"chronic"`
  (`QuestionnaireForm.tsx` `toggleInjuryOption`) — this default must be preserved by whatever
  replaces the checkbox-toggle interaction, since acute is the safety-conservative status and must
  stay an explicit, deliberate choice, not a default.
- The `FormErrors` + `clearError` pattern in `QuestionnaireForm.tsx` is structurally identical to
  the one in `src/components/auth/SignInForm.tsx` (local `useState`, per-field clear on change,
  inline error rendering) — an established local convention to extend per-step, not replace.
- `context/archive/2026-09-07-plan-generation-strategy/research.md` explicitly deferred "how
  acute vs chronic self-report should surface in the UI" to this change — resolved below by
  keeping the existing toggle UI, now applied to a filtered/selected subset rather than the full
  list.

## Desired End State

A climber moves through three steps — climbing profile (grade, training age, sessions/week),
training context (equipment, goal), then injuries (search-filtered multi-select with the existing
acute/chronic toggle) — with Back always available and Next blocked until the current step's
required fields are valid. Reaching the end and submitting produces the exact same
`PlanQuestionnaireRequest` payload and generated plan as today's single-page form. A failed submit
leaves the user on the injuries step with every field across all three steps intact and the
existing error banner shown.

**Verification**: `npm run lint`, `npm run build`, and `npm run test` all pass; a new e2e spec
(`e2e/questionnaire-wizard.spec.ts`) walks an authenticated session through all three steps,
asserting blocked advancement on an invalid step, back-navigation preserving entered data, and a
successful submit reaching the plan view; manual click-through confirms the search filter and
status toggles behave as specified below.

## What We're NOT Doing

- No changes to `/api/plans/generate.ts`, its validation logic, or its error response shape.
- No changes to `src/lib/plan-types.ts` or `src/lib/plan-flow-types.ts` — the questionnaire data
  contract is unchanged; this is a pure UI restructuring.
- No changes to `DashboardPlanShell.tsx` — its props contract to the form stays as-is.
- No draft persistence (`localStorage` or otherwise) across page reloads — a reload resets to
  step 1, matching today's behavior for the single-page form.
- No new dependency for the multi-select (no `cmdk`, `@radix-ui/react-popover`, `react-select`,
  `fuse.js`) — a hand-rolled substring filter over the existing 20-item list is sufficient.
- No animated step transitions — steps swap instantly; only a step indicator and a back button are
  in scope.
- No `jsdom`/`@testing-library/react` installation — step-validation logic is unit-tested as plain
  functions, and the click-through flow is covered by one Playwright e2e spec instead.
- No visual/theme changes — that is `climbing-theme-mobile-redesign` (S-05), a separate change that
  shares this same component; this plan does not pre-empt its styling decisions beyond what's
  needed for step layout.

## Implementation Approach

Extract step-validation as pure, unit-testable functions first (Phase 1), then split
`QuestionnaireForm.tsx` into a thin wizard container plus one component per step, reusing those
functions to gate Next and to keep the existing four-field validation behavior unchanged for the
fields that already have it. The injuries step ships in Phase 1 with today's unfiltered checkbox
list so wizard mechanics can be verified independently of the search UI; Phase 2 adds the search
filter on top without touching navigation/validation logic. Phase 3 is verification and a single
e2e spec, plus the `test-plan.md` §6.6 cookbook update this project's rollout convention expects
after any phase that establishes a new test pattern.

## Critical Implementation Details

- **Default injury status on selection**: when an injury is newly added via the search/select
  interaction, it must be assigned `status: "chronic"` — matching `toggleInjuryOption`'s existing
  default — not left unset or defaulted to `"acute"`. Acute is the safety-conservative status and
  must remain an explicit user action.
- **Validation error wording**: per-step required-field checks (climbing grade on step 1; training
  age, sessions/week, and primary goal on steps 1–2) must reuse the exact error message strings
  already in `handleSubmit` (e.g. `"Choose your current climbing grade before generating a plan."`)
  rather than new wording, so behavior — and any existing reliance on that copy — doesn't silently
  change.

## Phase 1: Wizard mechanics

### Overview

Introduce the 3-step structure, step-validation logic, and Back/Next navigation with a step
indicator. The injuries step reuses today's unfiltered checkbox list unchanged — no search yet.

### Changes Required:

#### 1. Step-validation module

**File**: `src/lib/questionnaire-wizard-validation.ts`

**Intent**: Pure functions that decide whether a given step's required fields are valid, so the
wizard container can gate Next without duplicating validation logic inside a component, and so
this logic is testable without DOM rendering.

**Contract**: Exports a `WIZARD_STEPS` tuple of three step ids (`"profile" | "context" |
"injuries"`) in order, and a function `getStepErrors(step: WizardStepId, draft:
QuestionnaireDraftInput): Partial<Record<string, string>>` returning the same field/message pairs
`handleSubmit` already produces for that step's fields (climbing grade + training age + sessions/
week on `"profile"`; primary goal on `"context"`; none required on `"injuries"`), plus a thin
`isStepValid(step, draft)` wrapper over it. `QuestionnaireDraftInput` is the existing type from
`src/lib/plan-types.ts` — no new type needed for the draft shape itself.

#### 2. Wizard container

**File**: `src/components/plans/QuestionnaireForm.tsx`

**Intent**: Replace the single `<form>` body with a step container: internal `currentStep` state
(`useState<number>(0)` indexing into `WIZARD_STEPS`), a step indicator ("Step X of 3"), a Back
button (always enabled except on step 0), and a Next/Submit button that calls `isStepValid` before
advancing (or calls the existing `handleSubmit` logic unchanged on the last step). The component's
exported props interface (`QuestionnaireFormProps`) does not change.

**Contract**: On an invalid Next attempt, populate the same `FormErrors` state used today (via
`getStepErrors`) and do not advance `currentStep`. `value`/`onChange` continue to flow through
unchanged — the parent's `draftQuestionnaire` shape is untouched by step navigation.

#### 3. Step components

**File**: `src/components/plans/QuestionnaireStepProfile.tsx`

**Intent**: Render the climbing-grade select, training-age select, and sessions-per-week input —
exactly the JSX currently in `QuestionnaireForm.tsx` lines 149–229, extracted with the same props
(`value`, per-field change handlers, `errors`) passed down from the container.

**File**: `src/components/plans/QuestionnaireStepContext.tsx`

**Intent**: Render the primary-goal select and equipment-access checkbox group — the JSX currently
at lines 231–288, extracted the same way.

**File**: `src/components/plans/QuestionnaireStepInjuries.tsx`

**Intent**: Render the existing injury checkbox list and acute/chronic toggle UI unchanged (JSX
currently at lines 290–352) as its own component, unmodified in this phase — the search filter is
added in Phase 2.

### Success Criteria:

#### Automated Verification:

- Unit tests for the new validation module pass: `npm run test`
- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Stepping through the wizard with valid data at each step reaches the injuries step and submits
  successfully, producing the same plan the single-page form would have.
- Attempting Next with a missing required field (e.g. no climbing grade) shows the existing error
  message and does not advance.
- Back navigation from any step preserves all previously entered field values.

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human that the manual testing was successful before
proceeding to the next phase.

---

## Phase 2: Searchable injuries step

### Overview

Add a search/filter input above the injury list on `QuestionnaireStepInjuries.tsx`, filtering the
visible checklist by body part and label; selected injuries continue to show below with the
existing acute/chronic toggle, now regardless of whether they're currently filtered out of view.

### Changes Required:

#### 1. Filter input and filtered list

**File**: `src/components/plans/QuestionnaireStepInjuries.tsx`

**Intent**: Add a local `searchTerm` state and a text input above the injury list; render only
`INJURY_OPTIONS` entries whose `bodyPart` or `label` case-insensitively includes `searchTerm`
(empty term shows all 20, matching today's behavior with zero typed characters). Selected injuries
that no longer match the current filter still render in a "Selected" section below the filtered
list, using the exact acute/chronic toggle markup already in place — selection state (and its
default `"chronic"` status per Critical Implementation Details) is unaffected by filtering.

**Contract**: No prop or type changes — `toggleInjuryOption`/`setInjuryStatus` and the
`value.injuryLimitations` shape stay exactly as they are today; filtering is purely a rendering
concern local to this component.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Existing unit tests still pass: `npm run test`

#### Manual Verification:

- Typing a body part (e.g. "knee") filters the list to matching injuries only.
- Clearing the search term restores all 20 injuries.
- Selecting an injury, then typing a search term that filters it out of the main list, still shows
  it (with its status toggle) in the "Selected" section.
- Toggling a selected injury's status between acute/chronic works identically to today's behavior.

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human that the manual testing was successful before
proceeding to the next phase.

---

## Phase 3: Verification & cookbook update

### Overview

Add unit test coverage for the step-validation module, one end-to-end spec covering the full
wizard flow, and update the `test-plan.md` §6.6 cookbook entry for the new
pure-function-plus-e2e testing pattern this change establishes.

### Changes Required:

#### 1. Unit tests for step validation

**File**: `src/lib/questionnaire-wizard-validation.test.ts`

**Intent**: Cover `getStepErrors`/`isStepValid` for each step id: valid input, each required field
missing individually, and the `"injuries"` step's always-valid (no required fields) case.
Expected error strings are hand-authored from the business rule (matching `handleSubmit`'s
existing copy), not derived by importing and echoing the module's own output — per
`test-plan.md` §6.1's oracle-problem rule.

#### 2. End-to-end wizard flow spec

**File**: `e2e/questionnaire-wizard.spec.ts`

**Intent**: One `test.describe` block extending the authenticated pattern from
`e2e/login-session.spec.ts`, covering: Next is blocked on an invalid step, Back preserves data
entered on a later step, and a full valid run reaches the generated plan view. Locate elements by
accessible role/label (`getByRole`, `getByLabel`), per `test-plan.md` §6.3.

**Contract**: Reuses the existing test-user/local-Supabase seeding strategy documented in
`test-plan.md` §6.3 — no new fixture or seeding logic needed.

#### 3. Cookbook update

**File**: `context/foundation/test-plan.md`

**Intent**: Fill in §6.6 "Per-rollout-phase notes" (or add a new §6.x entry if a more specific
slot fits better) documenting: where step-validation pure functions live, the convention of
testing multi-step client components via extracted pure functions + one e2e spec rather than
introducing `jsdom`/`@testing-library/react`, and pointing at
`src/lib/questionnaire-wizard-validation.test.ts` and `e2e/questionnaire-wizard.spec.ts` as the
reference tests for that pattern.

### Success Criteria:

#### Automated Verification:

- New unit tests pass: `npm run test`
- New e2e spec passes: `npm run test:e2e`
- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- `test-plan.md` §6.6 reads clearly as a reference for the next contributor adding a multi-step
  form or its tests.

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- `getStepErrors`/`isStepValid` for every step id, every required field individually missing, and
  the boundary case of `sessionsPerWeek` at 0/8 (invalid) vs 1/7 (valid).

### Integration Tests:

- None new — `/api/plans/generate.test.ts` already covers the submission contract and is
  unaffected by this change.

### Manual Testing Steps:

1. Complete the wizard with all fields valid; confirm the resulting plan matches what today's
   single-page form would generate for the same inputs.
2. Attempt to advance past step 1 with no climbing grade selected; confirm the existing error
   message appears and step 2 is not shown.
3. Go back from step 3 to step 1, change the climbing grade, go forward again; confirm the change
   persisted and step 2/3 data is untouched.
4. Search for an injury by body part, select it, clear the search, confirm it still shows as
   selected with its status toggle.
5. Force a submit failure (e.g. temporarily disconnect network) on the final step; confirm the
   user stays on the injuries step with the error banner and all data intact.

## Performance Considerations

None — the injury list is a fixed 20 entries; a substring filter over it is effectively free at
this scale.

## Migration Notes

Not applicable — no data model or persisted-data changes.

## References

- Roadmap slice: `context/foundation/roadmap.md` S-02 (`questionnaire-wizard-flow`)
- Prerequisite change: `context/archive/2026-09-07-plan-generation-strategy/plan.md`
- Current form: `src/components/plans/QuestionnaireForm.tsx`
- Injury data: `src/lib/injury-options.ts`
- Testing cookbook: `context/foundation/test-plan.md` §6

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not
> rename step titles. See `references/progress-format.md`.

### Phase 1: Wizard mechanics

#### Automated

- [x] 1.1 Unit tests for the new validation module pass: `npm run test` — 98e7bbd
- [x] 1.2 Lint passes: `npm run lint` — 98e7bbd
- [x] 1.3 Build passes: `npm run build` — 98e7bbd

#### Manual

- [ ] 1.4 Valid step-by-step run reaches the injuries step and submits successfully
- [ ] 1.5 Next blocked with missing required field shows existing error, does not advance
- [ ] 1.6 Back navigation preserves previously entered field values

### Phase 2: Searchable injuries step

#### Automated

- [x] 2.1 Lint passes: `npm run lint`
- [x] 2.2 Build passes: `npm run build`
- [x] 2.3 Existing unit tests still pass: `npm run test`

#### Manual

- [ ] 2.4 Searching by body part filters the list
- [ ] 2.5 Clearing search restores all 20 injuries
- [ ] 2.6 Selected-but-filtered-out injury still shows in "Selected" section with status toggle
- [ ] 2.7 Status toggle behaves identically to today

### Phase 3: Verification & cookbook update

#### Automated

- [ ] 3.1 New unit tests pass: `npm run test`
- [ ] 3.2 New e2e spec passes: `npm run test:e2e`
- [ ] 3.3 Lint passes: `npm run lint`
- [ ] 3.4 Build passes: `npm run build`

#### Manual

- [ ] 3.5 `test-plan.md` §6.6 reads clearly as a reference for the next contributor
