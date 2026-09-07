# Sign-up Confirmation Redirect Fix — Plan Brief

> Full plan: `context/changes/signup-confirmation-redirect-bug/plan.md`
> Research: `context/changes/signup-confirmation-redirect-bug/research.md`

## What & Why

A new user's confirmation email redirects to `localhost`, and logging in
afterward says the account isn't confirmed. Root cause: `signUp()` never
tells Supabase where to send the user back to, and even if it did, no
route in this app can complete the PKCE code exchange the confirmation
link carries. This plan adds both pieces so sign-up confirmation actually
works.

## Starting Point

`src/pages/api/auth/signup.ts` calls `supabase.auth.signUp({ email,
password })` with no `emailRedirectTo`. `@supabase/ssr`'s
`createServerClient` (already used throughout this app) hardcodes
`flowType: "pkce"`, so the confirmation link carries a `code` param that
must be exchanged via `exchangeCodeForSession` — no such route exists.
The PKCE code-verifier cookie is already written correctly by the
existing client wiring; only the redirect target and the exchange route
are missing.

## Desired End State

Clicking the confirmation link lands the user signed-in on `/dashboard`.
An expired, already-used, or malformed link redirects to `/auth/signin`
with a clear error, matching how sign-in/sign-up already report Supabase
errors today.

## Key Decisions Made

| Decision                    | Choice                                              | Why (1 sentence)                                                                                  | Source   |
| ---------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| Post-confirm landing         | Auto-signed-in on `/dashboard`                       | `exchangeCodeForSession` already establishes a real session; redirecting matches `signin.ts`'s existing success path. | Plan     |
| Redirect origin              | Derive from the incoming request, not a new env var  | Self-configuring across environments; avoids repeating the "forgotten per-environment config" failure mode that caused this bug. | Plan     |
| Failure UX                   | Reuse the existing `?error=` passthrough pattern      | Zero new UI; consistent with `signin.ts`/`signup.ts` today; a resend-email flow is out of scope.  | Plan     |
| Dashboard Site URL / allow-list | Document as a required manual step, not code        | The fix's code alone can't take effect in production without this; the gap must be explicit, not silent. | Plan     |
| Manual verification depth    | Unit/integration tests + one real local Supabase pass | Proves the actual PKCE cookie/exchange mechanics work, not just mocked assumptions.                | Plan     |
| `confirm-email.astro` copy   | Update it                                             | Current copy says "sign in" after confirming, which is no longer true once confirmation auto-signs the user in. | Plan     |

## Scope

**In scope:**
- `emailRedirectTo` derived from the request origin at sign-up time
- New `src/pages/api/auth/confirm.ts` callback route (PKCE exchange)
- Local `supabase/config.toml` port correction (`3000` → `4321`)
- Tests for both routes
- `confirm-email.astro` copy update
- Documenting (not performing) the required production dashboard steps

**Out of scope:**
- A "resend confirmation email" flow for expired/used links
- Any new environment variable for the app's origin
- Changing the actual production Supabase dashboard configuration
- Changing `signin.ts`'s "account not confirmed" message wording

## Architecture / Approach

The new callback route mirrors the existing `signin.ts`/`signup.ts` shape
exactly: not-configured check → try/catch around the Supabase call →
generic message on network failure → verbatim Supabase error passthrough
→ redirect. `signup.ts` gains one line computing `new
URL(request.url).origin` and passes it as `emailRedirectTo`. No new
architecture, no new dependencies — the PKCE cookie plumbing this depends
on already exists in `src/lib/supabase.ts`.

## Phases at a Glance

| Phase                 | What it delivers                                                       | Key risk                                                                 |
| ---------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| 1. Redirect + callback | `emailRedirectTo`, new `/api/auth/confirm` route, local config fix, tests | Getting the redirect-target/callback-path pairing exactly right           |
| 2. Polish + verify     | Copy update, real local Inbucket pass, documented production steps       | Production still broken until someone manually updates the Supabase dashboard |

**Prerequisites:** Local Supabase CLI available for Phase 2's manual pass (`supabase start`).
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Assumes `context.request.url` reliably reflects the real public origin on Cloudflare Workers (true for this single-Worker deployment; would need revisiting behind a proxy that rewrites Host).
- Production remains broken for real users until the documented dashboard steps (Site URL, Redirect URLs allow-list) are applied by whoever owns the Supabase project — this plan cannot verify that step.

## Success Criteria (Summary)

- A new sign-up's confirmation email link lands the user signed-in on `/dashboard`, verified against real local Supabase Inbucket delivery
- An expired/reused/malformed link fails gracefully with a visible error, not a blank page or crash
- `npm run lint`, `npm run build`, and the full test suite pass with the new/updated tests included
