# Account Settings Implementation Plan

## Overview

Add a `/settings` page where a signed-in user can change their password and delete their own
account. Both actions are native form-POST+redirect routes, matching the existing sign-in/sign-up
convention rather than the JSON-fetch convention used by the plan-generation flow.

## Current State Analysis

No settings page, account-management API, or service-role admin client exist anywhere in the
codebase. The only existing auth routes (`src/pages/api/auth/{signin,signup,signout,confirm}.ts`)
are all public or session-ending; there is no route today that lets an authenticated user mutate
their own account. `src/lib/supabase.ts` exports only a cookie-bound SSR client built from the anon
`SUPABASE_KEY` — there is no admin/service-role client in `src/`. The only place a service-role key
is used at all is `e2e/global-setup.ts`, for local test-user seeding only, and a prior review
(`context/changes/testing-critical-path-coverage/reviews/impl-review.md`) already flagged the risk
of that key being pointed at a real hosted project by mistake.

The database already fully supports safe self-service deletion: `questionnaire_responses.user_id`
references `auth.users(id) on delete cascade`, and `weekly_plans` → `plan_days` →
`recommended_exercises` cascade from there (`supabase/migrations/20260614090000_minimal_plan_persistence.sql`).
Calling `auth.admin.deleteUser(userId)` will atomically remove all of a user's app data in one
database transaction — no manual cleanup step is needed.

### Key Discoveries:

- `Topbar.astro` already renders a signed-in nav (email + "Planning dashboard" link + a plain
  `<form method="POST" action="/api/auth/signout">` sign-out button) on every authenticated page —
  the settings link and the delete-account form's plain-Astro-form pattern both extend this
  existing precedent directly.
- `src/middleware.ts`'s `PROTECTED_ROUTES` is a flat array matched by `startsWith` — adding
  `/settings` and a new `/api/account` prefix (kept separate from the public `/api/auth` routes)
  are the only two entries this plan needs to add.
- `src/components/auth/{FormField,PasswordToggle,SubmitButton,ServerError}.tsx` and the
  `SignUpForm.tsx` local-`errors`-state + `clearError` + `validate()` pattern are the direct
  template for the new password-change form, including its exact password policy
  (`MIN_PASSWORD_LENGTH = 6`, `SignUpForm.tsx:8`).
- `src/pages/api/auth/signin.test.ts` is the direct template for testing the two new routes: a
  `buildContext` helper with a mocked `redirect` and a mocked `createClient`, asserting on the
  exact redirect URL string.

## Desired End State

A signed-in user can reach `/settings` via a new "Settings" link in `Topbar.astro`. There they see
their email as read-only context, a password-change form, and a delete-account button behind a
confirm dialog. Changing the password updates it via the existing session (no current-password
re-entry) and signs out the user's other active sessions as a compensating safeguard, then
redirects back to `/settings` with a success message. Deleting the account calls the new
service-role admin client, cascades all app data automatically, signs the current session out, and
redirects to `/auth/signin` with a confirmation message. Both routes are blocked for
unauthenticated requests by `middleware.ts`.

**Verification**: `npm run lint`, `npm run build`, and `npm run test` all pass; new tests for both
routes follow the `signin.test.ts` redirect-assertion pattern; manual click-through confirms both
flows end-to-end, including that deleting an account actually removes the user's
`questionnaire_responses`/`weekly_plans` rows (spot-checked via the local Supabase stack) and that
changing a password invalidates a second, separately-logged-in session.

## What We're NOT Doing

- No account-info display beyond the read-only email label (no sign-up date, no profile fields).
- No email-change flow.
- No JSON-fetch API style for these two actions — native form-POST+redirect only.
- No current-password re-entry before allowing a password change.
- No type-to-confirm phrase before account deletion — a plain confirm dialog only.
- No shared foundation/module for the service-role admin client beyond this slice — it lives
  entirely inside `account-settings`, per the roadmap's explicit scoping note.
- No changes to `DashboardPlanShell.tsx`, `QuestionnaireForm.tsx`, or any plan-generation code.

