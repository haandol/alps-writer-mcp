# Lite ALPS Template

Lite ALPS is a minimal product document for deciding what to build in a PoC and what to demonstrate
with it. It has a separate goal, authoring process, and document lifecycle from Full ALPS.

## Sections

1. What to Build - Select one Primary Persona and define the problem, PoC intent, minimum build, and success condition
2. How It Works - Describe the Primary Persona's core ideal use cases as intent, actions, visible responses, and completion
3. What to Demo - Define the shortest demo flow and the observable evidence of success
4. What Not to Do - Optionally record only explicit exclusions and claims the PoC will not prove

> **Authoring order:** 1 → 2 → 3 → 4.
> Section 4 is optional and may remain unwritten.

## Section References

- Section 2 reviews Section 1.
- Section 3 reviews Sections 1 and 2.
- Section 4 reviews Sections 1 through 3 only when the user has explicit exclusions.

Call the referenced `read_alps_section(N)` tools before drafting a dependent section. If a required
prerequisite is incomplete, complete it first instead of inventing missing content.

## Conversation Workflow

- If several personas are presented, ask one focused question and have the user choose exactly one
  Primary Persona before completing Section 1. Do not choose silently or combine personas.
- Keep that persona as the perspective for every required Section.
- Ask one focused question, or at most two closely related simple questions, at a time.
- Integrate only information the user provided or explicitly approved.
- Present a concise plain-text approval digest and save only after explicit approval.
- Use atomic confirmation by default. Batch confirmation is allowed only when the user explicitly
  requests it or provides a complete structured source covering several Sections.
- Skip Section 4 when the user has no explicit exclusions. Do not ask for exclusions merely to fill
  the template.

## Core Ideal Use Case Rule

Section 2 may contain one or more core ideal use cases for the same Primary Persona.

For every use case, preserve:

- the product intent it demonstrates;
- the concrete starting context;
- sequential actions led by the Primary Persona;
- the visible product response after each action; and
- an observable completion result.

Do not introduce Feature IDs, implementation layers, detailed state matrices, or edge-case
inventories. Keep only the behavior needed to construct and understand the minimum PoC.

## Approval Digest

The digest is a disposable reading aid, not another document.

- Include the approval unit's intent, confirmed scope, mandatory information, applicable values and
  rules, and observable completion.
- Never save a requirement, scope boundary, success condition, or exclusion absent from the digest.
- Show the full pending content when requested.
- End with clear approve, revise, and defer choices.

## Scope Boundary

Lite ALPS decides the minimum PoC and its demo. It does not claim implementation readiness. Its
authoring, resume, status, completion, and export flow never reads or updates a Full ALPS document,
and Full ALPS authoring never uses Lite state.

Preserve any confirmed permission, privacy, safety, limit, or failure guarantee that the PoC itself
must honor. Do not ask for architecture, technology, interfaces, storage, deployment, libraries,
code structure, or internal tuning.

Uncertainty is not the same as exclusion. Record an item in Section 4 only when the user explicitly
confirms that this PoC will not cover or prove it.
