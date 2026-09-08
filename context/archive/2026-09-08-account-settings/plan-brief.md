# Account Settings — Plan Brief

> Full plan: `context/changes/account-settings/plan.md`

## What & Why

Roadmap slice S-03: add a `/settings` page where a signed-in user can change their password and
delete their own account — the two actions MS-01 scoped for account management, nothing more.

## Starting Point

No settings page, account-management API, or service-role admin client exist yet. The only
service-role usage anywhere is `e2e/global-setup.ts`'s local test-user seeding. The database
already has `ON DELETE CASCADE` set up from `auth.users` through
`questionnaire_responses → weekly_plans → plan_days → recommended_exercises`, so deletion needs no
manual data-cleanup step.

## Desired End State

A user reaches `/settings` from a new Topbar link. They can change their password (no
current-password re-entry, but their other active sessions get signed out afterward) and delete
their account behind a confirm dialog, which cascades all their data and returns them to a
confirmed-logged-out sign-in page.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Scope | Password change + deletion only | Matches MS-01/roadmap exactly; no email change, no account-info hub |
| Route style | Native form-POST+redirect | Consistent with signin/signup/signout/confirm; user chose this over the JSON-fetch alternative |
| Password re-entry | Not required | Simpler form; Supabase's session alone is sufficient by its own API |
| Compensating safeguard | Sign out other sessions after password change | Recovers some of the safety traded away by skipping current-password re-entry |
| Deletion confirmation | Simple `confirm()` dialog | User chose minimal friction over a type-to-confirm phrase or a dedicated page |
| Post-deletion redirect | `/auth/signin` with a success message | Reuses the existing query-param message pattern; clean logged-out state |
| Admin-call error handling | Generic user-facing message + server-side `console.error` | Matches existing auth-route convention; never leaks service-role/infra details |
| Nav entry | Topbar link | Topbar already renders on every authenticated page with this exact nav-link pattern |
| Page content | Show signed-in email as read-only label | Orients the user without adding a new "account info" feature |

## Scope

**In scope:**
- `/settings` page, Topbar nav link
- Password-change form + `/api/account/change-password` route
- Delete-account form + `/api/account/delete-account` route
- New service-role admin client + secret wiring (`astro.config.mjs`, `.env.example`,
  `wrangler.jsonc`)
- Tests for both new routes

**Out of scope:**
- Email change, account-info display beyond the email label
- JSON-fetch API style, current-password re-entry, type-to-confirm deletion
- Any shared/foundation extraction of the admin client beyond this slice

## Architecture / Approach

Phase 1 ships the password-change flow using only the existing session-bound Supabase client — no
new security surface. Phase 2 adds the service-role admin client (this repo's first production use
of it) and the deletion flow, isolated for focused review. Phase 3 adds test coverage for both
routes following the existing `signin.test.ts` redirect-assertion template.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Settings shell + password change | `/settings` page, Topbar link, password-change form/route | None significant — no new security surface |
| 2. Account deletion | Service-role admin client, secret wiring, delete-account form/route | New security-sensitive infra — the first production admin-client consumer |
| 3. Verification & tests | Route tests for both new endpoints | None beyond standard regression risk |

**Prerequisites:** None — standalone roadmap slice.
**Estimated effort:** ~2-3 implementation sessions across 3 phases; Phase 2 carries the most review
weight given the new admin client.

## Open Risks & Assumptions

- The service-role key must be provisioned in production (`wrangler.jsonc`'s `secrets.required`)
  before Phase 2 can work end-to-end there — local dev/CI already has a path to it via
  `supabase status -o json`, matching the existing e2e-seeding setup.
- Signing out "other sessions" after a password change (`scope: "others"`) is a real Supabase API
  but the exact devices affected depend on Supabase's session-tracking behavior — worth confirming
  in manual testing rather than assuming from documentation alone.

## Success Criteria (Summary)

- A user can change their password and delete their account entirely from `/settings`.
- Deleting an account leaves no trace of the user's data — verified by re-signing-up with the same
  email and by a direct DB spot-check.
- Both new routes are unreachable without authentication.
