---
change_id: auth-outage-error-handling
title: Guard sign-in/sign-up against Supabase outage producing an opaque error
status: archived
created: 2026-09-06
updated: 2026-09-07
archived_at: 2026-09-07T10:08:44Z
---

## Notes

Risk source: `context/foundation/test-plan.md` §2 Risk #7 — "An external auth
dependency outage (e.g. Supabase down) surfaces as an opaque, unrecoverable
error during sign-in/sign-up." Traces to `context/foundation/improvements.md`
item 2 ("When Supabase was down there was only `{}` error message during
sign in/sign up").

Belongs to test-plan.md §3 Phase 3 ("Access-control & resilience
hardening"), scoped here to the Risk #7 slice only (not #4/#6).

Phase 3 (regression tests for the outage guard) added and completed
post-review — 24b39c5. Status stays `impl_reviewed`; no re-review needed
for test-only additions with no production code change.
