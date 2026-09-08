import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

const MIN_PASSWORD_LENGTH = 6;

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const newPassword = form.get("newPassword") as string;

  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    return context.redirect(
      `/settings?pwError=${encodeURIComponent(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)}`,
    );
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/settings?pwError=${encodeURIComponent("Supabase is not configured")}`);
  }

  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      return context.redirect(`/settings?pwError=${encodeURIComponent(error.message)}`);
    }
  } catch (err) {
    console.error("change-password: supabase call failed", err instanceof Error ? err.message : String(err));
    return context.redirect(
      `/settings?pwError=${encodeURIComponent("Unable to reach the authentication service — please try again shortly.")}`,
    );
  }

  try {
    await supabase.auth.signOut({ scope: "others" });
  } catch (err) {
    console.error("change-password: sign-out-others failed", err instanceof Error ? err.message : String(err));
  }

  return context.redirect(`/settings?pwSuccess=${encodeURIComponent("Password updated.")}`);
};