## Implementation Approach

Ship the lower-risk half first: the settings page shell and password change need no new security
surface (they only use the existing session-bound Supabase client), so they land in Phase 1.
Account deletion requires new infrastructure — a service-role admin client and its secret wiring —
so it's isolated in Phase 2 for focused review. Phase 3 adds tests and closes out verification.

## Critical Implementation Details

- **Session invalidation ordering (password change)**: `supabase.auth.signOut({ scope: "others" })`
  must be called *after* `auth.updateUser({ password })` succeeds, using the same session-bound
  client — calling it before would have no effect on the change itself, and calling it on failure
  would sign out other sessions for a password change that never actually happened.
- **Service-role key must never be sent to the client.** `src/lib/supabase-admin.ts` is a
  server-only module; it must only ever be imported from `.ts` API route files under
  `src/pages/api/account/`, never from a `.tsx` component or anything shipped to the browser.

## Phase 1: Settings page shell and password change

### Overview

Adds the `/settings` page, the Topbar nav link, and the password-change form + route. Uses only
the existing session-bound Supabase client — no new secrets or admin infrastructure.

### Changes Required:

#### 1. Protected route registration

**File**: `src/middleware.ts`

**Intent**: Ensure `/settings` requires authentication, matching the existing `/dashboard` entry.

**Contract**: Add `"/settings"` to the `PROTECTED_ROUTES` array (line 4). Do not add `/api/account`
yet — that lands in Phase 2 alongside the routes it protects, so each phase's middleware change
ships with the routes it covers.

#### 2. Settings page

**File**: `src/pages/settings.astro`

**Intent**: The protected page shell, following `dashboard.astro`'s pattern (`Layout` + `Topbar` +
a page-level read of `Astro.locals.user` for the email label and `Astro.url.searchParams` for
`pwError`/`pwSuccess`).

**Contract**: Renders `Layout` → `Topbar` → a card with: the signed-in email as a plain label, a
`<ChangePasswordForm serverError={pwError} successMessage={pwSuccess} client:load />` island, and
(added in Phase 2) the delete-account form. `pwError`/`pwSuccess` are read from
`Astro.url.searchParams.get("pwError")` / `.get("pwSuccess")`.

#### 3. Topbar nav link

**File**: `src/components/Topbar.astro`

**Intent**: Make the new page discoverable from every authenticated page.

**Contract**: Add a `<a href="/settings">Settings</a>` link inside the existing signed-in `<div
class="flex items-center gap-3">` block (`Topbar.astro:12-21`), styled identically to the existing
"Planning dashboard" link, positioned between it and the sign-out form.

#### 4. Success-message component

**File**: `src/components/auth/SuccessMessage.tsx`

**Intent**: A green-styled sibling to `ServerError.tsx` for the success confirmations this feature
introduces (password changed, account deleted) that no existing component covers.

**Contract**: Same dumb-component shape as `ServerError` — `{ message?: string | null }` prop,
renders `null` if empty, otherwise a styled banner (reuse `CircleCheck` or similar from
`lucide-react` in place of `CircleAlert`, green border/background instead of red).

#### 5. Password-change form

**File**: `src/components/auth/ChangePasswordForm.tsx`

**Intent**: New password + confirm-new-password fields, following `SignUpForm.tsx`'s exact
`FormField` + `PasswordToggle` + local `errors` state + `clearError` + `validate()` pattern and its
`MIN_PASSWORD_LENGTH = 6` policy. Submits via native form POST — `<form method="POST"
action="/api/account/change-password">`.

**Contract**: Props `{ serverError?: string | null; successMessage?: string | null }`. Renders
`ServerError` and `SuccessMessage` (whichever is non-null) below the fields, above
`SubmitButton`. Client-side `validate()` mirrors `SignUpForm`'s rules (required, min length,
confirm-match) — the server route re-validates independently (see below).

#### 6. Password-change route

**File**: `src/pages/api/account/change-password.ts`

