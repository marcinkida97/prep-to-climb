import { createClient } from "@supabase/supabase-js";
import { TEST_USER_EMAIL, TEST_USER_PASSWORD } from "./fixtures/test-user";

export default async function globalSetup() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    // No local Supabase stack configured — skip seeding rather than failing
    // the whole suite. This keeps the always-logged-out tests (e.g.
    // dashboard-access.spec.ts) runnable with zero Supabase configuration;
    // only login-session.spec.ts needs the seeded user and will fail on its
    // own with a clear assertion if this step was skipped.
    // eslint-disable-next-line no-console -- intentional Node-script diagnostic, not app runtime code
    console.warn(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipping e2e test-user seeding. " +
        "Run `supabase start` and export the values from `supabase status -o json` to enable the login e2e test.",
    );
    return;
  }

  const { hostname } = new URL(supabaseUrl);
  const isLocalSupabaseUrl = hostname === "127.0.0.1" || hostname === "localhost";
  if (!isLocalSupabaseUrl) {
    throw new Error(
      `Refusing to seed the e2e test user against a non-local Supabase URL (${supabaseUrl}). ` +
        "This script only supports the local `supabase start` stack — never point it at a hosted project.",
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { error } = await supabaseAdmin.auth.admin.createUser({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
  });

  if (error && error.code !== "email_exists") {
    throw new Error(`Failed to seed the e2e test user: ${error.message}`);
  }
}
