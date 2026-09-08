# Climbing-Themed, Mobile-Correct Visual Redesign Implementation Plan

## Overview

Replace PrepToClimb's current generic "cosmic" (navy space-gradient, zero-chroma shadcn grayscale) visual skin with an earthy rock/nature climbing identity across every page, fix the app's ad hoc mobile-scaling gaps with a real mobile-first breakpoint strategy, and reskin the two native `confirm()` destructive-action dialogs with a themed component. This is roadmap slice S-05 (`context/foundation/roadmap.md`), scope anchor MS-03.

## Current State Analysis

- **Tokens**: `src/styles/global.css` defines Tailwind v4 CSS-first design tokens (`:root`, `.dark`, `@theme inline`) — all zero-chroma grayscale (`oklch(... 0 0)`), the stock shadcn/ui starter palette. No climbing-specific color, font, or spacing tokens exist.
- **Visual identity**: the only bespoke element is `@utility bg-cosmic` (`global.css:113-115`), a 3-stop navy gradient used as the page background almost everywhere (`Welcome.astro:5`, `dashboard.astro`, `settings.astro:14`), plus ad hoc purple/blue/pink/cyan/emerald accent classes scattered across components. None of it is climbing-themed or token-driven.
- **Layout**: `src/layouts/Layout.astro` is a bare HTML shell — no shared `<main>`, no container, no responsive wrapper (`Layout.astro:38` is a bare `<slot />`). Its viewport meta tag (`Layout.astro:17`) omits `initial-scale=1`. Every page re-implements its own `bg-cosmic min-h-screen p-4 sm:p-8` wrapper + `mx-auto max-w-3xl` (or `4xl`) container.
- **Responsive coverage**: only 8 files use any breakpoint prefix at all, and none use `md:` — layouts jump straight from the unprefixed (mobile) case to `lg:`. `Topbar.astro:5` (`flex items-center justify-between`) has no wrap/truncation fallback, which is a real overflow risk at 320px with a long email address next to 2-3 nav links.
- **Component library**: shadcn/ui is configured (`components.json`, style `new-york`) but only `Button` has been generated (`src/components/ui/button.tsx`). No `Dialog` exists. `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-slot`, and `lucide-react` are already installed.
- **Destructive-action confirmations**: `src/components/plans/DashboardPlanShell.tsx:71` calls `window.confirm(...)` inside an already-interactive React island (plan deletion). `src/pages/settings.astro:40-52` is a **static Astro form** with confirmation via an inline `onsubmit="return confirm(...)"` HTML attribute (account deletion) — this section currently ships zero client-side JS.
- **Icons/illustrations**: `lucide-react` is installed and used across `auth/*` and `plans/*` components, but `Welcome.astro:59-118` uses generic inline SVGs (lock, network, arrow) with no climbing motif. `public/` has no climbing imagery.
- **e2e harness**: Playwright is already configured (`playwright.config.ts`, `e2e/` with `dashboard-access.spec.ts`, `questionnaire-wizard.spec.ts`, `login-session.spec.ts`, `global-setup.ts`, `fixtures/test-user.ts`). `test-plan.md` lists visual-diff and multimodal visual review as "optional — not scheduled, see §7," and names this exact change as the trigger to revisit that deferral.

## Desired End State

Every page (`index`, `dashboard`, `settings`, `auth/signin`, `auth/signup`, `auth/confirm-email`) renders through a shared themed shell using an earthy rock/nature color palette and a single display heading font, with no leftover `bg-cosmic` or zero-chroma tokens. The app has no horizontal scroll and remains legible down to a 320px viewport width, using Tailwind's default `sm`/`md`/`lg`/`xl` breakpoints. Both destructive-action confirmations (account delete, plan delete) use a themed `Dialog` instead of native `confirm()`. `Welcome.astro`'s hero uses sourced climbing illustrations instead of generic icons/orbs. A Playwright spec verifies the dashboard, questionnaire wizard, and landing page render correctly at 320px/375px/tablet widths.

