# Smarter Weekly-Plan Generation Implementation Plan

## Overview

Replace the current two-input, hardcoded-template plan generator with a deterministic rule engine
over a new tagged exercise database. Personalization inputs grow from `{climbingGrade,
injuryLimitations}` to `{climbingGrade, injuryLimitations (with acute/chronic status),
trainingAge, sessionsPerWeek, equipmentAccess, primaryGoal}`, and the injury taxonomy grows from 6
entries (3 body regions) to ~8 body regions. No AI/LLM call is introduced in this change; the
exercise database schema is deliberately tagged so an AI-assisted *selection* layer could be added
later without a migration.

## Current State Analysis

- `src/lib/injury-options.ts` — 6 hardcoded entries (left/right shoulder, fingers, elbow), no
  acute/chronic distinction.
- `src/lib/plan-generator/templates.ts` — ~3-4 hand-written 7-day templates matched by
  `climbingGrade` alone.
- `src/lib/plan-generator/injury-rules.ts` — hardcoded exercise-name → substitution map, keyed by
  injury id, referenced by template-authored `exerciseInjuryConflicts` indices.
- `src/lib/plan-generator/index.ts` — `generateWeeklyPlan(questionnaire)` is a synchronous, pure
  function: pick a template by grade, walk its days applying injury substitutions.
- `src/lib/plan-types.ts` — `QuestionnaireResponseInput.injuryLimitations` is `InjuryOptionId[]`
  (flat list, no status); no training age / sessions-per-week / equipment / goal fields exist.
- `src/lib/plan-persistence.ts` — `saveCurrentPlan` calls the `replace_current_plan` RPC with
  `p_climbing_grade`, `p_injury_limitations` (`text[]`), `p_summary`, `p_days` (`jsonb`).
- `supabase/migrations/20260614090000_minimal_plan_persistence.sql` — `questionnaire_responses`
  has only `climbing_grade text` and `injury_limitations text[]`; `weekly_plans` / `plan_days` /
  `recommended_exercises` are unaffected by this change and stay as-is.
- `supabase/migrations/20260614153000_replace_current_plan_rpc.sql` — the `replace_current_plan`
  PL/pgSQL function that upserts `questionnaire_responses` and inserts the plan/day/exercise rows
  in one transaction.
- `src/pages/api/plans/generate.ts` — validates `climbingGrade` and `injuryLimitations` against
  `CLIMBING_GRADES` / `isInjuryOptionId`, then calls `generateWeeklyPlan` synchronously.
- `src/components/plans/QuestionnaireForm.tsx` — single-page form (not a wizard — the multi-step
  wizard UI is a separate, later change) collecting grade + injury checkboxes.
- `src/pages/dashboard.astro` — reads the current plan via `getCurrentPlan`; when
  `getCurrentPlan` returns `null` (no `questionnaire_responses` row for the user), it shows
  `QuestionnaireForm` instead of a saved plan. This is the exact hook this change reuses to force
  re-onboarding for existing users (see Critical Implementation Details).

### Key Discoveries:

- `weekly_plans.questionnaire_response_user_id` references
  `questionnaire_responses(user_id) on delete cascade`, and `plan_days` / `recommended_exercises`
  cascade from `weekly_plans`. Deleting a user's `questionnaire_responses` row therefore already
  wipes their entire plan chain — no separate truncation of the other three tables is needed.
- `getCurrentPlan` (`plan-persistence.ts:53-95`) treats "no questionnaire row" as the sole signal
  to show the questionnaire form again — this is the existing mechanism the migration's forced
  re-onboarding will trigger, not new branching logic.
- The PRD's guardrail ("the plan must avoid recommending exercises that directly conflict with
  the injury or body-part limitation the user declared") is the reason the plan-generation
  research (`research.md`) recommends keeping exercise selection fully deterministic rather than
  introducing a generative step.

## Desired End State

