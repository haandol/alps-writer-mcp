---
name: adr-sync
description: Verify that ADRs in docs/adr/ accurately describe the current codebase and fix any drift. Uses the ADR index at docs/adr/.mapping.json (categories → adrs with path/status/summary + dependsOn; no code paths and no PRD reference — the code an ADR governs is found by reading the ADR and searching the repo). Use when the user invokes /adr-sync or asks to audit ADRs against shipping code. Keywords - "/adr-sync", "ADR sync", "ADR drift check", "ADR 동기화", "ADR drift 검사".
argument-hint: "[category?] [--quick]"
---

# adr-sync

Verify that every ADR in `docs/adr/` matches the shipping code. Fix drifted ADRs, resolve contradictions between related ADRs, and synchronize the `.mapping.json` index (the adrs[] path/status/summary).

Alongside verification and correction, **refine each ADR into "one self-contained document describing the current code."** Reconstruct the evolution narration that accumulated mid-body over time ("originally it was X, then changed to Y", "added Z in v2", "changed to B compared with the previous A") into a single current-state description, so reading one ADR conveys the latest code's business and technical decisions without a break. Of what you strip out, **harvest major transitions** into the category's `decision-log.md` (Pass 2's step 3-E); **minor** evolutions and individual diffs are preserved by Git, so the ADR body carries no evolution history. (This is cleanup within a single ADR — merging an evolution _chain_ spread across several ADRs into one is `adr-rollup`'s job.)

The default is **deep mode**: read every ADR body in scope and compare every claim (APIs, error codes, enums, entity fields, Status, Related links) against the code. With `--quick`, check only the adrs[] summary in `.mapping.json` (the one-line Key Decision).

## Modes

| Flag      | Mode  | When to use                                                          |
| --------- | ----- | -------------------------------------------------------------------- |
| (default) | Deep  | Periodic audits, after a large refactor, onboarding cleanup          |
| `--quick` | Quick | Regression check after a small code change, token-budget constraints |

If the argument is a category, target only that category (`/adr-sync auth`).

> **If the question is only about how the ADRs are written, use `/adr-review` instead.** This command's job is ADR ↔ code consistency, so it greps the codebase for every ADR — expensive, and pointless when the code does not exist yet. `/adr-review` sweeps the same ADRs against the authoring rules (R1-R20: abstraction level, requirement preservation, alternatives, prose style) without opening the code, and reports rather than edits.

> **Language**: this skill and every other harness prompt are written in English, but talk to the user and write the ADR body in the language the user writes in (`authoring-rules.md` "Conventions"). Any user-facing phrasing below is a guide, not a literal string.

## Workflow

### 1. Load the index and mapping

- Read `concepts.md` (the abstraction ladder, the gray zone, the dependency model, Status and its automatic transitions), `docs/adr/README.md` (the index and the ADR template), `docs/adr/authoring-rules.md` (authoring rules and the review checklist), and `docs/adr/structure.md` (directory and mapping policy). In a repo seeded before the README/AGENTS split, all of the AGENTS material sits inside `README.md` — read it there instead
- Read `docs/adr/.mapping.json` (the single ADR index — categories → adrs[] with path, status, summary, plus `dependsOn`). The mapping stores neither ADR↔code paths nor a PRD reference — locate the code an ADR governs by **reading the ADR's Decision body and searching the repo each time** (see "Finding the related code" below).
- Enumerate every ADR file on disk: **only `NNNN-*.md` (ADR files that start with a number)** under `docs/adr/<category>/`. An ADR file on disk that is absent from `.mapping.json`'s adrs[], or an adrs[] path pointing at a file that does not exist, is itself drift (two-way disk↔mapping consistency). **`decision-log.md` is a convention file, not an ADR, so exclude it from this enumeration** — it is not registered in the mapping (`structure.md` "Decision log") and must never be reported as orphan drift. (The deterministic harness likewise does not enumerate this file as an ADR, since it does not start with `NNNN-`.)

#### Finding the related code

