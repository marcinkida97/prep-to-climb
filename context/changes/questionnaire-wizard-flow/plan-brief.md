# Multi-Step Questionnaire Wizard — Plan Brief

> Full plan: `context/changes/questionnaire-wizard-flow/plan.md`

## What & Why

Today's questionnaire is a single-page form asking six questions at once (grade, training age,
sessions/week, equipment, goal, injuries). This change splits it into a 3-step wizard and replaces
the 20-item injury checkbox list with a searchable multi-select — roadmap slice S-02, unblocked now
that S-01 (`plan-generation-strategy`) has shipped its final field list and per-injury
acute/chronic status shape.

## Starting Point

`src/components/plans/QuestionnaireForm.tsx` is a single controlled `<form>`, fully lifted into
`DashboardPlanShell.tsx` via `value`/`onChange`/`onSubmit` props, submitting one atomic POST to
`/api/plans/generate`. No wizard, combobox, or React component-test pattern exists anywhere in the
codebase yet — this change introduces all three from scratch, without adding new dependencies.

## Desired End State

A climber moves through three steps — climbing profile, training context, injuries — with a step
indicator and a Back button, unable to advance past a step with missing required fields. The
injuries step lets them search by body part instead of scanning 20 checkboxes, while keeping
today's acute/chronic toggle exactly as-is. The final submit produces the identical payload and
plan the single-page form does today; a failed submit leaves them on the last step with nothing
lost.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Step grouping | 3 steps: profile (grade/age/sessions) → context (equipment/goal) → injuries | Balances step density across all 6 fields; isolates the most complex UI (search) on its own step |
| Multi-select implementation | Hand-rolled substring filter, no new dependency | Only 20 fixed items — a real combobox library is overkill and nothing suitable is installed today |
| Acute/chronic UX | Search picks the injury; existing toggle list (unchanged) sets status | Reuses already-shipped, safety-reviewed UI instead of inventing a new interaction for a safety-relevant control |
| Next-step validation | Blocked until current step's required fields are valid | Matches the existing fail-fast pattern already used in this form and in `SignInForm.tsx` |
| Progress persistence | None — resets on reload, same as today | No regression vs. current behavior; no requirement asked for more |
| Submit-failure behavior | Stay on last step, show error, keep all data | Matches `DashboardPlanShell.tsx`'s existing error-handling pattern; no data loss |
| Testing approach | Pure-function unit tests for step validation + one e2e spec | Avoids introducing `jsdom`/`@testing-library` as a side effect of a UI feature change |
| Polish scope | Step indicator + Back button only, no animated transitions | Covers the core wizard expectation without extra scope; visual polish belongs to S-05's redesign |

## Scope

**In scope:**
- Splitting `QuestionnaireForm.tsx` into a wizard container + 3 step components
- A pure, unit-tested step-validation module
- A search filter for the injuries step
- One e2e spec for the full wizard flow
- A `test-plan.md` §6.6 cookbook update for this testing pattern

**Out of scope:**
- Any change to `/api/plans/generate.ts`, `plan-types.ts`, or `plan-flow-types.ts`
- Any change to `DashboardPlanShell.tsx`
- Draft persistence across reloads, new UI dependencies, animated transitions, `jsdom`/RTL
- Visual/theme redesign (separate slice, S-05, which shares this same component)

## Architecture / Approach

`QuestionnaireForm.tsx` becomes a thin container holding `currentStep` state and rendering one of
three new sibling components (`QuestionnaireStepProfile`, `QuestionnaireStepContext`,
`QuestionnaireStepInjuries`), all still driven by the same lifted `value`/`onChange` props from
`DashboardPlanShell.tsx`. A new `src/lib/questionnaire-wizard-validation.ts` module exposes pure
`getStepErrors`/`isStepValid` functions the container calls to gate Next — no DOM needed to test
this logic.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Wizard mechanics | 3-step navigation, validation gating, step indicator (injuries step still unfiltered) | None significant — pure refactor of already-working JSX |
| 2. Searchable injuries step | Filter input + filtered list, selected injuries always visible | Filtering must not affect selection/status state — verified by keeping selected items visible regardless of filter |
| 3. Verification & cookbook update | Unit tests, one e2e spec, `test-plan.md` §6.6 entry | None beyond standard regression risk |

**Prerequisites:** S-01 (`plan-generation-strategy`) shipped — done, no longer blocking.
**Estimated effort:** ~2-3 implementation sessions across 3 phases; Phase 1 is the largest (the
actual restructuring), Phases 2–3 are additive on top of it.

## Open Risks & Assumptions

- `QuestionnaireForm.tsx` is also touched by S-05 (`climbing-theme-mobile-redesign`), a parallel
  roadmap slice with no hard dependency on this one — if both are in flight at once, coordinate to
  avoid overlapping edits to the same files.
- This is the first React component-level testing pattern in the repo; the chosen
  pure-function-plus-e2e approach avoids a `jsdom`/RTL decision here, but a future change with
  deeper component-interaction needs may still need to revisit that via `/10x-test-plan`.

## Success Criteria (Summary)

- A user can complete the wizard end-to-end and cannot skip a step with missing required fields.
- Back navigation never loses previously entered data.
- The generated plan is identical in shape to what today's single-page form would produce for the
  same inputs.
