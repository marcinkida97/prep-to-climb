# Guard Sign-In/Sign-Up Against Supabase Outage — Plan Brief

> Full plan: `context/changes/auth-outage-error-handling/plan.md`
> Research: `context/changes/auth-outage-error-handling/research.md`

## What & Why

`test-plan.md` Risk #7: a Supabase outage during sign-in/sign-up should
never surface as an opaque, unrecoverable error. Research found the
resolved-error path (bad password, etc.) already redirects with a real
message — but neither `signin.ts` nor `signup.ts` guards against the
Supabase call actually *throwing* (a live network-level outage), which
today would propagate an unhandled exception out of the handler.

## Starting Point

`signin.ts:13` and `signup.ts:13` await the Supabase auth call and check
only the resolved `{ error }` shape (lines 15-17). No try/catch exists
around either await. No shared error-handling utility exists anywhere in
the repo to extend instead.

## Desired End State

If Supabase is unreachable when a user submits sign-in or sign-up, they
land back on the same form with a clear, actionable message ("Unable to
reach the authentication service — please try again shortly") instead of
a crashed or blank page — and the team gets a `console.error` line marking
the event, instead of learning about outages only from user complaints.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| `signout.ts` scope | Left out of this change | Risk #7 names only sign-in/sign-up; identical gap in signout is a separate, lower-impact fix | Plan |
| Message strategy | Sanitize only the caught exception; resolved SDK errors stay verbatim | Zero behavior change to the already-working path; raw thrown errors aren't guaranteed user-appropriate the way `AuthError.message` is | Plan |
| Code structure | Duplicated inline try/catch in both files | Matches the repo's existing non-abstracted style (research found zero shared error-handling utilities); two call sites don't justify a new abstraction | Research / Plan |
| Logging | `console.error` on catch, before redirecting | Without it, an outage is invisible server-side — the same class of blind spot the original incident complained about, just moved | Plan |
| Test authoring | Deferred to Lesson 2 `/10x-tdd` | `AGENTS.md` lesson boundary: "Do not write test code. That is Lesson 2" — this plan specifies the test contract only | Plan |
| Test infrastructure | Added in this change (Phase 1: Vitest + config + script) | No test runner exists anywhere in the repo; the Testing Strategy's spec needs somewhere to run — installing/configuring a harness is tooling, not test-code authoring, so it doesn't cross the Lesson 1 boundary | Plan |

## Scope

**In scope:** Vitest install + minimal config + `test` script; try/catch
guard + generic-message redirect + `console.error` logging in `signin.ts`
and `signup.ts`.

**Out of scope:** `signout.ts`; sanitizing the resolved-error path; a
shared error-handling helper; authoring the actual unit test file;
`jsdom`/`@testing-library/*`; wiring `test` into CI; structured
alerting/observability beyond `console.error`.

## Architecture / Approach

Two symmetric, independent try/catch blocks — one per handler — each
mirroring the redirect contract the resolved-error branch already uses,
just with a fixed message and a log call on the newly-caught path.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Set up Vitest infrastructure | `vitest` installed, `vitest.config.ts` (via Astro's `getViteConfig`), `test`/`test:watch` scripts, harness verified with `passWithNoTests` | None of this is wired into CI yet — stays local-only until a later phase claims that gate |
| 2. Guard both auth handlers | Try/catch + log + generic redirect in `signin.ts` and `signup.ts` | Manual verification requires actually simulating a Supabase outage locally (no automated test in this pass) |

**Prerequisites:** None.
**Estimated effort:** ~1 session, two phases, small/symmetric edits.

## Open Risks & Assumptions

- Manual verification (simulating an unreachable Supabase) is the only
  proof Phase 2 gets before the actual unit test lands under `/10x-tdd` —
  there's a window where this behavior is un-automated even with the
  harness in place.
- `signout.ts`'s identical gap remains open; someone needs to remember to
  pick it up later.
- This change installs Vitest ahead of `test-plan.md`'s own official
  Phase 1 (`context/changes/testing-critical-path-coverage/`, not yet
  started). When that rollout phase is eventually picked up, it will
  find Vitest already present and can skip straight to adding
  `jsdom`/`@testing-library/*` and its own tests — worth a heads-up to
  whoever runs `/10x-test-plan` next so it isn't reinstalled.

## Success Criteria (Summary)

- A user hitting a Supabase outage during sign-in/sign-up sees a clear,
  actionable message and lands back on the form — never a crash or blank
  page.
- A normal wrong-password attempt still shows the original Supabase
  message, unchanged.
- The outage is visible in server logs via `console.error`.
