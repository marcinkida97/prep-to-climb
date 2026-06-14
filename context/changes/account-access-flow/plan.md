# Account Access Flow Implementation Plan

## Overview

Finalize the existing Supabase-backed auth scaffold so a user can create an account, confirm it when required, sign in, sign out, and reliably arrive at the protected planning entry point. This slice is about making account access feel like part of PrepToClimb rather than a generic starter flow.

## Current State Analysis

The repo already has sign-up, sign-in, sign-out, protected-route enforcement, and a protected dashboard placeholder. The missing piece is flow cohesion: successful sign-in still sends users back to the generic public home page, the protected entry page still presents `F-01` smoke-test language, and the home page still markets the starter rather than the climbing product.

## Desired End State

An unauthenticated visitor can move through PrepToClimb-branded sign-up and sign-in screens, and a successful sign-in lands them on the protected dashboard as the temporary planning entry. Sign-out returns them to a coherent public entry surface, while protected-route guards still block anonymous access to planning pages and APIs.

### Key Discoveries:

- Successful sign-in currently redirects to `/` instead of the protected entry point in [src/pages/api/auth/signin.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/pages/api/auth/signin.ts:19).
- Protected-route enforcement already exists and is limited to `/dashboard` and `/api/plans` in [src/middleware.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/middleware.ts:4).
- The current protected page is still framed around the temporary persistence smoke test in [src/pages/dashboard.astro](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/pages/dashboard.astro:20).
- The public landing page still presents generic starter branding and auth CTAs in [src/components/Welcome.astro](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/components/Welcome.astro:31).
- Sign-up already branches between dev auto-confirm and production email-confirm states in [src/pages/auth/confirm-email.astro](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/pages/auth/confirm-email.astro:5).

## What We're NOT Doing

- Building the questionnaire or weekly-plan generation flow from `S-02`
- Renaming `/dashboard` to a new product route in this slice
- Introducing a new automated auth test harness
- Changing Supabase confirmation rules or replacing the existing confirm-email flow
- Reworking the entire landing page visual design or marketing structure

## Implementation Approach

Keep the existing auth architecture and protected-route list intact, then tighten the user journey around it. Route successful sign-in straight to `/dashboard`, keep sign-up on the confirm-email branch with clearer product messaging, reframe the dashboard as the temporary planning entry, and minimally clean up the public landing page so its auth affordances and copy match PrepToClimb instead of the starter template.

## Critical Implementation Details

### Timing & lifecycle

Keep the current production-safe sign-up behavior: account creation still lands on `/auth/confirm-email`, and only the copy changes. Do not couple this slice to any assumption that new users are auto-confirmed outside development mode.

## Phase 1: Align auth route behavior with the protected planning entry

### Overview

Update the server-side auth routes so successful account access behavior matches the intended `S-01` outcome instead of the starter default.

### Changes Required:

#### 1. Sign-in route completion behavior

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Route authenticated users into the protected planning entry immediately after a successful sign-in.

**Contract**: Preserve the current form POST contract and error redirect behavior, but change the success redirect target from `/` to `/dashboard`.

#### 2. Sign-up completion behavior

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Keep the current confirmation-based sign-up path stable while making sure this slice does not accidentally broaden auth behavior.

**Contract**: Continue redirecting successful sign-up to `/auth/confirm-email`; only touch this file if needed to keep the flow contract explicit and aligned with the updated account-access messaging.

#### 3. Sign-out return behavior

**File**: `src/pages/api/auth/signout.ts`

**Intent**: Keep sign-out predictable after the protected dashboard becomes the temporary planning entry.

**Contract**: Preserve POST-based sign-out and redirect users back to the public entry surface after session teardown.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes after sync: `npx astro sync && npm run build`

#### Manual Verification:

- Successful sign-in from `/auth/signin` lands on `/dashboard`
- Successful sign-out from the protected surface returns the user to the public entry surface

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Reframe the protected and public auth surfaces around PrepToClimb

### Overview

Keep `/dashboard` as the temporary protected entry point, but update the surrounding UI and copy so users understand it as the signed-in starting point for planning rather than a technical placeholder.

