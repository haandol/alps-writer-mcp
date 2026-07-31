---
name: feature-to-adr
description: Helper — convert ALPS Section 7 feature(s) into Proposed ADR drafts by delegating each feature to the adr-writer plugin's /adr-new. Use only when an ALPS PRD already exists and the adr-writer plugin is installed. Keywords - "/feature-to-adr", "ALPS feature ADR 변환", "Section 7 일괄 ADR".
argument-hint: "[category-or-feature-id?]"
---

# feature-to-adr

A helper that bulk-converts ALPS Section 7 features into ADR drafts. **ADR authoring itself is delegated to `/adr-new` in the separate `adr-writer` plugin**, and this skill acts only as a **thin importer**: it reads the ALPS, builds the feature queue, decides the categories, and hands each feature to `/adr-new`. The dependency runs one way, alps-writer → adr-writer, and adr-writer knows nothing of ALPS.

With an argument it processes **only that one feature**; without one it converts **every Section 7 feature, sequentially.**

> **Language**: this skill and every other harness prompt are written in English, but talk to the user and write the ADR content in the language the user writes in (`authoring-rules.md` "Conventions"). Any user-facing phrasing below is a guide, not a literal string.

## Procedure

### 1. Check the prerequisite and load the ALPS

First confirm **that the adr-writer plugin is installed** — you must be able to invoke the `/adr-new` skill. If it is not, give this guidance and stop:

```
/feature-to-adr delegates ADR authoring to the adr-writer plugin's /adr-new.
Please install adr-writer first.
Codex: codex plugin add adr-writer@alps-writer
Claude Code: /plugin install adr-writer@alps-writer
```

Then load the ALPS:

- Load the current document with `mcp__alps-writer__load_alps_document`.
- Extract the feature list with `mcp__alps-writer__read_alps_section(7)`.
- **Always check Section 6.3, the Feature Dependency Diagram**, with `mcp__alps-writer__read_alps_section(6)`. ALPS holds the dependencies between features as a Mermaid `graph TD` in 6.3 (in the form `F2 -->|depends on| F1`) — that graph is the source of truth for "which feature must be implemented before which." If the graph exists, parse all its dependency edges (they move into the mapping in step 4). If the graph is empty or 6.3 is absent, treat it as having no inter-feature dependencies — never invent them.
  - **Check the graph's integrity immediately after parsing** (topological sorting and recording `dependsOn` presume an acyclic DAG — the mapping schema's "keep acyclic (no self-edge)"). (a) Ignore a **self-edge** (`F1 -->|depends on| F1`) and report one line: `"F1 depends on itself — ignored"`. (b) If there is a **cycle** (`F1 ↔ F2`, or a longer back-edge), topological sorting is impossible, so **stop without starting the queue sort, category creation, or `dependsOn` recording** — tell the user which features are entangled, ask them to break the cycle in Section 6.3 first (amending 6.3 by continuing the existing document with `/alps-init` if needed, or via `mcp__alps-writer__load_alps_document`), and have them re-run. This single check protects both the topological sort below (deciding what to process) and the step 4 `dependsOn` recording, preventing a cyclic graph from being permanently written into `.mapping.json` and blowing up later downstream (`adr-impl`, `adr-sync`).
- Also read Section 6.2 (Non-Functional Requirements) and Section 4.2 (Technology Stack / constraints). These are candidates for the ADR's **Decision Drivers** — measurable NFRs (e.g. "p95 within 3s") and global constraints (e.g. "AWS only", "the team has Node experience only") become the pressures that discriminate between options. Look at each NFR's Scope (`Global` or a Feature ID) and classify which feature's Drivers it should be passed to (handed to `/adr-new` in step 3).
- If there is no ALPS document, tell the user, suggest `mcp__alps-writer__init_alps_document` or `/alps-init`, and stop.

Decide what to process:

- **With an argument**: queue only the one feature matching that category or feature ID. Note that if a prerequisite this single feature depends on in 6.3 has not been converted into an ADR yet, the `dependsOn` you record may become a **dangling reference** pointing at a category key with no mapping entry — `adr-impl` handles that as an unimplemented prerequisite (its step 2 dangling branch), but if you know the prerequisite is unconverted, note in one line that converting all of Section 7 in dependency-closed order (with no argument) would be cleaner.
- **With no argument**: queue **every feature** in Section 7. If the 6.3 dependency graph exists, sort the queue in **dependency topological order** (a dependency target before the side depending on it) — that way, when a category is created, the prerequisite category its `dependsOn` points at already exists. Without the graph, follow the ALPS order of appearance. Exclude from the queue any feature already mapped to an ADR in `docs/adr/.mapping.json` (preventing duplicates on a re-run).
- If the queue is empty, print "there are no new features to convert" and finish.
- If the queue holds two or more, show the user the processing order once and confirm just once: "I will convert every feature into an ADR in this order. Shall I proceed?" After that, each feature pauses only at `/adr-new`'s approval point.

