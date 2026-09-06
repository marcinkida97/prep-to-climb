---
change_id: playwright-e2e-foundation
title: Stand up Playwright e2e harness with a reference redirect-guard test
status: implemented
created: 2026-09-06
updated: 2026-09-06
archived_at: null
---

## Notes

Infrastructure-only change: install and configure Playwright, author one
reference/seed e2e test to establish repo conventions, and wire it into CI.
Opened directly via `/10x-plan` (not through the `/10x-test-plan`
orchestrator) at the user's explicit request.

Relationship to `context/foundation/test-plan.md`: this is a precursor to
§3 Phase 2 ("Full-flow proof & persistence round-trip"), not Phase 2
itself. Phase 2's actual risk coverage (Risk #2 — login→questionnaire→plan
seam, and Risk #5 — persistence round-trip) is deliberately **not**
addressed here; the seed test only proves the harness works via an
unauthenticated redirect-guard smoke, which needs no test-user/Supabase
strategy. That strategy decision is deferred to whichever change
implements Phase 2 for real. Phase 2's row in test-plan.md §3 is left
unchanged (`not started`) by this change.

This change does update `test-plan.md` §6.3 (cookbook) since it
establishes the actual e2e location/naming/run-command pattern — see plan
Phase 4.
