# Minimal Plan Persistence Contract Implementation Plan

## Overview

Establish the smallest real persistence layer that stores questionnaire answers and generated weekly plans for authenticated users. This foundation is meant to unblock the first end-to-end plan flow and the later "return and see my saved plan" slice without forcing plan-generation rules or questionnaire UI into the same change.

## Current State Analysis

The repo already has authenticated user context and protected route enforcement, but it has no application data model for questionnaire inputs or generated plans. Supabase local development is configured with migrations enabled, yet the current project still documents an auth-only setup, so `F-01` has to introduce both the first schema contract and the first app-owned persistence seam.

## Desired End State

After this plan is complete, the application has a relational storage contract for questionnaire answers and weekly plans owned by authenticated users, plus a single server-side module that later slices can call instead of issuing raw table queries from pages or routes. A narrow authenticated smoke path proves that the contract can persist and read back one user's current plan state without needing the full questionnaire UI.

### Key Discoveries:

- Authenticated user context already exists and is loaded into `Astro.locals` in [src/middleware.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/middleware.ts:6).
- The shared Supabase server client already centralizes cookie-backed auth/session handling in [src/lib/supabase.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/lib/supabase.ts:5).
- The current protected page is only a placeholder welcome surface in [src/pages/dashboard.astro](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/pages/dashboard.astro:7).
- Supabase migrations are enabled, but no schema paths or app tables are defined in [supabase/config.toml](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/supabase/config.toml:53).
- The README still claims no tables or migrations are required in [README.md](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/README.md:114).

## What We're NOT Doing

- Building the questionnaire UI or the first user-facing plan form flow
- Designing the plan-generation algorithm or exercise recommendation rules
- Adding plan history, comparison views, or multi-plan version timelines
- Introducing a separate profile domain before the MVP needs it
- Shipping analytics, charts, or any non-MVP reporting on stored plan data

## Implementation Approach

Use the authenticated Supabase user id as the ownership anchor for all persisted rows. Model the persistence contract relationally: one table for the user's latest questionnaire response, one table for the generated weekly plan, and child tables for the seven daily entries and their recommended exercises. Hide all table details behind a central server-side persistence module so `S-02` and `S-03` can call stable create/read/update methods instead of binding directly to SQL shape. Prove the contract with one authenticated smoke route or equivalent server-only seam that writes a minimal example plan and reads it back.

## Critical Implementation Details

### State sequencing

Because the MVP uses "one active latest plan per user" semantics, the persistence layer should update questionnaire state and replace the active plan inside one logical write flow. The contract needs to prevent a user from ending up with a new questionnaire row but a stale active plan, or vice versa.

## Phase 1: Define the relational persistence contract

### Overview

Create the first application-owned Supabase schema for questionnaire inputs and generated weekly plans, keeping the structure relational and explicitly tied to authenticated users.

### Changes Required:

#### 1. Supabase migration set

**File**: `supabase/migrations/<timestamp>_minimal_plan_persistence.sql`

**Intent**: Introduce the minimal relational schema that supports questionnaire answers and a saved weekly plan without overcommitting to later analytics or history features.

**Contract**: Add user-owned tables for questionnaire responses, weekly plans, daily plan entries, and daily recommended exercises. Enforce foreign-key ownership via Supabase auth user ids, keep exactly one active current-plan path per user, and model the canonical MVP inputs as injury limitations and climbing grade.

#### 2. Supabase seed and local schema expectations

**File**: `supabase/config.toml`

**Intent**: Keep the local Supabase configuration aligned with the repo's first real migration-backed data model.

**Contract**: Ensure the migration path remains compatible with the existing local workflow and does not assume schema files outside the migrations flow already enabled in this repo.

#### 3. Project documentation for local development

**File**: `README.md`

**Intent**: Correct the starter documentation now that application tables and migrations are part of the local setup.

**Contract**: Replace the current auth-only claim with the minimum accurate instructions for running migrations and understanding that the app now owns persistence beyond `auth.users`.

### Success Criteria:

#### Automated Verification:

- Migration files exist and are syntactically valid for the Supabase CLI workflow
- Astro types refresh successfully after the persistence contract lands: `npx astro sync`
- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Schema review confirms the tables support one user's latest questionnaire plus one active weekly plan with seven-day child records
- README instructions are accurate for a developer bringing up the local Supabase stack after this change

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Add the server persistence boundary

### Overview

Create one central server-side module that owns the persistence contract for questionnaire answers and weekly plans so later slices do not couple page or route code directly to table structure.

### Changes Required:

#### 1. Persistence module

**File**: `src/lib/plan-persistence.ts`

**Intent**: Encapsulate create, replace, and read access for the current questionnaire-plus-plan state behind one server-side API.

**Contract**: Export typed persistence methods that accept an authenticated user id and the minimal questionnaire/weekly-plan payload, then create or replace the current relational state and return the latest saved plan for that user.

#### 2. Shared plan persistence types

**File**: `src/lib/plan-types.ts`

**Intent**: Give later slices one canonical in-repo shape for the persisted weekly plan contract instead of duplicating payload assumptions in pages or routes.

**Contract**: Define the minimal TypeScript contract for questionnaire inputs, weekly plan days, and recommended exercises that the persistence module reads and writes.

#### 3. Supabase client integration point

**File**: `src/lib/supabase.ts`

**Intent**: Reuse the existing authenticated server client pattern instead of introducing a second way to talk to Supabase from server code.

**Contract**: Keep `createClient` as the single server entry point for authenticated Supabase access; only extend it if the persistence module needs a helper that is broadly reusable rather than plan-specific.

### Success Criteria:

