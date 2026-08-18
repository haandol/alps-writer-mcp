# ALPS Writer Plugins

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A Codex and Claude Code **marketplace** that ships two independent plugins for spec-driven development: **alps-writer** (PRD authoring) and **adr-writer** (ADR-driven cycle). Both install from the marketplace alone — **no npm, no npx, no build step** for end users. The alps-writer MCP server is bundled (dependencies inlined) and committed at `plugins/alps-writer/dist/`.

| Plugin                  | Scope                                                                                                                            | Depends on                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **`alps-writer`** (PRD) | Write ALPS (PRD) documents conversationally via a bundled MCP server. Bridges Section 7 features to ADRs with `/feature-to-adr`. | adr-writer (only for the bridge) |
| **`adr-writer`** (ADR)  | ADR-driven development: author, implement, adversarially review, and sync; an ADR-first hook runs when session context starts.   | nothing — fully standalone       |

The two are split so that **adr-writer never references ALPS**. The only coupling is one-way (`alps-writer → adr-writer`): `/feature-to-adr` transfers each implementable Feature's complete contract into one or several ADRs. After handoff the PRD remains a legacy planning document; explicit re-import compares it with authoritative ADRs and applies only approved semantic changes.

## What is ALPS?

**ALPS** (Agentic Lean Product Spec) is a PRD format built for agentic development. A traditional PRD assumes a human reader who fills in gaps from intuition; ALPS assumes an AI agent that needs an unambiguous specification to write reliable code.

It fixes the format (9 sections, explicit dependencies, vertical-slice features) and inverts the authoring loop: the **agent asks focused questions, the human answers**, with no section saved without confirmation. Out of Scope is a first-class section so the agent knows what _not_ to build.

See [`about-alps.md`](./plugins/alps-writer/templates/alps/about-alps.md) for the full design rationale and how ALPS feeds into the ADR-driven cycle.

## Quick Start

Register this repository as a marketplace, then install whichever plugins you want. They are independent — install one or both.

**Codex**

```bash
codex plugin marketplace add haandol/alps-writer-plugins
codex plugin add alps-writer@alps-writer
codex plugin add adr-writer@alps-writer
```

Invoke skills with `$alps-init`, `$feature-to-adr`, `$adr-new`, `$adr-impl`, `$adr-impl-refactor`, `$adr-impl-review`, `$adr-review`, `$adr-sync`, and `$adr-rollup`, or ask for the workflow in natural language. On first use, review and trust ADR Writer's single `SessionStart` hook when Codex prompts you. It restores context on startup, resume, clear, and compaction; it does not run for every user prompt.

**Claude Code**

```
/plugin marketplace add haandol/alps-writer-plugins
/plugin install alps-writer@alps-writer   # PRD authoring (MCP server + /alps-init, /feature-to-adr)
/plugin install adr-writer@alps-writer    # ADR cycle (/adr-new, /adr-impl, /adr-impl-refactor, /adr-impl-review, /adr-review, /adr-sync, hooks)
```

> `/feature-to-adr` (in alps-writer) delegates ADR authoring to `/adr-new` (in adr-writer), so install **both** if you want the ALPS → ADR bridge. adr-writer on its own works without any ALPS PRD.

Two entry flows, driven by `$skill-name` in Codex or `/skill-name` in Claude Code:

- **PRD-first** — `/alps-init` → `/feature-to-adr` → `/adr-impl` → `/adr-impl-refactor` (automatic) → `/adr-impl-review` (completion gate) → `Accepted`
- **ADR-only** — `/adr-new` → `/adr-impl` → `/adr-impl-refactor` (automatic) → `/adr-impl-review` (completion gate) → `Accepted`

Run `/adr-sync` when review finds implementation-fact drift, after broad refactors or manual ADR edits, or as a periodic audit; it is not a mandatory deep scan after every small implementation.

See the [Usage guide](./docs/usage.md) for the full cycle, walkthroughs, slash commands, hook behavior, and the mapping file, or the [ADR process overview](./docs/adr-process.md) for the same cycle drawn as diagrams.

