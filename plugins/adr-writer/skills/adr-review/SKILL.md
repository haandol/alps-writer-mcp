---
name: adr-review
description: Review existing ADRs as documents — sweep every ADR (or one category) against the authoring rules R1-R20 and return a punch list. Report-only; never edits ADRs, the mapping, or code. Use when the user asks to review ADR quality, check abstraction level, verify requirement values survived, or audit ADRs without touching code. Keywords - "/adr-review", "ADR 리뷰", "ADR 품질 검토", "ADR 추상화 레벨 점검", "review my ADRs", "audit ADR quality".
argument-hint: "[category-or-adr-path?]"
---

# adr-review

Review ADRs that already exist **as documents** and return a punch list. With no argument it sweeps every ADR; with an argument it narrows to one category or a single ADR.

> **This is the document-quality axis.** It asks "is this ADR written at the right abstraction level, and is every requirement it must carry still in it?" — never "does the code match?" Pick the right command:
>
> | Question                                                                      | Command                                              |
> | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
> | Is the ADR written correctly? (abstraction level, requirements, alternatives) | **`/adr-review`** (this one)                         |
> | Does the ADR match the shipping code, and fix the drift?                      | `/adr-sync [category]`                               |
> | Did the implemented code honor the ADR?                                       | `/adr-impl-review [category]`                        |
> | Reviewing a brand-new draft before saving it                                  | `/adr-new` (calls the reviewer itself in its step 6) |
>
> Reach for this one when you want ADR quality judged **without reading code** — a periodic audit, an inherited ADR set, or a check after hand-editing several ADRs. Since it never opens the codebase, it is far cheaper than `/adr-sync` and does not care whether the code exists yet.

> **Report-only**: never edit an ADR, `.mapping.json`, or code. Return findings and let the user decide. That is what makes a full sweep safe — a sweep that also edited would fan one misjudgment across every ADR at once.

> **Language**: this skill and every other harness prompt are written in English, but talk to the user and write the report in the language the user writes in (`authoring-rules.md` "Conventions"). Any user-facing phrasing below is a guide, not a literal string.

## Procedure

### 1. Fix the scope

- **No argument** → every ADR on disk. Enumerate `docs/adr/**/NNNN-*.md` **recursively** (e.g. `find docs/adr -name '[0-9][0-9][0-9][0-9]-*.md'`) so both flat keys (`docs/adr/auth/0001-x.md`) and two-segment feature sub-folders (`docs/adr/identity/login/0001-x.md`) are included. A non-recursive glob (`docs/adr/*/*.md`) silently misses the sub-folder ADRs.
- **A category key** (`auth`, `identity/login`) → the ADRs in that category.
- **An ADR file path** → that one ADR.
- `decision-log.md` is a convention file, not an ADR (`structure.md` "Decision log") — exclude it from the sweep. It gets its own lightweight check in step 5.
- If there are no ADRs at all, say so and suggest `/adr-new <category>`, then finish.

Then load the rule documents once and reuse them for every ADR: `docs/adr/README.md`, `authoring-rules.md`, `structure.md` (falling back to `${CLAUDE_PLUGIN_ROOT}/templates/adr/`), plus `docs/adr/.mapping.json`.

**Announce the scope before starting a full sweep.** For more than a handful of ADRs, print the count and the per-category breakdown and confirm once ("Reviewing 23 ADRs across 6 categories. Proceed?"). A sweep spends one subagent per ADR, so the user should see the size first.

