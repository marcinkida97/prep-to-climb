# First Deployment Plan: Cloudflare Workers Manual Launch

## Summary

- Deploy this Astro 6 app to Cloudflare Workers with Wrangler, not Cloudflare Pages.
- First release is a manual production deploy to a workers.dev URL.
- Hosted Supabase stays external and is wired into the Worker only through runtime secrets.

## Pre-Execution Steps You Must Do Yourself

- Cloudflare account access: Log into the target Cloudflare account and confirm you can deploy Workers there. This cannot be
  delegated because it depends on your account ownership and billing scope.

- Enable or confirm workers.dev: In Cloudflare, make sure the account has a workers.dev subdomain configured. The first deployment
  URL will be https://<worker-name>.<your-account-subdomain>.workers.dev.

- Cloudflare authentication for CLI: Run npx wrangler login on your machine and confirm access with npx wrangler whoami. This is
  your authorization step for deploys.

- Production secrets: In Cloudflare, create Worker secrets for SUPABASE_URL and SUPABASE_KEY. These must be entered by you because
  they are production credentials.

- Supabase URL configuration: In Supabase Auth settings, set the production Site URL to the final workers.dev URL and add any
  additional redirect URLs only if you introduce non-default auth redirects later. This matters for email confirmation and auth
  redirects.

- Human approval gate: Before running npx wrangler deploy, review the exact Worker name and target account. Publishing production
  traffic is a human-owned action for this rollout.

## Key Changes

- Update wrangler.jsonc name from 10x-astro-starter to preptoclimb so the Worker URL is product-specific.
- Add preview_urls: false in wrangler.jsonc for the first rollout to avoid unmanaged public previews.
- Add required secret declarations for SUPABASE_URL and SUPABASE_KEY in wrangler.jsonc so missing runtime config fails early.
- Leave the Astro adapter, server output, assets binding, and current compatibility settings unchanged.
- Correct the stale cloudflare-pages wording in context/foundation/tech-stack.md so the docs match the real deployment target.

## Deployment Flow

- Prepare local .dev.vars from .env.example with the same two Supabase values used in production.
- Run npm ci, npx astro sync, npm run lint, and npm run build.
- Smoke locally with npm run dev and verify /, /auth/signin, /auth/signup, and the unauthenticated redirect from /dashboard.
- After the manual setup steps above are complete, deploy with npx wrangler deploy.
- Capture the returned workers.dev URL and use it as the only public endpoint for this first release.
- Verify sign-up, sign-in, protected-route access, and sign-out against the deployed URL.
- Inspect runtime behavior with npx wrangler tail during the auth smoke test.

## Test Plan

- / loads successfully as an anonymous user.
- Anonymous access to /dashboard redirects to /auth/signin.
- Sign-up reaches /auth/confirm-email without runtime errors.
- A confirmed user can sign in and reach /dashboard.
- Sign-out returns to /.
- wrangler tail shows no unhandled exceptions during the deploy smoke pass.

## Assumptions And Defaults

- Hosted Supabase already exists.
- First release uses only workers.dev; no custom domain is included.
- CI auto-deploy is intentionally deferred until after the first production rollout succeeds.
- Cloudflare Workers is the source-of-truth path as of May 29, 2026, even though older repo notes still mention Pages.

## References

- Astro: Deploy to Cloudflare Workers (https://docs.astro.build/en/guides/deploy/cloudflare/)
- Cloudflare: workers.dev (https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- Cloudflare: Secrets (https://developers.cloudflare.com/workers/configuration/secrets/)
- Cloudflare: Wrangler commands (https://developers.cloudflare.com/workers/wrangler/commands/general/)
- Supabase: Redirect URLs (https://supabase.com/docs/guides/auth/redirect-urls)
- Supabase: Auth general configuration (https://supabase.com/docs/guides/auth/general-configuration)
