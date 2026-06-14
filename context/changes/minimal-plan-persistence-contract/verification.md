# Manual Verification Notes

## 2026-06-14 — Authenticated persistence smoke path

- Route: `POST /api/plans/smoke`
- Auth requirement: signed-in user session cookie
- Trigger path: dashboard form on `src/pages/dashboard.astro`

### Request used

Submitted the dashboard smoke-test form while authenticated, which issues:

```http
POST /api/plans/smoke
Cookie: <authenticated session cookie>
```

### Expected success response

```json
{
  "ok": true,
  "userId": "<authenticated-user-id>",
  "questionnaireSaved": {
    "climbingGrade": "6B",
    "injuryLimitations": ["left shoulder"]
  },
  "latestPlan": {
    "questionnaire": {
      "climbingGrade": "6B",
      "injuryLimitations": ["left shoulder"]
    },
    "weeklyPlan": {
      "id": "<uuid>",
      "summary": "Smoke-test weekly plan for authenticated persistence verification.",
      "createdAt": "<timestamp>",
      "days": [
        { "dayNumber": 1, "dayLabel": "Monday", "focusArea": "Technique" }
      ]
    }
  }
}
```

### Unauthorized check

Expected unauthenticated result:

```json
{
  "error": "Unauthorized"
}
```
