---
change_id: questionnaire-wizard-flow
title: "Multi-step questionnaire wizard with a searchable injury multi-select"
status: archived
archived_at: 2026-09-08T16:36:40Z
created: 2026-09-08
updated: 2026-09-08
---

## Notes

Roadmap slice S-02 (`context/foundation/roadmap.md`), scope anchor MS-04. Turns the existing
single-page questionnaire (`src/components/plans/QuestionnaireForm.tsx`) into a 3-step wizard
(climbing profile → training context → injuries) with a searchable multi-select for the 20-entry
injury list, replacing today's plain checkbox list. Was blocked on `plan-generation-strategy`
(S-01) landing its final field list and per-injury acute/chronic status shape — S-01 is now `done`
and archived, so this slice is unblocked.

No plan-generation or persistence contract changes: `DashboardPlanShell.tsx`'s props contract to
the form, and `/api/plans/generate`'s request/response shape, are both unchanged by this slice.
