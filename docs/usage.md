# Usage guide

This guide covers the full development cycle, the two entry flows (PRD-first and ADR-only), the slash commands, the ADR-first hook, and the mapping file.

For installation see the [README Quick Start](../README.md#quick-start-claude-code-plugins). For the MCP server in non-Claude-Code clients see [MCP server](./mcp-server.md).

## Development cycle

```mermaid
flowchart LR
    A["Check ADRs<br/>(mapping snapshot)"] --> B["Author/edit ADR<br/>(/adr-new — default)<br/>or /feature-to-adr<br/>(ALPS helper)"]
    B --> C["Write code<br/>(/adr-impl)"]
    C --> D["Test<br/>(project commands)"]
    D --> E["/adr-sync<br/>(reinforce ADR<br/>with what was learned)"]
    E -->|next cycle| A
```

ADRs are the primary artifact the adr-writer plugin manages. The default authoring path is `/adr-new <category>` — write the decision directly, with or without an ALPS PRD. `/feature-to-adr` (alps-writer) is a bridge layered on top: when you already have an ALPS Section 7 feature, it imports each feature into a Proposed ADR by delegating to `/adr-new`.

The goal is for ADRs to evolve alongside the code each cycle. Adding a new ADR when a decision changes is normal, and having multiple ADRs in the same category is normal too. Only when **the evolution history of a single logical decision** is scattered across several ADRs do you use `/adr-rollup` to consolidate that group into a single "current state" ADR.

## Walkthroughs

### A. PRD-first — start from an ALPS spec (both plugins)

1. `/alps-init` → answer the focused questions section by section; the agent saves each only after you confirm.
2. After Section 7 (feature specs), run `/feature-to-adr` → it walks each feature and hands it to `/adr-new`, producing a `Proposed` ADR per feature under `docs/adr/<category>/` and seeding `docs/adr/.mapping.json`.
3. `/adr-impl <id>` → implement an accepted-in-spirit ADR in code + tests. On success it flips the ADR to `Accepted`.
4. `/adr-sync` at the end of a cycle → fold what you learned back into the ADRs and repair any drift.

`/feature-to-adr` is a **one-time import**: it converts each Section 7 feature into an ADR once. After that the decision is managed at the ADR level — if the PRD later changes, edit the affected ADR directly (or supersede it with a new one) rather than re-importing.

### B. ADR-only — no PRD (adr-writer standalone)

1. `/adr-new <category>` → describe the decision directly (refactor, infra choice, new feature direction). No ALPS document required.
2. `/adr-impl <id>` → build it in code.
3. As you keep working, the ADR-first hook re-injects the ADR map every turn so the agent checks ADRs before changing behavior. Run `/adr-sync` to reconcile ADRs with shipping code.

In both flows the hook runs automatically once adr-writer is installed — every user turn re-injects the ADR map and the ADR-first directive.

## Slash commands

### alps-writer

| Command                | Role                                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `/alps-init`           | Author a new ALPS document (or resume an existing one)                                                           |
| `/feature-to-adr [id]` | _Bridge_: import an ALPS Section 7 feature into a Proposed ADR by delegating to `/adr-new` (requires adr-writer) |

### adr-writer

| Command                    | Role                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `/adr-new <category>`      | Author a new ADR directly — the default path, no ALPS PRD required                                    |
| `/adr-impl [id]`           | Implement an ADR in code (including tests). With no `id`, lists Proposed ADRs and asks which to build |
| `/adr-sync [id] [--quick]` | Detect/repair drift between code and ADR, and absorb new learnings                                    |
| `/adr-rollup <id>`         | Consolidate only ADR groups whose evolution history of one logical decision is split                  |

## Hook behavior

One hook supports the main Claude Code session — **with no external LLM calls**; the main model classifies text and makes decisions itself.

| Hook               | When it fires      | Role                                                                                                                                                  |
| ------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UserPromptSubmit` | Every user message | Inject the ADR-first directive + `docs/adr/.mapping.json` snapshot every turn (survives session compaction, unlike a one-shot SessionStart injection) |

The directive tells the model: when a request adds or changes behavior, read the relevant ADRs (or author one with `/adr-new`) before touching code. Classification is left to the main model — the hook never blocks an edit; keeping the PRD → ADR → code flow intact is the model's job, prompted every turn.

## Mapping file

`docs/adr/.mapping.json` records the ALPS-feature ↔ ADR link only — it stores no code paths, and no artifact references another in its own body. See the schema at [`plugins/adr-writer/templates/adr/mapping.schema.json`](../plugins/adr-writer/templates/adr/mapping.schema.json). `/adr-new` creates the category entry (`feature`, `adrs`); `/feature-to-adr` additionally backfills the ALPS link fields (`alpsDocument`, `alpsFeatureId`, `dependsOn`). The code an ADR governs is found by reading the ADR and searching the repo, not stored here.
