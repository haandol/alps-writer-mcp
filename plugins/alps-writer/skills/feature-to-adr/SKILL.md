---
name: feature-to-adr
description: Helper — analyze ALPS features, reconcile existing ADR contracts, and delegate each admitted durable decision to adr-writer's /adr-new. A feature may produce zero, one, or several ADRs. Requires an existing ALPS PRD and the adr-writer plugin.
argument-hint: "[category-or-feature-id?]"
---

# feature-to-adr

Analyze ALPS feature specifications at the PRD → ADR handoff. This skill owns ALPS-side feature discovery, requirement transfer, and reconciliation. ADR authoring remains delegated to `/adr-new` in the separate `adr-writer` plugin.

**Cardinality is decision-driven, not feature-driven:** one feature may produce zero, one, or several ADRs. A category is the feature boundary; each ADR inside it is one admitted durable decision.

> **Language**: talk to the user and write ADR content in the language the user writes in. User-facing wording below is guidance, not a literal string.

## 1. Load and validate the ALPS input

Confirm that `/adr-new` is available. If adr-writer is not installed, stop and give the client-specific installation command.

Load:

- the current ALPS document
- the feature-level specification
- the requirements summary, including measurable NFRs and the feature dependency graph
- the high-level architecture constraints
- `docs/adr/.mapping.json` when it exists

Parse the dependency graph before processing features:

- A self-edge is invalid input. Stop and ask the user to correct the graph; never ignore it.
- A cycle is invalid input. Show the cycle and stop before writing ADRs or mapping edges.
- A missing feature referenced by an edge is invalid input. Stop before writing.

The graph describes **feature implementation order**. It is not copied wholesale into ADR `dependsOn`.

## 2. Select the feature queue

- With no argument, inspect every feature in dependency topological order.
- With an argument, inspect that feature and its transitive feature prerequisites in topological order. This expands the analysis scope, but does not force any prerequisite to produce an ADR.
- If the user explicitly asks to inspect only one feature, still show its feature prerequisites as implementation-planning context.

Derive each category key canonically from the feature name. Use a two-segment `<context>/<feature>` key only when the PRD already supplies the grouping or the user explicitly requests it. Never invent a bounded context, and never use a technical layer name as either segment.

## 3. Reconcile an already-mapped feature

Do not silently exclude a feature because its category already exists.

Before classifying any material as a new candidate, run the adr-writer **decision identity check** across the mapping. Start with the feature's category, then inspect plausible summaries and ADR bodies in other categories. Match by the architectural question and owned requirement or system/data/security/external boundary, not by the current provider, product name, adopted alternative, or direction of change.

For every existing or plausible owning category:

1. Read all current ADRs in that category.
2. Compare the current PRD material with the ADR decision and requirement contracts:
   - requirement values and their basis
   - allowed value sets and transitions
   - mandatory fields
   - permissions and visibility
   - ordering, uniqueness, units, and failure guarantees
   - NFRs and architecture constraints that discriminate between alternatives
3. Report:
   - `In sync`
   - `PRD contract changed / Existing decision changed`
   - `New durable decision candidate`
   - `PRD-only detail` that does not pass the ADR admission gate

When an existing decision changed, the user rules that the new PRD requirement or boundary is intended. If confirmed, route it through `/adr-impl <owning-category>` so it updates that exact ADR first, logs a major transition when required, then changes code. Provider replacements and reversals remain the same decision when one current-state ADR can still describe the provider boundary. Use `/adr-new <category>` only when no existing ADR owns the topic or a distinct durable decision must live independently.

This reconciliation belongs to alps-writer. adr-writer remains standalone and never reads the PRD itself. Do not add PRD paths, section numbers, or feature IDs to ADR bodies or `.mapping.json`.

## 4. Discover decision candidates for a new feature

Separate the feature material into candidate decisions before invoking `/adr-new`.

Candidate sources include:

