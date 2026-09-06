import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Supabase is not configured")}`);
  }
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return context.redirect(`/auth/signin?error=${encodeURIComponent(error.message)}`);
    }
  } catch (err) {
    console.error("signin: supabase call failed", err);
    return context.redirect(
      `/auth/signin?error=${encodeURIComponent("Unable to reach the authentication service — please try again shortly.")}`,
    );
  }

  return context.redirect("/dashboard");
};
