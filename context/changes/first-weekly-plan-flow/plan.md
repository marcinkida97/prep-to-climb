# First Weekly Plan Flow Implementation Plan

## Overview

Deliver the first real protected product flow on `/dashboard`: an authenticated user answers a minimal questionnaire, the app generates a deterministic injury-aware weekly climbing plan, persists it through the existing `F-01` contract, and immediately renders the full saved 7-day result. Returning users land on their saved current plan first and can regenerate it from the same protected page.

## Current State Analysis

The repo already has the prerequisites this slice depends on: authenticated access lands on `/dashboard`, middleware protects both `/dashboard` and `/api/plans`, and the persistence layer can already save and read one active seven-day plan for the signed-in user. What is still missing is the actual product flow. The protected page remains a placeholder around the `F-01` smoke test, the only plan route posts a hard-coded payload, and there is no real questionnaire, plan-generation logic, or saved-plan presentation layer yet.

## Desired End State

After this plan is complete, `/dashboard` behaves like the MVP product entry point instead of a transition page. A first-time signed-in user sees a questionnaire for climbing grade and injury limitations; submitting it keeps them on the same page, shows inline loading, generates and saves a real weekly plan, then renders the full persisted seven-day result. A returning user with an existing current plan sees that saved plan first and can regenerate it by resubmitting the questionnaire. Verification is complete when the protected flow works end-to-end, unauthenticated requests are still blocked, and lint/build both pass.

### Key Discoveries:

- The current protected entry page is still explicitly framed as a placeholder around the temporary persistence check in [src/pages/dashboard.astro](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/pages/dashboard.astro:8).
- The only existing plan route persists a fixed smoke payload rather than real questionnaire input in [src/pages/api/plans/smoke.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/pages/api/plans/smoke.ts:5).
- The persistence seam already exposes exactly the two server methods this slice needs: `getCurrentPlan(...)` and `saveCurrentPlan(...)` in [src/lib/plan-persistence.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/lib/plan-persistence.ts:46).
- The persisted questionnaire contract is currently narrowed to `climbingGrade` plus `injuryLimitations`, but `injuryLimitations` is still only `string[]`, so this slice needs to define the first canonical selectable injury shape before the generator can safely depend on it in [src/lib/plan-types.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/lib/plan-types.ts:1).
- The persistence validator requires exactly seven plan days with non-empty focus areas and exercise names in [src/lib/plan-persistence.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/lib/plan-persistence.ts:148).
- The protected-route boundary already covers `/dashboard` and `/api/plans`, so the new flow can stay inside the existing auth model in [src/middleware.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/middleware.ts:4).

## What We're NOT Doing

- Renaming `/dashboard` to a new route in this slice
- Expanding the questionnaire beyond climbing grade and injury limitations
- Introducing AI-generated recommendations or a generalized rules engine
- Adding plan history, version comparison, analytics, or multi-week training cycles
- Moving templates into the database or adding admin tooling for plan content
- Reworking the wider public marketing site beyond copy or links needed for the protected flow

## Implementation Approach

Keep the slice inside the existing protected dashboard route and persistence contract. Server-side dashboard loading decides whether the current user already has a saved plan. When there is no saved plan, the page shows the minimal questionnaire. When there is a saved plan, the page shows that plan first and offers a clear regenerate path. Form submission posts to a new authenticated plan route that validates the questionnaire payload, generates a deterministic 7-day weekly plan from a small set of code-defined templates, applies injury-based exercise substitutions, persists the result through `saveCurrentPlan(...)`, and returns a machine-usable success payload for the dashboard UI to reconcile.

## Critical Implementation Details

### State sequencing

The generator must produce a payload that already matches the persistence validator before it calls `saveCurrentPlan(...)`, because the existing contract rejects anything other than seven uniquely numbered days with non-empty focus areas and exercise names. That means template selection, injury substitution, and payload normalization have to finish before the first persistence call rather than being “patched up” afterward.

### User experience spec

The page stays on `/dashboard` throughout the flow. Submission shows inline loading in the questionnaire container, server failures keep the user-entered answers visible for retry, and a successful submission replaces the questionnaire view with the persisted saved-plan view instead of navigating to a second page.

