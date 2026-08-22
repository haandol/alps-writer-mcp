# Using the alps-writer MCP server in other clients

Inside Codex or Claude Code, installing the alps-writer plugin wires up the MCP server automatically — nothing to configure. To use the same server in another MCP client (Claude Desktop, Cursor, Kiro, …), point it at the bundled `dist/index.js`. Build it once from source:

```bash
git clone https://github.com/haandol/alps-writer-plugins.git
cd alps-writer-plugins
pnpm install && pnpm build      # produces plugins/alps-writer/dist/index.js
```

Then register the absolute path:

```json
{
  "mcpServers": {
    "alps-writer": {
      "command": "node",
      "args": ["/path/to/alps-writer-plugins/plugins/alps-writer/dist/index.js"]
    }
  }
}
```

The bundle inlines its dependencies, so it runs with a plain Node.js >= 24 — no `npm install` in the target location.

## Environment variables

| Variable           | Scope           | Description                                                                                                               | Default                  |
| ------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `ALPS_OUTPUT_DIR`  | alps-writer MCP | Directory for document files (`.alps.xml`, `.lite.alps.xml`, exported markdown). `PRD_OUTPUT_DIR` also accepted (legacy). | `<cwd>/prd/`             |
| `ALPS_ADR_MAPPING` | adr-writer hook | Path (relative to project root) to the ADR mapping file read by the ADR-first hook.                                       | `docs/adr/.mapping.json` |

Config example with `ALPS_OUTPUT_DIR`:

```json
{
  "mcpServers": {
    "alps-writer": {
      "command": "node",
      "args": ["/path/to/alps-writer-plugins/plugins/alps-writer/dist/index.js"],
      "env": {
        "ALPS_OUTPUT_DIR": "~/Documents/alps"
      }
    }
  }
}
```

## MCP tools

### Full ALPS template tools

| Tool                     | Description                                            |
| ------------------------ | ------------------------------------------------------ |
| `get_alps_overview`      | Get the ALPS template overview with conversation guide |
| `list_alps_sections`     | List all available template sections                   |
| `get_alps_section`       | Get a specific template section by number (1–9)        |
| `get_alps_full_template` | Get the complete template with all sections            |
| `get_alps_section_guide` | Get the conversation guide for writing a section       |

### Lite ALPS template tools

| Tool                          | Description                                                |
| ----------------------------- | ---------------------------------------------------------- |
| `get_lite_alps_overview`      | Get the current 4-section Lite ALPS overview and rules     |
| `list_lite_alps_sections`     | List the Lite ALPS template sections                       |
| `get_lite_alps_section`       | Get a current Lite ALPS template section by number (1–4)   |
| `get_lite_alps_full_template` | Get the complete Lite ALPS template                        |
| `get_lite_alps_section_guide` | Get the conversation guide for writing a Lite ALPS section |

### Legacy Lite ALPS template tools

These tools are used only after `load_alps_document` detects an existing legacy eight-section Lite
document. New documents never use them.

| Tool                                 | Description                                            |
| ------------------------------------ | ------------------------------------------------------ |
| `get_legacy_lite_alps_overview`      | Get the legacy 8-section Lite overview                 |
| `list_legacy_lite_alps_sections`     | List legacy Lite template sections                     |
| `get_legacy_lite_alps_section`       | Get a legacy Lite section by number (1–8)              |
| `get_legacy_lite_alps_full_template` | Get the complete legacy Lite template                  |
| `get_legacy_lite_alps_section_guide` | Get the guide for writing a loaded legacy Lite section |

### Document management tools

| Tool                       | Description                                                    |
| -------------------------- | -------------------------------------------------------------- |
| `init_alps_document`       | Create a new Full ALPS document (`.alps.xml`)                  |
| `init_lite_alps_document`  | Create a new Lite ALPS document (`.lite.alps.xml`)             |
| `load_alps_document`       | Load either document type and detect its profile automatically |
| `save_alps_section`        | Save content using the active document's template              |
| `read_alps_section`        | Read the current content of a section                          |
| `get_alps_document_status` | Get the status of all sections in the active document          |
| `export_alps_markdown`     | Export the active document as clean Markdown                   |

Document writes are guarded:

- Full documents use `.alps.xml`; Lite documents use `.lite.alps.xml` and declare the Lite profile in the root. A failed `init` or `load` leaves no document selected.
- Existing files are never selected implicitly by either initialization tool; resume them explicitly with `load_alps_document`.
- Full ALPS resumes in dependency order `1 → 2 → 3 → 4 → 6 → 5 → 7 → 8 → 9`. Current Lite ALPS resumes in `1 → 2 → 3 → 4`, with Section 4 optional. Legacy Lite keeps its original authoring order.
- Static subsection IDs and titles are validated against the active XML templates. Full Section 7 and legacy Lite Section 4 accept one dynamic entry per approved Feature.
- Markdown content is XML-escaped on disk and decoded when read or exported. Saves use an atomic replacement so interrupted writes do not leave a partially written document.
- Section status is based on required template subsection coverage, not content length. Current Lite Section 4 reports optional and may remain unwritten.
- Existing eight-section Lite files are detected as legacy and keep their original guides, validation, and export; they are never converted automatically.
- Lite templates never request architecture, technology stack, API, database, deployment, library, or code-structure decisions.
- Lite and Full ALPS have separate authoring and management state. Loading, completing, or exporting one never reads or changes the other.
