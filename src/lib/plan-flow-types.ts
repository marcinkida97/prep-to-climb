import type { PersistedCurrentPlan, QuestionnaireResponseInput } from "@/lib/plan-types";

export interface PlanQuestionnaireRequest {
  questionnaire: QuestionnaireResponseInput;
}

export interface PlanQuestionnaireSuccessResponse {
  ok: true;
  plan: PersistedCurrentPlan;
}

export interface PlanQuestionnaireErrorResponse {
  ok: false;
  error: string;
}

export type PlanQuestionnaireResponse = PlanQuestionnaireSuccessResponse | PlanQuestionnaireErrorResponse;
