# Smarter Weekly-Plan Generation Verification

Date: 2026-09-07
Change: `plan-generation-strategy`

## Automated Verification

Completed on 2026-09-07 (local run) and cross-checked against CI run `34160245482` on
commit `92652bf` (both the `ci` and `e2e` jobs completed green).

Commands run:

- [x] `npx astro sync`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm run test` (42/42 passing)

## Manual Verification

Confirmed by the user against the deployed server (commit `92652bf`) on 2026-09-07. This sandbox
has no `SUPABASE_URL` / `SUPABASE_KEY` configured, so the walkthrough itself was run outside this
session.

Scenarios verified:

- [x] Missing training age, sessions/week, or primary goal shows the corresponding validation
      message and does not call the API (Phase 4, 4.4).
- [x] An unrecognized value for any new field (training age, sessions/week, equipment, goal, or
      injury status) is rejected with `400` via a direct API call, bypassing client validation
      (Phase 4, 4.5).
- [x] A full valid submission reaches the dashboard showing a plan reflecting all declared inputs
      (Phase 4, 4.6; Phase 5, 5.4).
- [x] Generating a plan with a chronic injury never includes a conflicting exercise (Phase 3, 3.4).
- [x] Generating a plan with an acute injury shows the conservative disclaimer and omits
      region-specific exercises (Phase 3, 3.5).
- [x] A low training age yields caution-noted (not omitted) campus/power exercises (Phase 3, 3.6).
- [x] Missing equipment never yields an exercise requiring it (Phase 3, 3.7).
- [x] A pre-existing user (created before this change shipped) sees the extended questionnaire
      form on next dashboard visit, not a stale plan (Phase 5, 5.5).
- [x] Regenerating a plan after changing an equipment or injury answer produces a visibly
      different, correctly-filtered plan (Phase 5, 5.6).

## Notes

- A server-side unit test run reportedly failed during Phase 4's manual-verification pass. This
  was not reproduced by this session's local `npm run test` (42/42 passing) or by CI run
  `34160245482` on the pushed commit `92652bf` (both jobs green), and the user confirmed it was a
  stale-deploy artifact rather than a real regression — resolved once the deployed server picked up
  commit `92652bf`.
- Phases 1-2 (data model/migration, injury taxonomy) landed with their own manual-verification
  notes recorded directly in `plan.md`'s Progress section rather than here; this file covers the
  Phase 3-5 behavior that depends on a live environment.
- The Phase 1 migration is a one-way, destructive change to existing `questionnaire_responses` /
  `weekly_plans` data (see `plan.md`'s Migration Notes) — 5.5 was confirmed against a real
  pre-migration user, not a freshly seeded one.