**Verification**: `npm run lint`, `npm run build`, and `npx astro sync` all pass; `npm run test:e2e` passes including the new viewport spec; manual review confirms no page still imports/uses `bg-cosmic` or the removed `.dark` tokens.

### Key Discoveries

- `Welcome.astro` (the `index.astro` content) already owns its full-bleed hero wrapper (`bg-cosmic relative min-h-screen w-full overflow-hidden` at `Welcome.astro:5`) — it does not need a *separate* per-page wrapper the way `dashboard.astro`/`settings.astro` do; the shared shell replaces this wrapper's background/token usage in place rather than nesting a second container around it.
- The account-deletion confirmation (`settings.astro:40-52`) has no client-side JS today — introducing a themed `Dialog` here requires extracting that section into a small `client:load` React island, unlike the plan-deletion confirmation which is already inside a React island (`DashboardPlanShell.tsx`).
- `questionnaire-wizard-flow`'s plan explicitly deferred all visual/theme decisions on `QuestionnaireForm.tsx` and its three step components to this change — Phase 3 is the first time those components get real styling.

## What We're NOT Doing

- Not building a full shadcn primitive set (`Card`, `Input`, `Select`, etc.) — only `Dialog` is added; existing hand-rolled form/card markup is restyled in place with new tokens, not replaced with new primitives.
- Not wiring up a working dark-mode toggle — the unused `.dark` token block is removed outright (see Phase 1), not restyled or kept for later.
- Not editing `context/foundation/test-plan.md` — that file is maintained by `/10x-test-plan`; this plan leaves a follow-up pointer in References instead of flipping its gates directly.
- Not touching the account-deletion or plan-deletion server-side logic (`api/account/delete-account.ts`, `api/plans/delete.ts`) — only the client-side confirmation UI changes.
- Not adding a native mobile app or app-shell (PWA manifest, etc.) — this is a responsive web redesign only, per the PRD's existing non-goals.
- Not phasing scope by priority — all 5 phases below ship as one unit; there is no must-have/nice-to-have cut list for this change.

## Implementation Approach

Work bottom-up: establish the design tokens and shared layout shell first (Phases 1-2), since every later phase depends on them; then restyle components and add illustrations (Phase 3); then reskin the two destructive confirmations, which needs the shell's dialog patterns in place (Phase 4); then verify mobile correctness end-to-end (Phase 5).

## Critical Implementation Details

**Timing & lifecycle**: The account-deletion form (`settings.astro:40-52`) is currently a zero-JS static Astro form. Converting its confirmation to a `Dialog` means extracting `<form method="POST" action="/api/account/delete-account">` plus the trigger button into a new `client:load` React component (e.g. `DeleteAccountForm.tsx`) that renders the Dialog and, on confirm, submits the same POST — the server-side route contract must not change.

## Phase 1: Design token foundation

### Overview

Replace the grayscale token set with an earthy rock/nature palette, add a single display heading font, fix the viewport meta tag, and remove the unused dark-mode infrastructure.

### Changes Required:

#### 1. Color tokens

**File**: `src/styles/global.css`

**Intent**: Replace every `:root` color token (`--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--card`, `--popover`, `--sidebar-*`, `--chart-*`) with an earthy rock/nature palette: warm stone/terracotta as the primary surface and accent family, moss-green as a secondary accent, chalk-white for foreground/contrast text. Keep `--destructive` a genuine red (for the new Dialog and existing error states) rather than folding it into the earth palette.

**Contract**: Token *names* in `:root` and the `@theme inline` mapping (`global.css:75-111`) stay exactly as-is — only their `oklch(...)` values change — so no component that already references `bg-background`, `text-foreground`, `bg-primary`, etc. needs to change its class names.

#### 2. Remove unused dark-mode tokens

**File**: `src/styles/global.css`

