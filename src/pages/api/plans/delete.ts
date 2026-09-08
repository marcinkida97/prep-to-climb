import type { APIRoute } from "astro";
import { createPlanPersistence } from "@/lib/plan-persistence";
import type { PlanDeleteResponse } from "@/lib/plan-flow-types";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonResponse({ error: "Supabase is not configured" }, 503);
  }

  const persistence = createPlanPersistence(supabase);

  try {
    await persistence.deleteCurrentPlan(context.locals.user.id);

    return jsonResponse<PlanDeleteResponse>({ ok: true }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Plan deletion failed unexpectedly.";

    return jsonResponse<PlanDeleteResponse>(
      {
        ok: false,
        error: message,
      },
      500,
    );
  }
};

function jsonResponse(body: PlanDeleteResponse | { error: string }, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
