---
project: "PrepToClimb"
version: 1
status: draft
created: 2026-05-19
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: "# TODO: target_scale.qps — see Open Questions"
  data_volume: "# TODO: target_scale.data_volume — see Open Questions"
timeline_budget:
  mvp_weeks: 1
  hard_deadline: 2026-05-31
  after_hours_only: true
---

## Vision & Problem Statement

Intermediate climbers struggle to plan training that actually moves them forward because they cannot reliably decide what to focus on next, how hard to train, how often to train, and when to rest. The pain shows up when they are preparing for a goal like a bouldering trip or competition, or when they have been stuck for a while and do not know which weakness to target next.

Generic climbing plans do not work well enough because they do not target the specific weaknesses of a given climber.

## User & Persona

### Primary persona

An intermediate climber who wants help deciding the next training focus based on current weaknesses and a near-term goal such as a trip, competition, or breaking through a plateau.

# TODO: persona name — see Open Questions

## Success Criteria

### Primary

- A user can log in and receive a usable weekly plan in under 2 minutes.

### Secondary

- The weekly plan reflects the user's injury or body-part strengthening focus and current finger strength.

# TODO: reconcile MVP questionnaire inputs in success criteria — see Open Questions

### Guardrails

- The plan must avoid recommending exercises that directly conflict with the injury or body-part limitation the user declared.
- The user must receive a complete weekly plan in a single flow without needing manual plan assembly.

## User Stories

### US-01: User receives a weekly climbing plan

- **Given** I have an account
- **When** I answer the short questionnaire
- **Then** I receive a weekly climbing plan with recommended exercises

#### Acceptance Criteria

- The questionnaire asks for injury information and current climbing grade.
- The user receives a complete weekly plan immediately after submission.
- The plan includes recommended exercises.

## Functional Requirements

### Authentication

- FR-001: User can create an account. Priority: must-have
  > Socrates: Counter-argument considered: none. Resolution: kept as written.
- FR-002: User can log in. Priority: must-have
  > Socrates: Counter-argument considered: none. Resolution: kept as written.
- FR-003: User can log out. Priority: must-have
  > Socrates: Counter-argument considered: none. Resolution: kept as written.

### Questionnaire

- FR-004: User can declare injury-related limitations. Priority: must-have
  > Socrates: Counter-argument considered: asking for both injury and training focus is too vague for MVP.
  > Resolution: narrowed to injury-related limitations only.
- FR-005: User can submit current climbing grade. Priority: must-have
  > Socrates: Counter-argument considered: finger strength is hard to measure consistently for MVP.
  > Resolution: replaced with climbing grade as a simpler proxy.

### Plan Delivery

- FR-006: User can receive a weekly plan based on questionnaire answers. Priority: must-have
  > Socrates: Counter-argument considered: none. Resolution: kept as written.
- FR-007: User can see the generated weekly plan. Priority: must-have
  > Socrates: Counter-argument considered: none. Resolution: kept as written.
- FR-008: User can view recommended exercises included in the plan. Priority: must-have
  > Socrates: Counter-argument considered: none. Resolution: kept as written.

### Persistence

- FR-009: User data remains persistent across sessions. Priority: must-have
  > Socrates: Counter-argument considered: none. Resolution: kept as written.

## Non-Functional Requirements

- A user receives a usable weekly plan in under 2 minutes from login to plan display.
- Recommended exercises must avoid directly stressing a declared injured area while still supporting safe development around that limitation.
- The product remains usable in a browser on both mobile and desktop devices.
- User account data and generated plan data remain available across sessions after logout and later login.
- The visual design should clearly relate to climbing so the product feels domain-specific rather than generic.
- The interface should remain clear and understandable by following familiar interaction patterns for form completion and plan viewing.

## Business Logic

Based on injury limitations and current climbing grade, the app decides which generic weekly training plan and exercises are safest and most relevant.

The rule consumes two user-facing inputs: declared injury limitations and current climbing grade.

The output is a 7-day weekly plan with climbing days, rest days, and recommended exercises.

The user encounters this rule immediately after submitting the short questionnaire, when the app maps the answers to the weekly plan shown on screen.

## Access Control

Users sign up and sign in with an account so their questionnaire data and generated plans persist across sessions.

MVP uses a flat single-user role model with no role separation. Any authenticated user can manage their own profile inputs and view their own generated training plan.

## Non-Goals

- No long-term multi-week training cycles. Rationale: this will be added later after the short-plan MVP works.
- No progress analytics or charts. Rationale: this will be added later after the core plan flow is proven.
- No social features. Rationale: this will be added later and are not required to validate the core planning value.
- No external fitness app integrations. Rationale: this will be added later and would expand scope before the core workflow is validated.
- No dedicated mobile app. Rationale: MVP is browser-based only; native mobile can come later.
- No advanced exercise video library. Rationale: detailed media content is deferred until after the core plan recommendation flow exists.

## Open Questions

1. **What should `target_scale.qps` be for this product?** — Owner: user. Block: no.
2. **What should `target_scale.data_volume` be for this product?** — Owner: user. Block: no.
3. **What is the primary persona's name?** — Owner: user. Block: no.
4. **Should the MVP success criteria reference injury limitations and current climbing grade instead of body-part strengthening focus and current finger strength?** — Owner: user. Block: no.