#### Automated Verification:

- The persistence module type-checks cleanly through `npx astro sync` and `npm run build`
- Lint passes with the new server module and types: `npm run lint`

#### Manual Verification:

- The persistence API is narrow enough that `S-02` can call it without knowing table names or join structure
- The ownership contract is clear: every persistence method requires authenticated user context and never exposes cross-user reads

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Prove the contract with one authenticated smoke path

### Overview

Add one narrow authenticated server-side proof path that exercises save and read operations for the new contract without expanding into the full questionnaire UI.

### Changes Required:

#### 1. Authenticated smoke route

**File**: `src/pages/api/plans/smoke.ts`

**Intent**: Provide one intentionally minimal server-only seam that proves the new persistence module works for an authenticated user.

**Contract**: Require authenticated user context, write a minimal questionnaire plus weekly-plan payload through `src/lib/plan-persistence.ts`, then read back the latest saved plan and return a machine-checkable success response.

#### 2. Protected-route alignment

**File**: `src/middleware.ts`

**Intent**: Keep the smoke path behind the same auth boundary expectations as the rest of the protected planning flow.

**Contract**: Enforce that the new proof seam is accessible only with authenticated user context, whether by explicit route protection or route-local auth rejection that matches existing signin redirects / unauthorized behavior patterns.

#### 3. Placeholder protected surface for manual smoke use

**File**: `src/pages/dashboard.astro`

**Intent**: Reuse the existing protected page as the manual entry point for exercising or linking to the smoke path, rather than creating a new feature page that overlaps `S-02`.

**Contract**: Keep the dashboard as a protected placeholder, but make it sufficient for a human to verify that authenticated persistence can be invoked and its result observed during manual testing.

### Success Criteria:

#### Automated Verification:

- The smoke path builds and type-checks with the new persistence module: `npx astro sync`
- Lint passes after the smoke path is added: `npm run lint`
- Production build passes with the new persistence surface: `npm run build`

#### Manual Verification:

- An authenticated user can trigger the smoke path and receive confirmation that questionnaire and weekly-plan state were saved and read back successfully
- The smoke path is not available to unauthenticated requests
- The protected placeholder surface remains coherent and clearly tied to authenticated plan persistence, not the full questionnaire experience

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

## Testing Strategy

### Unit Tests:

- Validate any pure transformation helpers that map relational rows into the canonical persisted plan shape
- Validate replacement semantics for "latest active plan" logic if implemented with separate helper functions

### Integration Tests:

- Authenticated persistence smoke path writes questionnaire and plan state for the current user
- Read-after-write returns the latest active plan with seven daily entries and exercise children
- Unauthenticated access to the smoke path is rejected

### Manual Testing Steps:

1. Start the local Supabase stack and apply migrations.
2. Sign in through the existing auth flow.
3. Trigger the protected smoke path from the dashboard or direct authenticated request.
4. Confirm the response shows a successful write and read for the current user's plan state.
5. Sign out and confirm the smoke path is no longer usable without authentication.

## Performance Considerations

This slice does not need query optimization beyond keeping the "current plan for one user" read simple and indexed by user ownership plus active-plan lookup. Avoid adding generalized reporting or history queries; they are outside the MVP contract.

## Migration Notes

This is the repo's first application-owned database contract, so rollout and rollback both need to be conservative. Prefer additive migrations only, and treat any future schema reshaping as follow-on work after `S-02` proves the persisted payload format.

## References

- Product requirements: `context/foundation/prd.md`
- Roadmap handoff: `context/foundation/roadmap.md`
- Supabase client pattern: [src/lib/supabase.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/lib/supabase.ts:5)
- Authenticated user loading: [src/middleware.ts](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/middleware.ts:6)
- Current protected placeholder page: [src/pages/dashboard.astro](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/src/pages/dashboard.astro:7)
- Local migration baseline: [supabase/config.toml](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/supabase/config.toml:53)
- README setup claim to replace: [README.md](/Users/marcin.kida/Downloads/10xDEVS/prep-to-climb/README.md:114)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Define the relational persistence contract

#### Automated

- [x] 1.1 Migration files exist and are syntactically valid for the Supabase CLI workflow — 418036d
- [x] 1.2 Astro types refresh successfully after the persistence contract lands — 418036d
- [x] 1.3 Lint passes — 418036d
- [x] 1.4 Build passes — 418036d

#### Manual

- [x] 1.5 Schema review confirms the tables support one user's latest questionnaire plus one active weekly plan with seven-day child records — 418036d
- [x] 1.6 README instructions are accurate for a developer bringing up the local Supabase stack after this change — 418036d

### Phase 2: Add the server persistence boundary

#### Automated

- [x] 2.1 The persistence module type-checks cleanly through Astro sync and build
- [x] 2.2 Lint passes with the new server module and types

#### Manual

- [x] 2.3 The persistence API is narrow enough that S-02 can call it without knowing table names or join structure
- [x] 2.4 The ownership contract is clear: every persistence method requires authenticated user context and never exposes cross-user reads

### Phase 3: Prove the contract with one authenticated smoke path

#### Automated

- [ ] 3.1 The smoke path builds and type-checks with the new persistence module
- [ ] 3.2 Lint passes after the smoke path is added
- [ ] 3.3 Production build passes with the new persistence surface

#### Manual

- [ ] 3.4 An authenticated user can trigger the smoke path and receive confirmation that questionnaire and weekly-plan state were saved and read back successfully
- [ ] 3.5 The smoke path is not available to unauthenticated requests
- [ ] 3.6 The protected placeholder surface remains coherent and clearly tied to authenticated plan persistence, not the full questionnaire experience
