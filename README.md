# PRD Writer MCP Server

[![npm version](https://img.shields.io/npm/v/prd-writer-mcp.svg)](https://www.npmjs.com/package/prd-writer-mcp)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that helps you write PRD (Product Requirements Document) interactively with AI. Guides you through 9 structured sections with templates, conversation guides, and document management.

## Features

- 9-section PRD template with structured XML templates and conversation guides
- Interactive Q&A workflow — AI asks focused questions, never auto-generates
- Document management — create, save, load, and export as clean Markdown
- Section dependency tracking — ensures referenced sections are reviewed first
- Works with Claude Desktop, Claude Code, Cursor, Kiro, and any MCP-compatible client

## Quick Start

No installation required — just add the MCP config to your client:

```json
{
  "mcpServers": {
    "prd-writer": {
      "command": "npx",
      "args": ["-y", "prd-writer-mcp"]
    }
  }
}
```

### Client Setup

| Client | Config location |
| --- | --- |
| **Claude Desktop** | Settings > Developer > Edit Config (`claude_desktop_config.json`) |
| **Claude Code** | `claude mcp add prd-writer -- npx -y prd-writer-mcp` |
| **Cursor** | Settings > Features > MCP Servers > + Add new global MCP server |
| **Kiro** | `Cmd+Shift+P` > "Kiro: Open user MCP config (JSON)" (`~/.kiro/settings/mcp.json`) |

### Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `PRD_OUTPUT_DIR` | Directory for document files (`.prd.xml`, exported markdown) | Current working directory |

Config example with `PRD_OUTPUT_DIR`:

```json
{
  "mcpServers": {
    "prd-writer": {
      "command": "npx",
      "args": ["-y", "prd-writer-mcp"],
      "env": {
        "PRD_OUTPUT_DIR": "~/Documents/prd"
      }
    }
  }
}
```

## Available Tools

### Template Tools

| Tool | Description |
| --- | --- |
| `get_prd_overview` | Get the PRD template overview with conversation guide |
| `list_prd_sections` | List all available template sections |
| `get_prd_section` | Get a specific template section by number (1-9) |
| `get_prd_full_template` | Get the complete template with all sections |
| `get_prd_section_guide` | Get conversation guide for writing a section |

### Document Management Tools

| Tool | Description |
| --- | --- |
| `init_prd_document` | Create a new PRD document (`.prd.xml`) |
| `load_prd_document` | Load an existing document to resume editing |
| `save_prd_section` | Save content to a specific subsection |
| `read_prd_section` | Read current content of a section |
| `get_prd_document_status` | Get status of all sections |
| `export_prd_markdown` | Export as clean Markdown |

## Workflow

The server guides AI through a structured workflow:

1. **Initialize** — `init_prd_document()` or `load_prd_document()`
2. **Overview** — `get_prd_overview()` to get the conversation guide
3. **For each section (1-9):**
   - `get_prd_section_guide(N)` — get questions and criteria
   - `get_prd_section(N)` — get the template structure
   - Ask focused questions (1-2 at a time)
   - `save_prd_section(N, ...)` — save after user confirmation
4. **Export** — `export_prd_markdown()` for the final document

## PRD Sections

| # | Section | Dependencies |
| --- | --- | --- |
| 1 | Overview | — |
| 2 | MVP Goals and Key Metrics | — |
| 3 | Demo Scenario | Section 2 |
| 4 | High-Level Architecture | — |
| 5 | Design Specification | Section 6 |
| 6 | Requirements Summary | — |
| 7 | Feature-Level Specification | Section 6 |
| 8 | MVP Metrics | Section 2, 6 |
| 9 | Out of Scope | — |

## Development

### Running from Source

```bash
git clone https://github.com/haandol/prd-writer.git
cd prd-writer
pnpm install
pnpm build
```

Then configure your MCP client:

```json
{
  "mcpServers": {
    "prd-writer": {
      "command": "node",
      "args": ["/path/to/prd-writer/dist/index.js"]
    }
  }
}
```

### Commands

```bash
pnpm install    # Install dependencies
pnpm dev        # Run with tsx (watch mode)
pnpm build      # Build for production
pnpm start      # Run built version
```

## License

Apache-2.0
