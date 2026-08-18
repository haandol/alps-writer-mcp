---
name: alps-init
description: Bootstrap an ALPS (PRD) document via the alps-writer MCP server. Use when the user invokes /alps-init or asks to start a new ALPS/PRD document or resume an existing .alps.xml. Keywords - "/alps-init", "ALPS 시작", "PRD 작성 시작", "start a new PRD".
disable-model-invocation: true
---

# alps-init

Start authoring an ALPS (PRD).

> **Language**: this skill and every other harness prompt are written in English, but talk to the user and write the document content in the language the user writes in. Any user-facing phrasing below is a guide, not a literal string.

1. Confirm with the user whether to create a new document or continue an existing `.alps.xml`.
2. Call `mcp__alps-writer__init_alps_document` or `mcp__alps-writer__load_alps_document`.
3. Call `mcp__alps-writer__get_alps_overview` to fetch the authoring guide for all nine sections.
4. Select the confirmation mode:
   - **Atomic is the default**: discuss, present, confirm, and save one section at a time.
   - **Batch is opt-in**: use it only when the user explicitly requests batch authoring or has supplied a complete structured source that covers several sections. State the proposed batch scope once and get approval before drafting it.
   - In batch mode, keep every section or Feature as a separately labeled draft and save each one with its own `save_alps_section` call only after the user approves the batch. The user may approve, reject, or revise individual items.
5. Use the dependency-respecting authoring order **1 → 2 → 3 → 4 → 6 → 5 → 7 → 8 → 9**.
   - For a new document, start at Section 1.
   - After loading an existing document, call `mcp__alps-writer__get_alps_document_status`, summarize the completed sections once, and resume at the first section in that order that is not `✅ Written`.
   - Do not reopen or re-confirm a completed unchanged section unless the user requests a full review or an edited prerequisite requires that section to be revisited.
6. From the selected starting point:
   - `get_alps_section_guide(N)` → `get_alps_section(N)` → ask the user 1-2 questions → show the completed section and confirm → `save_alps_section(N, ...)` after confirmation → move to the next section only once confirmed
   - In batch mode, repeat the guide/read step for every included section before drafting, present the sections as separate approval units, and save them separately after approval.
   - Never skip an incomplete section at your own discretion. Even one that looks trivial must be seen and approved by the user before moving on.
   - **Section 4.1 requires two diagrams:** one Mermaid `C4Context` and one Mermaid `C4Container`. Treat both as required even for a simple system. These are the only C4 levels ALPS permits: never generate Component, Dynamic, Deployment, or Code-level C4 diagrams, and never place modules, classes, functions, files, or methods in the Container diagram.
7. **Section 7 (Feature-Level Specification)** needs particular care. Review Section 3 and Section 6 first. Every Feature's Acceptance Criteria must end with one Demo checkpoint that states the Feature's role in the end-to-end demo and its observable completion result. Do not add a separate demo subsection or repeat the User Flow, edge cases, errors, or acceptance rules. In atomic mode, confirm and save each incomplete Feature subsection one at a time. In batch mode, each Feature remains a separately labeled approval and save unit; one batch approval may cover several Features, but never merge their content or persist them with one call.
8. Once Section 7 is written, ask the user whether to transfer implementation ownership to ADRs with `/feature-to-adr` (requires the adr-writer plugin). Explain that successful handoff makes the ADR set the implementation authority and leaves the ALPS PRD as a legacy planning document; normal implementation will no longer read it. If they want to write just one decision directly, also point them to `/adr-new <category>`. Both paths presume the adr-writer plugin is installed; if it is not, give the instruction matching the current client — `codex plugin add adr-writer@alps-writer` for Codex, `/plugin install adr-writer@alps-writer` for Claude Code.

**Rule**: atomic confirmation is the default. Batch confirmation requires explicit opt-in or a complete structured source and still preserves separate section/Feature drafts and save calls. Never skip an incomplete unit or save without user confirmation.
