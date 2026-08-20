# Lite ALPS Template

Lite ALPS is a lightweight product document for planners and product managers who want to create
and validate a mockup or PoC before choosing an implementation approach.

It keeps the ALPS principles that matter at this stage:

- The agent leads the authoring conversation.
- The user explicitly approves every saved unit.
- Scope and non-goals are both visible.
- Product behavior is observable and reproducible.
- Confirmed product requirements stay separate from assumptions and open questions.

## Sections

1. Product Overview - Define the product, primary user, problem, direction, and expected change
2. MVP Goals and Scope - State the validation hypothesis, in-scope Features, non-goals, and success criteria
3. Primary User Scenario - Describe the representative journey from starting context to completion
4. Key Features and Behavior - Define each Feature through user action, product response, rules, states, and completion
5. Key Screens - Derive the minimum screens, navigation, and visible states from the scenario and Features
6. Shared Product Principles - Define permissions, confirmation, recovery, accessibility, and sensitive-information rules
7. PoC Validation Plan - State the demo flow, checks, success judgment, and user feedback questions
8. Open Questions - Separate assumptions, unresolved decisions, and items that must be settled before the PoC

> **Authoring order:** 1 → 2 → 3 → 4 → 6 → 5 → 7 → 8.
> Screens are authored after the Features and shared principles they must express.

## Section References

- Section 3 reviews Sections 1 and 2.
- Section 4 reviews Sections 2 and 3.
- Section 6 reviews Section 4.
- Section 5 reviews Sections 3, 4, and 6.
- Section 7 reviews Sections 2 through 6.

Call the referenced `read_alps_section(N)` tools before drafting a dependent section. If a
prerequisite is incomplete, complete it first instead of inventing missing content.

## Conversation Workflow

For every section:

1. Call `get_lite_alps_section_guide(N)`.
2. Call `get_lite_alps_section(N)`.
3. Explain the section's purpose briefly.
4. Ask one focused question, or at most two closely related simple questions.
5. Integrate only information the user provided or explicitly approved.
6. Present a concise plain-text approval digest.
7. Save only after explicit approval with `save_alps_section`.

Atomic confirmation is the default. Batch confirmation is allowed only when the user explicitly
requests it or provides a complete structured source covering multiple sections. Batch mode still
keeps every section and every Section 4 Feature as a separate approval and save unit.

## Approval Digest

The digest is a disposable reading aid, not a second document.

- Keep it readable as raw text.
- Include purpose and user value, scope and non-goals, mandatory information, every product value
  and rule, permissions and visibility, allowed states and forbidden changes, failure guarantees,
  completion results, and unresolved questions.
- Omit repeated explanation, examples, and formatting decoration.
- Never save a requirement, scope boundary, or success condition absent from the digest.
- Show the full pending content when the user requests it.
- End with clear approve, revise, and defer choices.

## Section 4 Feature Rule

Section 4 is the dynamic section.

- Section 2.2 defines the complete Feature list with `F1`, `F2`, and so on.
- Each Feature `4.x` is one approval and save unit.
- Use the same Feature ID and name as Section 2.2.
- Keep the complete user behavior together: user goal, starting conditions, user action, product
  response, required information, product rules, states, exceptions, and completion checkpoint.
- Describe what the user does and observes. Do not split a Feature into implementation layers.
- If a Feature mixes independently demonstrable user outcomes, suggest up to three user-behavior
  splits and allow the user to keep the original.

## Scope Boundary

Lite ALPS is for mockup and PoC validation. It does not claim implementation readiness and does not
automatically hand ownership to ADRs.

Write product behavior that remains true regardless of implementation: required inputs, limits,
permissions, visibility, ordering, uniqueness, allowed states, forbidden changes, failure
guarantees, and observable success. Do not ask the user to choose architecture, technology,
interfaces, storage, deployment, libraries, code structure, or internal tuning.

Assumptions and unresolved decisions belong in Section 8. They never become confirmed Feature
behavior merely because the agent suggested them.
