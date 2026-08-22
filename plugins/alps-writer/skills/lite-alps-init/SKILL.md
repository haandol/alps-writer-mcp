---
name: lite-alps-init
description: Bootstrap or resume a minimal Lite ALPS document for deciding what PoC to build and what to demonstrate through the alps-writer MCP server.
argument-hint: "[project-name-or-lite-alps-path]"
---

# lite-alps-init

Create or resume a Lite ALPS document for a minimum PoC and its demo.

> **Language**: talk to the user and write the document in the language the user uses. The skill,
> templates, and guides are written in English only as agent instructions.

Lite ALPS and Full ALPS have separate goals, authoring processes, document state, and completion.
Never read, update, transition into, or suggest Full ALPS while authoring or managing Lite ALPS.

1. Confirm whether to create a new Lite ALPS document or resume an existing `.lite.alps.xml`
   document.
2. Call `mcp__alps-writer__init_lite_alps_document` or
   `mcp__alps-writer__load_alps_document`.
3. When loading:
   - If the result says `Legacy Lite ALPS`, call
     `mcp__alps-writer__get_legacy_lite_alps_overview` and use only the matching legacy section and
     guide tools. Preserve its eight-section format and never convert it automatically.
   - Otherwise call `mcp__alps-writer__get_lite_alps_overview` and follow the current four-section
     workflow below.
4. Select the confirmation mode:
   - Atomic is the default: discuss, approve, and save one Section at a time.
   - Batch is allowed only when the user explicitly requests it or supplies a complete structured
     source covering several Sections.
   - Batch mode still keeps every Section as a separate approval unit and saves each subsection
     separately.
5. Use the current authoring order **1 → 2 → 3 → 4**.
   - Sections 1-3 are required.
   - Section 4 is optional. Skip it when the user has no explicit exclusions.
   - After loading a current document, call
     `mcp__alps-writer__get_alps_document_status`, summarize completed required Sections once, and
     resume at the first incomplete required Section.
6. Establish the user perspective in Section 1:
   - If several personas are presented, ask one focused question and have the user choose exactly
     one Primary Persona before saving.
   - Do not select one silently or combine several personas.
   - Keep the confirmed Primary Persona throughout Sections 1-3.
7. For each current Section:
   - Call `mcp__alps-writer__get_lite_alps_section_guide(N)`.
   - Call `mcp__alps-writer__get_lite_alps_section(N)`.
   - Read every prerequisite named by the guide with
     `mcp__alps-writer__read_alps_section`.
   - Ask one focused question, or at most two closely related simple questions.
   - Present a concise plain-text approval digest and wait for explicit approval.
   - Save each approved subsection separately with
     `mcp__alps-writer__save_alps_section`.
8. Section-specific rules:
   - **Section 1 — What to Build**: capture the Primary Persona, concrete problem, PoC intent,
     minimum user-visible build scope, and observable success condition. Include only constraints
     the PoC itself must honor.
   - **Section 2 — How It Works**: record one or more core ideal use cases for the same persona.
     Every use case includes intent, starting context, sequential user actions, visible product
     responses, and observable completion. Do not create Feature IDs, detailed state matrices, or
     implementation layers.
   - **Section 3 — What to Demo**: compose the shortest connected demonstration of the approved use
     cases. Preserve the same persona and intents. Record demo intent, sequential flow, and success
     evidence. Feedback questions are optional.
   - **Section 4 — What Not to Do**: write only exclusions the user explicitly confirmed. Do not ask
     for exclusions to fill the template, treat unresolved choices as excluded, or save an empty
     placeholder.
9. The approval digest must include every applicable confirmed product intent, scope boundary,
   mandatory input, value, rule, and observable result. Never save a requirement, exclusion, or
   success condition absent from the digest. Show the full pending content when requested.
10. When the requested current or legacy document work is complete, call
    `mcp__alps-writer__export_alps_markdown`.

Lite ALPS does not ask for architecture, technology stack, interfaces, storage, deployment,
libraries, code structure, internal tuning, implementation plans, or a later document. It may
preserve a permission, privacy, safety, limit, or failure guarantee only when the PoC itself must
honor it.

**Rule**: no Section is saved without explicit approval. Optional Section 4 may remain unwritten,
and Lite completion never changes or depends on Full ALPS state.
