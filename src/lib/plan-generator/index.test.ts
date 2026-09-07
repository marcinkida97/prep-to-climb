import { describe, expect, it, vi } from "vitest";
import { generateWeeklyPlan } from "./index";
import type { ClimbingGrade } from "@/lib/plan-types";
import type { InjuryOptionId } from "@/lib/injury-options";
import type { PlanTemplate } from "./templates";

// Expected values below are hand-authored from the business-rule intent in
// context/archive/2026-06-14-first-weekly-plan-flow/plan.md plus the
// template/injury-rule content itself (read once, then typed out here as
// literals) — never derived by importing PLAN_TEMPLATES/INJURY_RULES and
// asserting the generator's output matches its own source data.

describe("generateWeeklyPlan — template selection by grade", () => {
  it.each<[ClimbingGrade, string, string]>([
    [
      "5C",
      "Technique",
      "A steady week that builds movement quality, pulling strength, and recovery habits for emerging intermediate climbers.",
    ],
    [
      "6A",
      "Technique",
      "A steady week that builds movement quality, pulling strength, and recovery habits for emerging intermediate climbers.",
    ],
    [
      "6B",
      "Limit bouldering",
      "A balanced week for intermediate climbers who need structured strength, finger work, and purposeful recovery.",
    ],
    [
      "6C",
      "Limit bouldering",
      "A balanced week for intermediate climbers who need structured strength, finger work, and purposeful recovery.",
    ],
    [
      "7A",
      "Power",
      "A higher-intensity week that alternates quality power work with finger strength and deliberate recovery.",
    ],
    [
      "7B",
      "Power",
      "A higher-intensity week that alternates quality power work with finger strength and deliberate recovery.",
    ],
  ])(
    "grade %s selects its intended template (also the zero-injury baseline)",
    (climbingGrade, day1FocusArea, summary) => {
      const result = generateWeeklyPlan({ climbingGrade, injuryLimitations: [] });

      expect(result.summary).toBe(summary);
      expect(result.days).toHaveLength(7);
      expect(result.days[0].dayLabel).toBe("Monday");
      expect(result.days[0].focusArea).toBe(day1FocusArea);
    },
  );
});

describe("generateWeeklyPlan — zero-injury baseline leaves conflict-eligible exercises untouched", () => {
  it("does not substitute anything when no injuries are declared", () => {
    const result = generateWeeklyPlan({ climbingGrade: "6B", injuryLimitations: [] });

    expect(result.summary).toBe(
      "A balanced week for intermediate climbers who need structured strength, finger work, and purposeful recovery.",
    );
    expect(result.days[1].recommendedExercises[0].exerciseName).toBe("Weighted pull-ups");
    expect(result.days[3].recommendedExercises[0].exerciseName).toBe("Half-crimp repeaters");
  });
});

describe("generateWeeklyPlan — single-injury substitution", () => {
  it("left-shoulder-strain substitutes the base-builder pulling exercise and appends the substitution note", () => {
    const result = generateWeeklyPlan({
      climbingGrade: "6A",
      injuryLimitations: ["left-shoulder-strain"],
    });

    const strengthDay = result.days[1];
    expect(strengthDay.recommendedExercises[0]).toEqual({
      exerciseName: "Scapular wall slides",
      sets: "3",
      reps: "10 reps",
    });
    expect(strengthDay.recommendedExercises[1].exerciseName).toBe("Tempo goblet squats");
    expect(strengthDay.notes).toBe(
      "Build general pulling strength without max intensity. Shoulder strain substitution: replace loaded pulling with lower-risk shoulder stability work.",
    );
    expect(result.summary).toBe(
      "A steady week that builds movement quality, pulling strength, and recovery habits for emerging intermediate climbers. Adjusted for 1 declared injury limitation.",
    );
  });

  it("right-shoulder-strain substitutes the same way as left-shoulder-strain", () => {
    const result = generateWeeklyPlan({
      climbingGrade: "6A",
      injuryLimitations: ["right-shoulder-strain"],
    });

    expect(result.days[1].recommendedExercises[0].exerciseName).toBe("Scapular wall slides");
  });

  it("left-elbow-tendon substitutes the base-builder pulling exercise with an isometric alternative", () => {
    const result = generateWeeklyPlan({
      climbingGrade: "6A",
      injuryLimitations: ["left-elbow-tendon"],
    });

    const strengthDay = result.days[1];
    expect(strengthDay.recommendedExercises[0]).toEqual({
      exerciseName: "Isometric row holds",
      sets: "3",
      reps: "20 sec",
    });
    expect(strengthDay.notes).toBe(
      "Build general pulling strength without max intensity. Elbow tendon substitution: reduce repeated flexion strain with controlled isometrics.",
    );
  });

  it("right-elbow-tendon substitutes the same way as left-elbow-tendon", () => {
    const result = generateWeeklyPlan({
      climbingGrade: "6A",
      injuryLimitations: ["right-elbow-tendon"],
    });

    expect(result.days[1].recommendedExercises[0].exerciseName).toBe("Isometric row holds");
  });

  it("left-fingers-pulley substitutes the base-builder finger exercise", () => {
    const result = generateWeeklyPlan({
      climbingGrade: "6A",
      injuryLimitations: ["left-fingers-pulley"],
    });

    const fingerDay = result.days[3];
    expect(fingerDay.recommendedExercises[0]).toEqual({
      exerciseName: "Grip recovery squeezes",
      sets: "3",
      reps: "12 reps",
    });
    expect(fingerDay.recommendedExercises[1].exerciseName).toBe("Scapular pulls");
    expect(fingerDay.notes).toBe(
      "Use open-hand grips and avoid pain. Finger pulley substitution: use low-load recovery grip work instead of repeaters.",
    );
  });

  it("right-fingers-pulley substitutes the same way as left-fingers-pulley", () => {
    const result = generateWeeklyPlan({
      climbingGrade: "6A",
      injuryLimitations: ["right-fingers-pulley"],
    });

    expect(result.days[3].recommendedExercises[0].exerciseName).toBe("Grip recovery squeezes");
  });
});

