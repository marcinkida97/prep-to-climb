# Plan Deletion Flow Implementation Plan

## Overview

Add a "Delete this weekly plan" action to the saved-plan dashboard state. Deleting removes the
user's active `weekly_plans` row (cascading to its `plan_days`/`recommended_exercises`) and resets
the dashboard to a blank questionnaire, so the user is asked again to select grade and injuries —
matching roadmap slice S-04 / scope anchor MS-02.

## Current State Analysis

`DashboardPlanShell.tsx` already has two dashboard states driven entirely by whether
`persistence.getCurrentPlan(userId)` returns a row: `first-run` (no plan, blank questionnaire) and
`saved-plan` (plan exists, `SavedPlanActions` shows a "Regenerate" button). There is no third
"delete and go back to first-run" action anywhere — the only way `weekly_plans.is_active` ever
changes today is via regenerate, which always inserts a replacement row in the same RPC call
(`replace_current_plan`). No route, client handler, or button exists for removing a plan without
replacing it.

The schema already supports safe, scoped deletion: `weekly_plans` has a partial unique index
(`weekly_plans_one_active_per_user_idx`) enforcing one active row per user, and RLS already grants
`delete` on `weekly_plans` (and cascading deletes on `plan_days`/`recommended_exercises` via their
own `_delete_own` policies) scoped to `auth.uid() = user_id` — no new migration, RPC, or
service-role client is needed, unlike `account-settings`'s account-deletion feature. The one schema
fact that shapes this plan: `weekly_plans.questionnaire_response_user_id` references
`questionnaire_responses(user_id) on delete cascade`, so deleting `questionnaire_responses` would
remove **all** historical `weekly_plans` rows for the user, not just the active one — this plan
never touches `questionnaire_responses`, only the active `weekly_plans` row.

### Key Discoveries:

- `src/lib/plan-persistence.ts:66-153` (`getCurrentPlan`/`saveCurrentPlan`) is the direct template
  for a new `deleteCurrentPlan` function — same `PlanPersistenceError` wrapping, same
  `createPlanPersistence` factory (`plan-persistence.ts:59-64`) to extend with a third method.
- `src/pages/api/plans/generate.ts:18-94` is the direct template for the new delete route: auth
  check before touching Supabase (`locals.user` → 401 first, per its own test at
  `generate.test.ts:175-184`), `createClient(...)` → 503 if unconfigured, try/catch around the
  persistence call, local `jsonResponse` helper, discriminated-union response type from
  `src/lib/plan-flow-types.ts`.
- `middleware.ts:4`'s `PROTECTED_ROUTES` already includes the `/api/plans` prefix — a new route
  under `src/pages/api/plans/` needs no middleware change.
- `DashboardPlanShell.tsx:100-107,160-200` (`SavedPlanActions`) is where the delete button belongs,
  conditionally rendered only when `hasSavedPlan && currentPlan && !showQuestionnaire` — this
  render condition already hides it for free once regenerate starts (`showQuestionnaire` flips
  true), satisfying the decision to hide delete during an in-progress regenerate.
  `src/components/ui/button.tsx:13-14` already defines a `destructive` variant, unused so far in
  this codebase — the natural styling for this action.
- `createEmptyQuestionnaireDraft` (`src/pages/dashboard.astro:69-78`) is private to the `.astro`
  file's frontmatter script and not importable from `DashboardPlanShell.tsx` — it needs to move to
  a shared module (`src/lib/plan-types.ts`, which already owns `QuestionnaireDraftInput`) so both
  `dashboard.astro` and `DashboardPlanShell.tsx` can call it.
- `src/pages/api/plans/generate.test.ts` (`buildContext`/`buildFakeSupabase` pattern) and
  `context/foundation/test-plan.md` §6.4 are the established test template for a new
  `/api/plans/*` route — mock only `@/lib/supabase`'s `createClient()` return value, one test per
  branch, assert on `response.status` and the parsed JSON body.

## Desired End State

A signed-in user viewing their saved weekly plan sees a "Delete this weekly plan" button in the
`SavedPlanActions` panel, styled with the `destructive` button variant, below the existing
"Regenerate" button. Clicking it shows a native `confirm()` dialog; confirming calls the new
`POST /api/plans/delete` route, which removes the user's active `weekly_plans` row (cascading to
its days/exercises) via the existing session-bound Supabase client — no admin client, no new
secret, no migration. On success, the dashboard resets client-side to the same blank-questionnaire
state as a brand-new user (`showQuestionnaire = true`, `draftQuestionnaire` reset to empty,
`currentPlan = null`), so the user is immediately asked again to select grade and injuries, using
the existing three-step wizard. `questionnaire_responses` and any prior inactive `weekly_plans`
history are left untouched. Cancelling the confirm dialog or a failed delete request leaves the
saved plan fully visible and unchanged, with a `submissionError`-style banner on failure.

