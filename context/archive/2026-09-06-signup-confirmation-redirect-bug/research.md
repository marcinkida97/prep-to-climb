---
date: 2026-09-06T22:58:31+02:00
researcher: Marcin Kida
git_commit: a5088d16c4ab5567498c142551e3d916a273b055
branch: main
repository: prep-to-climb
topic: "Sign-up confirmation email redirects to localhost; login reports account not confirmed"
tags: [research, codebase, auth, supabase, signup, email-confirmation]
status: complete
last_updated: 2026-09-06
last_updated_by: Marcin Kida
---

# Research: Sign-up confirmation email redirects to localhost; login reports account not confirmed

**Date**: 2026-09-06T22:58:31+02:00
**Researcher**: Marcin Kida
**Git Commit**: a5088d16c4ab5567498c142551e3d916a273b055
**Branch**: main
**Repository**: prep-to-climb

## Research Question

I tried to sign up a new account. I received a confirmation email but it
redirected me to localhost. Also when I tried to login it says that my
account is not confirmed. Where the problem lies? Should I add an e2e
test for it?

## Summary

This is two compounding defects in the sign-up/confirmation flow, not one:

1. **Nothing in the app tells Supabase where to send the confirmation
   link.** `supabase.auth.signUp()` is called with no `emailRedirectTo`
   override (`src/pages/api/auth/signup.ts:14`), and the repo has no env
   var expressing the app's own deployed origin at all (only
   `SUPABASE_URL`/`SUPABASE_KEY` exist anywhere in
   `astro.config.mjs`, `.env.example`, `wrangler.jsonc`). So the link
   destination is whatever the Supabase project's dashboard **Auth → URL
   Configuration → Site URL** is set to — which is invisible to this repo
   and, if left at its default, is `localhost`. This matches the local
   Supabase CLI config's own `site_url = "http://127.0.0.1:3000"`
   (`supabase/config.toml:154`), suggesting the same "still points at
   localhost" pattern was never overridden for the deployed environment
   either.

2. **Even with a correct redirect target, nothing in the app would
   complete the confirmation.** There is no route anywhere in `src/` that
   handles a confirmation token — no `verifyOtp`, no
   `exchangeCodeForSession`, no handler for a `token_hash` or `code` query
   param. `src/pages/auth/confirm-email.astro` (the only page in the
   confirmation path) is purely static "check your email" copy that
   branches on `import.meta.env.DEV`; it never touches a token. Given this
   app uses `@supabase/ssr`'s `createServerClient` (`src/lib/supabase.ts`),
   which defaults new projects to the PKCE confirmation flow, the expected
   integration shape is: Supabase's email link → app's own callback route
   → `supabase.auth.exchangeCodeForSession(code)` → session established →
   `email_confirmed_at` set. **That callback route does not exist in this
   codebase.** So the account would very plausibly still be unconfirmed
   even if the link pointed at the right host — the localhost redirect is
   real, but it is not proven to be the *only* reason confirmation never
   finishes.

3. **The login error is Supabase's own error message, un-interpreted.**
   `src/pages/api/auth/signin.ts:14-17` calls
   `supabase.auth.signInWithPassword(...)` and on error redirects with
   `error.message` forwarded verbatim — there is no app-level branch for
   an unconfirmed-email case. "Your account is not confirmed" is GoTrue's
   own message for `email_confirmed_at === null`, which is consistent with
   confirmation genuinely never having completed (reinforcing #2, not
   contradicting it).

**Bottom line**: the localhost redirect and the "not confirmed" login
error share a plausible common root (confirmation never completes,
whether because the link is unreachable or because there's no app-side
code to finish the exchange even at a reachable URL) — but two separate
gaps have to be closed to fix it: (a) an explicit `emailRedirectTo`
derived from the app's real origin at signup time, and (b) a confirmation
callback route this app currently does not have. Part (a) is confirmable
from this repo; part of the picture (which Supabase auth flow type —
implicit vs. PKCE — is configured on the Supabase project) lives in the
Supabase dashboard, outside this repo's visibility.

**Should you add an e2e test for it?** No — per `test-plan.md` §1's
cost×signal principle and the Risk #3 guidance's own "likely cheapest
layer" call (`integration test against the auth route + middleware`),
this doesn't need a browser. E2E can't even exercise the real defect
(clicking a link in a real email) without extra test infra (e.g. Supabase
local Inbucket) that isn't part of this project's stack today. The right
tests, once the fix lands, are integration/unit tests at the existing
`signup.test.ts`/`signin.test.ts` layer: assert `signUp()` is called with
the correct `emailRedirectTo`, and add coverage for the new callback route
mocking `exchangeCodeForSession`/`verifyOtp` success and failure. See
Recommendation below.

## Detailed Findings

### Sign-up route

