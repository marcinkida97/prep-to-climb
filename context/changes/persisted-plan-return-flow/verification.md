# Persisted Plan Return Flow Verification

Date: 2026-06-14
Change: `persisted-plan-return-flow`
Roadmap slice: `S-03`

## Verified product path

- Successful sign-in still redirects authenticated users to `/dashboard`.
- The protected return flow still treats `/dashboard` as the saved-plan entry route for authenticated users.
- Anonymous protection still covers both `/dashboard` and `/api/plans/*` through the existing middleware guard.
- The current anonymous API contract for the real plan-generation endpoint is `POST /api/plans/generate` -> `401` with JSON body `{"error":"Unauthorized"}`.

## Automated Verification

Completed on 2026-06-14.

Commands run:

- [x] `npx astro sync`
- [x] `npm run lint`
- [x] `npm run build`

## Manual Verification

Pending human confirmation for the real cross-session return flow.

Scenarios to verify:

- [ ] Generate a valid weekly plan while authenticated and confirm it renders on `/dashboard`.
- [ ] Sign out, sign back in as the same user, and confirm `/dashboard` opens on the saved-plan-first state.
- [ ] Use the regenerate action after returning and confirm the saved plan can still be replaced from the same page.
- [ ] Trigger or simulate the saved-plan recovery path and confirm the questionnaire opens with explicit guidance while staying on `/dashboard`.
- [ ] Visit `/dashboard` while signed out and confirm redirection to `/auth/signin`.
- [ ] Replay an anonymous `POST /api/plans/generate` request and confirm it returns `401` with JSON body `{"error":"Unauthorized"}`.

## Request/response capture

Use this section to retain the actual manual evidence once the scenarios above are run.

### Anonymous API check

Request example:

```http
POST /api/plans/generate
content-type: application/json

{"questionnaire":{"climbingGrade":"6A","injuryLimitations":[]}}
```

Expected response:

```http
HTTP/1.1 401 Unauthorized
content-type: application/json

{"error":"Unauthorized"}
```

### Cross-session return notes

- Account used:
- Saved plan generated at:
- Sign-out/sign-in result:
- Regenerate result:
- Recovery fallback result:

## Notes

- This artifact closes the cross-session proof gap that remained open in `context/changes/first-weekly-plan-flow/verification.md`.
- No route-target change was required for this slice because `src/pages/api/auth/signin.ts` already redirects to `/dashboard`.
- No middleware change was required for this slice because `src/middleware.ts` already protects `/dashboard` and `/api/plans`, including the real `POST /api/plans/generate` verification target.
