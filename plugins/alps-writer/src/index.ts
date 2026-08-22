#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  FIRST_SECTION,
  LAST_SECTION,
  LITE_FIRST_SECTION,
  LITE_LAST_SECTION,
  LITE_SECTION_RANGE,
  SECTION_RANGE,
} from "./constants.js";
import { LITE_ALPS_PROFILE } from "./profiles.js";
import { TemplateService } from "./tools/templates/service.js";
import { TemplateController } from "./tools/templates/controller.js";
import { DocumentService } from "./tools/documents/service.js";
import { DocumentController } from "./tools/documents/controller.js";

const server = new McpServer(
  // Keep in lockstep with every manifest version (package.json, the two
  // plugin.json files, marketplace.json). tests/version-consistency.test.ts
  // fails the build when they drift — this literal silently reported 0.4.20
  // to MCP clients for two releases after a manifest-only version bump.
  { name: "alps-writer", version: "0.8.2" },
  {
    instructions: `You are an intelligent product owner helping users create ALPS and Lite ALPS product documents.

ALPS defines each feature as a vertical slice — a single feature that cuts through all layers (UI → API → Data) end-to-end, so it can be developed, tested, and delivered independently. When writing feature specs (Section 7), always describe each user action as a vertical slice tracing from UI to API to data store. End each Feature's Acceptance Criteria with one Demo checkpoint that states its role in the Section 3 end-to-end demo and its observable completion result; do not duplicate the Feature's flow, errors, or acceptance rules in a separate demo subsection.

Lite ALPS is a separate PoC authoring process with a different goal and lifecycle from Full ALPS. It uses Full-aligned names with minimal integrated inputs: one Target User and Core Problem and Value and Core Hypothesis, one Solution Strategy and Core User Flow, one optional Explicit Exclusions list, and one executable Demo Scenario. It never reads, updates, transitions into, or shares authoring state with a Full ALPS document. Start Section 1 from one concrete hypothetical problem case: who, in what situation, is trying to do what, and what problem they are assumed to face. Do not require an actual or recent experience. Infer one Primary Persona from that case without asking the user to enumerate personas. Only when the user explicitly presents multiple candidate personas, ask them to anchor the case to exactly one Primary Persona. Default to one core user flow. Section 3 is optional. Section 4 is required and contains one 4.1 Demo Scenario.

Full and Lite ALPS use inference-first authoring. Treat every guide's questions as an extraction checklist, not an interview script. Before asking, use the user's messages and references, approved prior Sections, logical consequences of confirmed contracts, established domain conventions, and dominant reversible MVP defaults. Convert recoverable business variables into concrete implementation-independent product constants. Ask no question when one safe draft is supported. Ask one focused question only when multiple valid outcomes remain and the choice changes product value, scope, money, permissions, legal/regulatory/privacy/safety policy, irreversible data meaning, an external promise, acceptance, or learning. Ask at most two only when they cannot be separated. Mark important constants not directly supplied by the user as AI-inferred with a short basis in the approval digest. Inferred content is never saved before explicit approval.

<TRIGGER>
MUST use this server's tools when the user wants to:
- Write, create, or edit a PRD (Product Requirements Document)
- Write a product specification or product spec
- Create an ALPS (Agentic Lean Product Spec) document
- Create a Lite ALPS document for a mockup or PoC
- Draft product requirements, feature specs, or product plans
Keywords: PRD, ALPS, Lite ALPS, 기획서, 기획 문서, 제품 요구사항, 제품 스펙, 프로덕트 스펙, 요구사항 문서, 목업, PoC
</TRIGGER>

<WORKFLOW>
1. Full ALPS: init_alps_document() or load_alps_document()
   Lite ALPS: init_lite_alps_document() or load_alps_document()
2. Full ALPS: get_alps_overview()
   Lite ALPS: get_lite_alps_overview()
   The matching overview MUST be called first to get the conversation guide.
3. Use atomic confirmation by default. Batch confirmation is allowed only when the user explicitly requests it or supplies a complete structured source covering multiple sections.
   Full ALPS order: 1, 2, 3, 4, 6, 5, 7, 8, 9.
   Lite ALPS order: 1, 2, 3, 4. Section 3 is optional.
   For Full ALPS, author Requirements (6) before Design (5), because Design reuses the Feature IDs defined in Section 6.1.
   For each section:
   a. Call the matching get_alps_section_guide(N) or get_lite_alps_section_guide(N)
   b. Call the matching get_alps_section(N) or get_lite_alps_section(N)
   c. Follow conversation guide from overview
   d. Present a concise plain-text approval digest and get explicit user confirmation
   e. save_alps_section(section, subsection_id, title, content) — one call per X.n subsection; Full ALPS Section 7 uses one call per Feature — only AFTER confirmation
   f. Move to the next section only after this one is confirmed
4. In batch mode, keep every section and dynamic Feature as a separately labeled
   approval unit and persist each with its own save_alps_section call. Never merge,
   skip, or infer a Feature.
5. export_alps_markdown() for final output
</WORKFLOW>

<RULES>
- MUST call the overview tool matching the selected document profile first
- NEVER proceed without user confirmation
- ALWAYS confirm progress at the SECTION level. Lite Section 3 is optional and may be skipped after stating that no explicit exclusions were provided.
- Approval digests MUST remain readable as raw text and include every contract-bearing value, rule, permission, state, transition, scope boundary, and success condition. Omit repeated explanation, examples, Markdown decoration, and implementation detail. Do not name omitted implementation details or add an exclusion list for them.
- Generalization means implementation independence, not vagueness. Preserve exact values, allowed states, mandatory inputs, permissions, ordering, uniqueness, units, transitions, and success conditions whenever the product must honor them.
- Never re-ask for information recoverable from the conversation, references, approved Sections, logical consequences, or an established safe default. Never silently infer protected product policy.
- NEVER save a requirement contract that was absent from the approval digest. Show the full pending content when the user requests it.
- Batch approval requires explicit opt-in or a complete structured source; each section and Feature remains a separate save unit.
- For Section 7, each Feature 7.x is one approval and save unit. Its 7.x.1-7.x.6 fields stay together.
- If a Section 7 Feature's comprehension load is 7/10 or higher, suggest up to three independently demonstrable user-behavior splits before approval. The suggestion never blocks approval or saving, and the user may keep the original Feature.
- Lite ALPS has four fixed Sections: Overview, Solution and User Flow, optional Out of Scope, and Demo Scenario.
- Start Lite Section 1 from one concrete hypothetical problem case. Ask who, in what situation, is trying to do what, and what problem they are assumed to face only when that case is not recoverable. Do not require an actual or recent experience or ask the user to enumerate persona candidates.
- Infer one Primary Persona from the case. Only when the user explicitly presents multiple candidate personas, ask them to anchor the case to exactly one before saving Section 1.
- Keep one confirmed Primary Persona throughout current Lite ALPS. Default to one Core User Flow with starting context, sequential actions, visible product responses, and observable completion.
- Section 1 has only Target User and Core Problem and Value and Core Hypothesis. Section 2 has only Solution Strategy and Core User Flow. Section 3 has one optional Explicit Exclusions list. Section 4 has one 4.1 Demo Scenario.
- Section 4 must be executable as an acceptance test with sequential actions, visible expected results, and one overall pass result. Do not add a separate Learning Check.
- Do not expand Golden Circle, Lean Startup, or Working Backwards into separate required documents, PR/FAQs, metric frameworks, assumption inventories, experiment plans, or method-specific questionnaires. Ask for more only when the first PoC cannot be built or evaluated without it.
- Do not silently select or combine explicitly presented persona candidates. Do not invent exclusions or require optional Section 3.
- Lite ALPS and Full ALPS are unrelated authoring and management processes. Never treat one as the next step, source, migration target, or status owner of the other.
</RULES>`,
  },
);