### Changes Required:

#### 1. Protected dashboard positioning

**File**: `src/pages/dashboard.astro`

**Intent**: Reframe the current protected page as the signed-in entry to the planning experience while keeping it intentionally thin until `S-02`.

**Contract**: Keep `/dashboard` protected and user-specific, replace or subordinate `F-01` smoke-test framing with product-facing copy that explains this is the current signed-in planning entry, and render the shared signed-in navigation so dashboard navigation cues come from the same component used on the public entry surface.

#### 2. Shared signed-in navigation cues

**File**: `src/components/Topbar.astro`

**Intent**: Make the shared signed-in navigation consistent with the updated protected entry and public auth flow.

**Contract**: Preserve the existing signed-in vs signed-out branch structure while ensuring labels and links reinforce `/dashboard` as the current authenticated destination once `Topbar` is rendered on the protected dashboard.

#### 3. Public landing page cleanup

**Files**: `src/components/Welcome.astro`, `src/layouts/Layout.astro`

**Intent**: Remove the most obvious starter-template mismatch from the public landing page without turning this slice into a full redesign.

**Contract**: Keep the current page structure and CTA placement, but update auth-related copy, hero messaging, obvious product naming, feature-card copy, and the default page title so the page points users toward PrepToClimb account access instead of marketing the generic starter.

#### 4. Confirmation messaging

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: Keep the confirm-email step intact while making its message clearly about unlocking the planning flow.

**Contract**: Preserve the current dev vs non-dev state split, but adjust headings, body copy, and link language so the page explains email confirmation as the final step before sign-in to the protected planning area.

#### 5. Sign-in and sign-up screen framing