**Verification**: `npm run lint`, `npm run build`, and `npm run test` all pass; a new
`delete.test.ts` covers every branch of the new route following `generate.test.ts`'s template;
manual click-through confirms delete removes the plan and re-shows a blank questionnaire, that
cancelling the confirm dialog does nothing, and that the deleted plan's `weekly_plans`/`plan_days`/
`recommended_exercises` rows are actually gone (DB spot-check) while `questionnaire_responses` and
the ability to submit a fresh questionnaire remain intact.

## What We're NOT Doing

- No changes to `questionnaire_responses` — it is never deleted or cleared by this feature; only
  the active `weekly_plans` row is removed.
- No deletion of historical (already-inactive) `weekly_plans` rows — only the current active plan.
- No new confirm-dialog component — reuses the native `window.confirm()` pattern already
  established by `account-settings`'s delete-account flow, adapted to a React click handler since
  `DashboardPlanShell` is fetch-based, not a plain HTML form.
- No new RPC or migration — the existing RLS `delete` policies on `weekly_plans` already permit
  this via the ordinary session-bound client.
- No e2e spec for this phase — unit/integration coverage on the new route only, per the cost ×
  signal call made during questioning; `test-plan.md` §5 does not yet require e2e beyond §3 Phase 2
  (not landed), so this isn't filling a gate gap, and the manual verification step below covers the
  full click-through.
- No distinct "Plan deleted" success toast/banner — the state transition to a blank questionnaire
  is itself the success feedback, consistent with how a successful regenerate/submit already works.

## Implementation Approach

Ship the backend capability first (Phase 1: persistence function + API route + its tests), since
it's fully self-contained and independently verifiable via automated tests with no UI dependency.
Phase 2 wires the UI on top of it: extracting the shared empty-draft helper, adding the button and
click handler, and closing out with the `test-plan.md` §6 cookbook update, matching the convention
`questionnaire-wizard-flow` set for documenting a rollout phase's new test pattern.

## Phase 1: Delete API and persistence

### Overview

Adds the ability to delete the current active weekly plan via a new persistence function and API
route, with full automated test coverage. No UI changes in this phase — the route is independently
testable and verifiable without a client to call it.

### Changes Required:

#### 1. Delete response type

**File**: `src/lib/plan-flow-types.ts`

**Intent**: A discriminated-union response type for the new route, following the exact shape of
`PlanQuestionnaireResponse` (`plan-flow-types.ts:33-43`) but with no `plan` payload on success,
since deletion has nothing to hand back.

**Contract**: Add `PlanDeleteSuccessResponse { ok: true }`, `PlanDeleteErrorResponse { ok: false;
error: string }`, and `PlanDeleteResponse = PlanDeleteSuccessResponse | PlanDeleteErrorResponse`,
positioned alongside the existing `PlanQuestionnaire*Response` types.

#### 2. Delete persistence function

**File**: `src/lib/plan-persistence.ts`

**Intent**: Remove the user's active `weekly_plans` row via the ordinary session-bound client,
mirroring `getCurrentPlan`/`saveCurrentPlan`'s error-wrapping convention. Deletion must be
idempotent — calling it when no active row exists (e.g., a second tab that already deleted it) is
not an error, since the end state ("no active plan for this user") is identical either way.

**Contract**: Add `deleteCurrentPlan(supabase, userId): Promise<void>` calling
`supabase.from("weekly_plans").delete().eq("user_id", userId).eq("is_active", true)`; a Postgrest
`error` throws `PlanPersistenceError("Failed to delete the current weekly plan", error)`; a
successful call with zero matching rows is treated the same as one with a matching row (no special
casing on affected-row count — Supabase's delete doesn't error when nothing matches the filter).
Expose it from `createPlanPersistence`'s returned object (`plan-persistence.ts:59-64`) alongside
`getCurrentPlan`/`saveCurrentPlan`.

#### 3. Delete route

**File**: `src/pages/api/plans/delete.ts`

**Intent**: Authenticated-only route deleting the caller's own active plan, matching
`generate.ts`'s auth-first, JSON-response conventions exactly (this route needs no request body).

