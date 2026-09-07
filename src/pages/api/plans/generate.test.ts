import { describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { POST } from "./generate";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}));

// Hand-authored, independent of the real seed data in
// supabase/migrations/20260907120000_plan_generation_v2.sql — one row per modality so the
// assembler has something to pick for every day slot regardless of the declared goal.
const FIXTURE_EXERCISE_LIBRARY_ROWS = [
  {
    id: "technique-1",
    exercise_name: "Footwork ladder",
    modality: "technique",
    min_grade: "5C",
    max_grade: "7B",
    training_age_gate: "under_6_months",
    equipment_required: [],
    injury_exclusion_tags: [],
    default_sets: "4",
    default_reps: "4 boulders",
    caution_note: null,
  },
  {
    id: "antagonist-1",
    exercise_name: "Scapular stability",
    modality: "antagonist",
    min_grade: "5C",
    max_grade: "7B",
    training_age_gate: "under_6_months",
    equipment_required: [],
    injury_exclusion_tags: [],
    default_sets: "3",
    default_reps: "10 reps",
    caution_note: null,
  },
  {
    id: "aerobic-1",
    exercise_name: "ARC traversing",
    modality: "aerobic_capacity",
    min_grade: "5C",
    max_grade: "7B",
    training_age_gate: "under_6_months",
    equipment_required: ["gym"],
    injury_exclusion_tags: [],
    default_sets: "1",
    default_reps: "30 min",
    caution_note: null,
  },
  {
    id: "finger-1",
    exercise_name: "Grip recovery squeezes",
    modality: "finger_strength",
    min_grade: "5C",
    max_grade: "7B",
    training_age_gate: "under_6_months",
    equipment_required: [],
    injury_exclusion_tags: [],
    default_sets: "3",
    default_reps: "12 reps",
    caution_note: null,
  },
  {
    id: "power-endurance-1",
    exercise_name: "4x4 circuits",
    modality: "power_endurance",
    min_grade: "5C",
    max_grade: "7B",
    training_age_gate: "under_6_months",
    equipment_required: [],
    injury_exclusion_tags: [],
    default_sets: "4",
    default_reps: "4 laps",
    caution_note: null,
  },
  {
    id: "power-1",
    exercise_name: "Campus ladders",
    modality: "power",
    min_grade: "5C",
    max_grade: "7B",
    training_age_gate: "under_6_months",
    equipment_required: [],
    injury_exclusion_tags: [],
    default_sets: "4",
    default_reps: "3 reps",
    caution_note: null,
  },
];

interface FakeQueryBuilder {
  select: () => FakeQueryBuilder;
  eq: () => FakeQueryBuilder;
  order: () => FakeQueryBuilder;
  limit: () => FakeQueryBuilder;
  maybeSingle: () => Promise<{ data: unknown; error: null }>;
}

function buildFakeSupabase(options: {
  rpcError?: { message: string } | null;
  questionnaireRow?: Record<string, unknown> | null;
  weeklyPlanRow?: Record<string, unknown> | null;
}) {
  const from = vi.fn((table: string) => {
    if (table === "exercise_library") {
      return {
        select: () => Promise.resolve({ data: FIXTURE_EXERCISE_LIBRARY_ROWS, error: null }),
      };
    }

    const row =
      table === "questionnaire_responses" ? (options.questionnaireRow ?? null) : (options.weeklyPlanRow ?? null);
    const builder: FakeQueryBuilder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => Promise.resolve({ data: row, error: null }),
    };
    return builder;
  });

  return {
    rpc: vi.fn().mockResolvedValue({ error: options.rpcError ?? null }),
    from,
  };
}