**Intent**: Authenticated-only route that updates the user's password via the existing session
client, then invalidates their other sessions as a compensating safeguard for skipping
current-password re-entry.

**Contract**: `POST`. Checks `context.locals.user` first — no user → redirect to `/auth/signin`
(mirrors `middleware.ts`'s own guard as defense-in-depth, matching `generate.ts`'s pattern of
checking `locals.user` inside the route too). Parses `context.request.formData()` for
`newPassword`; server-side validates required + `length >= 6` (redirect back to
`/settings?pwError=...` on failure, same as `signin.ts`'s validation-redirect style). Calls
`supabase.auth.updateUser({ password: newPassword })`; on Supabase error, redirect to
`/settings?pwError=<encoded message>`. On success, call
`supabase.auth.signOut({ scope: "others" })` (log via `console.error("change-password: sign-out-others failed", ...)`
on failure but do not block the success redirect on it — the password change itself already
succeeded). Redirect to `/settings?pwSuccess=Password updated.`. Any thrown exception →
`console.error("change-password: supabase call failed", ...)` + redirect to
`/settings?pwError=Unable to reach the authentication service.` (same generic-message convention
as `signin.ts`/`signup.ts`).

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Existing unit tests still pass: `npm run test`

#### Manual Verification:

- `/settings` redirects to `/auth/signin` when not logged in.
- The "Settings" link appears in the Topbar on the dashboard and navigates to `/settings`.
- Submitting a valid new password shows the success message and the password is actually changed
  (sign out, sign back in with the new password).
- Submitting a too-short or mismatched password shows the client-side error and does not submit.
- After changing the password, a second browser session (or incognito window) signed in as the
  same user is signed out on its next request.

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human that the manual testing was successful before
proceeding to the next phase.

---

## Phase 2: Account deletion

### Overview

Adds the service-role admin client, its secret wiring, the delete-account form and route, and
extends the sign-in page to show a post-deletion confirmation message.

### Changes Required:

#### 1. Service-role secret declaration

**File**: `astro.config.mjs`

**Intent**: Declare `SUPABASE_SERVICE_ROLE_KEY` as a proper server secret, promoting it from its
current e2e-only, undeclared usage to a real application secret.

**Contract**: Add `SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: "server", access:
"secret", optional: true })` alongside the existing `SUPABASE_URL`/`SUPABASE_KEY` entries
(`astro.config.mjs:19-20`). `optional: true` matches the existing two fields' convention so `astro
sync`/`build` don't hard-fail in environments where it isn't set — the new admin client and route
handle a missing key gracefully at runtime instead (see below).

#### 2. Env documentation update

**File**: `.env.example`

**Intent**: The existing comment on `SUPABASE_SERVICE_ROLE_KEY` says it's "only needed to run the
e2e login test locally" — that's no longer true once account deletion ships.

**Contract**: Update the comment to note it's now also required in production for account
deletion, in addition to local e2e seeding.

#### 3. Production secret requirement

**File**: `wrangler.jsonc`

**Intent**: Match the existing `secrets.required` declaration convention for the new production
dependency.

**Contract**: Add `"SUPABASE_SERVICE_ROLE_KEY"` to the `secrets.required` array (`wrangler.jsonc`,
alongside the existing `"SUPABASE_URL"`, `"SUPABASE_KEY"`).

#### 4. Admin client

**File**: `src/lib/supabase-admin.ts`

**Intent**: A server-only Supabase client authenticated with the service-role key, isolated from
the per-request SSR client in `src/lib/supabase.ts` since it has no cookie/session concept and
must never be reused for anything except the Admin API.

**Contract**: Exports `createAdminClient()` returning a plain `SupabaseClient` from
`createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` (the standard `@supabase/supabase-js`
`createClient`, not `@supabase/ssr`'s `createServerClient`), or `null` if either env var is unset —
mirroring `src/lib/supabase.ts`'s existing null-return convention so callers handle "not
configured" the same way they already do for the regular client.

#### 5. Protected route registration

**File**: `src/middleware.ts`

**Intent**: Protect the new deletion route.

**Contract**: Add `"/api/account"` to `PROTECTED_ROUTES` — this single prefix also covers
`/api/account/change-password` from Phase 1 (harmless overlap; `startsWith` matching means either
entry alone would suffice, but leaving both is clearer than removing the more specific one).

#### 6. Delete-account form

**File**: `src/pages/settings.astro`

**Intent**: A plain Astro form (no React island needed) guarded by a browser `confirm()` dialog
before submitting, matching `Topbar.astro`'s existing plain-form sign-out precedent.

**Contract**: `<form method="POST" action="/api/account/delete-account" onsubmit="return confirm('Delete your account? This cannot be undone.')">`
with a submit button. Renders below the password-change form. Also renders `delError` (read from
`Astro.url.searchParams.get("delError")`) via `ServerError` if present.

#### 7. Delete-account route

**File**: `src/pages/api/account/delete-account.ts`

**Intent**: Deletes the authenticated user's own account via the service-role admin client. No
app-data pre-deletion step is needed — the existing `ON DELETE CASCADE` chain handles it atomically
inside `auth.admin.deleteUser`.

**Contract**: `POST`. Checks `context.locals.user` — no user → redirect to `/auth/signin`. Creates
the admin client via `createAdminClient()`; `null` → redirect to `/settings?delError=Account
deletion is temporarily unavailable.` (generic message per the error-handling decision — never
mention "service role" or config internals to the client). Calls
`adminClient.auth.admin.deleteUser(context.locals.user.id)`; on error, `console.error("delete-account:
supabase call failed", ...)` + redirect to `/settings?delError=Unable to delete your account. Please
try again.`. On success, call the existing session client's `supabase.auth.signOut()` (best-effort;
log on failure but don't block the redirect — the account is already gone at that point) and
redirect to `/auth/signin?message=Your account has been deleted.`.

#### 8. Sign-in page success message

**File**: `src/pages/auth/signin.astro`

**Intent**: Surface the post-deletion confirmation.

**Contract**: Read `const message = Astro.url.searchParams.get("message");` alongside the existing
`error` read, and render `<SuccessMessage message={message} />` next to the existing
`<SignInForm serverError={error} .../>` (no change to `SignInForm` itself).

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build passes: `npm run build`
- Existing unit tests still pass: `npm run test`

#### Manual Verification:

- Clicking "Delete account" shows the confirm dialog; cancelling it leaves the account untouched.
- Confirming deletion redirects to `/auth/signin` with the success message visible.
- After deletion, the deleted email can sign up again as a brand-new account (proves the old
  `auth.users` row and its cascaded data are actually gone, not just hidden).
- Spot-check in the local Supabase stack (`supabase studio` or `select` queries) that the deleted
  user's `questionnaire_responses`/`weekly_plans`/`plan_days` rows are gone.
- With `SUPABASE_SERVICE_ROLE_KEY` unset, deletion shows the "temporarily unavailable" message
  instead of a crash or a leaked internal error.

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human that the manual testing was successful before
proceeding to the next phase.

---

## Phase 3: Verification & tests

### Overview

Adds automated test coverage for both new routes, following the existing redirect-style test
template.

### Changes Required:

#### 1. Password-change route tests

**File**: `src/pages/api/account/change-password.test.ts`

**Intent**: Cover the route's branches following `signin.test.ts`'s `buildContext` + mocked
`redirect` + mocked `createClient` pattern.

**Contract**: Cases: unauthenticated (no `locals.user`) → redirect to `/auth/signin`; missing/short
`newPassword` → redirect with `pwError`; Supabase `updateUser` error → redirect with `pwError`
containing the verbatim message; success → `signOut({ scope: "others" })` called, then redirect to
`/settings?pwSuccess=...`; thrown exception → generic `pwError` message.

#### 2. Delete-account route tests

**File**: `src/pages/api/account/delete-account.test.ts`

**Intent**: Same template, additionally mocking `src/lib/supabase-admin.ts`'s `createAdminClient`
separately from `src/lib/supabase.ts`'s `createClient`.

**Contract**: Cases: unauthenticated → redirect to `/auth/signin`; admin client not configured
(`createAdminClient` returns `null`) → redirect with `delError`; `auth.admin.deleteUser` error →
redirect with `delError`; success → redirect to `/auth/signin?message=...`.

### Success Criteria:

#### Automated Verification:

- New unit tests pass: `npm run test`
- Lint passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification:

- Full click-through of both flows one more time end-to-end after all phases, confirming nothing
  regressed across the three phases.

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- Redirect-target assertions for every branch of both new routes (see Phase 3 above).

### Integration Tests:

- None new — both routes are covered at the unit/route level following the existing
  `signin.test.ts` template; no separate integration layer exists for redirect-style auth routes in
  this codebase today.

### Manual Testing Steps:

1. Sign in, navigate to `/settings` via the new Topbar link.
2. Change the password to a new valid value; confirm the success message and that a second
   session for the same user gets signed out.
3. Attempt a change with a too-short/mismatched password; confirm client-side validation blocks it.
4. Click "Delete account", cancel the confirm dialog, confirm nothing happened.
5. Click "Delete account", confirm the dialog, confirm redirect to sign-in with the success
   message, and confirm the email can be used to sign up again as a new account.
6. Directly hit `/settings`, `/api/account/change-password`, and `/api/account/delete-account`
   while signed out; confirm all three are blocked by middleware.

## Performance Considerations

None — both actions are single, low-frequency, user-initiated requests with no bulk or repeated
operations.

## Migration Notes

None — no schema changes. The existing `ON DELETE CASCADE` chain (already in place since
`20260614090000_minimal_plan_persistence.sql`) is what makes account deletion safe without a
migration.

## References

- Roadmap slice: `context/foundation/roadmap.md` S-03 (`account-settings`)
- Existing auth routes: `src/pages/api/auth/{signin,signup,signout,confirm}.ts`
- Existing auth route test template: `src/pages/api/auth/signin.test.ts`
- Cascade chain: `supabase/migrations/20260614090000_minimal_plan_persistence.sql`
- Prior service-role-key risk note: `context/changes/testing-critical-path-coverage/reviews/impl-review.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not
> rename step titles. See `references/progress-format.md`.

### Phase 1: Settings page shell and password change

#### Automated

- [x] 1.1 Lint passes: `npm run lint` — 8fe35de
- [x] 1.2 Build passes: `npm run build` — 8fe35de
- [x] 1.3 Existing unit tests still pass: `npm run test` — 8fe35de

#### Manual

- [ ] 1.4 `/settings` redirects to `/auth/signin` when not logged in
- [ ] 1.5 "Settings" link appears in Topbar and navigates correctly
- [ ] 1.6 Valid password change shows success message and actually changes the password
- [ ] 1.7 Invalid password change shows client-side error, does not submit
- [ ] 1.8 A second session for the same user is signed out after a password change

### Phase 2: Account deletion

#### Automated

- [x] 2.1 Lint passes: `npm run lint`
- [x] 2.2 Build passes: `npm run build`
- [x] 2.3 Existing unit tests still pass: `npm run test`

#### Manual

- [ ] 2.4 Confirm dialog appears on delete; cancelling leaves the account untouched
- [ ] 2.5 Confirming deletion redirects to sign-in with the success message
- [ ] 2.6 Deleted email can sign up again as a new account
- [ ] 2.7 Deleted user's questionnaire/plan rows are actually gone (DB spot-check)
- [ ] 2.8 Missing service-role key shows a graceful "temporarily unavailable" message

### Phase 3: Verification & tests

#### Automated

- [ ] 3.1 New unit tests pass: `npm run test`
- [ ] 3.2 Lint passes: `npm run lint`
- [ ] 3.3 Build passes: `npm run build`

#### Manual

- [ ] 3.4 Full end-to-end click-through of both flows after all phases, no regressions
