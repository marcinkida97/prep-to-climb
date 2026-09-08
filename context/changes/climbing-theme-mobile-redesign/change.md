---
change_id: climbing-theme-mobile-redesign
title: "Climbing-themed, mobile-correct visual redesign"
status: implemented
created: 2026-09-08
updated: 2026-09-08
archived_at: null
---

## Notes

Roadmap slice S-05 (`context/foundation/roadmap.md`), scope anchor MS-03. Replaces the app's
generic "cosmic" gradient skin (zero-chroma shadcn tokens + a navy space gradient) with an
earthy rock/nature climbing identity across every page, introduces a shared `PageShell` to stop
per-page wrapper duplication, retrofits a real mobile-first breakpoint strategy (`md:` usage,
`initial-scale=1`), reskins the two native `confirm()` destructive-action dialogs (account delete,
plan delete) with a real shadcn `Dialog`, and adds sourced climbing illustrations.

Standalone slice, no prerequisites, but shares `QuestionnaireForm.tsx` and its step components
with the now-shipped `questionnaire-wizard-flow` (S-02) — that change explicitly deferred all
visual/theme decisions to this one, so this plan's Phase 3 is what actually styles the wizard.

Adds a Playwright viewport/visual-regression phase using the existing e2e harness
(`playwright-e2e-foundation`); does not edit `context/foundation/test-plan.md` directly — that
stays owned by `/10x-test-plan --refresh`, left as a follow-up pointer instead.
