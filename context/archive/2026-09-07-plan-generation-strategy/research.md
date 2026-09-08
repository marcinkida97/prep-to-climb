---
date: 2026-09-07T00:00:00Z
researcher: Marcin Kida
git_commit: 710d7e43c8bcf3864f2e597ae21f2d33f860cd66
branch: main
repository: prep-to-climb
topic: "Expanded injury taxonomy and plan-generation architecture (rule-based vs AI vs hybrid)"
tags: [research, plans, injuries, training-methodology, ai-safety, questionnaire]
status: complete
last_updated: 2026-09-07
last_updated_by: Marcin Kida
---

## Research Question

1. What is a genuinely useful, evidence-based expansion of the current 6-entry injury taxonomy?
2. What should the weekly-plan generation architecture be — extend the current rule-based
   template system, move to an AI-assisted generator, or a hybrid — and what additional
   questionnaire questions would meaningfully improve personalization?

## Summary

**Current state (codebase baseline).** `INJURY_OPTIONS` (`src/lib/injury-options.ts`) has 6
entries: left/right shoulder strain, left/right finger pulley irritation, left/right elbow
tendon pain. `PLAN_TEMPLATES` (`src/lib/plan-generator/templates.ts`) is ~3-4 grade-matched,
hand-written 7-day templates. `INJURY_RULES` (`src/lib/plan-generator/injury-rules.ts`) maps each
injury to a small set of hardcoded exercise-name substitutions. The whole system takes exactly two
inputs — `climbingGrade` and `injuryLimitations` — and is fully deterministic. This matches the PRD
(`context/foundation/prd.md`) almost exactly: Business Logic section literally describes "based on
injury limitations and current climbing grade, the app decides which generic weekly training plan
and exercises are safest and most relevant," and the PRD's `main_goal: speed` / `top_blocker: time`
framing (`context/foundation/roadmap.md` frontmatter) confirms this was a deliberately minimal MVP
choice, not an oversight.

**Injury taxonomy.** Web research (climbing-injury epidemiology + sports-medicine sources) supports
expanding from 3 body-parts/6-entries to roughly 9 body regions, with fingers (~40% of overuse
injuries), shoulders (~16%), and elbow (~12%) as the highest-prevalence areas — validating that the
current taxonomy picked the right starting regions but under-covers everywhere else (wrist, back,
knee, ankle are currently missing entirely). Sports-medicine self-report practice strongly
recommends splitting each injury entry into **"currently injured / acute"** vs **"prior injury / at-risk
area, not currently acute"** — acute entries should route to conservative generic guidance +
a disclaimer to see a professional, not a specific exercise substitution, since an app cannot
triage red-flag symptoms.

**Plan-generation architecture.** A 2026 systematic review of LLM-based exercise recommendation
found unconstrained AI plans underperformed human-expert programs in 5/6 head-to-head trials and
showed systemic safety flaws in 14/24 studies (e.g., prescribing contraindicated exercises to
at-risk personas) — directly relevant because PrepToClimb's PRD hard-codes an injury-avoidance
guardrail that an unconstrained generator cannot be trusted to honor. Adjacent literature
(knowledge-graph-grounded and RAG-based fitness planners) converges on a mitigation: constrain any
generative step to **select/sequence from a pre-vetted, tagged exercise database**, never
free-generate exercise content. Training-methodology research also surfaces a concrete gating rule
missing from the current system: campus/power training is coaching-consensus-gated behind
**climbing grade AND training age** (years climbing + fingerboard experience), not grade alone —
so grade-only personalization is structurally insufficient regardless of which generation
architecture is chosen.

**Net recommendation:** extend the current architecture — a bigger, tagged, coach-vetted exercise
database plus explicit gating rules across more input dimensions (grade, training age, sessions/week,
equipment access, goal, injury exclusions with acute/chronic handling) — rather than introduce an
LLM call in this iteration. This is a genuine architectural upgrade (the "open to replacing it"
option), not a cosmetic extension of the 3-4 hardcoded templates, but it keeps the safety-critical
injury-avoidance guardrail fully deterministic. Design the exercise database schema so an
AI-assisted *selection* layer (never free-generation) could be layered on top later without a
rewrite.

## Detailed Findings

### A. Expanded injury taxonomy (candidate list)

