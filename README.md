# ALPS Writer

[![npm version](https://img.shields.io/npm/v/alps-writer.svg)](https://www.npmjs.com/package/alps-writer)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that helps you write ALPS (PRD) interactively with AI. Guides you through 9 structured sections with templates, conversation guides, and document management.

## Features

- 9-section ALPS (PRD) template with structured XML templates and conversation guides
- Interactive Q&A workflow — AI asks focused questions, never auto-generates
- Document management — create, save, load, and export as clean Markdown
- Section dependency tracking — ensures referenced sections are reviewed first
- Works with Claude Desktop, Claude Code, Cursor, Kiro, and any MCP-compatible client

## Quick Start

No installation required — just add the MCP config to your client:

```json
{
  "mcpServers": {
    "alps-writer": {
      "command": "npx",
      "args": ["-y", "alps-writer"]
    }
  }
}
```

### Client Setup

| Client             | Config location                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| **Claude Desktop** | Settings > Developer > Edit Config (`claude_desktop_config.json`)                                      |
| **Claude Code**    | `claude mcp add alps-writer -- npx -y alps-writer`                                                     |
| **Cursor**         | Settings > Features > MCP Servers > + Add new global MCP server                                        |
| **Kiro**           | `Cmd+Shift+P` > "Kiro: Open user MCP config (JSON)" (`~/.kiro/settings/mcp.json`)                     |
| **Kiro CLI**       | `kiro-cli mcp add --name alps-writer --command npx --args "-y" --args "alps-writer" --scope global`    |

### Environment Variables

| Variable          | Description                                                   | Default                   |
| ----------------- | ------------------------------------------------------------- | ------------------------- |
| `ALPS_OUTPUT_DIR` | Directory for document files (`.alps.xml`, exported markdown) | Current working directory |

Config example with `ALPS_OUTPUT_DIR`:

```json
{
  "mcpServers": {
    "alps-writer": {
      "command": "npx",
      "args": ["-y", "alps-writer"],
      "env": {
        "ALPS_OUTPUT_DIR": "~/Documents/alps"
      }
    }
  }
}
```

## Available Tools

### Template Tools

| Tool                     | Description                                            |
| ------------------------ | ------------------------------------------------------ |
| `get_alps_overview`      | Get the ALPS template overview with conversation guide |
| `list_alps_sections`     | List all available template sections                   |
| `get_alps_section`       | Get a specific template section by number (1-9)        |
| `get_alps_full_template` | Get the complete template with all sections            |
| `get_alps_section_guide` | Get conversation guide for writing a section           |

### Document Management Tools

| Tool                       | Description                                 |
| -------------------------- | ------------------------------------------- |
| `init_alps_document`       | Create a new ALPS document (`.alps.xml`)    |
| `load_alps_document`       | Load an existing document to resume editing |
| `save_alps_section`        | Save content to a specific subsection       |
| `read_alps_section`        | Read current content of a section           |
| `get_alps_document_status` | Get status of all sections                  |
| `export_alps_markdown`     | Export as clean Markdown                    |

## Workflow

The server guides AI through a structured workflow:

1. **Initialize** — `init_alps_document()` or `load_alps_document()`
2. **Overview** — `get_alps_overview()` to get the conversation guide
3. **For each section (1-9):**
   - `get_alps_section_guide(N)` — get questions and criteria
   - `get_alps_section(N)` — get the template structure
   - Ask focused questions (1-2 at a time)
   - `save_alps_section(N, ...)` — save after user confirmation
4. **Export** — `export_alps_markdown()` for the final document

## ALPS Sections

| #   | Section                     | Dependencies |
| --- | --------------------------- | ------------ |
| 1   | Overview                    | —            |
| 2   | MVP Goals and Key Metrics   | —            |
| 3   | Demo Scenario               | Section 2    |
| 4   | High-Level Architecture     | —            |
| 5   | Design Specification        | Section 6    |
| 6   | Requirements Summary        | —            |
| 7   | Feature-Level Specification | Section 6    |
| 8   | MVP Metrics                 | Section 2, 6 |
| 9   | Out of Scope                | —            |

## Development

### Running from Source

```bash
git clone https://github.com/haandol/alps-writer-mcp.git
cd alps-writer-mcp
pnpm install
pnpm build
```

Then configure your MCP client:

```json
{
  "mcpServers": {
    "alps-writer": {
      "command": "node",
      "args": ["/path/to/alps-writer-mcp/dist/index.js"]
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

MIT
