# AGENTS.md

ALPS Writer — Interactive ALPS (PRD) writing tool based on MCP server. Published as `alps-writer-mcp` on npm.

**Tech Stack**: TypeScript 5.9+, Node.js >= 20, pnpm, MCP SDK (`@modelcontextprotocol/sdk`), Zod

## Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Compile TypeScript + copy templates & guides to dist/
pnpm dev              # Run with tsx in watch mode (development)
pnpm start            # Run built version (node dist/index.js)
```

Build runs `tsc && cp -r src/templates dist/ && cp -r src/guides dist/` to copy static assets (XML templates, MD guides) into `dist/`. Required because the server reads them at runtime via `fs.readFileSync`.

No test framework configured.

## Repository Structure

```
src/
├── index.ts              # MCP server entry point + tool registration
├── constants.ts          # Section titles, dependencies, file paths
├── tools/
│   ├── templates/        # Template tools (controller + service)
│   └── documents/        # Document tools (controller + service)
├── guides/               # Section conversation guides (01-09.md)
└── templates/            # ALPS templates (overview.md + chapters/*.xml)
```

## Architecture

**MCP Server** (`src/index.ts`) — Entry point. Creates `McpServer` instance, registers all tools with Zod schemas, connects via `StdioServerTransport`. Tool handlers are thin wrappers that delegate to controllers.

**Controller/Service pattern** — Separates domain-specific controllers (MCP interface) from services (business logic):

- `src/tools/templates/` — Read-only access to ALPS templates and conversation guides
- `src/tools/documents/` — Document CRUD (init, load, save, read, export) with state management

**Constants** (`src/constants.ts`) — Centralized section metadata: titles (1-9), dependency graph (`SECTION_REFERENCES`), `__dirname`-based filesystem paths.

**Static assets** (read from filesystem at runtime):

- `src/templates/chapters/01-09.xml` — XML section templates
- `src/templates/overview.md` — ALPS overview
- `src/guides/01-09.md` — Per-section conversation guides

**Document format** — Stored as `.alps.xml` files with `<alps-document>`, `<section>`, `<subsection>` tags. Parsed via regex (no XML parser library). Output directory controlled by `ALPS_OUTPUT_DIR` env var (`PRD_OUTPUT_DIR` also supported for backward compatibility).

**DocumentService state** — `workingDoc` holds the current document path in memory. Read/write operations require `initDocument()` or `loadDocument()` to be called first.

## Conventions

- TypeScript strict mode, ES modules (`"type": "module"`)
- Node.js >= 20
- pnpm as package manager
- Conventional Commits (details: CONTRIBUTING.md)
- Scopes: `server`, `templates`, `documents`, `guides`, `deps`
- Branch naming: `<type>/<short-description>` (e.g., `feat/section-validation`)

## Definition of Done

Verify before completing any task:

1. `pnpm build` succeeds
2. `pnpm lint` passes
3. `pnpm format:check` passes
4. Related docs (README, AGENTS.md, CONTRIBUTING.md) are up to date

## Do-Not Rules

- Do not introduce XML parser libraries — maintain current regex-based parsing
- Do not auto-generate content in `src/templates/` or `src/guides/` — manually curated
- Do not modify `dist/` directly — always generate via `pnpm build`
- Do not bypass git hooks with `--no-verify`
- Do not delete or modify tests to make them pass — fix the code instead

## References

- [CONTRIBUTING.md](./CONTRIBUTING.md) — Commit messages, branching, code style, PR rules