- `src/pages/api/auth/signup.ts:14` — `await supabase.auth.signUp({ email, password })`. No second (`options`) argument; no `emailRedirectTo` anywhere in the call or the file.
- `src/pages/api/auth/signup.ts:26` — on success, always `return context.redirect("/auth/confirm-email")`, regardless of whether the account required confirmation.
- `src/pages/api/auth/signup.ts:9,11,17` — Supabase client from `createClient`; "not configured" and Supabase-error paths both redirect to `/auth/signup?error=...` with `error.message` forwarded.

### Confirmation landing page

- `src/pages/auth/confirm-email.astro:4` — `const isAutoConfirmed = import.meta.env.DEV;` is the only branch condition on the page.
- `src/pages/auth/confirm-email.astro:6-19` — dev branch shows "Account ready" copy; prod branch shows "Confirm your email to unlock planning" copy. Both branches' link (`src/pages/auth/confirm-email.astro:32`) point at `/auth/signin` — this page performs no Supabase call and processes no token.
- This branch is independent of Supabase's own `enable_confirmations` setting (`supabase/config.toml:209`, `false` locally) — nothing in the app code reads that setting; `import.meta.env.DEV` is a separate, coincidentally-aligned signal.

### Missing confirmation callback route

- Repo-wide search for `token_hash`, `verifyOtp`, `exchangeCodeForSession`, `code_verifier`, `emailRedirectTo`, `redirectTo`, and any `*callback*` file returned zero matches under `src/`.
- The only auth-adjacent routes are `signup.ts`, `signin.ts`, `signout.ts` (API) and `signup.astro`, `signin.astro`, `confirm-email.astro` (pages) — none process a confirmation token or code.

### Sign-in route and its error handling

- `src/pages/api/auth/signin.ts:14` — `await supabase.auth.signInWithPassword({ email, password })`.
- `src/pages/api/auth/signin.ts:17` — on error, `return context.redirect(\`/auth/signin?error=${encodeURIComponent(error.message)}\`)` — no check of message content, no `error.code`/`email_confirmed_at`/`confirmed_at` branch.
- `src/pages/api/auth/signin.test.ts` (69 lines) — existing coverage: Supabase-not-configured, generic network error, "Invalid login credentials" passthrough. No unconfirmed-email test case exists, consistent with there being no such branch to test.
- `src/pages/auth/signin.astro:5,19` — reads the `error` query param and renders it via `<SignInForm serverError={error} />` verbatim.

### Supabase client and env configuration

- `src/lib/supabase.ts` — the only Supabase client file in the repo; reads `SUPABASE_URL`/`SUPABASE_KEY` via `astro:env/server` (lines 1-11); constructs `createServerClient` with a cookie adapter (lines 12-26). No separate browser-side client exists.
- `astro.config.mjs:17-22` — `env.schema` declares only `SUPABASE_URL` and `SUPABASE_KEY`, both `context: "server"`, `access: "secret"`, `optional: true`. No `SITE_URL`/`PUBLIC_SITE_URL`/`PUBLIC_APP_URL`/`ORIGIN` field anywhere.
- `.env.example` — two lines only: `SUPABASE_URL=###`, `SUPABASE_KEY=###`.
- `wrangler.jsonc` — `secrets.required` lists only `SUPABASE_URL`, `SUPABASE_KEY`.
- `supabase/config.toml:154,156` — local Supabase CLI config: `site_url = "http://127.0.0.1:3000"`, `additional_redirect_urls = ["https://127.0.0.1:3000"]`. This is the local-dev Supabase instance's own config, not the hosted project's dashboard config — but it's the same failure shape (Site URL left at a `localhost` default).

### Middleware / protected routes (context, not defect surface here)

- `src/middleware.ts:4` — `PROTECTED_ROUTES = ["/dashboard", "/api/plans"]`.
- `src/middleware.ts:6-16` — builds a Supabase client per request, calls `supabase.auth.getUser()`, stores result on `context.locals.user`.
- `src/middleware.ts:18-29` — protected `/api/*` paths get a raw 401 JSON when unauthenticated; other protected paths redirect to `/auth/signin`. Not implicated in this bug — this only gates already-authenticated sessions, not the confirmation step.

## Code References

- `src/pages/api/auth/signup.ts:14` - `signUp()` call missing `emailRedirectTo`
- `src/pages/api/auth/signup.ts:26` - unconditional redirect to `/auth/confirm-email`
- `src/pages/auth/confirm-email.astro:4-19,32` - static confirmation-pending page; no token handling
- `src/pages/api/auth/signin.ts:14-17` - raw Supabase error passthrough, no unconfirmed-email branch
- `src/pages/api/auth/signin.test.ts` - existing test coverage pattern (mocks Supabase client boundary), no unconfirmed-email case
- `src/lib/supabase.ts:1-26` - sole Supabase client construction, `SUPABASE_URL`/`SUPABASE_KEY` only
- `astro.config.mjs:17-22` - env schema, no site/origin var
- `.env.example` - `SUPABASE_URL`, `SUPABASE_KEY` only
- `wrangler.jsonc` - required secrets: `SUPABASE_URL`, `SUPABASE_KEY` only
- `supabase/config.toml:154,156,209` - local `site_url`/`additional_redirect_urls`/`enable_confirmations`
- `src/middleware.ts:4,18-29` - protected-route gate (context only, not implicated)

