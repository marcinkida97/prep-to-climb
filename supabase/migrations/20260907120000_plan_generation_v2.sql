-- Plan generation v2: expanded questionnaire, tagged exercise library, forced re-onboarding.
--
-- Ordering matters: existing questionnaire_responses rows are cleared BEFORE the new NOT NULL
-- columns are added, because ALTER TABLE ... ADD COLUMN ... NOT NULL without a DEFAULT fails on a
-- non-empty table. Deleting questionnaire_responses cascades to weekly_plans -> plan_days ->
-- recommended_exercises via the existing FKs from the first migration, so no other table needs an
-- explicit delete here.
delete from public.questionnaire_responses;

alter table public.questionnaire_responses
  add column training_age text not null
    check (training_age in ('under_6_months', '6_24_months', '2_plus_years')),
  add column sessions_per_week smallint not null
    check (sessions_per_week between 1 and 7),
  add column equipment_access text[] not null default '{}',
  add column primary_goal text not null
    check (primary_goal in ('send_grade', 'endurance', 'power', 'general_fitness', 'return_from_injury'));

-- injury_limitations moves from a flat id list to a list of {id, status} objects so each
-- declared injury carries an acute/chronic distinction. Validated at the app layer (like
-- climbing_grade already is), not via a DB check.
alter table public.questionnaire_responses
  alter column injury_limitations drop default,
  alter column injury_limitations type jsonb using '[]'::jsonb,
  alter column injury_limitations set default '[]'::jsonb;

create table public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  exercise_name text not null,
  modality text not null
    check (modality in ('finger_strength', 'power', 'power_endurance', 'aerobic_capacity', 'technique', 'antagonist')),
  min_grade text not null,
  max_grade text not null,
  training_age_gate text not null
    check (training_age_gate in ('under_6_months', '6_24_months', '2_plus_years')),
  equipment_required text[] not null default '{}',
  injury_exclusion_tags text[] not null default '{}',
  default_sets text,
  default_reps text,
  caution_note text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.exercise_library enable row level security;

create policy "exercise_library_select_all"
on public.exercise_library
for select
to authenticated
using (true);

grant select on public.exercise_library to authenticated;

-- Seed content. Grade bands use the app's CLIMBING_GRADES order: 5C < 6A < 6B < 6C < 7A < 7B.
-- Injury exclusion tags reference the expanded injury taxonomy landing in Phase 2
-- (src/lib/injury-options.ts) - kept consistent with that list by id.
insert into public.exercise_library
  (exercise_name, modality, min_grade, max_grade, training_age_gate, equipment_required, injury_exclusion_tags, default_sets, default_reps, caution_note)
values
  -- finger_strength
  ('Max hangs', 'finger_strength', '6B', '7B', '6_24_months', '{hangboard}',
    '{left-fingers-pulley,right-fingers-pulley,left-fingers-trigger,right-fingers-trigger,left-wrist-tfcc,right-wrist-tfcc}',
    '5', '7-10 sec',
    'Reduce added weight and hang duration if you have less than 6-24 months of structured finger training experience.'),
  ('Repeaters', 'finger_strength', '5C', '7B', 'under_6_months', '{hangboard}',
    '{left-fingers-pulley,right-fingers-pulley,left-fingers-trigger,right-fingers-trigger,left-wrist-tfcc,right-wrist-tfcc}',
    '3', '6 reps', null),
  ('Open-hand repeaters', 'finger_strength', '5C', '6C', 'under_6_months', '{hangboard}',
    '{}', '3', '8 reps', null),
  ('Grip recovery squeezes', 'finger_strength', '5C', '7B', 'under_6_months', '{}',
    '{}', '3', '12 reps', null),

  -- power
  ('Campus board ladders', 'power', '6C', '7B', '2_plus_years', '{campus_board}',
    '{left-fingers-pulley,right-fingers-pulley,left-elbow-tendon,right-elbow-tendon,left-elbow-lateral,right-elbow-lateral,left-shoulder-strain,right-shoulder-strain,left-shoulder-labral,right-shoulder-labral}',
    '4', '3 reps',
    'Coaching consensus gates campus training behind roughly 2+ years climbing and prior structured finger training - reduce volume/intensity below that.'),
  ('Feet-on campus practice', 'power', '6A', '7B', 'under_6_months', '{campus_board}',
    '{left-fingers-pulley,right-fingers-pulley}', '3', '4 reps', null),
  ('Limit bouldering', 'power', '6B', '7B', '6_24_months', '{gym}',
    '{left-knee-meniscus,right-knee-meniscus,left-ankle-sprain,right-ankle-sprain,left-shoulder-strain,right-shoulder-strain,lower-back-strain}',
    '1 session', '45 min',
    'Reduce attempts on high-consequence falls (heel hooks, high balls) if training age is under 6-24 months.'),
  ('Bodyweight explosive step-ups', 'power', '5C', '6C', 'under_6_months', '{}',
    '{left-knee-meniscus,right-knee-meniscus,left-ankle-sprain,right-ankle-sprain}', '3', '6 reps', null),

  -- power_endurance
  ('4x4 linked boulders', 'power_endurance', '6B', '7B', '6_24_months', '{gym}',
    '{left-fingers-pulley,right-fingers-pulley,left-elbow-tendon,right-elbow-tendon,lower-back-strain}',
    '4 sets', '4 boulders',
    'Keep to short 2-4 week blocks; extending power-endurance work longer risks overtraining.'),
  ('Easy bouldering mileage', 'power_endurance', '5C', '6C', 'under_6_months', '{gym}',
    '{}', '1 session', '45 min', null),
  ('General conditioning circuit', 'power_endurance', '5C', '7B', 'under_6_months', '{}',
    '{left-knee-meniscus,right-knee-meniscus}', '4 rounds', '45 sec on / 15 sec off', null),

  -- aerobic_capacity
  ('ARC traversing', 'aerobic_capacity', '5C', '7B', 'under_6_months', '{gym}',
    '{left-fingers-pulley,right-fingers-pulley}', '1', '30 min', null),
  ('Walking / easy cardio', 'aerobic_capacity', '5C', '7B', 'under_6_months', '{}',
    '{}', '1', '30 min', null),

  -- technique
  ('Footwork circuit', 'technique', '5C', '7B', 'under_6_months', '{gym}',
    '{}', '4', '4 boulders', null),
  ('Silent feet drills', 'technique', '5C', '6C', 'under_6_months', '{gym}',
    '{}', '3', '10 min', null),
  ('Flagging & body positioning practice', 'technique', '6A', '7B', 'under_6_months', '{gym}',
    '{left-knee-meniscus,right-knee-meniscus}', '3', '10 min', null),
  ('Balance and body-tension drills', 'technique', '5C', '7B', 'under_6_months', '{}',
    '{}', '3', '10 min', null),

  -- antagonist
  ('Scapular wall slides', 'antagonist', '5C', '7B', 'under_6_months', '{}',
    '{}', '3', '10 reps', null),
  ('Forearm extensors', 'antagonist', '5C', '7B', 'under_6_months', '{}',
    '{}', '3', '15 reps', null),
  ('Isometric row holds', 'antagonist', '5C', '7B', 'under_6_months', '{}',
    '{}', '3', '20 sec', null),
  ('Rotator cuff external rotation', 'antagonist', '5C', '7B', 'under_6_months', '{}',
    '{}', '3', '12 reps', null),
  ('Core and glute stability circuit', 'antagonist', '5C', '7B', 'under_6_months', '{}',
    '{}', '3', '10 reps', null),
  ('Ankle proprioception drills', 'antagonist', '5C', '7B', 'under_6_months', '{}',
    '{}', '3', '10 reps', null),
  ('Wrist stabilization work', 'antagonist', '5C', '7B', 'under_6_months', '{}',
    '{}', '3', '12 reps', null),
  ('Landing-technique conditioning drills', 'antagonist', '5C', '7B', 'under_6_months', '{gym}',
    '{}', '3', '8 reps', null);

