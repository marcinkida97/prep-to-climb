import { describe, expect, it } from "vitest";
import { getStepErrors, isStepValid } from "./questionnaire-wizard-validation";
import type { QuestionnaireDraftInput } from "@/lib/plan-types";

function baseDraft(overrides: Partial<QuestionnaireDraftInput> = {}): QuestionnaireDraftInput {
  return {
    climbingGrade: "6B",
    injuryLimitations: [],
    trainingAge: "2_plus_years",
    sessionsPerWeek: 3,
    equipmentAccess: [],
    primaryGoal: "general_fitness",
    ...overrides,
  };
}

describe("getStepErrors", () => {
  describe("profile step", () => {
    it("returns no errors when climbing grade, training age, and sessions per week are all valid", () => {
      expect(getStepErrors("profile", baseDraft())).toEqual({});
    });

    it("requires a climbing grade", () => {
      expect(getStepErrors("profile", baseDraft({ climbingGrade: "" }))).toEqual({
        climbingGrade: "Choose your current climbing grade before generating a plan.",
      });
    });

    it("requires a training age", () => {
      expect(getStepErrors("profile", baseDraft({ trainingAge: "" }))).toEqual({
        trainingAge: "Choose how long you've been training before generating a plan.",
      });
    });

    it("requires sessions per week to be set", () => {
      expect(getStepErrors("profile", baseDraft({ sessionsPerWeek: "" }))).toEqual({
        sessionsPerWeek: "Choose how many sessions per week you can train (1-7).",
      });
    });

    it("rejects sessions per week below the 1-7 range", () => {
      expect(getStepErrors("profile", baseDraft({ sessionsPerWeek: 0 }))).toEqual({
        sessionsPerWeek: "Choose how many sessions per week you can train (1-7).",
      });
    });

    it("rejects sessions per week above the 1-7 range", () => {
      expect(getStepErrors("profile", baseDraft({ sessionsPerWeek: 8 }))).toEqual({
        sessionsPerWeek: "Choose how many sessions per week you can train (1-7).",
      });
    });

    it("accepts sessions per week at the lower boundary (1)", () => {
      expect(getStepErrors("profile", baseDraft({ sessionsPerWeek: 1 }))).toEqual({});
    });

    it("accepts sessions per week at the upper boundary (7)", () => {
      expect(getStepErrors("profile", baseDraft({ sessionsPerWeek: 7 }))).toEqual({});
    });

    it("reports every missing required field at once", () => {
      expect(getStepErrors("profile", baseDraft({ climbingGrade: "", trainingAge: "", sessionsPerWeek: "" }))).toEqual({
        climbingGrade: "Choose your current climbing grade before generating a plan.",
        trainingAge: "Choose how long you've been training before generating a plan.",
        sessionsPerWeek: "Choose how many sessions per week you can train (1-7).",
      });
    });
  });

  describe("context step", () => {
    it("returns no errors when a primary goal is selected", () => {
      expect(getStepErrors("context", baseDraft())).toEqual({});
    });

    it("requires a primary goal", () => {
      expect(getStepErrors("context", baseDraft({ primaryGoal: "" }))).toEqual({
        primaryGoal: "Choose your primary training goal before generating a plan.",
      });
    });

    it("does not require equipment access", () => {
      expect(getStepErrors("context", baseDraft({ equipmentAccess: [] }))).toEqual({});
    });
  });

  describe("injuries step", () => {
    it("has no required fields when no injuries are declared", () => {
      expect(getStepErrors("injuries", baseDraft({ injuryLimitations: [] }))).toEqual({});
    });

    it("has no required fields even when injuries are declared", () => {
      expect(
        getStepErrors("injuries", baseDraft({ injuryLimitations: [{ id: "left-shoulder-strain", status: "acute" }] })),
      ).toEqual({});
    });
  });
});

describe("isStepValid", () => {
  it("is true when the step has no errors", () => {
    expect(isStepValid("profile", baseDraft())).toBe(true);
  });

  it("is false when the step has at least one error", () => {
    expect(isStepValid("profile", baseDraft({ climbingGrade: "" }))).toBe(false);
  });

  it("is always true for the injuries step", () => {
    expect(isStepValid("injuries", baseDraft({ climbingGrade: "" }))).toBe(true);
  });
});
