# First Deployment Plan: Cloudflare Workers Manual Launch

## Summary

- Use the current Astro 6 + @astrojs/cloudflare Workers path for the first production deployment. Do not use Cloudflare Pages.
- Publish manually to a workers.dev URL first, with hosted Supabase kept external and wired only through secrets.
- Defer CI auto-deploy and custom-domain setup until after the first production smoke pass succeeds.

## Key Changes

- Update wrangler.jsonc name from the starter default to preptoclimb so the public Worker URL is product-specific.
- Add "preview_urls": false in wrangler.jsonc for this rollout to avoid accidental public preview surfaces before CI/branch preview
  policy exists.

- Add "secrets": { "required": ["SUPABASE_URL", "SUPABASE_KEY"] } in wrangler.jsonc so local dev and deploy fail clearly when
  runtime secrets are missing.

- Leave Astro adapter, output: "server", assets binding, and current compatibility_date unchanged for the first release.
- Correct the stale cloudflare-pages wording in context/foundation/tech-stack.md so repo docs match the actual Workers deployment
  target.

## Deployment Flow

- Prepare local secrets in .dev.vars from .env.example using the hosted Supabase SUPABASE_URL and SUPABASE_KEY.
- Run npm ci, npx astro sync, npm run lint, and npm run build.
- Smoke locally with npm run dev and verify /, /auth/signin, /auth/signup, and unauthenticated /dashboard redirect behavior.
- Authenticate Cloudflare locally with npx wrangler login, then confirm access with npx wrangler whoami.
- In the Cloudflare dashboard, ensure the target account has a workers.dev subdomain enabled for Workers.
- In the Cloudflare dashboard, add production Worker secrets SUPABASE_URL and SUPABASE_KEY before the first publish. Do not store
  production secrets in source-controlled config.

- In Supabase, keep email/password auth enabled and add the final https://preptoclimb.<your-workers-subdomain>.workers.dev URL to
  auth/site URL settings if confirmation emails or future redirect-based flows are used.

- Deploy manually with npx wrangler deploy.
- Capture the returned workers.dev URL and use that as the only public endpoint for this first rollout.

## Test Plan

- Anonymous request to / returns 200.
- Anonymous request to /dashboard redirects to /auth/signin.
- Sign-up flow returns the user to /auth/confirm-email without server errors.
- Existing confirmed user can sign in, reach /dashboard, and see their email rendered.
- Sign-out returns to /.
- Runtime verification uses npx wrangler tail during the auth smoke test and shows no unhandled exceptions.

## Assumptions And Defaults

- Hosted Supabase already exists and is the production auth backend.
- First launch uses only the default workers.dev hostname; no custom domain is included.
- First rollout is manual-only; GitHub or Cloudflare auto-deploy is a follow-up.
- Cloudflare Workers is the source-of-truth target even though older repo notes still mention Pages.

## References

- Astro Cloudflare deploy guide (https://docs.astro.build/en/guides/deploy/cloudflare/)
- Astro @astrojs/cloudflare adapter guide (https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- Cloudflare Workers secrets docs (https://developers.cloudflare.com/workers/configuration/secrets/)
- Cloudflare Workers preview URLs docs (https://developers.cloudflare.com/workers/configuration/previews/)
