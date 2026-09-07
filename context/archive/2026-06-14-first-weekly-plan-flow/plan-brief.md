# First Weekly Plan Flow — Plan Brief

> Full plan: `context/changes/first-weekly-plan-flow/plan.md`

## What & Why

This change delivers the first real protected product flow for PrepToClimb. An authenticated user will answer a short questionnaire, get an immediately visible weekly climbing plan, and return later to see that saved plan first instead of a placeholder or smoke-test page.

## Starting Point

The repo already has the prerequisites in place: auth lands users on `/dashboard`, middleware protects the dashboard and `/api/plans`, and the persistence layer can already save and load one active seven-day plan per user. What does not exist yet is the actual `S-02` experience: the dashboard still shows placeholder copy, and the only plan API writes a hard-coded smoke payload.

## Desired End State

When this plan is complete, `/dashboard` is the real MVP planning surface. First-time users fill in climbing grade and injury limitations, stay on the same page while the plan is generated and saved, then see the full seven-day result. Returning users see the saved plan first and can regenerate it deliberately from the same page.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Protected entry route | Keep the flow on `/dashboard` | It matches the existing auth redirect target and avoids unnecessary route churn in the first real slice | Plan |
| Questionnaire scope | Climbing grade + injury limitations only | This matches the current PRD narrowing and the persistence contract already in code | Research |
| Generation strategy | Deterministic code-based templates | It is the smallest reliable way to deliver a real seven-day plan without adding content-management scope | Plan |
| Returning-user behavior | Show the saved plan first | This makes persistence visible in the product instead of forcing users back through a blank form | Plan |
| Safety handling | Block or substitute exercises per limitation | It satisfies the PRD safety guardrail without collapsing every injured user into a generic recovery week | Plan |
| Submission UX | Inline loading and inline retry on `/dashboard` | It preserves the MVP’s fast single-flow experience and avoids navigation churn | Plan |
| Result fidelity | Render the full seven-day saved plan | This proves the actual product promise rather than a summary-only placeholder | Plan |

## Scope

**In scope:**
- Replace the dashboard placeholder with the real protected questionnaire/result flow
- Add a real authenticated plan-generation route under `/api/plans`
- Generate deterministic seven-day plans from climbing grade and injury limitations
- Persist and display the saved weekly plan on the same protected page
- Support saved-plan-first returning visits plus explicit regeneration

**Out of scope:**
- Route renaming away from `/dashboard`
- Expanded profile or training-history inputs
- AI generation or a generalized rules engine
- Plan history, analytics, multi-week cycles, or admin editing tools

## Architecture / Approach

The dashboard stays the single protected container. Server-side loading checks for an existing saved plan using the current persistence module. Client-side state inside the dashboard shell handles questionnaire entry, inline loading, retryable errors, and saved-plan rendering. A new authenticated route generates a deterministic weekly plan from code-owned templates, applies injury-safe substitutions, persists the result through `saveCurrentPlan(...)`, and returns the saved plan back to the dashboard.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Branch the protected dashboard by saved-plan state | Real first-run vs returning-user dashboard shell | Mixing page composition and interactive state too tightly |
| 2. Add the minimal questionnaire and inline page-state behavior | Real input UX with retryable inline errors | Losing entered answers on failure |
| 3. Replace the smoke route with a real authenticated plan-generation endpoint | First real server seam for `S-02` | Leaving the hard-coded smoke route as the accidental public contract |
| 4. Implement deterministic weekly-plan generation with injury-safe substitutions | Real seven-day plan payloads that satisfy persistence rules | Safety rules becoming vague or incomplete |
| 5. Render the full saved weekly plan and regenerate path on the dashboard | Actual user-visible weekly plan experience | Under-rendering the saved plan and weakening the value proposition |
| 6. Verify the end-to-end protected flow and repo gates | Concrete completion boundary for the slice | Declaring done without proving first-run and return paths both work |

**Prerequisites:** `F-01` persistence contract and `S-01` account-access flow remain intact; valid Supabase configuration is available for manual verification  
**Estimated effort:** ~2-3 sessions across 6 small phases

## Open Risks & Assumptions

- The injury-limitation vocabulary has to stay small and explicit or the substitution rules will become ambiguous quickly.
- Reusing `/dashboard` is the right MVP choice now, but the route may still need renaming in a later product-polish slice.
- The generator must keep producing payloads that satisfy the current seven-day persistence validator, or the route will fail after apparently valid submissions.

## Success Criteria (Summary)

- A signed-in user can answer the minimal questionnaire and immediately see a full saved seven-day plan on `/dashboard`.
- Returning signed-in users see their saved plan first and can intentionally regenerate it from the same protected page.
- The protected plan-generation route, dashboard flow, lint, and build all pass the agreed verification boundary.
