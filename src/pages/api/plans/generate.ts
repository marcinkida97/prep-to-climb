import type { APIRoute } from "astro";
import { isInjuryOptionId } from "@/lib/injury-options";
import type { PlanQuestionnaireResponse } from "@/lib/plan-flow-types";

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

  return jsonResponse<PlanQuestionnaireResponse>(
    {
      ok: false,
      error:
        "Plan generation is not enabled yet. The request contract is live, and the real generated response lands in the next phase.",
    },
    501,
  );
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