> Steps 2-4 below are **repeated once per feature in the queue, sequentially.** Move to the next feature's step 2 only after that feature's `/adr-new` approval is complete.

> **The PRD is imported only once**: `/feature-to-adr` is a one-time importer that performs the **initial conversion** of ALPS features into ADRs. Once an ADR exists, that decision is **managed at the ADR level** — if the PRD changes later, do not re-import the mapped feature; absorb the change by editing that category's ADR directly (or superseding it with a new ADR). That is why already-mapped features are excluded from the queue on a re-run.

### 2. Decide the category (the importer's responsibility)

Deciding the category key is ALPS-side knowledge, so the importer settles it and hands it to `/adr-new`. An ALPS feature is itself a vertical slice (UI → API → Data) unit, so **one feature maps 1:1 onto one category (a leaf).** However, since folders are organized along two axes, DDD domain (bounded context) × feature (`structure.md` "Directory structure"), whether the category key is single-segment (`auth`) or two-segment (`identity/login`) depends on the grouping decision below. **The key is always derived from the feature name, and an explicit Feature ID is never used as the key** (per the rule below — the ID is stored nowhere).

**Always derive the category key canonically from the feature name** — convert the feature name to kebab-case to make a meaningful category key (e.g. "User Authentication" → `auth`, "Marketplace Listings" → `marketplace`). **The default is a single segment (flat).**

- **Even when an explicit Feature ID (`F1`, `F-AUTH-01`) exists, never use that ID as the category key.** adr-writer does not reference ALPS, so the ID is stored nowhere in `.mapping.json` (once converted, the decision is managed at the ADR level). This is what keeps the canonical ADR structure (`identity/login/0001-...md`, `infra/0001-...md`) intact and prevents `f1` from lingering redundantly in folder and file names.
  - **`/adr-impl` finds its target by category key** — whether it is a canonical feature-name key (`identity/login`) or the literal fallback key below (`f1`), `/adr-impl <key>` matches on that key (`adr-impl` step 1). There is no separate Feature-ID lookup path, so there is no reason to pin the key to the ID.
- **Fallback** — only when there is no feature name, or it is a bare number like `F1` so no meaningful kebab can be extracted, use the lowercased ID (`f1`, `f-auth-01`) as a single-segment key. In that case the value is not a field preserving the Feature ID; it is simply a literal category key.

**Domain (bounded context) grouping — off by default, only on request**: ALPS has no concept of grouping domains above features (in Sections 6.1, 6.3, and 7 alike, the feature is both the smallest and largest unit). So the importer **never invents a domain boundary the PRD did not give** — the same line as the invariant that adr-writer is ALPS-agnostic. Use a two-segment `<context>/<feature>` key in only two cases:

1. ALPS Section 7 already organizes features into groups, epics, or higher-level bundles, so the domain boundary is stated in the PRD — use that group name as the context.
2. The user explicitly requests grouping, e.g. "group these features under `identity`" — confirm it once when building the queue (step 1) or at the progress confirmation, then apply it.

If neither holds, **keeping it flat (single-segment) is the default.** Do not group a single-context or small PRD.

Even when an ALPS feature name includes a technical layer, refine the ADR category into a functional unit name the user recognizes (avoiding the anti-pattern categories `frontend/`, `backend/`, `api/`, `db/` — for both context folders and feature sub-folders).

### 3. Delegate to /adr-new

**Invoke `/adr-new <category>`** with the category you decided, passing that feature's ALPS Section 7 excerpt along as context. Drafting the ADR, verifying it (the `adr-structure-lint` harness plus `/adr-new`'s own R1-R20 pass — it calls no review subagent), writing the `.mapping.json` index record (the adrs[] path, status, summary), saving as `Proposed`, and the user approval are **all handled by `/adr-new` (→ adr-writer).** Do not restate the ADR authoring rules in this skill.

The input handed to `/adr-new`:

