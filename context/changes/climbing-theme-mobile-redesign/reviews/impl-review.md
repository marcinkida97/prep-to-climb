<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Climbing-Themed, Mobile-Correct Visual Redesign

- **Plan**: context/changes/climbing-theme-mobile-redesign/plan.md
- **Scope**: Phase 5 of 5 (full plan review)
- **Date**: 2026-09-08
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 5 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Re-ran all automated gates during this review: `npm run lint` (0 errors, 9 pre-existing
`no-console` warnings), `npm run build` (clean), `npx astro sync` (clean), `npm run test`
(78/78 unit tests pass, incl. `delete-account.test.ts`/`delete.test.ts`), and all four
grep gates (`bg-cosmic`/`.dark {`, literal cosmic-era colors in `src/components/`,
`window.confirm`/inline `confirm(`) — all return zero matches. Progress items 2.4/5.1/5.2
remain honestly unchecked (env-blocked, not silently rubber-stamped) — Success Criteria
still rates PASS since nothing that actually ran failed.

## Findings

### F1 — Account deletion is now fully JS-dependent with no degraded fallback

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/auth/DeleteAccountForm.tsx:17-32, src/pages/settings.astro:33
- **Detail**: Before this change, `settings.astro` rendered a plain `<form onsubmit="return confirm(...)">` — even with JS disabled or a failed hydration, the form still existed and could submit (only the confirm prompt was lost). Now the visible control is a `type="button"` that only opens a Radix `Dialog`; the real `<form method="POST" action="/api/account/delete-account">` lives inside `DialogContent`, which Radix doesn't mount until the dialog is open. If the `client:load` chunk fails to load/hydrate, the button is inert and there is no path to delete the account, with no error surfaced. `ChangePasswordForm` already has this same `client:load` dependency, so this isn't a new *class* of risk for the app, but it is a new *instance* of it on a harder-to-reverse action than password change.
- **Fix A ⭐ Recommended**: Accept as consistent with the existing `client:load` posture already shipped for `ChangePasswordForm`/`SignInForm`/`SignUpForm` — no code change.
  - Strength: Matches every other interactive form in this app; the app doesn't claim no-JS resilience anywhere else.
  - Tradeoff: If client JS fails, the user has no path to delete their account without contacting support.
  - Confidence: MED — depends on how much the team weighs no-JS resilience for destructive actions specifically.
  - Blind spot: Haven't checked whether there's a compliance requirement (e.g. GDPR right-to-erasure) that would push this toward requiring a fallback.
- **Fix B**: Add a `<noscript>` fallback that renders the original plain form (or a link to a dedicated confirm page) so deletion still works without JS.
  - Strength: Restores graceful degradation specifically for this hard-to-reverse action.
  - Tradeoff: Extra markup/maintenance burden for a purely visual redesign plan that didn't scope in a resilience layer.
  - Confidence: MED — a known pattern, but adds complexity disproportionate to this plan's stated goals.
  - Blind spot: Plan-deletion (`DashboardPlanShell.tsx`) has the same JS dependency (it was already a React island pre-redesign) — fixing only account deletion would be inconsistent.
- **Decision**: ACCEPTED (Fix A — consistent with existing app-wide `client:load` posture, no code change)

### F2 — Removing the `@custom-variant dark` scoping exposes previously-inert `dark:` classes in `button.tsx`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/styles/global.css (removed `@custom-variant dark (&:is(.dark *));`), src/components/ui/button.tsx (`dark:bg-input/30`, `dark:border-input`, `dark:bg-destructive/60`, `dark:focus-visible:ring-destructive/40`)
- **Detail**: Before this change, `dark:` only activated under an explicit `.dark` ancestor class that nothing in the app ever toggled — those classes in `button.tsx` were effectively dead. Deleting the custom variant doesn't disable `dark:`; Tailwind v4 falls back to its built-in `@media (prefers-color-scheme: dark)` strategy. So any user with OS-level dark mode will now actually trigger those classes, producing partially-inconsistent button styling with no corresponding dark palette defined (since Phase 1 intentionally removed the `.dark` token block). `button.tsx` was never in this plan's file list — this is a cross-file side effect of an in-scope change.
- **Fix A ⭐ Recommended**: Restore `@custom-variant dark (&:is(.dark *));` in `global.css`.
  - Strength: One-line fix, restores the exact prior (working) behavior — `dark:` stays inert until a real toggle ships, matching the plan's own stated intent that no working dark-mode toggle exists.
  - Tradeoff: Keeps a small amount of now-unused custom-variant scaffolding around.
  - Confidence: HIGH — directly reverses an unintended interaction with a minimal, well-understood change.
  - Blind spot: None significant.
- **Fix B**: Strip the leftover `dark:` classes from `button.tsx` instead.
  - Strength: Removes genuinely dead code rather than re-adding scaffolding for an unused variant.
  - Tradeoff: Touches a file outside this plan's phases; shadcn's generator ships `dark:` classes by convention, so a future `npx shadcn add`/regeneration would silently reintroduce them.
  - Confidence: MED — correct in principle, but other shadcn-generated files may have the same latent classes elsewhere (not checked).
  - Blind spot: Haven't grepped the rest of the repo for other `dark:` usages that would have the same newly-exposed behavior.
