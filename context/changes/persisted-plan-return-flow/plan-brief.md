# Persisted Plan Return Flow — Plan Brief

> Full plan: `context/changes/persisted-plan-return-flow/plan.md`

## What & Why

This change hardens and proves the "return later and still see my saved weekly plan" experience. The core saved-plan-first dashboard behavior already exists from `S-02`; this slice exists to make the recovery path explicit when that saved plan cannot be loaded safely and to retain real cross-session evidence that the roadmap promise is true.

## Starting Point

Today, sign-in already redirects to `/dashboard`, the dashboard already loads the current persisted plan server-side, and returning users already see a saved-plan-first state with regenerate as a secondary action. The main remaining gap is completion confidence: the app does not yet model a distinct recovery fallback for plan-load failure, and the actual sign-out/sign-in return path is still not recorded as retained verification evidence.

## Desired End State

When this plan is done, a user can generate a weekly plan, sign out, sign back in, and immediately return to that saved plan on `/dashboard`. If the saved plan cannot be loaded safely, the dashboard falls back to the questionnaire with clear recovery messaging and lets the user regenerate from the same page instead of leaving them in a broken return state.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Slice scope | Verification plus small polish | The feature foundation already exists, so `S-03` should close the real gap instead of duplicating `S-02` | Plan |
| Returning-user default | Saved plan first, regenerate secondary | This matches the existing dashboard behavior and the persistence promise | Plan |
| Freshness policy | Persist until explicit regenerate | The current one-active-plan model has no freshness rules and does not need them for MVP | Plan |
| Failure handling | Fallback to questionnaire with recovery messaging | This keeps the user unblocked and stays inside the single-page dashboard model | Plan |
| Completion boundary | Manual cross-session proof plus repo gates | The roadmap promise is behavioral, so it needs retained evidence with `astro sync`, lint, and build | Plan |

## Scope

**In scope:**
- Add an explicit recovery branch for saved-plan load failure on `/dashboard`
- Prove the real sign-out/sign-in return flow with the same user account
- Verify anonymous guards against `/dashboard` and `/api/plans/generate`
- Document `S-03` as a hardening/proof slice in its own change folder

**Out of scope:**
- Rebuilding the weekly-plan generation flow from `S-02`
- Adding stale-plan timers or forced regeneration
- Introducing plan history or multiple saved plans
- Adding a new E2E test framework

## Architecture / Approach

Keep the existing architecture intact. Server-side dashboard loading remains responsible for fetching the current persisted plan, while the dashboard island owns the visible UI state. `S-03` adds one more state branch: successful saved-plan return, first-run questionnaire, or recovery fallback if the saved plan cannot be presented safely. Verification then proves the same route structure works across sign-out and sign-in, without introducing a new route or data model.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Harden the saved-plan return state | Explicit fallback-to-questionnaire behavior for return-flow load failures | Treating all missing/failed return states as identical and hiding recovery intent |
| 2. Prove the real cross-session return path | Retained manual evidence for generate -> sign out -> sign in -> saved-plan-first return | Declaring roadmap success without real cross-session proof |
| 3. Align artifacts and close the roadmap boundary | Clear `S-03` docs that explain why this is a hardening slice, not a duplicate feature build | Future readers misreading `S-03` as redundant with `S-02` |

**Prerequisites:** `F-01` persistence contract and `S-02` dashboard flow remain intact; usable Supabase auth configuration is available for manual verification  
**Estimated effort:** ~1-2 sessions across 3 phases

## Open Risks & Assumptions

- The plan assumes the current persisted-plan contract from `F-01` is stable enough that `S-03` does not need schema changes.
- Manual verification depends on a working Supabase environment because there is still no committed end-to-end test harness.
- If the app cannot cleanly distinguish "no saved plan yet" from "load failure" with current server seams, the recovery-state contract may need a slightly broader dashboard prop change than expected.

## Success Criteria (Summary)

- A user can return after signing out and signing back in and see the saved plan first on `/dashboard`.
- If the saved plan cannot be loaded safely, the dashboard clearly falls back to regeneration via the questionnaire on the same page.
- The change folder retains cross-session verification evidence, and `npx astro sync`, `npm run lint`, and `npm run build` all pass.
