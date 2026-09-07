# Verification Notes

## Production prerequisite (manual, dashboard-side — not automatable from this repo)

The code fix in this change makes `signup.ts` pass an explicit
`emailRedirectTo` of `<request-origin>/api/auth/confirm`, and adds the
`src/pages/api/auth/confirm.ts` route to complete the PKCE exchange. This
alone is **not sufficient in production** — Supabase's Auth server
requires any `emailRedirectTo` value to exactly match an entry in the
project's Redirect URLs allow-list, otherwise it silently falls back to
the dashboard's plain Site URL instead (no error shown to the user).

Before this fix takes effect for real users, whoever owns the Supabase
project must, in the Supabase dashboard under **Authentication → URL
Configuration**:

1. Set **Site URL** to the app's real production origin (e.g.
   `https://<your-production-domain>`), replacing whatever default
   (commonly `http://localhost:3000`) it currently holds.
2. Add the **exact** URL `https://<your-production-domain>/api/auth/confirm`
   to the **Redirect URLs** allow-list. A bare origin entry without the
   `/api/auth/confirm` path will NOT match, per Supabase's exact-match
   redirect-URL rule. Do **not** use a wildcard entry (e.g. `https://<your-
   production-domain>/**`) here — `emailRedirectTo` is derived from the
   incoming request's own origin at sign-up time
   (`src/pages/api/auth/signup.ts:14`), and a wildcard would let that
   derived value satisfy the allow-list for any path on the domain,
   widening the redirect surface beyond what this fix actually needs.

Until both of these are set, production sign-ups will continue to fail
confirmation exactly as originally reported, regardless of this code
change.

## Local manual verification (this change) — NOT PERFORMED, environment-blocked

The plan called for a real pass against the local Supabase CLI stack
(`npx supabase start`) with `enable_confirmations` temporarily set to
`true`, clicking the actual confirmation link from local Inbucket. This
was attempted and could not be completed:

- `npx supabase start` failed with `no space left on device` — Docker
  Desktop's virtual disk was allocated only 9.7GB total, of which 240MB
  was free.
- `docker image prune -a` reclaimed 1.26GB (5.5GB free afterward), but a
  second attempt still failed on the same error while pulling the
  `logflare` image — the full local Supabase stack (Postgres, Auth,
  Storage, Realtime, Kong, Studio, Logflare, Inbucket, etc.) does not fit
  within the current 9.7GB Docker Desktop disk allocation even with
  nothing else cached.
- Fixing this requires resizing Docker Desktop's virtual disk (Settings →
  Resources → Advanced), which needs GUI interaction outside this
  session. Given that, the decision (made explicitly, 2026-09-07) was to
  **rely on the automated unit/integration test suite instead** of a real
  local click-through for this phase, rather than block the plan on a
  Docker Desktop configuration change.
- `npx supabase stop` was run afterward to clean up the partial/failed
  container state left behind by the aborted start attempts.

**What this means for confidence in the fix**: the PKCE exchange
mechanics (`exchangeCodeForSession` call, cookie-writing behavior) were
verified by reading the installed `@supabase/ssr`/`@supabase/auth-js`
source directly (see `research.md` and `plan.md`'s Key Discoveries), and
the route's request/response contract is covered by
`confirm.test.ts`'s mocked success/failure matrix. What remains
**unverified** is the real browser round-trip: an actual confirmation
email, a real PKCE code, and the real cookie read-back through
`@supabase/ssr`'s storage adapter. If Docker Desktop's disk is resized
later, re-running the steps below is still recommended before this
change is considered fully proven:

- [ ] Sign up a new test account locally
- [ ] Retrieve the confirmation email from local Inbucket at `http://127.0.0.1:54324`
- [ ] Click the confirmation link and confirm the browser lands signed-in on `/dashboard`
- [ ] Attempt the same link a second time and confirm a clean `/auth/signin?error=...` redirect rather than a crash or blank page
- [ ] Revert `enable_confirmations` back to `false` in `supabase/config.toml`

## Copy check (performed)

`src/pages/auth/confirm-email.astro`'s production-branch description now
reads: "We've sent a confirmation link to your email address. Open it to
confirm your account and continue straight into your protected planning
area." — no longer instructs a separate manual sign-in.