**Contract**: `POST`. `context.locals.user` missing → `jsonResponse({ error: "Unauthorized" },
401)` before calling `createClient` (mirrors `generate.ts:19-21` and its test at
`generate.test.ts:175-184`). `createClient(...)` returning `null` → `jsonResponse({ error:
"Supabase is not configured" }, 503)`. Otherwise call
`persistence.deleteCurrentPlan(context.locals.user.id)`; on `PlanPersistenceError`/`Error`, return
`jsonResponse<PlanDeleteResponse>({ ok: false, error: error.message }, 500)`; on success, return
`jsonResponse<PlanDeleteResponse>({ ok: true }, 200)`. Reuse the same local `jsonResponse` helper
shape as `generate.ts:180-185` (duplicated locally per that file's existing convention, not
extracted into a shared module).

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- New and existing unit tests pass: `npm run test`

#### Manual Verification:

- With a saved plan and a valid session, `curl -X POST /api/plans/delete` (with auth cookies) removes the active `weekly_plans` row and its `plan_days`/`recommended_exercises` (DB spot-check), leaving `questionnaire_responses` intact.
- Calling the route a second time in a row (simulating a double-click or a second tab) still returns `{ ok: true }` rather than an error.
- Calling the route while signed out returns 401 without reaching Supabase.

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human that the manual testing was successful before
proceeding to the next phase.

---

## Phase 2: Delete UX, re-onboarding, and cookbook update

### Overview

Wires the Phase 1 route into the dashboard: a destructive-styled delete button on the saved-plan
view, a confirm-gated click handler that resets the dashboard to a blank first-run questionnaire on
success, and the shared empty-draft helper extraction both `dashboard.astro` and
`DashboardPlanShell.tsx` need. Closes out with the test-plan cookbook update.

### Changes Required:

#### 1. Shared empty-draft helper

**File**: `src/lib/plan-types.ts`

**Intent**: Make the blank-questionnaire shape importable from both the server-side `dashboard.astro`
frontmatter and the client-side `DashboardPlanShell.tsx`, instead of it being private to
`dashboard.astro`.

**Contract**: Add and export `createEmptyQuestionnaireDraft(): QuestionnaireDraftInput` with the
exact field values currently inlined at `dashboard.astro:69-78` (all blank/empty). Update
`src/pages/dashboard.astro` to import this from `@/lib/plan-types` instead of defining it locally,
removing the now-redundant local function.

#### 2. Delete button in SavedPlanActions

**File**: `src/components/plans/DashboardPlanShell.tsx`

**Intent**: Add the delete affordance to the existing saved-plan actions panel, below the
"Regenerate" button, using the `destructive` button variant.

**Contract**: `SavedPlanActions` (`DashboardPlanShell.tsx:160-200`) gains an `onDelete: () => void`
and `isDeleting: boolean` prop; renders a second `<Button variant="destructive" ... disabled=
{isDeleting} onClick={onDelete}>Delete this weekly plan</Button>` below the existing "Regenerate"
button (line 191-197). No change to the panel's render condition
(`DashboardPlanShell.tsx:100`) — it already only shows `SavedPlanActions` when
`!showQuestionnaire`, which is exactly when regenerate is not in progress, satisfying the decision
to hide delete during an in-progress regenerate for free.

#### 3. Delete handler and state reset

**File**: `src/components/plans/DashboardPlanShell.tsx`

**Intent**: Confirm, call the Phase 1 route, and on success reset the component to the same shape
as a brand-new user's first-run state.

**Contract**: Add `isDeleting` state and a `handleDeletePlan` function, wired as `SavedPlanActions`'s
`onDelete` prop (`onClick={() => { setSubmissionError(null); handleDeletePlan(); }}` pattern
matching the existing `onRegenerate` wiring at `DashboardPlanShell.tsx:102-105`).
`handleDeletePlan`: if `!window.confirm("Delete your saved weekly plan? You'll need to answer the questionnaire again.")`, return immediately without calling the route. Otherwise set
`isDeleting(true)`, `POST /api/plans/delete` with no body, parse the JSON response using the same
`{ ok, error }` shape check pattern as `isPlanQuestionnaireSuccessResponse`/`getPlanRouteErrorMessage`
(`DashboardPlanShell.tsx:214-232`; add analogous `isPlanDeleteSuccessResponse` typed against
`PlanDeleteResponse`). On success: `setCurrentPlan(null)`, `setDraftQuestionnaire(createEmptyQuestionnaireDraft())`
(imported from `@/lib/plan-types`), `setShowQuestionnaire(true)`, `setRecoveryMessage(null)`,
`setSubmissionError(null)`. On failure or a network exception: `setSubmissionError(errorMessage)`
(or the existing generic "could not be reached" message on a thrown exception), leaving
`currentPlan`/`showQuestionnaire` unchanged so the saved plan stays visible. `finally`:
`setIsDeleting(false)`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Existing unit tests still pass: `npm run test`

#### Manual Verification:

