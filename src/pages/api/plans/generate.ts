import type { APIRoute } from "astro";
import { isInjuryOptionId, isInjuryStatus } from "@/lib/injury-options";
import { createPlanPersistence, PlanPersistenceError } from "@/lib/plan-persistence";
import { generateWeeklyPlan } from "@/lib/plan-generator";
import type { PlanQuestionnaireResponse } from "@/lib/plan-flow-types";
import { createClient } from "@/lib/supabase";
import {
  CLIMBING_GRADES,
  EQUIPMENT_OPTIONS,
  PRIMARY_GOALS,
  TRAINING_AGES,
  type EquipmentOption,
  type PrimaryGoal,
  type QuestionnaireResponseInput,
  type TrainingAge,
} from "@/lib/plan-types";

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const contentType = context.request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return jsonResponse<PlanQuestionnaireResponse>(
      {
        ok: false,
        error: "Send questionnaire answers as JSON.",
      },
      415,
    );
  }

  let payload: unknown;
  try {
    payload = await context.request.json();
  } catch {
    return jsonResponse<PlanQuestionnaireResponse>(
      {
        ok: false,
        error: "Questionnaire payload must be valid JSON.",
      },
      400,
    );
  }

  const validationError = validateQuestionnaireRequest(payload);
  if (validationError) {
    return jsonResponse<PlanQuestionnaireResponse>(
      {
        ok: false,
        error: validationError,
      },
      400,
    );
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonResponse({ error: "Supabase is not configured" }, 503);
  }

  const questionnaire = readQuestionnaire(payload);
  const persistence = createPlanPersistence(supabase);

  try {
    const plan = await generateWeeklyPlan(supabase, questionnaire);
    const savedPlan = await persistence.saveCurrentPlan(context.locals.user.id, {
      questionnaire,
      weeklyPlan: plan,
    });

    return jsonResponse<PlanQuestionnaireResponse>(
      {
        ok: true,
        plan: savedPlan,
      },
      200,
    );
  } catch (error) {
    const message =
      error instanceof PlanPersistenceError || error instanceof Error
        ? error.message
        : "Plan generation failed unexpectedly.";

    return jsonResponse<PlanQuestionnaireResponse>(
      {
        ok: false,
        error: message,
      },
      500,
    );
  }
};

function validateQuestionnaireRequest(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return "Questionnaire payload is required.";
  }

  const payloadRecord = payload as Record<string, unknown>;
  const questionnaire = payloadRecord.questionnaire;

  if (!questionnaire || typeof questionnaire !== "object") {
    return "Questionnaire answers are required.";
  }

  const questionnaireRecord = questionnaire as Record<string, unknown>;
  if (typeof questionnaireRecord.climbingGrade !== "string") {
    return "Choose a climbing grade before generating a plan.";
  }

  const climbingGrade = questionnaireRecord.climbingGrade.trim();
  if (climbingGrade === "") {
    return "Choose a climbing grade before generating a plan.";
  }

  if (!CLIMBING_GRADES.includes(climbingGrade as (typeof CLIMBING_GRADES)[number])) {
    return "Choose one of the supported climbing grades before generating a plan.";
  }

  const injuryLimitations = questionnaireRecord.injuryLimitations;
  if (!Array.isArray(injuryLimitations)) {
    return "Injury limitations must be sent as a list.";
  }

  for (const injury of injuryLimitations) {
    if (!injury || typeof injury !== "object") {
      return "One or more injury limitations are not recognized.";
    }

    const injuryRecord = injury as Record<string, unknown>;
    if (typeof injuryRecord.id !== "string" || !isInjuryOptionId(injuryRecord.id)) {
      return "One or more injury limitations are not recognized.";
    }

    if (typeof injuryRecord.status !== "string" || !isInjuryStatus(injuryRecord.status)) {
      return "Each declared injury must be marked acute or chronic.";
    }
  }

  if (
    typeof questionnaireRecord.trainingAge !== "string" ||
    !TRAINING_AGES.includes(questionnaireRecord.trainingAge as TrainingAge)
  ) {
    return "Choose your training age before generating a plan.";
  }

  const sessionsPerWeek = questionnaireRecord.sessionsPerWeek;
  if (
    typeof sessionsPerWeek !== "number" ||
    !Number.isInteger(sessionsPerWeek) ||
    sessionsPerWeek < 1 ||
    sessionsPerWeek > 7
  ) {
    return "Choose how many sessions per week you can train (1-7).";
  }

  const equipmentAccess = questionnaireRecord.equipmentAccess;
  if (!Array.isArray(equipmentAccess)) {
    return "Equipment access must be sent as a list.";
  }

  for (const equipment of equipmentAccess) {
    if (typeof equipment !== "string" || !EQUIPMENT_OPTIONS.includes(equipment as EquipmentOption)) {
      return "One or more equipment options are not recognized.";
    }
  }

  if (
    typeof questionnaireRecord.primaryGoal !== "string" ||
    !PRIMARY_GOALS.includes(questionnaireRecord.primaryGoal as PrimaryGoal)
  ) {
    return "Choose your primary training goal before generating a plan.";
  }

  return null;
}

function jsonResponse(body: PlanQuestionnaireResponse | { error: string }, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function readQuestionnaire(payload: unknown): QuestionnaireResponseInput {
  const payloadRecord = payload as Record<string, unknown>;
  const questionnaireRecord = payloadRecord.questionnaire as Record<string, unknown>;
  const climbingGrade = questionnaireRecord.climbingGrade as string;
  const injuryLimitations = questionnaireRecord.injuryLimitations as QuestionnaireResponseInput["injuryLimitations"];

  // validateQuestionnaireRequest already rejected anything malformed before this runs, so these
  // casts just carry the already-validated shape through.
  return {
    climbingGrade: climbingGrade.trim() as QuestionnaireResponseInput["climbingGrade"],
    injuryLimitations: dedupeInjuries(injuryLimitations),
    trainingAge: questionnaireRecord.trainingAge as QuestionnaireResponseInput["trainingAge"],
    sessionsPerWeek: questionnaireRecord.sessionsPerWeek as number,
    equipmentAccess: (questionnaireRecord.equipmentAccess ?? []) as QuestionnaireResponseInput["equipmentAccess"],
    primaryGoal: questionnaireRecord.primaryGoal as QuestionnaireResponseInput["primaryGoal"],
  };
}

function dedupeInjuries(
  injuries: QuestionnaireResponseInput["injuryLimitations"],
): QuestionnaireResponseInput["injuryLimitations"] {
  return [...new Map(injuries.map((injury) => [injury.id, injury])).values()];
}
