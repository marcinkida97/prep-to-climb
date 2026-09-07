import type { InjuryOptionId } from "@/lib/injury-options";
import type { ClimbingGrade, EquipmentOption, TrainingAge } from "@/lib/plan-types";
import type { SupabaseServerClient } from "@/lib/supabase";

export const MODALITIES = [
  "finger_strength",
  "power",
  "power_endurance",
  "aerobic_capacity",
  "technique",
  "antagonist",
] as const;

export type Modality = (typeof MODALITIES)[number];

export interface ExerciseLibraryRow {
  id: string;
  exerciseName: string;
  modality: Modality;
  minGrade: ClimbingGrade;
  maxGrade: ClimbingGrade;
  trainingAgeGate: TrainingAge;
  equipmentRequired: EquipmentOption[];
  injuryExclusionTags: InjuryOptionId[];
  defaultSets: string | null;
  defaultReps: string | null;
  cautionNote: string | null;
}

interface ExerciseLibraryDbRow {
  id: string;
  exercise_name: string;
  modality: Modality;
  min_grade: string;
  max_grade: string;
  training_age_gate: TrainingAge;
  equipment_required: string[] | null;
  injury_exclusion_tags: string[] | null;
  default_sets: string | null;
  default_reps: string | null;
  caution_note: string | null;
}

export class ExerciseLibraryError extends Error {}

export async function getExerciseLibrary(supabase: SupabaseServerClient): Promise<ExerciseLibraryRow[]> {
  const { data, error } = await supabase.from("exercise_library").select("*");

  if (error) {
    throw new ExerciseLibraryError("Failed to load the exercise library");
  }

  return (data as ExerciseLibraryDbRow[]).map((row) => ({
    id: row.id,
    exerciseName: row.exercise_name,
    modality: row.modality,
    minGrade: row.min_grade as ClimbingGrade,
    maxGrade: row.max_grade as ClimbingGrade,
    trainingAgeGate: row.training_age_gate,
    equipmentRequired: (row.equipment_required ?? []) as EquipmentOption[],
    injuryExclusionTags: (row.injury_exclusion_tags ?? []) as InjuryOptionId[],
    defaultSets: row.default_sets,
    defaultReps: row.default_reps,
    cautionNote: row.caution_note,
  }));
}
