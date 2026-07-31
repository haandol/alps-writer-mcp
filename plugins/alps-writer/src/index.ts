#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { TemplateService } from "./tools/templates/service.js";
import { TemplateController } from "./tools/templates/controller.js";
import { DocumentService } from "./tools/documents/service.js";
import { DocumentController } from "./tools/documents/controller.js";

const server = new McpServer(
  // Keep in lockstep with every manifest version (package.json, the two
  // plugin.json files, marketplace.json). tests/version-consistency.test.ts
  // fails the build when they drift — this literal silently reported 0.4.20
  // to MCP clients for two releases after a manifest-only version bump.
  { name: "alps-writer", version: "0.5.2" },
  {
    instructions: `You are an intelligent product owner helping users create ALPS (PRD) documents.

ALPS defines each feature as a vertical slice — a single feature that cuts through all layers (UI → API → Data) end-to-end, so it can be developed, tested, and delivered independently. When writing feature specs (Section 7), always describe each user action as a vertical slice tracing from UI to API to data store, enabling parallel implementation across features.

<TRIGGER>
MUST use this server's tools when the user wants to:
- Write, create, or edit a PRD (Product Requirements Document)
- Write a product specification or product spec
- Create an ALPS (Agentic Lean Product Spec) document
- Draft product requirements, feature specs, or product plans
Keywords: PRD, ALPS, 기획서, 기획 문서, 제품 요구사항, 제품 스펙, 프로덕트 스펙, 요구사항 문서
</TRIGGER>

<WORKFLOW>
1. init_alps_document() or load_alps_document()
2. get_alps_overview() - MUST call first to get conversation guide
3. Author the sections ONE at a time in this dependency-respecting order: 1, 2, 3, 4, 6, 5, 7, 8, 9.
   (Section numbering is unchanged — Section 5 is Design, Section 6 is Requirements. Only the questioning order differs: author Requirements (6) before Design (5), because Design reuses the Feature IDs defined in Section 6.1.)
   For each section:
   a. get_alps_section_guide(N)
   b. get_alps_section(N)
   c. Follow conversation guide from overview
   d. Print the completed section and get explicit user confirmation
   e. save_alps_section(section, subsection_id, title, content) — all four arguments; subsection_id and title MUST match the section's XML template — only AFTER confirmation
   f. Move to the next section only after this one is confirmed
4. Section 7 (Feature-Level Specification) is the exception that needs EXTRA care:
   each Feature subsection (7.1, 7.2, ...) is confirmed and saved INDIVIDUALLY.
   Never present, confirm, or save multiple Features in one batch — walk through
   every 7.x one by one, even when they look small or similar.
5. export_alps_markdown() for final output
</WORKFLOW>

<RULES>
- MUST call get_alps_overview() first to get detailed conversation guide
- NEVER generate multiple sections at once
- NEVER proceed without user confirmation
- ALWAYS confirm progress at the SECTION level — do not skip a section without the user seeing and approving it
- For Section 7, confirm EVERY Feature subsection (7.x) individually. Do not skim past Features in bulk; each one is a separate confirmation step.
</RULES>`,
  },
);

const tc = new TemplateController(new TemplateService());
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
    section: z.number().min(1).max(9).describe("Section number (1-9)"),
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
  { section: z.number().min(1).max(9).describe("Section number (1-9)") },
  ({ section }) => ({
    content: [{ type: "text", text: tc.getAlpsSectionGuide(section) }],
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
  "load_alps_document",
  `Load an existing ALPS document to resume editing.
⚠️ CRITICAL: After loading, you MUST follow the conversation guide:
1. Call get_alps_section_guide(N) for the section you want to work on
2. Ask 1-2 focused questions at a time - DO NOT auto-generate content
3. Wait for user response before proceeding
4. Get explicit confirmation before saving each section`,
  { doc_path: z.string().min(1).describe("Path to the .alps.xml file") },
  ({ doc_path }) => ({
    content: [{ type: "text", text: dc.loadAlpsDocument(doc_path) }],
  }),
);

server.tool(
  "save_alps_section",
  `Save content to a subsection in the ALPS document.
⚠️ BEFORE CALLING THIS TOOL:
1. Print the completed content to the user first
2. Ask them to confirm it ("Is there anything you want to change?")
3. Call this tool only after the user has confirmed`,
  {
    section: z.number().min(1).max(9).describe("Section number (1-9)"),
    subsection_id: z
      .string()
      .min(1)
      .describe(
        'Subsection ID — the part AFTER the section number. Pass "1" to store N.1, "1.2" to store N.1.2. For Sections 1-6 and 8-9 it must match the XML template. For dynamic Section 7, pass the positive feature number ("1" for 7.1).',
      ),
    title: z
      .string()
      .min(1)
      .describe(
        "Title of the subsection. For Sections 1-6 and 8-9 it MUST equal the matching XML template title. For Section 7, use the approved feature name.",
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
    section: z.number().min(1).max(9).describe("Section number (1-9)"),
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
