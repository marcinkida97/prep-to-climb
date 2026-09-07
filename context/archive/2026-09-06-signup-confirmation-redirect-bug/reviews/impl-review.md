<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Sign-up Confirmation Redirect Fix

- **Plan**: context/changes/signup-confirmation-redirect-bug/plan.md
- **Scope**: Full plan (Phase 1 of 2, Phase 2 of 2)
- **Date**: 2026-09-07
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — 3 Phase 2 manual checks unaddressed (Docker environment blocker)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/signup-confirmation-redirect-bug/plan.md:239-241 (Progress 2.4-2.6)
- **Detail**: The real local PKCE round-trip (sign up → real Inbucket email → click link → confirm landing signed-in on `/dashboard`, plus the already-used-link check) was never performed. `npx supabase start` failed twice with `no space left on device` — Docker Desktop's VM disk is allocated only 9.7GB, insufficient for the full local Supabase stack even after `docker image prune -a` reclaimed 1.26GB. This was a deliberate, user-confirmed decision to proceed without it (2026-09-07), not an oversight — fully documented in `context/changes/signup-confirmation-redirect-bug/verification.md` including exactly what remains unverified. What *was* verified: the PKCE exchange mechanics by reading the installed `@supabase/ssr`/`@supabase/auth-js` source directly (cookie flushing, `flowType: "pkce"`, `exchangeCodeForSession` signature — see plan.md's Key Discoveries), plus the route's full request/response contract via `confirm.test.ts`'s mocked matrix (12/12 tests passing).
- **Fix A ⭐ Recommended**: Accept as a documented, known gap; re-run the deferred manual pass later if Docker Desktop's disk is resized.
  - Strength: The mechanics most likely to hide a real bug (cookie read-back, PKCE code-verifier flow) were independently verified against actual SDK source, not just assumed — this isn't a blind acceptance of untested code.
  - Tradeoff: The literal browser round-trip — the one thing most likely to catch an integration-level surprise no amount of source-reading would reveal — stays unproven until someone runs it.
  - Confidence: MED — high confidence in the individual mechanics verified, lower confidence in "nothing else surprises us" without an end-to-end pass.
  - Blind spot: Any Cloudflare-Workers-specific cookie/redirect quirk that only manifests under `wrangler dev`/production, not covered by either the unit tests or the source reading.
- **Fix B**: Block merge until Docker Desktop is resized and the real pass is run.
  - Strength: Closes the blind spot completely before this ships.
  - Tradeoff: Requires GUI interaction on the user's machine outside this session; blocks a change that is otherwise fully code-reviewed and automated-test-covered.
  - Confidence: HIGH — straightforward, just needs the disk resize.
  - Blind spot: None — this is the strictly safer option, just deferred on user availability.
- **Decision**: ACCEPTED (Fix A) — accepted as a documented known gap; re-verify later if Docker Desktop's disk is resized.

### F2 — Plan's Contract text describes signUp's second argument imprecisely

- **Severity**: 👁️ OBSERVATION
- **Dimension**: Plan Adherence
- **Location**: src/pages/api/auth/signup.ts:14-19; plan.md:91
- **Detail**: Plan said `signUp` would receive `{ email, password }` plus "a second argument" for `emailRedirectTo`. The real Supabase JS API is single-argument with a nested `options` key: `signUp({ email, password, options: { emailRedirectTo } })`. Implementation and its test (`signup.test.ts:64-68`) correctly use the real single-object signature — the plan's own Contract text anticipated this ambiguity ("adjust... to whichever of the two-argument forms the implementation uses"). No functional issue; implementation is correct.
- **Fix**: None needed — code and tests match the real SDK. Optionally tidy the plan's wording for future readers.
- **Decision**: FIXED — plan.md:91 updated to describe the real single-object `signUp({ email, password, options: { emailRedirectTo } })` call shape.

### F3 — `additional_redirect_urls` uses exact callback path, not plan's bare-origin text

- **Severity**: 👁️ OBSERVATION
- **Dimension**: Plan Adherence
- **Location**: supabase/config.toml:156; plan.md:107
- **Detail**: Plan's Contract literally specified `additional_redirect_urls = ["http://localhost:4321"]` (bare origin). Implementation used `["http://localhost:4321/api/auth/confirm"]` (exact path) instead, discovered via Supabase's own documentation during implementation: Supabase requires an **exact** string match for allow-listed redirect URLs, so a bare-origin entry would not have matched the actual `emailRedirectTo` value and local testing would have silently fallen back to `site_url`. This was a deliberate, documented correction (see the Phase 1 manual-verification-gate message in this session), not an oversight.
- **Fix**: None needed — implementation is more correct than the plan's literal text.
- **Decision**: FIXED — plan.md:107 updated to specify the exact callback path with the exact-match rationale.

### F4 — Production Supabase Redirect URLs allow-list is a residual, out-of-repo dependency

- **Severity**: 👁️ OBSERVATION
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/signup.ts:14; context/changes/signup-confirmation-redirect-bug/verification.md
- **Detail**: `origin` is derived from `context.request.url`, which is safe in this deployment model (Cloudflare only routes matching-zone traffic to this Worker, so the value isn't attacker-controllable via a spoofed header). The real backstop against an arbitrary `emailRedirectTo` is Supabase's own exact-match `additional_redirect_urls` allow-list, which lives in the hosted Supabase project's dashboard — outside this repo/diff. If that allow-list is ever set to a wildcard or left stale, the safety net weakens. This is already called out as the required production prerequisite in `verification.md`.
- **Fix**: None needed in this diff — confirm during the production dashboard step (already documented) that the Redirect URLs allow-list contains only the exact production origin(s) plus `/api/auth/confirm`, no wildcards.
- **Decision**: FIXED — verification.md's production prerequisite now explicitly warns against a wildcard Redirect URLs entry and explains why.

### F5 — `code` query param passed to `exchangeCodeForSession` with only a presence check

- **Severity**: 👁️ OBSERVATION
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/confirm.ts:10-18
- **Detail**: No length/format validation on `code` beyond `!code`. Not exploitable in practice — the call is wrapped in try/catch, Supabase's API validates the code server-side, and URL length is bounded by platform limits — but noted for completeness.
- **Fix**: None needed.
- **Decision**: SKIPPED — not exploitable, no action needed.
