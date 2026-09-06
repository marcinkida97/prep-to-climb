import { describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import { POST } from "./signup";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}));

function buildContext(email: string, password: string) {
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);

  const redirect = vi.fn((path: string) => new Response(null, { status: 302, headers: { Location: path } }));

  const context = {
    request: {
      formData: () => Promise.resolve(form),
      headers: new Headers(),
    },
    cookies: {},
    redirect,
  };

  return { context: context as unknown as APIContext, redirect };
}

describe("POST /api/auth/signup", () => {
  it("redirects when Supabase is not configured", async () => {
    const { context, redirect } = buildContext("climber@example.com", "hunter2");
    vi.mocked(createClient).mockReturnValue(null);

    await POST(context);

    expect(redirect).toHaveBeenCalledWith(`/auth/signup?error=${encodeURIComponent("Supabase is not configured")}`);
  });

  it("redirects with a generic message when Supabase is unreachable", async () => {
    const { context, redirect } = buildContext("climber@example.com", "hunter2");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        signUp: vi.fn().mockRejectedValue(new Error("network unreachable")),
      },
    } as unknown as ReturnType<typeof createClient>);

    await POST(context);

    expect(redirect).toHaveBeenCalledWith(
      `/auth/signup?error=${encodeURIComponent("Unable to reach the authentication service — please try again shortly.")}`,
    );
  });

  it("shows the verbatim Supabase message when signup is rejected normally", async () => {
    const { context, redirect } = buildContext("climber@example.com", "weak");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({ error: { message: "Password should be at least 6 characters" } }),
      },
    } as unknown as ReturnType<typeof createClient>);

    await POST(context);

    expect(redirect).toHaveBeenCalledWith(
      `/auth/signup?error=${encodeURIComponent("Password should be at least 6 characters")}`,
    );
  });
});
