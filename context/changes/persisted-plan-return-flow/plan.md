# Persisted Plan Return Flow Implementation Plan

## Overview

Harden and explicitly verify the "come back later and still see my saved weekly plan" experience. This slice does not build a second planning flow; it tightens the already-implemented saved-plan-first dashboard behavior from `S-02`, adds an explicit recovery path when persisted plan loading fails, and closes the cross-session verification gap that still prevents the roadmap promise from being fully proven.

## Current State Analysis

The product already has the core mechanics that `S-03` needs. Sign-in redirects to `/dashboard`, middleware protects both `/dashboard` and `/api/plans`, the server loads the current persisted plan before rendering the protected page, and the dashboard island already defaults returning users into a saved-plan-first state with an explicit regenerate action. What is missing is a clean failure-recovery branch if the persisted plan cannot be loaded after sign-in, plus retained manual evidence that the true sign-out/sign-in return flow works end to end with the real `/api/plans/generate` route.

## Desired End State

After this plan is complete, a returning authenticated user can sign out, sign back in, and reliably land on the saved weekly plan they generated earlier. If persisted plan loading fails or returns an unusable state, `/dashboard` falls back to the questionnaire with clear inline recovery messaging instead of leaving the user in an ambiguous return state. Verification is complete only when the cross-session path, regenerate path, and anonymous guards are recorded in a dedicated change-scoped verification note, and the repo gates `npx astro sync`, `npm run lint`, and `npm run build` all pass.

### Key Discoveries:

- `/dashboard` already loads the current persisted plan server-side before rendering the interactive shell in [src/pages/dashboard.astro](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/pages/dashboard.astro:8).
- The dashboard shell already defaults returning users into a saved-plan-first view and exposes regenerate as a secondary action in [src/components/plans/DashboardPlanShell.tsx](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/components/plans/DashboardPlanShell.tsx:17).
- The persistence boundary already treats "latest active plan for one user" as the return-flow contract through `getCurrentPlan(...)` and `saveCurrentPlan(...)` in [src/lib/plan-persistence.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/lib/plan-persistence.ts:53).
- Sign-in already returns authenticated users directly to `/dashboard`, so the cross-session loop is anchored to the correct route in [src/pages/api/auth/signin.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/pages/api/auth/signin.ts:19).
- The anonymous protection contract already exists for both dashboard and plan APIs in [src/middleware.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/middleware.ts:4) and [src/pages/api/plans/generate.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/pages/api/plans/generate.ts:9).
- `S-02` still has unclosed final manual verification scenarios, including the returning-user path and anonymous API guard, in [context/changes/first-weekly-plan-flow/verification.md](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/context/changes/first-weekly-plan-flow/verification.md:17).

## What We're NOT Doing

- Rebuilding the questionnaire, generator, or saved weekly plan presentation from `S-02`
- Adding plan freshness rules, stale-plan timers, or forced regeneration
- Introducing plan history, version browsing, or multiple saved plans per user
- Renaming `/dashboard` or moving the protected planning flow to a new route
- Adding a new automated end-to-end test harness just for this slice
- Expanding the data model beyond the current one-active-plan-per-user contract

## Implementation Approach

Treat `S-03` as a narrow hardening slice on top of `S-02`. Keep the current `/dashboard` route, persistence contract, and saved-plan-first UI. Add one explicit return-flow recovery branch so that if the app cannot present the saved plan after sign-in, the user falls back to the questionnaire with a clear explanation and the ability to regenerate immediately. Then prove the roadmap promise through a dedicated manual verification artifact that records the actual cross-session flow with the same user account, including the anonymous-route guard behavior on the real generation endpoint.

## Critical Implementation Details

### State sequencing

The server currently resolves `initialPlan` before the dashboard island hydrates, while the island derives `showQuestionnaire` and `draftQuestionnaire` from that initial server payload. Any recovery path for "saved plan expected but unavailable" needs to preserve that single-page state model rather than introducing a second page or redirect branch after sign-in.

### User experience spec

Returning users should still see the saved weekly plan first by default. Recovery messaging only appears when the app cannot safely present that saved plan. In that case, the questionnaire becomes the fallback path, and the message should explain that the user can regenerate the plan from the same dashboard instead of implying their account or session is broken.

## Phase 1: Harden the saved-plan return state

### Overview

Add the one missing product seam in the current return flow: when persisted plan loading fails or yields an unusable return state, keep the user on `/dashboard`, show clear recovery guidance, and drop them into the questionnaire path rather than an ambiguous or broken state.

### Changes Required:

#### 1. Dashboard server-side load contract

**File**: `src/pages/dashboard.astro`

**Intent**: Distinguish "no saved plan exists yet" from "a saved plan could not be loaded safely" so the return-flow UI can react intentionally instead of treating every `null` the same way.

**Contract**: Preserve server-side loading through `createPlanPersistence(...).getCurrentPlan(...)`, but pass enough initial state into the shell to differentiate first-run, successful saved-plan return, and recovery-fallback cases after sign-in.

#### 2. Dashboard recovery state handling

**File**: `src/components/plans/DashboardPlanShell.tsx`

