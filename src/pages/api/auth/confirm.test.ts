import { describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import { GET } from "./confirm";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}));

function buildContext(url: string) {
  const redirect = vi.fn((path: string) => new Response(null, { status: 302, headers: { Location: path } }));

  const context = {
    request: {
      url,
      headers: new Headers(),
    },
    cookies: {},
    redirect,
  };

  return { context: context as unknown as APIContext, redirect };
}

describe("GET /api/auth/confirm", () => {
  it("redirects when Supabase is not configured", async () => {
    const { context, redirect } = buildContext("https://preptoclimb.example.com/api/auth/confirm?code=abc123");
    vi.mocked(createClient).mockReturnValue(null);

    await GET(context);

    expect(redirect).toHaveBeenCalledWith(`/auth/signin?error=${encodeURIComponent("Supabase is not configured")}`);
  });

  it("redirects with an invalid-link message when no code is present, without calling Supabase", async () => {
    const { context, redirect } = buildContext("https://preptoclimb.example.com/api/auth/confirm");
    const exchangeCodeForSession = vi.fn();
    vi.mocked(createClient).mockReturnValue({
      auth: { exchangeCodeForSession },
    } as unknown as ReturnType<typeof createClient>);

    await GET(context);

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(
      `/auth/signin?error=${encodeURIComponent("This confirmation link is invalid or has expired.")}`,
    );
  });

  it("shows the verbatim Supabase message when the code exchange is rejected", async () => {
    const { context, redirect } = buildContext("https://preptoclimb.example.com/api/auth/confirm?code=abc123");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: { message: "Invalid code" } }),
      },
    } as unknown as ReturnType<typeof createClient>);

    await GET(context);

    expect(redirect).toHaveBeenCalledWith(`/auth/signin?error=${encodeURIComponent("Invalid code")}`);
  });

  it("redirects with a generic message when Supabase is unreachable", async () => {
    const { context, redirect } = buildContext("https://preptoclimb.example.com/api/auth/confirm?code=abc123");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockRejectedValue(new Error("network unreachable")),
      },
    } as unknown as ReturnType<typeof createClient>);

    await GET(context);

    expect(redirect).toHaveBeenCalledWith(
      `/auth/signin?error=${encodeURIComponent("Unable to reach the authentication service — please try again shortly.")}`,
    );
  });

  it("redirects to the dashboard when the code exchange succeeds", async () => {
    const { context, redirect } = buildContext("https://preptoclimb.example.com/api/auth/confirm?code=abc123");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
      },
    } as unknown as ReturnType<typeof createClient>);

    await GET(context);

    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
