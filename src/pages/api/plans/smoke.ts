import type { APIRoute } from "astro";
import { createPlanPersistence } from "@/lib/plan-persistence";
import { createClient } from "@/lib/supabase";

const smokePayload = {
  questionnaire: {
    climbingGrade: "6B",
    injuryLimitations: ["left shoulder"],
  },
  weeklyPlan: {
    summary: "Smoke-test weekly plan for authenticated persistence verification.",
    days: [
      {
        dayNumber: 1,
        dayLabel: "Monday",
        focusArea: "Technique",
        notes: "Keep intensity moderate.",
        recommendedExercises: [
          { exerciseName: "Easy bouldering", sets: "1 session", reps: "45 min" },
          { exerciseName: "Shoulder mobility", sets: "3", reps: "10 reps" },
        ],
      },
      {
        dayNumber: 2,
        dayLabel: "Tuesday",
        focusArea: "Recovery",
        notes: "Prioritize range of motion.",
        recommendedExercises: [{ exerciseName: "Band external rotations", sets: "3", reps: "12 reps" }],
      },
      {
        dayNumber: 3,
        dayLabel: "Wednesday",
        focusArea: "Strength",
        notes: "Stop before pain.",
        recommendedExercises: [{ exerciseName: "Assisted pull-ups", sets: "4", reps: "5 reps" }],
      },
      {
        dayNumber: 4,
        dayLabel: "Thursday",
        focusArea: "Rest",
        notes: "Full rest day.",
        recommendedExercises: [{ exerciseName: "Walking", sets: "1", reps: "30 min" }],
      },
      {
        dayNumber: 5,
        dayLabel: "Friday",
        focusArea: "Power endurance",
        notes: "Short linked problems.",
        recommendedExercises: [{ exerciseName: "4x4 traverses", sets: "4", reps: "4 laps" }],
      },
      {
        dayNumber: 6,
        dayLabel: "Saturday",
        focusArea: "Climb day",
        notes: "Outdoor or gym session.",
        recommendedExercises: [{ exerciseName: "Route mileage", sets: "1 session", reps: "60 min" }],
      },
      {
        dayNumber: 7,
        dayLabel: "Sunday",
        focusArea: "Mobility",
        notes: "Reset before next week.",
        recommendedExercises: [{ exerciseName: "Thoracic rotations", sets: "3", reps: "8 reps" }],
      },
    ],
  },
};

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Supabase is not configured" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const persistence = createPlanPersistence(supabase);
    const savedPlan = await persistence.saveCurrentPlan(context.locals.user.id, smokePayload);
    const latestPlan = await persistence.getCurrentPlan(context.locals.user.id);

    return new Response(
      JSON.stringify(
        {
          ok: true,
          userId: context.locals.user.id,
          questionnaireSaved: savedPlan.questionnaire,
          latestPlan,
        },
        null,
        2,
      ),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown persistence error";

    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
