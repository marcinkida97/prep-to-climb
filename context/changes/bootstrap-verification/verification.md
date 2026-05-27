---
bootstrapped_at: 2026-05-27T06:42:24Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: preptoclimb
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

```yaml
---
starter_id: 10x-astro-starter
package_manager: npm
project_name: preptoclimb
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---
```

## Why this stack

This project is a browser-based MVP with authentication, a short 1-week after-hours timeline, and a medium target scale, so the safest choice is the recommended JS web starter that already combines UI, auth, database, and deployment conventions in one opinionated setup. 10x Astro Starter fits that shape well: it is typed, convention-based, popular, and well documented, and it reduces setup overhead by bundling Supabase and Cloudflare-ready deployment. Using the standard path keeps the stack simple, favors shipping speed over framework experimentation, and matches a solo-builder baseline with GitHub Actions and auto-deploy on merge.

## Pre-scaffold verification

| Signal | Value | Severity | Notes |
| --- | --- | --- | --- |
| npm package | not run | n/a | `cmd_template` uses `git clone`, so no `create-*` npm package applies |
| GitHub repo | not run | n/a | `gh` CLI was unavailable locally, so `pushed_at` could not be fetched |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 20
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: moved silently
**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW
**Direct vs transitive**: 0/0/2/0 direct of total 0/1/9/0

#### CRITICAL findings

None.

#### HIGH findings

- `devalue` `5.6.3 - 5.8.0` — `GHSA-77vg-94rm-hx3p`: DoS via sparse array deserialization. Fix available.

#### MODERATE findings

- `@astrojs/check` — direct dependency; vulnerable via `@astrojs/language-server`. Suggested fix available via `@astrojs/check@0.9.2` (semver-major).
- `@astrojs/language-server` — transitive dependency; vulnerable via `volar-service-yaml`. Suggested fix available via `@astrojs/check@0.9.2` (semver-major).
- `@cloudflare/vite-plugin` — transitive dependency; vulnerable via `miniflare`, `wrangler`, and `ws`. Fix available.
- `miniflare` — transitive dependency; vulnerable via `ws`. Fix available.
- `volar-service-yaml` — transitive dependency; vulnerable via `yaml-language-server`. Suggested fix available via `@astrojs/check@0.9.2` (semver-major).
- `wrangler` — direct dependency; vulnerable via `miniflare`. Fix available.
- `ws` `8.0.0 - 8.20.0` — transitive dependency; `GHSA-58qx-3vcg-4xpx`: uninitialized memory disclosure. Fix available.
- `yaml` `2.0.0 - 2.8.2` — transitive dependency; `GHSA-48c2-rrv3-qjmp`: stack overflow via deeply nested YAML collections. Suggested fix available via `@astrojs/check@0.9.2` (semver-major).
- `yaml-language-server` — transitive dependency; vulnerable via `yaml`. Suggested fix available via `@astrojs/check@0.9.2` (semver-major).

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint | Value |
| --- | --- |
| bootstrapper_confidence | first-class |
| quality_override | false |
| path_taken | standard |
| self_check_answers | null |
| team_size | solo |
| deployment_target | cloudflare-pages |
| ci_provider | github-actions |
| ci_default_flow | auto-deploy-on-merge |
| has_auth | true |
| has_payments | false |
| has_realtime | false |
| has_ai | false |
| has_background_jobs | false |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