- On the saved-plan dashboard, "Delete this weekly plan" appears below "Regenerate", styled distinctly (destructive/red) from it.
- Clicking delete and cancelling the confirm dialog leaves the saved plan fully visible and unchanged.
- Clicking delete and confirming removes the saved plan and immediately shows a blank questionnaire (empty grade, no injuries selected, starting at wizard step 1) — no page reload occurs.
- Submitting the blank questionnaire after deletion successfully generates and saves a brand-new plan, proving `questionnaire_responses`/the RPC path still work after the delete.
- Clicking "Regenerate" no longer shows a delete button anywhere in the regenerate-in-progress view (it only exists in the saved-plan `SavedPlanActions` panel).
- Simulating a route failure (e.g. temporarily breaking the fetch) shows an inline error banner and leaves the saved plan visible, matching the existing submission-error styling.

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human that the manual testing was successful before closing
out this change.

---

## Testing Strategy

### Unit Tests:

- `src/pages/api/plans/delete.test.ts` (new), following `generate.test.ts`'s `buildContext`/
  `buildFakeSupabase` template:
  - Unauthenticated request → 401, `createClient` never called.
  - `createClient` returns `null` → 503 "Supabase is not configured".
  - Successful delete → 200 `{ ok: true }`.
  - Delete call with no matching active row → still 200 `{ ok: true }` (idempotency).
  - Supabase delete error → 500 with the persistence error message.

### Integration Tests:

- None new beyond the route test above — no separate integration layer exists for this style of
  route in this codebase (per `test-plan.md` §6.2, route tests already are the integration layer).

### Manual Testing Steps:

1. Sign in as a user with a saved plan.
2. Click "Delete this weekly plan", cancel the confirm dialog, confirm nothing changed.
3. Click "Delete this weekly plan", confirm the dialog, confirm the saved plan disappears and a blank questionnaire appears at wizard step 1.
4. Submit the questionnaire again; confirm a new plan generates and saves successfully.
5. Spot-check in the local Supabase stack that the deleted plan's `weekly_plans`/`plan_days`/`recommended_exercises` rows are gone but `questionnaire_responses` still has a row (from step 4's resubmission, or absent if step 4 wasn't done yet).
6. Directly `curl -X POST /api/plans/delete` while signed out; confirm it's blocked by middleware (401).

## Performance Considerations

None — a single, low-frequency, user-initiated delete of one row plus its cascaded children.

## Migration Notes

None — no schema changes. The existing RLS `delete` policies (`weekly_plans_delete_own` and its
cascading child-table policies, all in `20260614090000_minimal_plan_persistence.sql`) already
permit this via the session-bound client.

## References

- Roadmap slice: `context/foundation/roadmap.md` S-04 (`plan-deletion-flow`)
- Existing plan-generation route + test template: `src/pages/api/plans/generate.ts`, `generate.test.ts`
- Existing persistence module: `src/lib/plan-persistence.ts`
- Existing delete-confirmation precedent: `context/archive/2026-09-08-account-settings/plan.md`
- Schema/cascade reference: `supabase/migrations/20260614090000_minimal_plan_persistence.sql`
- Test-plan cookbook conventions: `context/foundation/test-plan.md` §6.2, §6.4, §6.6

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not
> rename step titles. See `references/progress-format.md`.

### Phase 1: Delete API and persistence

#### Automated

- [x] 1.1 Lint passes: `npm run lint` — 9d28dd8
- [x] 1.2 Build passes: `npm run build` — 9d28dd8
- [x] 1.3 New and existing unit tests pass: `npm run test` — 9d28dd8

#### Manual

- [ ] 1.4 Deleting via the route removes the active `weekly_plans` row and cascaded children, leaving `questionnaire_responses` intact
- [ ] 1.5 Calling the route twice in a row is idempotent (`{ ok: true }` both times)
- [ ] 1.6 Calling the route while signed out returns 401 without reaching Supabase

### Phase 2: Delete UX, re-onboarding, and cookbook update

#### Automated

- [x] 2.1 Lint passes: `npm run lint`
- [x] 2.2 Build passes: `npm run build`
- [x] 2.3 Existing unit tests still pass: `npm run test`

#### Manual

- [ ] 2.4 "Delete this weekly plan" appears below "Regenerate", styled distinctly
- [ ] 2.5 Cancelling the confirm dialog leaves the saved plan unchanged
- [ ] 2.6 Confirming deletion clears the saved plan and shows a blank questionnaire with no reload
- [ ] 2.7 Submitting the blank questionnaire after deletion generates and saves a new plan
- [ ] 2.8 Delete button is not shown while a regenerate is in progress
- [ ] 2.9 A failed delete request shows an inline error banner and leaves the saved plan visible
