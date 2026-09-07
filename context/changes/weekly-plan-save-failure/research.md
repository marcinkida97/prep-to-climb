---
date: 2026-09-07T00:00:00Z
researcher: Marcin Kida
git_commit: 710d7e43c8bcf3864f2e597ae21f2d33f860cd66
branch: main
repository: prep-to-climb
topic: "Weekly plan generation fails with \"Failed to save the current plan.\""
tags: [research, codebase, plans, supabase, rpc, migrations]
status: complete
last_updated: 2026-09-07
last_updated_by: Marcin Kida
last_updated_note: "Confirmed root cause: linked remote Supabase project has neither migration applied"
---

## Research Question

User logged in successfully, selected grade and injuries, clicked "Generate weekly plan", and got
the error "Failed to save the current plan." What happened, and where does the failure originate?

## Summary

The error string is hard-coded at one call site: [`saveCurrentPlan`](https://github.com/marcinkida97/prep-to-climb/blob/710d7e43c8bcf3864f2e597ae21f2d33f860cd66/src/lib/plan-persistence.ts#L122-L124)
throws it whenever the Supabase RPC call `replace_current_plan` returns a Postgres/PostgREST
error — **any** error, regardless of cause. The route handler then relays that exact message to
the browser with a 500 (`src/pages/api/plans/generate.ts:71-84`), so the UI is showing the
generic wrapper text, not the underlying database error.

The application code path itself (validation → `generateWeeklyPlan` → `saveCurrentPlan` → the
`replace_current_plan` SQL function → RLS policies) is internally consistent for a first-time
plan: insert order respects every foreign key, and every INSERT/UPDATE inside the function is
covered by a matching RLS policy for the `authenticated` role. Static review did not find a logic
bug in the current schema/RPC pair that would deterministically break a normal happy path.

That points at an **environment/state cause** rather than an application-logic bug. The two most
likely candidates, in order of likelihood given the evidence:

1. **The `replace_current_plan` RPC is missing from the database the app is talking to.** It was
   added in a *second*, later migration on the same day as the base schema
   (`supabase/migrations/20260614153000_replace_current_plan_rpc.sql`, applied ~2.5 hours after
   `20260614090000_minimal_plan_persistence.sql`). Any local Supabase container started/reset
   before that second migration was written — or a hosted/remote project that only ever had the
   first migration pushed — would raise a "function not found" (PostgREST `PGRST202`) error the
   very first time a plan is generated. This is wrapped into the same generic
   `"Failed to save the current plan"` message, so it is visually indistinguishable from a real
   constraint violation.
2. A genuine constraint/RLS violation on the actual row data (less likely — schema and policies
   line up cleanly with what `plan-persistence.ts` sends, see Detailed Findings).

Root-causing further requires either the real Postgres/PostgREST error object (currently
captured but discarded — see below) or reproducing against the environment the user actually ran
the app against.

## Detailed Findings

### Where the message comes from

- [`plan-persistence.ts:97-124`](https://github.com/marcinkida97/prep-to-climb/blob/710d7e43c8bcf3864f2e597ae21f2d33f860cd66/src/lib/plan-persistence.ts#L97-L124) —
  `saveCurrentPlan` validates the input, then calls
  `supabase.rpc("replace_current_plan", { ... })`. On any `error` from that RPC call it throws
  `new PlanPersistenceError("Failed to save the current plan", error)` — the literal string the
  user saw.
- [`generate.ts:57-84`](https://github.com/marcinkida97/prep-to-climb/blob/710d7e43c8bcf3864f2e597ae21f2d33f860cd66/src/pages/api/plans/generate.ts#L57-L84) —
  the `POST` handler catches any thrown error and returns
  `{ ok: false, error: error.message }` with HTTP 500, i.e. it passes the wrapper message straight
  through to the client. `QuestionnaireForm`/`DashboardPlanShell` render that string verbatim.

### The diagnostic gap

- `PlanPersistenceError` captures the real Postgres error as `causeDetail` (`JSON.stringify(cause)`,
  [`plan-persistence.ts:36-44`](https://github.com/marcinkida97/prep-to-climb/blob/710d7e43c8bcf3864f2e597ae21f2d33f860cd66/src/lib/plan-persistence.ts#L36-L44)),
  but nothing in the codebase reads `causeDetail` — no `console.error`, no logging, no inclusion
  in the API response. A grep for `causeDetail` across `src/` turns up only its two definitions.
  **The real database error is silently discarded**, which is why the user only sees the generic
  message instead of something actionable like "relation does not exist" or a constraint name.

### The RPC and schema (structural check — no bug found)

- [`supabase/migrations/20260614153000_replace_current_plan_rpc.sql`](https://github.com/marcinkida97/prep-to-climb/blob/710d7e43c8bcf3864f2e597ae21f2d33f860cd66/supabase/migrations/20260614153000_replace_current_plan_rpc.sql) —
  `replace_current_plan(p_climbing_grade text, p_injury_limitations text[], p_summary text, p_days jsonb)`,
  `security invoker`, requires `auth.uid()` to be non-null (raises otherwise), then:
  1. Upserts `questionnaire_responses` by `user_id` (PK).
  2. Deactivates any existing active `weekly_plans` row for the user.
  3. Inserts the new `weekly_plans` row (`is_active = true`).
  4. Inserts `plan_days` rows, then `recommended_exercises` rows per day.
- [`supabase/migrations/20260614090000_minimal_plan_persistence.sql`](https://github.com/marcinkida97/prep-to-climb/blob/710d7e43c8bcf3864f2e597ae21f2d33f860cd66/supabase/migrations/20260614090000_minimal_plan_persistence.sql) —
  defines the four tables, the partial unique index
  `weekly_plans_one_active_per_user_idx on weekly_plans(user_id) where is_active`, and one RLS
  policy pair (`select`/`insert`/`update`/`delete`, all scoped to `auth.uid() = user_id` or the
  equivalent join) per table, granted to the `authenticated` role.
- Cross-checked against the insert order in the RPC: `questionnaire_responses` is always written
  before the `weekly_plans` row that FK-references it; the existing active plan is deactivated
  before the new one is inserted, so the partial unique index never sees two active rows for the
  same user in the same statement. Every INSERT/UPDATE inside the function has a matching RLS
  policy for the `authenticated` role with a satisfiable `USING`/`WITH CHECK` clause given
  `v_user_id := auth.uid()`.
- Field-by-field, the JSON payload built in
  [`plan-persistence.ts:103-120`](https://github.com/marcinkida97/prep-to-climb/blob/710d7e43c8bcf3864f2e597ae21f2d33f860cd66/src/lib/plan-persistence.ts#L103-L120)
  (camelCase keys: `dayNumber`, `dayLabel`, `focusArea`, `recommendedExercises`, `exerciseOrder`,
  `exerciseName`, ...) matches the `->>`/`->` accessors used inside the PL/pgSQL loop
  (`v_day ->> 'dayNumber'`, etc.) — no key-name mismatch.
- Input validation in
  [`plan-persistence.ts:148-183`](https://github.com/marcinkida97/prep-to-climb/blob/710d7e43c8bcf3864f2e597ae21f2d33f860cd66/src/lib/plan-persistence.ts#L148-L183)
  (exactly 7 days, unique day numbers 1-7, non-blank labels/focus areas/exercise names) mirrors
  the DB-level `check` constraints, so a validation error would normally surface as a *different*,
  more specific `PlanPersistenceError` message before the RPC is ever called — not this one.

### Auth/session wiring (structural check — no bug found)

- [`src/middleware.ts`](https://github.com/marcinkida97/prep-to-climb/blob/710d7e43c8bcf3864f2e597ae21f2d33f860cd66/src/middleware.ts) and
  [`src/pages/api/plans/generate.ts:49`](https://github.com/marcinkida97/prep-to-climb/blob/710d7e43c8bcf3864f2e597ae21f2d33f860cd66/src/pages/api/plans/generate.ts#L49)
  both build the Supabase client the same way, via
  [`createClient` in `src/lib/supabase.ts`](https://github.com/marcinkida97/prep-to-climb/blob/710d7e43c8bcf3864f2e597ae21f2d33f860cd66/src/lib/supabase.ts)
  (`@supabase/ssr`'s `createServerClient`, reading the session from the request's cookies). Since
  the user already got past the middleware's auth gate to reach the form, `context.locals.user`
  and the RPC call use the same authenticated session — an `auth.uid()` mismatch is unlikely to be
  the cause here.

### Environment note

- This checkout has no `.env`/`.dev.vars` and no local Supabase containers running
  (`npx supabase status` → "No such container: supabase_db_10x-astro-starter"), so the failure
  could not be reproduced directly in this session — the analysis above is static/structural.
  `README.md:79-99` documents the expected setup: `supabase start` then `supabase db reset` to
  apply **all** committed migrations. If the user's local stack was started before
  `20260614153000_replace_current_plan_rpc.sql` existed and was never reset since, that would
  reproduce exactly the reported symptom on the very first "Generate weekly plan" click.
- [`src/pages/api/plans/smoke.ts`](https://github.com/marcinkida97/prep-to-climb/blob/710d7e43c8bcf3864f2e597ae21f2d33f860cd66/src/pages/api/plans/smoke.ts)
  is a retired diagnostic route (returns 410) that predates the RPC — not part of the current
  flow, confirming `/api/plans/generate` is the only live path.

## Code References

- `src/lib/plan-persistence.ts:97-124` - `saveCurrentPlan`; RPC call and the exact throw site for the reported message
- `src/lib/plan-persistence.ts:36-44` - `PlanPersistenceError`; captures `causeDetail` but nothing reads it
- `src/pages/api/plans/generate.ts:57-84` - route handler; relays the thrown message verbatim as the HTTP 500 body
- `supabase/migrations/20260614153000_replace_current_plan_rpc.sql` - `replace_current_plan` RPC definition
- `supabase/migrations/20260614090000_minimal_plan_persistence.sql` - table schema, partial unique index, RLS policies
- `src/lib/supabase.ts` - shared SSR Supabase client factory used by both middleware and the route
- `src/middleware.ts:6-16` - sets `context.locals.user` from the same session cookie
- `src/pages/api/plans/generate.test.ts:213-232` - existing test only asserts the wrapping behavior with a mocked RPC error; does not exercise a real Postgres/RLS failure
- `README.md:79-99` - documented local setup sequence (`supabase start` → `supabase db reset`)

## Architecture Insights

- Error handling is intentionally opaque to the client (one fixed string per failure mode in
  `plan-persistence.ts`), which is fine for UX copy but currently has no matching server-side log
  of the real cause — `causeDetail` is dead code today.
- The RPC is the single source of truth for the write path (upsert questionnaire → deactivate old
  plan → insert new plan/day/exercise rows) in one transaction, which is a sound pattern for
  keeping "one active plan per user" consistent — the design isn't the problem; visibility into
  its failures is.

## Historical Context (from prior changes)

- `context/archive/2026-06-14-minimal-plan-persistence-contract/` - introduced the base schema/RLS
  policies (`20260614090000` migration) and a smoke-test route later retired.
- `context/archive/2026-06-14-persisted-plan-return-flow/` - introduced the read-back
  (`getCurrentPlan`) half of persistence.
- `context/archive/2026-06-14-first-weekly-plan-flow/` - introduced the questionnaire → generate →
  save flow this bug report is about.
- No archived change or follow-up doc mentions this specific RPC-not-found risk or proposes
  logging `causeDetail`; this looks like a newly-surfaced gap rather than a known, accepted one.

## Related Research

- None yet under `context/changes/**/research.md` or `context/archive/**/research.md` covering this
  specific failure.

## Follow-up Research 2026-09-07

User clarified: the failure happened against the **hosted/remote** Supabase project (linked ref
`lejuwzhjexpmhjbrbzbx` per `supabase/config.toml`'s `project_id = "10x-astro-starter"`), not a
local `supabase start` stack. This confirms candidate #1 from the Summary and rules out the
local-Docker-reset framing.

### Confirmed: neither migration is applied to the linked remote project

Running `npx supabase migration list` against the linked project returns:

```
   Local          | Remote | Time (UTC)
  ----------------|--------|---------------------
   20260614090000 |        | 2026-06-14 09:00:00
   20260614153000 |        | 2026-06-14 15:30:00
```

Both `Remote` columns are **empty** — the hosted database has never received either migration.
That means, on the remote project, `public.questionnaire_responses`, `public.weekly_plans`,
`public.plan_days`, `public.recommended_exercises`, and `public.replace_current_plan(...)` do not
exist at all.

This exactly matches the reported symptom shape:

- **Login succeeds** — Supabase Auth's `auth.users`/session machinery is a platform-managed
  schema, independent of this repo's migrations, so `context.locals.user` resolves fine.
- **Grade/injury selection succeeds** — that's local React form state in
  `QuestionnaireForm.tsx`; no database round-trip happens until submit.
- **"Generate weekly plan" fails** — this is the first request that touches
  `questionnaire_responses` / `weekly_plans` / `replace_current_plan`, none of which exist on the
  remote database. PostgREST would return a "relation does not exist" or "function not found"
  (`PGRST202`) error, wrapped into the generic `"Failed to save the current plan"` message per the
  throw site at `plan-persistence.ts:122-124`.

### Root cause (confirmed)

The application's database contract (`supabase/migrations/*.sql`) was written and committed but
never deployed to the Supabase project the running app points at. This is a **deployment gap**,
not an application-logic bug — the fix is operational (apply the migrations to the remote
project), not a code change.

### Corroborating evidence: remote server logs

The user found this in the remote project's server logs:

```
42P01
relation "supabase_migrations.schema_migrations" does not exist
```

`supabase_migrations.schema_migrations` is the CLI/platform's own migration-tracking table, not
part of this repo's `supabase/migrations/*.sql`. Its absence means the remote Postgres instance
has never had any migration history recorded — the database has effectively never been
provisioned by the Supabase migration tooling, matching the blank `Remote` column from
`supabase migration list` above. This rules out a partial/half-applied migration state; the
remote database is starting from a clean slate with none of this project's schema.

### Resolution path

Applying the committed migrations to the linked remote project (`npx supabase db push`, or
equivalent via the Supabase dashboard's SQL editor / CI migration step) would create the missing
tables, RLS policies, and RPC function, which should resolve the reported failure. This was not
run in this research session — pushing schema to a live remote project is an infra action outside
`/10x-research`'s scope and needs explicit confirmation before executing.

## Open Questions

- Was this the user's **first ever** "Generate weekly plan" click since setting up (or last
  resetting) their local Supabase stack? If so, migration drift (candidate #1 above) is the
  leading suspect — confirm by checking `npx supabase migration list` / re-running
  `npx supabase db reset` against the environment where the bug occurred.
- What is the actual `error` object from the failed `supabase.rpc(...)` call? It is currently
  discarded (`causeDetail` is written but never logged) — capturing and reading it once (e.g. a
  temporary `console.error(error)` at `plan-persistence.ts:122`) would confirm or rule out
  candidate #1 immediately versus a data/constraint issue.
- Is the target Supabase project local (per `README.md`) or a hosted project? If hosted, has this
  same RPC migration actually been pushed there (`supabase db push` / migration history), or only
  applied locally?
