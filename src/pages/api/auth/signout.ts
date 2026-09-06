import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("signout: supabase call failed", err instanceof Error ? err.message : String(err));
    }
  }
  return context.redirect("/");
};
