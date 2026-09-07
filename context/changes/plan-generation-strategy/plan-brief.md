# Smarter Weekly-Plan Generation — Plan Brief

> Full plan: `context/changes/plan-generation-strategy/plan.md`
> Research: `context/changes/plan-generation-strategy/research.md`

## What & Why

Today's weekly-plan generator takes two inputs (climbing grade, injury list) and picks from ~3-4
hardcoded templates. This change replaces that with a deterministic rule engine over a new tagged
exercise database, driven by an expanded injury taxonomy (8 body regions instead of 3, with
acute/chronic status) and four new questionnaire fields (training age, sessions/week, equipment
access, primary goal) — so plans actually reflect climber-specific safety constraints and
capability, not just grade.

## Starting Point

`src/lib/plan-generator/{templates.ts,injury-rules.ts,index.ts}` is a small, synchronous,
hand-authored system tightly coupled to a 6-entry injury list. It matches the PRD's deliberately
minimal MVP scope, but caps personalization at whatever the ~4 fixed templates encode, and covers
only 3 of the ~9 body regions common in climbing injury epidemiology.

## Desired End State

A climber answers an extended (still single-page, not-yet-wizard) questionnaire and gets a 7-day
plan assembled from a real exercise database: no exercise requiring equipment they don't have, no
exercise conflicting with a chronic injury, a conservative disclaimer instead of specific advice
for acute injuries, and caution-noted (not hidden) power/campus exercises when their training age
is low. Existing users are sent back through the extended questionnaire on next visit.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Exercise-selection architecture | Tagged exercise library + deterministic rule assembler (no AI) | Systematic review found unconstrained LLM exercise plans unsafe in 58% of studies — directly at odds with the PRD's injury-avoidance guardrail | Research + Plan |
| Injury taxonomy scope | Full ~8-region expansion now | Prevalence data supports all regions; one coherent release beats a half-covered taxonomy | Plan |
| Acute vs. chronic injuries | Per-injury flag, conservative fallback for acute | An app can't safely triage an active, undiagnosed injury — sports-medicine self-report practice treats these as distinct | Plan |
| New questionnaire fields | All 4: training age, sessions/week, equipment, goal | Matches what real climbing-training tools collect; avoids a second migration round | Plan |
| Power/campus gating strictness | Soft gate (caution note + reduced volume, never hidden) | User's explicit choice, made with the tradeoff (weaker than coaching-consensus hard gating) surfaced | Plan |
| Existing-user migration | Force full re-onboarding (clear old data) | User's explicit choice, made with the tradeoff (breaks the shipped "return and see saved plan" promise once) surfaced | Plan |
| Exercise DB schema scope | Full tag vocabulary now (modality, grade-band, training-age-gate, equipment, injury-exclusion) | Cheap to add while the schema is being touched anyway; avoids a future migration if an AI-selection layer is ever added | Plan |

## Scope

**In scope:**
- New `exercise_library` table, seeded via migration
- Extended `questionnaire_responses` schema (4 new columns, reshaped `injury_limitations`)
- Rewritten `plan-generator` assembler (async, DB-driven)
- Extended single-page questionnaire form + API validation + persistence wiring
- Migration that clears existing users' data to force re-onboarding

**Out of scope:**
- Any AI/LLM call in exercise selection
- Multi-step questionnaire wizard, searchable injury multi-select (separate later change)
- Account settings, plan deletion, visual redesign (separate later changes)
- Multi-week periodization/cycling, admin UI for the exercise library

## Architecture / Approach

`generateWeeklyPlan` moves from a synchronous template lookup to an async function that queries
`exercise_library` (via the existing shared Supabase client) and assembles each day by filtering
on equipment access and chronic-injury exclusion tags, biasing modality mix by goal and
sessions/week, and annotating (never removing) exercises whose training-age gate exceeds the
declared training age. The `replace_current_plan` RPC's role is unchanged — persist what the app
computed — it just gains four new parameters.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data model & migration | `exercise_library` table + seed data, extended `questionnaire_responses`, updated RPC, forced data clear | Destructive migration — no rollback for cleared user data |
| 2. Expanded injury taxonomy | ~8-region `INJURY_OPTIONS`, retirement of hardcoded substitution map | Content-authoring gap if a region's exclusion tags are incomplete |
| 3. Rule-based exercise assembler | Rewritten async `plan-generator` | Async signature change ripples into every caller/test |
| 4. Questionnaire & API surface | Extended form + validation + persistence for 4 new fields | Longer single-page form until the wizard change lands |
| 5. Verification & rollout | End-to-end manual + automated verification | None beyond standard regression risk |

**Prerequisites:** none — this is the first of the four remaining changes in the user's chosen sequencing (this → injury/architecture research already folded in → questionnaire wizard → independent features).
**Estimated effort:** ~4-5 implementation sessions across 5 phases; Phase 1 (migration) and Phase 3 (assembler rewrite) are the largest.

## Open Risks & Assumptions

- The initial `exercise_library` seed content (exact exercise list/count) is left to the
  implementer in Phase 1 rather than fully enumerated in the plan — success criteria require
  coverage per modality/equipment/injury-region, not an exact count.
- Soft-gating power/campus exercises (rather than hard-gating, per the user's explicit choice)
  carries real safety risk per the training-methodology research; this is a knowing tradeoff, not
  an oversight.
- Forcing full re-onboarding is a one-way, destructive migration with no data-recovery path.

## Success Criteria (Summary)

- A fresh user's generated plan never violates a declared equipment or chronic-injury constraint.
- An acute injury yields conservative guidance instead of a specific (possibly wrong) substitution.
- Existing users are cleanly routed back through the extended questionnaire, not shown stale data.