### Request/response transport

The protected dashboard flow uses client-side JSON submission rather than a redirect-based form POST. `DashboardPlanShell` sends `fetch("/api/plans/generate", { method: "POST", headers: { "content-type": "application/json" } })` with the typed questionnaire payload, and the route responds with a machine-usable JSON envelope: success returns `{ ok: true, plan: PersistedCurrentPlan }`, while failure returns `{ ok: false, error: string }` with status codes that preserve unauthorized vs validation vs server-failure paths.

## Phase 1: Branch the protected dashboard by saved-plan state

### Overview

Turn `/dashboard` into a real protected container that can load the current user's saved plan state and choose the correct first-run or returning-user view before the generation UI is layered on top.

### Changes Required:

#### 1. Dashboard server-side data loading

**File**: `src/pages/dashboard.astro`

**Intent**: Replace the smoke-test-only placeholder with a page that loads the authenticated user's current persisted plan state and branches the page shell accordingly.

**Contract**: Use the existing authenticated Supabase server client plus `getCurrentPlan(...)` to resolve one of two initial states for `/dashboard`: “no saved plan yet” or “saved current plan exists.” The page remains the protected entry route and keeps using the shared top bar.

#### 2. Dashboard view-state boundary

**File**: `src/components/plans/DashboardPlanShell.tsx`

**Intent**: Move the interactive protected-flow state model out of the `.astro` page so the page can stay focused on server data loading and composition.

**Contract**: Accept the initial persisted plan state, the authenticated user's email/display context if needed, and enough props to render first-run, returning-user, loading, and error states on one protected page.

### Success Criteria:

#### Automated Verification:

- Astro types refresh successfully after the new dashboard shell is added: `npx astro sync`
- Lint passes with the new protected flow container: `npm run lint`
- Build passes with server-side plan loading on `/dashboard`: `npm run build`

#### Manual Verification:

- A signed-in user with no saved plan sees the questionnaire entry state on `/dashboard`
- A signed-in user with an existing saved plan sees the saved-plan-first dashboard state instead of the questionnaire by default
- Anonymous access to `/dashboard` still redirects to `/auth/signin`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Add the minimal questionnaire and inline page-state behavior

### Overview

Introduce the real `S-02` questionnaire UX on the protected page, including client-side state retention, inline loading, and retryable inline error handling.

### Changes Required:

#### 1. Questionnaire form island

**File**: `src/components/plans/QuestionnaireForm.tsx`

**Intent**: Provide the minimal interactive questionnaire the PRD and persistence contract already define, without broadening the input model.

**Contract**: Collect `climbingGrade` as a required field and `injuryLimitations` as the only limitation input surface. Injury entries are selected, not free-typed: each selected limitation captures a canonical body part plus injury type/severity combination shared with the rest of the flow. Preserve entered values across failed submissions and expose submission state back to the dashboard shell.

#### 2. Shared questionnaire request/response types

**File**: `src/lib/plan-flow-types.ts`

**Intent**: Keep the dashboard UI and the new plan-generation route aligned on the questionnaire payload and response envelope, rather than letting the client infer server shapes ad hoc.

**Contract**: Define the minimal JSON request shape for questionnaire submission and the JSON response envelope for success/error cases that return the saved persisted plan or an inline-displayable error.

#### 3. Canonical injury option model

**File**: `src/lib/injury-options.ts`

**Intent**: Prevent the UI, route validation, persistence mapping, and injury-rule logic from inventing different meanings for the same limitation.

**Contract**: Define one canonical selectable injury vocabulary for the MVP. Each option combines a body part with an injury type/severity label, and the questionnaire, route validation, and generator all consume that same source of truth.

#### 4. Dashboard inline state handling

**File**: `src/components/plans/DashboardPlanShell.tsx`

**Intent**: Make the protected page resilient when the first real flow fails or retries instead of bouncing through generic error pages.

**Contract**: Show inline loading during submission, keep the questionnaire values visible if the server returns an error, and transition to the saved-plan view only after a successful persisted-plan response.

