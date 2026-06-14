import type { InjuryOptionId } from "@/lib/injury-options";

export const CLIMBING_GRADES = ["5C", "6A", "6B", "6C", "7A", "7B"] as const;

export type ClimbingGrade = (typeof CLIMBING_GRADES)[number];

export interface QuestionnaireDraftInput {
  climbingGrade: ClimbingGrade | "";
  injuryLimitations: InjuryOptionId[];
}

export interface QuestionnaireResponseInput {
  climbingGrade: ClimbingGrade;
  injuryLimitations: InjuryOptionId[];
}

export interface RecommendedExerciseInput {
  exerciseName: string;
  sets?: string | null;
  reps?: string | null;
  notes?: string | null;
}

export interface WeeklyPlanDayInput {
  dayNumber: number;
  dayLabel: string;
  focusArea: string;
  notes?: string | null;
  recommendedExercises: RecommendedExerciseInput[];
}

export interface WeeklyPlanInput {
  summary?: string | null;
  days: WeeklyPlanDayInput[];
}

export interface SaveCurrentPlanInput {
  questionnaire: QuestionnaireResponseInput;
  weeklyPlan: WeeklyPlanInput;
}

export interface RecommendedExercise {
  id: string;
  exerciseOrder: number;
  exerciseName: string;
  sets: string | null;
  reps: string | null;
  notes: string | null;
}

export interface WeeklyPlanDay {
  id: string;
  dayNumber: number;
  dayLabel: string;
  focusArea: string;
  notes: string | null;
  recommendedExercises: RecommendedExercise[];
}

export interface WeeklyPlan {
  id: string;
  summary: string | null;
  createdAt: string;
  days: WeeklyPlanDay[];
}

export interface PersistedCurrentPlan {
  questionnaire: QuestionnaireResponseInput;
  weeklyPlan: WeeklyPlan;
}