**Intent**: Keep returning users unblocked if the saved plan cannot be rendered after sign-in.

**Contract**: Preserve saved-plan-first as the default when a valid plan exists. When the initial return state indicates a plan-load failure or invalid saved-plan state, open the questionnaire by default, show inline recovery messaging, keep regenerate semantics consistent with the existing submit flow, and avoid navigating away from `/dashboard`.

#### 3. Return-flow presentation copy

**File**: `src/components/plans/WeeklyPlanView.tsx`

**Intent**: Make the returning-user state and recovery fallback read as a coherent product path instead of a silent technical fallback.

**Contract**: Keep the saved plan presentation intact, but ensure any return-flow copy changes reinforce the chosen policy: saved plan is the default source of truth until the user explicitly regenerates it.

### Success Criteria:

#### Automated Verification:

- Astro types refresh successfully after the return-state contract is updated: `npx astro sync`
- Lint passes with the recovery-state additions: `npm run lint`
- Build passes with the hardened dashboard return flow: `npm run build`

#### Manual Verification:

- A returning signed-in user with a valid saved plan still lands on the saved-plan-first dashboard state
- If the saved plan cannot be loaded safely, the dashboard falls back to the questionnaire with explicit recovery messaging
- The recovery fallback stays on `/dashboard` and allows the user to regenerate a plan from the same page

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Prove the real cross-session return path

### Overview

Capture the actual sign-out/sign-in evidence that the roadmap slice claims, using the existing auth flow, persisted plan contract, and real generation endpoint.

### Changes Required:

#### 1. Dedicated verification artifact

**File**: `context/changes/persisted-plan-return-flow/verification.md`

**Intent**: Record concrete evidence for the exact return-flow scenarios that still remain open after `S-02`.

**Contract**: Document the observed results for: generate a plan while authenticated, sign out, sign back in as the same user, confirm saved-plan-first return behavior, intentionally regenerate, confirm fallback behavior if a load issue is simulated or observed, verify anonymous `/dashboard` redirect, and verify anonymous `POST /api/plans/generate` returns the current unauthorized JSON shape.

#### 2. Auth return-path alignment

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Keep the verified return path anchored to the same route the product already uses for signed-in entry.

**Contract**: Preserve the current successful redirect target of `/dashboard` unless a narrowly scoped fix is required to make the cross-session verification path consistent and reliable.

#### 3. Protected-route guard verification target

**File**: `src/middleware.ts`

**Intent**: Ensure the verification artifact proves the current guard behavior against the routes that matter now, not the retired smoke-path contract from `F-01`.

**Contract**: Keep `/dashboard` and `/api/plans` under the existing guard model, and verify the anonymous API contract against `/api/plans/generate`, not `/api/plans/smoke`.

### Success Criteria:

#### Automated Verification:

- Astro types refresh successfully on the integrated return-flow slice: `npx astro sync`
- Lint passes after verification-target adjustments or copy changes: `npm run lint`
- Build passes on the full repo: `npm run build`

#### Manual Verification:

- The same user can generate a plan, sign out, sign back in, and see the saved plan first on `/dashboard`
- The returning user can intentionally regenerate the plan from the same page after re-entering the app
- Anonymous `/dashboard` access redirects to `/auth/signin`
- Anonymous `POST /api/plans/generate` returns `401` with the current unauthorized JSON shape

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Align artifacts and close the roadmap boundary

### Overview

Make the narrowed `S-03` scope explicit in the change artifacts so the roadmap, plan history, and implementation evidence all tell the same story.

### Changes Required:

#### 1. `S-03` change summary artifacts

**File**: `context/changes/persisted-plan-return-flow/plan-brief.md`

**Intent**: Summarize `S-03` as a hardening-and-proof slice rather than a duplicate implementation of `S-02`.

**Contract**: Explain that the saved-plan-first dashboard behavior already exists, name the recovery fallback and cross-session proof as the actual work, and record the user-selected decisions that shaped the slice.

#### 2. Verification lineage note

**File**: `context/changes/first-weekly-plan-flow/verification.md`

**Intent**: Keep the relationship between `S-02` and `S-03` understandable for later readers.

**Contract**: Update or annotate the open `S-02` verification note only as needed so it is clear that cross-session return proof now lives in the dedicated `S-03` change folder rather than silently remaining unresolved.

#### 3. Final repo validation boundary

**File**: `context/changes/persisted-plan-return-flow/plan.md`

**Intent**: Keep the definition of done explicit for the eventual implementation pass.

**Contract**: Execute the repo-required validation sequence for this slice: `npx astro sync`, `npm run lint`, and `npm run build`, plus the agreed manual cross-session and anonymous-guard checks.

### Success Criteria:

#### Automated Verification:

- Astro types refresh successfully on the final documented slice: `npx astro sync`
- Lint passes on the full repo: `npm run lint`
- Build passes on the full repo: `npm run build`

#### Manual Verification:

