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
4. Use the dependency-respecting authoring order **1 → 2 → 3 → 4 → 6 → 5 → 7 → 8 → 9**.
   - For a new document, start at Section 1.
   - After loading an existing document, call `mcp__alps-writer__get_alps_document_status`, summarize the completed sections once, and resume at the first section in that order that is not `✅ Written`.
   - Do not reopen or re-confirm a completed unchanged section unless the user requests a full review or an edited prerequisite requires that section to be revisited.
5. From the selected starting point, work **one section at a time**:
   - `get_alps_section_guide(N)` → `get_alps_section(N)` → ask the user 1-2 questions → show the completed section and confirm → `save_alps_section(N, ...)` after confirmation → move to the next section only once confirmed
   - Never skip an incomplete section at your own discretion. Even one that looks trivial must be seen and approved by the user before moving on.
6. **Section 7 (Feature-Level Specification)** needs particular care. Confirm and save each incomplete Feature subsection (7.1, 7.2, …) **individually, one at a time.** Even when a subsection looks small or similar to the previous Feature, never batch them — go through a separate confirmation step for every 7.x.
7. Once Section 7 is written, ask the user whether to start the bulk ADR conversion with `/feature-to-adr` (the helper path — requires the adr-writer plugin). If they want to write just one decision directly, also point them to adr-writer's `/adr-new <category>`. Both paths presume the adr-writer plugin is installed; if it is not, give the instruction matching the current client — `codex plugin add adr-writer@alps-writer` for Codex, `/plugin install adr-writer@alps-writer` for Claude Code.

**Rule**: never generate several sections at once. Take the user's confirmation for each new or changed section, and never skip an incomplete section without their approval. For Section 7, confirm every incomplete Feature subsection (7.x) individually. Never save without user confirmation.
