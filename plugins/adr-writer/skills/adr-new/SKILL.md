---
name: adr-new
description: Author a new ADR directly (no ALPS PRD required). Drafts a Proposed ADR and records it in the docs/adr/.mapping.json index (path + Status + Key Decision summary). Use when the user invokes /adr-new or asks to write an ADR for a fresh decision (refactor, infra choice, new feature direction). Keywords - "/adr-new", "ADR 새로 작성", "ADR 만들어줘", "draft an ADR", "write a new ADR".
argument-hint: "<category> [title?]"
---

# adr-new

Author an ADR directly. Works without an ALPS PRD — this is the plugin's canonical ADR authoring path, while `/feature-to-adr` is "the helper that auto-converts an ALPS Section 7 feature when one already exists."

> When to use: whenever a decision must be recorded before changing code — a new feature, an infrastructure choice, an architectural direction. The ADR you write can go straight into `/adr-impl`.
>
> **Refactoring is out of scope** — a structural change that does not alter behavior is left to the coding agent's planning step rather than turned into an ADR (`README.md` "What an ADR is not"). If the user tries to record a refactor as an ADR, ask once: "Does this change alter behavior or a decision (the adopted alternative, a state transition, the key design)? If it is pure structural cleanup, planning without an ADR is the better path." If a decision does change, it is not a refactor, so proceed.

> **Language**: this skill and every other harness prompt are written in English, but **talk to the user and write the ADR body in the language the user writes in** (`authoring-rules.md` "Conventions"). The prompts below are phrasing guides, not literal strings to paste.

## Procedure

### 1. Interpret the arguments

- **`<category>`** (required) — a kebab-case category key. Accept all of these forms (see `structure.md` "Directory structure"):
  - **A single-segment context / flat key** (`identity`, `auth`) — a single-feature context (flat), or a cross-cutting decision directly under a context. Derive the key from the feature name. Only for workshop or number-based PRDs where no feature name yields a meaningful kebab do you fall back to an ALPS Feature ID such as `f1` or `f-auth-01` — and even then the ID is not preserved as a separate field; it merely derives this category key.
  - **A two-segment `<context>/<feature>` key** (`identity/login`, `ordering/checkout`) — one feature (vertical slice) inside a bounded context. Use it when a context holds several features.

  For the category rules (top level = bounded context, sub-folder = feature, forbidden categories, cross-cutting and subdomain conditions), see `structure.md` "Directory structure" / "Anti-pattern categories". If the user supplies an anti-pattern category (`frontend`, `backend`, `api`, `db`, and the like — whether as the context folder or the feature sub-folder), ask once: "Does this decision belong to one feature (e.g. `identity/login`, `ordering/checkout`)? If two or more share it, a system-wide cross-cutting context (`infra`, `data`, `integration`, `security`, `platform`) is the better fit."

- **`[title]`** (optional) — if a title arrives as an argument, start from it. Otherwise ask the user once ("Which decision should this ADR record? One line for the title.").

Check the mapping state:

- Create `docs/adr/` if it does not exist.
- If `docs/adr/README.md` (and `authoring-rules.md`, `structure.md`, `decision-log.template.md`) are absent, copy all four of the same files from `${CLAUDE_PLUGIN_ROOT}/templates/adr/`. `decision-log.template.md` is a **read-only seed** — copy it to `docs/adr/<category>/decision-log.md` when that category gets its first major decision change; do not pre-create it in the category folder now (the log exists only after there is a transition to record).
- If `docs/adr/.mapping.json` is absent, create it as an empty skeleton (`{ "categories": {} }`).

Check for category bloat — once the category is settled, follow the inspect-and-propose procedure in `structure.md` "When a context grows — splitting into feature sub-folders". If the target folder (a feature sub-folder or directly under the context) holds 15 or more ADRs, propose a feature sub-folder split once; if the user accepts, write this ADR inside the sub-folder (`docs/adr/<context>/<feature>/`) — the normal path by which a flat key like `pricing` grows into `pricing/<feature>`. If they decline, or there are fewer than 15, continue with the flat structure and do not ask again.

