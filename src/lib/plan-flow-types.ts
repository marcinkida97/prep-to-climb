import type { PersistedCurrentPlan, QuestionnaireDraftInput, QuestionnaireResponseInput } from "@/lib/plan-types";

export interface PlanQuestionnaireRequest {
  questionnaire: QuestionnaireResponseInput;
}

export interface DashboardQuestionnaireValue {
  questionnaire: QuestionnaireDraftInput;
}

export interface DashboardInitialFirstRunState {
  mode: "first-run";
  draftQuestionnaire: QuestionnaireDraftInput;
}

export interface DashboardInitialSavedPlanState {
  mode: "saved-plan";
  draftQuestionnaire: QuestionnaireDraftInput;
  plan: PersistedCurrentPlan;
}

export interface DashboardInitialRecoveryState {
  mode: "recovery";
  draftQuestionnaire: QuestionnaireDraftInput;
  recoveryMessage: string;
}

export type DashboardInitialState =
  | DashboardInitialFirstRunState
  | DashboardInitialSavedPlanState
  | DashboardInitialRecoveryState;

export interface PlanQuestionnaireSuccessResponse {
  ok: true;
  plan: PersistedCurrentPlan;
}

export interface PlanQuestionnaireErrorResponse {
  ok: false;
  error: string;
}

export type PlanQuestionnaireResponse = PlanQuestionnaireSuccessResponse | PlanQuestionnaireErrorResponse;