| Region | Candidate entries | Prevalence signal | Typical training implication |
|---|---|---|---|
| Fingers/hand | Pulley strain/tear (A2/A4), trigger finger (A1), flexor/joint irritation | ~40% of overuse injuries; most common site | Avoid max hangs, small-edge/pocket work, high-force crimping; substitute open-hand grip, low-load recovery work |
| Wrist | TFCC injury, wrist tendinopathy | Common but currently uncovered | Avoid mantling/wrist-extension loading, campus board; substitute neutral-wrist holds, stabilization work |
| Elbow | Medial epicondylitis ("climber's elbow"), lateral epicondylitis (tennis elbow) | ~12% of overuse injuries | Avoid max hangs/campusing/high-volume pulling; substitute antagonist/extensor and eccentric work |
| Shoulder | Impingement, SLAP/labral tear, rotator cuff tendinopathy, biceps tendinopathy, dislocation history | ~16% of overuse injuries; ~77% lifetime prevalence; leading site for women | Avoid dynamic overhead/campus/roof volume; substitute scapular stability and rotator cuff work |
| Back | Lower back strain/overuse | ~74% of young competitive climbers report it, but low severity | Avoid steep-overhang volume without core support; substitute core/glute stability, technique focus |
| Knee | Meniscus/ACL (fall/heel-hook mechanism), patellar tendinopathy | Less frequent, more severe when acute | Avoid aggressive heel-hooking/high-ball bouldering without conditioning; substitute landing-technique/neuromuscular work |
| Ankle/foot | Sprains (fall/landing mechanism) | Bouldering-specific | Avoid high-ball bouldering, poor-mat landings; substitute stability/proprioception work |
| Skin | Flappers, calluses, splits | Very common, self-limiting | **Recommend a lightweight "reduce volume this week" tag, not a full injury/substitution entry** — cosmetic-functional, not structural |

**Self-report design implication:** each injury entry should carry an **acute vs chronic/at-risk**
flag captured at questionnaire time. Acute selections should bypass specific exercise substitution
and instead show conservative, generic guidance with a "see a professional" disclaimer — this is a
product-safety decision, not just a UX nicety, since red-flag literature is unanimous that an app
cannot safely triage an active, undiagnosed injury.

### B. Questionnaire fields worth adding

Beyond `climbingGrade` and `injuryLimitations`, real-world climbing-training tools (Lattice
Training/Crimpd, Climbah) and general onboarding-personalization practice converge on these as
high-value, low-effort (single-tap/select) fields — sized against the PRD's "usable plan in under 2
minutes" constraint:

1. **Training age** (years climbing / fingerboard experience) — gates power/campus-style
   prescriptions; grade alone is an insufficient proxy per the campus-board gating research.
2. **Sessions per week available** — determines whether a modality mix even fits.
3. **Equipment access** (hangboard / campus board / gym / outdoor-only) — a hard feasibility
   constraint, not a preference.
4. **Primary goal** (send a specific grade, endurance/multi-pitch, bouldering power, general
   fitness, return-from-injury) — determines modality emphasis and whether to route to a
   conservative rehab-first plan shape.
5. *(Optional 5th, if time budget allows)* **Self-assessed weakness** (power / endurance /
   technique) — cheap signal, no objective test required.