Codex users on Amazon Bedrock should disable multi-agent before running ADR review skills; see [ADR Writer troubleshooting](./plugins/adr-writer/README.md#amazon-bedrock-rejects-a-subagent-request).

## Features

**alps-writer (PRD)**

- 9-section ALPS (PRD) template with structured XML templates, conversation guides, and per-Feature demos connected to the end-to-end demo scenario
- Interactive Q&A workflow — atomic confirmation by default, with explicit batch approval for complete structured input
- Document management — create, save, load, and export as clean Markdown
- Section dependency tracking — ensures referenced sections are reviewed first
- **Disposable comprehension signal** — Section 7 Features are internally assessed on five axes and shown only as an ephemeral `1–10` score; splitting is suggested only when requested
- **ALPS → ADR ownership handoff** — `/feature-to-adr` transfers every implementation-relevant Feature contract into `1..N` real ADRs, leaves replaceable means to code, and makes equivalent explicit re-imports no-ops
- Works with Claude Desktop, Claude Code, Cursor, Kiro, and any MCP-compatible client (MCP server only)

**adr-writer (ADR)**

- **ADR-driven development cycle** — author ADRs directly with `/adr-new`, implement them with `/adr-impl`, and keep them in sync with `/adr-sync`
- **Decision-first presentation** — authoring leads with a Decision Digest and exposes decision-changing premises; edits and sync lead with semantic changes; document review leads with Decision, Contract, Rationale, and Risk before detailed evidence
- **Disposable comprehension signal** — ADR digests, implementation plans, and document reviews show only an ephemeral `1–10` score from an internal five-axis assessment; the score never becomes an ADR field or workflow gate
- **Requested Stacked PR fallback** — when one Feature and ADR must stay intact, `/adr-impl` can offer dependency-ordered PR layers with one review question each; it never creates a Stack from the score alone
- **ADR admission gate** — record durable requirement/architecture decisions while leaving replaceable libraries, SDKs, frameworks, and credential/auth wiring at the code level
- **Verified implementation refactoring** — before Status promotion, independently review efficiency, complexity, coupling, duplication, and proportionate reuse; immediately apply only local behavior-preserving changes with before/after tests and propose the rest
- **Risk-based implementation review** — every review returns a human-readable Evidence Package with one status/evidence row per ADR obligation plus read-only material implementation choices and their ADR-intent fit. Localized changes use an isolated sufficiency pass and targeted tests; protected-surface changes add independent necessity/sufficiency reviews. Intent is approved before implementation, so completion review does not repeat a routine human gate; it informs the human and escalates only exceptions
- **Provider-aware review fallback** — Codex sessions on Amazon Bedrock avoid unsupported subagent dispatch and retries; document/implementation reviews continue in the main session, while refactoring remains proposal-only without an isolated reviewer
- **ADR-first hook** — one `SessionStart` hook runs only on startup, resume, clear, and compaction recovery, injecting the admission-aware directive without mapping contents; admitted work reads `docs/adr/.mapping.json` before coding
- Fully standalone — no ALPS PRD required

## Documentation

- [Usage guide](./docs/usage.md) — development cycle, walkthroughs, slash commands, hook, mapping file
- [ADR process overview](./docs/adr-process.md) — the lifecycle, critical command paths, routing, and efficiency review as diagrams (Korean)
- [Dependency model](./docs/dependency-model.md) — how PRD → ADR → code stay decoupled (the design core)
- [MCP server](./docs/mcp-server.md) — run the alps-writer MCP server in other clients, env vars, tool reference
- [`about-alps.md`](./plugins/alps-writer/templates/alps/about-alps.md) — ALPS format design rationale
- [ADR templates](./plugins/adr-writer/templates/adr/) — authoring rules, directory structure, mapping schema

## Repository layout

```
alps-writer-plugins/                 # marketplace root (this repo)
├── .agents/plugins/marketplace.json # Codex marketplace
├── .claude-plugin/marketplace.json  # Claude Code marketplace
├── docs/                            # usage, dependency model, MCP server guides
└── plugins/
    ├── alps-writer/                 # PRD plugin (bundles its own MCP server)
    │   ├── .codex-plugin/plugin.json    # Codex metadata + MCP registration
    │   ├── .claude-plugin/plugin.json   # Claude Code metadata + MCP registration
    │   ├── .mcp.json                    # Codex MCP server command
    │   ├── src/                     # MCP server source (TypeScript)
    │   ├── dist/                    # committed bundle (index.js + assets) — runs as-is
    │   ├── skills/                  # /alps-init, /feature-to-adr
    │   └── templates/alps/
    └── adr-writer/                  # ADR plugin (standalone, ALPS-agnostic)
        ├── .codex-plugin/plugin.json
        ├── .claude-plugin/plugin.json
        ├── skills/                  # /adr-new, /adr-impl, /adr-impl-refactor, /adr-impl-review, /adr-review, /adr-sync, /adr-rollup
        ├── agents/                  # ADR authoring + isolated refactor/implementation review roles
        ├── hooks/                   # ADR-first directive hook (SessionStart)
        └── templates/adr/           # README + concepts + authoring-rules + structure + mapping.schema.json
```

## Development

This is a pnpm workspace. The MCP server lives in `plugins/alps-writer/`; root scripts proxy to it.

```bash
pnpm install        # Install dependencies (whole workspace)
pnpm build          # Bundle the alps-writer MCP server into plugins/alps-writer/dist/
pnpm lint           # ESLint the MCP server
pnpm format         # Prettier across the repo

# Or work inside the package directly:
pnpm --filter alps-writer dev     # Run with tsx (watch mode)
pnpm --filter alps-writer start   # Run the built bundle
```

> **The bundle is committed.** `plugins/alps-writer/dist/` is checked into git (esbuild output with dependencies inlined) so the plugin runs from a marketplace install with no build step. **Whenever you change `src/`, run `pnpm build` and commit the regenerated `dist/`.**

See [AGENTS.md](./AGENTS.md) for the full architecture, code style, and conventions.

## Contributing

Contributions are welcome. Before opening a PR, read [`CONTRIBUTING.md`](./CONTRIBUTING.md) for commit convention (Conventional Commits), branch naming, and code style. Open an issue first for substantial changes, make sure `pnpm lint` and `pnpm format:check` pass, and keep commits atomic.

Bug reports and feature requests: [GitHub Issues](https://github.com/haandol/alps-writer-plugins/issues).

## License

[MIT](./LICENSE)
