# Lite ALPS Template

Lite ALPS is a minimal product document for capturing a PoC overview, its solution and user flow,
its explicit exclusions, and one executable Demo Scenario. It uses terminology that corresponds to
Full ALPS while keeping a separate goal, authoring process, and document lifecycle.

## Sections

1. Overview - Capture the Target User and Core Problem, then the expected Value and Core Hypothesis
2. Solution and User Flow - Capture one minimum Solution Strategy and one Core User Flow
3. Out of Scope - Optionally record explicit exclusions and claims the PoC will not prove in one list
4. Demo Scenario - Run one executable scenario and record one observable overall pass result

> **Authoring order:** 1 → 2 → 3 → 4.
> Section 3 is optional and may remain unwritten. Section 4 is required.

## Section References

- Section 2 reviews Section 1.
- Section 3 reviews Sections 1 and 2 only when the user has explicit exclusions.
- Section 4 reviews Sections 1 and 2, plus Section 3 when it was written.

Call the referenced `read_alps_section(N)` tools before drafting a dependent section. If a required
prerequisite is incomplete, complete it first instead of inventing missing content.

## Conversation Workflow

This workflow uses **inference-first authoring**.

- Start from one concrete hypothetical problem case. When it is not recoverable, ask who, in what
  situation, is trying to do what, and what problem they are assumed to face. Do not require an
  actual or recent experience or ask the user to enumerate persona candidates.
- Infer one Primary Persona from that case. Only when the user explicitly presents multiple
  candidate personas, briefly name them and ask the user to anchor the case to exactly one before
  completing Section 1. Do not silently choose or combine explicitly presented candidates.
- Keep that persona as the perspective for every required Section.
- Treat Section questions as an extraction checklist. Infer a complete draft from user messages and
  references, approved prior Sections, logical consequences, domain conventions, and dominant
  reversible MVP defaults.
- Ask no question when one safe draft is supported. Ask one focused question only when multiple
  valid outcomes materially change product value, scope, money, permissions,
  legal/regulatory/privacy/safety policy, irreversible data meaning, an external promise,
  acceptance, or learning; ask at most two when inseparable.
- Present a concise plain-text approval digest and save only after explicit approval.
- Use atomic confirmation by default. Batch confirmation is allowed only when the user explicitly
  requests it or provides a complete structured source covering several Sections.
- Skip Section 3 when the user has no explicit exclusions. Do not ask for exclusions merely to fill
  the template.

## Minimal Input Rule

Do not expand Golden Circle, Lean Startup, or Working Backwards into separate required documents,
questionnaires, or method-specific fields. Preserve their useful decisions through a few integrated
inputs:

- Overview: one Target User and Core Problem and one Value and Core Hypothesis.
- Solution and User Flow: one Solution Strategy and one Core User Flow.
- Out of Scope: one optional Explicit Exclusions list.
- Demo Scenario: one `4.1 Demo Scenario` subsection.

Ask for extra flows, metrics, assumptions, FAQs, edge cases, or experiments only when the first PoC
cannot be built or evaluated without them.

## Overview Rule

Section 1 explains why the PoC deserves attention before any solution is selected.

- Target User and Core Problem combines one Primary Persona, the concrete situation, attempted
  action, assumed problem, and its present consequence.
- Value and Core Hypothesis combines the customer value, the team or organizational meaning, and
  the single most important belief the PoC should test.
- Do not require a detailed current-alternative analysis, business metric, customer promise,
  hypothesis inventory, or FAQ.

## Solution and User Flow Rule

Section 2 defaults to one solution sketch and one core flow.

- Solution Strategy combines the product-level approach and minimum user-visible PoC scope.
- Core User Flow preserves the starting context, sequential persona actions, visible product
  responses, and observable completion result.
- Add another flow only when the core hypothesis cannot be exercised without it.
- Do not introduce Feature IDs, implementation layers, detailed state matrices, or edge-case
  inventories.

## Demo Scenario Rule

Section 4 follows the Full ALPS shape: one Section and one same-named subsection.

- Demo Scenario checks whether the minimum PoC behaves as intended. Include only necessary starting
  context, sequential persona actions, visible expected results, and one overall pass result.
- Keep every tested claim inside the approved Overview, Solution and User Flow, and any explicit Out
  of Scope boundary.
- Do not add a separate Learning Check or learning-decision field.
- Do not replace the scenario with a capability list or screen tour.

## Approval Digest

The digest is a disposable reading aid, not another document.

- Include the approval unit's intent, confirmed scope, mandatory information, applicable values and
  rules, and observable completion.
- Mark important constants not directly supplied by the user as `AI-inferred` with a short basis.
- Never save a requirement, scope boundary, success condition, or exclusion absent from the digest.
- Show the full pending content when requested.
- End with clear approve, revise, and defer choices.

## Scope Boundary

Lite ALPS decides the minimum PoC and its acceptance demo. It does not claim implementation
readiness. Its authoring, resume, status, completion, and export flow never reads or updates a Full
ALPS document, and Full ALPS authoring never uses Lite state.

Preserve any confirmed permission, privacy, safety, limit, or failure guarantee that the PoC itself
must honor. Do not ask for architecture, technology, interfaces, storage, deployment, libraries,
code structure, or internal tuning.

Uncertainty is not the same as exclusion. Record an item in Section 3 only when the user explicitly
confirms that this PoC will not cover or prove it.