A finger-strength/endurance test (Lattice's approach) is high-value but too slow for a 2-minute
flow — explicitly out of scope for the questionnaire, a candidate for a later optional deep-assessment
path, not this change.

### C. Core training modalities to encode in the rule/database layer

- **Finger/grip strength**: max hangs (near-max load, short hang/long rest, builds max force) vs
  repeaters (moderate load, short work/rest cycles, builds strength-endurance) — different
  protocols, both need representing.
- **Power** (campus board, limit bouldering): coaching-consensus gated behind grade **and**
  training age — not safe to prescribe by grade alone; below the gate, feet-on variants substitute.
- **Power-endurance** (linked boulders, 4x4s): short blocks (2-4 weeks) pre-performance phase;
  literature warns against extending it, which argues for the plan/database tracking "how long has
  this modality been active" if cycling is ever supported (out of scope for this MVP-extension, but
  worth the schema allowing a `modality` tag now so it isn't precluded).
- **Aerobic capacity/base** (ARC training): low-intensity volume, broadly beneficial across grades.
- **Technique/movement**: foundational, especially at lower grades; less protocol-structured than
  the strength modalities.
- **Antagonist/injury-prevention**: wrist extensor, shoulder external rotator/scapular work —
  already represented in today's `INJURY_RULES` substitutions; should generalize into the tagged
  database rather than living only inside injury-specific rules.

### D. Rule-based vs AI vs hybrid — the architecture decision

- A 2026 systematic review of LLM exercise recommendation (PMC13343266) found unconstrained
  LLM-generated plans underperformed human-expert programs in 5/6 trials and had documented safety
  failures in 14/24 studies (e.g., prescribing a contraindicated HIIT/heavy-lifting plan to a
  retinopathy persona, unmodified heavy deadlifts to a lumbar-disc-herniation persona). Named
  root cause: LLMs are "probabilistic imitators, not clinical reasoners" and cannot verify
  biomechanical safety.
  - **This maps directly onto PrepToClimb's PRD guardrail**: "the plan must avoid recommending
    exercises that directly conflict with the injury or body-part limitation the user declared" is
    exactly the kind of constraint the review found unconstrained LLMs violate at a ~58% study
    rate.
- The mitigation pattern converged on by adjacent literature (knowledge-graph-grounded planners,
  RAG-based fitness agents) is to **never let the model free-generate exercise content** — instead
  ground it in a pre-vetted, tagged exercise database and let it only select/sequence/personalize
  volume within that safe set. RAG reduces hallucination (reported up to ~26% reduction in one
  fitness-recommendation context) but does **not** eliminate it — it is a mitigation, not a
  guarantee.
- Cost/latency: unconstrained free-form generation costs more tokens/time than a constrained
  selection call over a small curated set; a constrained approach is more compatible with the
  product's "plan in under 2 minutes" requirement than an open-ended generative one.
- **Conclusion**: build the bigger, tagged exercise database and the gating/rule engine now
  (deterministic, safe, matches PRD guardrail exactly); do not introduce an LLM call in this
  iteration. Structure the exercise database (tags: modality, target grade band, training-age gate,
  equipment requirement, injury-exclusion tags) so that an AI-assisted *selection-only* layer could
  be added later without restructuring data — but that layer is explicitly **not** part of this
  change.

## Architecture Insights

- The existing system's shape — deterministic mapping from a small set of declared inputs to a
  safety-filtered exercise set — is validated by both the injury research (self-report should stay
  simple/binary, acute cases should bypass automated substitution entirely) and the AI-safety
  research (constrained, non-generative selection is the safer pattern). The right upgrade is
  **breadth** (more injuries, more inputs, bigger exercise database, real gating logic) not
  **a different paradigm**.
- The campus/power training gate (grade × training age) reveals that `climbingGrade` alone —
  today's only "how strong is this person" signal — is insufficient for the modality-mix decision
  regardless of how exercises are picked. This is independent of the AI-vs-rules question and
  applies even if the team ultimately chose an AI-assisted layer later.

## Historical Context (from prior changes)

- `context/archive/2026-06-14-first-weekly-plan-flow/` — introduced the current questionnaire →
  generate → save flow this change extends; established the two-input (grade + injuries) contract
  now being revisited.
- `context/archive/2026-06-14-minimal-plan-persistence-contract/` — established the persistence
  schema (`weekly_plans`, `plan_days`, `recommended_exercises`) that any new exercise-database
  design should stay compatible with or deliberately supersede.
- `context/foundation/prd.md` — Non-Goals exclude long-term multi-week cycles, analytics, social,
  integrations, native app, and video library, but say nothing that forecloses a bigger exercise
  database or additional questionnaire fields — those are within the MVP's stated Business Logic,
  just not yet built out.

## Open Questions

None blocking — architecture direction (extend deterministic rule/database system, defer AI) is
resolved by the research above. Remaining decisions are solution-design choices for `/10x-plan`'s
questioning phase: exact schema shape for the exercise database, which of the 4-5 new
questionnaire fields to include in this change vs. defer, how much of the expanded injury list to
ship now vs. phase, and how "acute vs chronic" self-report should surface in the UI given item 4
(wizard flow) is a separate, later change.

## Sources

### Injury taxonomy
- [Finger, hand and wrist injuries in climbers — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC13052765/)
- [Epidemiology of Musculoskeletal Injuries Among Climbers — MDPI](https://www.mdpi.com/2411-5142/11/1/19)
- [Finger Pulley Injuries in Climbers: A2, A3 & A4 — Max Climbing](https://www.maxclimbing.com/blogs/knowledge-hub-injury-prevention/finger-pulley-injuries-a2-a3-a4-mechanics-symptoms-safe-return-to-load)
- [A2 Pulley Rehab Manual — Hooper's Beta](https://www.hoopersbeta.com/library/a2-pulley-manual-for-climbers)
- [Trigger Finger — Orthobullets](https://www.orthobullets.com/hand/6027/trigger-finger)
- [TFCC injury — The Climbing Doctor](https://theclimbingdoctor.com/tfcc-injury-a-common-source-of-wrist-pain-in-climbers/)
- [Treating "Climber's Elbow" — Training for Climbing](https://trainingforclimbing.com/treating-climbers-elbow-medial-epicondylitis/)
- [A Complete Program for Climbing Lateral Elbow Pain — The Climbing Doctor](https://theclimbingdoctor.com/a-complete-program-for-climbing-lateral-elbow-pain/)
- [Impact of 30 years' high-level rock climbing on the shoulder — J. Shoulder and Elbow Surgery](https://www.jshoulderelbow.org/article/S1058-2746(21)00077-X/fulltext)
- [SLAP Tears in Rock Climbers' Shoulder — The Climbing Doctor](https://theclimbingdoctor.com/slap-tears-rock-climbers/)
- [Lower back pain in young climbers — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10770867/)
- [Complex knee injuries from bouldering — J. ISAKOS](https://www.jisakos.com/article/S2059-7754(25)00612-1/fulltext)
- [Self-Reported Outcome Measures of Injury/Illness Impact — Sports Medicine (Springer)](https://link.springer.com/article/10.1007/s40279-016-0651-5)
- [Red Flags: When Back Pain Requires Immediate Medical Attention — Carter PT](https://carterpt.com/blog/when-back-pain-requires-immediate-medical-attention)

### Training methodology & AI-vs-rules
- [Comparing Hangboard Protocols — TrainingBeta](https://www.trainingbeta.com/comparing-hangboard-protocols/)
- [Max Hangs vs Repeaters — thehangboard.com](https://thehangboard.com/blogs/news/max-hangs-vs-repeaters)
- [Power-Endurance Training Protocols for Climbers — trainingforclimbing.com](https://trainingforclimbing.com/power-endurance-training-protocols-for-climbers/)
- [Periodization and Load Progression for ARC Training — TrainingBeta](https://www.trainingbeta.com/periodization-and-load-progression-for-arc-training/)
- [Campus Board Training for Beginners — Dr. James Lee PT, DPT](https://leept.medium.com/campus-board-training-for-beginners-e7d46529f2fd)
- [Campus Board Training: Complete Beginner's Guide — 99Boulders](https://www.99boulders.com/campus-board-training)
- [Antagonist Workouts for Climbers — Climbing.com](https://www.climbing.com/skills/antagonist-workouts-for-climbers-improve-performance-and-prevent-injury/)
- [Resistance Training, Climbing Performance, and Injury Prevention — PMC/NIH](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10798940/)
- [Lattice Board / assessments — The Climbing Academy](https://www.theclimbingacademy.com/tca-life/lattice-assessments/)
- [Crimpd vs Lattice vs Sequence — fitnessaitrends.com](https://fitnessaitrends.com/blog/crimpd-vs-lattice-vs-sequence-climbing-training-app/)
- [The AI recommendation paradox: LLMs in exercise recommendation — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC13343266/)
- [Knowledge-grounded LLM for personalized sports training plan generation — Nature Sci. Reports](https://www.nature.com/articles/s41598-026-37075-z)
- [PlanFitting: Personalized Exercise Planning with LLM-driven Conversational Agent — arXiv](https://arxiv.org/pdf/2309.12555)
- [LLM API Pricing Comparison 2026 — Featherless](https://featherless.ai/blog/llm-api-pricing-comparison-2026-complete-guide-inference-costs)
