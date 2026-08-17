---
name: adr-impl
description: Implement an ADR — check dependencies first, implement prerequisites in topological order, write code, run tests, apply verified low-risk refactors, complete the adversarial implementation review, then auto-promote ADR Status from Proposed to Accepted. Enforces the ADR-first development cycle. Use when the user invokes /adr-impl or asks to implement an ADR / a Proposed feature whose decision is already recorded. Keywords - "/adr-impl", "ADR 구현", "implement ADR", "Proposed ADR 코드 반영".
argument-hint: "[adr-path-or-category]"
---

# adr-impl

Implements the specified ADR in code, and once the implementation, tests, verified refactor pass, and final implementation review pass, automatically updates the ADR Status to `Accepted`. **If no ADR exists, apply the ADR admission gate first.** Write an ADR with `/adr-new <category>` only for a durable requirement or architectural decision; implement replaceable libraries, SDKs, frameworks, credential/auth wiring, and other code-level choices without creating one. If an ALPS Section 7 feature already exists, batch-convert with `/feature-to-adr`.

> Status semantics: `Proposed` means "the ADR has been proposed but is not implemented", `Accepted` means "implementation complete". This command is responsible for the Status transition at the end.

> **Language**: this skill and every other harness prompt are written in English, but talk to the user and write the ADR body in the language the user writes in (`authoring-rules.md` "Conventions"). Any user-facing phrasing below is a guide, not a literal string.

## Procedure

> **Read the seeded rule docs the repo actually holds before implementing** — `docs/adr/concepts.md` (the abstraction ladder, the gray zone, the requirement contract, Status and its automatic transitions) and `docs/adr/authoring-rules.md`, falling back to the same files under `${CLAUDE_PLUGIN_ROOT}/templates/adr/`. A project may have hand-edited or pinned its copy, and this command both **enforces requirement values at face value** (step 4) and **flips Status** (step 6), so it must act on the rules that repo holds rather than remembered defaults. In a repo seeded before 0.5.0 there is no `concepts.md` — that material sits inside `README.md`, so read it there.

