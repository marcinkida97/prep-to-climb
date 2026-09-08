import { describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase-admin";
import { POST } from "./delete-account";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: vi.fn(),
}));

function buildContext(authenticated = true) {
  const redirect = vi.fn((path: string) => new Response(null, { status: 302, headers: { Location: path } }));

  const context = {
    request: {
      headers: new Headers(),
    },
    cookies: {},
    locals: { user: authenticated ? ({ id: "user-1" } as unknown as User) : null },
    redirect,
  };

  return { context: context as unknown as APIContext, redirect };
}

describe("POST /api/account/delete-account", () => {
  it("redirects unauthenticated requests to sign-in", async () => {
    const { context, redirect } = buildContext(false);

    await POST(context);

    expect(redirect).toHaveBeenCalledWith("/auth/signin");
  });

  it("redirects with a generic message when the admin client is not configured", async () => {
    const { context, redirect } = buildContext();
    vi.mocked(createAdminClient).mockReturnValue(null);

    await POST(context);

    expect(redirect).toHaveBeenCalledWith(
      `/settings?delError=${encodeURIComponent("Account deletion is temporarily unavailable. Please try again later.")}`,
    );
  });

  it("redirects with a generic message when deleteUser fails", async () => {
    const { context, redirect } = buildContext();
    vi.mocked(createAdminClient).mockReturnValue({
      auth: {
        admin: {
          deleteUser: vi.fn().mockResolvedValue({ error: { message: "insufficient permissions" } }),
        },
      },
    } as unknown as ReturnType<typeof createAdminClient>);

    await POST(context);

    expect(redirect).toHaveBeenCalledWith(
      `/settings?delError=${encodeURIComponent("Unable to delete your account. Please try again.")}`,
    );
  });

  it("redirects with a generic message when the admin call throws", async () => {
    const { context, redirect } = buildContext();
    vi.mocked(createAdminClient).mockReturnValue({
      auth: {
        admin: {
          deleteUser: vi.fn().mockRejectedValue(new Error("network unreachable")),
        },
      },
    } as unknown as ReturnType<typeof createAdminClient>);

    await POST(context);

    expect(redirect).toHaveBeenCalledWith(
      `/settings?delError=${encodeURIComponent("Unable to delete your account. Please try again.")}`,
    );
  });

  it("signs out and redirects to sign-in with a success message on success", async () => {
    const { context, redirect } = buildContext();
    vi.mocked(createAdminClient).mockReturnValue({
      auth: {
        admin: {
          deleteUser: vi.fn().mockResolvedValue({ error: null }),
        },
      },
    } as unknown as ReturnType<typeof createAdminClient>);
    const signOut = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockReturnValue({
      auth: { signOut },
    } as unknown as ReturnType<typeof createClient>);

    await POST(context);

    expect(signOut).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(
      `/auth/signin?message=${encodeURIComponent("Your account has been deleted.")}`,
    );
  });

  it("still redirects to sign-in with a success message when the session sign-out fails", async () => {
    const { context, redirect } = buildContext();
    vi.mocked(createAdminClient).mockReturnValue({
      auth: {
        admin: {
          deleteUser: vi.fn().mockResolvedValue({ error: null }),
        },
      },
    } as unknown as ReturnType<typeof createAdminClient>);
    vi.mocked(createClient).mockReturnValue({
      auth: { signOut: vi.fn().mockRejectedValue(new Error("network unreachable")) },
    } as unknown as ReturnType<typeof createClient>);

    await POST(context);

    expect(redirect).toHaveBeenCalledWith(
      `/auth/signin?message=${encodeURIComponent("Your account has been deleted.")}`,
    );
  });
});
