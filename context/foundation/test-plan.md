# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-09-06

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "<the
   team is worried about X, and the failure would surface somewhere in
   <area>>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: insufficient git history (0
commits in the scoped `src/` tree in the last 30 days as of 2026-09-06, all
repo activity predates that window) — likelihood ratings below rely on the
roadmap and the Phase 2 interview instead of churn.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | Plan generation from submitted questionnaire answers fails outright (server error), leaving the user with no plan despite completing the flow | High | High | `context/foundation/improvements.md` incident log ("Failed to generate weekly plan occurred (HTTP 500)"); interview Q1, Q2; PRD Success Criteria (<2 min login-to-plan) |
| 2 | The login → questionnaire → plan happy path breaks at the integration seams even when each piece works in isolation | High | High | interview Q2 (confirmed past incident: "the full happy path... didn't work"); roadmap north-star slice S-02 |
| 3 | User cannot log in at all, blocking all access to the product | High | High | interview Q1 ("User cannot log into the application"); PRD Access Control, FR-002 |
| 4 | An authenticated user is denied or misrouted away from the questionnaire despite having valid access | High | Medium | interview Q1 ("Logged user does not see the questionaire"); AGENTS.md constraint that protected routes require manual declaration, not file-system inference |
| 5 | A previously generated weekly plan is missing or forgotten when the user returns and logs back in | High | Medium | interview Q1 ("Users plan is forgoten"); PRD FR-009 / NFR on cross-session persistence; roadmap slice S-03 (most recently landed) |
| 6 | An authenticated user can read or modify another user's questionnaire answers or generated plan (IDOR) | High | Medium | PRD Access Control section (explicit per-user data ownership, flat single-role model with no separation to fall back on); abuse/security lens |
| 7 | An external auth dependency outage (e.g. Supabase down) surfaces as an opaque, unrecoverable error during sign-in/sign-up | Medium | Medium | `context/foundation/improvements.md` incident log ("only `{}` error message during sign in/sign up" when Supabase was down) |

**Impact × Likelihood rubric.** High = user loses access/data/money or
failure is publicly visible; area changes weekly or we've already been
burned. Medium = feature degrades with a workaround, or has been an
occasional bug source. Low = cosmetic, easily reverted, stable code.

**Abuse / security lens.** The product has authentication and per-user
data (questionnaire answers, generated plans) with no role separation, so
Risk #6 (IDOR) is included as the mandatory abuse-scenario row.

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|------------------------------|-----------------|--------------------------------------|-------------------------|--------------------------|
| #1 | Submitting valid questionnaire answers returns a complete weekly plan; malformed/edge-case answers return a handled error, not an unhandled 500 | "It returned 200 in the happy-path demo" does not mean every valid grade/injury combination is handled — the known incident was a real submission, not a fuzzed edge case | Full input domain for grade + injury fields; exercise-mapping error paths; behavior when no rule matches a combination | integration / contract test across the input matrix | Deriving expected plan output by reading the current mapping code (oracle problem) instead of PRD business rules |
| #2 | One full run — sign in, submit questionnaire, see plan — succeeds in an environment close to production | "All three pieces have passing tests in isolation" does not mean the seams (session handoff, data shape from questionnaire to plan generator) are compatible — this already broke once | Data contract from questionnaire submission to plan-generation input; session continuity across the three routes | e2e (the one deliberate promotion — no cheaper layer proves the seams hold) | Treating this e2e test as a substitute for the cheaper per-risk layer tests instead of a complement |
| #3 | A user with valid credentials completes sign-in and lands on a protected page; invalid credentials get a clear rejection, not a silent hang | "The login form rendered" does not mean a session was actually established — assert on post-login protected-page access, not form submission alone | Supabase auth session/cookie handling; middleware protected-route check; confirmation-email redirect target | integration test against the auth route + middleware | Mocking Supabase's auth response so the test never exercises the real session/middleware contract |
| #4 | An authenticated user hitting the questionnaire route is served the questionnaire; an unauthenticated user is redirected to login | "The route exists in the file system" does not mean it's in the protected-routes list — a new/renamed route can silently fall outside the gate either direction | Current protected-routes membership and match rule (exact path vs. prefix); middleware redirect target | unit / integration test on the route-matching logic directly | Asserting only that the middleware returns something truthy instead of the actual allow/deny decision for both identities |
| #5 | A user who generated a plan, logs out, and logs back in (new session) sees the same plan without re-submitting the questionnaire | "The plan renders once" does not mean it persisted — must verify it round-trips through real storage, not component state surviving a soft navigation | Where plan data is persisted and keyed (by user id); whether generation is idempotent or regenerates on login | integration test writing via the real persistence path and reading back in a separate request/session | Testing only within a single session/render cycle, which would pass even if nothing was durably stored |
| #6 | User A's session cannot read or write user B's questionnaire answers or plan by supplying a different id/reference | "The endpoint requires authentication" does not mean it checks ownership — a logged-in check is not an ownership check | Whether plan/questionnaire fetch-by-id endpoints scope by authenticated user id or Supabase RLS policy, or trust a client-supplied id | integration test: user A requests user B's resource id, assert denial/404 | Testing only "endpoint requires a session" and calling it done, without a second identity attempting cross-access |
| #7 | When the auth backend is unreachable or errors, the user sees an actionable message, not a bare `{}` or blank failure | "An error was thrown" does not mean it was translated into something a user can act on — the incident was specifically about a swallowed/opaque error body | How the sign-in/sign-up handler catches and serializes Supabase client errors today | unit test on the error-handling/serialization function with a simulated failure response | Asserting only that a non-200 status is returned, missing the actual point of the incident (the error body content) |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Bootstrap harness + critical failure-path coverage | Stand up a test runner and defend the two confirmed core-flow failures (login, plan generation) at the cheapest layer | #1, #3 | unit + integration | change opened | `context/changes/testing-critical-path-coverage/` |
| 2 | Full-flow proof & persistence round-trip | Prove the login→questionnaire→plan seam holds end-to-end and a generated plan survives a real session boundary | #2, #5 | integration + one e2e | not started | — |
| 3 | Access-control & resilience hardening | Close the cross-user data-ownership gap and make dependency-outage errors actionable | #4, #6, #7 | integration + unit | not started | — |
| 4 | Quality-gates wiring | Lock lint, typecheck, and the new suite into CI as required gates | cross-cutting | gates | not started | — |

