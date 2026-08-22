---
name: lite-alps-init
description: Bootstrap or resume a minimal Lite ALPS document with Full-aligned names and one executable Demo Scenario through the alps-writer MCP server.
argument-hint: "[project-name-or-lite-alps-path]"
---

# lite-alps-init

Create or resume a Lite ALPS document for a minimum PoC and its executable demo.

> **Language**: talk to the user and write the document in the language the user uses. The skill,
> templates, and guides are written in English only as agent instructions.

Lite ALPS and Full ALPS have separate goals, authoring processes, document state, and completion.
Never read, update, transition into, or suggest Full ALPS while authoring or managing Lite ALPS.

1. Confirm whether to create a new Lite ALPS document or resume an existing `.lite.alps.xml`
   document.
2. Call `mcp__alps-writer__init_lite_alps_document` or
   `mcp__alps-writer__load_alps_document`.
3. Call `mcp__alps-writer__get_lite_alps_overview` and follow the four-section workflow below.
4. Select the confirmation mode:
   - Atomic is the default: discuss, approve, and save one Section at a time.
   - Batch is allowed only when the user explicitly requests it or supplies a complete structured
     source covering several Sections.
   - Batch mode still keeps every Section as a separate approval unit and saves each subsection
     separately.
5. Use the authoring order **1 → 2 → 3 → 4**.
   - Sections 1, 2, and 4 are required.
   - Section 3 is optional. Skip it when the user has no explicit exclusions.
   - After loading a document, call `mcp__alps-writer__get_alps_document_status`, summarize
     completed required Sections once, and resume at the first incomplete required Section.
6. Establish the user perspective and reason in Section 1:
   - Start from one concrete hypothetical problem case. When it is not recoverable, ask who, in
     what situation, is trying to do what, and what problem they are assumed to face.
   - Do not require an actual or recent experience, and do not ask the user to enumerate persona
     candidates.
   - Infer one Primary Persona from the case.
   - Only when the user explicitly presents several candidate personas, briefly name them and ask
     the user to anchor the case to exactly one Primary Persona before saving.
   - Do not silently select or combine explicitly presented candidates.
   - Keep the confirmed Primary Persona throughout Sections 1, 2, and 4.
   - Keep Section 1 to two integrated inputs: Target User and Core Problem and Value and Core
     Hypothesis.
7. For each Section:
   - Call `mcp__alps-writer__get_lite_alps_section_guide(N)`.
   - Call `mcp__alps-writer__get_lite_alps_section(N)`.
   - Read every prerequisite named by the guide with
     `mcp__alps-writer__read_alps_section`.
   - Treat the guide's questions as an extraction checklist, not an interview script.
   - Infer a complete draft from the user's messages and references, approved prior Sections,
     logical consequences, established domain conventions, and dominant reversible MVP defaults.
   - Ask no question when one safe draft is supported. Ask one focused question only when multiple
     valid outcomes remain and the choice changes product value, scope, money, permissions,
     legal/regulatory/privacy/safety policy, irreversible data meaning, an external promise,
     acceptance, or learning. Ask at most two only when they cannot be separated.
   - Present a concise plain-text approval digest and wait for explicit approval.
   - Save each approved subsection separately with
     `mcp__alps-writer__save_alps_section`.
8. Section-specific rules:
   - **Section 1 — Overview**: Target User and Core Problem combines the Primary Persona, concrete
     situation, attempted action, assumed problem, and present consequence. Value and Core
     Hypothesis combines the expected customer value, team or organizational meaning, and one core
     belief to test. Do not require a customer promise, metric, hypothesis inventory, FAQ, feature
     list, or screen list.
   - **Section 2 — Solution and User Flow**: Solution Strategy combines the product-level approach
     and minimum user-visible PoC scope. Core User Flow defaults to one flow with starting context,
     sequential user actions, visible product responses, and observable completion. Add another
     flow only when the core hypothesis cannot be exercised without it. Do not create Feature IDs,
     detailed state matrices, or implementation layers.
   - **Section 3 — Out of Scope**: write only exclusions the user explicitly confirmed. Do not ask
     for exclusions to fill the template, treat unresolved choices as excluded, or save an empty
     placeholder. Store all exclusions in one concise Explicit Exclusions list.
   - **Section 4 — Demo Scenario**: save one `4.1 Demo Scenario` containing only the starting
     context needed to run the Core User Flow, sequential persona actions, visible expected
     results, and one overall pass result. Do not add a separate Learning Check or learning
     decision. Read Section 3 too when it was written and keep every tested claim inside that
     boundary.
9. Keep method overhead low:
   - Do not expand Golden Circle, Lean Startup, or Working Backwards into separate required
     documents, questionnaires, PR/FAQs, metric frameworks, assumption inventories, or experiment
     plans.
   - Ask for extra flows, metrics, assumptions, FAQs, edge cases, or experiments only when the
     first PoC cannot be built or evaluated without them.
10. The approval digest must include every applicable confirmed product intent, value, hypothesis,
    scope boundary, expected result, and overall pass result. Never save a requirement, exclusion,
    or Demo Scenario result absent from the digest. Show the full pending content when requested.
    Mark important constants not directly supplied by the user as `AI-inferred` with a short basis
    so the user can approve, revise, or defer them.
11. When the requested document work is complete, call
    `mcp__alps-writer__export_alps_markdown`.

Lite ALPS does not ask for architecture, technology stack, interfaces, storage, deployment,
libraries, code structure, internal tuning, implementation plans, or a later document. It may
preserve a permission, privacy, safety, limit, or failure guarantee only when the PoC itself must
honor it.

**Rule**: inference-first drafting is the default, but inferred content is never silently saved. No
Section is saved without explicit approval. Optional Section 3 may remain unwritten. Section 4 is
required and contains one `4.1 Demo Scenario`. Lite completion never changes or depends on Full
ALPS state.