const tc = new TemplateController(new TemplateService());
const liteTc = new TemplateController(
  new TemplateService(LITE_ALPS_PROFILE),
  "get_lite_alps_section_guide",
);
const dc = new DocumentController(new DocumentService());

// Template tools
server.tool(
  "get_alps_overview",
  "Get the ALPS template overview with all section descriptions. IMPORTANT: After calling this, you MUST call get_alps_section_guide(1) to start the interactive Q&A process.",
  {},
  () => ({
    content: [{ type: "text", text: tc.getAlpsOverview() }],
  }),
);

server.tool("list_alps_sections", "List all available ALPS template sections.", {}, () => ({
  content: [{ type: "text", text: JSON.stringify(tc.listAlpsSections()) }],
}));

server.tool(
  "get_alps_section",
  "Get a specific ALPS template section by number.",
  {
    section: z
      .number()
      .min(FIRST_SECTION)
      .max(LAST_SECTION)
      .describe(`Section number (${SECTION_RANGE})`),
    include_examples: z.boolean().default(false).describe("Include example content"),
  },
  ({ section, include_examples }) => ({
    content: [{ type: "text", text: tc.getAlpsSection(section, include_examples) }],
  }),
);

server.tool(
  "get_alps_full_template",
  "Get the complete ALPS template with all sections combined.",
  { include_examples: z.boolean().default(false).describe("Include example content") },
  ({ include_examples }) => ({
    content: [{ type: "text", text: tc.getAlpsFullTemplate(include_examples) }],
  }),
);