**Status vocabulary** (fixed — parser literals): `not started` → `change
opened` → `researched` → `planned` → `implementing` → `complete`.

## 4. Stack

The classic test base for this project. Recommendations below are grounded
in local manifests/configs; no docs/search/runtime/provider MCP was
exposed in the current session, so nothing here is MCP-verified.

| Layer | Tool | Version | Notes |
|---|---|---|---|
| unit + integration | Vitest | none yet — see Phase 1 | health-check.md recommends `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` for this Astro + React stack |
| API mocking | MSW | none yet — see Phase 1 | mock only at the Supabase HTTP boundary; never mock internal modules |
| e2e | Playwright | none yet — see Phase 2 | single smoke test for the login→questionnaire→plan seam; not a per-input-combination tool |

No AI-native row: the current product has no AI-powered logic yet (plan
generation is deterministic rule-based per PRD Business Logic), and the
one visual-review candidate (climbing-themed UI) is explicitly deferred —
see §7. Revisit at `--refresh` if `improvements.md` item 6 (AI-powered
exercise selection) ships.

**Stack grounding tools (current session):**
- Docs: none available in current session — no Context7 or framework-docs MCP exposed; checked: 2026-09-06
- Search: none available in current session — no Exa.ai or web-search MCP exposed; checked: 2026-09-06
- Runtime/browser: none available in current session — no Playwright/browser MCP exposed; checked: 2026-09-06
- Provider/platform: none available in current session — no Cloudflare/Supabase/GitHub MCP exposed; checked: 2026-09-06

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required for §3 Phase <N>" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate | Where | Required? | Catches |
|---|---|---|---|
| lint | local + CI | required (already wired in `.github/workflows/ci.yml`) | style/syntax drift |
| typecheck | local + CI | required after §3 Phase 4 | type drift (not yet a dedicated CI step per health-check.md) |
| unit + integration | local + CI | required after §3 Phase 1 | logic regressions |
| e2e on critical flows | CI on PR | required after §3 Phase 2 | broken login→questionnaire→plan path |
| post-edit hook | local (agent loop) | recommended local — out of this rollout's scope (Lesson 3) | regressions at edit time |
| visual diff (deterministic) | CI on PR | optional — not scheduled, see §7 | rendering regressions |
| multimodal visual review | CI on PR | optional — not scheduled, see §7 | visual issues classic diff misses |
| pre-prod smoke | between merge + prod | optional | environment-specific failures |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase <N>."

### 6.1 Adding a unit test

- TBD — see §3 Phase 1 (error-handling/serialization pattern for Risk #7).

### 6.2 Adding an integration test

- TBD — see §3 Phase 1 (auth-route + middleware pattern for Risks #1, #3).

### 6.3 Adding an e2e test

- TBD — see §3 Phase 2 (login→questionnaire→plan seam smoke, Risk #2).

### 6.4 Adding a test for a new API endpoint

- TBD — see §3 Phase 1.

### 6.5 Adding a test for data-ownership / access control

- TBD — see §3 Phase 3 (IDOR pattern for Risk #6).

### 6.6 Per-rollout-phase notes

(Filled in by `/10x-implement`'s final sub-phase as each rollout phase
lands.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption
changes.

- **Visual/snapshot regression tests** — not introduced yet; user
  explicitly deferred them. Re-evaluate once the climbing-themed UI
  stabilizes and visual regressions become a repeat problem, or if
  `improvements.md` item 5 (theme/colour overhaul) ships and needs a
  regression net. (Source: Phase 2 interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-09-06
- Stack versions last verified: 2026-09-06
- AI-native tool references last verified: n/a — no AI-native tooling in this rollout

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
