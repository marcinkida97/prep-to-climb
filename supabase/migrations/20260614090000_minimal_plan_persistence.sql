create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.questionnaire_responses (
  user_id uuid primary key references auth.users (id) on delete cascade,
  climbing_grade text not null,
  injury_limitations text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  questionnaire_response_user_id uuid not null references public.questionnaire_responses (user_id) on delete cascade,
  is_active boolean not null default true,
  summary text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint weekly_plans_user_match_questionnaire check (user_id = questionnaire_response_user_id)
);

create unique index weekly_plans_one_active_per_user_idx
  on public.weekly_plans (user_id)
  where is_active;

create index weekly_plans_user_created_idx on public.weekly_plans (user_id, created_at desc);

create table public.plan_days (
  id uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null references public.weekly_plans (id) on delete cascade,
  day_number smallint not null check (day_number between 1 and 7),
  day_label text not null,
  focus_area text not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint plan_days_weekly_plan_day_number_key unique (weekly_plan_id, day_number)
);

create table public.recommended_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_day_id uuid not null references public.plan_days (id) on delete cascade,
  exercise_order smallint not null check (exercise_order > 0),
  exercise_name text not null,
  sets text,
  reps text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint recommended_exercises_plan_day_order_key unique (plan_day_id, exercise_order)
);

create trigger questionnaire_responses_set_updated_at
before update on public.questionnaire_responses
for each row
execute function public.set_updated_at();

create trigger weekly_plans_set_updated_at
before update on public.weekly_plans
for each row
execute function public.set_updated_at();

grant select, insert, update, delete on public.questionnaire_responses to authenticated;
grant select, insert, update, delete on public.weekly_plans to authenticated;
grant select, insert, update, delete on public.plan_days to authenticated;
grant select, insert, update, delete on public.recommended_exercises to authenticated;

alter table public.questionnaire_responses enable row level security;
alter table public.weekly_plans enable row level security;
alter table public.plan_days enable row level security;
alter table public.recommended_exercises enable row level security;

create policy "questionnaire_responses_select_own"
on public.questionnaire_responses
for select
to authenticated
using (auth.uid() = user_id);

create policy "questionnaire_responses_insert_own"
on public.questionnaire_responses
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "questionnaire_responses_update_own"
on public.questionnaire_responses
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "questionnaire_responses_delete_own"
on public.questionnaire_responses
for delete
to authenticated
using (auth.uid() = user_id);

create policy "weekly_plans_select_own"
on public.weekly_plans
for select
to authenticated
using (auth.uid() = user_id);

create policy "weekly_plans_insert_own"
on public.weekly_plans
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "weekly_plans_update_own"
on public.weekly_plans
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "weekly_plans_delete_own"
on public.weekly_plans
for delete
to authenticated
using (auth.uid() = user_id);

create policy "plan_days_select_own"
on public.plan_days
for select
to authenticated
using (
  exists (
    select 1
    from public.weekly_plans weekly_plan
    where weekly_plan.id = weekly_plan_id
      and weekly_plan.user_id = auth.uid()
  )
);

create policy "plan_days_insert_own"
on public.plan_days
for insert
to authenticated
with check (
  exists (
    select 1
    from public.weekly_plans weekly_plan
    where weekly_plan.id = weekly_plan_id
      and weekly_plan.user_id = auth.uid()
  )
);

create policy "plan_days_update_own"
on public.plan_days
for update
to authenticated
using (
  exists (
    select 1
    from public.weekly_plans weekly_plan
    where weekly_plan.id = weekly_plan_id
      and weekly_plan.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.weekly_plans weekly_plan
    where weekly_plan.id = weekly_plan_id
      and weekly_plan.user_id = auth.uid()
  )
);

create policy "plan_days_delete_own"
on public.plan_days
for delete
to authenticated
using (
  exists (
    select 1
    from public.weekly_plans weekly_plan
    where weekly_plan.id = weekly_plan_id
      and weekly_plan.user_id = auth.uid()
  )
);

create policy "recommended_exercises_select_own"
on public.recommended_exercises
for select
to authenticated
using (
  exists (
    select 1
    from public.plan_days plan_day
    join public.weekly_plans weekly_plan on weekly_plan.id = plan_day.weekly_plan_id
    where plan_day.id = plan_day_id
      and weekly_plan.user_id = auth.uid()
  )
);

create policy "recommended_exercises_insert_own"
on public.recommended_exercises
for insert
to authenticated
with check (
  exists (
    select 1
    from public.plan_days plan_day
    join public.weekly_plans weekly_plan on weekly_plan.id = plan_day.weekly_plan_id
    where plan_day.id = plan_day_id
      and weekly_plan.user_id = auth.uid()
  )
);

create policy "recommended_exercises_update_own"
on public.recommended_exercises
for update
to authenticated
using (
  exists (
    select 1
    from public.plan_days plan_day
    join public.weekly_plans weekly_plan on weekly_plan.id = plan_day.weekly_plan_id
    where plan_day.id = plan_day_id
      and weekly_plan.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.plan_days plan_day
    join public.weekly_plans weekly_plan on weekly_plan.id = plan_day.weekly_plan_id
    where plan_day.id = plan_day_id
      and weekly_plan.user_id = auth.uid()
  )
);

create policy "recommended_exercises_delete_own"
on public.recommended_exercises
for delete
to authenticated
using (
  exists (
    select 1
    from public.plan_days plan_day
    join public.weekly_plans weekly_plan on weekly_plan.id = plan_day.weekly_plan_id
    where plan_day.id = plan_day_id
      and weekly_plan.user_id = auth.uid()
  )
);