- **Decision**: FIXED (Fix A — restored `@custom-variant dark (&:is(.dark *));` in `global.css`)

### F3 — `PageShell` gained an undocumented-in-plan `variant` prop

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; already resolved well
- **Dimension**: Scope Discipline
- **Location**: src/components/PageShell.astro
- **Detail**: The plan's contract specified `PageShell` props as `{ maxWidth?: "3xl"|"4xl"|"5xl" }` with `<Topbar />` always rendered internally. During Phase 2 it was discovered that 3 auth pages (`signin`/`signup`/`confirm-email`) never used `Topbar` or the two-div wrapper the plan assumed. Rather than force them onto the wrong layout, a second `variant?: "default" | "centered"` prop was added (flagged live via `AskUserQuestion` at the time, per this session's own record) so `"centered"` skips `Topbar` entirely for a single vertically-centered card. This is EXTRA relative to the plan's literal contract, but well-justified and documented in the Phase 2 commit message.
- **Fix**: No action needed — already correctly resolved and documented; noting it here for the record.
- **Decision**: NO_CHANGE_NEEDED

### F4 — Landing-hero illustrations became original SVG + lucide icons instead of "sourced" assets

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; already resolved well
- **Dimension**: Scope Discipline
- **Location**: src/components/Welcome.astro
- **Detail**: The plan called for "sourced climbing illustrations" (mountain silhouette, carabiner/topo-line/chalk-bag icons) and explicitly flagged a licensing check as an open, unresolved risk. The implementation sidesteps that risk entirely: the hero backdrop is an original hand-drawn SVG (three overlapping mountain-range polygons using theme tokens), and the three feature-card icons use already-installed, already-licensed `lucide-react` icons (`Anchor`, `Route`, `ShieldCheck`) instead of any third-party asset. This closes the plan's own flagged risk at the cost of `ShieldCheck` being a generic safety icon rather than climbing-specific.
- **Fix**: No action needed — this is a reasonable, lower-risk resolution of a risk the plan itself flagged as unresolved.
- **Decision**: NO_CHANGE_NEEDED

### F5 — Three new decorative icons in Welcome.astro's feature cards are missing `aria-hidden`

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/Welcome.astro (Anchor/Route/ShieldCheck icons next to each feature-card heading)
- **Detail**: The mountain-range SVG backdrop added two lines earlier in the same file correctly has `aria-hidden="true"`, but the three new lucide icons don't, even though each sits beside a heading that already conveys the same meaning (purely decorative). Same gap exists pre-existing elsewhere in the app (FormField, ServerError, etc.), so this isn't a new codebase-wide problem — just three new instances of it.
- **Fix**: Add `aria-hidden="true"` to the `Anchor`, `Route`, and `ShieldCheck` icon elements in `Welcome.astro`.
- **Decision**: FIXED

### F6 — Plan-deletion Dialog's close/overlay/Escape path isn't guarded during an in-flight delete

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/plans/DashboardPlanShell.tsx (Dialog `onOpenChange={setIsDeleteDialogOpen}`, around the delete-confirmation Dialog)
- **Detail**: The dialog's Cancel button is correctly `disabled={isDeleting}`, but `onOpenChange` itself (triggered by Escape, overlay click, or the default close (X) button) has no such guard, so a user can dismiss the dialog mid-request with no visible feedback that a delete is still in flight. This doesn't cause a double-submit (the parent's `isDeleting` state still gates the Delete button correctly if reopened), and on failure `submissionError` is set but has no render path in the saved-plan view (`SavedPlanActions`, not `QuestionnaireForm`, is what's shown there) — that error-display gap pre-dates this diff (it existed with `window.confirm` too), so it's not a new regression, just made more reachable by the new Escape/overlay-close path.
- **Fix**: Guard `onOpenChange` to ignore close attempts while `isDeleting` is `true` (e.g. `onOpenChange={(open) => { if (!isDeleting) setIsDeleteDialogOpen(open); }}`).
- **Decision**: FIXED

### F7 — `DeleteAccountForm` uses a named export where sibling full-page forms use default exports

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/auth/DeleteAccountForm.tsx
- **Detail**: This codebase's convention is: full standalone forms (`ChangePasswordForm`, `SignInForm`, `SignUpForm`) use `export default function X`, while small shared pieces (`FormField`, `SubmitButton`, `ServerError`, `PasswordToggle`, `SuccessMessage`) use named exports. `DeleteAccountForm` is a full standalone form but was written with a named export, breaking that sub-convention. Cosmetic only — `settings.astro`'s import already matches (`import { DeleteAccountForm } from ...`).
- **Fix**: Rename to `export default function DeleteAccountForm(...)` and update the import in `settings.astro` to `import DeleteAccountForm from "@/components/auth/DeleteAccountForm"`.
- **Decision**: FIXED
