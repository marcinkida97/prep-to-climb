# Plan Deletion Flow — Plan Brief

> Full plan: `context/changes/plan-deletion-flow/plan.md`

## What & Why

Let a signed-in user delete their generated weekly plan and be returned to grade/injury selection —
roadmap slice S-04, scope anchor MS-02. Today the only way a saved plan changes is "Regenerate,"
which always replaces it with a new one; there's no way to simply remove it and start over.

## Starting Point

`DashboardPlanShell.tsx` already derives its whole UI from whether `getCurrentPlan(userId)` returns
a row: no row → blank questionnaire (`first-run`); a row → the saved plan + a `SavedPlanActions`
panel with only a "Regenerate" button. `weekly_plans` has one active row per user (DB-enforced
partial unique index), and RLS already grants `delete` on it via the ordinary session client — no
service-role admin client is needed here, unlike the `account-settings` feature.

## Desired End State

A "Delete this weekly plan" button sits below "Regenerate" in the saved-plan panel. Confirming
deletion removes the active `weekly_plans` row (cascading to its days/exercises) and resets the
dashboard client-side to a blank three-step questionnaire — no page reload, no lost session,
`questionnaire_responses` and any prior history untouched.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Delete target | Hard-delete the active `weekly_plans` row only | Matches "delete" literally; deleting `questionnaire_responses` instead would cascade and wipe all historical plans, not just the current one |
| Post-delete draft | Blank questionnaire, not pre-filled | Matches the roadmap's literal wording ("asked again to select grade and injuries"); pre-filling would blur delete vs. regenerate |
| Confirm UX | Native `window.confirm()` in the click handler | No dialog component exists in this codebase; mirrors `account-settings`'s only precedent, adapted to a React/fetch component instead of a plain form |
| Delete during regenerate | Hidden | Falls out of the existing `!showQuestionnaire` render condition for free — no new logic needed |
| Scope | Active plan only, not plan history | Matches the roadmap outcome exactly; there's no UI today that exposes plan history to a user anyway |
| Feedback UX | Reuse the existing `submissionError` banner; state transition alone is success feedback | Zero new UI components; consistent with how a successful questionnaire submit already behaves |
| Test coverage | Unit/integration on the new route only, no e2e | Matches `account-settings`'s bar for a comparably destructive action; e2e isn't yet a required gate per `test-plan.md` §5 |
| Cookbook update | Yes — a short `test-plan.md` §6.6 entry | Follows the convention `questionnaire-wizard-flow` set for documenting a rollout phase's test pattern |

## Scope

**In scope:**
- New `deleteCurrentPlan` persistence function and `POST /api/plans/delete` route
- Delete button + confirm + client-side reset-to-first-run in `DashboardPlanShell.tsx`
- Shared `createEmptyQuestionnaireDraft` extraction so both server and client code can use it
- Route-level unit tests
- A short cookbook (`test-plan.md` §6.6) update

**Out of scope:**
- Deleting or clearing `questionnaire_responses`
- Deleting historical (inactive) `weekly_plans` rows
- Any new dialog component, toast/success-banner component, RPC, or migration
- An e2e spec for this flow

## Architecture / Approach

Backend first: a new persistence function mirrors the existing `getCurrentPlan`/`saveCurrentPlan`
pair, and a new route mirrors `generate.ts`'s auth/error/response conventions exactly — both fully
testable with no UI dependency. The frontend phase then wires a button and a client-side state
reset on top, reusing every existing pattern (`SavedPlanActions`, `destructive` button variant,
`submissionError` banner) rather than introducing anything new.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Delete API and persistence | `deleteCurrentPlan` fn + `POST /api/plans/delete` route + tests | Getting the idempotency semantics right (double-delete must not error) |
| 2. Delete UX, re-onboarding, and cookbook update | Delete button, confirm, state reset, shared draft helper, `test-plan.md` §6.6 entry | Correctly resetting all of `DashboardPlanShell`'s state (plan, draft, questionnaire visibility) in one consistent transition |

**Prerequisites:** None — standalone, schema-orthogonal to `plan-generation-strategy`.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Assumes the native `window.confirm()` UX bar set by `account-settings` is still acceptable here; if a future slice adds a real dialog component, this flow should adopt it too rather than staying an outlier.

## Success Criteria (Summary)

- A user with a saved plan can delete it and is immediately shown a blank questionnaire, with no data loss to `questionnaire_responses` or historical plans.
- Deleting is safely idempotent and unauthenticated requests are blocked.
- Submitting a fresh questionnaire after deletion works exactly as it does for a brand-new user.
