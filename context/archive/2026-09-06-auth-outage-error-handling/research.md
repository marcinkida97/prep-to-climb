---
date: 2026-09-06T18:32:15Z
researcher: Claude (10x-research)
git_commit: 1a2244b690a1fef454722b29d5068cc4c67ad86f
branch: main
repository: prep-to-climb
topic: "Risk #7 — Supabase outage surfaces as an opaque, unrecoverable error during sign-in/sign-up"
tags: [research, codebase, auth, error-handling, supabase, resilience]
status: complete
last_updated: 2026-09-06
last_updated_by: Claude (10x-research)
---

# Research: Risk #7 — Supabase outage error handling in sign-in/sign-up

**Date**: 2026-09-06T18:32:15Z
**Researcher**: Claude (10x-research)
**Git Commit**: 1a2244b690a1fef454722b29d5068cc4c67ad86f
**Branch**: main
**Repository**: prep-to-climb

## Research Question

For `test-plan.md` Risk #7 ("An external auth dependency outage (e.g.
Supabase down) surfaces as an opaque, unrecoverable error during
sign-in/sign-up"): Is there a place where this risk actually exists (file,
method, module)? What behavior would be proof that it is guarded? What test
would be cheapest to verify it?

## Summary

The risk exists, but not in the shape the original incident report
describes. There is **no shared error-serialization utility anywhere in the
codebase** (no file maps a Supabase error into a response body); every
route reimplements its own error response inline. For sign-in/sign-up
specifically, the flow is entirely **redirect + query-param**, not
fetch/JSON — so the previously-reported opaque `{}` JSON body does not
match current code; that finding is either stale or was misattributed to a
different endpoint (the only `JSON.stringify({...})` on the whole auth
surface is `middleware.ts`'s unrelated 401 guard on protected routes, and
its body is `{ error: "Unauthorized" }`, not `{}`).

The real current gap is structural: `signin.ts:13` and `signup.ts:13` await
`supabase.auth.signInWithPassword(...)` / `supabase.auth.signUp(...)` with
**no try/catch**. The Supabase SDK returns `{ error }` for an auth-level
rejection (bad password, etc.), which the handlers already handle by
redirecting with `error.message` in the query string. But if Supabase is
genuinely unreachable — network outage, DNS failure, timeout — the
underlying fetch inside the SDK call can **throw** rather than resolve with
an `{ error }` object. That throw is uncaught, propagates out of the
`POST` handler, and falls through to Astro/Cloudflare Workers' default
unhandled-exception behavior, which is exactly the "opaque, unrecoverable
error" the risk describes — just triggered by a thrown exception, not a
returned `{}` body.

No test infrastructure exists yet (test-plan.md Phase 1 status: `change
opened`, not implemented) — confirmed no test runner, no test files, no
`vitest.config` anywhere in the repo or its history.

## Detailed Findings

### Where the risk lives