### Success Criteria:

#### Automated Verification:

- Astro types refresh successfully after the questionnaire island is added: `npx astro sync`
- Lint passes with the new client-side questionnaire state logic: `npm run lint`
- Build passes with the dashboard shell and questionnaire island wired together: `npm run build`

#### Manual Verification:

- The questionnaire exposes only climbing grade and selectable injury limitations
- Each selected injury limitation clearly captures both a body part and an injury type/severity
- Submitting the questionnaire shows an inline loading state without leaving `/dashboard`
- A server-side failure leaves the entered values visible and shows an inline retryable error message

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Replace the smoke route with a real authenticated plan-generation endpoint

### Overview

Add the first real server seam for `S-02`: accept questionnaire input from the dashboard, validate it, and establish the authenticated request/response contract that Phase 4 will complete with real generation and persistence.

### Changes Required:

#### 1. Authenticated plan-generation route

**File**: `src/pages/api/plans/generate.ts`

**Intent**: Provide the real protected submit endpoint for the dashboard flow instead of persisting a fixed smoke payload.

**Contract**: Accept only authenticated requests under `/api/plans`, parse the minimal questionnaire payload, reject invalid requests with machine-usable JSON errors, and expose the route contract that the dashboard shell will call once Phase 4 wires in real generation and persistence.

#### 2. Temporary smoke-route retirement

**File**: `src/pages/api/plans/smoke.ts`

**Intent**: Prevent the old hard-coded proof route from remaining the visible or implied product contract once the real flow exists.

**Contract**: Either remove this route or reduce it to an explicitly non-primary internal seam so the dashboard no longer depends on it and future readers do not confuse it with the user-facing generation API.

#### 3. Dashboard submission integration

**File**: `src/components/plans/DashboardPlanShell.tsx`

**Intent**: Connect the protected page to the real generation endpoint and response contract.

**Contract**: Submit questionnaire answers as JSON to the new authenticated route, reconcile success/error responses using the shared flow types, and update the visible dashboard state without a full-page navigation once the route returns real persisted-plan responses in Phase 4.

### Success Criteria:

#### Automated Verification:

- Astro types refresh successfully after the real plan-generation route lands: `npx astro sync`
- Lint passes with the new route and dashboard submission integration: `npm run lint`
- Build passes after the dashboard flow stops depending on the smoke payload route: `npm run build`

#### Manual Verification:

- Valid questionnaire submissions reach the authenticated route contract and receive the defined JSON success/error envelope the dashboard can reconcile
- Invalid submissions return inline-displayable JSON errors before any generation or persistence work runs
- Anonymous requests to the new route still receive the current unauthorized JSON shape

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 4: Implement deterministic weekly-plan generation with injury-safe substitutions

### Overview

Introduce the narrow generation logic that turns the two questionnaire inputs into a full persisted weekly plan that satisfies the existing validator and product guardrails, then wire that real generated output through the route contract from Phase 3.

### Changes Required:

#### 1. Plan template catalog

**File**: `src/lib/plan-generator/templates.ts`

**Intent**: Define the small code-owned weekly plan templates the MVP can choose from without introducing a database-backed content system.

**Contract**: Export one or more template definitions that already describe seven ordered days with focus areas, notes, and recommended exercises in a shape the generator can normalize into `SaveCurrentPlanInput`.

#### 2. Injury limitation rule map

**File**: `src/lib/plan-generator/injury-rules.ts`

**Intent**: Encode the MVP safety promise in one explicit source of truth instead of scattering exercise exclusions across route handlers or components.

**Contract**: Declare blocked or substitution rules against the canonical injury-option model so the generator can reason over body part plus injury type/severity and remove or swap exercises that directly conflict with the declared limitation while still preserving a usable weekly plan.

#### 3. Plan generation service

**File**: `src/lib/plan-generator/index.ts`

**Intent**: Centralize template selection, injury-rule application, and payload normalization before persistence.

**Contract**: Accept questionnaire input, choose a deterministic template based on climbing grade, apply the injury substitution rules, and return a seven-day `SaveCurrentPlanInput["weeklyPlan"]` payload that already satisfies the current persistence validator.

