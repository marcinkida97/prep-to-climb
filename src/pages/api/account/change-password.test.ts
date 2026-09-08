import { describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { POST } from "./change-password";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}));

function buildContext(newPassword: string, authenticated = true) {
  const form = new FormData();
  form.set("newPassword", newPassword);

  const redirect = vi.fn((path: string) => new Response(null, { status: 302, headers: { Location: path } }));

  const context = {
    request: {
      formData: () => Promise.resolve(form),
      headers: new Headers(),
    },
    cookies: {},
    locals: { user: authenticated ? ({ id: "user-1" } as unknown as User) : null },
    redirect,
  };

  return { context: context as unknown as APIContext, redirect };
}

describe("POST /api/account/change-password", () => {
  it("redirects unauthenticated requests to sign-in", async () => {
    const { context, redirect } = buildContext("new-strong-password", false);

    await POST(context);

    expect(redirect).toHaveBeenCalledWith("/auth/signin");
  });

  it("redirects with an error when the new password is too short", async () => {
    const { context, redirect } = buildContext("abc");

    await POST(context);

    expect(redirect).toHaveBeenCalledWith(
      `/settings?pwError=${encodeURIComponent("Password must be at least 6 characters")}`,
    );
  });

  it("redirects when Supabase is not configured", async () => {
    const { context, redirect } = buildContext("new-strong-password");
    vi.mocked(createClient).mockReturnValue(null);

    await POST(context);

    expect(redirect).toHaveBeenCalledWith(`/settings?pwError=${encodeURIComponent("Supabase is not configured")}`);
  });

  it("shows the verbatim Supabase message when updateUser fails", async () => {
    const { context, redirect } = buildContext("new-strong-password");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        updateUser: vi.fn().mockResolvedValue({ error: { message: "New password should be different" } }),
      },
    } as unknown as ReturnType<typeof createClient>);

    await POST(context);

    expect(redirect).toHaveBeenCalledWith(
      `/settings?pwError=${encodeURIComponent("New password should be different")}`,
    );
  });

  it("redirects with a generic message when Supabase is unreachable", async () => {
    const { context, redirect } = buildContext("new-strong-password");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        updateUser: vi.fn().mockRejectedValue(new Error("network unreachable")),
      },
    } as unknown as ReturnType<typeof createClient>);

    await POST(context);

    expect(redirect).toHaveBeenCalledWith(
      `/settings?pwError=${encodeURIComponent("Unable to reach the authentication service — please try again shortly.")}`,
    );
  });

  it("signs out other sessions and redirects with a success message on success", async () => {
    const { context, redirect } = buildContext("new-strong-password");
    const signOut = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockReturnValue({
      auth: {
        updateUser: vi.fn().mockResolvedValue({ error: null }),
        signOut,
      },
    } as unknown as ReturnType<typeof createClient>);

    await POST(context);

    expect(signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(redirect).toHaveBeenCalledWith(`/settings?pwSuccess=${encodeURIComponent("Password updated.")}`);
  });

  it("still redirects with a success message when signing out other sessions fails", async () => {
    const { context, redirect } = buildContext("new-strong-password");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        updateUser: vi.fn().mockResolvedValue({ error: null }),
        signOut: vi.fn().mockRejectedValue(new Error("network unreachable")),
      },
    } as unknown as ReturnType<typeof createClient>);

    await POST(context);

    expect(redirect).toHaveBeenCalledWith(`/settings?pwSuccess=${encodeURIComponent("Password updated.")}`);
  });
});