**Intent**: Delete the entire `.dark { ... }` block (`global.css:41-73`) and the `@custom-variant dark (&:is(.dark *));` line (`global.css:4`), since no UI ever toggles a `.dark` class.

**Contract**: After removal, `global.css` has exactly one token block (`:root`); grep the repo for `class="dark"` / `.dark` usage first to confirm nothing else depends on it before deleting.

#### 3. Remove the `bg-cosmic` utility

**File**: `src/styles/global.css`

**Intent**: Delete the `@utility bg-cosmic { ... }` block (`global.css:113-115`) once Phase 2 has replaced every consumer — sequence this deletion after Phase 2's page migrations land, not before, so nothing regresses to an unstyled background mid-phase.

**Contract**: Zero remaining references to `bg-cosmic` anywhere in `src/` is the exit condition for this task (verified via grep in Phase 2's success criteria, removal itself lands as the last step of Phase 1's PR or the first step after Phase 2 — implementer's call on exact commit boundary, as long as no intermediate state ships with an unstyled page).

#### 4. Display heading font

**File**: `src/layouts/Layout.astro`

**Intent**: Add one distinctive display font (a bold/condensed sans, e.g. via a self-hosted `@font-face` or Google Fonts `<link>`) for headings only; body text keeps the existing system sans-serif stack. Expose it as a new `--font-display` token in `global.css`'s `@theme inline` block so components apply it via `font-[family-name:var(--font-display)]` or a `font-display` utility.

**Contract**: New token `--font-display` added to `@theme inline`; no existing `--font-*` token exists today, so this is additive, not a rename.

#### 5. Viewport meta fix

**File**: `src/layouts/Layout.astro`

**Intent**: Fix the viewport meta tag to include `initial-scale=1` so mobile browsers don't apply unwanted zoom-to-fit behavior.

**Contract**: `<meta name="viewport" content="width=device-width, initial-scale=1" />` replaces `Layout.astro:17`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Astro types refresh cleanly: `npx astro sync`
- No remaining `.dark` or `bg-cosmic` references outside this phase's own deletions: `grep -rn "bg-cosmic\|\.dark {" src/` returns nothing once Phase 2 also lands

#### Manual Verification:

- Viewing any page in a browser shows the new palette (no grayscale/navy-cosmic background) applied via `body`/`:root` tokens
- Heading text renders in the new display font; body text is unaffected
- No visual regression in existing error/destructive states (banners, form errors) — they still read as red/alert-colored

---

## Phase 2: Shared PageShell + page wiring + breakpoint retrofit

### Overview

Introduce one shared wrapper component that owns the themed background, container width, and responsive padding, migrate all 6 pages onto it, and retrofit `md:` breakpoints wherever layouts currently jump from the unprefixed case straight to `lg:`.

### Changes Required:

#### 1. `PageShell` component

**File**: `src/components/PageShell.astro` (new)

**Intent**: Extract the repeated `<div class="... min-h-screen p-4 sm:p-8">` + `<div class="relative z-10 mx-auto max-w-3xl">` + `<Topbar />` pattern (currently duplicated in `dashboard.astro`, `settings.astro`, and the three `auth/*.astro` pages) into one component that renders its `<slot />` inside the themed background/container, with a `maxWidth` prop (`"3xl" | "4xl" | "5xl"`) to preserve each page's existing container width.

**Contract**: `PageShell` renders `<Topbar />` internally so callers stop importing it directly; props are `{ maxWidth?: "3xl" | "4xl" | "5xl" }` with a default of `"3xl"`.

#### 2. Migrate pages onto `PageShell`

**Files**: `src/pages/dashboard.astro`, `src/pages/settings.astro`, `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`

**Intent**: Replace each page's hand-rolled wrapper + `<Topbar />` call with `<PageShell maxWidth="...">...</PageShell>`, preserving each page's existing container width and inner content unchanged.

**Contract**: Each page's outer two `<div>`s and its `<Topbar />` import/call are removed; page-specific content (forms, `DashboardPlanShell`, etc.) becomes `PageShell`'s slotted children.

#### 3. Migrate `Welcome.astro` (landing) onto the shared background token

**File**: `src/components/Welcome.astro`

**Intent**: Since `Welcome.astro` owns a full-bleed hero (not a `PageShell`-style content container), it keeps its own wrapper structure but swaps `bg-cosmic` for the new token-driven background and its purple cosmic-orb/starfield decoration for the Phase 3 illustration treatment (tracked there, not here) — this task only removes the `bg-cosmic` dependency and confirms `<Topbar />` usage is unaffected.

**Contract**: `Welcome.astro:5`'s `bg-cosmic` class is replaced with a token-based background utility (e.g. `bg-background` or a new `bg-hero` utility defined alongside Phase 1's tokens).

