import type { DeclaredInjury } from "@/lib/injury-options";

export const CLIMBING_GRADES = ["5C", "6A", "6B", "6C", "7A", "7B"] as const;

export type ClimbingGrade = (typeof CLIMBING_GRADES)[number];

export const TRAINING_AGES = ["under_6_months", "6_24_months", "2_plus_years"] as const;

export type TrainingAge = (typeof TRAINING_AGES)[number];

export const EQUIPMENT_OPTIONS = ["hangboard", "campus_board", "gym"] as const;

export type EquipmentOption = (typeof EQUIPMENT_OPTIONS)[number];

export const PRIMARY_GOALS = ["send_grade", "endurance", "power", "general_fitness", "return_from_injury"] as const;

export type PrimaryGoal = (typeof PRIMARY_GOALS)[number];

export interface QuestionnaireDraftInput {
  climbingGrade: ClimbingGrade | "";
  injuryLimitations: DeclaredInjury[];
  trainingAge: TrainingAge | "";
  sessionsPerWeek: number | "";
  equipmentAccess: EquipmentOption[];
  primaryGoal: PrimaryGoal | "";
}

export interface QuestionnaireResponseInput {
  climbingGrade: ClimbingGrade;
  injuryLimitations: DeclaredInjury[];
  trainingAge: TrainingAge;
  sessionsPerWeek: number;
  equipmentAccess: EquipmentOption[];
  primaryGoal: PrimaryGoal;
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

export function createEmptyQuestionnaireDraft(): QuestionnaireDraftInput {
  return {
    climbingGrade: "",
    injuryLimitations: [],
    trainingAge: "",
    sessionsPerWeek: "",
    equipmentAccess: [],
    primaryGoal: "",
  };
}
