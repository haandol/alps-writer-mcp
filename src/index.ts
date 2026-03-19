#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { TemplateService } from "./tools/templates/service.js";
import { TemplateController } from "./tools/templates/controller.js";
import { DocumentService } from "./tools/documents/service.js";
import { DocumentController } from "./tools/documents/controller.js";

const server = new McpServer(
  { name: "alps-writer", version: "0.1.1" },
  {
    instructions: `You are an intelligent product owner helping users create ALPS (PRD) documents.

<WORKFLOW>
1. init_alps_document() or load_alps_document()
2. get_alps_overview() - MUST call first to get conversation guide
3. For each section 1-9:
   a. get_alps_section_guide(N)
   b. get_alps_section(N)
   c. Follow conversation guide from overview
   d. save_alps_section(N, content) after user confirmation
5. export_alps_markdown() for final output
</WORKFLOW>

<RULES>
- MUST call get_alps_overview() first to get detailed conversation guide
- NEVER generate multiple sections at once
- NEVER proceed without user confirmation
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
    project_name: z.string().describe("Name of the project"),
    output_path: z
      .string()
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
  { doc_path: z.string().describe("Path to the .alps.xml file") },
  ({ doc_path }) => ({
    content: [{ type: "text", text: dc.loadAlpsDocument(doc_path) }],
  }),
);

server.tool(
  "save_alps_section",
  `Save content to a subsection in the ALPS document.
⚠️ BEFORE CALLING THIS TOOL:
1. 작성 완료된 내용을 사용자에게 먼저 출력하세요
2. "수정할 내용이 있으신가요?" 라고 확인을 요청하세요
3. 사용자가 확인한 후에만 이 도구를 호출하세요`,
  {
    section: z.number().min(1).max(9).describe("Section number (1-9)"),
    subsection_id: z.string().describe('Subsection ID (e.g., "1" for X.1, "1.2" for X.1.2)'),
    title: z.string().describe("Title of the subsection"),
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