server.tool(
  "get_alps_section_guide",
  "Get conversation guide for writing a specific ALPS section. Use this before starting each section.",
  {
    section: z
      .number()
      .min(FIRST_SECTION)
      .max(LAST_SECTION)
      .describe(`Section number (${SECTION_RANGE})`),
  },
  ({ section }) => ({
    content: [{ type: "text", text: tc.getAlpsSectionGuide(section) }],
  }),
);

server.tool(
  "get_lite_alps_overview",
  "Get the Lite ALPS overview for mockup and PoC authoring. Call this before writing any Lite ALPS section.",
  {},
  () => ({
    content: [{ type: "text", text: liteTc.getAlpsOverview() }],
  }),
);

server.tool(
  "list_lite_alps_sections",
  "List all available Lite ALPS template sections.",
  {},
  () => ({
    content: [{ type: "text", text: JSON.stringify(liteTc.listAlpsSections()) }],
  }),
);

server.tool(
  "get_lite_alps_section",
  "Get a specific Lite ALPS template section by number.",
  {
    section: z
      .number()
      .min(LITE_FIRST_SECTION)
      .max(LITE_LAST_SECTION)
      .describe(`Section number (${LITE_SECTION_RANGE})`),
    include_examples: z.boolean().default(false).describe("Include example content"),
  },
  ({ section, include_examples }) => ({
    content: [{ type: "text", text: liteTc.getAlpsSection(section, include_examples) }],
  }),
);

server.tool(
  "get_lite_alps_full_template",
  "Get the complete Lite ALPS template with all sections combined.",
  { include_examples: z.boolean().default(false).describe("Include example content") },
  ({ include_examples }) => ({
    content: [{ type: "text", text: liteTc.getAlpsFullTemplate(include_examples) }],
  }),
);

server.tool(
  "get_lite_alps_section_guide",
  "Get the conversation guide for a specific Lite ALPS section. Use this before starting each Lite section.",
  {
    section: z
      .number()
      .min(LITE_FIRST_SECTION)
      .max(LITE_LAST_SECTION)
      .describe(`Section number (${LITE_SECTION_RANGE})`),
  },
  ({ section }) => ({
    content: [{ type: "text", text: liteTc.getAlpsSectionGuide(section) }],
  }),
);