- `src/pages/api/auth/signin.ts:9-17` — `supabase.auth.signInWithPassword({ email, password })` at line 13 is awaited with no try/catch. Only the SDK's *resolved* `{ error }` case is handled (lines 15-16); a *thrown/rejected* call is not.
- `src/pages/api/auth/signup.ts:9-17` — identical structure; `supabase.auth.signUp({ email, password })` at line 13 has the same gap.
- `src/pages/api/auth/signout.ts:5-8` — discards any error entirely (`await supabase.auth.signOut()`, no check at all); out of scope for #7 since it's not sign-in/sign-up, but same class of gap.
- No shared error-handling/serialization utility exists in `src/lib/` or `src/pages/api/` to funnel a thrown error through — each route (`plans/generate.ts`, `plans/smoke.ts`, `middleware.ts`) reimplements its own inline `JSON.stringify(...)`/`Response` construction, with no consistent shape or status-code convention, and none special-case Supabase's `AuthError` type (`grep -r AuthError src/` → zero hits).
- `src/lib/supabase.ts:8-27` — single `createClient(...)` factory (server-only, via `@supabase/ssr`'s `createServerClient`); returns `null` only when env vars are missing (a *configuration* absence, already handled at `signin.ts:10-12` / `signup.ts:10-12`) — this is a different, already-guarded case from a *live* Supabase outage during the auth call itself.

### What the original incident report doesn't match anymore

- The reported opaque `{}` body (`improvements.md` item 2) isn't reproducible from current sign-in/sign-up code: both handlers return `context.redirect(...)` with `error.message` embedded in the query string, never a JSON body, on the resolved-`{error}` path.
- `git log -p -- src/pages/api/auth/signin.ts` shows the redirect-with-`error.message` pattern has been present since the initial commit (`77f9e53`); the only later change (`381b2c6`) altered the post-login redirect target, not error handling. So either the incident predates this code, or the `{}` was observed somewhere else (e.g. the middleware's `/api/plans` 401 path, which does return JSON but `{ error: "Unauthorized" }`, not `{}`, and isn't the auth flow either).
- Conclusion for `/10x-plan`: treat the residual risk as **unhandled exception on Supabase network-level unavailability**, not as "the resolved-error path returns an empty body" — the resolved-error path already carries a real message today.

### Frontend consumption (for context, not the guarded surface)

- `src/pages/auth/signin.astro:5,19` / `signup.astro` — read `Astro.url.searchParams.get("error")` server-side, pass as `serverError` prop.
- `src/components/auth/SignInForm.tsx` / `SignUpForm.tsx` — plain native `<form method="POST">`, no `fetch`, no client-side response parsing.
- `src/components/auth/ServerError.tsx:7-16` — renders whatever string lands in `serverError`; it will render an unhandled exception's absence of a redirect as nothing at all (a blank/crashed page), since a thrown error never reaches this component today.

## What Would Prove It's Guarded

Wrap the Supabase call in each handler in a try/catch that maps *any*
thrown error to the same `context.redirect(`/auth/{signin|signup}?error=...`)`
contract already used for the resolved-`{error}` case — with a generic,
actionable message ("Unable to reach the authentication service — please
try again shortly") rather than leaking a raw thrown error's message, since
a network-level exception's `.message` is not guaranteed to be
user-appropriate the way an `AuthError.message` is.

Proof of guard, concretely: given a Supabase client whose
`signInWithPassword` / `signUp` **rejects** (not resolves with `{error}`),
the handler still returns a redirect Response carrying a non-empty,
human-readable `error` query param — never an unhandled exception
propagating out of the `POST` export, and never a blank/crashed response.

## Cheapest Test to Verify

A **unit test directly on the exported `POST` handler function** in
`signin.ts` / `signup.ts`, per test-plan.md's own Risk Response Guidance
row for #7 ("unit test on the error-handling/serialization function with a
simulated failure response"):

- Mock `@/lib/supabase`'s `createClient` (e.g. Vitest `vi.mock`) to return a
  fake client whose `auth.signInWithPassword` (or `auth.signUp`) is a
  `vi.fn().mockRejectedValue(new Error("network unreachable"))`.
- Build a minimal fake Astro `APIContext` (a `Request` with form-encoded
  body, a stub `cookies`, and a `redirect` spy).
- Call `POST(context)` directly (no server, no network, no Playwright).
- Assert: `redirect` was called with a URL matching `/auth/signin?error=...`
  (or the eventual sanitized-message contract), and the call did not throw
  out of `POST` itself.

This requires no HTTP layer, no browser, no real Supabase instance —
cheapest possible layer, and it is the same layer test-plan.md already
assigned to Risk #7. It does depend on Phase 1's test-runner bootstrap
(Vitest) landing first, since no test infrastructure exists in the repo
yet.

## Code References

- `src/pages/api/auth/signin.ts:13` — unguarded `await supabase.auth.signInWithPassword(...)`
- `src/pages/api/auth/signup.ts:13` — unguarded `await supabase.auth.signUp(...)`
- `src/pages/api/auth/signout.ts:5-8` — same class of gap, out of scope for #7
- `src/lib/supabase.ts:8-27` — single server-only client factory, `null`-on-missing-env already handled separately
- `src/middleware.ts:18-28` — only other JSON error body on the auth-adjacent surface; unrelated route (`/api/*` 401 guard), not `{}`
- `src/pages/api/plans/generate.ts:131-136` — local `jsonResponse` helper, not shared/exported, illustrates the lack of a repo-wide error-serialization convention
- `src/pages/auth/signin.astro:5,19`, `src/components/auth/ServerError.tsx:7-16` — how a redirect's `error` param is rendered today (and would silently show nothing if an exception crashes the handler instead of redirecting)

## Architecture Insights

- The auth flow is entirely native-form-POST + redirect, not fetch/JSON —
  any resilience fix must stay within that contract (redirect with an
  `error` query param) rather than introducing a JSON error body, to match
  how the rest of the flow already works.
- There is no repo-wide error-response convention at all (three different
  ad hoc shapes across `generate.ts`, `smoke.ts`, `middleware.ts`) — fixing
  Risk #7 by adding a one-off try/catch in `signin.ts`/`signup.ts` is
  consistent with the existing (non-abstracted) style; introducing a shared
  error-serialization utility would be a larger, cross-cutting change
  beyond this risk's scope.

## Historical Context (from prior changes)

- `context/foundation/improvements.md:6` — origin of the risk ("only `{}`
  error message during sign in/sign up" when Supabase was down); per this
  research, no longer reproducible from current code, likely describes a
  prior code state or a different endpoint.
- No prior `context/changes/**` or `context/archive/**` folder touches
  `signin.ts`/`signup.ts` error handling specifically (checked via
  `git log -p` on both files — only one unrelated redirect-target commit).

## Related Research

- None yet under this change; this is the first artifact for
  `auth-outage-error-handling`.

## Open Questions

- Exact wording/contract for the sanitized fallback message is a `/10x-plan`
  decision, not a research finding.
- Whether `signout.ts`'s silently-discarded error should be folded into
  this same change or left for a separate slice (`/10x-plan` to scope).
