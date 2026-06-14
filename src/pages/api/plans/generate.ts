import type { APIRoute } from "astro";
import { isInjuryOptionId } from "@/lib/injury-options";
import { createPlanPersistence, PlanPersistenceError } from "@/lib/plan-persistence";
import { generateWeeklyPlan } from "@/lib/plan-generator";
import type { PlanQuestionnaireResponse } from "@/lib/plan-flow-types";
import { createClient } from "@/lib/supabase";
import type { QuestionnaireResponseInput } from "@/lib/plan-types";

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
    const plan = generateWeeklyPlan(questionnaire);
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
  if (typeof questionnaireRecord.climbingGrade !== "string" || questionnaireRecord.climbingGrade.trim() === "") {
    return "Choose a climbing grade before generating a plan.";
  }

  const injuryLimitations = questionnaireRecord.injuryLimitations;
  if (!Array.isArray(injuryLimitations)) {
    return "Injury limitations must be sent as a list.";
  }

  for (const injury of injuryLimitations) {
    if (typeof injury !== "string") {
      return "One or more injury limitations are not recognized.";
    }

    if (!isInjuryOptionId(injury)) {
      return "One or more injury limitations are not recognized.";
    }
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

  return {
    climbingGrade: questionnaireRecord.climbingGrade as QuestionnaireResponseInput["climbingGrade"],
    injuryLimitations: questionnaireRecord.injuryLimitations as QuestionnaireResponseInput["injuryLimitations"],
  };
}
