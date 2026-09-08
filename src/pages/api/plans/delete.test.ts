import { describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { POST } from "./delete";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}));

interface FakeQueryBuilder {
  eq: (column: string, value: unknown) => FakeQueryBuilder | Promise<{ error: { message: string } | null }>;
}

function buildFakeSupabase(options: { deleteError?: { message: string } | null }) {
  const from = vi.fn((table: string) => {
    if (table !== "weekly_plans") {
      throw new Error(`Unexpected table: ${table}`);
    }

    return {
      delete: () => {
        const builder: FakeQueryBuilder = {
          eq: (_column, _value) => {
            const secondEq: FakeQueryBuilder = {
              eq: () => Promise.resolve({ error: options.deleteError ?? null }),
            };
            return secondEq;
          },
        };
        return builder;
      },
    };
  });

  return { from };
}

function buildContext(options: { authenticated?: boolean; supabase?: ReturnType<typeof buildFakeSupabase> | null }) {
  const authenticated = options.authenticated ?? true;

  const context = {
    locals: { user: authenticated ? ({ id: "user-1" } as unknown as User) : null },
    request: { headers: new Headers() },
    cookies: {},
  };

  return context as unknown as APIContext;
}

describe("POST /api/plans/delete", () => {
  it("rejects an unauthenticated request with 401 before touching Supabase", async () => {
    const context = buildContext({ authenticated: false });

    const response = await POST(context);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("returns 503 when Supabase is not configured", async () => {
    vi.mocked(createClient).mockReturnValue(null);
    const context = buildContext({});

    const response = await POST(context);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe("Supabase is not configured");
  });

  it("deletes the active plan and returns 200 with { ok: true }", async () => {
    const fakeSupabase = buildFakeSupabase({});
    vi.mocked(createClient).mockReturnValue(fakeSupabase as unknown as ReturnType<typeof createClient>);
    const context = buildContext({});

    const response = await POST(context);
    const body = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it("is idempotent: a second call with no matching active row still returns 200 { ok: true }", async () => {
    const fakeSupabase = buildFakeSupabase({});
    vi.mocked(createClient).mockReturnValue(fakeSupabase as unknown as ReturnType<typeof createClient>);
    const context = buildContext({});

    const firstResponse = await POST(context);
    const secondResponse = await POST(context);
    const secondBody = (await secondResponse.json()) as { ok: boolean };

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(secondBody).toEqual({ ok: true });
  });

  it("returns 500 with the persistence error message when the Supabase delete fails", async () => {
    const fakeSupabase = buildFakeSupabase({ deleteError: { message: "constraint violation" } });
    vi.mocked(createClient).mockReturnValue(fakeSupabase as unknown as ReturnType<typeof createClient>);
    const context = buildContext({});

    const response = await POST(context);
    const body = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(500);
    expect(body).toEqual({ ok: false, error: "Failed to delete the current weekly plan" });
  });
});
