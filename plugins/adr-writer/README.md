# adr-writer

ADR-driven development cycle for Codex and Claude Code. The ADR admission gate records only durable requirements and architectural decisions, leaving replaceable libraries, SDKs, frameworks, and credential/auth wiring in code. The cycle then implements and keeps admitted decisions in sync, with an ADR-first hook that re-injects the ADR map every turn.

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
| `/adr-new <category>`            | Apply the admission gate, then author a durable architectural decision directly; implementation-only choices create no ADR                                                                                                                                                 |
| `/adr-impl [category]`           | Implement an ADR in code (including tests). With no argument, lists Proposed ADRs and asks which to build                                                                                                                                                                  |
| `/adr-impl-refactor [category]`  | Review efficiency, complexity, coupling, duplication, and proportionate reuse; apply only high-confidence local behavior-preserving refactors with before/after tests, and propose the rest                                                                                |
| `/adr-impl-review [category]`    | Explain the implementation, then run independent necessity/sufficiency reviews and tests; emit a Mermaid-rich junior repair guide (report-only)                                                                                                                            |
| `/adr-review [category]`         | Review **hand-edited or inherited** ADRs as documents against the authoring rules (abstraction level, requirement preservation, alternatives) — no code read, report-only. No arg → every ADR. Not run after `/adr-new`, which judges its own draft against the same rules |
| `/adr-sync [category] [--quick]` | Detect/repair drift between code and ADR, and absorb new learnings                                                                                                                                                                                                         |
| `/adr-rollup [category]`         | Consolidate ADR groups whose evolution history of one logical decision is split (no arg → all categories)                                                                                                                                                                  |

The shared authoring rules and procedures (category-split, Status transitions, finding the code an ADR governs) live in `docs/adr/` (`concepts.md` — the principle, dependency model, and Status transitions; `authoring-rules.md`; `structure.md`; plus `README.md` as the index) — seeded from this plugin's `templates/adr/` on first run. Every command reads them as the single source of truth.

## Deterministic self-test harness

Three dependency-free scripts let the cycle **self-test** its artifacts without an LLM judgment call — the skills invoke them so the LLM reviewer only spends tokens on rules that genuinely need judgment. The first two check that ADRs are well-formed; the third gates `/adr-impl-review`'s own output.

| Script                                 | Scope                                                  | Checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/adr-invariants.sh`            | repo-wide, one-way dependency oracle                   | code→ADR (a) and ADR→PRD (b) reverse references; rollup stale citations (c)/(d). Exit 0/1/2, fail-closed on grep error. A consuming repo can wire it into pre-commit/CI. Its optional root `.adr-invariants-code-ignore` file excludes intentional examples or fixtures from code→ADR scanning only; ADR→PRD and rollup checks remain unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `scripts/adr-structure-lint.mjs`       | per-ADR body + `.mapping.json` + disk state (Node ESM) | Status enum/date (R1), required sections, filename `NNNN-kebab` (no `fN-`), path depth ≤2, anti-pattern key segments (R5a), Decision Drivers count (R13), alternatives ≥2 (R14), Related-link existence (R10), `dependsOn` integrity (R16), mapping↔disk + status↔body consistency (R8), values written as code constants (R18 form half — `MAX_TURNS = 20` should read as a domain sentence; the harness never flags a bare number, because deleting a requirement value is the failure mode this plugin guards hardest against), and each `decision-log.md`'s ADR pointer resolving on disk — the one thing checked in an otherwise unindexed convention file, because a rollup renumber can orphan it and no other oracle sees it. Invokes `adr-invariants.sh` and folds its exit. |
| `scripts/adr-impl-review-validate.mjs` | `/adr-impl-review` artifact directory                  | Validates concise standard-mode ledger/test artifacts or the full junior repair guide and evidence-complete `findings.json`; only full mode proceeds to interactive HTML.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Run over a project's live ADRs:

```bash
node <plugin>/scripts/adr-structure-lint.mjs [category]   # deterministic structure + invariants
bash <plugin>/scripts/adr-invariants.sh                   # reverse-reference oracle only
```

`adr-structure-lint` handles the deterministic half of the reviewer's R-rules. `/adr-impl-review` is the pre-promotion completion gate: standard mode uses a decision ledger, isolated sufficiency review, and targeted tests for localized changes; full mode adds independent necessity/sufficiency reviews and detailed repair artifacts for protected-surface or broad changes. Intent and regeneration completeness are approved before implementation, so neither mode repeats a routine human gate afterward. Both record the selected mode, elapsed time, findings, unverified risks, and executed test commands before `PASS` permits `Accepted`.

## Hook

One hook supports the main session — **no external LLM calls**; the main model classifies text and decides.

| Hook               | When it fires      | Role                                                                          |
| ------------------ | ------------------ | ----------------------------------------------------------------------------- |
| `UserPromptSubmit` | Every user message | Inject the ADR-first directive + `docs/adr/.mapping.json` snapshot every turn |

The directive first applies the ADR admission gate. Requirement contracts, durable boundaries, provider/model choices, key designs, algorithms, and fallback policies enter the cycle; replaceable SDKs, libraries, frameworks, and credential/auth adapters stay in code. The hook never blocks an edit — keeping the PRD → ADR → code flow intact is the model's job, re-prompted every turn so it survives session compaction.

## Relationship to alps-writer

The companion [`alps-writer`](https://github.com/haandol/alps-writer-plugins) plugin writes ALPS documents. `/feature-to-adr` discovers zero, one, or several admitted decisions per feature, reconciles existing contracts, and delegates each new decision to this plugin's `/adr-new`. The dependency is one-way.

## License

[MIT](../../LICENSE)
