import type { PostgrestError } from "@supabase/supabase-js";
import type { PersistedCurrentPlan, SaveCurrentPlanInput, WeeklyPlanDay } from "@/lib/plan-types";
import type { SupabaseServerClient } from "@/lib/supabase";

interface QuestionnaireRow {
  user_id: string;
  climbing_grade: string;
  injury_limitations: string[] | null;
}

interface WeeklyPlanRow {
  id: string;
  summary: string | null;
  created_at: string;
  plan_days: PlanDayRow[] | null;
}

interface PlanDayRow {
  id: string;
  day_number: number;
  day_label: string;
  focus_area: string;
  notes: string | null;
  recommended_exercises: RecommendedExerciseRow[] | null;
}

interface RecommendedExerciseRow {
  id: string;
  exercise_order: number;
  exercise_name: string;
  sets: string | null;
  reps: string | null;
  notes: string | null;
}

interface ActivePlanIdRow {
  id: string;
}

export class PlanPersistenceError extends Error {
  public readonly causeDetail?: string;

  constructor(message: string, cause?: PostgrestError | Error | null) {
    super(message);
    this.name = "PlanPersistenceError";
    this.causeDetail = cause ? JSON.stringify(cause) : undefined;
  }
}

export function createPlanPersistence(supabase: SupabaseServerClient) {
  return {
    getCurrentPlan: (userId: string) => getCurrentPlan(supabase, userId),
    saveCurrentPlan: (userId: string, input: SaveCurrentPlanInput) => saveCurrentPlan(supabase, userId, input),
  };
}

export async function getCurrentPlan(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<PersistedCurrentPlan | null> {
  const questionnaire = await getQuestionnaireRow(supabase, userId);
  if (!questionnaire) {
    return null;
  }

  const { data, error } = await supabase
    .from("weekly_plans")
    .select(
      "id, summary, created_at, plan_days(id, day_number, day_label, focus_area, notes, recommended_exercises(id, exercise_order, exercise_name, sets, reps, notes))",
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new PlanPersistenceError("Failed to load the current weekly plan", error);
  }

  if (!data) {
    return null;
  }

  const weeklyPlan = data as WeeklyPlanRow;

  return {
    questionnaire: {
      climbingGrade: questionnaire.climbing_grade,
      injuryLimitations: questionnaire.injury_limitations ?? [],
    },
    weeklyPlan: {
      id: weeklyPlan.id,
      summary: weeklyPlan.summary,
      createdAt: weeklyPlan.created_at,
      days: mapPlanDays(weeklyPlan.plan_days ?? []),
    },
  };
}

export async function saveCurrentPlan(
  supabase: SupabaseServerClient,
  userId: string,
  input: SaveCurrentPlanInput,
): Promise<PersistedCurrentPlan> {
  validateCurrentPlanInput(input);

  const previousQuestionnaire = await getQuestionnaireRow(supabase, userId);
  const previousActivePlanIds = await getActivePlanIds(supabase, userId);

  let newPlanId: string | null = null;

  try {
    const { error: questionnaireError } = await supabase.from("questionnaire_responses").upsert({
      user_id: userId,
      climbing_grade: input.questionnaire.climbingGrade,
      injury_limitations: input.questionnaire.injuryLimitations,
    });

    if (questionnaireError) {
      throw new PlanPersistenceError("Failed to save questionnaire responses", questionnaireError);
    }

    if (previousActivePlanIds.length > 0) {
      const { error: deactivateError } = await supabase
        .from("weekly_plans")
        .update({ is_active: false })
        .eq("user_id", userId)
        .eq("is_active", true);

      if (deactivateError) {
        throw new PlanPersistenceError("Failed to deactivate the previous weekly plan", deactivateError);
      }
    }

    const { data: insertedPlanData, error: weeklyPlanError } = await supabase
      .from("weekly_plans")
      .insert({
        user_id: userId,
        questionnaire_response_user_id: userId,
        is_active: true,
        summary: toNullableText(input.weeklyPlan.summary),
      })
      .select("id")
      .single();

    if (weeklyPlanError) {
      throw new PlanPersistenceError("Failed to create the current weekly plan", weeklyPlanError);
    }

    newPlanId = getRequiredStringField(insertedPlanData, "id");

    const { data: insertedDays, error: dayError } = await supabase
      .from("plan_days")
      .insert(
        input.weeklyPlan.days.map((day) => ({
          weekly_plan_id: newPlanId,
          day_number: day.dayNumber,
          day_label: day.dayLabel,
          focus_area: day.focusArea,
          notes: toNullableText(day.notes),
        })),
      )
      .select("id, day_number");

    if (dayError) {
      throw new PlanPersistenceError("Failed to create weekly plan days", dayError);
    }

    const insertedDayRows = insertedDays as { id: string; day_number: number }[];
    const dayIdByNumber = new Map(insertedDayRows.map((row) => [row.day_number, row.id]));

    const exerciseRows = input.weeklyPlan.days.flatMap((day) =>
      day.recommendedExercises.map((exercise, index) => ({
        plan_day_id: dayIdByNumber.get(day.dayNumber),
        exercise_order: index + 1,
        exercise_name: exercise.exerciseName,
        sets: toNullableText(exercise.sets),
        reps: toNullableText(exercise.reps),
        notes: toNullableText(exercise.notes),
      })),
    );

    if (exerciseRows.some((row) => !row.plan_day_id)) {
      throw new PlanPersistenceError("Failed to map weekly plan days to recommended exercises");
    }

    if (exerciseRows.length > 0) {
      const { error: exerciseError } = await supabase.from("recommended_exercises").insert(
        exerciseRows as {
          plan_day_id: string;
          exercise_order: number;
          exercise_name: string;
          sets: string | null;
          reps: string | null;
          notes: string | null;
        }[],
      );

      if (exerciseError) {
        throw new PlanPersistenceError("Failed to create recommended exercises", exerciseError);
      }
    }

    const persistedPlan = await getCurrentPlan(supabase, userId);
    if (!persistedPlan) {
      throw new PlanPersistenceError("Weekly plan was saved but could not be read back");
    }

    return persistedPlan;
  } catch (error) {
    await rollbackSaveCurrentPlan(supabase, userId, previousQuestionnaire, previousActivePlanIds, newPlanId);

    if (error instanceof PlanPersistenceError) {
      throw error;
    }

    throw new PlanPersistenceError("Failed to save the current plan", error as Error);
  }
}

async function getQuestionnaireRow(supabase: SupabaseServerClient, userId: string): Promise<QuestionnaireRow | null> {
  const { data, error } = await supabase
    .from("questionnaire_responses")
    .select("user_id, climbing_grade, injury_limitations")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new PlanPersistenceError("Failed to load questionnaire responses", error);
  }

  return data;
}

