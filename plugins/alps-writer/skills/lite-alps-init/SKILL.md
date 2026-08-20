---
name: lite-alps-init
description: Bootstrap or resume a lightweight Lite ALPS document for mockup and PoC planning through the alps-writer MCP server. Use when the user asks for a Lite PRD, Lite ALPS, product brief for a mockup, or a non-technical PoC specification.
argument-hint: "[project-name-or-lite-alps-path]"
---

# lite-alps-init

Create a Lite ALPS document for product managers and planners who need a mockup or PoC before
implementation decisions.

> **Language**: talk to the user and write the document in the language the user uses. The skill,
> templates, and guides are written in English only as agent instructions.

1. Confirm whether to create a new Lite ALPS document or resume an existing
   `.lite.alps.xml` document.
2. Call `mcp__alps-writer__init_lite_alps_document` or
   `mcp__alps-writer__load_alps_document`.
3. Call `mcp__alps-writer__get_lite_alps_overview` before drafting any section.
4. Select the confirmation mode:
   - Atomic is the default: discuss, approve, and save one section at a time.
   - Batch is allowed only when the user explicitly requests it or supplies a complete structured
     source covering several sections.
   - Batch mode still presents every section and every Section 4 Feature as a separate approval
     unit and saves each unit separately.
5. Use the authoring order **1 → 2 → 3 → 4 → 6 → 5 → 7 → 8**.
   - For a new document, start at Section 1.
   - After loading, call `mcp__alps-writer__get_alps_document_status`, summarize completed units
     once, and resume at the first incomplete unit in this order.
   - Do not reopen an unchanged completed unit unless the user requests review or an edited
     prerequisite invalidates it.
6. For each section:
   - Call `mcp__alps-writer__get_lite_alps_section_guide(N)`.
   - Call `mcp__alps-writer__get_lite_alps_section(N)`.
   - Read every prerequisite named by the guide with `mcp__alps-writer__read_alps_section`.
   - Ask one focused question, or at most two closely related simple questions.
   - Present a concise plain-text approval digest and wait for explicit approval.
   - Save each approved fixed subsection separately with
     `mcp__alps-writer__save_alps_section`.
7. The approval digest must include every confirmed value and rule that changes the product:
   mandatory information, scope and non-goals, limits and units, permissions and visibility,
   allowed states and forbidden changes, ordering and uniqueness, failure guarantees, completion
   results, and unresolved questions. Never save a requirement absent from the digest. Show the
   full pending content when requested.
8. Section 4 is dynamic:
   - Read the complete F1, F2... list from Section 2.2 and the Primary User Scenario from Section 3.
   - Create exactly one `4.x` entry for each approved Feature, in ID order.
   - Treat one complete Feature as the approval and save unit. Keep user goal, starting conditions,
     user actions, product responses, required information, product rules, states, exceptions, and
     completion checkpoint together.
   - Save with `save_alps_section(4, "x", "Fx: Feature name", content)`.
   - If a Feature mixes independently demonstrable outcomes, suggest up to three user-behavior
     splits and allow keeping the original. Never split by technical layer.
9. Section 5 screens must be derived from the approved scenario, Features, and shared principles.
   Every screen references existing Feature IDs and must not introduce a new product capability.
10. Keep assumptions and unresolved decisions in Section 8. An AI suggestion is not confirmed
    product content until the user approves it.
11. When all sections are complete, call `mcp__alps-writer__export_alps_markdown`.

Lite ALPS is mockup and PoC input. Do not ask for architecture, technology stack, interfaces,
storage, deployment, libraries, code structure, or internal tuning. Do not present completion as a
Full ALPS or automatic ADR handoff. If the user later needs implementation-ready requirements,
start a separate Full ALPS authoring flow and use the Lite document as a reference that still
requires normal section and Feature approval.

**Rule**: no section or Feature is saved without explicit approval. Atomic confirmation is the
default, and batch mode never merges approval or save units.