### 2. Elicit the decision's motivation

Writing a good ADR without an ALPS requires the following. Ask briefly, one item at a time:

1. **What problem or need is driving this decision?** (Context)
2. **Which pressures, constraints, or requirements discriminate between the options?** (Decision Drivers — 3-5 of them. Not generic quality attributes like "scalability" or "maintainability" but the facts and constraints that actually decide between options. For the authoring rules see `authoring-rules.md` "Decision Drivers".) If the user answers in one word, prompt once more: "Which of performance, security, cost, complexity, team skills, or schedule is narrowing this decision?"
3. **What choice are you making? One core line.** (Decision)
   - **Collect the values and contracts the result must honor as well** (the requirement contract — `authoring-rules.md` "Concrete numbers" + "Non-numeric requirements"). Even if the user says "that can just go in the code," record it in the ADR too — the value is enforced in code, but **only the ADR records that it is a contract**, which is what later justifies changing the ADR first (`authoring-rules.md` "Requirements live in the code and in the ADR"). **Always ask once**, even unprompted: "Are there values or rules a developer must not decide on their own here? For example a maximum count or number of turns, a usage quota, a retention period, a size cap, a response-time target — and also **the list of allowed states or values, whether an input is mandatory, who may see what, whether duplicates are allowed, and the unit of money or time.**" **Requirements do not arrive only as numbers, so do not stop at probing for numbers.** Carry each answer into the ADR **with its number and basis (policy, contract, regulation) verbatim.** The deciding question is "if a developer changed this value, would that violate a requirement?" — YES makes it a requirement value that must be recorded; NO makes it an implementation tuning value that must not. Classify anything the user answers with "whatever seems right" as a tuning value and leave it out — **never invent a number and record it as though it were a requirement.**

4. **Were other options considered and rejected? Collect at least two realistic alternatives** (see `authoring-rules.md` "Alternatives — at least two"). If the user says "I only thought of this one," ask once: "Was there any other approach that ever reached the table? For instance building it yourself, an external service, or a different library. If it truly was the only path, this may belong in a docstring or README rather than an ADR." If there still are none, the automated review will catch it as BLOCK — never invent a strawman.
5. **Is there another category that must be implemented before this one (a prerequisite)?** (Upstream dependency — e.g. "checkout needs the cart working first".) If so, collect that **prerequisite category key** (otherwise "none"). This answer is stored as `dependsOn` in `.mapping.json` in step 4 and read by `/adr-impl`'s prerequisite gate — the "Prerequisites" line on step 7's confirmation screen comes from here too. In a project that also has an ALPS PRD, `/feature-to-adr` carries dependencies over from Section 6.3, so you need not ask again.
6. **(Optional) Which bounded context does this decision belong to, and what is its DDD subdomain classification?** — ask lightly only when the category is two-segment (`identity/login`) or the user cares about domain classification ("Is this context core to the product's competitiveness, supporting, or generic enough to be replaced by an off-the-shelf product?"). If they answer, store it as the context entry's `subdomainType` in step 4. **If they do not know, or the structure is flat and single-feature, skip the question** — it is advisory metadata and never forced.

If the user answers everything at once, take it as given; if they answer briefly, break it into one or two rounds. If they say they do not know, do not guess — agree on "shall we leave this blank, save as Proposed, and fill it in during /adr-impl?"

### 3. Draft the ADR

Follow `README.md`, `authoring-rules.md`, and `structure.md` under `docs/adr/` strictly (falling back to the same files under `${CLAUDE_PLUGIN_ROOT}/templates/adr/`).