Verifying an ADR and judging its Status requires looking at the code it governs. Since the mapping holds no code paths, narrow the scope for each ADR with the three steps in `structure.md` "Finding the related code" (extract domain keywords from the Decision/Mermaid/title → narrow with `Glob`/`Grep` → cross-check against the ADR's Decision). **Reuse a scope once found for the duration of this sync run** (Pass 1 → Pass 2); never persist it in the mapping.

#### When the mapping file is absent

If `docs/adr/.mapping.json` does not exist yet or is empty, infer category candidates from the `docs/adr/<category>/` directory names on disk and proceed. Narrow the per-category code scope with "Finding the related code" above, once per ADR — never ask the user for a code glob just to create a mapping.

### 2. Pass 1 — quick drift detection (the quick-mode entry point)

For each ADR, extract the adrs[] summary from `.mapping.json` (the one-line Key Decision) and grep the scope narrowed by "Finding the related code". Mark the result **In Sync** or **Drift Suspected**.

Quick mode performs only this step plus the index-based **detection and proposal** of stale `fN` naming in 3.7 (detecting stale `fN` naming from the adrs[] paths in `.mapping.json`) — it skips the remaining 3.x deep checks and any actual file moves.

### 3. Pass 2 — deep verification (always run in deep mode)

**Secure structure and consistency with the deterministic harness first** — filter out the mechanical rules before the LLM spends tokens on filenames, the Status enum, or index consistency:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-structure-lint.mjs [category]   # all categories when the argument is omitted
```

This harness parses each ADR body plus `.mapping.json` plus the disk state and mechanically verifies: the Status enum and date format (the first half of R1), presence of required sections, canonical filenames and stale `fN-` prefixes, path depth ≤ 2, anti-pattern category segments (the first half of R5), the Decision Drivers and alternatives counts (R13/R14), Related links resolving (R10), `dependsOn` integrity (R16), mapping↔disk consistency plus the adrs record shape (path/status/summary) and status↔body agreement (R8 / status-index-mismatch), whether a value is written in code-constant form (R18's format half — the `value-as-constant` warning), and — internally, via `adr-invariants.sh` — code→ADR and ADR→PRD back-references (R15/R17). Correct any `error` the harness caught in the corresponding Pass 2 step below (filename and mapping hygiene in step 6, Status format under 2-Status below, back-reference removal in step 5) and record it under **Fixed** in the step 7 report. The **semantic judgments** the harness cannot see (Status drift judged from what exists in code, gray-zone decision ↔ code contradictions, evolution-narration cleanup, **missing or drifted requirement values**) are carried out by the deep steps below — the harness looks at format and consistency, while the body of sync looks at decision drift. **The harness never flags a bare number** (the risk of pushing someone to delete a requirement value is too high) — which values must stay is entirely the judgment steps' job.

For each target ADR:

1. Read the entire ADR body.
2. Extract the verifiable claims:
   - **Status** — grep the scope narrowed by "Finding the related code" to confirm what exists in code. Auto-correct an invalid completion claim (`Accepted` but absent from code or tests → `Proposed`). Do **not** promote `Proposed` merely because code and tests exist: `Accepted` also requires `/adr-impl-review` to pass, and review evidence is not persisted in the ADR or mapping. Record that case under **Suggestions** and route it to `/adr-impl <category>` to run the completion gate. For the status semantics and the automatic transition policy see `concepts.md` "Automatic transition rules". **Every Status correction must use the deterministic transition script with the exact target ADR path**:

     ```bash
     node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-status-transition.mjs <target-adr-path> Proposed
     ```

     Do not edit the body Status or a `.mapping.json` status manually with `apply_patch`, regex replacement, or a search for the first matching value. The script updates the exact matching `adrs[]` record and body in lockstep, and refuses an absent, duplicated, or already inconsistent path. Add `--summary "<current one-line decision summary>"` only when the ADR decision changed and the index summary must change with it. Record the correction under **Fixed** in the step 7 report.

   - **API endpoints** — the method + path table. Grep routers and handlers.
   - **Error codes** — grep the constants.
   - **Enum / type values** — grep `oneof=...`, validate tags, TS unions.
   - **Entity field names** — grep DB tags (`dynamodbav`, ORM annotations).
   - **GSI / sparse index key patterns** — grep partition names and sort-key prefixes.
   - **UI labels and constants** — grep user-facing strings.
   - **Source-of-truth pointers** — whether an external document path such as "see `docs/tables/auth.md` for the schema" still exists and agrees with that file itself.
   - **Related ADR links** — whether they exist and their Status is consistent.

3. Identify implementation-detail bloat — **apply the requirement gate first** (`authoring-rules.md` "The requirement gate and two filters"), set aside everything that passes the gate as not-for-removal, then sweep the body with the two criteria below:
   - **The requirement gate (the do-not-remove line)**: "if this fact were missing, could code rebuilt from the ADR alone violate a requirement?" YES means **keep it** even when it looks obvious in the code — requirement values (limits, cycles, retention, caps, targets), and **non-numeric requirements** (allowed value sets, transition rules, mandatory fields, permissions, visibility, ordering, uniqueness, units — `authoring-rules.md` "Non-numeric requirements"), required validation conditions, and behavior guaranteed on failure. If sync strips requirements in the name of removing bloat, the ADR becomes a formally tidy but empty document and the next implementation loses that contract.
   - **The code-readthrough test** (`concepts.md` "What an ADR covers — the gray zone between business and code"): is a paragraph that failed the gate obvious from reading the related code? If it is, take it out of the ADR (function responsibilities, module dependency graphs, field-type tables, error message wording and UI labels, env var names, pseudocode, and the like).
   - **The forbidden-items table** (`authoring-rules.md` "What to exclude from an ADR" — read the "exception when it is a requirement" column alongside it): file paths (below folder level), code snippets, **implementation tuning values** (connection pools, backoff, cache TTL, worker counts — values a developer may change without violating a requirement), detailed entity field tables, migration commands, full JSON.
   - **Look for omissions at the same time** — if the code clearly holds a requirement contract (e.g. a session turn cap, a per-plan usage quota) that the ADR body lacks, ask the user whether it is a requirement or an implementation tuning value, and if it is a requirement add it to the ADR with its value and basis. This is the opposite direction from removing bloat; record it in `Suggestions` as `[Missing requirement] <what>`. **But never conclude a value in code is a requirement and quietly copy it over** — the code does not tell you whether a value is a contract or a coincidence, so always confirm with the user.
     3-E. **Evolution-narration cleanup — reconstruct into a self-contained current-state document** (a Pass 2 sub-step, distinct from the separate `### 3.5 Category slice integrity` section below). Refine the evolution narration that crept into an ADR over time into a single current-state description, so that reading that one ADR conveys the latest code's decisions without a break. Find and fix the following:
   - **Evolution phrasing → present-tense assertion**: convert chronological narration such as "it was X at first, then changed to Y", "added Z in v2", "changed to B compared with the previous A", "as of 2024-…", "the deprecated ~" into an assertion holding only what the current code does ("the system operates as Y"). Strip the old stages from the body, but **if a stage was a major transition** (replacing the adopted alternative, inverting a Driver, changing the core algorithm or architecture, a bug fix that changes behavior — `authoring-rules.md` "What to log — minor vs major"), **harvest it into that category's `decision-log.md` before deleting** (one line at the top, newest first; if no log exists, start by copying the `decision-log.template.md` seed into the category folder — `structure.md` "Decision log"; put no old ADR numbers in the prose, only the `current ADR` link). For a **minor evolution** (refining boundary wording, rephrasing, correcting implementation facts), simply delete it (Git preserves the history) — do not put it in the log. **An evolution where a requirement value changed** ("max 20 turns → 30 turns") is not minor — the contract the result must honor changed, so it is a harvest target.
   - **Remove Changelog/History/Revision/Update paragraphs and sub-headings embedded mid-body**: such sections belong to Git, not the ADR body. The fact that this ADR supersedes or replaces another stays as a single line in `Status` and `Related` and is never expanded into body narrative.
   - **Consolidate duplicated or contradictory descriptions of a decision**: when the same decision is described in several places from different points in time, merge them into a single description based on the current code.
   - Reconstruct by rearranging paragraphs to match the standard section order of `README.md` `## ADR template` (Status / Context / Decision Drivers / Decision / alternatives / Consequences / Related) and the per-section authoring rules in `authoring-rules.md`, but **never drop a gray-zone decision (adoption rationale, alternatives, domain rules, state transitions, fallback)** — revive the real rationale and alternatives buried inside the evolution narration and carry them over in the present tense. This is _compression_ of information, not _loss_.
   - However, **when a gray-zone decision contradicts the code, never quietly overwrite the ADR to match the code in the name of narration cleanup** — follow the "Scope of the source of truth" branch below exactly (decision change vs violation).
4. Check gray-zone substance — if the body contains none of (a) alternatives comparison / adoption rationale (b) business rules translated into system behavior (c) domain rules and state transitions (d) external-dependency fallback, that signals the ADR has weak value → record in `Suggestions` as "strengthen the gray zone or consider retiring the ADR".
   4-b. **The regeneration test** (`authoring-rules.md` "What an ADR must satisfy") — ask "if all the code in this category were deleted and only this ADR survived, could requirement-honoring code be rebuilt from it alone?" Differences in implementation, structure, and naming are normal, so ignore them and look **only for missing result contracts** — requirement values, **allowed value sets, transition rules, mandatory fields, ordering, uniqueness, units** (`authoring-rules.md` "Non-numeric requirements"), permission and visibility rules, required validation conditions, state transitions and invariants, and the behavior guaranteed to the user on failure. When you spot an omission, record it in `Suggestions` as `[Missing requirement] <what is missing — which code behavior is the basis>` and confirm with the user to fill it in. This check is the counterpart to the bloat removal in step 3 — sync is not a command that only takes away, it is a command that **keeps the contract whole**.
5. Check Decision Drivers and alternatives ≥ 2 (`authoring-rules.md` "Decision Drivers" / "Alternatives — at least two"):
   - If the Decision Drivers are thin (0-2) or consist entirely of generic quality attributes ("maintainability", "scalability") → record in `Suggestions` as "strengthen the Drivers into discriminating facts and constraints"
   - If there is only one alternative, or they are strawmen → record in `Suggestions` as "add realistic alternatives or consider retiring the ADR" (an already-`Accepted` ADR is the common omission case — record the options that were on the table at the time, even retrospectively)
6. Correct the ADR to match the code — but **what gets matched to the code is decided by "Scope of the source of truth" below.** Correct the ADR to the code for implementation facts and Status; when a gray-zone decision contradicts the code, do not match the ADR to the code but treat it as a decision violation. Update the corresponding adrs[] summary (the one-line Key Decision) in `.mapping.json` as well.

**Caution**: never add new implementation detail to an ADR. An ADR covers only the gray zone between business and code (the rationale for the decision, domain rules, trade-offs) and **the requirement contract the result must honor** — facts discoverable by reading the code that are also not requirements go to the code and its docstrings. Conversely, **a requirement contract missing from the ADR is an omission to be added**, so handle it through step 3's `[Missing requirement]` branch (after user confirmation).

#### Scope of the source of truth — what follows the code and what follows the ADR

"The code is the source of truth" is **limited to implementation facts.** Matching gray-zone decisions to the code as well would let code changes drag ADR decisions along, breaking the one-way PRD → ADR → code direction (`concepts.md` "Verifying the stability gradient"). Distinguish these cases:

- **Implementation facts and Status (code is authoritative)** — the API table, error codes, **enum identifiers and wire representation**, field names, key patterns, and whether the Status exists in code. When these differ from the code, **correct the ADR to match the code.** This is the normal direction in which code naturally leads.
- **Requirement values (the ADR is authoritative — never overwrite them to match the code)** — if the ADR says "max 20 turns" and the code says 30, that is not an implementation fact to correct but a **contract mismatch.** Quietly changing the value toward the code lets the code redefine the requirement. Branch as with gray-zone decisions below (intended change vs violation), ask the user, and record in `Suggestions` as `[Requirement value drift] <category> — ADR "<value>" ↔ code "<value>"`. **When it is judged an intended change, keep the order** — update the ADR's requirement contract to the new value, log one line in `decision-log.md` (a requirement value change is major at minimum), then bring the code to that value. The fact that the code already holds the new value is not a reason to skip updating the ADR — the contract must be recorded as having changed first, so the next reader reads 30 turns as a requirement rather than a coincidence (`authoring-rules.md` "Requirements live in the code and in the ADR").
- **Non-numeric requirements (the ADR is authoritative)** — requirements do not arrive only as numbers (`authoring-rules.md` "Non-numeric requirements"). When **allowed value sets, transition rules, mandatory fields, permissions, visibility, ordering, uniqueness, or units** differ from the code, handle them **exactly** as requirement values above — never quietly change them toward the code; record `[Requirement value drift]` and ask. **Enums split here**: a state name changing from `StatusPaid` to `"PAID"` is an implementation fact above, so correct the ADR to the code; but **allowed states being added or removed, or a formerly forbidden transition becoming allowed, is a contract change**, so never overwrite it to match the code. Lumping it all together as "it's an enum, so the code is authoritative" lets the code redefine a business-defined value set.
- **Gray-zone decisions (the ADR is authoritative)** — the adoption rationale, the alternatives comparison, domain rules, state transitions, external-dependency fallback, and the _intent_ behind the key design. When the code **contradicts** such a decision (e.g. the ADR says "optimistic locking" but the code switched to pessimistic locking), do **not** quietly change the ADR to match the code — this is a signal that someone skipped the ADR-first cycle and changed the decision. Branch into one of the two and ask the user:
  - **An intended decision change** → update the ADR to the current decision so it justifies the code. Editing the body in place to current state is the default, and if that transition is **major** (replacing the adopted alternative, inverting a Driver, changing the core algorithm or architecture) leave one line in the category's `decision-log.md`. Supersede with a new ADR only when the decision topic has branched and the old decision must coexist as a separate record (see `authoring-rules.md` "Changing an ADR — edit-in-place vs supersede"). Record in `Suggestions` as `[Decision changed in code] <category> — the code contradicts the ADR decision. Update the ADR (log to decision-log if major), then realign`.
  - **An unintended violation** → the code broke the decision, so the code is what needs fixing. Leave the ADR as it is and record in `Suggestions` as `[Code violates ADR] <category> — the code diverges from the ADR decision. Consider correcting the code`.
  - Sync never rules on which of the two it is by itself — the authority for gray-zone decisions rests with the ADR, so overwriting the ADR to match the code must never become the default behavior.

### 3.5. Category slice integrity check

Check whether the category keys in `.mapping.json` follow the DDD domain (bounded context) × feature (vertical slice) principle — for the anti-pattern category list, subdomain classification, and cross-cutting conditions see `structure.md` "Common contexts and subdomains".

- **Category key check (both segments)** — if an anti-pattern from `structure.md` "Anti-pattern categories" (technical layer or structural units: `frontend`, `api`, `db`, and so on) appears in either the context folder segment or the feature sub-folder segment (`identity/api`), mark it as drift. Propose realigning to domain and feature units.
- **Slice extractability check** — check whether each ADR's Decision covers one feature's (the leaf — a feature sub-folder or a single-feature context) UI → API → Data as a single slice. If one feature's decisions are scattered across categories (e.g. split into `auth-ui`/`auth-api`), that is drift — propose merging them into one category.
- **Context coherence check (advisory)** — check whether a feature sub-folder sits under a context that does not own its language (e.g. a pricing decision under `identity/`). On a violation, record it as advisory in `Suggestions` — **not as a hard correction** — as `[Context mismatch] <category> — the feature diverges from its context's domain language. Consider moving it to the right context`; domain-boundary judgment belongs to the user, so never move folders automatically.
- **subdomainType display (advisory)** — if a context entry has `subdomainType`, show it in the report as a grouping or annotation (e.g. `generic — a candidate for off-the-shelf replacement`). Never flag its absence as drift — it is optional metadata.
- Record anti-pattern keys and slice-dispersion violations under `Fixed` or `Contradictions Resolved` rather than `Suggestions` — category classification is the trust foundation of the ADR cycle, so never defer it. (Context mismatch and a missing subdomainType are advisory, so they stay in `Suggestions`.)
- **Renaming or merging a category key may leave another entry's `dependsOn` pointing at the old key** — in the same change unit as the realignment, repoint every `dependsOn` reference to the new key (removing the edge if the merge absorbed it into the side it depended on), and confirm with the step 6 `dependsOn` integrity check that no dangling reference remains.

### 3.6. Category bloat check (split recommendation)

Check whether the ADR file count in each feature sub-folder (or directly under a context) has reached the threshold (15) set in `structure.md` "When a context grows — splitting into feature sub-folders". If it has, apply that section's "inspect-and-propose procedure" for deriving feature candidates as written. If a context is already divided into several feature sub-folders and each holds fewer than 15, do not split even when the total is large.

- The sync cycle **never performs the split automatically** — a folder move simultaneously affects cross-references, hook lookup keys, and the adrs[] paths in `.mapping.json`, so it needs the user's agreement.
- Leave the result as a one-line recommendation in the `Suggestions` section, in the form `[Sub-folder split recommended] <category> holds <n> ADRs — candidate sub-features: ...`. If the user agrees on a later cycle, split using the procedure in `structure.md`.
- If evolution-chain signals also appear (several ADRs tied together by `Superseded by` Status), state in the recommendation that **rollup comes first** rather than splitting — scattering a chain into sub-folders makes it harder to trace.

> **Sync does not track PRD changes**: once ALPS (the PRD) has been reflected into ADRs via `/feature-to-adr`, the decision is managed at the ADR level. If the PRD changes later, absorb that change by editing the ADR directly (or superseding it with a new ADR); sync looks strictly at `ADR ↔ code` consistency. adr-writer does not know about ALPS (the plugins are separated per AGENTS.md), so it has no means of inspecting PRD↔ADR drift at all.

### 3.7. Canonicalizing stale Feature-ID naming (propose, then confirm)

ADRs created by the old `/feature-to-adr` (the version that embedded the ID directly in keys and filenames) may carry `fN` in the folder or file name, as in `docs/adr/f1/0001-f1-email-signup.md`. The current rule puts **the Feature ID nowhere — not in filenames, folder names, or the mapping** (`structure.md` "Directory structure", `authoring-rules.md` "Conventions") — the Feature ID is not load-bearing (`/adr-impl` finds targets by category key alone). Sync detects this stale naming and **proposes** the canonical path, moving it **only after user confirmation** — a folder or file move simultaneously affects the git rename, `dependsOn`, and the adrs[] paths in `.mapping.json`, so it is never done automatically.

Handle the two cases **separately** (mixing them would force user judgment even on the safe cleanup that needs no re-key):

- **(1) An `fN` prefix in the filename** (`NNNN-fN-title.md` → `NNNN-title.md`) — leave the category key and folder alone and remove only the `fN-` fragment from the filename. **This is not a renumber, because the number (`NNNN`) is untouched** (renumber is `adr-rollup`'s step alone — see Notes). `dependsOn` references keys, not filenames, so it is unaffected. The only things to update are that ADR's adrs[] path in `.mapping.json` and Related links in other ADRs. Since this is safe cleanup, **propose them in one batch** ("Shall I remove the `fN-` prefix from these 3 filenames to make them canonical?").
- **(2) The folder name / category key is `fN`** (`docs/adr/f1/...`) — propose a re-key to a canonical feature-name-based key. Since you need the name, first gather the basis for candidates: the titles and one-line Decisions of that category's ADRs, and `feature` (the human-readable name) from `.mapping.json`. Refine that into kebab-case and offer a candidate key (`f1` → `login`, or `identity/login`), but **have the user confirm whether to use domain grouping (two segments)** — in line with the importer, sync never invents a domain boundary the PRD did not give. Once confirmed:
  - **Check for a destination collision or a missing parent before moving** (otherwise `git mv` fails or silently creates the wrong nesting):
    - If the destination key/directory (`docs/adr/<canonical>`) or the canonical key in `.mapping.json` **already exists** — `git mv` would push the old folder inside it, creating 3-segment nesting such as `docs/adr/identity/login/f1/...` (a violation of "at most 2 segments", `structure.md`). Do not proceed automatically; stop and ask the user whether this is a merge (absorbed into the existing category) or needs a different name.
    - If you are promoting to two segments but **the parent context folder (`docs/adr/<context>`) does not exist**, `git mv` fails with `fatal: No such file or directory`, so create just the parent first with `mkdir -p docs/adr/<context>` and then move.
  - `git mv docs/adr/f1 docs/adr/<canonical>` (or `docs/adr/<context>/<feature>` for two segments). Remove the filename `fN-` prefix from (1) at the same time. (`git mv` presumes committed files that git tracks — it fails for untracked or uncommitted files, in which case ask whether to proceed with a plain `mv`.)
  - Re-key the category key `f1` → `<canonical>` in `.mapping.json`. The old `fN` simply disappears — the Feature ID is preserved nowhere (it is not load-bearing), and `/adr-impl` keeps matching by the canonical key.
  - **If another entry's `dependsOn` points at the old key `f1`, change them all to the new key** — identical to the renaming rule in 3.5, and the step 6 `dependsOn` integrity check re-confirms no dangling reference remains.
  - Update that ADR's adrs[] path in `.mapping.json` to the new path (`dependsOn` points at keys, so it was already repointed to the new key in the step above).
- **Confirmation format**: before moving, show a table of old path → new path together with the key being re-keyed and the `dependsOn` references that will be updated, and get approval in one pass. If the user declines, leave everything alone and record in `Suggestions` as `[Feature-ID naming] <category> — old fN naming. Canonicalization deferred`.
- Record the cleanup under **Fixed** in the step 7 report, in the form `[Naming] docs/adr/f1/0001-f1-x.md → docs/adr/identity/login/0001-x.md (key f1→identity/login)`.

### 4. Cross-ADR contradiction check

Follow the Related links of each corrected ADR and check the other ADRs:

- Whether they describe the same behavior differently (thresholds, error codes, flow steps)
- Status conflicts: whether a prerequisite category that an `Accepted` (implemented) category points at via `dependsOn` is still `Proposed` (unimplemented) — if the prerequisite is unimplemented, the dependent side may not actually work either. The authoritative dependency relation is `dependsOn` in `.mapping.json`, so treat it as the primary basis and Related links as secondary. Record violations under `Contradictions Resolved` (or `Suggestions` if user judgment is needed).
- If a Related link (or the Decision body) points at another category as a prerequisite but this category's `dependsOn` omits it → the dependency direction may be ambiguous, so do not write it automatically; record in `Suggestions` as `[dependsOn missing] <category> — Related implies prerequisite <X> but it is absent from dependsOn` (matching sync's stance of "propose rather than quietly overwrite").
- A superseded ADR failing to cover all of the old ADR's decisions
- Stale cross-references after a category migration

### 5. Companion document check

Also examine the non-ADR documents an ADR depends on:

- `docs/tables/**` or an equivalent schema document — if an entity relationship changed in the ADR, the same change must be reflected in the table document. Confirm the bidirectional Related links are alive.
- Companion documents such as `docs/adr/<category>/*-data-flow.md` — whether the API tables, example records, and key specifications are aligned with the code.
- `docs/adr/<category>/decision-log.md` (if present) — a lightweight check. It is a convention file, so it is not subject to per-ADR checks, but **(a) is already caught by the harness as `decision-log-link-broken`**, so trust that result and only apply the correction. Check the following: (a) whether each entry's `current ADR` link points at an ADR that exists on disk (if stale after a rollup or split, correct it to the new path — the harness tells you where), (b) whether an old ADR number is embedded in the prose (if so, replace it with the `current ADR` link), (c) whether there are PRD citations (`*.alps.xml`, `ALPS Section`, feature IDs) — remove them if present (the same one-way rule as the ADR body, treated identically to the PRD back-reference item below; note the log is outside check (b)'s grep scope so it is not machine-enforced, hence the manual check here). (d) If it duplicates the current state or carries implementation constants and field tables, strip them — the log records only "what changed and why".
- ADR citations left in code comments, constants, or imports (`// See ADR auth/0002 §1`, `ADR_REF = "auth/0002"`) — **a code → ADR back-reference is forbidden on principle** (`concepts.md` "Dependencies run one way; references are written in neither direction"). **Remove** it rather than correcting it. ADR numbers move through split, rollup, and supersede, so code holding an ADR ID forces a cascade of code edits on a structural change even when the decision did not change. (The code↔ADR link is not stored in the mapping either — locate the related code by reading the ADR each time.)
- PRD citations left in the ADR body (Context and Related included) (`prd/foo.alps.xml`, `ALPS Section 7 #F-AUTH-01`, `Section 6.3`) — **an ADR → PRD back-reference is likewise forbidden on principle** (the same dependency model). Symmetrically with code↔ADR, **remove** it rather than correcting it. adr-writer is standalone and does not reference the PRD, so there is nowhere to move such a citation and nothing to preserve — an ADR absorbs the PRD's motivation once at import time and never points back at it, and the mapping stores no PRD link either. (Record removals under **Fixed** in the step 7 report.)