#### 4. Route integration point

**File**: `src/pages/api/plans/generate.ts`

**Intent**: Keep the generation route thin so the business rule is reusable and testable outside the API handler.

**Contract**: Delegate template selection and injury filtering to the generator service rather than constructing the weekly plan inline in the route, then persist the generated weekly plan with `saveCurrentPlan(...)` and return the saved result to the dashboard.

### Success Criteria:

#### Automated Verification:

- Astro types refresh successfully after the generator modules are added: `npx astro sync`
- Lint passes with the new generator and rule modules: `npm run lint`
- Build passes with deterministic generation and persistence wired into the protected route: `npm run build`

#### Manual Verification:

- Valid authenticated questionnaire submissions persist a real plan and return a success response usable by the dashboard
- The generated plan contains exactly seven days with visible focus areas and recommended exercises
- Declaring an injury limitation removes or substitutes exercises that would directly conflict with that limitation
- Re-submitting the questionnaire replaces the current saved plan instead of creating a broken mixed state

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 5: Render the full saved weekly plan and regenerate path on the dashboard

### Overview

Complete the user-facing promise of `S-02` by rendering the persisted weekly plan in full and making the regenerate path explicit for returning users.

### Changes Required:

#### 1. Saved weekly plan presentation

**File**: `src/components/plans/WeeklyPlanView.tsx`

**Intent**: Present the actual persisted plan structure clearly enough that the MVP proves the product promise, not just the save action.

**Contract**: Render the plan summary plus all seven days with their focus areas, notes, and recommended exercises from the `PersistedCurrentPlan` shape already returned by the persistence layer.

#### 2. Regenerate affordance on returning-user state

**File**: `src/components/plans/DashboardPlanShell.tsx`

**Intent**: Keep repeat visits coherent by showing the saved plan first while still making it obvious how the user can produce a new one.

**Contract**: In the saved-plan state, provide a clear action that reveals or reuses the questionnaire so the user can regenerate the plan from the same page without losing the default saved-plan-first experience.

#### 3. Dashboard copy and placeholder cleanup

**File**: `src/pages/dashboard.astro`

**Intent**: Remove the old `F-01` smoke-test framing once the real product flow is live.

**Contract**: Update page copy so `/dashboard` reads as the real weekly-planning surface and no longer references the temporary persistence proof path as the primary purpose of the page.

### Success Criteria:

#### Automated Verification:

- Astro types refresh successfully after the saved-plan presentation components are added: `npx astro sync`
- Lint passes with the full plan view and regenerate state logic: `npm run lint`
- Build passes with the completed dashboard flow: `npm run build`

#### Manual Verification:

- A successful first-run submission replaces the questionnaire view with the full saved weekly plan on `/dashboard`
- A returning signed-in user sees the saved plan first and can intentionally regenerate it from the same page
- The dashboard no longer presents the smoke-test flow as the main user action

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 6: Verify the end-to-end protected flow and repo gates

### Overview

Lock the slice to a concrete end-to-end verification boundary so “done” means the protected weekly-plan flow truly works for both first-run and returning-user paths.

### Changes Required:

#### 1. End-to-end protected flow verification

**File**: `context/changes/first-weekly-plan-flow/verification.md`

**Intent**: Capture the manual smoke evidence for the exact flow the slice is supposed to deliver.

**Contract**: Record the verified scenarios for first-run questionnaire submission, saved-plan-first return visits, regenerate behavior, inline error recovery, and unauthorized API protection.

#### 2. Final repo validation

**File**: `context/changes/first-weekly-plan-flow/plan.md`

**Intent**: Keep the completion boundary explicit for the eventual implementation run.

**Contract**: Execute the repo-required validation sequence for this slice: `npx astro sync`, `npm run lint`, and `npm run build`, plus the agreed manual dashboard flow checks.

### Success Criteria:

#### Automated Verification:

- Astro types refresh successfully on the final integrated slice: `npx astro sync`
- Lint passes on the full repo: `npm run lint`
- Build passes on the full repo: `npm run build`

#### Manual Verification:

