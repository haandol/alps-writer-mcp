# AGENTS.md

`alps-writer-plugins` — a Claude Code marketplace shipping two independent plugins: **alps-writer** (ALPS/PRD authoring via an MCP server) and **adr-writer** (ADR-driven development cycle). Both install from the marketplace alone — no npm. The alps-writer MCP server is bundled with esbuild (dependencies inlined) and the bundle is committed at `plugins/alps-writer/dist/`, so the plugin runs straight from a marketplace install.

**Tech Stack**: TypeScript 5.9+, Node.js >= 20, pnpm workspace, MCP SDK (`@modelcontextprotocol/sdk`), Zod

## Commands

Root is a private pnpm workspace; the MCP server package lives in `plugins/alps-writer/`. Root scripts proxy to it.

```bash
pnpm install          # Install dependencies (whole workspace)
pnpm build            # Bundle the alps-writer MCP server (pnpm --filter alps-writer build)
pnpm lint             # ESLint the MCP server
pnpm format           # Prettier across the repo

pnpm --filter alps-writer dev     # Run MCP server with tsx in watch mode
pnpm --filter alps-writer start   # Run built bundle (node dist/index.js)
```

Build (inside `plugins/alps-writer/`) runs `tsc --noEmit` (typecheck), then esbuild bundles `src/index.ts` → `dist/index.js` with deps inlined (ESM, node20 target), then copies static assets `cp -r src/templates dist/ && cp -r src/guides dist/`. The asset copy is required because the server reads XML templates / MD guides at runtime via `fs.readFileSync` (`import.meta.url`-relative). **`dist/` is committed** — regenerate and commit it whenever `src/` changes.

No test framework configured.

## Repository Structure

```
.claude-plugin/
└── marketplace.json      # Marketplace manifest — registers both plugins
package.json              # Private workspace root (prettier/husky/lint-staged)
pnpm-workspace.yaml       # packages: plugins/alps-writer

plugins/alps-writer/      # PRD plugin (bundles + commits its own MCP server)
├── .claude-plugin/plugin.json   # mcpServers only (node dist/index.js); skills/ (alps-init, feature-to-adr) are auto-discovered
├── package.json          # private; build tooling for the bundle
├── tsconfig.json, eslint.config.mjs
├── src/
│   ├── index.ts          # MCP server entry point + tool registration
│   ├── constants.ts      # Section titles, dependencies, file paths
│   ├── tools/
│   │   ├── templates/    # Template tools (controller + service)
│   │   └── documents/    # Document tools (controller + service)
│   ├── guides/           # Section conversation guides (01-09.md)
│   └── templates/        # ALPS templates (overview.md + chapters/*.xml)
├── dist/                 # committed esbuild bundle (index.js + copied assets)
├── skills/               # alps-init, feature-to-adr
└── templates/alps/       # about-alps.md

plugins/adr-writer/       # ADR plugin (standalone, ALPS-agnostic)
├── .claude-plugin/plugin.json   # hooks registration (no MCP)
├── README.md
├── skills/               # adr-new, adr-impl, adr-sync, adr-rollup
├── agents/               # adr-reviewer subagent
├── hooks/
│   ├── hooks.json        # UserPromptSubmit registration
│   └── surface-adr-context.mjs  # UserPromptSubmit — inject ADR-first directive + mapping snapshot
└── templates/adr/
    ├── README.md         # ADR writing rules (copied into docs/adr/ on /adr-new)
    ├── authoring-rules.md, structure.md
    └── mapping.schema.json   # Schema for docs/adr/.mapping.json
```

The two plugins are split so adr-writer never references ALPS. The only coupling is one-way: alps-writer's `/feature-to-adr` delegates per-feature ADR authoring to adr-writer's `/adr-new`.

ADR folders are organized along two axes — a DDD **bounded context** (top-level folder / first key segment) containing one or more **features** (vertical slices, the second segment). A single-feature context stays flat (`auth/`, workshop `f1/`), so existing flat repos need no migration. The ADR index lives in `docs/adr/.mapping.json` itself (path/status/summary per ADR), rendered by the hook every turn; the README keeps no separate ADR list. The mapping carries an optional advisory `subdomainType` (core/supporting/generic) per context and stores no PRD reference. Context grouping is only applied when ALPS already groups features or the user asks for it — `/feature-to-adr` never invents a domain boundary the PRD doesn't assert, so the one-way alps-writer → adr-writer coupling and "adr-writer never references ALPS" both hold. The DDD overlay is metadata + framing only; it adds no folder depth (keys stay ≤2 segments) and `scripts/adr-invariants.sh` is unaffected.

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

