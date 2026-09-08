---
project: PrepToClimb
version: 1
status: active
created: 2026-05-31
updated: 2026-09-08
prd_version: 1
main_goal: quality
top_blocker: none
milestone_id: richer-plans-and-account-control
milestone_seq: 2
milestone_status: open
---

# Roadmap: PrepToClimb

> Derived from the user's own milestone description (2026-09-07) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-02: Richer plans and account control** — Status: open

- **Intent:** Extend PrepToClimb beyond the validated MVP with a genuinely personalized, safety-aware plan-generation engine, the account-lifecycle controls (password change, account deletion) and plan-lifecycle control (delete + re-onboard) a real product needs, a multi-step questionnaire that scales to the richer input set, and a climbing-appropriate, mobile-correct visual identity.
- **Source materials:** user description (2026-09-07), distilled into the scope anchors below. Two anchors (MS-05, MS-06) were already researched and planned prior to this roadmap as change-id `plan-generation-strategy`.
- **Done when:** every S-NN below is `done`.
- **Scope anchors:**
  - MS-01: User can manage their account from a settings page — change password and delete the account.
  - MS-02: User can delete their generated weekly plan; after deletion they are asked again to select grade and injuries.
  - MS-03: Visual design uses colors related to climbing/rock/nature; the app scales correctly on mobile browsers.
  - MS-04: Plan generation becomes a multi-step flow — a grade step, then an injuries step using a searchable, multi-select control.
  - MS-05: Research common climbing injuries and extend/improve the injury list. *(covered by `plan-generation-strategy`)*
  - MS-06: Research climbing training methodology to determine the plan-generation architecture (rule-based vs. AI vs. hybrid), what additional questionnaire inputs improve personalization, and whether an exercise database is warranted. *(covered by `plan-generation-strategy`)*

## Vision recap

PrepToClimb turns a short input flow into a usable weekly climbing-training plan. Where the MVP (M-01) validated that a simple grade+injury questionnaire could produce a plan users would use, this milestone makes that plan genuinely trustworthy (safety-aware, personalized to training age/equipment/goal) and turns the surrounding product into something a returning user can actually manage day to day — their account, their plan, and an interface that scales on the mobile browsers most climbers will actually use.

## North star

**S-01: `plan-generation-strategy` — user receives a plan personalized to training age, equipment, goal, and sessions/week, with safe handling of acute vs. chronic injuries** — this is the validation milestone (the smallest end-to-end slice that, if it lands well, proves the rest of this batch of work was worth doing), already fully researched and planned, and it is the substantive product upgrade the other slices either expose (the wizard) or sit independently alongside (settings, deletion, redesign).

## At a glance

| ID | Change ID | Outcome (user can ...) | Prerequisites | Scope anchors | Status |
|---|---|---|---|---|---|
| S-01 | plan-generation-strategy | receive a weekly plan personalized by training age, sessions/week, equipment, and goal, with safe acute/chronic injury handling | — | MS-05, MS-06 | done |
| S-02 | questionnaire-wizard-flow | complete the questionnaire through a multi-step flow with a searchable, multi-select injuries step | S-01 | MS-04 | done |
| S-03 | account-settings | change their password or delete their account from a settings page | — | MS-01 | done |
| S-04 | plan-deletion-flow | delete their generated weekly plan and be returned to grade/injury selection | — | MS-02 | done |
| S-05 | climbing-theme-mobile-redesign | use the app on a climbing/rock/nature-themed, correctly-scaled mobile interface | — | MS-03 | ready |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Plan generation & its UI | `S-01` → `S-02` | The north star and the interface that exposes it; S-02 cannot start until S-01's field/injury-status shape lands. |
| B | Account lifecycle | `S-03` | Standalone — no dependency on plan generation or the wizard. |
| C | Plan lifecycle | `S-04` | Standalone — schema-orthogonal to S-01's changes (only touches `weekly_plans`/`plan_days`, which S-01 doesn't alter). |
| D | Visual identity | `S-05` | Standalone, but shares `QuestionnaireForm.tsx` with S-02 — coordinate or sequence to avoid overlapping edits. |

