import { describe, expect, it } from "vitest";
import { generateWeeklyPlan } from "./index";
import type { DeclaredInjury } from "@/lib/injury-options";
import type { QuestionnaireResponseInput } from "@/lib/plan-types";
import type { SupabaseServerClient } from "@/lib/supabase";

// Fixture library rows are hand-authored here, independent of the real seed data in
// supabase/migrations/20260907120000_plan_generation_v2.sql, so these tests exercise the
// assembler's rules rather than asserting its output matches its own source data.
const FIXTURE_LIBRARY_ROWS = [
  {
    id: "technique-1",
    exercise_name: "Footwork ladder",
    modality: "technique",
    min_grade: "5C",
    max_grade: "7B",
    training_age_gate: "under_6_months",
    equipment_required: [],
    injury_exclusion_tags: [],
    default_sets: "4",
    default_reps: "4 boulders",
    caution_note: null,
  },
  {
    id: "power-1",
    exercise_name: "Campus ladders",
    modality: "power",
    min_grade: "6B",
    max_grade: "7B",
    training_age_gate: "2_plus_years",
    equipment_required: ["campus_board"],
    injury_exclusion_tags: [],
    default_sets: "4",
    default_reps: "3 reps",
    caution_note: "Needs 2+ years of training age before full campus loading.",
  },
  {
    id: "power-2",
    exercise_name: "Bodyweight power steps",
    modality: "power",
    min_grade: "5C",
    max_grade: "6A",
    training_age_gate: "under_6_months",
    equipment_required: [],
    injury_exclusion_tags: [],
    default_sets: "3",
    default_reps: "6 reps",
    caution_note: null,
  },
  {
    id: "power-endurance-1",
    exercise_name: "4x4 circuits",
    modality: "power_endurance",
    min_grade: "5C",
    max_grade: "7B",
    training_age_gate: "under_6_months",
    equipment_required: ["gym"],
    injury_exclusion_tags: [],
    default_sets: "4",
    default_reps: "4 laps",
    caution_note: null,
  },
  {
    id: "power-endurance-2",
    exercise_name: "Bodyweight conditioning circuit",
    modality: "power_endurance",
    min_grade: "5C",
    max_grade: "7B",
    training_age_gate: "under_6_months",
    equipment_required: [],
    injury_exclusion_tags: [],
    default_sets: "4 rounds",
    default_reps: "45 sec on / 15 sec off",
    caution_note: null,
  },
  {
    id: "aerobic-1",
    exercise_name: "ARC traversing",
    modality: "aerobic_capacity",
    min_grade: "5C",
    max_grade: "7B",
    training_age_gate: "under_6_months",
    equipment_required: ["gym"],
    injury_exclusion_tags: [],
    default_sets: "1",
    default_reps: "30 min",
    caution_note: null,
  },
  {
    id: "finger-1",
    exercise_name: "Aggressive max hangs",
    modality: "finger_strength",
    min_grade: "5C",
    max_grade: "7B",
    training_age_gate: "under_6_months",
    equipment_required: ["hangboard"],
    injury_exclusion_tags: ["left-fingers-pulley", "right-fingers-pulley"],
    default_sets: "5",
    default_reps: "7 sec",
    caution_note: null,
  },
  {
    id: "finger-2",
    exercise_name: "Board repeaters",
    modality: "finger_strength",
    min_grade: "5C",
    max_grade: "7B",
    training_age_gate: "under_6_months",
    equipment_required: ["hangboard"],
    injury_exclusion_tags: ["left-fingers-pulley", "right-fingers-pulley"],
    default_sets: "3",
    default_reps: "6 reps",
    caution_note: null,
  },
  {
    id: "finger-3",
    exercise_name: "Grip recovery squeezes",
    modality: "finger_strength",
    min_grade: "5C",
    max_grade: "7B",
    training_age_gate: "under_6_months",
    equipment_required: [],
    injury_exclusion_tags: [],
    default_sets: "3",
    default_reps: "12 reps",
    caution_note: null,
  },
  {
    id: "antagonist-1",
    exercise_name: "Scapular stability",
    modality: "antagonist",
    min_grade: "5C",
    max_grade: "7B",
    training_age_gate: "under_6_months",
    equipment_required: [],
    injury_exclusion_tags: [],
    default_sets: "3",
    default_reps: "10 reps",
    caution_note: null,
  },
];

function buildFakeSupabase(rows: unknown[] = FIXTURE_LIBRARY_ROWS): SupabaseServerClient {
  return {
    from: (table: string) => {
      if (table !== "exercise_library") {
        throw new Error(`Unexpected table queried in test: ${table}`);
      }

      return {
        select: () => Promise.resolve({ data: rows, error: null }),
      };
    },
  } as unknown as SupabaseServerClient;
}