After the corrections, check the back-references in both directions. **Both sanity greps are bundled into `${CLAUDE_PLUGIN_ROOT}/scripts/adr-invariants.sh` with the same regexes and scope, so run that script rather than retyping path-fragile greps every time**:

```bash
# (a) code → ADR back-references + (b) ADR → PRD back-references (both should be 0 on principle) — prints file:line per violation
bash ${CLAUDE_PLUGIN_ROOT}/scripts/adr-invariants.sh
```

The two checks the script runs internally:

- **(a) Code → ADR back-references** — `ADR <category>/<number>`, `docs/adr/<category>`, or `ADR_REF` left in code or non-ADR documents. Code layout differs per repo (not only `packages/`, `apps/`, `src/` but also `services/`, `cmd/`, `internal/`, `lib/`, or a flat root), so rather than hardcoding paths it sweeps **every authored file** — in a git repo, the tracked files plus untracked-but-not-ignored ones, so `.gitignore` (the repo's own "generated vs authored" declaration) keeps build caches, virtualenvs, and coverage output off the scan; outside git it falls back to a whole-tree sweep minus a list of generated basenames. Results under `docs/adr/` are dropped by a path-prefix post-filter, so ADR ↔ ADR Related links are not false positives (`--exclude-dir` matches only a basename and cannot filter a path like `docs/adr`, which is why the post-filter does that job).

  **Generated output being out of scope is deliberate, and so is hand-written documentation staying in.** A build cache that indexes the repo stores every ADR path verbatim, so scanning it buries the real hits — and a hit there is never actionable, since the fix belongs in whatever produced it. But an authored doc outside `docs/adr/` that cites an ADR number **is** a real finding: those numbers move on split, rollup, and supersede, so the citation goes stale exactly like one in code. Treat such a hit as a genuine violation to report, not noise to filter.

- **(b) ADR → PRD back-references** — `*.alps.xml`, `ALPS Section`, `Section N.N`, or feature IDs left in numbered ADR bodies (`NNNN-*.md`). Because `--include='[0-9][0-9][0-9][0-9]-*.md'` restricts it to ADR bodies, the legitimate ALPS mentions in the seeded rule documents (README, structure, authoring-rules) are not false positives.

Remove the code→ADR back-references found by (a) from the code, moving the linkage to `.mapping.json`, and remove the ADR→PRD back-references found by (b) from the ADR body (adr-writer does not reference the PRD, so there is nowhere to move them) — handle both in the same PR. Since the regexes live in one script, the sync report's **Fixed** section can quote the exact locations (`file:line`) verbatim. A consuming repo can wire this script directly into its own pre-commit or CI as a hard gate (exit 1) — the plugin does not enforce that, and the skill only calls it as advisory.

> **Editing source code outside `docs/adr/` goes through a prior-approval gate**: removing the code→ADR back-references in (a) edits **actual source files** (comments, constants, imports), not ADR documents. `/adr-sync` is model-invocable and can therefore trigger automatically, so unlike corrections to ADR documents, `.mapping.json`, or the README, this source-code edit is applied **only after summarizing the target list (`file:line` plus the reference to be removed) and getting the user's approval once** before writing — the same line as `/adr-new` step 7 and `/adr-rollup` step 8's save gate. On a `--quick` run (check and propose only) or without approval, do not remove anything and record in `Suggestions` as `[Code→ADR ref] <file:line> — ADR back-reference in code. Removal target (approval required)`. ADR body corrections and automatic Status transitions are not subject to this gate (the Status transition follows the same no-confirmation automatic policy as `/adr-impl` — `concepts.md` "Automatic transition rules").

### 6. Mapping and index hygiene

`.mapping.json` is the only ADR index (the README carries no ADR list) — check the following:

- Every ADR file on disk appears in `adrs[]` exactly once
- Every path in `adrs[]` resolves on disk
- Each `adrs[]` entry's `status` matches that ADR body's `## Status` (status-index-mismatch)
- Each `adrs[]` entry has a `summary` (advisory)
- **`dependsOn` integrity** (since `/adr-impl`'s prerequisite gate decides implementation order from this field, a stale value silently misorders a future impl — check it at the same level as the `adrs` array):
  - Whether every `dependsOn` key in each category entry is a category key that exists in `categories` — a dangling key (especially one left over after a category merge or rename in 3.5) is drift.
  - Whether the union of all `dependsOn` edges is an acyclic graph (the schema's "keep acyclic", including the self-edge ban).
  - Record it under **Fixed** when it can be corrected automatically (e.g. reflecting into dependsOn the key rename or merge performed in 3.5 of this same sync), and under **Contradictions Resolved** or **Suggestions** when it needs user judgment (e.g. a cycle was found — the same halt-and-ask framing as `/adr-impl` step 2's "if the dependency graph has a cycle" branch).

### 7. Report

```
## ADR Sync Results (mode: deep|quick)

### Scope
- Categories: <list or "all">
- ADRs inspected: <n>

### Fixed
- [ADR <category>/NNNN: ...] — section X now says Y (reason: <basis>)
- [ADR <category>/NNNN: document cleanup] — removed evolution narration / rewrote in present tense: <what, and how>. Gray-zone decisions preserved: <rationale, alternatives>. (only for the ADRs affected)
- [decision-log <category>] — major transitions harvested: <what>. (only when major narration was moved into the log)

### Contradictions Resolved
- [ADR A ↔ ADR B] — what conflicted and how it was reconciled

### In Sync
- [ADR ...], ...

### Index Hygiene
- .mapping.json changes (path/status/summary)
- decision-log: <lightweight verification result — newest-first order, current-ADR links valid, no PRD citations or old numbers; corrections applied>

### Suggestions
- [New ADR needed?] — a decision found with no ADR
- [Supersede recommended?] — only when the decision topic has branched and the old decision must coexist as a separate record (i.e. when edit-in-place + decision-log cannot hold it — `authoring-rules.md` "Changing an ADR — edit-in-place vs supersede"). A plain decision switch is absorbed by edit-in-place + decision-log, not a supersede
- [Sub-folder split recommended] — <category>: <n> ADRs, candidate sub-features ...
- [Feature-ID naming] — <category>: old fN naming, canonicalization deferred (when the user declined)
- [Missing requirement] — <category>: a contract the code honors (<what>) is absent from the ADR. If it is a requirement, add it with its value and basis (user confirmation required)
- [Requirement value drift] — <category>: ADR "<value/set/rule>" ↔ code "<value/set/rule>". Needs a ruling on whether it was an intended change or a violation (this bucket covers not only numbers but also mismatched allowed value sets, mandatory fields, permissions, and transition rules)
```

## Notes

- An ADR records **why this decision was made.** A small bug fix or style change is not a reason to update an ADR.
- Numbers increase sequentially within a category. A number vacated by a split stays as a gap (never renumber). Sync does not rearrange numbers — closing gaps (renumbering) is a step performed only by `adr-rollup` when it merges a chain and deletes ADRs. **The canonicalization in 3.7 is not a renumber** — removing an `fN-` filename prefix and re-keying a folder leave the number (`NNNN`) untouched, so they do not conflict with the renumber ban above.
- The Feature-ID naming canonicalization in 3.7 only detects and proposes even under `--quick` (the adrs[] paths in `.mapping.json` alone reveal stale naming) — in both modes the actual move happens only after user confirmation.
- What the code is the source of truth for is **limited to implementation facts and Status** — when those conflict with the code, correct the ADR to match it. By contrast, **gray-zone decisions (adoption rationale, domain rules, state transitions, fallback) and requirements (whether numeric, a value set, a mandatory field, or a permission) are the ADR's authority.** Enums split — **names and representation belong to the code, the allowed set and transition rules to the ADR.** When the code contradicts such a decision, do not overwrite the ADR to match it; branch into "decision change vs violation" (see "Scope of the source of truth" under step 3 item 6 above). Matching gray-zone decisions to the code as well would let code changes drag the ADR along and break the one-way direction.