function buildContext(options: {
  authenticated?: boolean;
  contentType?: string;
  body?: unknown;
  malformedJson?: boolean;
  supabase?: ReturnType<typeof buildFakeSupabase> | null;
}) {
  const headers = new Headers();
  headers.set("content-type", options.contentType ?? "application/json");

  const request = {
    headers,
    json: () =>
      options.malformedJson
        ? Promise.reject(new SyntaxError("Unexpected end of JSON input"))
        : Promise.resolve(options.body),
  };

  const authenticated = options.authenticated ?? true;

  const context = {
    locals: { user: authenticated ? ({ id: "user-1" } as unknown as User) : null },
    request,
    cookies: {},
  };

  return context as unknown as APIContext;
}

function validQuestionnairePayload(overrides: Record<string, unknown> = {}) {
  return {
    climbingGrade: "6A",
    injuryLimitations: [],
    trainingAge: "2_plus_years",
    sessionsPerWeek: 4,
    equipmentAccess: ["gym"],
    primaryGoal: "general_fitness",
    ...overrides,
  };
}

describe("POST /api/plans/generate", () => {
  it("rejects an unauthenticated request with 401 before touching Supabase", async () => {
    const context = buildContext({ authenticated: false });

    const response = await POST(context);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON content-type with 415", async () => {
    const context = buildContext({ contentType: "text/plain", body: {} });

    const response = await POST(context);
    const body = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(415);
    expect(body).toEqual({ ok: false, error: "Send questionnaire answers as JSON." });
  });

  it("rejects malformed JSON with 400", async () => {
    const context = buildContext({ malformedJson: true });

    const response = await POST(context);
    const body = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "Questionnaire payload must be valid JSON." });
  });

  describe("validation branches", () => {
    it.each<[string, unknown, string]>([
      ["payload is not an object", null, "Questionnaire payload is required."],
      ["questionnaire is missing", {}, "Questionnaire answers are required."],
      [
        "climbingGrade is not a string",
        { questionnaire: { climbingGrade: 123, injuryLimitations: [] } },
        "Choose a climbing grade before generating a plan.",
      ],
      [
        "climbingGrade is blank after trimming",
        { questionnaire: { climbingGrade: "   ", injuryLimitations: [] } },
        "Choose a climbing grade before generating a plan.",
      ],
      [
        "climbingGrade is not a supported grade",
        { questionnaire: { climbingGrade: "9A", injuryLimitations: [] } },
        "Choose one of the supported climbing grades before generating a plan.",
      ],
      [
        "injuryLimitations is not an array",
        { questionnaire: { climbingGrade: "6A", injuryLimitations: "left-shoulder-strain" } },
        "Injury limitations must be sent as a list.",
      ],
      [
        "an injury entry is not an object",
        { questionnaire: validQuestionnairePayload({ injuryLimitations: ["left-shoulder-strain"] }) },
        "One or more injury limitations are not recognized.",
      ],
      [
        "an injury id is not recognized",
        {
          questionnaire: validQuestionnairePayload({
            injuryLimitations: [{ id: "not-a-real-injury", status: "chronic" }],
          }),
        },
        "One or more injury limitations are not recognized.",
      ],
      [
        "an injury entry has an invalid status",
        {
          questionnaire: validQuestionnairePayload({
            injuryLimitations: [{ id: "left-shoulder-strain", status: "maybe" }],
          }),
        },
        "Each declared injury must be marked acute or chronic.",
      ],
      [
        "trainingAge is missing",
        { questionnaire: validQuestionnairePayload({ trainingAge: undefined }) },
        "Choose your training age before generating a plan.",
      ],
      [
        "trainingAge is not a recognized bucket",
        { questionnaire: validQuestionnairePayload({ trainingAge: "10_years" }) },
        "Choose your training age before generating a plan.",
      ],
      [
        "sessionsPerWeek is out of range",
        { questionnaire: validQuestionnairePayload({ sessionsPerWeek: 8 }) },
        "Choose how many sessions per week you can train (1-7).",
      ],
      [
        "sessionsPerWeek is not an integer",
        { questionnaire: validQuestionnairePayload({ sessionsPerWeek: 2.5 }) },
        "Choose how many sessions per week you can train (1-7).",
      ],
      [
        "equipmentAccess is not an array",
        { questionnaire: validQuestionnairePayload({ equipmentAccess: "gym" }) },
        "Equipment access must be sent as a list.",
      ],
      [
        "equipmentAccess has an unrecognized value",
        { questionnaire: validQuestionnairePayload({ equipmentAccess: ["trampoline"] }) },
        "One or more equipment options are not recognized.",
      ],
      [
        "primaryGoal is missing",
        { questionnaire: validQuestionnairePayload({ primaryGoal: undefined }) },
        "Choose your primary training goal before generating a plan.",
      ],
      [
        "primaryGoal is not recognized",
        { questionnaire: validQuestionnairePayload({ primaryGoal: "become_a_wizard" }) },
        "Choose your primary training goal before generating a plan.",
      ],
    ])("rejects with 400 when %s", async (_description, body, expectedError) => {
      const context = buildContext({ body });

      const response = await POST(context);
      const responseBody = (await response.json()) as { ok: boolean; error: string };

      expect(response.status).toBe(400);
      expect(responseBody).toEqual({ ok: false, error: expectedError });
    });
  });

  it("returns 503 when Supabase is not configured", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const context = buildContext({
      body: { questionnaire: validQuestionnairePayload() },
    });

    const response = await POST(context);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe("Supabase is not configured");
  });

  it("generates and persists a plan, returning 200 with the read-back result", async () => {
    const fakeSupabase = buildFakeSupabase({
      questionnaireRow: {
        user_id: "user-1",
        climbing_grade: "6A",
        injury_limitations: [],
        training_age: "2_plus_years",
        sessions_per_week: 4,
        equipment_access: ["gym"],
        primary_goal: "general_fitness",
      },
      weeklyPlanRow: {
        id: "plan-1",
        summary: "A balanced week of technique, antagonist conditioning, and aerobic base work.",
        created_at: "2026-09-07T00:00:00.000Z",
        plan_days: [
          {
            id: "day-1",
            day_number: 1,
            day_label: "Monday",
            focus_area: "Technique",
            notes: null,
            recommended_exercises: [
              {
                id: "ex-1",
                exercise_order: 1,
                exercise_name: "Footwork ladder",
                sets: "4",
                reps: "4 boulders",
                notes: null,
              },
            ],
          },
        ],
      },
    });
    vi.mocked(createClient).mockReturnValue(fakeSupabase as unknown as ReturnType<typeof createClient>);

    const context = buildContext({
      body: { questionnaire: validQuestionnairePayload() },
    });

    const response = await POST(context);
    const body = (await response.json()) as { ok: boolean; plan: { questionnaire: { climbingGrade: string } } };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.plan.questionnaire.climbingGrade).toBe("6A");

    expect(fakeSupabase.rpc).toHaveBeenCalledWith(
      "replace_current_plan",
      expect.objectContaining({
        p_climbing_grade: "6A",
        p_training_age: "2_plus_years",
        p_sessions_per_week: 4,
        p_equipment_access: ["gym"],
        p_primary_goal: "general_fitness",
        p_summary: "A balanced week of technique, antagonist conditioning, and aerobic base work.",
      }),
    );
    const [, rpcArgs] = fakeSupabase.rpc.mock.calls[0] as [string, { p_days: unknown[] }];
    expect(rpcArgs.p_days).toHaveLength(7);
  });

  it("returns 500 with the persistence error message when saving fails, distinguishing it from a generation failure", async () => {
    const fakeSupabase = buildFakeSupabase({
      rpcError: { message: "constraint violation" },
    });
    vi.mocked(createClient).mockReturnValue(fakeSupabase as unknown as ReturnType<typeof createClient>);

    const context = buildContext({
      body: { questionnaire: validQuestionnairePayload() },
    });

    const response = await POST(context);
    const body = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(500);
    expect(body).toEqual({ ok: false, error: "Failed to save the current plan" });
  });
});