function baseQuestionnaire(overrides: Partial<QuestionnaireResponseInput> = {}): QuestionnaireResponseInput {
  return {
    climbingGrade: "6A",
    injuryLimitations: [],
    trainingAge: "2_plus_years",
    sessionsPerWeek: 5,
    equipmentAccess: ["hangboard", "campus_board", "gym"],
    primaryGoal: "send_grade",
    ...overrides,
  };
}

describe("generateWeeklyPlan — day structure", () => {
  it("assembles a 7-day plan with Monday-Sunday labels and a rest-only Sunday", async () => {
    const result = await generateWeeklyPlan(buildFakeSupabase(), baseQuestionnaire());

    expect(result.days).toHaveLength(7);
    expect(result.days.map((day) => day.dayLabel)).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    expect(result.days[6].focusArea).toBe("Rest");
    expect(result.days[6].recommendedExercises).toHaveLength(0);
  });
});

describe("generateWeeklyPlan — equipment constraint", () => {
  it("never selects an exercise requiring equipment the user doesn't have", async () => {
    const result = await generateWeeklyPlan(buildFakeSupabase(), baseQuestionnaire({ equipmentAccess: [] }));

    const capacityDay = result.days[4];
    expect(capacityDay.recommendedExercises[0].exerciseName).toBe("Bodyweight conditioning circuit");
    expect(result.days.flatMap((day) => day.recommendedExercises.map((ex) => ex.exerciseName))).not.toContain(
      "4x4 circuits",
    );
  });
});

describe("generateWeeklyPlan — chronic injury exclusion", () => {
  it("never yields an exercise conflicting with a chronic injury", async () => {
    const injuryLimitations: DeclaredInjury[] = [{ id: "left-fingers-pulley", status: "chronic" }];
    const result = await generateWeeklyPlan(buildFakeSupabase(), baseQuestionnaire({ injuryLimitations }));

    const fingerDay = result.days[3];
    expect(fingerDay.recommendedExercises[0].exerciseName).toBe("Grip recovery squeezes");
    expect(result.summary).toContain("Adjusted for 1 declared injury limitation.");
  });
});

describe("generateWeeklyPlan — acute injury conservative fallback", () => {
  it("omits region-specific exercises and adds a conservative disclaimer for an acute injury", async () => {
    const injuryLimitations: DeclaredInjury[] = [{ id: "left-fingers-pulley", status: "acute" }];
    const result = await generateWeeklyPlan(buildFakeSupabase(), baseQuestionnaire({ injuryLimitations }));

    const fingerDay = result.days[3];
    expect(fingerDay.recommendedExercises[0].exerciseName).toBe("Conservative rest and gentle mobility");
    expect(fingerDay.notes).toContain("Conservative guidance applied");
    expect(result.summary).toContain("see a professional");
  });
});

describe("generateWeeklyPlan — training-age soft gate", () => {
  it("keeps a campus/power exercise above the user's training age but attaches its caution note", async () => {
    const result = await generateWeeklyPlan(
      buildFakeSupabase(),
      baseQuestionnaire({ climbingGrade: "6B", primaryGoal: "power", trainingAge: "under_6_months" }),
    );

    const strengthDay = result.days[1];
    expect(strengthDay.recommendedExercises[0].exerciseName).toBe("Campus ladders");
    expect(strengthDay.recommendedExercises[0].notes).toBe(
      "Needs 2+ years of training age before full campus loading.",
    );
  });
});

describe("generateWeeklyPlan — sessionsPerWeek bounds training days", () => {
  it("converts lower-priority session days to rest when sessionsPerWeek is small", async () => {
    const result = await generateWeeklyPlan(buildFakeSupabase(), baseQuestionnaire({ sessionsPerWeek: 2 }));

    // Priority order is [Monday, Thursday, Tuesday, Friday, Saturday]; only the first 2 stay active.
    expect(result.days[0].focusArea).not.toBe("Rest");
    expect(result.days[3].focusArea).not.toBe("Rest");
    expect(result.days[1].focusArea).toBe("Rest");
    expect(result.days[4].focusArea).toBe("Rest");
    expect(result.days[5].focusArea).toBe("Rest");
    expect(result.days[1].recommendedExercises).toHaveLength(0);
    // Recovery (Wednesday) and the fixed rest day (Sunday) are unaffected by the session count.
    expect(result.days[2].focusArea).toBe("Recovery");
  });
});

describe("generateWeeklyPlan — skin issue volume note", () => {
  it("adds a general volume-reduction note to the summary without excluding any exercise", async () => {
    const injuryLimitations: DeclaredInjury[] = [{ id: "skin-issue", status: "chronic" }];
    const result = await generateWeeklyPlan(buildFakeSupabase(), baseQuestionnaire({ injuryLimitations }));

    expect(result.summary).toContain("Reduce this week's overall training volume due to a declared skin issue");
  });
});