### 2. Run the deterministic harness once, for the whole scope

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-structure-lint.mjs [category]   # omit the argument to lint every category
```

Run this **once for the entire scope**, not per ADR — it already walks every ADR and the mapping in one pass. It mechanically settles the format, existence, and consistency half of the rules (Status enum and date format, required sections, canonical filenames, path depth, anti-pattern category segments, Decision Drivers and alternatives counts, Related links resolving, `dependsOn` integrity, mapping↔disk consistency and status↔body agreement, values written in code-constant form, and — internally via `adr-invariants.sh` — code→ADR and ADR→PRD back-references).

Keep the result and pass each ADR's slice of it to that ADR's reviewer, so the LLM never re-derives what the harness already proved. **Inherit, do not re-diagnose**: an item the harness reported as `error` goes into the final report as `FIX_REQUIRED (confirmed by harness)`.

**The harness never flags a bare number** — whether a value is a requirement (keep) or a tuning value (drop) is judgment, so it stays with the reviewer in step 3. This is deliberate: pushing an author to delete a requirement value is the failure mode this plugin guards against hardest.

### 3. Review each ADR with `adr-reviewer`, in parallel

For each ADR in scope, run the `adr-reviewer` subagent in a fresh isolated context — that agent owns rules R1-R20 and is the source of truth for them; do not restate its criteria here.

1. If the client can discover the `adr-reviewer` named subagent, invoke it.
2. Otherwise read `${CLAUDE_PLUGIN_ROOT}/agents/adr-reviewer.md` and run a **generic read-only subagent** with its full text as the instructions. Codex plugins do not register `agents/*.md` as components, so this fallback is the default path.
3. Only where subagents are unavailable at all should the main session carry out the same instructions per ADR, noting in the report that isolated review was unavailable.

Pass each reviewer: the ADR path, that category's `.mapping.json` entry, and **that ADR's slice of the harness result**.

- **One subagent per ADR, and run independent ADRs in parallel.** Isolation is the point — a reviewer that saw the previous ADR's findings starts pattern-matching instead of judging, and one long context degrades the later ADRs.
- **Never batch several ADRs into one reviewer call** to save tokens. R19 (the regeneration test) requires holding one ADR's whole contract in view; batching is how a missing requirement slips through.
- If the scope is large enough that a full parallel fan-out is impractical, process in **category-sized batches** and tell the user the batching, rather than silently reviewing a subset. Never truncate the scope without saying so.

### 4. Aggregate — where the value of a sweep actually is

A per-ADR punch list is just N separate reviews. What a sweep adds is what only becomes visible **across** ADRs, so spend the aggregation effort here:

- **Recurring rule violations** — the same rule failing across many ADRs is a signal about the team's authoring habit, not about one document. Report it as one grouped finding with the ADR list ("R18a: requirement values blurred in 7 of 23 ADRs"), because the fix is a shared habit, not 7 unrelated edits.
- **Contradictions between ADRs** — two ADRs stating different values or rules for the same behavior (thresholds, allowed value sets, state transitions, error handling). Neither ADR's own review can see this, so only the sweep catches it. Record which ADRs conflict and on what, and route it to the user for a ruling — never pick a winner yourself.
- **Cross-category duplication** — the same decision recorded in two categories, which usually means the category boundary is wrong (`structure.md` "Anti-pattern categories") rather than that one ADR is bad.
- **Weak spots in the set** — categories where every ADR fails R12 (gray-zone substance), or a category with no ADR at all despite the code having decisions worth recording.
- **Prose style across the set (R20, advisory)** — report it as **one grouped finding for the whole sweep**, not per ADR: a house habit like passive-voice decisions or padded openers shows up everywhere at once, and N separate style nags would bury the findings that actually matter. Name the habit, give two or three representative rewrites, and list the affected ADRs. Never let style suggestions outweigh a `FIX_REQUIRED`, and never propose a cut that removes content.

### 5. Companion checks (cheap, and only where they need no code)

- **`decision-log.md`** in each category, if present — the harness already verifies its ADR pointers resolve (`decision-log-link-broken`), so trust that and only check by eye that no old ADR number is embedded in the prose, no PRD is cited, and it holds no duplicated current state or implementation constants (`authoring-rules.md` "Decision log").
- **Index hygiene** is fully covered by the step 2 harness (mapping↔disk, status↔body, `dependsOn` integrity) — report its result rather than re-checking.
- **Do not open the codebase.** R1's code-reality half and R17 (code→ADR back-references) need code, so they are out of scope here — say so explicitly in the report and route them to `/adr-sync`. Suppressing that boundary would let a reader mistake a clean `/adr-review` for "the ADRs match the code".

### 6. Report

```
## ADR Review Sweep

### Scope
- ADRs reviewed: <n> (categories: <list>)
- Harness: <pass | n errors, m warnings>
- Not covered here: ADR↔code consistency (R1 code-reality, R17) → /adr-sync

### Verdict
<n> PASS · <n> FIX_REQUIRED · <n> BLOCK

### Cross-ADR findings
- [Recurring] R18a — requirement values blurred: <adr list>
- [Contradiction] <ADR A> ↔ <ADR B> — <what conflicts> (user ruling needed)
- [Duplication] <ADR A> ↔ <ADR B> — same decision in two categories, category boundary suspect
- [Gap] <category> — no ADR for <decision the set implies>

### Per-ADR
- <path> — FIX_REQUIRED
  - [R18a] <short diagnosis> — <quote>
    Fix: <one line>
- <path> — PASS

### Prose style (R20, advisory)
- <the house habit, with 2-3 rewrites and the affected ADRs — or "clean">

### Suggestions
- <the shared habit worth changing, or the next command to run>
```

Order the per-ADR section **worst first** (BLOCK, then FIX_REQUIRED, then PASS) so the reader meets the expensive problems first, and keep PASS entries to one line each.

**Summarize in chat rather than dumping the whole report**: the verdict counts, the cross-ADR findings, and the two or three ADRs that need attention most. For a large sweep, write the full report to a file and give the path.

### 7. Route the follow-ups

This command stays report-only. Route what the user approves:

- **R3/R4 (implementation detail, code-readable content)** → edit the ADR body directly.
- **R18a (a missing requirement value or rule)** → this needs the user, not a guess. The code cannot tell you whether a value is a contract, so ask what the requirement is and record it with its basis (`authoring-rules.md` "Concrete numbers" / "Non-numeric requirements"). **Never invent a number.**
- **R12/R13/R14 (weak gray zone, Drivers, alternatives)** → strengthen the ADR, or reconsider whether the decision needed an ADR at all.
- **A contradiction between ADRs** → the user rules on which value holds; then whichever ADR changes gets a `decision-log.md` line if the change is major (`authoring-rules.md` "What to log — minor vs major").
- **A wrong category boundary or a decision split across categories** → `/adr-sync` (its step 3.5 owns category realignment).
- **Anything needing the code** → `/adr-sync [category]`, or `/adr-impl-review [category]` when the question is whether the implementation honored the decision.

## Prohibited

- Never edit an ADR, `.mapping.json`, `decision-log.md`, or code — this command reports only.
- Never batch several ADRs into one reviewer call, and never let one reviewer see another's findings.
- Never silently narrow the scope. If you review a subset, say which ADRs were skipped and why.
- Never report a clean sweep as "the ADRs are correct" — it means the ADRs are well _written_. Consistency with code is `/adr-sync`'s verdict.
- Never propose deleting a requirement value because it looks like a constant, or a number because the code also holds it (`authoring-rules.md` "Requirements live in the code and in the ADR").