#### 4. Breakpoint retrofit

**Files**: the 8 files currently carrying `sm:`/`lg:` classes with no `md:` tier: `Welcome.astro`, `src/components/ui/button.tsx`, `QuestionnaireStepInjuries.tsx`, `DashboardPlanShell.tsx`, `WeeklyPlanView.tsx`, `QuestionnaireStepProfile.tsx`, `dashboard.astro`, `settings.astro`

**Intent**: Add an `md:` tier wherever a layout currently jumps from its base (mobile) styling straight to `lg:`, so tablet-width viewports (roughly 640-1024px) get an intermediate step instead of inheriting mobile styling all the way to desktop.

**Contract**: No fixed rule for every occurrence — the implementer reviews each `lg:`-only breakpoint and adds a sensible `md:` step (e.g. a 2-column grid at `md:` before a 3-column grid at `lg:`), verified visually at a ~768px viewport width.

#### 5. `Topbar` narrow-viewport fix

**File**: `src/components/Topbar.astro`

**Intent**: `Topbar.astro:5`'s `flex items-center justify-between` has no wrap or truncation fallback for a long email address next to 2-3 nav links — fix so it degrades gracefully at 320px (e.g. truncate the email with `truncate`/`max-w-[...]`, or allow the row to wrap).

**Contract**: No text overflow or horizontal scroll caused by `Topbar` at 320px width.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- `grep -rn "bg-cosmic" src/` returns nothing
- Existing e2e specs still pass unmodified: `npm run test:e2e -- dashboard-access.spec.ts questionnaire-wizard.spec.ts login-session.spec.ts`

#### Manual Verification:

- Every one of the 6 non-landing pages plus the landing page renders with no horizontal scroll at 320px, 375px, and 768px widths (checked via browser devtools device toolbar)
- `Topbar` does not overflow or wrap awkwardly with a long email address at 320px
- Each page's content container width matches its pre-redesign width (no unintended narrowing/widening)

---

## Phase 3: Component-level restyling + custom illustrations

### Overview

Apply the earthy rock/nature visual identity to every remaining component (chrome, forms, questionnaire wizard, plan views) and replace `Welcome.astro`'s generic icons/orbs with sourced climbing illustrations.

### Changes Required:

#### 1. Auth form components

**Files**: `src/components/auth/SignInForm.tsx`, `SignUpForm.tsx`, `ChangePasswordForm.tsx`, `FormField.tsx`, `PasswordToggle.tsx`, `ServerError.tsx`, `SubmitButton.tsx`, `SuccessMessage.tsx`

**Intent**: Replace hand-rolled color classes (borders, backgrounds, focus rings, accent colors) with the new semantic tokens (`border-border`, `bg-card`, `text-foreground`, `ring-ring`, etc.) established in Phase 1, so these forms visually match the rest of the app instead of carrying leftover cosmic-era literal colors.

**Contract**: No structural/behavioral change — token/class substitution only.

#### 2. Questionnaire wizard

**Files**: `src/components/plans/QuestionnaireForm.tsx`, `QuestionnaireStepProfile.tsx`, `QuestionnaireStepContext.tsx`, `QuestionnaireStepInjuries.tsx`