async function getActivePlanIds(supabase: SupabaseServerClient, userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("weekly_plans").select("id").eq("user_id", userId).eq("is_active", true);

  if (error) {
    throw new PlanPersistenceError("Failed to load active weekly plan ids", error);
  }

  return (data as ActivePlanIdRow[]).map((row) => row.id);
}

async function rollbackSaveCurrentPlan(
  supabase: SupabaseServerClient,
  userId: string,
  previousQuestionnaire: QuestionnaireRow | null,
  previousActivePlanIds: string[],
  newPlanId: string | null,
) {
  if (newPlanId) {
    await supabase.from("weekly_plans").delete().eq("id", newPlanId);
  }

  if (previousActivePlanIds.length > 0) {
    await supabase.from("weekly_plans").update({ is_active: true }).in("id", previousActivePlanIds);
  }

  if (previousQuestionnaire) {
    await supabase.from("questionnaire_responses").upsert(previousQuestionnaire);
    return;
  }

  await supabase.from("questionnaire_responses").delete().eq("user_id", userId);
}

function validateCurrentPlanInput(input: SaveCurrentPlanInput) {
  if (!input.questionnaire.climbingGrade.trim()) {
    throw new PlanPersistenceError("climbingGrade is required");
  }

  if (input.weeklyPlan.days.length !== 7) {
    throw new PlanPersistenceError("Weekly plans must contain exactly seven days");
  }

  const seenDayNumbers = new Set<number>();
  for (const day of input.weeklyPlan.days) {
    if (!Number.isInteger(day.dayNumber) || day.dayNumber < 1 || day.dayNumber > 7) {
      throw new PlanPersistenceError("Each weekly plan day must use a dayNumber between 1 and 7");
    }

    if (seenDayNumbers.has(day.dayNumber)) {
      throw new PlanPersistenceError("Weekly plan days must use unique day numbers");
    }

    seenDayNumbers.add(day.dayNumber);

    if (!day.dayLabel.trim()) {
      throw new PlanPersistenceError("Each weekly plan day requires a dayLabel");
    }

    if (!day.focusArea.trim()) {
      throw new PlanPersistenceError("Each weekly plan day requires a focusArea");
    }

    day.recommendedExercises.forEach((exercise) => {
      if (!exercise.exerciseName.trim()) {
        throw new PlanPersistenceError("Each recommended exercise requires an exerciseName");
      }
    });
  }
}

function mapPlanDays(planDays: PlanDayRow[]): WeeklyPlanDay[] {
  return planDays
    .slice()
    .sort((left, right) => left.day_number - right.day_number)
    .map((day) => ({
      id: day.id,
      dayNumber: day.day_number,
      dayLabel: day.day_label,
      focusArea: day.focus_area,
      notes: day.notes,
      recommendedExercises: (day.recommended_exercises ?? [])
        .slice()
        .sort((left, right) => left.exercise_order - right.exercise_order)
        .map((exercise) => ({
          id: exercise.id,
          exerciseOrder: exercise.exercise_order,
          exerciseName: exercise.exercise_name,
          sets: exercise.sets,
          reps: exercise.reps,
          notes: exercise.notes,
        })),
    }));
}

function toNullableText(value: string | null | undefined): string | null {
  const trimmedValue = value?.trim();
  if (trimmedValue === undefined || trimmedValue === "") {
    return null;
  }

  return trimmedValue;
}

function getRequiredStringField(value: unknown, fieldName: string): string {
  if (typeof value !== "object" || value === null || !(fieldName in value)) {
    throw new PlanPersistenceError(`Expected Supabase to return a string ${fieldName} field`);
  }

  const record = value as Record<string, unknown>;
  const fieldValue = record[fieldName];
  if (typeof fieldValue !== "string" || fieldValue.length === 0) {
    throw new PlanPersistenceError(`Expected Supabase to return a non-empty string ${fieldName} field`);
  }

  return fieldValue;
}