A user answering the (still single-page, not-yet-wizard) questionnaire with climbing grade,
declared injuries (each tagged acute or chronic), training age, sessions per week, equipment
access, and a primary goal receives a 7-day plan assembled from a tagged exercise database:
respecting equipment access, excluding exercises tagged against any chronic injury's exclusion
tags, replacing acute-injury-adjacent modalities with conservative guidance plus a
"see a professional" note in the plan summary, and annotating power/campus-style exercises with a
caution note (soft gate) when the declared training age is below the modality's gate. Existing
users' previously saved questionnaire answers and plans are cleared by the migration, so their
next dashboard visit shows the (extended) questionnaire form instead of a stale plan.

**Verification**: `npm run lint`, `npm run build`, and the full `vitest` suite pass;
`npx supabase db push` (or `db reset` locally) applies cleanly; a manual walk-through of the
questionnaire → generate → dashboard flow for a fresh user produces a plan whose exercises never
violate an equipment or chronic-injury exclusion, and whose summary carries an acute-injury
disclaimer when applicable.

### Key Discoveries:

- `src/lib/supabase.ts`'s `createClient` is already the shared SSR client factory used by both
  `middleware.ts` and `generate.ts` — the new `getExerciseLibrary` read reuses the same client,
  no new auth wiring needed.
- `CLIMBING_GRADES` in `plan-types.ts` is the existing precedent for a small fixed enum validated
  at the API layer (not enforced via a DB `check` constraint) — the new `trainingAge`,
  `primaryGoal`, and equipment-access enums should follow the same pattern for consistency.

## What We're NOT Doing

- No AI/LLM call anywhere in this change — exercise selection stays fully deterministic.
- No multi-step questionnaire wizard or searchable multi-select UI — that is a separate, later
  change; this change only adds fields to the existing single-page form.
- No changes to `weekly_plans`, `plan_days`, or `recommended_exercises` table schemas — the new
  data lives in `questionnaire_responses` and the new `exercise_library` table only.
- No hard-blocking of power/campus-style exercises below the training-age threshold — soft gate
  (caution note + reduced volume) only, per the confirmed decision.
- No preservation of existing users' saved questionnaire answers or plans — they are intentionally
  cleared so every user re-answers the expanded questionnaire, per the confirmed decision.
- No admin UI for managing the exercise library — it is seeded via migration only in this change.
- No multi-week periodization or cycling logic (e.g., tracking how long a power-endurance block
  has been active) — out of scope per the PRD's Non-Goals; the `modality` tag is added now only so
  it isn't precluded later.

## Implementation Approach

Move the "what exercises can this person do" decision out of hardcoded TypeScript (`templates.ts`,
`injury-rules.ts`) and into a queryable Supabase table (`exercise_library`), tagged along every
dimension the questionnaire now captures. `generateWeeklyPlan` becomes an async function that
queries this table through the existing Supabase client and assembles each day's exercises via
deterministic filtering/scoring rules, rather than picking one of a handful of fixed templates.
The `replace_current_plan` RPC's role is unchanged in kind — persist what the app computed — it
just gains more parameters to persist. A single migration both reshapes `questionnaire_responses`
and seeds the initial `exercise_library` content, and forces existing users back through
onboarding by clearing their now-incompatible saved answers.

## Critical Implementation Details

**Migration ordering.** `ALTER TABLE ... ADD COLUMN ... NOT NULL` without a default fails if the
table has existing rows. This migration must delete all `questionnaire_responses` rows (which
cascades to `weekly_plans` → `plan_days` → `recommended_exercises`) **before** adding the new
`NOT NULL` columns and reshaping `injury_limitations`, not after.

**`generateWeeklyPlan` becomes async.** Today it's a synchronous pure function
(`plan-generator/index.ts`). Once it queries `exercise_library` via Supabase, its signature
changes to `generateWeeklyPlan(supabase, questionnaire)` returning a `Promise`. This ripples into
`generate.ts` (`await generateWeeklyPlan(...)`) and every test that currently calls it
synchronously (`plan-generator/index.test.ts`).