**Intent**: Style the wizard's step indicator, Back/Next buttons, and each step's inputs/checkboxes/search field using the new tokens, giving this component its first real visual treatment since it shipped as a functional-only wizard in `questionnaire-wizard-flow`.

**Contract**: `QuestionnaireFormProps` contract to `DashboardPlanShell.tsx` (`error`, `pending`, `value`, `onChange`, `onSubmit`) is unchanged — styling only.

#### 3. Plan views + dashboard shell

**Files**: `src/components/plans/WeeklyPlanView.tsx`, `DashboardPlanShell.tsx`

**Intent**: Replace the current ad hoc emerald/cyan accent colors with the new token-driven palette (e.g. moss-green accents for completed/rest-day states) so the plan view reads as part of the same visual system as everything else.

**Contract**: No change to the data/props contract — visual classes only.

#### 4. `Topbar` and `Banner` chrome

**Files**: `src/components/Topbar.astro`, `src/components/Banner.astro`

**Intent**: Apply the new tokens to the nav chrome and config-warning banner so they match the rest of the shell.

**Contract**: Visual-only change.

#### 5. Climbing illustrations for the landing hero

**File**: `src/components/Welcome.astro`, plus new asset files under `src/assets/` (new directory) or `public/`

**Intent**: Source climbing-themed SVG illustrations (e.g. a mountain/rock-face silhouette for the hero backdrop, and three small icons for the feature cards replacing the generic lock/network/arrow SVGs at `Welcome.astro:59-118`) and wire them in, replacing the cosmic orbs/starfield decoration.

**Contract**: Each of the 3 feature-card SVGs (`Welcome.astro:59-73`, `81-96`, `104-118`) is replaced with a climbing-relevant equivalent (e.g. a carabiner, a route/topo line, a chalk-bag icon) sized and colored consistently with the surrounding card styling; sourced assets must carry a license compatible with this project's use (confirm before committing any third-party SVG/asset file).

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- `grep -rn "purple-\|cyan-\|emerald-\|blue-100\|indigo-" src/components/` returns no remaining literal cosmic-era color classes

#### Manual Verification:

- Every component listed above visually reads as part of one consistent earthy rock/nature system, not a mix of old and new colors
- The landing hero and feature cards show climbing-relevant imagery, not generic lock/network/arrow icons or space orbs
- Questionnaire wizard, plan view, and auth forms remain fully functional (manually complete the questionnaire and view a plan) with no regression from the styling pass

---

## Phase 4: Dialog primitive + destructive-action reskin

### Overview

Generate the shadcn `Dialog` primitive and use it to replace both native `window.confirm()` / inline `onsubmit="confirm(...)"` destructive-action confirmations.

### Changes Required:

#### 1. Generate `Dialog` primitive

**File**: `src/components/ui/dialog.tsx` (new, shadcn-generated)

