---
project: preptoclimb
researched_at: 2026-05-29T00:00:00+02:00
recommended_platform: Cloudflare Workers
runner_up: Railway
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6
  runtime: Cloudflare Workers via @astrojs/cloudflare
---

## Recommendation

**Deploy on Cloudflare Workers.**

This repo already targets Cloudflare at the framework layer: `astro@6.3.1`, `@astrojs/cloudflare@13.5.0`, `wrangler@4.90.0`, and `output: "server"` are in place, so Cloudflare Workers is the lowest-friction path with the least rework. Given the interview answers (`No` persistent processes, `Minimize cost`, `Single region is fine`, `Co-location preferred`, and familiarity with `Cloudflare` and `Railway`), Cloudflare wins on cost, CLI/docs quality, and starter alignment, while Railway remains the best fallback if single-vendor managed data becomes more important than cost.

## Platform Comparison

| Platform | CLI-first | Managed / Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total |
|---|---|---|---|---|---|---|
| Cloudflare Workers | Pass | Pass | Pass | Pass | Pass | 5/5 |
| Railway | Pass | Pass | Partial | Pass | Pass | 4.5/5 |
| Render | Partial | Pass | Partial | Pass | Pass | 4/5 |
| Vercel | Pass | Pass | Pass | Pass | Pass | 4/5 |
| Netlify | Pass | Pass | Partial | Pass | Pass | 3.5/5 |
| Fly.io | Pass | Partial | Pass | Pass | Partial | 3.5/5 |

### Notes by Platform

**Cloudflare Workers** scores clean passes across the matrix for this repo shape. The Astro and Cloudflare documentation now point Astro SSR deployments to Workers with Wrangler, the Workers pricing model is favorable for a low-traffic MVP, and Cloudflare publishes agent-readable docs plus MCP surfaces. The main weakness is architectural cohesion: the current auth/database story is already partly external through Supabase, so Cloudflare is strongest when hosting the app tier rather than acting as a single-vendor app-plus-data platform.

**Railway** is the strongest co-located full-stack alternative. It offers a solid CLI, preview environments, deployment actions, logs, and an MCP server, while making app-plus-Postgres hosting straightforward. It lost to Cloudflare because the Hobby plan introduces a monthly floor and because moving this repo there would require changing the deployment target instead of using the starter’s existing adapter path.

**Render** is a credible third-place option for managed web services plus databases and cron jobs. It has mature deployment controls and preview environments, but it is less aligned with the current Astro Cloudflare adapter and tends to become more expensive than Cloudflare for a simple server-rendered MVP.

**Vercel** remains viable for Astro, but it is a worse fit than Cloudflare for this repo because it would require an adapter switch and does not help with the co-location preference unless additional vendors are introduced anyway. It scored well on CLI, docs, and deployment API, but lost on cost and repo alignment.

**Netlify** is usable for Astro and has strong agent tooling, including an MCP server, but it is similarly misaligned with the current Cloudflare-specific setup. It also loses on co-location because the preferred full-stack path would still require external managed data.

**Fly.io** is powerful, especially when apps need persistent processes or more infrastructure control, but that is unnecessary for this MVP. It adds Docker/VM operational surface without solving a real constraint from the interview.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Cloudflare Workers won because it matches the existing stack exactly, keeps MVP hosting cost low, and preserves a clean operational loop through `wrangler` plus official docs. For a request/response Astro app with no realtime or background-worker requirement, it avoids unnecessary platform churn.

#### 2. Railway

Railway scored second because it best satisfies the co-location preference: app, database, and related services can live under one platform with good developer ergonomics. It lost because this repo is already wired for Cloudflare and because the monthly floor is less attractive for a one-week MVP.

#### 3. Render

Render took third place as a stable managed PaaS fallback with good preview and rollback primitives. It trails Railway on co-location clarity and Cloudflare on cost plus repo fit.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate - Weaknesses

1. The current project already depends on Supabase for auth, so the stated co-location preference is only partially met unless the data layer is redesigned away from Supabase.
2. Cloudflare’s cheapest native persistence options push the architecture toward D1/KV/R2 rather than the Postgres-centric model many full-stack apps eventually want, which can create split-vendor complexity later.
3. Astro-on-Cloudflare guidance changed materially between the older Pages era and the current Workers workflow, so stale tutorials can produce wrong setup decisions.
4. Cloudflare code rollbacks are easy, but data-layer changes are not versioned the same way; a rollback may restore code faster than it restores compatible runtime state.
5. If the product later grows into realtime or always-on background work, the current ranking becomes less reliable because a non-persistent request model is part of why Cloudflare won.

### Pre-Mortem - How This Could Fail

