import { getExerciseLibrary, type ExerciseLibraryRow, type Modality } from "@/lib/plan-generator/exercise-library";
import type { DeclaredInjury, InjuryOptionId, InjuryStatus } from "@/lib/injury-options";
import {
  CLIMBING_GRADES,
  TRAINING_AGES,
  type ClimbingGrade,
  type PrimaryGoal,
  type QuestionnaireResponseInput,
  type RecommendedExerciseInput,
  type SaveCurrentPlanInput,
  type TrainingAge,
  type WeeklyPlanDayInput,
} from "@/lib/plan-types";
import type { SupabaseServerClient } from "@/lib/supabase";

interface DaySlot {
  dayNumber: number;
  dayLabel: string;
  weekdayFocus: string;
  modality: Modality | null;
}

// Days 1/4/2/5/6 are the "session" slots sessionsPerWeek bounds, in keep-first priority order.
// Day 3 (recovery) and day 7 (rest) are always present regardless of the declared session count.
const SESSION_DAY_PRIORITY = [1, 4, 2, 5, 6];

const GOAL_DAY_MODALITIES: Record<PrimaryGoal, { strength: Modality; capacity: Modality; climbDay: Modality }> = {
  send_grade: { strength: "power", capacity: "power_endurance", climbDay: "power" },
  power: { strength: "power", capacity: "power_endurance", climbDay: "power" },
  endurance: { strength: "power_endurance", capacity: "aerobic_capacity", climbDay: "power_endurance" },
  general_fitness: { strength: "antagonist", capacity: "aerobic_capacity", climbDay: "technique" },
  return_from_injury: { strength: "antagonist", capacity: "technique", climbDay: "antagonist" },
};

const GOAL_SUMMARIES: Record<PrimaryGoal, string> = {
  send_grade: "A focused week blending power and power-endurance work to progress toward your target grade.",
  power: "A higher-intensity week centered on power work and finger-strength development.",
  endurance: "An endurance-oriented week building aerobic capacity and sustained power-endurance.",
  general_fitness: "A balanced week of technique, antagonist conditioning, and aerobic base work.",
  return_from_injury: "A conservative week prioritizing antagonist strength and technique over high-intensity loading.",
};

export async function generateWeeklyPlan(
  supabase: SupabaseServerClient,
  questionnaire: QuestionnaireResponseInput,
): Promise<SaveCurrentPlanInput["weeklyPlan"]> {
  const library = await getExerciseLibrary(supabase);
  const slots = buildDaySlots(questionnaire.primaryGoal, questionnaire.sessionsPerWeek);

  let anyAcuteConflict = false;
  const days: WeeklyPlanDayInput[] = slots.map((slot) => {
    if (!slot.modality) {
      return {
        dayNumber: slot.dayNumber,
        dayLabel: slot.dayLabel,
        focusArea: "Rest",
        notes:
          slot.dayNumber === 7
            ? "Full rest or gentle mobility only."
            : "Kept as rest to match your declared sessions per week.",
        recommendedExercises: [],
      };
    }

    const { exercise, acuteConflict } = selectExerciseForModality(library, slot.modality, questionnaire);
    if (acuteConflict) {
      anyAcuteConflict = true;
    }

    return {
      dayNumber: slot.dayNumber,
      dayLabel: slot.dayLabel,
      focusArea: slot.weekdayFocus,
      notes: acuteConflict ? "Conservative guidance applied for a declared acute injury in this area." : null,
      recommendedExercises: [exercise],
    };
  });

  return {
    summary: buildSummary(questionnaire, anyAcuteConflict),
    days,
  };
}

function buildDaySlots(primaryGoal: PrimaryGoal, sessionsPerWeek: number): DaySlot[] {
  const modalities = GOAL_DAY_MODALITIES[primaryGoal];
  const baseSlots: DaySlot[] = [
    { dayNumber: 1, dayLabel: "Monday", weekdayFocus: "Technique", modality: "technique" },
    { dayNumber: 2, dayLabel: "Tuesday", weekdayFocus: "Strength", modality: modalities.strength },
    { dayNumber: 3, dayLabel: "Wednesday", weekdayFocus: "Recovery", modality: "antagonist" },
    { dayNumber: 4, dayLabel: "Thursday", weekdayFocus: "Finger strength", modality: "finger_strength" },
    { dayNumber: 5, dayLabel: "Friday", weekdayFocus: "Capacity", modality: modalities.capacity },
    { dayNumber: 6, dayLabel: "Saturday", weekdayFocus: "Climb day", modality: modalities.climbDay },
    { dayNumber: 7, dayLabel: "Sunday", weekdayFocus: "Rest", modality: null },
  ];

  const activeSessionCount = Number.isFinite(sessionsPerWeek)
    ? Math.min(Math.max(Math.trunc(sessionsPerWeek), 0), SESSION_DAY_PRIORITY.length)
    : SESSION_DAY_PRIORITY.length;
  const daysToRest = new Set(SESSION_DAY_PRIORITY.slice(activeSessionCount));

  return baseSlots.map((slot) => (daysToRest.has(slot.dayNumber) ? { ...slot, modality: null } : slot));
}

