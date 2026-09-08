import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase-admin";

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return context.redirect(
      `/settings?delError=${encodeURIComponent("Account deletion is temporarily unavailable. Please try again later.")}`,
    );
  }

  try {
    const { error } = await adminClient.auth.admin.deleteUser(user.id);

    if (error) {
      console.error("delete-account: supabase call failed", error.message);
      return context.redirect(
        `/settings?delError=${encodeURIComponent("Unable to delete your account. Please try again.")}`,
      );
    }
  } catch (err) {
    console.error("delete-account: supabase call failed", err instanceof Error ? err.message : String(err));
    return context.redirect(
      `/settings?delError=${encodeURIComponent("Unable to delete your account. Please try again.")}`,
    );
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("delete-account: sign-out failed", err instanceof Error ? err.message : String(err));
    }
  }

  return context.redirect(`/auth/signin?message=${encodeURIComponent("Your account has been deleted.")}`);
};