-- Note: "skin-issue" (flappers/calluses) is intentionally never used as an injury_exclusion_tags
-- value here - per research.md, it's a volume-reduction signal for the Phase 3 assembler to apply
-- generally, not an exercise-specific exclusion.

drop function if exists public.replace_current_plan(text, text[], text, jsonb);

create function public.replace_current_plan(
  p_climbing_grade text,
  p_injury_limitations jsonb,
  p_summary text,
  p_days jsonb,
  p_training_age text,
  p_sessions_per_week smallint,
  p_equipment_access text[],
  p_primary_goal text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_id uuid;
  v_day jsonb;
  v_day_id uuid;
  v_exercise jsonb;
begin
  if v_user_id is null then
    raise exception 'Authenticated user context is required';
  end if;

  insert into public.questionnaire_responses (
    user_id,
    climbing_grade,
    injury_limitations,
    training_age,
    sessions_per_week,
    equipment_access,
    primary_goal
  )
  values (
    v_user_id,
    p_climbing_grade,
    coalesce(p_injury_limitations, '[]'::jsonb),
    p_training_age,
    p_sessions_per_week,
    coalesce(p_equipment_access, '{}'),
    p_primary_goal
  )
  on conflict (user_id) do update
  set
    climbing_grade = excluded.climbing_grade,
    injury_limitations = excluded.injury_limitations,
    training_age = excluded.training_age,
    sessions_per_week = excluded.sessions_per_week,
    equipment_access = excluded.equipment_access,
    primary_goal = excluded.primary_goal;

  update public.weekly_plans
  set is_active = false
  where user_id = v_user_id
    and is_active = true;

  insert into public.weekly_plans (
    user_id,
    questionnaire_response_user_id,
    is_active,
    summary
  )
  values (
    v_user_id,
    v_user_id,
    true,
    p_summary
  )
  returning id into v_plan_id;

  for v_day in
    select value
    from jsonb_array_elements(p_days)
  loop
    insert into public.plan_days (
      weekly_plan_id,
      day_number,
      day_label,
      focus_area,
      notes
    )
    values (
      v_plan_id,
      (v_day ->> 'dayNumber')::smallint,
      v_day ->> 'dayLabel',
      v_day ->> 'focusArea',
      nullif(v_day ->> 'notes', '')
    )
    returning id into v_day_id;

    for v_exercise in
      select value
      from jsonb_array_elements(coalesce(v_day -> 'recommendedExercises', '[]'::jsonb))
    loop
      insert into public.recommended_exercises (
        plan_day_id,
        exercise_order,
        exercise_name,
        sets,
        reps,
        notes
      )
      values (
        v_day_id,
        coalesce((v_exercise ->> 'exerciseOrder')::smallint, 1),
        v_exercise ->> 'exerciseName',
        nullif(v_exercise ->> 'sets', ''),
        nullif(v_exercise ->> 'reps', ''),
        nullif(v_exercise ->> 'notes', '')
      );
    end loop;
  end loop;

  return v_plan_id;
end;
$$;

grant execute on function public.replace_current_plan(text, jsonb, text, jsonb, text, smallint, text[], text) to authenticated;