function selectExerciseForModality(
  library: ExerciseLibraryRow[],
  modality: Modality,
  questionnaire: QuestionnaireResponseInput,
): { exercise: RecommendedExerciseInput; acuteConflict: boolean } {
  const chronicIds = injuryIdsByStatus(questionnaire.injuryLimitations, "chronic");
  const acuteIds = injuryIdsByStatus(questionnaire.injuryLimitations, "acute");

  const candidates = library
    .filter((row) => row.modality === modality)
    .filter((row) => passesGrade(row, questionnaire.climbingGrade))
    .filter((row) => passesEquipment(row, questionnaire.equipmentAccess))
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));

  // An acute injury bypasses modality-specific selection entirely for this region — never
  // substitute within the same modality, per the research's "app can't safely triage" guardrail.
  const acuteConflict = candidates.some((row) => hasExclusionOverlap(row.injuryExclusionTags, acuteIds));
  if (acuteConflict) {
    return { exercise: buildConservativeExercise(), acuteConflict: true };
  }

  const safeCandidates = candidates.filter((row) => !hasExclusionOverlap(row.injuryExclusionTags, chronicIds));
  const picked = safeCandidates.at(0);

  if (!picked) {
    return { exercise: buildConservativeExercise(), acuteConflict: false };
  }

  return { exercise: buildExerciseFromRow(picked, questionnaire.trainingAge), acuteConflict: false };
}

function injuryIdsByStatus(injuries: DeclaredInjury[], status: InjuryStatus): InjuryOptionId[] {
  return injuries.filter((injury) => injury.status === status).map((injury) => injury.id);
}

function hasExclusionOverlap(tags: InjuryOptionId[], injuryIds: InjuryOptionId[]): boolean {
  return tags.some((tag) => injuryIds.includes(tag));
}

function passesGrade(exercise: ExerciseLibraryRow, climbingGrade: ClimbingGrade): boolean {
  const gradeIndex = CLIMBING_GRADES.indexOf(climbingGrade);
  const minIndex = CLIMBING_GRADES.indexOf(exercise.minGrade);
  const maxIndex = CLIMBING_GRADES.indexOf(exercise.maxGrade);
  return gradeIndex >= minIndex && gradeIndex <= maxIndex;
}

function passesEquipment(exercise: ExerciseLibraryRow, equipmentAccess: QuestionnaireResponseInput["equipmentAccess"]) {
  return exercise.equipmentRequired.every((required) => equipmentAccess.includes(required));
}

function buildExerciseFromRow(row: ExerciseLibraryRow, trainingAge: TrainingAge): RecommendedExerciseInput {
  const needsCaution = TRAINING_AGES.indexOf(trainingAge) < TRAINING_AGES.indexOf(row.trainingAgeGate);

  return {
    exerciseName: row.exerciseName,
    sets: row.defaultSets,
    reps: row.defaultReps,
    notes: needsCaution ? (row.cautionNote ?? "Reduce intensity and volume until more training age is built.") : null,
  };
}

function buildConservativeExercise(): RecommendedExerciseInput {
  return {
    exerciseName: "Conservative rest and gentle mobility",
    notes:
      "Declared acute injury in this area — specific exercise substitution skipped; see a professional before resuming loaded training here.",
  };
}

function buildSummary(questionnaire: QuestionnaireResponseInput, anyAcuteConflict: boolean): string {
  const parts = [GOAL_SUMMARIES[questionnaire.primaryGoal]];

  if (questionnaire.injuryLimitations.length > 0) {
    parts.push(
      `Adjusted for ${questionnaire.injuryLimitations.length} declared injury limitation${questionnaire.injuryLimitations.length === 1 ? "" : "s"}.`,
    );
  }

  if (anyAcuteConflict) {
    parts.push(
      "One or more declared injuries are marked acute — conservative guidance replaces specific exercise substitutions in those areas; see a professional before resuming full training there.",
    );
  }

  if (questionnaire.injuryLimitations.some((injury) => injury.id === "skin-issue")) {
    parts.push(
      "Reduce this week's overall training volume due to a declared skin issue (flappers, calluses, or splits).",
    );
  }

  return parts.join(" ");
}
