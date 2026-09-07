---
change_id: signup-confirmation-redirect-bug
title: Sign-up confirmation email redirects to localhost; login reports account not confirmed
status: implemented
created: 2026-09-06
updated: 2026-09-07
archived_at: null
---

## Notes

User-reported bug, not yet in `context/foundation/test-plan.md` §3 as its
own rollout phase. Directly grounds `test-plan.md` §2 Risk #3 ("User
cannot log in at all") — the Risk Response Guidance row for Risk #3
explicitly names "confirmation-email redirect target" as something
`/10x-research` must ground, and this change does that.

Two symptoms reported by the user:

1. After signing up, the confirmation email's link redirects to
   `localhost` instead of the deployed app.
2. Logging in afterward returns "your account is not confirmed."

See `research.md` for the full root-cause trace. This is a real
production defect, not just a test-coverage gap — the fix itself
(adding an `emailRedirectTo`/origin override at signup, and building the
missing confirmation callback route) is out of scope for `/10x-research`
and belongs to a bug-fix or implementation flow.