- A first-time authenticated user can submit climbing grade and injury limitations and immediately see a full 7-day saved plan
- A returning authenticated user sees the saved plan first and can regenerate it intentionally
- A failed generation attempt keeps the questionnaire values visible and allows retry from the same page
- Anonymous `/dashboard` access still redirects to `/auth/signin`
- Anonymous requests to the real plan-generation API still return `401` with the current unauthorized JSON shape

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

## Testing Strategy

### Unit Tests:

- Validate pure plan-generation helpers that map climbing grades to templates
- Validate injury substitution helpers so blocked exercises are removed or replaced predictably for each supported body-part and injury-type/severity combination
- Validate request-shape parsing or normalization helpers for the JSON request body consumed by the API route

### Integration Tests:

- Authenticated questionnaire submission generates a seven-day plan and persists it through `saveCurrentPlan(...)`
- Authenticated dashboard loading reads the existing current plan and renders the returning-user state
- Invalid questionnaire input returns a retryable error contract without partial persistence
- Anonymous access to `/api/plans/generate` is rejected by the existing protected-route model

### Manual Testing Steps:

1. Start the app with valid Supabase configuration and refresh Astro types.
2. Sign in with a user that has no saved plan and confirm `/dashboard` opens on the questionnaire state.
3. Submit a valid climbing grade and one selectable injury limitation, then confirm the page shows inline loading and resolves to a full seven-day plan.
4. Sign out and sign back in with the same user, then confirm `/dashboard` shows the saved plan first.
5. Use the regenerate path, change the questionnaire answers, and confirm the saved plan updates.
6. Trigger a server-side failure path and confirm the questionnaire values remain visible with an inline retryable error.
7. Visit `/dashboard` while signed out and confirm redirection to `/auth/signin`.
8. Replay an anonymous request to the real plan-generation route and confirm it returns the current `401` unauthorized JSON response.

## Performance Considerations

This slice does not need caching or background work. The main performance boundary is that generation stays synchronous and deterministic inside the request/response flow, so the template and injury-rule logic should remain small enough to keep the protected experience comfortably under the PRD’s two-minute end-to-end ceiling.

## Migration Notes

No new schema migration is planned here because `F-01` already introduced the persistence contract this slice uses. The main compatibility constraint is behavioral: the generated weekly-plan payload must continue matching the existing persistence validator and RPC replacement semantics.

## References

- Product requirements: `context/foundation/prd.md`
- Roadmap source: `context/foundation/roadmap.md`
- Prerequisite persistence plan: `context/changes/minimal-plan-persistence-contract/plan.md`
- Prerequisite auth plan: `context/changes/account-access-flow/plan.md`
- Protected dashboard placeholder: [src/pages/dashboard.astro](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/pages/dashboard.astro:8)
- Smoke proof route to replace: [src/pages/api/plans/smoke.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/pages/api/plans/smoke.ts:69)
- Current persistence boundary: [src/lib/plan-persistence.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/lib/plan-persistence.ts:46)
- Persisted plan contract: [src/lib/plan-types.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/lib/plan-types.ts:1)
- Validator constraints on saved plans: [src/lib/plan-persistence.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/lib/plan-persistence.ts:148)
- Existing protected-route guard: [src/middleware.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/middleware.ts:4)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Branch the protected dashboard by saved-plan state

#### Automated

- [x] 1.1 Astro types refresh successfully after the new dashboard shell is added: `npx astro sync` — 118c787
- [x] 1.2 Lint passes with the new protected flow container: `npm run lint` — 118c787
- [x] 1.3 Build passes with server-side plan loading on `/dashboard`: `npm run build` — 118c787

#### Manual

- [x] 1.4 A signed-in user with no saved plan sees the questionnaire entry state on `/dashboard` — 118c787
- [x] 1.5 A signed-in user with an existing saved plan sees the saved-plan-first dashboard state instead of the questionnaire by default — 118c787
- [x] 1.6 Anonymous access to `/dashboard` still redirects to `/auth/signin` — 118c787

### Phase 2: Add the minimal questionnaire and inline page-state behavior

#### Automated

