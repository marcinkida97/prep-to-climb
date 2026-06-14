import type { APIRoute } from "astro";

export const POST: APIRoute = (context) => {
  if (!context.locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      ok: false,
      error: "The smoke route is retired. Use POST /api/plans/generate for the protected questionnaire flow.",
    }),
    {
      status: 410,
      headers: { "content-type": "application/json" },
    },
  );
};
