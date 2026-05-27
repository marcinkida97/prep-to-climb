---
project: 10x-astro-starter
checked_at: 2026-05-27T06:59:30Z
health_status: critical-issues
context_type: brownfield
language_family: js
stack_assessment_available: false
checks_run:
  - lockfile
  - dependency_audit
  - outdated_deps
  - test_runner
  - ci_cd
  - configuration
audit_findings:
  critical: 0
  high: 1
  moderate: 9
  low: 0
test_runner_detected: false
ci_provider: GitHub Actions
recommended_fixes: 5
---

## Dependency Health

### Lockfile

Status: present (`package-lock.json`)
Package manager: npm

### Security Audit

Tool: `npm audit --json`
Summary: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW
Direct vs transitive: 2 direct MODERATE (`@astrojs/check`, `wrangler`), 1 transitive HIGH (`devalue`), 7 transitive MODERATE

#### HIGH findings

- **devalue** `5.6.3 - 5.8.0` — `GHSA-77vg-94rm-hx3p`: DoS via sparse array deserialization. Fix: update the dependency chain with `npm audit fix`, then rerun `npm audit`; if it remains, update the parents that pull it in, starting with `wrangler` and Astro-related packages.

Moderate findings:

- **@astrojs/check** pulls a vulnerable `@astrojs/language-server`. Fix path: refresh Astro tooling with `npm install @astrojs/check@latest`.
- **wrangler** pulls a vulnerable `miniflare` / `ws` chain. Fix path: `npm install -D wrangler@latest`.
- Remaining moderate issues are transitive in `@astrojs/language-server`, `@cloudflare/vite-plugin`, `miniflare`, `volar-service-yaml`, `ws`, `yaml`, and `yaml-language-server`.

### Outdated Dependencies

Packages with major version gaps: 0

No direct dependencies are more than 2 major versions behind. Minor and single-major updates are available for several packages, including:

- **astro**: `6.3.1` -> `6.3.8`
- **wrangler**: `4.90.0` -> `4.95.0`
- **@supabase/supabase-js**: `2.105.3` -> `2.106.2`
- **typescript**: `5.9.3` -> `6.0.3` (1 major behind)
- **eslint**: `9.39.4` -> `10.4.0` (1 major behind)

## Test Suite

Test runner: not detected
Tests found: not applicable
Test execution: not attempted

⚠ No test runner detected. The agent cannot verify its own changes.
Recommended: install Vitest for this Astro + React stack with `npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @vitest/coverage-v8`, then add a `"test": "vitest run"` script and at least one smoke test for the core auth flow.

## CI/CD

Provider: GitHub Actions
Configuration: `.github/workflows/ci.yml`

| Stage      | Status | Notes |
|------------|--------|-------|
| Lint       | ✓ | `npm run lint` |
| Test       | ✗ | no test command or runner detected |
| Build      | ✓ | `npm run build` |
| Type check | ✗ | no dedicated `astro check` or `tsc --noEmit` step |
| Security   | ✗ | no `npm audit`, Dependabot, or CodeQL step configured |

## Configuration

### High severity

No gaps detected.

### Medium severity

No gaps detected.

### Low severity

- **`.editorconfig`** — editor-level defaults are not pinned, so agent and human edits can drift on whitespace and line endings. Fix: add a root `.editorconfig` with the team's formatting defaults.

## Stack Assessment Cross-Reference

No `stack-assessment.md` found. Run `/10x-stack-assess` for quality-gate analysis.

## Recommended Fixes

### Fix before agent work (Category A)

### 1. Add a real test runner and baseline tests

**Impact**: Without a runnable test suite, the agent cannot verify behavior after changes and regressions will stay invisible until manual testing.
**Severity**: critical
**Effort**: moderate (15–30 min)
**Fix**:

Run:

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @vitest/coverage-v8
```

Then add a `"test": "vitest run"` script and create at least one smoke test around sign-in or sign-up form behavior.

### 2. Patch the current audit findings

**Impact**: The current dependency tree contains one HIGH transitive vulnerability and several MODERATE issues; the agent should not build new work on top of a known vulnerable baseline if it can be cleaned up first.
**Severity**: high
**Effort**: quick (< 5 min) to moderate (15–30 min)
**Fix**:

Run:

```bash
npm audit fix
npm audit --json
```

If the HIGH finding remains, upgrade the likely parents explicitly:

```bash
npm install @astrojs/check@latest
npm install -D wrangler@latest
```

### 3. Add a dedicated type-check command and CI step

**Impact**: The project is configured for strict TypeScript, but CI does not currently enforce type correctness, which weakens one of the main safety rails the agent could rely on.
**Severity**: high
**Effort**: quick (< 5 min)
**Fix**:

Add a script such as `"check": "astro check && tsc --noEmit"` and run it in `.github/workflows/ci.yml` before the build step.

### 4. Refresh stale direct dependencies during the first maintenance pass

**Impact**: The project is not badly out of date, but keeping Astro, Wrangler, and Supabase current reduces the chance that the agent will generate code against stale APIs.
**Severity**: medium
**Effort**: moderate (15–30 min)
**Fix**:

Run:

```bash
npm update
npm outdated --json
```

Then review any remaining major upgrades, especially `typescript` and `eslint`, before applying them deliberately.

### 5. Add `.editorconfig`

**Impact**: This is a small consistency issue, but agent edits are more predictable when editor defaults are explicit.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**:

Create `.editorconfig` with basic defaults, for example:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
```

### Addressed in upcoming lessons (Category B)

### Automated security checks in CI

**Lesson**: [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5)
**What you'll do there**: Add stronger CI coverage, including automated security checks such as `npm audit`, Dependabot, or CodeQL, so dependency health is enforced continuously instead of only on demand.

### Project-specific agent onboarding memory

**Lesson**: [Agent Onboarding: Agents.md, AI Rules i feedback loops (M1L4)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l4)
**What you'll do there**: Establish project-specific agent instructions and feedback loops so future agent work uses local rules instead of only the scaffold defaults.

## Summary

Health status: critical-issues

The project starts from a solid Astro/TypeScript base: lockfile present, strict TS config enabled, formatter and linter configured, and a GitHub Actions pipeline already in place. The main blockers for reliable agent-assisted development are the absence of any test runner and the presence of one HIGH dependency advisory in the current npm tree; once those are addressed and type checking is enforced in CI, the codebase becomes much safer to evolve with an agent.
