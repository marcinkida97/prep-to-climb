import type { PostgrestError } from "@supabase/supabase-js";
import type { DeclaredInjury } from "@/lib/injury-options";
import type {
  ClimbingGrade,
  EquipmentOption,
  PersistedCurrentPlan,
  PrimaryGoal,
  SaveCurrentPlanInput,
  TrainingAge,
  WeeklyPlanDay,
} from "@/lib/plan-types";
import type { SupabaseServerClient } from "@/lib/supabase";

interface QuestionnaireRow {
  user_id: string;
  climbing_grade: ClimbingGrade;
  injury_limitations: DeclaredInjury[] | null;
  training_age: TrainingAge;
  sessions_per_week: number;
  equipment_access: EquipmentOption[] | null;
  primary_goal: PrimaryGoal;
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
    deleteCurrentPlan: (userId: string) => deleteCurrentPlan(supabase, userId),
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
      trainingAge: questionnaire.training_age,
      sessionsPerWeek: questionnaire.sessions_per_week,
      equipmentAccess: questionnaire.equipment_access ?? [],
      primaryGoal: questionnaire.primary_goal,
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
  const { error } = await supabase.rpc("replace_current_plan", {
    p_climbing_grade: input.questionnaire.climbingGrade.trim(),
    p_injury_limitations: input.questionnaire.injuryLimitations,
    p_training_age: input.questionnaire.trainingAge,
    p_sessions_per_week: input.questionnaire.sessionsPerWeek,
    p_equipment_access: input.questionnaire.equipmentAccess,
    p_primary_goal: input.questionnaire.primaryGoal,
    p_summary: toNullableText(input.weeklyPlan.summary),
    p_days: input.weeklyPlan.days.map((day) => ({
      dayNumber: day.dayNumber,
      dayLabel: day.dayLabel.trim(),
      focusArea: day.focusArea.trim(),
      notes: toNullableText(day.notes),
      recommendedExercises: day.recommendedExercises.map((exercise, index) => ({
        exerciseOrder: index + 1,
        exerciseName: exercise.exerciseName.trim(),
        sets: toNullableText(exercise.sets),
        reps: toNullableText(exercise.reps),
        notes: toNullableText(exercise.notes),
      })),
    })),
  });

  if (error) {
    throw new PlanPersistenceError("Failed to save the current plan", error);
  }

  const persistedPlan = await getCurrentPlan(supabase, userId);
  if (!persistedPlan) {
    throw new PlanPersistenceError("Weekly plan was saved but could not be read back");
  }

  return persistedPlan;
}

export async function deleteCurrentPlan(supabase: SupabaseServerClient, userId: string): Promise<void> {
  const { error } = await supabase.from("weekly_plans").delete().eq("user_id", userId).eq("is_active", true);

  if (error) {
    throw new PlanPersistenceError("Failed to delete the current weekly plan", error);
  }
}

async function getQuestionnaireRow(supabase: SupabaseServerClient, userId: string): Promise<QuestionnaireRow | null> {
  const { data, error } = await supabase
    .from("questionnaire_responses")
    .select(
      "user_id, climbing_grade, injury_limitations, training_age, sessions_per_week, equipment_access, primary_goal",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new PlanPersistenceError("Failed to load questionnaire responses", error);
  }

  return data;
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
