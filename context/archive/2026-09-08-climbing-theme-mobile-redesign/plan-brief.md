# Climbing-Themed, Mobile-Correct Visual Redesign — Plan Brief

> Full plan: `context/changes/climbing-theme-mobile-redesign/plan.md`

## What & Why

PrepToClimb currently ships a generic "cosmic" (navy space-gradient, zero-chroma grayscale) skin with no climbing identity, plus ad hoc mobile-scaling gaps (no `md:` breakpoint tier, missing `initial-scale=1`). This change replaces the palette with an earthy rock/nature identity, fixes mobile correctness with a real breakpoint strategy, and reskins the two native `confirm()` destructive dialogs — closing out roadmap slice S-05 (scope anchor MS-03).

## Starting Point

Tailwind v4 CSS-first tokens in `src/styles/global.css` are 100% generic shadcn grayscale; the only bespoke visual element is the `bg-cosmic` navy gradient utility, duplicated across every page's wrapper div. `Layout.astro` is bare (no shared shell). Only `Button` has been generated from shadcn/ui; no `Dialog` exists, so both account-deletion (`settings.astro`) and plan-deletion (`DashboardPlanShell.tsx`) use native `window.confirm()`. The just-shipped `questionnaire-wizard-flow` change explicitly deferred all visual/theme work on the wizard to this change.

## Desired End State

Every page renders through a shared themed shell with an earthy rock/nature palette and one display heading font, no horizontal scroll down to 320px width, both destructive confirmations use a real themed `Dialog`, the landing hero shows sourced climbing illustrations instead of generic icons, and a Playwright spec verifies mobile correctness on the three most critical screens.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Color direction | Earthy rock + nature (stone/terracotta + moss-green + chalk-white) | Most literal match to MS-03's "climbing/rock/nature" anchor |
| Typography | One display font for headings, system sans for body | Meaningful identity lift for one font-load cost |
| Layout duplication | Shared `PageShell` component | Single place to fix/tune theme and breakpoints across all pages |
| Breakpoints | Tailwind default mobile-first scale, retrofit `md:` | Standard, low-risk, closes the "no `md:` usage" gap found in research |
| Destructive confirmations | Build shadcn `Dialog`, reskin both | Resolves the "outlier" both prior plans flagged; least-styled surfaces in the app |
| Dark-mode tokens | Remove the unused `.dark` block outright | Nothing ever toggles it; one token set to maintain instead of two |
| Iconography | Custom climbing illustrations (not just lucide icons) | User chose distinctiveness over the lighter lucide-only option |
| Auth page scope | Full treatment, same as post-login pages | Avoids a fragmented brand where auth is the first thing users see but still generic |
| Min viewport width | 320px, no horizontal scroll | Matches PRD's "usable on mobile and desktop" NFR |
| Visual-regression testing | Add a Playwright viewport spec now; leave `test-plan.md` untouched | Playwright harness already exists with precedent for `/10x-plan`-authored e2e phases; `test-plan.md`'s gates stay owned by `/10x-test-plan --refresh` |
| Phasing | All 5 phases ship as one unit, no must-have/nice-to-have cut list | User's explicit choice: everything in scope is must-have |
| "Looks climbing" verification | Claude multimodal screenshot review on 3 critical screens | Independent check beyond self-review, matches test-plan.md's existing "selective, 1-3 screens" pattern |

## Scope

**In scope:**
- New color tokens, one display font, viewport meta fix, removal of unused `.dark` tokens
- Shared `PageShell` component adopted by all 6 non-landing pages; `Welcome.astro` (landing) migrated onto the new background token
- `md:` breakpoint retrofit across the 8 files currently missing it; `Topbar` narrow-viewport fix
- Restyling of all auth forms, the questionnaire wizard, plan views, chrome (`Topbar`, `Banner`)
- Sourced climbing illustrations replacing `Welcome.astro`'s generic icons/orbs
- shadcn `Dialog` primitive, reskinning both account-deletion and plan-deletion confirmations
- A new Playwright viewport spec (320px/375px/tablet) on landing, dashboard, and questionnaire wizard

**Out of scope:**
- Additional shadcn primitives beyond `Dialog` (`Card`, `Input`, etc.)
- A working dark-mode toggle
- Any edit to `context/foundation/test-plan.md` itself
- Server-side changes to account/plan-deletion routes
- Native mobile app / PWA shell

## Architecture / Approach

Bottom-up: design tokens + shared layout shell first (everything else depends on them), then component-level restyling and illustrations, then the Dialog reskin (needs the shell's token/dialog patterns in place), then end-to-end mobile verification.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Design token foundation | New palette, display font, viewport meta fix, `.dark` removal | Token *names* must stay stable so no component needs a rename |
| 2. Shared PageShell + breakpoint retrofit | One shell component on all pages, `md:` tier added, Topbar overflow fix | Migrating 6 pages at once risks missing one; grep-verified exit condition |
| 3. Component restyling + illustrations | Consistent visual system across all components; sourced climbing SVGs | Asset licensing for sourced illustrations must be confirmed before commit |
| 4. Dialog + destructive-action reskin | Themed confirmations for account/plan delete | Account-delete form has zero client JS today — needs new island extraction |
| 5. Mobile/visual verification | New Playwright viewport spec + multimodal review | None significant — reuses existing e2e harness |

**Prerequisites:** None — standalone slice, but shares `QuestionnaireForm.tsx` with the now-shipped `questionnaire-wizard-flow`, which already deferred styling here.
**Estimated effort:** ~4-5 sessions across 5 phases.

## Open Risks & Assumptions

- Sourced climbing illustrations (Phase 3) need a licensing check before committing any third-party asset — not resolved by this plan, flagged for the implementer.
- The `md:` breakpoint retrofit (Phase 2) has no fixed per-file rule — relies on implementer judgment per layout, verified visually rather than mechanically.
- `test-plan.md`'s visual-regression gate remains "optional — not scheduled" after this change ships; a follow-up `/10x-test-plan --refresh` is recommended but not enforced by this plan.

## Success Criteria (Summary)

- Every page renders with no horizontal scroll down to 320px width and shows the earthy rock/nature palette, not the generic cosmic skin
- Both destructive actions use a themed Dialog instead of a native browser confirm popup
- A multimodal screenshot review confirms the dashboard, questionnaire wizard, and landing page read as climbing-specific rather than generic