**Files**: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`

**Intent**: Make the primary auth-entry screens feel like part of PrepToClimb instead of generic starter pages.

**Contract**: Preserve the existing form structure and route contracts, but update headings and supporting copy so both pages clearly frame account access around the climbing-planning product.

### Success Criteria:

#### Automated Verification:

- Lint passes after UI copy updates: `npm run lint`
- Build passes with updated auth and page copy: `npx astro sync && npm run build`

#### Manual Verification:

- `/dashboard` reads as the signed-in starting point for planning rather than a technical smoke-test page
- The public landing page hero, feature-card copy, and default page title present PrepToClimb rather than the generic starter
- The confirm-email page clearly explains what the user should do next after sign-up
- The sign-in and sign-up screens read as PrepToClimb account-entry pages rather than generic starter auth screens

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Verify the end-to-end account access journey and guardrails

### Overview

Validate that the polished flow still satisfies the real account-access outcome: sign up, sign in, protected access, redirect behavior, and sign out.

### Changes Required:

#### 1. End-to-end auth flow verification

**File**: `context/changes/account-access-flow/plan.md`

**Intent**: Lock the slice to the concrete verification path the user approved instead of leaving “done” ambiguous.

**Contract**: Execute and confirm the agreed verification scope: lint, build, and a manual smoke pass covering sign-up, sign-in, redirect to `/dashboard`, protected-route guard behavior, and sign-out.

#### 2. Protected-route guard confirmation

**File**: `src/middleware.ts`

**Intent**: Re-check that the updated flow still depends on the existing guard contract instead of silently bypassing it.

**Contract**: Keep `/dashboard` and `/api/plans` under the current guard model unless a narrowly scoped update is required to preserve the intended anonymous redirect or API unauthorized behavior, and capture the verified anonymous API response in a change-scoped verification note.

### Success Criteria:

#### Automated Verification:

- Astro types are refreshed successfully: `npx astro sync`
- Lint passes on the full repo: `npm run lint`
- Build passes on the full repo: `npm run build`

#### Manual Verification:

- New-user sign-up reaches the confirm-email screen with product-oriented next-step messaging
- Anonymous access to `/dashboard` redirects to `/auth/signin`
- Anonymous `POST /api/plans/smoke` returns `401` with the current unauthorized JSON shape
- Signed-in access reaches `/dashboard` after login and remains usable until sign-out
- Sign-out removes access to the protected dashboard until the user signs in again

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

## Testing Strategy

### Unit Tests:

- No new automated test harness is introduced in this slice
- Rely on existing static validation gates for code safety

### Integration Tests:

- Use the real browser-backed auth flow against the existing Supabase configuration
- Verify redirect and protected-route behavior through actual route transitions rather than isolated handler assumptions

### Manual Testing Steps:

1. Start the app with valid Supabase configuration and refresh Astro types.
2. Visit the public landing page and confirm the auth CTAs, hero copy, and product framing read as PrepToClimb rather than the starter template.
3. Confirm the browser page title and feature-card copy no longer market the generic starter.
4. Create a new account and confirm the next-step messaging on `/auth/confirm-email`.
5. Sign in with a valid account and confirm the app redirects to `/dashboard`.
6. Visit `/dashboard` while signed out and confirm redirection to `/auth/signin`.
7. Submit or replay an anonymous `POST /api/plans/smoke` request and confirm it returns `401` with the expected unauthorized JSON response; record the request and response in `context/changes/account-access-flow/verification.md`.
8. Sign out from the protected surface and confirm access to `/dashboard` is blocked again.

## Performance Considerations

This slice should not materially change runtime cost or latency. The only behavioral change on the hot path is the sign-in redirect target and copy-level UI updates.

## Migration Notes

No schema or data migration is required. This slice stays within the existing auth and page-routing surface.

## References

- Roadmap slice: `context/foundation/roadmap.md`
- Product requirements: `context/foundation/prd.md`
- Sign-in success redirect: [src/pages/api/auth/signin.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/pages/api/auth/signin.ts:19)
- Protected route list: [src/middleware.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/middleware.ts:4)
- Protected entry page: [src/pages/dashboard.astro](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/pages/dashboard.astro:7)
- Public landing page: [src/components/Welcome.astro](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/components/Welcome.astro:31)
- Confirmation screen branch: [src/pages/auth/confirm-email.astro](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/pages/auth/confirm-email.astro:5)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Align auth route behavior with the protected planning entry

#### Automated

- [x] 1.1 Lint passes: `npm run lint` — 381b2c6
- [x] 1.2 Build passes after sync: `npx astro sync && npm run build` — 381b2c6

#### Manual

- [x] 1.3 Successful sign-in from `/auth/signin` lands on `/dashboard` — 381b2c6
- [x] 1.4 Successful sign-out from the protected surface returns the user to the public entry surface — 381b2c6

### Phase 2: Reframe the protected and public auth surfaces around PrepToClimb

#### Automated

- [x] 2.1 Lint passes after UI copy updates: `npm run lint` — cbbd1a0
- [x] 2.2 Build passes with updated auth and page copy: `npx astro sync && npm run build` — cbbd1a0

#### Manual

- [x] 2.3 `/dashboard` reads as the signed-in starting point for planning rather than a technical smoke-test page — cbbd1a0
- [x] 2.4 The public landing page hero, feature-card copy, and default page title present PrepToClimb rather than the generic starter — cbbd1a0
- [x] 2.5 The confirm-email page clearly explains what the user should do next after sign-up — cbbd1a0
- [x] 2.6 The sign-in and sign-up screens read as PrepToClimb account-entry pages rather than generic starter auth screens — cbbd1a0

### Phase 3: Verify the end-to-end account access journey and guardrails

#### Automated

- [x] 3.1 Astro types are refreshed successfully: `npx astro sync`
- [x] 3.2 Lint passes on the full repo: `npm run lint`
- [x] 3.3 Build passes on the full repo: `npm run build`

#### Manual

- [x] 3.4 New-user sign-up reaches the confirm-email screen with product-oriented next-step messaging
- [x] 3.5 Anonymous access to `/dashboard` redirects to `/auth/signin`
- [x] 3.6 Anonymous `POST /api/plans/smoke` returns `401` with the current unauthorized JSON shape
- [x] 3.7 Signed-in access reaches `/dashboard` after login and remains usable until sign-out
- [x] 3.8 Sign-out removes access to the protected dashboard until the user signs in again