- [x] 2.1 Astro types refresh successfully after the questionnaire island is added: `npx astro sync` — 17baa86
- [x] 2.2 Lint passes with the new client-side questionnaire state logic: `npm run lint` — 17baa86
- [x] 2.3 Build passes with the dashboard shell and questionnaire island wired together: `npm run build` — 17baa86

#### Manual

- [x] 2.4 The questionnaire exposes only climbing grade and selectable injury limitations — 17baa86
- [x] 2.5 Each selected injury limitation clearly captures both a body part and an injury type/severity — 17baa86
- [x] 2.6 Submitting the questionnaire shows an inline loading state without leaving `/dashboard` — 17baa86
- [x] 2.7 A server-side failure leaves the entered values visible and shows an inline retryable error message — 17baa86

### Phase 3: Replace the smoke route with a real authenticated plan-generation endpoint

#### Automated

- [x] 3.1 Astro types refresh successfully after the real plan-generation route lands: `npx astro sync` — 07f6378
- [x] 3.2 Lint passes with the new route and dashboard submission integration: `npm run lint` — 07f6378
- [x] 3.3 Build passes after the dashboard flow stops depending on the smoke payload route: `npm run build` — 07f6378

#### Manual

- [x] 3.4 Valid authenticated questionnaire submissions persist a real plan and return a success response usable by the dashboard — 07f6378
- [x] 3.5 Invalid submissions return inline-displayable JSON errors without persisting partial state — 07f6378
- [x] 3.6 Anonymous requests to the new route still receive the current unauthorized JSON shape — 07f6378

### Phase 4: Implement deterministic weekly-plan generation with injury-safe substitutions

#### Automated

- [x] 4.1 Astro types refresh successfully after the generator modules are added: `npx astro sync` — cc83120
- [x] 4.2 Lint passes with the new generator and rule modules: `npm run lint` — cc83120
- [x] 4.3 Build passes with deterministic generation and persistence wired into the protected route: `npm run build` — cc83120

#### Manual

- [x] 4.4 Valid authenticated questionnaire submissions persist a real plan and return a success response usable by the dashboard — cc83120
- [x] 4.5 The generated plan contains exactly seven days with visible focus areas and recommended exercises — cc83120
- [x] 4.6 Declaring an injury limitation removes or substitutes exercises that would directly conflict with that body part and injury type/severity — cc83120
- [x] 4.7 Re-submitting the questionnaire replaces the current saved plan instead of creating a broken mixed state — cc83120

### Phase 5: Render the full saved weekly plan and regenerate path on the dashboard

#### Automated

- [x] 5.1 Astro types refresh successfully after the saved-plan presentation components are added: `npx astro sync` — 06882ba
- [x] 5.2 Lint passes with the full plan view and regenerate state logic: `npm run lint` — 06882ba
- [x] 5.3 Build passes with the completed dashboard flow: `npm run build` — 06882ba

#### Manual

- [x] 5.4 A successful first-run submission replaces the questionnaire view with the full saved weekly plan on `/dashboard` — 06882ba
- [x] 5.5 A returning signed-in user sees the saved plan first and can intentionally regenerate it from the same page — 06882ba
- [x] 5.6 The dashboard no longer presents the smoke-test flow as the main user action — 06882ba

### Phase 6: Verify the end-to-end protected flow and repo gates

#### Automated

- [x] 6.1 Astro types refresh successfully on the final integrated slice: `npx astro sync`
- [x] 6.2 Lint passes on the full repo: `npm run lint`
- [x] 6.3 Build passes on the full repo: `npm run build`

#### Manual

- [x] 6.4 A first-time authenticated user can submit climbing grade and injury limitations and immediately see a full 7-day saved plan
- [x] 6.5 A returning authenticated user sees the saved plan first and can regenerate it intentionally
- [x] 6.6 A failed generation attempt keeps the questionnaire values visible and allows retry from the same page
- [x] 6.7 Anonymous `/dashboard` access still redirects to `/auth/signin`
- [x] 6.8 Anonymous requests to the real plan-generation API still return `401` with the current unauthorized JSON shape
