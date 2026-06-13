# adr-writer

ADR-driven development cycle for Claude Code. Author Architecture Decision Records, implement them in code, and keep the two in sync — with hooks that surface ADR ↔ code drift on every edit.

**Standalone**: adr-writer requires no ALPS PRD and never references the `alps-writer` plugin. ADRs are its first-class artifact; code is implemented from ADRs, and the link between them lives entirely in your project's `docs/adr/.mapping.json`.

## Install

```
/plugin marketplace add haandol/alps-writer-plugins
/plugin install adr-writer@alps-writer
```

## Slash commands

| Command                    | Role                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `/adr-new <category>`      | Author a new ADR directly — the default authoring path                                                |
| `/adr-impl [id]`           | Implement an ADR in code (including tests). With no `id`, lists Proposed ADRs and asks which to build |
| `/adr-sync [id] [--quick]` | Detect/repair drift between code and ADR, and absorb new learnings                                    |
| `/adr-rollup <id>`         | Consolidate ADR groups whose evolution history of one logical decision is split                       |

The shared authoring rules and procedures (codePaths recommendation, category-split, Status transitions) live in `docs/adr/` (`README.md`, `authoring-rules.md`, `structure.md`) — seeded from this plugin's `templates/adr/` on first run. Every command reads them as the single source of truth.

## Hooks

Two hooks support the main session — **no external LLM calls**; the main model classifies text and decides.

| Hook               | When it fires        | Role                                                                                                                                                                    |
| ------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UserPromptSubmit` | Every user message   | Inject the ADR-first directive + `docs/adr/.mapping.json` snapshot every turn                                                                                           |
| `PreToolUse`       | Edit/Write/MultiEdit | Editing code: detect missing mappings, stale ADRs, uncovered source → warn (or block). Editing a PRD `*.alps.xml`: warn-only notice for downstream ADRs that now lag it |

Default mode is `warn`. Export `ALPS_ADR_ENFORCE=block` to make `PreToolUse` deny edits to stale or unmapped **code** sources (exit 2, with the reason passed through model context for self-correction). PRD edits are never blocked — the PRD is the most-upstream source, so a PRD edit only emits a warn-only propagation notice.

## Relationship to alps-writer

The companion [`alps-writer`](https://github.com/haandol/alps-writer-plugins) plugin writes ALPS (PRD) documents and can import Section 7 features into ADRs via `/feature-to-adr` — which simply delegates each feature to this plugin's `/adr-new`. The dependency is one-way: alps-writer knows about adr-writer, never the reverse.

## License

[Apache-2.0](../../LICENSE)
