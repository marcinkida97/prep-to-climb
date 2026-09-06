import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const GET: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const code = new URL(context.request.url).searchParams.get("code");
  if (!code) {
    return context.redirect(
      `/auth/signin?error=${encodeURIComponent("This confirmation link is invalid or has expired.")}`,
    );
  }

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return context.redirect(`/auth/signin?error=${encodeURIComponent(error.message)}`);
    }
  } catch (err) {
    console.error("confirm: supabase call failed", err instanceof Error ? err.message : String(err));
    return context.redirect(
      `/auth/signin?error=${encodeURIComponent("Unable to reach the authentication service — please try again shortly.")}`,
    );
  }

  return context.redirect("/dashboard");
};
