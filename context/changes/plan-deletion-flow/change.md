---
change_id: plan-deletion-flow
title: "Plan deletion flow: delete the saved weekly plan and re-onboard"
status: impl_reviewed
created: 2026-09-08
updated: 2026-09-08
archived_at: null
---

## Notes

Roadmap slice S-04 (`context/foundation/roadmap.md`), scope anchor MS-02. Adds a "Delete this
weekly plan" action to the saved-plan dashboard state: hard-deletes the user's active `weekly_plans`
row (RLS already permits this via the session client — no service-role/admin client needed, unlike
`account-settings`) and resets the dashboard to a blank questionnaire, matching the roadmap's "asked
again to select grade and injuries" wording. `questionnaire_responses` is deliberately left
untouched (deleting it would cascade and remove all historical `weekly_plans` rows, not just the
active one).

Standalone slice, no prerequisites, schema-orthogonal to `plan-generation-strategy`.