## Plugin distribution

The repo root is a Claude Code **marketplace** (`.claude-plugin/marketplace.json`) registering two plugins by `source`: `./plugins/alps-writer` and `./plugins/adr-writer`. Each plugin has its own `.claude-plugin/plugin.json`. Slash commands are packaged as skills — `commands/*.md` and `skills/<name>/SKILL.md` produce the same `/<name>` invocation per the Claude Code spec. Within each plugin, `${CLAUDE_PLUGIN_ROOT}` resolves to that plugin's directory, so intra-plugin path references stay valid after the split.

```
/plugin marketplace add haandol/alps-writer-plugins
/plugin install alps-writer@alps-writer   # PRD plugin (MCP server + skills)
/plugin install adr-writer@alps-writer    # ADR plugin (skills + hooks)
```

- **alps-writer** runs its MCP server from the committed bundle (`command: node`, `args: ["${CLAUDE_PLUGIN_ROOT}/dist/index.js"]`) plus its local `skills/`. No hooks, no npm/npx.
- **adr-writer** ships local `skills/`, `agents/`, `hooks/`, and `templates/adr/`. No MCP.

The hook script (in adr-writer) is Node ESM (`.mjs`) and reads NDJSON events from stdin per the Claude Code hooks spec. It uses only Node built-ins (no extra deps), so the plugin requires nothing beyond a Node.js >= 20 runtime.

### Cycle hooks layout (adr-writer)

| File                            | Event              | Purpose                                                                                        |
| ------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| `hooks/surface-adr-context.mjs` | `UserPromptSubmit` | Inject the ADR-first directive + current `docs/adr/.mapping.json` snapshot on every user turn. |

The cycle relies on the **main session model** for text understanding — the hook calls no auxiliary LLM and uses no intent regex. It supplies structured context; classification (and keeping the PRD → ADR → code flow intact) stays with the main model. There is deliberately no `PreToolUse` enforcement hook: the ADR ↔ code link is not stored, so a non-LLM hook can't map an edited file back to an ADR — that judgment belongs to the model.

The directive is re-injected every turn (UserPromptSubmit) instead of once at SessionStart so it survives Claude Code's session compaction — a one-shot SessionStart injection vanishes after the first compaction, while per-turn injection stays present for the whole session.

## Conventions

- TypeScript strict mode, ES modules (`"type": "module"`)
- Node.js >= 20
- pnpm as package manager
- Conventional Commits (details: CONTRIBUTING.md)
- Scopes: `server`, `templates`, `documents`, `guides`, `adr`, `plugin`, `deps`
- Branch naming: `<type>/<short-description>` (e.g., `feat/section-validation`)
- **Diagrams**: always Mermaid (`flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `erDiagram`). Do not author ASCII/box-drawing diagrams unless the user explicitly asks for one. Applies to README, AGENTS, ADR templates, command/skill prose, and anything this plugin generates inside user projects. Directory trees (`tree`-style with `├── └──`) are exempt — they are listings, not diagrams.

## Definition of Done

Verify before completing any task:

1. `pnpm build` succeeds
2. `pnpm lint` passes
3. `pnpm format:check` passes
4. If `src/` changed: the regenerated `plugins/alps-writer/dist/` is committed alongside it
5. Related docs (README, AGENTS.md, CONTRIBUTING.md) are up to date

## Do-Not Rules

- Do not introduce XML parser libraries — maintain current regex-based parsing
- Do not auto-generate content in `src/templates/` or `src/guides/` — manually curated
- Do not modify `dist/` directly — always generate via `pnpm build`
- Do not bypass git hooks with `--no-verify`
- Do not delete or modify tests to make them pass — fix the code instead

## References

- [CONTRIBUTING.md](./CONTRIBUTING.md) — Commit messages, branching, code style, PR rules