describe("generateWeeklyPlan — multi-injury combinations", () => {
  it("substitutes independently across two different conflict days and pluralizes the summary suffix", () => {
    const result = generateWeeklyPlan({
      climbingGrade: "6A",
      injuryLimitations: ["left-shoulder-strain", "left-fingers-pulley"],
    });

    expect(result.days[1].recommendedExercises[0].exerciseName).toBe("Scapular wall slides");
    expect(result.days[3].recommendedExercises[0].exerciseName).toBe("Grip recovery squeezes");
    expect(result.summary).toBe(
      "A steady week that builds movement quality, pulling strength, and recovery habits for emerging intermediate climbers. Adjusted for 2 declared injury limitations.",
    );
  });

  it("two injuries conflicting with the same exercise still resolve to one substitution", () => {
    const result = generateWeeklyPlan({
      climbingGrade: "6A",
      injuryLimitations: ["left-shoulder-strain", "right-shoulder-strain"],
    });

    expect(result.days[1].recommendedExercises[0].exerciseName).toBe("Scapular wall slides");
    expect(result.summary).toContain("Adjusted for 2 declared injury limitations.");
  });

  it("combines an elbow and a finger substitution on the strength-skill template with exercise-specific note text", () => {
    const result = generateWeeklyPlan({
      climbingGrade: "6B",
      injuryLimitations: ["left-elbow-tendon", "left-fingers-pulley"],
    });

    const strengthDay = result.days[1];
    const fingerDay = result.days[3];
    expect(strengthDay.recommendedExercises[0]).toEqual({
      exerciseName: "Isometric row holds",
      sets: "3",
      reps: "20 sec",
    });
    expect(strengthDay.notes).toBe(
      "Use controlled pulling volume and stop before pain. Elbow tendon substitution: swap heavy pull-ups for lower-load isometric pulling.",
    );
    expect(fingerDay.recommendedExercises[0]).toEqual({
      exerciseName: "Forearm extensors",
      sets: "3",
      reps: "15 reps",
    });
    expect(fingerDay.notes).toBe(
      "Maintain quality grips and cut the session if any finger pain appears. Finger pulley substitution: unload high-force finger work and reinforce the antagonist side.",
    );
  });
});

describe("generateWeeklyPlan — known gaps (pinned, not fixed; see plan Phase 1 'What We're NOT Doing')", () => {
  it("silently falls back to the first template for an out-of-domain grade instead of erroring", () => {
    // KNOWN GAP: this is the same defect class as the recorded incident in
    // context/foundation/improvements.md item 1. The live route currently
    // prevents any real user from reaching this path (see generate.ts's
    // validateQuestionnaireRequest), but the generator itself still has no
    // guard. This test pins today's actual (undesirable) behavior so a
    // future change can't silently reopen this without a test noticing —
    // it does not endorse the fallback as correct.
    const result = generateWeeklyPlan({
      climbingGrade: "9A" as unknown as ClimbingGrade,
      injuryLimitations: [],
    });

    expect(result.summary).toBe(
      "A steady week that builds movement quality, pulling strength, and recovery habits for emerging intermediate climbers.",
    );
    expect(result.days[0].focusArea).toBe("Technique");
  });

  it("throws if a declared conflict references an injury id absent from INJURY_RULES", async () => {
    // KNOWN GAP: today every InjuryOptionId has a matching INJURY_RULES
    // entry, so this can only happen if a future template references an
    // injury id whose rule entry was never added. Pinned via a fixture
    // template (not the real PLAN_TEMPLATES) so this test doesn't depend on
    // that gap ever becoming reachable through real content.
    vi.resetModules();
    vi.doMock("./templates", () => {
      const fixtureTemplate: PlanTemplate = {
        id: "fixture-unknown-injury",
        title: "Fixture",
        gradeMatches: ["5C"],
        summary: "Fixture template for pinning the unknown-injury crash.",
        days: [
          {
            dayNumber: 1,
            dayLabel: "Monday",
            focusArea: "Fixture",
            notes: null,
            recommendedExercises: [{ exerciseName: "Fixture exercise" }],
            exerciseInjuryConflicts: { 0: ["not-a-real-injury-id" as unknown as InjuryOptionId] },
          },
        ],
      };
      return { PLAN_TEMPLATES: [fixtureTemplate] };
    });

    const { generateWeeklyPlan: generateWithFixtureTemplate } = await import("./index");

    expect(() =>
      generateWithFixtureTemplate({
        climbingGrade: "5C",
        injuryLimitations: ["not-a-real-injury-id" as unknown as InjuryOptionId],
      }),
    ).toThrow(TypeError);

    vi.doUnmock("./templates");
    vi.resetModules();
  });
});
