# Minimal Plan Persistence Contract — Plan Brief

> Full plan: `context/changes/minimal-plan-persistence-contract/plan.md`

## What & Why

This change establishes the first real persistence layer for PrepToClimb's MVP. The goal is to make questionnaire answers and generated weekly plans durable for authenticated users so later slices can deliver a real "generate now, come back later, still see it" experience instead of an ephemeral demo flow.

## Starting Point

The repo already has Supabase-backed auth, a server client, and protected routing, but no application tables or persistence contract beyond `auth.users`. The current protected page is still a placeholder, and the README still documents the project as auth-only from a data perspective.

## Desired End State

When this plan is done, the app has a relational schema for questionnaire answers and weekly plans, all owned by authenticated users. Later feature slices can call one central server persistence module to save and read the current plan state, and one narrow authenticated smoke path proves the contract works before the full questionnaire UI lands.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Persistence scope | Store questionnaire answers and generated weekly plan | `S-02` and `S-03` both need durable inputs and outputs, not just one side of the flow | Plan |
| Plan model | Fully relational plan schema | You explicitly chose structure that can grow cleanly without relying on a JSON payload | Plan |
| User ownership | Rows belong directly to Supabase auth user ids | This matches the existing auth model and keeps cross-user access rules simple | Plan |
| Current-state semantics | One active latest plan per user | MVP needs returnability, not history/versioning yet | Plan |
| Server boundary | Central persistence module in app code | Later slices should not know table names or query joins | Plan |
| Proof strategy | One authenticated smoke path | This validates the foundation without pulling `S-02` UI into `F-01` | Plan |
| Canonical questionnaire fields | Injury limitations and climbing grade | This matches the narrowed PRD requirements and avoids the older strength-focused wording drift | Research |

## Scope

**In scope:**
- Relational Supabase schema for questionnaire and weekly-plan persistence
- Direct ownership by authenticated users
- Central server-side persistence module
- One authenticated save/read smoke path
- README updates for the new local data setup

**Out of scope:**
- Questionnaire UI
- Plan-generation rules
- Multi-plan history
- Analytics and reporting
- Rich dashboard or return-flow product experience

## Architecture / Approach

Supabase remains the system of record. New relational tables store questionnaire state, weekly plans, daily plan entries, and recommended exercises under authenticated user ownership. Application code talks to those tables only through a server-side persistence module, and a narrow authenticated proof seam exercises write-plus-read behavior before the product flow is built on top.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Define the relational persistence contract | First app-owned schema and migration set | Overbuilding the schema before the first real plan flow exists |
| 2. Add the server persistence boundary | Stable create/read/update seam for later slices | Leaking table details into page or route code anyway |
| 3. Prove the contract with one authenticated smoke path | Real save/read validation under auth | Accidentally expanding the slice into questionnaire UI work |

**Prerequisites:** Existing Supabase auth setup remains functional; local Supabase stack is available when validation starts  
**Estimated effort:** ~2-3 sessions across 3 phases

## Open Risks & Assumptions

- The first relational model has to stay MVP-thin; adding history or analytics fields early would distort the slice.
- The smoke path should remain obviously temporary/foundational so it does not become the accidental public API contract for later product work.
- README and local setup instructions must be updated in the same change or the first persistence migration will be easy to misapply.

## Success Criteria (Summary)

- Authenticated users have durable questionnaire and weekly-plan storage owned by their Supabase user id.
- Later slices can save and read current plan state through one central server module instead of raw table access.
- One authenticated proof path confirms save-plus-read behavior works before the full questionnaire experience is built.
