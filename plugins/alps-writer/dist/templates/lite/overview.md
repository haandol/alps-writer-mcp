# Lite ALPS Template

Lite ALPS is a four-section product document for a minimum PoC. It uses the same conversational
authoring flow as Full ALPS while omitting implementation-preparation Sections.

## Sections

1. Overview - Capture the Target User and Core Problem, then the expected Value and Key Assumption
2. Solution and Acceptance Tests - Capture one minimum Solution Strategy and every Required Acceptance Test
3. Out of Scope - Optionally record explicit exclusions in one list
4. Demo Scenario - Automatically generate and show one executable scenario that covers every required test

> **Authoring order:** 1 → 2 → 3 → 4.
> Section 3 is optional and may remain unwritten. Section 4 is required.

## Section References

- Section 2 reviews Section 1.
- Section 3 reviews Sections 1 and 2 when the user has explicit exclusions.
- Section 4 reviews Sections 1 and 2, plus Section 3 when it was written.

Call the referenced `read_alps_section(N)` tools before working on a dependent Section. If a
required prerequisite is incomplete, complete it first.

## Conversation Guide

For every Section that needs content:

1. Call `get_lite_alps_section_guide(N)`.
2. Call `get_lite_alps_section(N)`.
3. Explain the Section's purpose briefly.
4. Ask one focused question, or at most two closely related questions, when required context is
   missing. Skip optional Section 3 without a question when no explicit exclusion exists and the
   approved boundary is not materially ambiguous.
5. Wait for the user's response and integrate it iteratively.
6. When the Section is complete, present a concise plain-text approval digest.
7. Save only after explicit approval with `save_alps_section`.

Use atomic confirmation by default. Batch confirmation is allowed only when the user explicitly
requests it or provides a complete structured source covering several Sections. Batch mode keeps
every Section as a separate approval and save unit.

## Section Scope

### Section 1 — Overview

- `Target User and Core Problem`: identify the main user and the problem the PoC should address.
- `Value and Key Assumption`: state the expected value and the main belief guiding the PoC.
- Ask only for the context needed by these two inputs.

### Section 2 — Solution and Acceptance Tests

- `Solution Strategy`: state the minimum product-level approach and visible PoC scope.
- `Required Acceptance Tests`: list every product behavior the PoC must demonstrate.
- Give each test a distinct name, starting condition, user action, and observable pass condition.
- Preserve confirmed values and rules that decide whether the test passes.
- Follow the complete multi-test example in the Section 2 template.

### Section 3 — Out of Scope

- This Section is optional.
- Record only exclusions the user explicitly confirms.
- If there are no explicit exclusions and the approved boundary is not materially ambiguous, skip
  this Section without a dedicated question.
- Do not ask for exclusions just to fill the template or turn unresolved choices into exclusions.

### Section 4 — Demo Scenario

- Use one `4.1 Demo Scenario` subsection.
- Automatically generate the shortest scenario that covers every approved Required Acceptance Test.
- Show the complete scenario before approval, with the required test covered by every step or
  execution block.
- Ask a focused question only when a required test lacks an executable starting state or input.
- The overall pass result requires every Required Acceptance Test to pass.
- Treat a passing demo as product-behavior acceptance, not proof of user value or market validity.
- Keep the scenario inside the approved Sections 1-2 and any explicit Section 3 boundary.

## Approval Digest

The digest is a disposable reading aid, not another document.

- Include the approval unit's purpose, confirmed scope, mandatory information, applicable values
  and rules, observable completion, and unresolved questions.
- Show proposed values as ordinary document content; do not add inference-origin labels.
- Never save a requirement, scope boundary, success condition, or exclusion absent from the digest.
- Show the full pending content when requested.
- End with clear approve, revise, and defer choices.

## Scope Boundary

Lite ALPS is a reduced Full ALPS template, not a separate product methodology. Its conversation,
approval, and save behavior follows Full ALPS.

Lite does not ask for architecture, technology stack, interfaces, storage, deployment, libraries,
code structure, NFRs, detailed Feature specifications, implementation plans, or ADR handoff.

Lite and Full keep separate document state, resume, completion, and export. Completing Lite never
changes or completes a Full document.
