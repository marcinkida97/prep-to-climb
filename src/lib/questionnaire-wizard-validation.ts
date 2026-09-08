import type { QuestionnaireDraftInput } from "@/lib/plan-types";

export const WIZARD_STEPS = ["profile", "context", "injuries"] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number];

export interface QuestionnaireFieldErrors {
  climbingGrade?: string;
  trainingAge?: string;
  sessionsPerWeek?: string;
  primaryGoal?: string;
}

export function getStepErrors(step: WizardStepId, draft: QuestionnaireDraftInput): QuestionnaireFieldErrors {
  switch (step) {
    case "profile": {
      const errors: QuestionnaireFieldErrors = {};

      if (!draft.climbingGrade) {
        errors.climbingGrade = "Choose your current climbing grade before generating a plan.";
      }
      if (!draft.trainingAge) {
        errors.trainingAge = "Choose how long you've been training before generating a plan.";
      }
      if (
        draft.sessionsPerWeek === "" ||
        !Number.isInteger(draft.sessionsPerWeek) ||
        draft.sessionsPerWeek < 1 ||
        draft.sessionsPerWeek > 7
      ) {
        errors.sessionsPerWeek = "Choose how many sessions per week you can train (1-7).";
      }

      return errors;
    }
    case "context": {
      const errors: QuestionnaireFieldErrors = {};

      if (!draft.primaryGoal) {
        errors.primaryGoal = "Choose your primary training goal before generating a plan.";
      }

      return errors;
    }
    case "injuries":
      return {};
  }
}

export function isStepValid(step: WizardStepId, draft: QuestionnaireDraftInput): boolean {
  return Object.keys(getStepErrors(step, draft)).length === 0;
}