1. **Identify the target ADR**

   Branching by argument:
   - **The argument is a file path** → target that single ADR file. **If the path does not exist on disk**, do not stop immediately — it may have been moved by a rollup renumber, so look for it once:
     - First check on disk for a kebab-title match in the same category directory (`docs/adr/<cat>/*-<title>.md`, the ADR whose post-number string matches) — this works without git and is the simplest.
     - If the match is ambiguous or absent, confirm it via git rename history: `git log --all --diff-filter=R --name-status -- '*<title>.md'` (or grep the old path out of the `git log --all --diff-filter=R --name-status` output) prints the old→new mapping on a single line in the form `R100  docs/adr/<cat>/<old>.md  docs/adr/<cat>/<new>.md` — the clearest signal. (`git log --follow -- <old-path>` on the old path also tracks the rename and shows the commits, but it does not give you the new path at a glance, so use `--diff-filter=R --name-status`.)
     - Once found, confirm with "`<old-path>` was moved to `<new-path>` by a rollup. Shall I implement this file?" and then take the new path as the target. If you still cannot find it, fall back to "Printing the Proposed list" below.
   - **The argument is a category key** (e.g. `auth`, `identity/login`) → match it against the **category keys** in `docs/adr/.mapping.json`. Category keys are derived canonically from the feature name (`identity/login`). A key like `f1` — used when there was no feature name and a purely numeric workshop id was used as the fallback key — is also interpreted as-is; this is literal category-key matching, not a Feature ID lookup (the mapping has no field that holds a Feature ID). If the user gave only the feature segment without the context prefix (`login`) and the same feature name exists in multiple contexts, so it is ambiguous, ask once which context they mean (this happens only rarely, in multi-context repos that use grouping).
   - **When the argument is empty, the match is ambiguous, or there is no mapping / mapping file** — show the list of ADRs in `Proposed` state (not implemented) all at once and ask the user which ADR to implement (the "Printing the Proposed list" procedure below).

   **Procedure for printing the Proposed list**:
   1. If `docs/adr/.mapping.json` exists, iterate over every category. If not, walk `docs/adr/**/*.md` **recursively** (e.g. `find docs/adr -name '[0-9][0-9][0-9][0-9]-*.md'`) to build the ADR file list — it must include **both** flat keys (`docs/adr/auth/0001.md`) and 2-segment feature sub-folders (`docs/adr/identity/login/0001.md`). Do not use a non-recursive glob (`docs/adr/*/*.md`), because it misses 2-segment sub-folder ADRs entirely.
   2. Read each ADR file's `## Status` section and keep only `Proposed` ones (exclude `Accepted`, `Deprecated`, `Superseded`).
   3. Show the user the following format once and take their selection:

      ```
      There are N ADRs that have not been implemented yet. Which ADR should I implement?

      1. identity/login — Email signup (docs/adr/identity/login/0001-email-signup.md)
      2. identity/password-reset — Password reset (docs/adr/identity/password-reset/0001-password-reset.md)
      3. cart — Cart totals (docs/adr/cart/0003-cart-totals.md)

      Answer with a number or a category key (e.g. `identity/login`). To implement several at once, answer like "1,2" or "identity/login, cart".
      ```

   4. Once the user answers, take that selection as the category argument and go back to the beginning of step 1.
   5. **If there are 0 Proposed ADRs**, tell the user _"Every ADR is already implemented. To record a new decision, write the ADR first with `/adr-new <category>`. You can also use `/feature-to-adr` to batch-convert ALPS Section 7 features."_ and finish.
   6. **If there is not a single ADR on disk at all**, tell the user _"There are no ADRs yet. Write one directly with `/adr-new <category>`, or if you have ALPS Section 7 features, convert them with `/feature-to-adr` and call this again."_ and finish.

   Once the target ADR is identified, check its current Status — this command handles the `Proposed → Accepted` transition automatically. If an ADR that is already `Accepted` is given as the implementation target, apply the ADR admission gate to the requested change before treating it as an ADR change. A replaceable library, SDK, framework, middleware, module layout, credential provider chain, signer, or authentication adapter change leaves the ADR and its Status untouched; scope it in the implementation plan instead. If an admitted decision or requirement changed, classify from the request whether the intent is a partial change or reinforcement; if that distinction is ambiguous, carry the one unresolved question into the single step 3 baseline approval instead of asking separately here. At this point, apply the **decision identity check**: the target remains the owner when it still answers the same architectural question and owns the same requirement or system/data/security/external boundary, even if the provider, adopted alternative, Decision Drivers, or direction changed. If **the decision itself changed because of a requirement or architectural change** (not a mere implementation correction — for the judgment call see `authoring-rules.md` "Changing an ADR — edit-in-place vs supersede"), reflect the new decision in that ADR body as the current state (edit-in-place), revert Status to `Proposed`, and proceed with this implementation. A GPT-5.6 provider change from Amazon Bedrock to the OpenAI API, and a later return to Bedrock, both update the same provider-boundary ADR when one current-state record still describes the choice. During that rewrite, apply `authoring-rules.md` "Final-state wording": state the requested result directly in the body and mapping summary, and remove replaced identifiers, previous values, and migration narration that add no current contract. Keep rejected choices in Alternatives and major old → new history in `decision-log.md`; never delete a current prohibition that passed the requirement gate. **A request that changes only a requirement value or rule ("max 7 turns → 10 turns", "retention 30 days → 90 days") also falls here** — even though it looks like editing a single constant in the code, a system behavior requirement has changed, so do not touch the code first; update the ADR's requirement contract to the new value first (`authoring-rules.md` "Requirements live in the code and in the ADR") (after the tests and step 6 completion review pass, step 7 will auto-promote it back to `Accepted` — `concepts.md` "Automatic transition rules"). If that decision change is **major** (swapping the adopted alternative, reversing a Driver, changing the core algorithm/architecture, changing an external provider, reverting to a former provider, or a bug fix that changes behavior — `authoring-rules.md` "What to log — minor vs major"), leave a one-line entry in the category's `decision-log.md`. Judge it a supersede **only when the decision topic has branched and the old decision must coexist as a separate record**; in that case create a new ADR with `/adr-new`, leave the old one as `Superseded`, and take that new ADR as the implementation target (a supersede is also major, so log it).

   **Every Status transition in this workflow must use the deterministic status script.** Do not edit a Status value with `apply_patch`, regex replacement, or a search for the first matching string — `.mapping.json` commonly contains many identical `Proposed` or dated `Accepted` values. After updating the ADR decision text, use:

   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-status-transition.mjs <target-adr-path> Proposed --summary "<current one-line decision summary>"
   ```

   The script addresses the mapping record by its exact ADR `path`, requires exactly one match, refuses a pre-existing body/index mismatch, and updates the body and index together.

   **Once the target is identified, never go straight to step 3 (planning) under any circumstances. You must perform the step 2 dependency check first.** Whether it is a single ADR or the user picked several at once like `1,2` / `f1, f2`, step 2 is taken without exception.

2. **Dependency check (prerequisite ADR gate) — a mandatory step that cannot be skipped**

   Features depend on each other — for example, implementing "checkout (`checkout`)" is only meaningful once "cart (`cart`)" already works. If you ignore this dependency and start with the requested ADR, you stack code on top of a missing prerequisite and diverge from the real order of operation. So **look at dependencies before implementing or planning — this step cannot be omitted or deferred.** (The category keys in the examples below are name-based canonical keys, and the target is specified with such a key.)
   - Read `dependsOn` from the target category's entry in `docs/adr/.mapping.json` (this value was carried over from ALPS Section 6.3 Feature Dependency Diagram by `/feature-to-adr`, or recorded directly as a prerequisite by `/adr-new` at authoring time).
     - If the entry exists but **the `dependsOn` key itself is absent** — no dependency has been declared. Say in one line, "This ADR does not declare `dependsOn`, so I'm proceeding without a prerequisite check — if there are prerequisite ADRs, fill them in via `dependsOn` in `.mapping.json` or via `/feature-to-adr`", then proceed to step 3 (do not silently treat "no dependencies" and "dependencies undeclared" as the same thing).
     - If `dependsOn` is an **empty array (`[]`)**, that is an explicit, completed check that there are no dependencies, so proceed to step 3 without any notice.
   - If `dependsOn` has keys, walk the graph **one node at a time to visit the transitive prerequisite categories** (e.g. `checkout` → `cart` → `identity/login`). If any node you visit is a **dangling reference** (no `.mapping.json` entry, or not a single ADR file on disk), stop right there — transitive expansion requires reading that node's entry and `dependsOn` to move to the next hop, so if an intermediate node is dangling you cannot reach the deeper prerequisites (which is why you check at every hop rather than "after collecting everything"). If it is not dangling, read that node's `dependsOn` to expand into deeper prerequisites, and check the visited node's ADR Status.
   - **When you hit a dangling reference** — stop the implementation and repair the mapping before proceeding. Do not create a placeholder ADR merely because a feature prerequisite exists: `/feature-to-adr` records only real admitted decision prerequisites, while feature-only ordering belongs in the implementation plan.
   - **If every prerequisite ADR is `Accepted` (implementation complete)**, the dependencies are satisfied, so proceed to step 3 as-is.
   - **If even one prerequisite ADR is `Proposed` (not implemented), stop the downstream implementation.** Rebuild the target list in dependency topological order (deepest prerequisite first) and implement those prerequisites before returning to the requested target. User confirmation cannot turn an unimplemented prerequisite into a completed one.
   - **When there are multiple target ADRs (whether the user picked several directly or you added prerequisites above), always topologically sort them by the `dependsOn` graph and implement from the deepest prerequisite in order.** Do not simply follow the order the user typed (`checkout, identity/login, cart`) — dependency order takes precedence over input order. Show the sorted implementation order to the user in one line ("Implementation order: identity/login → cart → checkout") and proceed.
   - If the dependency graph has a cycle (e.g. `cart` ↔ `checkout`), topological sorting is impossible, so stop the implementation, report which categories are entangled, and require the dependency model to be corrected before implementation.

     ```
     `checkout` depends on `cart`, but `cart` is not implemented yet (Proposed).
     By dependency order, `cart` has to be implemented first for `checkout` to work properly.

     Implementation order: `cart` → `checkout`.
     The downstream ADR remains blocked until `cart` is `Accepted`.
     ```

   - If this is a legacy ADR set where `.mapping.json` itself is missing or the target category has no entry at all, the dependencies are unknowable, so skip the gate — but say in one line, "There is no dependency information, so I'm skipping the ordering check (you can fill it in via `/feature-to-adr` or `dependsOn` in `.mapping.json`)". (The case where the entry exists but only the `dependsOn` key is missing is handled by the "dependencies undeclared" branch above, not by this legacy case.)

3. **Build the plan**
   - Extract the vertical slice from the ADR's Decision / Mermaid diagram (UI → API → data). One ADR covers the whole slice of one feature (a leaf — a feature sub-folder or a single-feature context), so scope the implementation plan as a unit that changes the UI/API/Data layers **together** within that same feature.
   - If the category is set up as an anti-pattern category (`frontend/`, `backend/`, `api/`, `identity/api`, etc. — in any segment, context or feature; see `structure.md` "Anti-pattern categories") so that vertical slice extraction is impossible, stop the implementation and recommend re-aligning the categories with `/adr-sync`.
   - `Glob`/`Grep` on keywords from the ADR's Decision to find and read the relevant existing code and identify the gaps (code locations are not in the mapping, so read the ADR and search directly — `structure.md` "Finding the related code"). Check whether the UI/API/Data code of the same feature is gathered in one place.
   - Before presenting the plan, evaluate five internal axes from 0 to 2 and sum them to 1-10: conceptual breadth, contract density, state and flow complexity, boundary coupling, and uncertainty and verification burden. Do not show or expose the axis scores or rationale; add only `Comprehension load: <N>/10` to the plan. Do not write or persist this score in the ADR, `.mapping.json`, Status, code, or review artifacts. It is advisory and does not block approval or implementation.
   - Only when the user asks to split, offer up to three candidates. First preserve the abstraction ladder: split an ALPS Feature only at an independently observable user-behavior boundary, and split an ADR only when it contains independent decisions. Never split by technical layer.
   - If a Feature or ADR split is inappropriate but the user still wants lower review load, offer a **Stacked PR delivery fallback** for the implementation steps. Keep one inherently difficult decision in one ADR. Order the PR layers by dependency, give each layer one review question and the tests that verify that layer, and make the full Stack implement the same approved ADR contract.
   - Do not automatically propose or create a Stack because the comprehension score is high. Do not write or persist the Stack plan, branch relationships, or review state in the ADR, `.mapping.json`, Status, or a registry. They are ephemeral delivery information.
   - Create or publish the PR Stack only when the user explicitly asks for publishing and the current environment exposes the required GitHub Stack capability. Detect capability at execution time rather than embedding provider commands in this skill. If it is unavailable, keep the dependency-ordered implementation steps without forcing a GitHub workflow.
   - When the user chooses Stacked PR delivery, implement each cumulative branch in dependency order and verify its review question before moving upward. Individual layers do not complete or promote the ADR; keep it `Proposed` until the complete Stack passes the final tests and step 6 implementation review.
   - Present the change plan to the user and get approval.
   - When this cycle changes an existing ADR, lead that approval with a **semantic diff** grouped by `Decision`, `Requirement contract`, `Decision Drivers`, and `Consequences`. Preserve exact requirement values and rules. Mark inspected but unaffected groups `Unchanged`, and mark anything not established by the available evidence `Unverified` — never present `Unverified` as `Unchanged`. Show the full revised ADR only when the user asks or when the diff cannot expose a material ambiguity. The semantic diff is ephemeral and never becomes a second authoritative artifact.
   - When this cycle created an ADR or changed an existing ADR's decision or requirement contract, include an **implementation intent baseline** in that same approval:
     - the current Decision and Decision Drivers
     - every numeric and non-numeric requirement-contract row with its basis
     - the written regeneration checklist from `/adr-new` or the edit-in-place rewrite
     - explicit out-of-scope items and any risk tolerance the ADR records
   - Treat baseline approval as **once per ADR revision**, not once per command. If `/adr-new` or `/feature-to-adr` already obtained approval for this exact ADR content and the ADR has not changed, reuse that approved baseline and do not ask the intent/regeneration question again; only obtain normal approval for the implementation plan. Otherwise ask once whether the current-state baseline matches the user's intent and is complete enough to rebuild requirement-honoring code. Resolve omissions now, before code, and record the approved baseline for the completion review. Do not repeat this routine confirmation after implementation unless the ADR changes or review discovers a real contract ambiguity.

   If you decided to implement multiple ADRs in order (when prerequisites were added in step 2), repeat steps 4–6 below **one ADR at a time, starting from the deepest prerequisite in dependency topological order** — only after a prerequisite becomes `Accepted` do you move on to step 4 for the next ADR.

4. **Implement**
   - Edit/Write in small units.
   - Follow the behavior rules, state transitions, and integration methods stated in the ADR exactly. To implement something differently from the ADR, change the ADR first.
   - **Enforce the requirement values the ADR records, at face value** — do not arbitrarily change or "roughly approximate" limits, quotas, intervals, retention periods, ceilings, or targets; actually put in the code that enforces those values (ceiling checks, counters, expiry handling). **Non-numeric requirements are the same** — enforce exactly the allowed value sets, transition rules, mandatory-ness, permissions, visibility, ordering, uniqueness, and units that the ADR fixed (do not add a state that is not allowed, do not open a forbidden transition, and do not turn a required input into an optional one). Enum identifier names are at your discretion, but **the set and the transition rules are the contract**. If a reason arises to change a value, do not fix the code first — update the ADR first (a requirement value change is at minimum major, so also leave a one-line entry in `decision-log.md` — `authoring-rules.md` "What to log — minor vs major").
   - **Values the ADR does not state are implementation discretion** — connection pool size, backoff, cache TTL, worker count, and so on are yours to choose freely, and you do not write those values back up into the ADR.
   - **Replaceable implementation means are implementation discretion too** — libraries, SDK clients, frameworks, middleware, module structure, credential provider chains, signers, and adapters remain in code when the same requirement contract, system/security boundaries, and trade-offs still hold. Choosing or replacing them does not create a new ADR and does not amend this one.
   - Material implementation choices are derived once from the final code by the sufficiency review and are never written into the ADR.
   - Apply the admission gate to each choice before classifying it. A choice that changes a requirement contract or durable system/data/security boundary is not implementation discretion: stop and update the ADR first. A replaceable choice remains in the ephemeral ledger. If the actual value, behavior, or basis cannot be confirmed, do not invent it; pass it to review as an `Unverified risk`.
   - **Let the code and the tests carry the explanation; keep comments to three lines or fewer.** A long comment block is a signal that behavior which should be _executable_ is being described in prose — prose drifts silently as the code changes, while a test fails loudly. So when an explanation grows past roughly three lines, do not expand the comment: leave a one- or two-line summary of the _why_ at that spot and move the _what_ into tests.
     - **What moves into a test**: each case the comment enumerated becomes its own test with a name that reads as the sentence the comment was trying to write — the boundary and edge cases, the ordering or state-transition sequence, why a forbidden input is rejected, the failure and fallback paths, and every requirement value (assert the number itself, so "max 20 turns" is verified as 20). A reader should be able to open the test file and recover what the deleted comment said.
     - **What stays as a comment**: only what code and tests cannot express — the _why_ behind a non-obvious choice, a constraint imposed from outside (a spec quirk, an upstream API's behavior, a browser or platform bug), and a warning about a trap that looks safe. A comment that merely restates _what_ the line does is deleted rather than shortened.
     - **Never trade coverage for brevity** — the goal is to move the explanation into an executable place, not to delete it. If you cannot write the test for some case, keep the comment (over three lines is fine) and say so in the step 7 report rather than dropping the knowledge.
     - Follow the surrounding code's comment density and style over this rule when the project's conventions (`AGENTS.md`, `CONTRIBUTING.md`, `CLAUDE.md`) or the sibling files already settle the question.
   - If, mid-implementation, you judge that a gray-zone decision in the ADR (adoption rationale, domain rules, state transitions, fallback) needs to change, re-run the ADR admission gate first. If only a replaceable implementation means changes, continue in code without touching the ADR. If an admitted decision changes, do not fix the code first — stop and branch with the user on "is this an intended decision change, or is honoring the ADR the right call?" — if it is a decision change, update the ADR to the current decision first (edit-in-place; if the decision topic branches, supersede with a new ADR) and put it in the same commit; otherwise implement per the ADR. If that change is **major** (`authoring-rules.md` "What to log — minor vs major"), also leave a one-line entry in the category's `decision-log.md` — the log entry is added **at the moment you change the decision** (which is separate from the automatic Status transition in step 6 — the log records the decision, Status records the fact of implementation). If code silently drags a gray-zone decision along, the one-way PRD → ADR → code flow breaks (the same framing as `adr-sync` "Scope of the source of truth").

5. **Test**
   - Run the project's test command (see `AGENTS.md` or `package.json`).
   - **Write the tests so they read as the documentation** — they are where step 4 moved the explanation, so they carry that load only if a reader can learn the behavior from them. Name each test as the sentence it proves ("a cancelled order cannot move to shipping", not "test transition 3"), keep one behavior per test so a failure names the broken rule by itself, and where a case exists for a non-obvious reason, put that _why_ in a short comment above it — that is the sentence the deleted code comment used to hold.
   - If there are no tests, ask the user what verification procedure they want.
   - If tests fail, do not move on to step 6 — if it is an implementation bug go back to step 4; if the ADR made the wrong decision, fix the ADR first and then go back to step 4.
   - Once the initial implementation tests pass, run `/adr-impl-refactor <category>` **before** Status promotion. Its dedicated read-only reviewer examines execution efficiency, complexity, coupling, duplication, and proportionate reuse. The main session applies only high-confidence, local, behavior-preserving candidates whose related tests pass before and after; every wider, weakly verified, or speculative opportunity remains a proposal.
   - A critical refactor finding does not bypass that safety gate. Changes to public contracts, schemas, dependencies, state or transition rules, permissions, validation, concurrency, transactions, fallback, resource lifetime, or error semantics are never automatic refactors.
   - If `/adr-impl-refactor` applied any code change, rerun the **full project test command** on the resulting code. Targeted before/after tests establish that each patch is locally safe; the full rerun establishes that the implementation as a whole is still complete. If it fails, do not move to step 6 — undo or correct only the refactor introduced in this pass, then rerun the tests.
   - Keep `/adr-impl-refactor`'s proposal-only items in the wrap-up. They are advice, not incomplete implementation, unless one exposes an ADR violation or a concrete functional defect that belongs back in step 4.

6. **Final implementation review (completion gate)**
   - After the final tests, verify the ADR / mapping structure with the deterministic harness:

     ```bash
     node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-structure-lint.mjs <implemented category key>
     ```

     This check mechanically catches malformed ADR/index state, broken dependencies, and new ADR back-references before the adversarial review spends model work on an invalid baseline. If an `error` comes out, fix it before continuing.

   - Select the completion-review mode from the final diff. Use `full` when requirement values or rules, public API/wire form, schema/persistence, state/transitions, permissions/visibility, security, external fallback, concurrency, transactions, resource lifetime, error semantics, bounded contexts, or broad modules changed; use `standard` only for localized implementation that changes none of those surfaces. If classification is unclear, use `full`.
   - Run `/adr-impl-review <category> --mode <standard|full>` on the **refactored final code while the target remains `Proposed`** (report only — it does not modify code or ADRs). This invocation is the selected completion review, not a partial-review request. Pass the approved implementation intent baseline. Do not pass it the refactor review or result artifacts. Standard mode independently checks the decision ledger with a sufficiency reviewer and targeted tests; full mode adds independent necessity and sufficiency reviewers plus detailed evidence artifacts. Neither mode repeats the routine intent/spec-fitness confirmation after implementation.
   - `PASS` proceeds to step 7.
   - On `FIX_REQUIRED`, keep the ADR `Proposed` and automatically apply evidence-backed changes that do not alter the approved ADR contract: code fixes for `Spec violation`, tests for `Test gap`, `Best practice` items weighted `now`, high-confidence local `Unnecessary change` / `Simpler alternative` / `Refactor` items, and `/adr-sync <category>` for a confirmed `Impl-fact mismatch`. Record every applied item, rerun the affected tests, then rerun the same review mode. Do not ask the user to approve each repair.
   - Ask the user only when a finding requires a new or changed ADR decision, presents contradictory premises, leaves a material risk unverified, or requires a destructive/broad change outside the approved scope. `BLOCK` and unresolved `INCONCLUSIVE` remain `Proposed`.
   - An already-`Accepted` ADR reviewed for a behavior-preserving reinforcement keeps its existing Status when the new work is not merged; if the decision or requirement contract changed, step 1 already returned it to `Proposed`.

7. **Automatic Status transition and wrap up (`Proposed → Accepted`)**

   For the detailed policy see `concepts.md` "Automatic transition rules". Only after the step 6 review returns `PASS`:
   - Without asking the user, run the deterministic transition command:

     ```bash
     node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-status-transition.mjs <target-adr-path> "Accepted (YYYY-MM-DD)" --summary "<current one-line decision summary>"
     ```

   - The script updates the Status line in the target ADR body and the `status` of the exact matching `adrs[]` record in `.mapping.json` together. It fails instead of guessing when the path is absent, duplicated, or already inconsistent.
   - If several ADRs in one category were implemented together, update all of them only after each one's completion review passes.
   - Run `adr-structure-lint` once more after the transition to verify the dated Status format and body/index lockstep.
   - Tell the user the work is complete. Summarize the final review mode and verdict, tests run, any findings automatically fixed, deferred advisory items, and the ADR's `Accepted` transition. Do not ask for another approval when no unresolved decision or material risk remains.

**Forbidden**:

- Do not jump straight to planning/implementation without the dependency check (step 2) — even a single ADR must pass the prerequisite gate first.
- Do not start with a downstream ADR while a prerequisite ADR is unimplemented (`Proposed`).
- Do not implement multiple ADRs in input order — always implement in `dependsOn` topological order (prerequisites first).
- Do not implement a new requirement or architectural decision that passes the ADR admission gate without an ADR. Replaceable implementation means are exempt.
- Reflect any decision change discovered during implementation in the ADR before modifying the code.
- Do not promote an ADR to `Accepted` when tests have not passed — Status is a fact about code behavior, not a declaration of intent.
- Do not promote an ADR before the verified refactor pass, required final test rerun, and final implementation review all pass.
- Do not edit ADR Status fields or mapping statuses manually. Always use `adr-status-transition.mjs` with the exact target ADR path.
