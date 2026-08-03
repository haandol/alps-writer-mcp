# adr-writer

ADR-driven development cycle for Codex and Claude Code. Author Architecture Decision Records, implement them in code, and keep the two in sync — with an ADR-first hook that re-injects the ADR map every turn.

**Standalone**: adr-writer requires no ALPS PRD and never references the `alps-writer` plugin. ADRs are its first-class artifact; code is implemented from ADRs. `docs/adr/.mapping.json` (the ADR index) stores no PRD reference. The ADR ↔ code link is not stored anywhere — an agent finds the code an ADR governs by reading the ADR and searching the repo, so refactors never churn a stored mapping.

## Install

**Codex**

```bash
codex plugin marketplace add haandol/alps-writer-plugins
codex plugin add adr-writer@alps-writer
```

**Claude Code**

```text
/plugin marketplace add haandol/alps-writer-plugins
/plugin install adr-writer@alps-writer
```

## Slash commands

| Command                          | Role                                                                                                                                                                                                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/adr-new <category>`            | Author a new ADR directly — the default authoring path                                                                                                                                                                                                                     |
| `/adr-impl [category]`           | Implement an ADR in code (including tests). With no argument, lists Proposed ADRs and asks which to build                                                                                                                                                                  |
| `/adr-impl-review [category]`    | Explain the implementation, then run independent necessity/sufficiency reviews and tests; emit a Mermaid-rich junior repair guide (report-only)                                                                                                                            |
| `/adr-review [category]`         | Review **hand-edited or inherited** ADRs as documents against the authoring rules (abstraction level, requirement preservation, alternatives) — no code read, report-only. No arg → every ADR. Not run after `/adr-new`, which judges its own draft against the same rules |
| `/adr-sync [category] [--quick]` | Detect/repair drift between code and ADR, and absorb new learnings                                                                                                                                                                                                         |
| `/adr-rollup [category]`         | Consolidate ADR groups whose evolution history of one logical decision is split (no arg → all categories)                                                                                                                                                                  |

The shared authoring rules and procedures (category-split, Status transitions, finding the code an ADR governs) live in `docs/adr/` (`concepts.md` — the principle, dependency model, and Status transitions; `authoring-rules.md`; `structure.md`; plus `README.md` as the index) — seeded from this plugin's `templates/adr/` on first run. Every command reads them as the single source of truth.

## Deterministic self-test harness

Three dependency-free scripts let the cycle **self-test** its artifacts without an LLM judgment call — the skills invoke them so the LLM reviewer only spends tokens on rules that genuinely need judgment. The first two check that ADRs are well-formed; the third gates `/adr-impl-review`'s own output.

| Script                                 | Scope                                                  | Checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/adr-invariants.sh`            | repo-wide, one-way dependency oracle                   | code→ADR (a) and ADR→PRD (b) reverse references; rollup stale citations (c)/(d). Exit 0/1/2, fail-closed on grep error. A consuming repo can wire it into pre-commit/CI.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `scripts/adr-structure-lint.mjs`       | per-ADR body + `.mapping.json` + disk state (Node ESM) | Status enum/date (R1), required sections, filename `NNNN-kebab` (no `fN-`), path depth ≤2, anti-pattern key segments (R5a), Decision Drivers count (R13), alternatives ≥2 (R14), Related-link existence (R10), `dependsOn` integrity (R16), mapping↔disk + status↔body consistency (R8), values written as code constants (R18 form half — `MAX_TURNS = 20` should read as a domain sentence; the harness never flags a bare number, because deleting a requirement value is the failure mode this plugin guards hardest against), and each `decision-log.md`'s ADR pointer resolving on disk — the one thing checked in an otherwise unindexed convention file, because a rollup renumber can orphan it and no other oracle sees it. Invokes `adr-invariants.sh` and folds its exit. |
| `scripts/adr-impl-review-validate.mjs` | `/adr-impl-review` artifact directory                  | Requires the exact junior repair guide filename, grounded Mermaid structure/runtime diagrams, actionable finding sections, and evidence-complete `findings.json` before the interactive HTML report can be generated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

Run over a project's live ADRs:

```bash
node <plugin>/scripts/adr-structure-lint.mjs [category]   # deterministic structure + invariants
bash <plugin>/scripts/adr-invariants.sh                   # reverse-reference oracle only
```

`adr-structure-lint` handles the **deterministic half** of the reviewer's R-rules (enum/format, presence, counts, cross-reference consistency); reviewer subagents focus on the judgment half. `/adr-new` carries that judgment half itself rather than delegating — it authors under the same R1-R20 rules, so `adr-reviewer` runs only via `/adr-review`, on ADRs edited by hand or inherited, where no authoring context survives. `/adr-impl-review` uses isolated roles: a junior-readable explainer, a necessity reviewer, a sufficiency reviewer that executes targeted tests, and a report writer that produces a grounded Mermaid repair guide. Claude Code can use the named definitions under `agents/`; Codex reads the same definitions and passes them to generic subagents. `/adr-new`, `/adr-impl`, and `/adr-sync` each call the harness at their verification step — see their SKILL.md.

## Hook

One hook supports the main session — **no external LLM calls**; the main model classifies text and decides.

| Hook               | When it fires      | Role                                                                          |
| ------------------ | ------------------ | ----------------------------------------------------------------------------- |
| `UserPromptSubmit` | Every user message | Inject the ADR-first directive + `docs/adr/.mapping.json` snapshot every turn |

The directive prompts the model to read (or author) the relevant ADR before changing behavior. It never blocks an edit — keeping the PRD → ADR → code flow intact is the model's job, re-prompted every turn so it survives session compaction.

## Relationship to alps-writer

The companion [`alps-writer`](https://github.com/haandol/alps-writer-plugins) plugin writes ALPS (PRD) documents and can import Section 7 features into ADRs via `/feature-to-adr` — which simply delegates each feature to this plugin's `/adr-new`. The dependency is one-way: alps-writer knows about adr-writer, never the reverse.

## License

[MIT](../../LICENSE)