- The `S-03` change folder contains retained evidence for the real cross-session saved-plan return flow
- The relationship between `S-02` and `S-03` is explicit enough that future readers will not mistake `S-03` for a duplicate feature build
- The documented completion boundary matches the actual verified behavior and no longer depends on the retired smoke-path proof

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

## Testing Strategy

### Unit Tests:

- Validate any new helper that classifies the initial dashboard return state into first-run, saved-plan-first, or recovery-fallback
- Validate any presentational helper that derives recovery messaging from a load-failure condition

### Integration Tests:

- Server-side dashboard loading returns the saved persisted plan for an authenticated returning user
- Anonymous `POST /api/plans/generate` is still rejected with the current unauthorized contract
- Recovery fallback does not block a subsequent successful questionnaire submission and plan save

### Manual Testing Steps:

1. Start the app with valid Supabase configuration and refresh Astro types.
2. Sign in as a user with no saved plan, generate a valid weekly plan, and confirm it renders on `/dashboard`.
3. Sign out, then sign back in as the same user and confirm `/dashboard` opens on the saved-plan-first state.
4. Use the regenerate action and confirm the plan can still be replaced from the same page.
5. Trigger or simulate the saved-plan recovery case and confirm the questionnaire opens with explicit guidance while staying on `/dashboard`.
6. Visit `/dashboard` while signed out and confirm redirection to `/auth/signin`.
7. Replay an anonymous `POST /api/plans/generate` request and confirm it returns `401` with the current unauthorized JSON shape; record the request and response in `context/changes/persisted-plan-return-flow/verification.md`.

## Performance Considerations

This slice should not change plan-generation cost or add new data-fetch fan-out. Keep the return flow to a single current-plan lookup on page load and a normal regenerate submission when the user explicitly asks for it.

## Migration Notes

No schema change is planned. `S-03` relies on the existing one-active-plan-per-user persistence contract from `F-01` and should not widen it into plan history or freshness tracking.

## References

- Product requirements: `context/foundation/prd.md`
- Roadmap source: `context/foundation/roadmap.md`
- Prerequisite persistence plan: `context/changes/minimal-plan-persistence-contract/plan.md`
- Prerequisite weekly-plan flow: `context/changes/first-weekly-plan-flow/plan.md`
- Open `S-02` verification gap: [context/changes/first-weekly-plan-flow/verification.md](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/context/changes/first-weekly-plan-flow/verification.md:17)
- Server-side current-plan load: [src/pages/dashboard.astro](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/pages/dashboard.astro:8)
- Saved-plan-first dashboard state: [src/components/plans/DashboardPlanShell.tsx](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/components/plans/DashboardPlanShell.tsx:17)
- Current persistence read/write contract: [src/lib/plan-persistence.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/lib/plan-persistence.ts:53)
- Sign-in return route: [src/pages/api/auth/signin.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/pages/api/auth/signin.ts:19)
- Protected route guard: [src/middleware.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/middleware.ts:18)
- Current generation API contract: [src/pages/api/plans/generate.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/pages/api/plans/generate.ts:9)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Harden the saved-plan return state

#### Automated

- [x] 1.1 Astro types refresh successfully after the return-state contract is updated: `npx astro sync` — 9000008
- [x] 1.2 Lint passes with the recovery-state additions: `npm run lint` — 9000008
- [x] 1.3 Build passes with the hardened dashboard return flow: `npm run build` — 9000008

#### Manual

- [x] 1.4 A returning signed-in user with a valid saved plan still lands on the saved-plan-first dashboard state — 9000008
- [x] 1.5 If the saved plan cannot be loaded safely, the dashboard falls back to the questionnaire with explicit recovery messaging — 9000008
- [x] 1.6 The recovery fallback stays on `/dashboard` and allows the user to regenerate a plan from the same page — 9000008

### Phase 2: Prove the real cross-session return path

#### Automated

- [x] 2.1 Astro types refresh successfully on the integrated return-flow slice: `npx astro sync`
- [x] 2.2 Lint passes after verification-target adjustments or copy changes: `npm run lint`
- [x] 2.3 Build passes on the full repo: `npm run build`

#### Manual

- [x] 2.4 The same user can generate a plan, sign out, sign back in, and see the saved plan first on `/dashboard`
- [x] 2.5 The returning user can intentionally regenerate the plan from the same page after re-entering the app
- [x] 2.6 Anonymous `/dashboard` access redirects to `/auth/signin`
- [x] 2.7 Anonymous `POST /api/plans/generate` returns `401` with the current unauthorized JSON shape

### Phase 3: Align artifacts and close the roadmap boundary

#### Automated

- [ ] 3.1 Astro types refresh successfully on the final documented slice: `npx astro sync`
- [ ] 3.2 Lint passes on the full repo: `npm run lint`
- [ ] 3.3 Build passes on the full repo: `npm run build`

#### Manual

- [ ] 3.4 The `S-03` change folder contains retained evidence for the real cross-session saved-plan return flow
- [ ] 3.5 The relationship between `S-02` and `S-03` is explicit enough that future readers will not mistake `S-03` for a duplicate feature build
- [ ] 3.6 The documented completion boundary matches the actual verified behavior and no longer depends on the retired smoke-path proof