- **The category key** — the value decided in step 2.
- **Context material** — the core of ALPS's business motivation, user story, and acceptance criteria.
- **Decision material** — Section 7's user flow / technical description (the vertical slice: user action → API → data flow).
- **Decision Driver candidates** — the NFRs that apply to this feature (those in 6.2 whose Scope is `Global` or this Feature ID) and the global architectural constraints (4.2), as classified in step 1. Pass them through verbatim as measurable constraints (e.g. "p95 within 3s", "AWS only"). `/adr-new` uses these as the starting point for the Decision Drivers that discriminate between alternatives — this is the channel through which the PRD's non-functional requirements become the ADR's decision rationale.
- **Requirement contract material (carry the numbers over verbatim)** — pass the **values** recorded in Section 7's acceptance criteria, user flow, and constraints, and in the 6.2 NFRs (max counts and turns, usage quotas, retention periods, size caps, response targets, permission rules) along with their basis, without summarizing. **Pass the non-numeric requirements too** — the list of allowed states or values and their transition rules, whether an input is mandatory, visibility rules, whether duplicates are allowed, and the unit of money or time (`authoring-rules.md` "Non-numeric requirements"). `/adr-new` records these as the ADR's requirement contract (`authoring-rules.md` "Concrete numbers"). **Never generalize the PRD's numbers into "appropriately" or "in a limited way" when passing them along** — since the ADR never points back at the PRD (a one-way import), blurring them here loses that requirement from the pipeline permanently and the implementation picks an arbitrary value. The same holds for value sets and mandatory fields — summarizing them as "it manages the status" loses which states are allowed.
- **Affected-area hints** — the page and component keywords extracted from the user flow and technical description. They are used in the ADR Decision's vertical-slice description (they are not stored in the mapping as code paths).

Even when an ALPS feature has an explicit ID, never put that ID in the filename, folder name, or category key — the filename `/adr-new` assigns is canonically `NNNN-kebab-title.md`, and the key is feature-name-based. The ID is stored nowhere in `.mapping.json` (adr-writer does not reference ALPS), and `/adr-impl` finds its target by category key, so there is no need to leave a trace of the ID.

### 4. Supplement the dependencies (dependsOn) — the importer's responsibility

After `/adr-new` writes the ADR and fills that category's entry in `.mapping.json` (its `feature`, adrs index record, and so on), the importer additionally records **only the dependencies** that came from the 6.3 graph — adr-writer knows nothing of ALPS (and therefore of the 6.3 graph), so this part is the importer's responsibility. Since `.mapping.json` stores no PRD reference (adr-writer is standalone), the only thing the importer supplements afterward is `dependsOn`:

- That category entry's `dependsOn` — from the 6.3 dependency graph parsed (and integrity-checked) in step 1, record as an array the targets **this feature depends on**, converted to category keys. The 6.3 dependency edges are expressed with Feature IDs (`F3 -->|depends on| F1`), but **`dependsOn` holds each feature's category key (the value decided by name in step 2), not the ID.** Example: if the `checkout` feature (`F3`) depends on the `login` feature (`F1`), put `login` (or `identity/login`) in the `dependsOn` of the `checkout` entry (or `ordering/checkout` when grouping). The Feature ID itself is stored nowhere, so when moving the edges over, convert them using the `Feature ID → category key` correspondence table you built for each feature in this batch (a step 2 artifact). **Even when the 6.3 graph shows this feature has no prerequisite, record `dependsOn` as `[]` — never omit the key.** Having actually checked 6.3, this state is "no dependencies (checked)" rather than "undeclared", and `/adr-impl`'s prerequisite gate treats `[]` (proceed without a notice) differently from an omitted key (a "dependencies undeclared" warning) — the same rule as `/adr-new` step 4. This field is what makes `/adr-impl` enforce implementing prerequisite ADRs first — it is the sole channel through which 6.3's dependencies carry into the ADR cycle, so never leave it out. A dependency edge **may point at a feature in another context** (a relationship between DDD contexts).
  - Before recording, confirm each `dependsOn` key is a category key that **already has a mapping entry (or will be created earlier in this batch)** (the schema invariant "Must reference existing category keys"). A full batch run satisfies this because the step 1 topological sort creates prerequisites first, while for a single-feature run the dangling case above is normal. Since the step 1 integrity check passed, self-edges and cycles never reach this point.
- (Optional) The context-level entry's `subdomainType` — if you applied domain grouping in step 2 and that domain's DDD classification is clear, record one of `core`/`supporting`/`generic` on the context entry. **Omit it** when the PRD gives no signal or the structure is flat — it is advisory metadata, so the mapping is valid while empty, and never force a classification.

```json
{
  "categories": {
    "<category>": {
      "dependsOn": ["<prerequisite category key>"]
    }
  }
}
```

If the queue still holds a next feature, print one line — "continuing with the next feature (`<name>`)" — and return to step 2. When the queue empties, show a summary of the whole conversion (the list of ADRs created) and finish.

### 5. Handling opt-out

If the user explicitly says "just implement it without an ADR", "quick and temporary", "hotfix", or similar:

- Explain the risk in one line (less review burden, more drift).
- If they still want to proceed, suggest writing at least a minimal ADR (Status: `Proposed`, a one-paragraph Decision) with `/adr-new` before moving to code.
- If they refuse to the end, comply. But record it as a deferred item to fill in as an ADR at the next `/adr-sync`.