**Intent**: Add the shadcn `Dialog` component (matching the existing `Button`'s style/config in `components.json`) as the shared confirmation-dialog primitive.

**Contract**: Standard shadcn `Dialog` API (`Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, etc.), styled via the Phase 1 tokens automatically since it consumes `--background`/`--foreground`/`--border` etc.

#### 2. Plan-deletion confirmation

**File**: `src/components/plans/DashboardPlanShell.tsx`

**Intent**: Replace the `window.confirm(...)` call at `DashboardPlanShell.tsx:71` with a controlled `Dialog` (open state + confirm/cancel actions) that calls the same existing deletion handler on confirm.

**Contract**: The deletion handler's actual logic (the `POST /api/plans/delete` call) is unchanged — only the confirmation UI changes from a blocking native dialog to a controlled React `Dialog`.

#### 3. Account-deletion confirmation

**Files**: `src/pages/settings.astro`, `src/components/auth/DeleteAccountForm.tsx` (new)

**Intent**: Extract the delete-account `<form>` (`settings.astro:40-52`) into a new `client:load` React island that renders a `Dialog`-based confirmation instead of the inline `onsubmit="return confirm(...)"` attribute, submitting the same `POST /api/account/delete-account` request on confirm.

**Contract**: The new component receives the same `delError` server-error prop `settings.astro` currently reads from the URL search param, and posts to the same `/api/account/delete-account` route — no server-side route change.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- `grep -rn "window.confirm\|onsubmit=\"return confirm" src/` returns nothing
- Existing account/plan-deletion unit tests still pass: `npm run test` (or project's configured test command) covering `delete-account.test.ts`, `delete.test.ts`

#### Manual Verification:

- Clicking "Delete account" on `/settings` opens the themed Dialog, not a native browser confirm popup; confirming deletes the account exactly as before
- Clicking "Delete this weekly plan" on `/dashboard` opens the themed Dialog; confirming deletes the plan and resets to the blank questionnaire exactly as before
- Cancelling either Dialog leaves the account/plan untouched

---

## Phase 5: Mobile/visual verification

### Overview

Add a Playwright viewport spec covering the dashboard, questionnaire wizard, and landing page at 320px/375px/tablet widths using the existing e2e harness, and perform a multimodal screenshot review as manual verification. Leave `context/foundation/test-plan.md` itself untouched.

### Changes Required:

#### 1. Viewport/visual-regression spec

**File**: `e2e/mobile-viewport.spec.ts` (new)

**Intent**: Following the existing pattern in `e2e/dashboard-access.spec.ts`/`questionnaire-wizard.spec.ts` (Playwright `test`, existing `fixtures/test-user.ts` + `global-setup.ts` for authenticated state), add test cases that load the landing page (unauthenticated), the dashboard, and the questionnaire wizard at three viewport sizes (320×568, 375×667, 768×1024) and assert no horizontal scroll (`document.documentElement.scrollWidth <= window.innerWidth`) on each.

**Contract**: Uses Playwright's `page.setViewportSize(...)` per test case; reuses the existing `webServer`/`baseURL` config in `playwright.config.ts` — no config changes needed, only a new spec file.

### Success Criteria:

#### Automated Verification:

- New spec passes: `npm run test:e2e -- mobile-viewport.spec.ts`
- Full e2e suite still passes: `npm run test:e2e`
- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Claude (or equivalent multimodal review) screenshots the dashboard, questionnaire wizard, and landing page and confirms each reads as climbing/rock/nature-themed rather than generic, per a short checklist: earthy palette applied, no leftover cosmic/grayscale classes, climbing-relevant iconography/illustration present
- Manual spot-check on a real mobile browser (not just devtools emulation) confirms no horizontal scroll and legible text on the three critical screens

---

## Testing Strategy

### Unit Tests:

- No new unit-testable logic is introduced by this change (styling + one new client-side Dialog wiring); existing unit tests for `delete-account`/`delete` API routes must continue to pass unmodified since their server-side contracts don't change.

### Integration Tests:

- Existing e2e specs (`dashboard-access.spec.ts`, `questionnaire-wizard.spec.ts`, `login-session.spec.ts`) must continue to pass after the PageShell migration and component restyling — they assert on labels/roles, not visual classes, so they should be unaffected, but re-running them is the regression check.

### Manual Testing Steps:

1. Load each of the 6 pages plus the landing page in a browser at 320px, 375px, and 768px widths; confirm no horizontal scroll and legible layout.
2. Complete the questionnaire wizard end-to-end and confirm the styled steps remain fully functional.
3. Trigger both destructive-action confirmations (account delete, plan delete) and confirm the themed Dialog appears and behaves correctly for both confirm and cancel paths.
4. Visually review the landing page, dashboard, and questionnaire wizard against the "reads as climbing, not generic" checklist (Phase 5).

## Performance Considerations

Adding one display font introduces a new font request — use `font-display: swap` (or the Google Fonts default) so text isn't blocked on font load. No other performance-relevant changes (no new heavy dependencies beyond the already-installed shadcn/Radix stack).

## Migration Notes

Not applicable — this is a UI-only visual change with no data model or persisted-state migration.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-05, scope anchor MS-03)
- Related, already-shipped change: `context/archive/2026-09-08-questionnaire-wizard-flow/plan.md` (explicitly deferred all visual/theme decisions to this change)
- Related, already-shipped change: `context/archive/2026-09-08-account-settings/plan-brief.md` (introduced the account-deletion `confirm()` flow this change reskins)
- Related, already-shipped change: `context/archive/2026-09-08-plan-deletion-flow/plan-brief.md` (introduced the plan-deletion `confirm()` flow this change reskins)
- Existing e2e harness: `context/changes/playwright-e2e-foundation/plan.md`
- **Follow-up (not part of this plan)**: once this change ships, run `/10x-test-plan --refresh` to reconsider `test-plan.md` §5's "optional — not scheduled" status for visual-diff/multimodal-review gates, since `test-plan.md` §7 names this exact change as the trigger for that re-evaluation.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Design token foundation

#### Automated

- [x] 1.1 Lint passes: `npm run lint` — 38f175b
- [x] 1.2 Build passes: `npm run build` — 38f175b
- [x] 1.3 Astro types refresh cleanly: `npx astro sync` — 38f175b
- [x] 1.4 No remaining `.dark`/`bg-cosmic` references (post Phase 2) — 185efcc

#### Manual

- [ ] 1.5 New palette applied via body/:root tokens on any page
- [ ] 1.6 Heading text renders in the new display font; body text unaffected
- [ ] 1.7 No visual regression in existing error/destructive states

### Phase 2: Shared PageShell + page wiring + breakpoint retrofit

#### Automated

- [x] 2.1 Lint passes: `npm run lint` — 185efcc
- [x] 2.2 Build passes: `npm run build` — 185efcc
- [x] 2.3 `grep -rn "bg-cosmic" src/` returns nothing — 185efcc
- [ ] 2.4 Existing e2e specs still pass unmodified

#### Manual

- [ ] 2.5 No horizontal scroll at 320px/375px/768px on all 7 pages
- [ ] 2.6 Topbar does not overflow at 320px with a long email
- [ ] 2.7 Each page's container width matches its pre-redesign width

### Phase 3: Component-level restyling + custom illustrations

#### Automated

- [x] 3.1 Lint passes: `npm run lint` — 2dd153a
- [x] 3.2 Build passes: `npm run build` — 2dd153a
- [x] 3.3 No remaining literal cosmic-era color classes in `src/components/` — 2dd153a

#### Manual

- [ ] 3.4 All components read as one consistent earthy rock/nature system
- [ ] 3.5 Landing hero and feature cards show climbing-relevant imagery
- [ ] 3.6 Questionnaire wizard, plan view, and auth forms remain fully functional

### Phase 4: Dialog primitive + destructive-action reskin

#### Automated

- [x] 4.1 Lint passes: `npm run lint`
- [x] 4.2 Build passes: `npm run build`
- [x] 4.3 No remaining `window.confirm`/inline `confirm(` usage
- [x] 4.4 Existing account/plan-deletion unit tests still pass

#### Manual

- [ ] 4.5 Account-deletion Dialog opens and confirms/cancels correctly
- [ ] 4.6 Plan-deletion Dialog opens and confirms/cancels correctly
- [ ] 4.7 Cancelling either Dialog leaves data untouched

### Phase 5: Mobile/visual verification

#### Automated

- [ ] 5.1 New spec passes: `npm run test:e2e -- mobile-viewport.spec.ts`
- [ ] 5.2 Full e2e suite still passes: `npm run test:e2e`
- [ ] 5.3 Lint passes: `npm run lint`
- [ ] 5.4 Build passes: `npm run build`

#### Manual

- [ ] 5.5 Multimodal review confirms climbing/rock/nature look on 3 critical screens
- [ ] 5.6 Real-device mobile spot-check shows no horizontal scroll, legible text
