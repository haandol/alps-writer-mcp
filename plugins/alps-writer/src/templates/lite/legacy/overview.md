# Legacy Lite ALPS Template

Lite ALPS is a lightweight product document for planners and product managers who want to create
and validate a mockup or PoC before choosing an implementation approach.

It keeps the ALPS principles that matter at this stage:

- The agent leads the authoring conversation.
- The user explicitly approves every saved unit.
- The validated scope is visible; explicit non-goals are recorded when they matter.
- Product behavior is observable and reproducible.
- Confirmed product requirements stay separate from assumptions and open questions.

## Sections

1. Product Overview - Select one Primary Persona and define their problem, direction, and expected change
2. MVP Goals and Scope - State the validation hypothesis, in-scope Features, optional non-goals, and success criteria
3. Primary User Scenario - Describe the Primary Persona's core ideal use cases from intent to completion
4. Key Features and Behavior - Define each Feature's ideal path, product response, rules, and completion
5. Key Screens - Derive the minimum screens and navigation, plus only the states the PoC presents
6. Shared Product Principles - Define applicable permissions, confirmation, accessibility, and sensitive-information rules
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

Keep one user perspective throughout the Lite PRD:

- If the user presents several personas, ask one focused question at the start and have them choose
  exactly one Primary Persona before completing Section 1. Do not choose silently or combine them.
- After the persona is confirmed, identify one or more core ideal use cases for that persona. These
  use cases are the spine of the remaining conversation.
- For each core ideal use case, state the product intent it demonstrates, sequential user actions
  by that persona, and an observable completion result.
- Derive the Feature scope, Feature behavior, screens, and PoC validation from those use cases.
  Keep secondary personas, alternative journeys, and nonessential edge cases outside the core flow.

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
- Include purpose and user value, confirmed scope, mandatory information, every applicable product
  value and rule, permissions and visibility, completion results, and unresolved questions.
- Include non-goals, states, exceptions, and failure guarantees only when the user confirmed that
  they affect the PoC. Never omit an explicitly confirmed rule by calling it a later edge case.
- Omit repeated explanation, examples, and formatting decoration.
- Never save a requirement, scope boundary, or success condition absent from the digest.
- Show the full pending content when the user requests it.
- End with clear approve, revise, and defer choices.

## Section 4 Feature Rule

Section 4 is the dynamic section.

- Section 2.2 defines the complete Feature list with `F1`, `F2`, and so on.
- Each Feature `4.x` is one approval and save unit.
- Use the same Feature ID and name as Section 2.2.
- Connect the Feature to the confirmed Primary Persona and the core ideal use case intent it serves.
- Keep the complete ideal-path behavior together: user goal, starting conditions, user action,
  product response, required information, product rules, and completion checkpoint.
- Add states and exceptions only when the PoC must show or validate them.
- Describe what the user does and observes. Do not split a Feature into implementation layers.
- If a Feature mixes independently demonstrable user outcomes, suggest up to three user-behavior
  splits and allow the user to keep the original.

## Scope Boundary

Lite ALPS is for mockup and PoC validation. It does not claim implementation readiness and does not
automatically hand ownership to ADRs.

Prioritize the confirmed Primary Persona's core ideal use cases and observable success. Preserve
every confirmed input, limit, permission, visibility, ordering, uniqueness, state, forbidden change,
or failure guarantee that affects those use cases. Do not invent exclusions or edge cases to fill
optional subsections. Defer secondary personas, alternative journeys, and nonessential edge cases
to Section 8 or later product and implementation work.

Do not ask the user to choose architecture, technology, interfaces, storage, deployment, libraries,
code structure, or internal tuning.

Assumptions and unresolved decisions belong in Section 8. They never become confirmed Feature
behavior merely because the agent suggested them.
