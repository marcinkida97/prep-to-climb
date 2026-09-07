---
project: PrepToClimb
version: 1
status: draft
created: 2026-05-31
updated: 2026-09-07
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: PrepToClimb

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

PrepToClimb is meant to help intermediate climbers stop guessing what to train next by turning a short input flow into a usable weekly plan. The core product promise is not generic training content, but a plan that adapts to the user's current climbing grade and declared injury-related limitations. For this roadmap, the product hypothesis means the main claim that must prove true early: users will find a simple personalized weekly plan more useful than a generic climbing template.

## North star

**S-02: User completes the questionnaire and sees a weekly plan** — this is the validation milestone, meaning the smallest end-to-end slice whose success proves the core product hypothesis, and it is placed as early as its prerequisites allow because the rest of the roadmap matters only if this flow works.

> Here, "north star" means the first end-to-end slice that proves the product works, not a long-term KPI or branding slogan.

## At a glance

| ID | Change ID | Outcome (user can ...) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | minimal-plan-persistence-contract | (foundation) minimal persistence exists for questionnaire answers and generated weekly plans | — | FR-009, NFR persistence, Access Control | ready |
| S-01 | account-access-flow | create an account, sign in, and sign out to reach the protected planning flow | — | FR-001, FR-002, FR-003, Access Control | done |
| S-02 | first-weekly-plan-flow | complete the questionnaire and immediately see a weekly plan with recommended exercises | F-01, S-01 | US-01, FR-004, FR-005, FR-006, FR-007, FR-008 | done |
| S-03 | persisted-plan-return-flow | sign back in later and see the saved weekly plan across sessions | F-01, S-02 | US-01, FR-009 | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Plan generation path | `F-01` → `S-02` → `S-03` | This is the must-have path for a speed-biased MVP and carries the product validation flow. |
| B | Account access | `S-01` | Standalone auth access slice that must land before `S-02` can be used by a real signed-in user. |

## Baseline

What's already in place in the codebase as of 2026-05-31 (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 with React islands is already wired in `astro.config.mjs` and `package.json`.
- **Backend / API:** present — auth server routes exist in `src/pages/api/auth/`.
- **Data:** partial — Supabase server client exists in `src/lib/supabase.ts`, but there is no app-level schema or migration set for questionnaire and plan data.
- **Auth:** present — sign up, sign in, sign out, and route protection exist in `src/pages/api/auth/` and `src/middleware.ts`.
- **Deploy / infra:** present — Cloudflare Workers adapter, Wrangler config, and CI are already configured in `astro.config.mjs`, `wrangler.jsonc`, and `.github/workflows/ci.yml`.
- **Observability:** partial — platform observability is enabled in `wrangler.jsonc`, but there is no app-level tracking around plan generation or persistence.

## Foundations

### F-01: Minimal plan persistence contract

- **Outcome:** (foundation) minimal persistence exists for questionnaire answers and generated weekly plans so later slices can save and reload real user data.
- **Change ID:** minimal-plan-persistence-contract
- **PRD refs:** FR-009, Non-Functional Requirements on persistence across sessions, Access Control
- **Unlocks:** S-02, S-03
- **Prerequisites:** —
- **Parallel with:** S-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** If this stays implicit inside the first plan slice, the MVP can generate a plan that disappears after logout and misses the persistence promise.
- **Status:** ready

## Slices

### S-01: Account access flow

- **Outcome:** user can create an account, sign in, and sign out to reach the protected planning flow.
- **Change ID:** account-access-flow
- **PRD refs:** FR-001, FR-002, FR-003, Access Control
- **Prerequisites:** —
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is already largely scaffolded, so taking it first is the fastest way to confirm the auth baseline and avoid reworking the main flow around anonymous users.
- **Status:** done

### S-02: First weekly plan flow

- **Outcome:** user can complete the questionnaire and immediately see a weekly plan with recommended exercises.
- **Change ID:** first-weekly-plan-flow
- **PRD refs:** US-01, FR-004, FR-005, FR-006, FR-007, FR-008, Non-Functional Requirements on under-2-minute flow and safe injury-aware recommendations
- **Prerequisites:** F-01, S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Should the success criteria wording be updated to reference injury limitations and climbing grade instead of body-part strengthening focus and finger strength? — Owner: user. Block: no.
- **Risk:** This is the core validation slice, but sequencing it after auth access and minimal persistence keeps the flow real without expanding into long-term plan logic.
- **Status:** done

### S-03: Persisted return flow

- **Outcome:** user can sign back in later and see the saved weekly plan across sessions.
- **Change ID:** persisted-plan-return-flow
- **PRD refs:** US-01, FR-009, Non-Functional Requirements on account data and generated plan data remaining available across sessions
- **Prerequisites:** F-01, S-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Leaving persistence validation until after the first plan display keeps the MVP thin, but it still has to land before the roadmap can claim the product survives real repeat use.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| F-01 | minimal-plan-persistence-contract | Establish minimal persistence for questionnaire answers and generated plans | yes | Smallest missing contract before the full plan flow can be implemented cleanly. |
| S-01 | account-access-flow | Finalize account sign-up, sign-in, and sign-out flow for protected planning | yes | Auth scaffold already exists; this is a fast validation and integration pass. |
| S-02 | first-weekly-plan-flow | Deliver the first end-to-end weekly plan generation flow | no | Depends on `F-01` and `S-01`. |
| S-03 | persisted-plan-return-flow | Show the saved weekly plan after later sign-in | no | Depends on `F-01` and `S-02`. |

## Open Roadmap Questions

1. **What should `target_scale.qps` be for this product?** — Owner: user. Block: roadmap-wide.
2. **What should `target_scale.data_volume` be for this product?** — Owner: user. Block: roadmap-wide.
3. **What is the primary persona's name?** — Owner: user. Block: roadmap-wide.
4. **Should the MVP success criteria reference injury limitations and current climbing grade instead of body-part strengthening focus and current finger strength?** — Owner: user. Block: roadmap-wide.

## Parked

- **Long-term multi-week training cycles** — Why parked: PRD Non-Goals says the short-plan MVP should prove value first.
- **Progress analytics or charts** — Why parked: PRD Non-Goals defers analytics until after the core plan flow is proven.
- **Social features** — Why parked: PRD Non-Goals excludes them from MVP validation of the core workflow.
- **External fitness app integrations** — Why parked: PRD Non-Goals says they expand scope before the core workflow is validated.
- **Dedicated mobile app** — Why parked: PRD Non-Goals keeps MVP browser-based only.
- **Advanced exercise video library** — Why parked: PRD Non-Goals defers rich media until after plan recommendation exists.

## Done

- **S-01: create an account, sign in, and sign out to reach the protected planning flow** — Archived 2026-09-07 → `context/archive/2026-06-14-account-access-flow/`. Lesson: —.
- **S-02: complete the questionnaire and immediately see a weekly plan with recommended exercises** — Archived 2026-09-07 → `context/archive/2026-06-14-first-weekly-plan-flow/`. Lesson: —.