**Soft-gate and acute-injury advisories reuse existing text fields — no new schema.** A
power/campus exercise below the caller's training-age gate gets its `caution_note` appended into
that exercise's existing `notes` field at assembly time (not a new column on
`recommended_exercises`). An acute-injury disclaimer is appended into the existing nullable
`weeklyPlan.summary` text (extending the pattern `buildSummary` already uses for "Adjusted for N
declared injury limitations"), not a new field.

**`exercise_library` is read-only reference content.** It is seeded via `INSERT` statements in the
migration itself (not `supabase/seed.sql`, which the README documents as minimal local-only sample
data) so every environment — local and the linked remote project — gets identical content via the
same `db push` / `db reset` flow. RLS grants `select` to `authenticated` only; no
insert/update/delete policies, since content is migration-managed, not user-authored.

## Phase 1: Data Model & Migration

### Overview

Introduce the `exercise_library` table, extend `questionnaire_responses` with the four new
fields, reshape `injury_limitations` to carry acute/chronic status, update the
`replace_current_plan` RPC signature, and force existing users back through onboarding.

### Changes Required:

#### 1. New migration file

**File**: `supabase/migrations/<timestamp>_plan_generation_v2.sql`

**Intent**: Establish the schema for the expanded questionnaire and the new exercise database, and
clear incompatible existing data, in one migration so local (`db reset`) and remote (`db push`)
environments stay identical.

**Contract**:
- `delete from public.questionnaire_responses;` first (cascades to `weekly_plans`, `plan_days`,
  `recommended_exercises` via existing FKs — do not add explicit deletes for those three tables).
- `alter table public.questionnaire_responses`: add `training_age text not null check
  (training_age in ('under_6_months','6_24_months','2_plus_years'))`, `sessions_per_week smallint
  not null check (sessions_per_week between 1 and 7)`, `equipment_access text[] not null default
  '{}'`, `primary_goal text not null check (primary_goal in ('send_grade','endurance','power',
  'general_fitness','return_from_injury'))`; alter `injury_limitations` from `text[]` to `jsonb not
  null default '[]'::jsonb`, each element shaped `{"id": "<injury-option-id>", "status": "acute" |
  "chronic"}` (validated at the app layer like `climbing_grade` today, not via a DB check).
- New table `public.exercise_library`: `id uuid primary key default gen_random_uuid()`,
  `exercise_name text not null`, `modality text not null check (modality in
  ('finger_strength','power','power_endurance','aerobic_capacity','technique','antagonist'))`,
  `min_grade text not null`, `max_grade text not null`, `training_age_gate text not null check
  (training_age_gate in ('under_6_months','6_24_months','2_plus_years'))` (the minimum bucket at
  which this exercise needs no caution note), `equipment_required text[] not null default '{}'`
  (empty = bodyweight/no equipment), `injury_exclusion_tags text[] not null default '{}'`
  (references injury-option ids), `default_sets text`, `default_reps text`, `caution_note text`
  (shown when the caller's training age is below `training_age_gate`), `created_at timestamptz not
  null default timezone('utc', now())`. Enable RLS; `select` policy to `authenticated`; `grant
  select on public.exercise_library to authenticated`.
- Seed `exercise_library` with enough rows to cover every `modality` across every grade band
  (`5C`–`7B`), including at least one entry per modality requiring no equipment and at least one
  requiring each of hangboard/campus/gym, and injury-exclusion coverage for all ~8 body regions
  from `research.md` §A. Reuse the exercise names already present in `templates.ts` /
  `injury-rules.ts` where they fit a tag combination, to keep continuity with today's content.
- Replace `public.replace_current_plan(...)`: signature gains `p_training_age text,
  p_sessions_per_week smallint, p_equipment_access text[], p_primary_goal text`, and
  `p_injury_limitations` changes from `text[]` to `jsonb`; the questionnaire upsert now writes all
  four new columns; the day/exercise insert loop is unchanged (still consumes the `p_days jsonb`
  the app computed). Re-grant `execute` on the new signature to `authenticated`.

### Success Criteria:

#### Automated Verification:

- [ ] Migration applies cleanly locally: `npx supabase db reset`
- [ ] Migration applies cleanly to the linked remote project: `npx supabase db push`
- [ ] `npx astro sync` runs without error after the schema change
- [ ] Lint passes: `npm run lint`

#### Manual Verification:

- [ ] `select count(*) from exercise_library` returns a non-zero row count covering every modality
- [ ] A pre-migration test user's `questionnaire_responses`, `weekly_plans`, `plan_days`, and
      `recommended_exercises` rows are all gone after the migration (cascade verified manually via
      SQL editor)

---

## Phase 2: Expanded Injury Taxonomy

### Overview

Grow the injury taxonomy from 6 to ~8 body regions with acute/chronic support, and retire the
hardcoded substitution map now superseded by `exercise_library.injury_exclusion_tags`.

### Changes Required:

#### 1. Injury options

**File**: `src/lib/injury-options.ts`

**Intent**: Add the body regions identified in `research.md` §A (wrist/TFCC, back/lower-back,
knee, ankle) alongside the existing shoulder/finger/elbow entries, and support a lightweight
"skin issue" entry per the research's recommendation that it stay a volume-reduction tag rather
than a full substitution-driving injury.

**Contract**: `INJURY_OPTIONS` gains new entries (each still `{id, bodyPart, label, summary}`,
following the existing shape); `isInjuryOptionId` is unchanged in signature. Add a new exported
type `InjuryStatus = "acute" | "chronic"` and a `DeclaredInjury = { id: InjuryOptionId; status:
InjuryStatus }` type used everywhere `injuryLimitations` is passed around.

#### 2. Retire the hardcoded substitution map

**File**: `src/lib/plan-generator/injury-rules.ts` (delete), `src/lib/plan-generator/templates.ts`
(delete)

**Intent**: Both are superseded by `exercise_library`'s `injury_exclusion_tags` and the Phase 3
assembler; deleting them prevents two parallel, drifting sources of truth for the same rules.

**Contract**: No remaining imports of `PLAN_TEMPLATES` or `INJURY_RULES` anywhere in `src/`.

### Success Criteria:

#### Automated Verification:

- [ ] Typecheck / build passes with `templates.ts` and `injury-rules.ts` removed: `npm run build`
- [ ] Lint passes: `npm run lint`
- [ ] No remaining references: `grep -r "PLAN_TEMPLATES\|INJURY_RULES" src/` returns nothing

#### Manual Verification:

- [ ] Reviewing `INJURY_OPTIONS` against `research.md` §A confirms all ~8 regions are represented

---

## Phase 3: Rule-Based Exercise Assembler

### Overview

Rewrite `plan-generator` to assemble each day from `exercise_library` using grade, training age
(soft-gated), equipment, goal, and per-injury acute/chronic status — replacing the fixed-template
lookup entirely.

### Changes Required:

#### 1. Exercise library access

**File**: `src/lib/plan-generator/exercise-library.ts` (new)

**Intent**: Provide a single read function for the assembler to query `exercise_library` by grade
band, equipment, and modality, keeping Supabase access out of the assembly logic itself.

**Contract**: `getExerciseLibrary(supabase: SupabaseServerClient): Promise<ExerciseLibraryRow[]>`
— a plain `select *` (the table is small, static reference data; filtering happens in the
assembler, not the query, so the assembler's rules stay unit-testable without a live database).

#### 2. Assembler rewrite

**File**: `src/lib/plan-generator/index.ts`

**Intent**: For each of the 7 days, pick exercises across the modalities appropriate to the
declared `primaryGoal` and `sessionsPerWeek` (e.g., a goal of `power` biases day-modality
assignment toward power/power-endurance slots; `sessionsPerWeek` bounds how many
non-rest/non-recovery days are scheduled), filtered by `equipmentAccess` (only exercises whose
`equipment_required` is a subset of what the user has) and by chronic-injury exclusion (skip any
exercise whose `injury_exclusion_tags` intersects a chronic-status declared injury). When a
selected exercise's `training_age_gate` exceeds the declared `trainingAge`, keep the exercise but
append its `caution_note` into that exercise's `notes` field (soft gate — never hard-remove).
When any declared injury has `status: "acute"`, skip modality-specific selection for that injury's
region for the day and instead append a generic conservative note plus a "see a professional"
disclaimer into `weeklyPlan.summary` (reusing `buildSummary`'s existing append pattern).

**Contract**: `generateWeeklyPlan(supabase: SupabaseServerClient, questionnaire:
QuestionnaireResponseInput): Promise<SaveCurrentPlanInput["weeklyPlan"]>` — signature changes from
synchronous to async and now takes the Supabase client as its first argument.

### Success Criteria:

#### Automated Verification:

- [ ] Unit tests updated and passing for the new async signature: `npm run test` (or the
      project's vitest command) covering `plan-generator/index.test.ts`
- [ ] Typecheck passes: `npm run build`
- [ ] Lint passes: `npm run lint`

#### Manual Verification:

- [ ] Generating a plan with a chronic finger-pulley injury never includes an exercise tagged
      against that region
- [ ] Generating a plan with an acute injury shows the conservative disclaimer in the plan summary
      and omits region-specific exercises for that injury
- [ ] Generating a plan with a low training age and a goal that would otherwise select
      campus/power exercises shows those exercises with their caution note attached, not omitted
- [ ] Generating a plan with no campus/gym equipment access never includes an exercise requiring
      that equipment

---

## Phase 4: Questionnaire & API Surface

### Overview

Extend the existing single-page questionnaire form and the `/api/plans/generate` route to collect
and validate the four new fields and per-injury acute/chronic status, and wire them through
persistence.

### Changes Required:

#### 1. Types

**File**: `src/lib/plan-types.ts`

**Intent**: Reflect the new questionnaire shape everywhere it's typed.

**Contract**: `QuestionnaireResponseInput.injuryLimitations` changes from `InjuryOptionId[]` to
`DeclaredInjury[]` (imported from `injury-options.ts`); add `trainingAge: TrainingAge`,
`sessionsPerWeek: number`, `equipmentAccess: EquipmentOption[]`, `primaryGoal: PrimaryGoal` (new
exported enums/types alongside `CLIMBING_GRADES`, following that existing pattern).

#### 2. API validation

**File**: `src/pages/api/plans/generate.ts`

**Intent**: Validate the four new fields the same way `climbingGrade` and `injuryLimitations` are
validated today — reject with 400 and a specific message per invalid field.

**Contract**: `validateQuestionnaireRequest` gains checks for `trainingAge` (must be a known
bucket), `sessionsPerWeek` (integer 1-7), `equipmentAccess` (array of known equipment ids),
`primaryGoal` (must be a known goal), and each `injuryLimitations` entry (must have a recognized
`id` and a `status` of `"acute"` or `"chronic"`). `readQuestionnaire` builds the extended
`QuestionnaireResponseInput`. The `POST` handler awaits `generateWeeklyPlan(supabase,
questionnaire)` (per Phase 3's new signature).

#### 3. Persistence

**File**: `src/lib/plan-persistence.ts`

**Intent**: Pass the new fields through to the RPC and read them back correctly.

**Contract**: `saveCurrentPlan`'s `supabase.rpc("replace_current_plan", {...})` call passes
`p_training_age`, `p_sessions_per_week`, `p_equipment_access`, `p_primary_goal`, and
`p_injury_limitations` as the new `jsonb` shape (`input.questionnaire.injuryLimitations` mapped
to `{id, status}` objects, no longer a plain string array). `getQuestionnaireRow` and
`getCurrentPlan`'s return shape include the four new fields and the reshaped
`injuryLimitations`.

#### 4. Form UI

**File**: `src/components/plans/QuestionnaireForm.tsx`

**Intent**: Add four new inputs (training age, sessions per week, equipment access, primary goal)
and, for each currently-selected injury, an acute/chronic toggle — as additions to the existing
single-page form, not a new wizard (that's a separate later change).

**Contract**: New controlled inputs following the existing `errors`/`onChange` pattern already
used for `climbingGrade`; equipment access as a multi-checkbox group (small, fixed list — no
search needed yet, per the injury-selector search being explicitly scoped to the later wizard
change); each selected injury row grows a two-option (acute/chronic) control next to it.

### Success Criteria:

#### Automated Verification:

- [ ] `generate.test.ts` updated and passing for the new fields and new validation branches
- [ ] Typecheck passes: `npm run build`
- [ ] Lint passes: `npm run lint`

#### Manual Verification:

- [ ] Submitting the form without a training age, sessions/week, equipment selection, or goal
      shows the corresponding validation message and does not call the API
- [ ] Submitting with an unrecognized value for any new field is rejected with 400 (via direct API
      call, bypassing client validation) — confirms server-side validation, not just client-side
- [ ] A full valid submission reaches the dashboard showing a plan reflecting all declared inputs

---

## Phase 5: Verification & Rollout

### Overview

Confirm the full flow end-to-end for both new and pre-existing users, and close out the standard
repo quality gates.

### Changes Required:

#### 1. Full-flow verification

**Intent**: No code change — a verification pass across everything Phases 1-4 introduced,
following the repo's existing manual-verification convention
(`context/archive/*/verification.md`).

**Contract**: Document the walkthrough in `context/changes/plan-generation-strategy/verification.md`
following the format of prior archived changes' verification notes.

### Success Criteria:

#### Automated Verification:

- [ ] Full lint passes: `npm run lint`
- [ ] Full build passes: `npm run build`
- [ ] Full test suite passes: `npm run test` (or project's vitest command)

#### Manual Verification:

- [ ] A brand-new signup completes the extended questionnaire and receives a plan matching all
      declared inputs
- [ ] An existing pre-migration user (created before this change shipped) is shown the
      questionnaire form again on next dashboard visit, not a stale plan
- [ ] Regenerating a plan after changing an equipment or injury answer produces a visibly
      different, correctly-filtered plan

---

## Testing Strategy

### Unit Tests:

- `plan-generator/index.test.ts`: exercise selection respects equipment subset, chronic-injury
  exclusion, acute-injury conservative fallback, and soft-gate caution-note attachment, across at
  least one case per modality.
- `generate.test.ts`: validation branches for each of the four new fields and the reshaped
  `injuryLimitations`, plus the existing 401/415/400/503/200/500 cases updated for the new payload
  shape.

### Integration Tests:

- End-to-end questionnaire submission → RPC call → read-back, confirming the persisted
  `questionnaire_responses` row and returned `PersistedCurrentPlan` reflect all new fields.

### Manual Testing Steps:

1. Sign in as a fresh user, complete the extended questionnaire with a chronic injury declared,
   confirm the plan excludes conflicting exercises.
2. Repeat declaring the same injury as acute, confirm the summary carries the conservative
   disclaimer instead of a specific substitution.
3. Declare a low training age with a goal that would otherwise select campus/power work, confirm
   those exercises appear with a caution note rather than being omitted.
4. Sign in as a user who had a plan before this change shipped, confirm the questionnaire form
   appears instead of their old plan.

## Performance Considerations

`exercise_library` is small, static reference data selected in full per plan generation (no
per-request filtering pushed to SQL) — acceptable at current scale; revisit only if the table
grows large enough to warrant server-side filtering.

## Migration Notes

The migration in Phase 1 is intentionally destructive to existing `questionnaire_responses` /
`weekly_plans` / `plan_days` / `recommended_exercises` data, per the confirmed decision to force
full re-onboarding rather than backfill defaults. There is no rollback path that recovers deleted
user data — this is a one-way migration.

## References

- Related research: `context/changes/plan-generation-strategy/research.md`
- Prior schema: `supabase/migrations/20260614090000_minimal_plan_persistence.sql`
- Prior RPC: `supabase/migrations/20260614153000_replace_current_plan_rpc.sql`
- Prior implementation: `context/archive/2026-06-14-first-weekly-plan-flow/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Data Model & Migration

#### Automated

- [x] 1.1 Migration applies cleanly locally: `npx supabase db reset` — adapted: local Docker/Colima stack won't start on this machine (unrelated pre-existing env issue); verified via remote dry-run + push + direct SQL checks instead, per user decision — 0dd714e
- [x] 1.2 Migration applies cleanly to the linked remote project: `npx supabase db push` — 0dd714e
- [x] 1.3 `npx astro sync` runs without error after the schema change — 0dd714e
- [x] 1.4 Lint passes: `npm run lint` — 0dd714e

#### Manual

- [x] 1.5 `exercise_library` seeded with non-zero rows covering every modality — 0dd714e
- [x] 1.6 Pre-migration test user's full data chain confirmed gone after migration — 0dd714e

### Phase 2: Expanded Injury Taxonomy

#### Automated

- [x] 2.1 Build passes with `templates.ts` / `injury-rules.ts` removed: `npm run build` — adapted: deletion deferred to Phase 3 (see mismatch resolution); build, lint, and full vitest suite (43/43) pass with the taxonomy expansion in place and both files still present — 466c658
- [x] 2.2 Lint passes: `npm run lint` — 466c658
- [x] 2.3 No remaining `PLAN_TEMPLATES` / `INJURY_RULES` references: `grep -r "PLAN_TEMPLATES\|INJURY_RULES" src/` — adapted: intentionally still referenced (deletion deferred to Phase 3); grep confirms only the expected, unchanged references — 466c658

#### Manual

- [x] 2.4 `INJURY_OPTIONS` covers all ~8 regions from `research.md` §A — 466c658

### Phase 3: Rule-Based Exercise Assembler

#### Automated

- [x] 3.1 Unit tests updated and passing for async `generateWeeklyPlan` — adapted: `QuestionnaireResponseInput` (trainingAge/sessionsPerWeek/equipmentAccess/primaryGoal + injuryLimitations reshaped to `DeclaredInjury[]`) pulled forward from Phase 4 per user decision, since Phase 3's own filtering contract needs those fields to exist; generate.ts/plan-persistence.ts/QuestionnaireForm.tsx/dashboard.astro/WeeklyPlanView.tsx patched with minimal mechanical wiring (no new validation messages or form UI — that stays Phase 4) to keep everything compiling; `plan-generator/index.test.ts` (7/7) rewritten and passing; `generate.test.ts`'s 2 success/failure-path tests are collateral-red (its fake Supabase doesn't mock the new `exercise_library` query) — that file is explicitly Phase 4's to update — c7edecb
- [x] 3.2 Typecheck passes: `npm run build` — c7edecb
- [x] 3.3 Lint passes: `npm run lint` — c7edecb

#### Manual

- [x] 3.4 Chronic injury never yields a conflicting exercise — confirmed by user against the deployed server
- [x] 3.5 Acute injury yields conservative disclaimer, omits region-specific exercises — confirmed by user against the deployed server
- [x] 3.6 Low training age yields caution-noted (not omitted) campus/power exercises — confirmed by user against the deployed server
- [x] 3.7 Missing equipment never yields an exercise requiring it — confirmed by user against the deployed server

### Phase 4: Questionnaire & API Surface

#### Automated

- [x] 4.1 `generate.test.ts` updated and passing — rewrote validation-branch cases for trainingAge/sessionsPerWeek/equipmentAccess/primaryGoal/injury-status shape, added `exercise_library` mocking to the fake Supabase client, updated the 200/500 fixtures to the new questionnaire shape and real assembler summary text (23/23 passing); full suite 42/42 — 92652bf
- [x] 4.2 Typecheck passes: `npm run build` — 92652bf
- [x] 4.3 Lint passes: `npm run lint` — 92652bf

#### Manual

- [x] 4.4 Missing new-field submission shows validation message, no API call — confirmed by user against the deployed server; earlier-reported server-side unit test failure was a stale-deploy artifact, resolved now that the server runs commit `92652bf`
- [x] 4.5 Invalid new-field value rejected with 400 server-side — confirmed by user against the deployed server
- [x] 4.6 Full valid submission reaches dashboard with a matching plan — confirmed by user against the deployed server

### Phase 5: Verification & Rollout

#### Automated

- [x] 5.1 Full lint passes: `npm run lint`
- [x] 5.2 Full build passes: `npm run build`
- [x] 5.3 Full test suite passes: `npm run test` — 42/42; documented in `verification.md` alongside CI run 34160245482 on 92652bf

#### Manual

- [x] 5.4 New signup completes questionnaire, receives matching plan — confirmed by user against the deployed server
- [x] 5.5 Existing pre-migration user sees questionnaire form, not stale plan — confirmed by user against the deployed server
- [x] 5.6 Regeneration after changed answers produces a visibly different, correctly-filtered plan — confirmed by user against the deployed server
