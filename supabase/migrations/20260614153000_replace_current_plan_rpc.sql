create or replace function public.replace_current_plan(
  p_climbing_grade text,
  p_injury_limitations text[],
  p_summary text,
  p_days jsonb
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
    injury_limitations
  )
  values (
    v_user_id,
    p_climbing_grade,
    coalesce(p_injury_limitations, '{}')
  )
  on conflict (user_id) do update
  set
    climbing_grade = excluded.climbing_grade,
    injury_limitations = excluded.injury_limitations;

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

grant execute on function public.replace_current_plan(text, text[], text, jsonb) to authenticated;
