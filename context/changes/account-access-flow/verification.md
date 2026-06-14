# Account Access Flow Verification

Date: 2026-06-14
Change: `account-access-flow`

## Automated Verification

- `npx astro sync`
- `npm run lint`
- `npm run build`

## Anonymous API Guard Expectation

Verified contract in code:

- Protected routes include `/dashboard` and `/api/plans` in `src/middleware.ts`
- Anonymous requests to protected API routes return `401`
- Current unauthorized JSON shape is:

```json
{
  "error": "Unauthorized"
}
```

## Manual Verification Log

- Pending: new-user sign-up reaches the confirm-email screen with product-oriented next-step messaging
- Pending: anonymous access to `/dashboard` redirects to `/auth/signin`
- Pending: anonymous `POST /api/plans/smoke` returns `401` with the unauthorized JSON shape above
- Pending: signed-in access reaches `/dashboard` after login and remains usable until sign-out
- Pending: sign-out removes access to the protected dashboard until the user signs in again

## Anonymous `POST /api/plans/smoke` Capture

Request:

```http
POST /api/plans/smoke
```

Expected response:

```http
HTTP/1.1 401 Unauthorized
content-type: application/json
```

Expected body:

```json
{
  "error": "Unauthorized"
}
```
