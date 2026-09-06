# Playwright E2E Foundation — Plan Brief

> Full plan: `context/changes/playwright-e2e-foundation/plan.md`

## What & Why

Stand up a Playwright e2e test harness and author one reference/seed test
that proves the harness works and sets the pattern future e2e tests copy.
This is infrastructure-only — it does not attempt the risk-mapped
login→questionnaire→plan flow (`test-plan.md` Risk #2), which needs its
own test-user/Supabase strategy decision, deliberately deferred.

## Starting Point

No e2e tooling exists today: no Playwright dependency, config, or `e2e/`
directory. Vitest was set up separately (in `auth-outage-error-handling`)
for unit-level, `src/`-colocated tests — a different, independent runner.
`test-plan.md` §6.3 has literally been a `TBD` placeholder waiting for
this pattern.

## Desired End State

`npm run test:e2e` runs one passing spec locally (auto-starting the dev
server), the same suite runs as its own CI job on every push/PR, and
`test-plan.md` §6.3 documents the real pattern instead of a placeholder.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Seed test scope | Unauthenticated redirect-guard smoke (`/dashboard` → `/auth/signin`, form renders) | Exercises real middleware + a real page fully deterministically, with zero Supabase/test-user setup needed |
| Target server | Playwright `webServer` auto-starts `npm run dev` | Zero manual steps for a human or an agent running tests, matches existing local dev workflow |
| CI wiring | Wired now, as a separate `e2e` job | User wants it enforced immediately rather than left to a later phase |
| Directory/naming | `e2e/` at repo root, `*.spec.ts` | Matches Playwright's own default scaffolding — instantly recognizable, no bespoke config |
| Browser scope | Chromium only | Cheapest test that proves the harness; no cross-browser risk identified yet |
| Cookbook update | Yes — update `test-plan.md` §6.3 now | This change is exactly what §6.3 was waiting for |

## Scope

**In scope:**
- Playwright install, config, npm script, `.gitignore` entries
- One reference spec file (2 test cases) covering the logged-out redirect-guard path
- A dedicated `e2e` CI job, no Supabase secrets required
- `test-plan.md` §6.3 cookbook update

**Out of scope:**
- The login→questionnaire→plan flow (Risk #2) and its test-user/Supabase strategy
- Multi-browser projects, visual/report caching optimizations
- Flipping `test-plan.md` §3 Phase 2 status or §5's e2e gate `Required?` column

## Architecture / Approach

Playwright's `webServer` config starts `npm run dev` (Astro's dev server)
before tests and reuses it locally; in CI, the same command runs fresh.
Because `src/lib/supabase.ts` returns a `null` client when Supabase env
vars are absent, and `middleware.ts` treats that as always-logged-out,
the seed test's redirect-guard assertions hold with **zero Supabase
configuration** — so CI needs no new secrets for this phase.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Install & configure Playwright | Harness runs, zero tests found, exits 0 | Playwright/Vite version compatibility with existing `vite: ^7.3.2` override |
| 2. Author the reference seed test | One passing spec, 2 test cases | Locator choice must survive future markup tweaks (mitigated via label/role locators) |
| 3. Wire CI | New parallel `e2e` job, report artifact on failure | CI runner flakiness starting/stopping a dev server |
| 4. Update test-plan.md cookbook | §6.3 documents the real pattern | None significant |

**Prerequisites:** None — this only needs `npm install` and Playwright's browser binaries (`npx playwright install --with-deps chromium`).
**Estimated effort:** ~1 session across 4 phases.

## Open Risks & Assumptions

- Assumes `npm run dev` starts reliably headless in CI (Ubuntu runner) within the 120s `webServer` timeout — untested until Phase 3.
- Assumes no future markup change removes the `Email`/`Password` labels or the `Sign in` button's accessible name without updating this test.

## Success Criteria (Summary)

- `npm run test:e2e` passes locally and in CI with zero Supabase configuration
- A future contributor can read `test-plan.md` §6.3 alone and know where/how to add the next e2e test