- a requirement contract or domain invariant
- an allowed state set or transition policy
- a system, data, key, deployment, or security boundary
- an external provider/model and its fallback policy
- an adopted algorithm or consistency model
- another durable cross-implementation trade-off

Apply the ADR admission gate independently to every candidate.

- **Pass** → one ADR candidate.
- **Fail** → implementation planning material; do not create an ADR.

Libraries, SDKs, frameworks, middleware, module layout, credential/auth wiring, signers, adapters, and tuning values fail when they can be replaced while preserving the same contract and boundaries.

For every candidate that passes, run the decision identity check against all mapped summaries and plausible ADR bodies before counting it as new. If an existing ADR owns it, classify it as `Existing decision changed` and route it through step 3 instead of `/adr-new`.

Estimate the current Feature and each admitted ADR candidate with the same
internal five-axis comprehension-load rubric: conceptual breadth, contract
density, state and flow complexity, boundary coupling, and uncertainty and
verification burden. Score each axis from 0 to 2 and sum them. Show 1 rather than
0, so the displayed range is 1-10. Do not show or expose the axis scores or
rationale. Show only `Comprehension load: <N>/10`
for each item. Do not write or persist this score in the ALPS document, an ADR,
or `.mapping.json`; it is advisory and does not block drafting, approval, or
implementation.

Show the user a compact decision-discovery result before drafting:

```text
Feature: <name>
Comprehension load: <N>/10
ADR candidates:
- <decision A> — admitted because <durable contract/boundary> — Comprehension load: <N>/10
- <decision B> — admitted because <durable trade-off> — Comprehension load: <N>/10

Implementation-only:
- <choice> — replaceable without changing the contract

Result: 0 | 1 | N ADRs
```

If there are zero admitted decisions, finish that feature without creating a category or placeholder ADR. Keep the feature and its dependency order in the implementation plan.

Only when the user asks to split a high-load item, offer up to three candidates.
Split a Feature only at independently observable user-behavior boundaries.
Split ADR work only when it contains independent decisions; keep one inherently
difficult decision in one ADR and offer implementation steps instead. Never
split by frontend/backend/data layers, and never make splitting a prerequisite.

## 5. Delegate each admitted decision

For each admitted decision, invoke `/adr-new <category>` separately. Never combine independent decisions just because they came from one feature.

Pass:

- the category key
- the candidate decision and its business motivation
- only the PRD material relevant to that decision
- discriminating NFRs and architecture constraints
- requirement values and non-numeric rules verbatim with their basis
- feature-scope hints for locating the vertical slice, without storing code paths

Do not copy user stories or acceptance criteria as prose into the ADR. Extract the motivation, decision pressures, and requirement contract at ADR resolution.

The `/adr-new` path owns drafting, verification, mapping registration, user approval, and the initial `Proposed` Status.

## 6. Record only real ADR prerequisites

After admitted ADRs exist, derive category-level `dependsOn` edges from **decision prerequisites**, not directly from every feature dependency.

Record an edge only when:

- the target category already exists in `.mapping.json`
- the current admitted decision cannot be implemented meaningfully before that target decision
- the edge remains acyclic

If a feature prerequisite has no admitted ADR, leave it out of `dependsOn` and report it as implementation-order guidance. Never create a placeholder ADR to make the graph closed.

If the feature produced no ADR, do not create an empty mapping category.

## 7. Approval and completion

For two or more queued features, show the analysis order once and get one approval. Each admitted ADR still uses `/adr-new`'s own approval.

At completion report:

- features inspected
- existing ADRs updated by category
- ADRs created by category
- features requiring no ADR
- PRD↔ADR contract differences found
- feature dependencies retained only as implementation guidance
- actual ADR `dependsOn` edges written

If the user says "implement without an ADR", apply the admission gate:

- No admitted decision → comply without warning or deferred ADR.
- An admitted decision exists → explain that the contract or boundary must be recorded first. If the user still declines, comply but report the specific unrecorded decision; do not tell `/adr-sync` to manufacture an ADR later from code.
