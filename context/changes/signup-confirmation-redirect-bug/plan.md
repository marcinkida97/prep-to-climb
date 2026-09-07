# Sign-up Confirmation Redirect Fix Implementation Plan

## Overview

Sign-up currently calls `supabase.auth.signUp()` with no redirect target, so
the confirmation link Supabase emails to a new user goes wherever the
Supabase project's dashboard "Site URL" happens to be set — which, left at
its default, is `localhost`. Separately, no route in this codebase can
complete a PKCE code exchange even if the link did land on the right host,
because `@supabase/ssr`'s `createServerClient` (used throughout this app)
hardcodes `flowType: "pkce"`, and Supabase's confirmation email for a PKCE
project carries a `code` parameter that must be exchanged via
`supabase.auth.exchangeCodeForSession(code)` — no such handler exists. This
plan adds both pieces: an origin-derived `emailRedirectTo` at sign-up time,
and the missing confirmation-callback route.

## Current State Analysis

- `src/pages/api/auth/signup.ts:14` — `supabase.auth.signUp({ email, password })`, no `options.emailRedirectTo`.
- `src/lib/supabase.ts:12` (`createServerClient`) → confirmed via the installed `node_modules/@supabase/ssr/dist/main/createServerClient.js:33` that this library hardcodes `flowType: "pkce"` regardless of app config.
- No route anywhere under `src/` handles a `code`/`token_hash` query param or calls `exchangeCodeForSession`/`verifyOtp` (confirmed via repo-wide search in `context/changes/signup-confirmation-redirect-bug/research.md`).
- `src/pages/auth/confirm-email.astro:4-19` is a static "waiting" page shown right after sign-up; it performs no Supabase call and is not itself the email's redirect target.
- `src/pages/api/auth/signin.ts:14-17` and `signup.ts:16-24` share one error-handling shape: not-configured check → `try`/`catch` around the Supabase call → generic message on network failure → verbatim `error.message` passthrough on a normal Supabase error → redirect to the form page with `?error=`.
- `supabase/config.toml:154,156` — local Supabase CLI config has `site_url = "http://127.0.0.1:3000"` and `additional_redirect_urls = ["https://127.0.0.1:3000"]`, but this project's actual dev server (`astro dev`, no configured `server.port` in `astro.config.mjs`) runs on Astro's default port `4321` (confirmed by `context/foundation/test-plan.md` §6.3, which documents Playwright's `webServer` targeting `http://localhost:4321`). This mismatch would block a real local confirmation-link test even after the code fix lands.
- `src/pages/api/auth/signup.test.ts` and `signin.test.ts` establish the mocking convention: `vi.mock("@/lib/supabase")`, a `buildContext()` helper building a minimal `APIContext`-shaped object, and assertions on the `redirect` mock's call arguments. Neither test's `buildContext()` currently includes a `request.url`.

### Key Discoveries:

- The PKCE code-verifier cookie is already written correctly today. `node_modules/@supabase/ssr/dist/main/cookies.js:290-307` special-cases any storage key ending in `-code-verifier` to flush immediately via `setAll` (bypassing the normal auth-event-gated flush), using `DEFAULT_COOKIE_OPTIONS` (`node_modules/@supabase/ssr/dist/main/utils/constants.js:4-11`: `path: "/"`, `sameSite: "lax"`, 400-day `maxAge`). This means `signup.ts`'s existing `createClient(...)` wiring already persists the verifier correctly across the sign-up response — no cookie-plumbing change is needed, only the missing redirect target and callback route.
- Supabase's PKCE confirmation redirect appends a `code` query parameter to whatever `emailRedirectTo` was given (this is also what `_isPKCECallback` in `node_modules/@supabase/auth-js/dist/module/GoTrueClient.js:3129-3132` checks for: `params.code` plus a stored code-verifier). The new callback route reads this `code` param directly from the request URL.
- A successful `exchangeCodeForSession` establishes a real session and fires `SIGNED_IN` through `createServerClient`'s `onAuthStateChange` listener (`node_modules/@supabase/ssr/dist/main/createServerClient.js:48-66`), which flushes the session cookies the same way `signin.ts`'s successful `signInWithPassword` already does today — so redirecting straight to `/dashboard` after a successful exchange is consistent with existing sign-in behavior, not a new pattern.

## Desired End State

A new user who signs up receives a confirmation email whose link points at
their actual deployed origin. Clicking it exchanges the PKCE code for a
session and lands them signed-in on `/dashboard`. A stale, expired, or
already-used link redirects to `/auth/signin` with a clear error message,
matching the existing auth error-handling convention. Locally, the same
flow can be verified end-to-end against the Supabase CLI's Inbucket inbox.

**Verification**: `npm run lint`, `npm run build`, and the full Vitest
suite pass; `signup.test.ts` asserts the correct `emailRedirectTo`; a new
`confirm.test.ts` covers the callback route's success/failure paths; a
manual pass against local Supabase (Phase 2) confirms the real link works.

## What We're NOT Doing

- Not building a "resend confirmation email" flow for expired/used links — failures redirect to `/auth/signin` with the existing generic error-passthrough pattern (per interview: Failure UX).
- Not adding a new env var for the app's origin — the redirect target is derived from the incoming request at sign-up time (per interview: Origin).
- Not changing the production Supabase project's dashboard "Site URL" or "Redirect URLs" allow-list from code — this plan documents the exact manual steps required (Phase 2), but performing them is outside this plan's automated scope.
- Not touching `src/middleware.ts` or `PROTECTED_ROUTES` — the new route is a public callback (no session exists yet when it's hit), not a protected page.
- Not changing `signin.ts`'s error-handling behavior for an unconfirmed account — that message is Supabase's own verbatim text today and is out of scope for this fix (the bug is that confirmation never completes, not that the message is worded wrong).

## Implementation Approach

Mirror the existing `signup.ts`/`signin.ts` shape exactly for the new
callback route (not-configured check → try/catch → generic network-error
message → verbatim Supabase error passthrough → redirect), so the auth
route family stays consistent. Derive the redirect origin from
`context.request.url` at sign-up time rather than introducing new
environment configuration, since a forgotten per-environment env var is
the same failure class that caused this bug.

## Critical Implementation Details

**Local manual-verification prerequisite**: `supabase/config.toml`'s
`site_url`/`additional_redirect_urls` (currently pointing at port `3000`)
must be corrected to the real local dev origin (`http://localhost:4321`)
as a permanent part of this fix (Phase 1) — otherwise even a code-correct
fix cannot be verified locally, since the local Supabase CLI would reject
or fail to route the emailRedirectTo. This is separate from the
temporary `enable_confirmations` flip used only for Phase 2's manual test
(that flag reverts afterward; the port correction does not).

## Phase 1: Redirect target + confirmation callback route

### Overview

Add the missing `emailRedirectTo` to sign-up and build the route it
points at, so the PKCE exchange can actually complete.

### Changes Required:

#### 1. Sign-up redirect target

**File**: `src/pages/api/auth/signup.ts`

**Intent**: Pass an explicit, request-derived `emailRedirectTo` so Supabase's confirmation email points at this deployment's own `/api/auth/confirm` route instead of the project's dashboard-configured default.

**Contract**: Compute `const origin = new URL(context.request.url).origin;` and pass `{ email, password }` plus a second argument `{ emailRedirectTo: \`${origin}/api/auth/confirm\` }` to `supabase.auth.signUp(...)`. No other behavior in this file changes — the existing not-configured check, try/catch, and error-message passthrough stay exactly as they are.

#### 2. Confirmation callback route (new)

**File**: `src/pages/api/auth/confirm.ts`

**Intent**: Complete the PKCE exchange when a user clicks their confirmation link, establishing a real session and landing them on the protected app — mirroring the existing sign-in/sign-up error-handling shape exactly.

**Contract**: Export `GET: APIRoute`. Read `code` from `new URL(context.request.url).searchParams`. Build the Supabase client the same way `signin.ts`/`signup.ts` do (`createClient(context.request.headers, context.cookies)`); if `null`, redirect to `/auth/signin?error=${encodeURIComponent("Supabase is not configured")}` (matching the existing not-configured message verbatim). If `code` is missing, redirect to `/auth/signin?error=${encodeURIComponent("This confirmation link is invalid or has expired.")}` without calling Supabase. Otherwise, inside a `try`/`catch` matching `signin.ts`'s shape: call `supabase.auth.exchangeCodeForSession(code)`; on `{ error }`, redirect to `/auth/signin?error=${encodeURIComponent(error.message)}`; on a thrown network error, redirect with the same generic `"Unable to reach the authentication service — please try again shortly."` message used in `signup.ts`/`signin.ts`; on success, `return context.redirect("/dashboard")`.

#### 3. Local Supabase config port correction

**File**: `supabase/config.toml`

**Intent**: Fix the stale `site_url`/`additional_redirect_urls` values (port `3000`) so they match this project's actual local dev origin, making local confirmation-link testing possible at all.

**Contract**: Change line 154 to `site_url = "http://localhost:4321"` and line 156 to `additional_redirect_urls = ["http://localhost:4321"]` (also correcting the existing `https://` scheme, which doesn't match a local `astro dev` server).

#### 4. Sign-up test updates

**File**: `src/pages/api/auth/signup.test.ts`

**Intent**: Cover the new `emailRedirectTo` argument and give `buildContext()` the `request.url` the production code now depends on.

**Contract**: Add `url: "https://preptoclimb.example.com/api/auth/signup"` to the mocked `request` object inside `buildContext()`. In the existing "shows the verbatim Supabase message" test (or a new dedicated test), assert the mocked `signUp` was called with `expect(signUp).toHaveBeenCalledWith({ email: "climber@example.com", password: "weak" }, { emailRedirectTo: "https://preptoclimb.example.com/api/auth/confirm" })` (adjust the exact call-shape assertion to whichever of the two-argument forms the implementation uses).

#### 5. Confirmation callback route tests (new)

**File**: `src/pages/api/auth/confirm.test.ts`

**Intent**: Cover the callback route's full success/failure matrix using the same mocking convention as `signup.test.ts`/`signin.test.ts`.

**Contract**: A `buildContext(url)` helper builds a GET-shaped `APIContext` (no `formData`, just `request: { url, headers: new Headers() }`, `cookies: {}`, and a mocked `redirect`). Test cases: (a) Supabase not configured → redirect to `/auth/signin` with the "Supabase is not configured" message; (b) URL has no `code` param → redirect to `/auth/signin` with the "invalid or has expired" message, and `exchangeCodeForSession` is never called; (c) `exchangeCodeForSession` resolves with an `error` → redirect to `/auth/signin` with that verbatim message; (d) `exchangeCodeForSession` rejects (network) → redirect with the generic unreachable message; (e) `exchangeCodeForSession` resolves with no error → `redirect` called with `"/dashboard"`.

### Success Criteria:

#### Automated Verification:

- [ ] Lint passes: `npm run lint`
- [ ] Build passes: `npm run build`
- [ ] `astro sync` runs cleanly (no schema/type drift): `npx astro sync`
- [ ] Full test suite passes: `npm run test` (or the project's configured Vitest command), including the updated `signup.test.ts` and new `confirm.test.ts`

#### Manual Verification:

- [ ] Reading `src/pages/api/auth/signup.ts` and `src/pages/api/auth/confirm.ts` side by side confirms the redirect target and callback route agree on the exact path (`/api/auth/confirm`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: UX copy, real local verification, and production dashboard prerequisite

### Overview

Align the confirmation-pending page's copy with the new auto-sign-in
behavior, prove the fix works against a real Supabase confirmation email
locally, and document the manual production dashboard steps this plan's
code cannot perform.

### Changes Required:

#### 1. Confirmation-pending page copy

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: The current prod-branch copy ("...activate your account, then sign in to reach your protected planning area") is now inaccurate, since clicking the link signs the user in directly rather than requiring a separate manual sign-in.

**Contract**: Update the prod-branch `description` (currently at line 16-17) to reflect that opening the link both confirms and signs the user in — e.g. replace "then sign in to reach your protected planning area" with wording like "then continue straight into your protected planning area." Leave the dev-branch copy, `emoji`, `heading`, and `linkText` untouched.

### Success Criteria:

#### Automated Verification:

- [ ] Lint passes: `npm run lint`
- [ ] Build passes: `npm run build`
- [ ] Full test suite still passes: `npm run test`

#### Manual Verification:

- [ ] In `supabase/config.toml`, temporarily set `[auth.email] enable_confirmations = true`, run `supabase start` (or restart it) and `npm run dev`, sign up a new test account, retrieve the confirmation email from local Inbucket at `http://127.0.0.1:54324`, click the link, and confirm the browser lands signed-in on `/dashboard`
- [ ] Revert `enable_confirmations` back to `false` afterward (this flag stays reverted; only the Phase 1 port/URL correction is a permanent config change)
- [ ] Confirm an already-used or malformed confirmation link redirects to `/auth/signin` with a visible, non-blank error message
- [ ] Read the updated `confirm-email.astro` copy and confirm it no longer instructs the user to separately "sign in"
- [ ] Document (in this change's `verification.md`, created during this phase) the exact production Supabase dashboard steps still required before this fix takes effect in production: set **Auth → URL Configuration → Site URL** to the real production origin, and add `<production-origin>/api/auth/confirm` to the **Redirect URLs** allow-list — neither of which this plan's code can perform

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `signup.test.ts`: `emailRedirectTo` is derived correctly from the request origin and passed to `signUp`.
- `confirm.test.ts`: not-configured, missing-code, Supabase-error, network-error, and success paths for the new callback route (see Phase 1, Changes Required #5).

### Integration Tests:

- None new — the existing mocked-Supabase-client-boundary pattern is the project's established layer for this risk (per `context/foundation/test-plan.md` §2 Risk #3 guidance: cheapest layer that gives real signal, not e2e).

### Manual Testing Steps:

1. Local: temporarily enable Supabase email confirmations, sign up, retrieve the real email from Inbucket, click the link, confirm landing signed-in on `/dashboard`.
2. Local: attempt the same link a second time (already used) and confirm a clean error redirect rather than a crash or blank page.
3. Production (separate from this plan's code): after the dashboard Site URL / Redirect URLs steps are applied, repeat the same sign-up-and-click pass against the real deployment.

## Performance Considerations

None — this adds one query-param read and one additional Supabase SDK call on a low-frequency (once-per-signup) path; no impact on hot paths.

## Migration Notes

No data migration. The `supabase/config.toml` port correction only affects local developer environments spun up via the Supabase CLI; it has no effect on any hosted/production Supabase project, whose dashboard configuration is managed separately (see Phase 2's manual verification note).

## References

- Related research: `context/changes/signup-confirmation-redirect-bug/research.md`
- Existing error-handling pattern to mirror: `src/pages/api/auth/signin.ts:14-17`, `src/pages/api/auth/signup.ts:13-24`
- Cookie/PKCE mechanics verified against installed source: `node_modules/@supabase/ssr/dist/main/cookies.js:290-307`, `node_modules/@supabase/ssr/dist/main/createServerClient.js:33,48-66`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Redirect target + confirmation callback route

#### Automated

- [x] 1.1 Lint passes: `npm run lint` — 162d22e
- [x] 1.2 Build passes: `npm run build` — 162d22e
- [x] 1.3 `astro sync` runs cleanly: `npx astro sync` — 162d22e
- [x] 1.4 Full test suite passes: `npm run test` — 162d22e

#### Manual

- [x] 1.5 Reading `src/pages/api/auth/signup.ts` and `src/pages/api/auth/confirm.ts` side by side confirms the redirect target and callback route agree on the exact path — 162d22e

### Phase 2: UX copy, real local verification, and production dashboard prerequisite

#### Automated

- [x] 2.1 Lint passes: `npm run lint`
- [x] 2.2 Build passes: `npm run build`
- [x] 2.3 Full test suite still passes: `npm run test`

#### Manual

- [ ] 2.4 Temporarily enable local email confirmations and confirm a real Inbucket link lands signed-in on `/dashboard`
- [ ] 2.5 Revert `enable_confirmations` back to `false` afterward
- [ ] 2.6 Confirm an already-used or malformed confirmation link redirects to `/auth/signin` with a visible error message
- [x] 2.7 Confirm the updated `confirm-email.astro` copy no longer instructs a separate manual sign-in
- [x] 2.8 Document the required production Supabase dashboard steps in `verification.md`
