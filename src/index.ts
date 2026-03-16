#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { TemplateService } from "./tools/templates/service.js";
import { TemplateController } from "./tools/templates/controller.js";
import { DocumentService } from "./tools/documents/service.js";
import { DocumentController } from "./tools/documents/controller.js";

const server = new McpServer(
  { name: "prd-writer", version: "0.1.0" },
  {
    instructions: `You are an intelligent product owner helping users create PRD documents.

<WORKFLOW>
1. init_prd_document() or load_prd_document()
2. get_prd_overview() - MUST call first to get conversation guide
3. For each section 1-9:
   a. get_prd_section_guide(N)
   b. get_prd_section(N)
   c. Follow conversation guide from overview
   d. save_prd_section(N, content) after user confirmation
5. export_prd_markdown() for final output
</WORKFLOW>

<RULES>
- MUST call get_prd_overview() first to get detailed conversation guide
- NEVER generate multiple sections at once
- NEVER proceed without user confirmation
</RULES>`,
  },
);

const tc = new TemplateController(new TemplateService());
const dc = new DocumentController(new DocumentService());

// Template tools
server.tool(
  "get_prd_overview",
  "Get the PRD template overview with all section descriptions. IMPORTANT: After calling this, you MUST call get_prd_section_guide(1) to start the interactive Q&A process.",
  {},
  () => ({
    content: [{ type: "text", text: tc.getPrdOverview() }],
  }),
);

server.tool("list_prd_sections", "List all available PRD template sections.", {}, () => ({
  content: [{ type: "text", text: JSON.stringify(tc.listPrdSections()) }],
}));

server.tool(
  "get_prd_section",
  "Get a specific PRD template section by number.",
  {
    section: z.number().min(1).max(9).describe("Section number (1-9)"),
    include_examples: z.boolean().default(false).describe("Include example content"),
  },
  ({ section, include_examples }) => ({
    content: [{ type: "text", text: tc.getPrdSection(section, include_examples) }],
  }),
);

server.tool(
  "get_prd_full_template",
  "Get the complete PRD template with all sections combined.",
  { include_examples: z.boolean().default(false).describe("Include example content") },
  ({ include_examples }) => ({
    content: [{ type: "text", text: tc.getPrdFullTemplate(include_examples) }],
  }),
);

server.tool(
  "get_prd_section_guide",
  "Get conversation guide for writing a specific PRD section. Use this before starting each section.",
  { section: z.number().min(1).max(9).describe("Section number (1-9)") },
  ({ section }) => ({
    content: [{ type: "text", text: tc.getPrdSectionGuide(section) }],
  }),
);

// Document tools
server.tool(
  "init_prd_document",
  "Initialize a new PRD document file.",
  {
    project_name: z.string().describe("Name of the project"),
    output_path: z
      .string()
      .describe("File path for the document (e.g., ~/Documents/my-project.prd.xml)"),
  },
  ({ project_name, output_path }) => ({
    content: [{ type: "text", text: dc.initPrdDocument(project_name, output_path) }],
  }),
);

server.tool(
  "load_prd_document",
  `Load an existing PRD document to resume editing.
⚠️ CRITICAL: After loading, you MUST follow the conversation guide:
1. Call get_prd_section_guide(N) for the section you want to work on
2. Ask 1-2 focused questions at a time - DO NOT auto-generate content
3. Wait for user response before proceeding
4. Get explicit confirmation before saving each section`,
  { doc_path: z.string().describe("Path to the .prd.xml file") },
  ({ doc_path }) => ({
    content: [{ type: "text", text: dc.loadPrdDocument(doc_path) }],
  }),
);

server.tool(
  "save_prd_section",
  `Save content to a subsection in the PRD document.
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
    content: [{ type: "text", text: dc.savePrdSection(section, subsection_id, title, content) }],
  }),
);

server.tool(
  "read_prd_section",
  "Read the current content of a section or subsection.",
  {
    section: z.number().min(1).max(9).describe("Section number (1-9)"),
    subsection_id: z
      .string()
      .optional()
      .describe('Subsection ID (e.g., "1" for X.1). If omitted, returns entire section.'),
  },
  ({ section, subsection_id }) => ({
    content: [{ type: "text", text: dc.readPrdSection(section, subsection_id) }],
  }),
);

server.tool(
  "get_prd_document_status",
  "Get the status of all sections in the current document.",
  {},
  () => ({
    content: [{ type: "text", text: dc.getPrdDocumentStatus() }],
  }),
);

server.tool(
  "export_prd_markdown",
  "Export the PRD document as clean markdown.",
  {
    output_path: z
      .string()
      .optional()
      .describe("Optional output file path. If not provided, returns the content."),
  },
  ({ output_path }) => ({
    content: [{ type: "text", text: dc.exportPrdMarkdown(output_path) }],
  }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