- Category directory: `docs/adr/<category>/` (create it if absent; for flat-structure projects use `docs/adr/` alone)
- Assign the next number within the category. Filename: `NNNN-kebab-title.md` — always canonical form. **Never put an ALPS Feature ID in the filename** (no `0001-f1-...`) — Feature IDs are stored nowhere, and `/adr-impl` matches targets by category key.
- **Fill the `Date:` at the top of the body with the authoring date (`YYYY-MM-DD`)** — it records when the ADR was written and is separate from the Status transition date (`Accepted (YYYY-MM-DD)`). A `Proposed` Status line carries no date.
- **Status always starts as `Proposed`** (`/adr-impl` switches it to `Accepted` automatically after implementation and tests). Never ask the user about promotion — see `README.md` "Automatic transition rules".
- Body structure: Status / Context / Decision Drivers / Decision / alternatives / Consequences / (optional) Implementation Notes / Related. **The four required sections are Status, Context, Decision, and Consequences**, and `adr-structure-lint` hard-checks their presence. Decision Drivers and the alternatives section are strongly recommended (a warning when absent), and Implementation Notes is an optional section kept only when there are architecture-level implementation considerations (matching README's `## ADR template`).
- **Record only the gray zone** — leave out anything discoverable by reading the code that is also not a requirement (function responsibilities, module dependencies, field types, error message wording, logs, env var names, pseudocode, implementation tuning values). The body's center of gravity should be "the motivation behind the decision that the code cannot show": adoption rationale, business rules translated into system behavior, domain rules and state transitions, external-dependency fallback — see `README.md` "What an ADR covers — the gray zone between business and code".
- **Record requirement values verbatim** — put the limits, cycles, caps, and targets collected in step 2 into the `Decision`'s requirement contract (the README template's `### Requirement contract`) with the number and its basis. Do not blur them into "is limited" or "within a reasonable time," and equally do not write them as constant or environment-variable names (`MAX_TURNS = 20` ✗ / "a chat session is capped at 20 turns — pricing policy" ✓). **Record non-numeric requirements in the same place** — allowed value sets, mandatory fields, permissions, visibility, ordering, uniqueness, and units go in as domain sentences, never as enum identifiers (`Status = ["PAID","SHIPPED"]` ✗ / "an order is paid, shipping, delivered, or cancelled, and a cancelled order never moves to shipping" ✓). For the detailed criteria see `authoring-rules.md` "Concrete numbers" and "Non-numeric requirements".
- **Put yourself through the regeneration test once** — after finishing the draft, ask "if all this code were deleted and only this ADR survived, could requirement-honoring code be rebuilt from it alone?" A different implementation is normal, but if a contract that must be honored is missing (requirement values, permission rules, required validation, state transitions, guaranteed behavior on failure), ask the user right there and fill it in — the reviewer's R19 in step 6 checks the same thing.
- **Describe the Decision as a vertical slice** — connect user action → API → data change without a break, in one paragraph or a sequenceDiagram. Covering the UI/API/Data decisions of one feature (the leaf — a feature sub-folder or a single-feature context) together is normal; never split into per-layer ADRs. When async flow or state transitions are central, use stateDiagram-v2 or flowchart.
- **Write it tight, and in the active voice** (`authoring-rules.md` "Prose style"). An ADR is read under time pressure by someone deciding whether to trust it, so every padding word costs the reader attention the decision needed. Use the active voice by default — "the gateway rejects a duplicate payment", not "duplicate payments are rejected" — because the passive drops the actor, and who validates or owns the state is often the decision itself. Cut hedges ("basically", "it is worth noting that") and throat-clearing ("in order to" → "to"; "has the ability to" → "can"), keep one idea per sentence, prefer the concrete noun to the vague one, and state the decision rather than narrating how you reached it. **But never shorten by deleting content** — a dropped requirement value, permission rule, or fallback policy is a defect, not concision.
- For the full forbidden/keep lists see `authoring-rules.md` (the same rules apply inside diagrams).

### 4. Update the mapping

`docs/adr/.mapping.json` (schema: `${CLAUDE_PLUGIN_ROOT}/templates/adr/mapping.schema.json`). The mapping is **the single ADR index** — each ADR is registered once with its path, Status, and a one-line summary. **It stores no ADR↔code paths** (the code is located by reading the ADR each time) **and no PRD reference** (adr-writer is standalone).

