# Account Access Flow — Plan Brief

> Full plan: `context/changes/account-access-flow/plan.md`
> Research: `context/foundation/roadmap.md`

## What & Why

This change finishes the existing account access scaffold so PrepToClimb users can create an account, sign in, sign out, and reliably reach the protected planning entry. The core reason for the slice is that the repo already has auth mechanics, but the post-auth journey still leaks starter-template behavior instead of acting like a real product flow.

## Starting Point

Today the app already has Supabase-backed sign-up, sign-in, sign-out, and middleware protection for `/dashboard` and `/api/plans`. The gaps are flow cohesion and product framing: sign-in redirects to `/`, the dashboard still reads like a technical placeholder, and the public landing page still brands the generic starter.

## Desired End State

After this plan lands, sign-in takes the user straight to `/dashboard` as the temporary protected planning entry. Sign-up still uses the existing confirm-email path, but the messaging clearly explains the next step, and both the public and protected surfaces read as PrepToClimb rather than a starter demo.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Post-sign-in destination | Redirect to `/dashboard` | This makes sign-in actually complete the protected-planning access goal of `S-01` | Plan |
| Protected entry strategy | Keep `/dashboard` and reframe it | Reusing the existing protected route keeps scope low while making the signed-in destination intentional | Plan |
| Public landing scope | Minimal cleanup only | The slice should remove obvious starter mismatches without turning into a full homepage redesign | Plan |
| Signup behavior | Keep confirm-email flow | This preserves the current Supabase-safe path and avoids environment-specific auth churn | Plan |
| Verification level | Lint + build + manual auth smoke | The repo has no auth test harness yet, so real browser-flow verification is the right boundary for this slice | Plan |

## Scope

**In scope:**
- Change sign-in success routing to the protected dashboard
- Keep sign-up on confirm-email and improve its messaging
- Reframe `/dashboard` as the current signed-in planning entry
- Remove the most obvious starter-template auth copy from the public landing page
- Validate sign-up, sign-in, route protection, redirect, and sign-out manually

**Out of scope:**
- Questionnaire or weekly-plan generation
- Renaming `/dashboard` to a new route
- New automated auth test infrastructure
- Full landing-page redesign
- Changes to Supabase confirmation policy

## Architecture / Approach

Keep the current architecture intact: Supabase server routes still own auth actions, middleware still owns protected-route enforcement, and `/dashboard` remains the authenticated entry route. The implementation is a thin flow-cohesion pass across the auth handlers and the few public/protected pages that expose account access.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Align auth route behavior with the protected planning entry | Correct post-auth redirects and stable route behavior | Accidentally broadening auth behavior beyond the approved redirect change |
| 2. Reframe the protected and public auth surfaces around PrepToClimb | Product-facing dashboard, landing, and confirm-email messaging | Letting a small cleanup turn into a broader design rewrite |
| 3. Verify the end-to-end account access journey and guardrails | Confidence that real users can sign up, sign in, reach `/dashboard`, and sign out safely | Declaring the slice done without a real manual auth smoke pass |

**Prerequisites:** Working Supabase auth configuration in local/dev, existing `/dashboard` route and middleware guard remain in place  
**Estimated effort:** ~1-2 sessions across 3 small phases

## Open Risks & Assumptions

- The plan assumes `/dashboard` remains the correct temporary protected entry until `S-02` introduces the weekly-plan flow.
- Manual verification depends on a working Supabase environment because there is no committed auth test harness yet.
- Some dashboard copy may need another pass once the actual planning experience replaces the placeholder.

## Success Criteria (Summary)

- A user can sign up, confirm next steps, sign in, and land on `/dashboard` without falling back to the generic home page.
- Anonymous access to `/dashboard` is still blocked and redirected to `/auth/signin`.
- Public and protected auth-facing pages read as PrepToClimb rather than `10x Astro Starter`.
