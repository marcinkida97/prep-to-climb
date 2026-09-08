---
change_id: account-settings
title: "Account settings: password change and self-service account deletion"
status: implemented
created: 2026-09-08
updated: 2026-09-08
---

## Notes

Roadmap slice S-03 (`context/foundation/roadmap.md`), scope anchor MS-01. Adds a `/settings` page
where a signed-in user can change their password (no current-password re-entry required, but
other active sessions are invalidated afterward as a compensating safeguard) and delete their own
account (simple confirm dialog; the existing `ON DELETE CASCADE` chain from `auth.users` handles
all app-data cleanup atomically — no manual cleanup step needed).

Standalone slice, no prerequisites. Introduces the first production use of a Supabase service-role
admin client in this codebase (previously only used by `e2e/global-setup.ts` for test-user
seeding) — isolated to its own phase for focused review given the new security surface.