```json
{
  "categories": {
    "<category>": {
      "feature": "<the ADR title, or one line representing the category>",
      "subdomainType": "<core|supporting|generic — only when step 2 item 6 was asked and answered>",
      "adrs": [
        {
          "path": "docs/adr/<category>/NNNN-...md",
          "status": "Proposed",
          "summary": "<one-line Key Decision summary>"
        }
      ],
      "dependsOn": ["<prerequisite category key>"],
      "tableDocs": ["<if there was a DB change and you updated docs/tables/, schema.prisma, etc.>"]
    }
  }
}
```

- An `adrs` item is an **object** `{ "path", "status", "summary" }`, not a string. `path` is repo-relative, `status` mirrors the `## Status` of the ADR body you just wrote (so a new ADR always starts as `"Proposed"`), and `summary` is a one-line compression of the Decision (the Key Decision). This record is the ADR index entry (see step 5 for the index's role).
- If the category already has an entry, push the new record object onto the `adrs` array.
- **`dependsOn`** — record, as an array, the category keys the user named as prerequisites in step 2 item 5. This is exactly the field `/adr-impl`'s prerequisite gate reads, in the same category-key id-space. Reference only existing category keys and keep the graph acyclic (never including itself) — see `dependsOn` in `mapping.schema.json`. An edge pointing at a category in another context is normal. If the user answered "none" to item 5, record `dependsOn` as `[]` — the empty array means "explicitly checked, no dependencies," and `/adr-impl` proceeds without a notice. Omitting `dependsOn` entirely makes `/adr-impl` treat it as "dependencies undeclared" and emit a one-line warning, so never omit it on the `/adr-new` path where item 5 was asked.
- **`subdomainType`** (optional) — record it on the context-level entry only when step 2 item 6 was answered (feature sub-folder entries inherit the parent context's classification, so they usually omit it). Omit it for flat or unknown cases — it is advisory metadata and the mapping stays valid without it.
- adr-writer stores no PRD link — even when this ADR came from an ALPS import, `feature` is just a human-readable label, not a PRD back-reference. For an imported category, `dependsOn` is usually filled by `/feature-to-adr` from Section 6.3. Still, if a standalone `/adr-new` call asked step 2 item 5, **record `dependsOn` as `[]` per the rule above even when the user named no prerequisite — do not omit the key** (omitting it makes `/adr-impl` warn about "dependencies undeclared"). Treating `[]` and an omitted key differently maps directly onto `/adr-impl`'s prerequisite-gate split between "no dependencies (checked)" and "undeclared (warning)".

### 5. Update the index

The ADR index is `docs/adr/.mapping.json` — the README no longer holds an ADR list. The `adrs[]` record pushed in step 4 (path + `status:"Proposed"` + summary) _is_ the index entry: its `summary` is the entry point for the next `/adr-sync --quick` and the one index line the UserPromptSubmit hook renders every turn. So the index was already updated in step 4 with no separate edit, and all you need here is to confirm (a) that the one-line `summary` accurately compresses the Decision and (b) that `status` matches the body's `## Status` (= `Proposed`) — see step 4. The README remains a conceptual index only (what an ADR is, the gray zone, the dependency model, the template), so leave it untouched here.

### 6. Automated review — the deterministic harness first, then adr-reviewer

Verify in two stages just before saving. **Run the deterministic harness first** to filter out mechanical rules, then hand **only the judgment rules to adr-reviewer** — so the LLM review does not spend tokens on obvious things like filenames, the Status enum, or section presence.

**(a) The deterministic harness — `adr-structure-lint`**:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-structure-lint.mjs <the category key of the ADR you just wrote>
```

This harness parses the `docs/adr/` this ADR lives in and mechanically verifies the following (grounded in `authoring-rules.md`, `README.md`, and `structure.md`):

- The Status enum and date format (the first half of R1), presence of the required sections (Status/Context/Decision/Consequences), canonical filename (`NNNN-kebab.md`, no stale `fN-` prefix), title number = filename number, path depth ≤ 2 segments
- Anti-pattern category segments (the first half of R5), Decision Drivers count 3-5 (R13), alternatives ≥ 2 (R14), Related links resolving (R10), whether a value is written in code-constant form (R18's format half — the `value-as-constant` warning)
- The `.mapping.json` schema and `dependsOn` integrity (dangling / self-edge / cycles — R16), mapping↔disk consistency (R8), plus the mapping `adrs` record shape (path/status/summary) and status↔body agreement
- Internally it calls `adr-invariants.sh` to also check code→ADR and ADR→PRD back-references (R15/R17)

If there is an `error`, fix it in this session before moving to the save in step 7 (usually resolved by editing the ADR body or the mapping). Handle `warning`s (alternative/driver counts, suspected code references, and the like) together with adr-reviewer's judgment.

**(b) Delegating to adr-reviewer — the rules that need judgment**: once the harness passes (or leaves only warnings), run the reviewer subagent in this order.

1. If the current client can discover the `adr-reviewer` named subagent, invoke it.
2. If no named subagent exists, read `${CLAUDE_PLUGIN_ROOT}/agents/adr-reviewer.md` and run a single **general read-only subagent** with its full text passed as the reviewer instructions. Codex plugins do not register `agents/*.md` as components, so this fallback is the default path.
3. Only on clients where subagents are unavailable at all should the main session carry out the same reviewer instructions itself, noting in one line that isolated review was unavailable.

The reviewer **focuses on the judgment rules** the harness cannot catch — the requirement gate / code-readthrough / litmus filters (R4), gray-zone substance (R12), whether the alternatives are strawmen (R14's quality half), whether the Decision Drivers are discriminating facts rather than opinions (R13's quality half), implementation-detail creep (R3), vertical-slice cohesion (R5's latter half), **missing requirement values and tuning-value intrusion (R18)**, and **the regeneration test (R19 — can requirement-honoring code be rebuilt from the ADR alone once the code is deleted?)**. Since the harness never looks at bare numbers, only the reviewer catches a missing requirement value. It also returns **prose-style suggestions (R20 — voice, padding, sentence length)**, which are advisory: apply the easy rewrites, but never let them block the save, and never accept a cut that drops content.

- Input: the ADR file path, the mapping entry before/after, an ALPS Section 7 excerpt (if any), and **a summary of the harness result (passes and remaining warnings)**
- Output: a `PASS` / `FIX_REQUIRED` / `BLOCK` punch list

If it is not `PASS`, summarize the result for the user and patch the `FIX_REQUIRED` items directly in this session. On `BLOCK`, the ADR needs splitting or a companion document must be updated in the same change, so return to step 3 rather than proceeding to step 7.

### 7. User confirmation

Show the reviewed ADR and mapping in this shape and ask for approval:

```
## ADR <NNNN>: <title>

**Category**: <category key — e.g. identity/login (context: identity, subdomain: core)>
**Decision (summary)**: <2-3 sentences>
**Decision Drivers**: <3-5, one line each>
**Requirement contract**: <the values and rules the result must honor — verbatim, with their basis. "none" if there are none>
**Alternatives considered**: <N options — the adopted one plus those rejected>
**Prerequisites**: <dependency ADRs, or none>

Save this as `Proposed` (unimplemented) and move on to implementation (/adr-impl)? Once implementation and tests pass, `/adr-impl` switches it to `Accepted` automatically.
```

> Show the context/subdomain information on the category line only when step 2 item 6 was asked and answered — otherwise print the category key alone.

Do not start changing code before approval. If the user requests changes, update the ADR and confirm again.

### 8. Point to the next step

After saving, offer the next step in one line:

- "Continue straight into implementation with `/adr-impl <category>`?" — the common flow.
- "If there are more ADRs to write alongside this decision, call `/adr-new <category>` again for the same category."

> **Note**: if an ALPS Section 7 feature already exists and you want to bulk-convert it into ADRs, use `/feature-to-adr`. `/adr-new` is the path for authoring a single decision directly, as it comes up.