The team shipped quickly because the starter already targeted Cloudflare and the deploy path looked almost free. That was the right optimization for week one, but they never revisited whether the platform still matched the product as scope expanded. Supabase stayed in place for auth, while some new application data and background-style workflows gradually moved into Cloudflare-native services because they were easy to add. Over time, the app no longer had one operational center of gravity. Debugging authentication or persistence issues started crossing vendor boundaries, and simple changes required reasoning about multiple runtime and storage models. New contributors repeatedly found outdated Pages-focused examples and introduced inconsistent config changes, which caused avoidable churn. When the team eventually needed richer relational workflows or more admin tooling, they discovered they had optimized for the shortest path to first deploy rather than for architectural cohesion. None of the individual choices seemed wrong at the time, but together they created a system that was harder to understand, test, and evolve than a more unified app platform would have been.

### Unknown Unknowns

- Cloudflare preview URLs are a Workers concept now, not the old Pages preview model, so older branch-preview assumptions may be wrong.
- Cloudflare documents that preview URL logs are not currently available through Workers Logs, `wrangler tail`, or Logpush, which can surprise teams expecting production-like observability in previews.
- Rollbacks restore deployed Worker versions and config state, but not every binding or data mutation, so operational safety depends on keeping schema and storage changes conservative.
- Astro’s Cloudflare adapter generates Worker-oriented output and bindings that differ from older tutorials; copying generic Cloudflare Pages examples can put the repo on the wrong path.
- If the team later decides that app hosting, auth, and relational persistence must all be under one vendor, Railway or Render may become a better fit than Cloudflare.

## Operational Story

- **Preview deploys**: Cloudflare provides Workers preview URLs and `workers.dev` URLs for deployed versions; preview exposure should be reviewed explicitly because preview URLs are public unless additional protection such as Cloudflare Access is added.
- **Secrets**: Runtime secrets live in Cloudflare Worker secrets and local development uses `.dev.vars` or `.env`; production secrets are managed through Wrangler and Cloudflare, while Supabase credentials remain external secrets that must be rotated in both places if changed.
- **Rollback**: Roll back with Cloudflare’s Workers version/deployment rollback flow; code rollback is fast, but storage and schema changes need separate care because they are not automatically reversed with the deploy.
- **Approval**: An agent can perform read-only inspection, local validation, and non-destructive deploy preparation. A human should own production publish approval, secret rotation, domain changes, and any destructive data operation.
- **Logs**: Use `wrangler tail` for runtime logs on deployed Workers and Cloudflare dashboard/API log views for additional inspection; preview URL log coverage is limited and should not be assumed to match production observability.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Split-vendor architecture between Cloudflare app hosting and Supabase auth/data becomes harder to reason about | Devil's advocate | M | M | Keep the MVP boundary explicit: Cloudflare hosts the app tier, Supabase owns auth and relational data. Avoid adding Cloudflare-native persistence unless there is a clear need. |
| Team follows stale Pages-era setup guides and drifts from the correct Workers flow | Research finding | H | M | Treat Astro 6 plus `@astrojs/cloudflare@13.5.0` as the source of truth and document the exact Wrangler-based workflow in deploy notes. |
| Code rollback succeeds while runtime data or bindings remain incompatible | Devil's advocate | M | H | Keep the MVP schema simple, avoid destructive migrations early, and separate code rollback procedures from data rollback procedures. |
| Preview environments provide weaker observability than expected | Unknown unknowns | M | M | Use previews for smoke checks, not deep debugging, and validate critical runtime behavior on a non-production deployed environment with full logging. |
| Future realtime or background-job requirements outgrow the current platform choice | Pre-mortem | L | H | Re-evaluate the platform if realtime, queues, or always-on processing enters scope instead of forcing that workload into the current MVP decision. |
| Co-location preference remains unsatisfied because Supabase stays external | Research finding | H | L | Accept this as an explicit tradeoff for MVP speed, and revisit Railway or Render only if one-vendor operations becomes more important than cost and starter alignment. |

## Getting Started

1. Keep the current Astro adapter path and use the repo’s existing Cloudflare setup instead of switching to a Pages-specific flow.
2. Authenticate Wrangler for the target Cloudflare account and create the Worker project/environment expected by this repo.
3. Define `SUPABASE_URL` and `SUPABASE_KEY` in local `.dev.vars` or `.env` for development, and in Cloudflare Worker secrets for deployed environments.
4. Run `npx astro sync`, then validate locally with `npm run lint` and `npm run build`.
5. Deploy with the current Workers flow for this stack using Wrangler, then verify the generated Worker URL and the auth flow against the deployed runtime.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