## Architecture Insights

- The app consistently keeps Supabase-error handling at the thinnest possible layer: catch `error`, forward `error.message` verbatim, no interpretation. This is a deliberate-looking pattern (mirrored identically in `signup.ts` and `signin.ts`), but it means any UX-level distinction (e.g. "resend confirmation email" vs. "wrong password") requires the app to start pattern-matching Supabase's message text or `error.code` — none of that exists yet.
- The confirmation flow was scaffolded with only a "waiting" page (`confirm-email.astro`) and never got the other half (a route that actually completes the confirmation exchange). This is a structural gap, not a subtle bug — the plan that shipped this page (`context/changes/account-access-flow/plan.md:21,61-63,123-127`) explicitly scoped out "changing Supabase confirmation rules or replacing the existing confirm-email flow" (line 28), so this gap was a deliberate non-goal of that slice, not an oversight within it.
- No env var expresses this app's own deployed origin anywhere (schema, example, or secrets). Any future fix needs to introduce one (or derive origin from the request) and thread it into `signUp()`'s `emailRedirectTo`.

## Historical Context (from prior changes)

- `context/changes/account-access-flow/plan.md:21` — "Sign-up already branches between dev auto-confirm and production email-confirm states in `src/pages/auth/confirm-email.astro:5`" — confirms this branch predates the current investigation and was treated as stable, pre-existing scaffold.
- `context/changes/account-access-flow/plan.md:28,39` — explicitly excluded "changing Supabase confirmation rules or replacing the existing confirm-email flow" from that slice's scope — the missing callback route was a known non-goal, not newly introduced.
- `context/foundation/test-plan.md` §2 Risk #3 — "User cannot log in at all, blocking all access to the product" (High/High) — Risk Response Guidance row explicitly lists "confirmation-email redirect target" as something `/10x-research` must ground; this document is that grounding.
- `context/foundation/test-plan.md` §3 Phase 1 ("Bootstrap harness + critical failure-path coverage," risks #1/#3) is the rollout phase this finding feeds into; its change folder (`context/changes/testing-critical-path-coverage/`) has not yet been created on disk.
- `context/changes/auth-outage-error-handling/` — a related, already-`impl_reviewed` change guarding Risk #7 (opaque Supabase outage errors) at the same `signin.ts`/`signup.ts` error-handling layer — same file, adjacent risk, useful precedent for how error-branch tests were structured there (mocking the Supabase client boundary, asserting on the serialized error body).

## Related Research

- No prior `research.md` exists for `account-access-flow` or `testing-critical-path-coverage` (the latter's change folder does not yet exist on disk).

## Recommendation: testing approach (not a fix)

Per `test-plan.md` §1 cost×signal and the Risk #3 row's own guidance:

- **Don't add an e2e test for this.** E2E can't reach the actual defect (a real email's link, an unreachable localhost redirect) without introducing test email infrastructure (e.g. Supabase's local Inbucket) that isn't part of this project's stack, and the existing `e2e/` suite deliberately runs with no Supabase secrets (`test-plan.md` §6.3) — wiring real account creation into it would be a scope change beyond this bug.
- **Cheapest layer that gives real signal, once fixed:**
  - Unit/integration test on `signup.ts` asserting `supabase.auth.signUp()` is called with the correct `emailRedirectTo` (mocking the Supabase client boundary, same pattern as `signup.test.ts`/`signin.test.ts` today) — catches a future regression to "no redirect override" cheaply.
  - Unit/integration test(s) on the new confirmation-callback route once it exists, mocking `exchangeCodeForSession`/`verifyOtp` success and failure paths — mirrors the existing `signin.test.ts` pattern of mocking only at the Supabase-client boundary, not the route logic itself.
- This is a real production defect (broken sign-up confirmation), not only a test-coverage gap. The fix itself — adding an origin-aware `emailRedirectTo` and building the missing callback route — is implementation work outside `/10x-research`'s scope; route it through this project's normal change/plan flow (or a bug-fix workflow) before writing the tests above.

## Open Questions

- Which Supabase auth flow type (implicit vs. PKCE) is configured on the actual deployed/hosted Supabase project — this determines whether the callback route must call `exchangeCodeForSession` or `verifyOtp`, and isn't visible from this repo.
- What the hosted Supabase project's dashboard **Auth → URL Configuration → Site URL** and **Redirect URLs allowlist** are currently set to — needed to confirm the localhost redirect's exact source before writing the fix.