// Document tools
server.tool(
  "init_alps_document",
  "Initialize a new ALPS document file.",
  {
    project_name: z.string().min(1).describe("Name of the project"),
    output_path: z
      .string()
      .min(1)
      .describe("File path for the document (e.g., ~/Documents/my-project.alps.xml)"),
  },
  ({ project_name, output_path }) => ({
    content: [{ type: "text", text: dc.initAlpsDocument(project_name, output_path) }],
  }),
);

server.tool(
  "init_lite_alps_document",
  "Initialize a new four-section Lite ALPS document for minimum PoC and demo planning.",
  {
    project_name: z.string().min(1).describe("Name of the project"),
    output_path: z
      .string()
      .min(1)
      .describe("File path for the document (e.g., ~/Documents/my-project.lite.alps.xml)"),
  },
  ({ project_name, output_path }) => ({
    content: [{ type: "text", text: dc.initLiteAlpsDocument(project_name, output_path) }],
  }),
);

server.tool(
  "load_alps_document",
  `Load an existing ALPS or Lite ALPS document to resume editing. The document profile is detected automatically.
⚠️ CRITICAL: After loading, you MUST follow the conversation guide:
1. Call the matching get_alps_section_guide(N) or get_lite_alps_section_guide(N)
2. Infer the draft from the loaded document, conversation, references, prior Sections, and safe domain defaults
3. Ask only when material uncertainty remains; otherwise present the approval digest directly
4. Get explicit confirmation before saving each section`,
  {
    doc_path: z.string().min(1).describe("Path to the .alps.xml or .lite.alps.xml file"),
  },
  ({ doc_path }) => ({
    content: [{ type: "text", text: dc.loadAlpsDocument(doc_path) }],
  }),
);

server.tool(
  "save_alps_section",
  `Save content to a subsection in the ALPS document.
⚠️ BEFORE CALLING THIS TOOL:
1. Present a concise plain-text approval digest in the conversation
2. Include every requirement value and rule that the saved content will enforce
3. Ask the user to approve, revise, or defer it
4. Call this tool only after the user has confirmed`,
  {
    section: z
      .number()
      .min(FIRST_SECTION)
      .max(LAST_SECTION)
      .describe(`Section number (${SECTION_RANGE})`),
    subsection_id: z
      .string()
      .min(1)
      .describe(
        'Subsection ID — the part AFTER the section number. Pass "1" to store N.1, "1.2" to store N.1.2. Fixed sections must match the active document template. For Full ALPS Section 7, pass the positive feature number.',
      ),
    title: z
      .string()
      .min(1)
      .describe(
        "Title of the subsection. Fixed sections MUST equal the active template title. For a dynamic Feature section, use the approved feature name.",
      ),
    content: z.string().describe("Content for the subsection (markdown)"),
  },
  ({ section, subsection_id, title, content }) => ({
    content: [{ type: "text", text: dc.saveAlpsSection(section, subsection_id, title, content) }],
  }),
);

server.tool(
  "read_alps_section",
  "Read the current content of a section or subsection.",
  {
    section: z
      .number()
      .min(FIRST_SECTION)
      .max(LAST_SECTION)
      .describe(`Section number (${SECTION_RANGE})`),
    subsection_id: z
      .string()
      .optional()
      .describe('Subsection ID (e.g., "1" for X.1). If omitted, returns entire section.'),
  },
  ({ section, subsection_id }) => ({
    content: [{ type: "text", text: dc.readAlpsSection(section, subsection_id) }],
  }),
);

server.tool(
  "get_alps_document_status",
  "Get the status of all sections in the current document.",
  {},
  () => ({
    content: [{ type: "text", text: dc.getAlpsDocumentStatus() }],
  }),
);

server.tool(
  "export_alps_markdown",
  "Export the ALPS document as clean markdown.",
  {
    output_path: z
      .string()
      .optional()
      .describe("Optional output file path. If not provided, returns the content."),
  },
  ({ output_path }) => ({
    content: [{ type: "text", text: dc.exportAlpsMarkdown(output_path) }],
  }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
