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

## Why this stack

This project is a browser-based MVP with authentication, a short 1-week after-hours timeline, and a medium target scale, so the safest choice is the recommended JS web starter that already combines UI, auth, database, and deployment conventions in one opinionated setup. 10x Astro Starter fits that shape well: it is typed, convention-based, popular, and well documented, and it reduces setup overhead by bundling Supabase and Cloudflare-ready deployment. Using the standard path keeps the stack simple, favors shipping speed over framework experimentation, and matches a solo-builder baseline with GitHub Actions and auto-deploy on merge.