## Baseline

What's already in place in the codebase as of 2026-09-07 (auto-researched from M-01's shipped work + this session's direct reads).
Slices below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React islands wired; `QuestionnaireForm.tsx`, `DashboardPlanShell.tsx`, `WeeklyPlanView.tsx` already exist as the surfaces S-02/S-05 extend.
- **Backend / API:** present — `src/pages/api/{auth,plans}/` routes exist; no admin (service-role) route exists yet, needed only by S-03 (account deletion) and scoped to that slice, not promoted to a shared foundation.
- **Data:** present — `questionnaire_responses`, `weekly_plans`, `plan_days`, `recommended_exercises` schema shipped in M-01; S-01 (`plan-generation-strategy`) extends this with `exercise_library` and new `questionnaire_responses` columns; already planned in detail.
- **Auth:** present — sign up/in/out, route protection, and now a linked remote Supabase project with migrations applied.
- **Deploy / infra:** present — Cloudflare Workers adapter, Wrangler config, CI unchanged since M-01.
- **Observability:** partial — no app-level tracking around plan generation or persistence errors (unchanged since M-01; not addressed by this milestone).

## Foundations

None for this milestone. Every capability the five slices need either already exists (per Baseline)
or is small enough to scope inside the one slice that consumes it — e.g., S-03's Supabase
service-role admin call is used only by account deletion, so it lives inside that slice rather than
being split into a shared foundation (per the Foundation scope cap: a foundation must unlock more
than one downstream slice or it's over-engineering).

## Slices

### S-01: Smarter, safer plan generation

- **Outcome:** user receives a weekly plan personalized by training age, sessions/week, equipment, and goal, with safe acute/chronic injury handling — not just grade and a flat injury list.
- **Change ID:** plan-generation-strategy
- **Scope anchors:** MS-05, MS-06
- **Prerequisites:** —
- **Parallel with:** S-03, S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Already fully researched and planned (`context/changes/plan-generation-strategy/`); remaining risk is execution — a 5-phase schema migration + assembler rewrite — not decision risk.
- **Status:** done

### S-02: Multi-step questionnaire wizard

- **Outcome:** user completes the questionnaire through a multi-step flow (grade step, then an injuries step with a searchable, multi-select control) instead of one long single-page form.
- **Change ID:** questionnaire-wizard-flow
- **Scope anchors:** MS-04
- **Prerequisites:** S-01 (the wizard's injury step and any new steps must reflect S-01's final field list and per-injury acute/chronic status, not the current two-field shape)
- **Parallel with:** S-03, S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Building this before S-01 ships means redesigning it again once S-01's field list lands — sequencing after S-01 avoids that rework.
- **Status:** done

### S-03: Account settings — password change and account deletion

- **Outcome:** user can change their password and delete their account from a settings page.
- **Change ID:** account-settings
- **Scope anchors:** MS-01
- **Prerequisites:** —
- **Parallel with:** S-02, S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Self-service account deletion needs a Supabase service-role admin call that doesn't exist in the codebase yet; scoped inside this slice rather than split into a shared foundation, since no other slice consumes it.
- **Status:** done

### S-04: Delete the generated plan and re-onboard

- **Outcome:** user can delete their generated weekly plan; once deleted, they are asked again to select grade and injuries.
- **Change ID:** plan-deletion-flow
- **Scope anchors:** MS-02
- **Prerequisites:** —
- **Parallel with:** S-02, S-03, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Schema-orthogonal to S-01 (only touches `weekly_plans`/`plan_days`, which S-01 doesn't alter) — safe to build in any order relative to it. Main risk is which questionnaire UI it re-prompts into (today's single page, or S-02's wizard, depending on build order).
- **Status:** done

### S-05: Climbing-themed, mobile-correct visual design

- **Outcome:** user sees a visual design that reads as climbing/rock/nature-specific rather than generic, and the app scales correctly on mobile browsers.
- **Change ID:** climbing-theme-mobile-redesign
- **Scope anchors:** MS-03
- **Prerequisites:** —
- **Parallel with:** S-02, S-03, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** No hard dependency on the other slices, but shares `QuestionnaireForm.tsx` with S-02 — building both at the same time risks overlapping edits to the same component; sequence or coordinate closely if they overlap in time.
- **Status:** ready

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| S-01 | plan-generation-strategy | Ship the tagged-exercise-library plan generator | no | Already planned — run `/10x-implement plan-generation-strategy phase 1` instead. |
| S-02 | questionnaire-wizard-flow | Turn the questionnaire into a multi-step wizard with searchable injury multi-select | no | Blocked on S-01 landing (needs its final field/injury-status shape). |
| S-03 | account-settings | Add an account settings page (change password, delete account) | yes | Run `/10x-new account-settings` then `/10x-plan account-settings`. |
| S-04 | plan-deletion-flow | Let users delete their generated plan and re-answer the questionnaire | yes | Run `/10x-new plan-deletion-flow` then `/10x-plan plan-deletion-flow`. |
| S-05 | climbing-theme-mobile-redesign | Redesign visual identity around climbing/rock/nature themes; fix mobile scaling | yes | Run `/10x-new climbing-theme-mobile-redesign` then `/10x-plan climbing-theme-mobile-redesign`. |

## Open Roadmap Questions

None — the architecture, injury-taxonomy, and gating decisions this milestone depends on were already resolved during `plan-generation-strategy`'s research and planning.

## Parked

- **AI-assisted exercise-selection layer** — Why parked: `plan-generation-strategy`'s research found unconstrained LLM exercise recommendation unsafe in a majority of studied cases; the exercise-library schema is tagged to support this later without a migration, but it isn't built now.
- **Admin UI for managing the exercise library** — Why parked: content is migration-seeded only for this milestone; no user-facing or internal management UI yet.
- **Multi-week periodization / training-cycle tracking** — Why parked: carried from the original PRD's Non-Goals (no long-term multi-week cycles); the `modality` tag added in S-01 only keeps this from being precluded later.

## Milestone History

- **M-01: First usable weekly plan flow** (`first-usable-weekly-plan`) — closed 2026-09-07. Delivered minimal persistence (F-01), account access (S-01), the first end-to-end questionnaire → weekly-plan flow (S-02), and persisted-plan return across sessions (S-03) — the MVP that validated the core product hypothesis.

## Done

- **S-01: create an account, sign in, and sign out to reach the protected planning flow** — Archived 2026-09-07 → `context/archive/2026-06-14-account-access-flow/`. Lesson: —.
- **S-02: complete the questionnaire and immediately see a weekly plan with recommended exercises** — Archived 2026-09-07 → `context/archive/2026-06-14-first-weekly-plan-flow/`. Lesson: —.
- **F-01: (foundation) minimal persistence exists for questionnaire answers and generated weekly plans so later slices can save and reload real user data.** — Archived 2026-09-07 → `context/archive/2026-06-14-minimal-plan-persistence-contract/`. Lesson: —.
- **S-03: sign back in later and see the saved weekly plan across sessions** — Archived 2026-09-07 → `context/archive/2026-06-14-persisted-plan-return-flow/`. Lesson: —.
- **S-01: receive a weekly plan personalized by training age, sessions/week, equipment, and goal, with safe acute/chronic injury handling** — Archived 2026-09-08 → `context/archive/2026-09-07-plan-generation-strategy/`. Lesson: —.
- **S-02: user completes the questionnaire through a multi-step flow (grade step, then an injuries step with a searchable, multi-select control) instead of one long single-page form.** — Archived 2026-09-08 → `context/archive/2026-09-08-questionnaire-wizard-flow/`. Lesson: —.
- **S-03: user can change their password and delete their account from a settings page.** — Archived 2026-09-08 → `context/archive/2026-09-08-account-settings/`. Lesson: —.
- **S-04: user can delete their generated weekly plan; once deleted, they are asked again to select grade and injuries.** — Archived 2026-09-08 → `context/archive/2026-09-08-plan-deletion-flow/`. Lesson: —.
