---
name: adr-impl
description: Implement an ADR — check dependencies first, implement prerequisites in topological order, write code, run tests, then auto-promote ADR Status from Proposed to Accepted. Enforces the ADR-first development cycle. Use when the user invokes /adr-impl or asks to implement an ADR / a Proposed feature whose decision is already recorded. Keywords - "/adr-impl", "ADR 구현", "implement ADR", "Proposed ADR 코드 반영".
argument-hint: "[adr-path-or-category]"
disable-model-invocation: true
---

# adr-impl

Implements the specified ADR in code, and once the implementation and tests pass, automatically updates the ADR Status to `Accepted`. **If no ADR exists, write the ADR first and then proceed** — for the general case write it directly with `/adr-new <category>`, and if an ALPS Section 7 feature already exists, batch-convert with `/feature-to-adr`.

> Status semantics: `Proposed` means "the ADR has been proposed but is not implemented", `Accepted` means "implementation complete". This command is responsible for the Status transition at the end.

> **Language**: this skill and every other harness prompt are written in English, but talk to the user and write the ADR body in the language the user writes in (`authoring-rules.md` "Conventions"). Any user-facing phrasing below is a guide, not a literal string.

## Procedure

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

   Once the target ADR is identified, check its current Status — this command handles the `Proposed → Accepted` transition automatically. If an ADR that is already `Accepted` is given as the implementation target, confirm once with the user whether the intent is a partial change / reinforcement, then proceed. At this point, if **the decision itself changed because of a requirement change** (not a mere implementation correction — for the judgment call see `authoring-rules.md` "Changing an ADR — edit-in-place vs supersede"), reflect the new decision in the ADR body as the current state (edit-in-place), revert Status to `Proposed`, and proceed with this implementation. **A request that changes only a requirement value or rule ("max 7 turns → 10 turns", "retention 30 days → 90 days") also falls here** — even though it looks like editing a single constant in the code, a system behavior requirement has changed, so do not touch the code first; update the ADR's requirement contract to the new value first (`authoring-rules.md` "Requirements live in the code and in the ADR") (after the step 5 tests pass, step 6 will auto-promote it back to `Accepted` — `README.md` "Automatic transition rules"). If that decision change is **major** (swapping the adopted alternative, reversing a Driver, changing the core algorithm/architecture, a bug fix that changes behavior — `authoring-rules.md` "What to log — minor vs major"), leave a one-line entry in the category's `decision-log.md`. Judge it a supersede **only when the decision topic has branched and the old decision must coexist as a separate record**; in that case create a new ADR with `/adr-new`, leave the old one as `Superseded`, and take that new ADR as the implementation target (a supersede is also major, so log it).

   **Once the target is identified, never go straight to step 3 (planning) under any circumstances. You must perform the step 2 dependency check first.** Whether it is a single ADR or the user picked several at once like `1,2` / `f1, f2`, step 2 is taken without exception.

2. **Dependency check (prerequisite ADR gate) — a mandatory step that cannot be skipped**

   Features depend on each other — for example, implementing "checkout (`checkout`)" is only meaningful once "cart (`cart`)" already works. If you ignore this dependency and start with the requested ADR, you stack code on top of a missing prerequisite and diverge from the real order of operation. So **look at dependencies before implementing or planning — this step cannot be omitted or deferred.** (The category keys in the examples below are name-based canonical keys, and the target is specified with such a key.)
   - Read `dependsOn` from the target category's entry in `docs/adr/.mapping.json` (this value was carried over from ALPS Section 6.3 Feature Dependency Diagram by `/feature-to-adr`, or recorded directly as a prerequisite by `/adr-new` at authoring time).
     - If the entry exists but **the `dependsOn` key itself is absent** — no dependency has been declared. Say in one line, "This ADR does not declare `dependsOn`, so I'm proceeding without a prerequisite check — if there are prerequisite ADRs, fill them in via `dependsOn` in `.mapping.json` or via `/feature-to-adr`", then proceed to step 3 (do not silently treat "no dependencies" and "dependencies undeclared" as the same thing).
     - If `dependsOn` is an **empty array (`[]`)**, that is an explicit, completed check that there are no dependencies, so proceed to step 3 without any notice.
   - If `dependsOn` has keys, walk the graph **one node at a time to visit the transitive prerequisite categories** (e.g. `checkout` → `cart` → `identity/login`). If any node you visit is a **dangling reference** (no `.mapping.json` entry, or not a single ADR file on disk), stop right there — transitive expansion requires reading that node's entry and `dependsOn` to move to the next hop, so if an intermediate node is dangling you cannot reach the deeper prerequisites (which is why you check at every hop rather than "after collecting everything"). If it is not dangling, read that node's `dependsOn` to expand into deeper prerequisites, and check the visited node's ADR Status.
   - **When you hit a dangling reference** — this is the case where `dependsOn` points at a prerequisite that has not been converted/authored yet (it happens especially when `/feature-to-adr` was run with a single feature argument). Stop the implementation just as you would for an unimplemented prerequisite, tell the user that the prerequisite has no ADR at all, and direct them to write it directly with `/adr-new <category>` or convert that feature with `/feature-to-adr`.
   - **If every prerequisite ADR is `Accepted` (implementation complete)**, the dependencies are satisfied, so proceed to step 3 as-is.
   - **If even one prerequisite ADR is `Proposed` (not implemented), stop the implementation**, tell the user what is needed first, and take their selection. If the user decides to implement the prerequisite first, rebuild the target list in dependency topological order (deepest prerequisite first) and add it to the step 1 identification result.
   - **When there are multiple target ADRs (whether the user picked several directly or you added prerequisites above), always topologically sort them by the `dependsOn` graph and implement from the deepest prerequisite in order.** Do not simply follow the order the user typed (`checkout, identity/login, cart`) — dependency order takes precedence over input order. Show the sorted implementation order to the user in one line ("Implementation order: identity/login → cart → checkout") and proceed.
   - If the dependency graph has a cycle (e.g. `cart` ↔ `checkout`), topological sorting is impossible, so stop the implementation, report which categories are entangled with each other, and ask the user where to cut in and start.

     ```
     `checkout` depends on `cart`, but `cart` is not implemented yet (Proposed).
     By dependency order, `cart` has to be implemented first for `checkout` to work properly.

     - To implement in order starting from `cart`: "start with cart" or "both, in order"
     - To implement only `checkout` first anyway: "checkout only" (some behavior may be empty because the prerequisite is unimplemented)
     ```

   - If this is a legacy ADR set where `.mapping.json` itself is missing or the target category has no entry at all, the dependencies are unknowable, so skip the gate — but say in one line, "There is no dependency information, so I'm skipping the ordering check (you can fill it in via `/feature-to-adr` or `dependsOn` in `.mapping.json`)". (The case where the entry exists but only the `dependsOn` key is missing is handled by the "dependencies undeclared" branch above, not by this legacy case.)

3. **Build the plan**
   - Extract the vertical slice from the ADR's Decision / Mermaid diagram (UI → API → data). One ADR covers the whole slice of one feature (a leaf — a feature sub-folder or a single-feature context), so scope the implementation plan as a unit that changes the UI/API/Data layers **together** within that same feature.
   - If the category is set up as an anti-pattern category (`frontend/`, `backend/`, `api/`, `identity/api`, etc. — in any segment, context or feature; see `structure.md` "Anti-pattern categories") so that vertical slice extraction is impossible, stop the implementation and recommend re-aligning the categories with `/adr-sync`.
   - `Glob`/`Grep` on keywords from the ADR's Decision to find and read the relevant existing code and identify the gaps (code locations are not in the mapping, so read the ADR and search directly — `structure.md` "Finding the related code"). Check whether the UI/API/Data code of the same feature is gathered in one place.
   - Present the change plan to the user and get approval.

   If you decided to implement multiple ADRs in order (when prerequisites were added in step 2), repeat steps 4–6 below **one ADR at a time, starting from the deepest prerequisite in dependency topological order** — only after a prerequisite becomes `Accepted` do you move on to step 4 for the next ADR.

4. **Implement**
   - Edit/Write in small units.
   - Follow the behavior rules, state transitions, and integration methods stated in the ADR exactly. To implement something differently from the ADR, change the ADR first.
   - **Enforce the requirement values the ADR records, at face value** — do not arbitrarily change or "roughly approximate" limits, quotas, intervals, retention periods, ceilings, or targets; actually put in the code that enforces those values (ceiling checks, counters, expiry handling). **Non-numeric requirements are the same** — enforce exactly the allowed value sets, transition rules, mandatory-ness, permissions, visibility, ordering, uniqueness, and units that the ADR fixed (do not add a state that is not allowed, do not open a forbidden transition, and do not turn a required input into an optional one). Enum identifier names are at your discretion, but **the set and the transition rules are the contract**. If a reason arises to change a value, do not fix the code first — update the ADR first (a requirement value change is at minimum major, so also leave a one-line entry in `decision-log.md` — `authoring-rules.md` "What to log — minor vs major").
   - **Values the ADR does not state are implementation discretion** — connection pool size, backoff, cache TTL, worker count, and so on are yours to choose freely, and you do not write those values back up into the ADR.
   - **Let the code and the tests carry the explanation; keep comments to three lines or fewer.** A long comment block is a signal that behavior which should be _executable_ is being described in prose — prose drifts silently as the code changes, while a test fails loudly. So when an explanation grows past roughly three lines, do not expand the comment: leave a one- or two-line summary of the _why_ at that spot and move the _what_ into tests.
     - **What moves into a test**: each case the comment enumerated becomes its own test with a name that reads as the sentence the comment was trying to write — the boundary and edge cases, the ordering or state-transition sequence, why a forbidden input is rejected, the failure and fallback paths, and every requirement value (assert the number itself, so "max 20 turns" is verified as 20). A reader should be able to open the test file and recover what the deleted comment said.
     - **What stays as a comment**: only what code and tests cannot express — the _why_ behind a non-obvious choice, a constraint imposed from outside (a spec quirk, an upstream API's behavior, a browser or platform bug), and a warning about a trap that looks safe. A comment that merely restates _what_ the line does is deleted rather than shortened.
     - **Never trade coverage for brevity** — the goal is to move the explanation into an executable place, not to delete it. If you cannot write the test for some case, keep the comment (over three lines is fine) and say so in the step 7 report rather than dropping the knowledge.
     - Follow the surrounding code's comment density and style over this rule when the project's conventions (`AGENTS.md`, `CONTRIBUTING.md`, `CLAUDE.md`) or the sibling files already settle the question.
   - If, mid-implementation, you judge that a gray-zone decision in the ADR (adoption rationale, domain rules, state transitions, fallback) needs to change, do not fix the code first — stop and branch with the user on "is this an intended decision change, or is honoring the ADR the right call?" — if it is a decision change, update the ADR to the current decision first (edit-in-place; if the decision topic branches, supersede with a new ADR) and put it in the same commit; otherwise implement per the ADR. If that change is **major** (`authoring-rules.md` "What to log — minor vs major"), also leave a one-line entry in the category's `decision-log.md` — the log entry is added **at the moment you change the decision** (which is separate from the automatic Status transition in step 6 — the log records the decision, Status records the fact of implementation). If code silently drags a gray-zone decision along, the one-way PRD → ADR → code flow breaks (the same framing as `adr-sync` "Scope of the source of truth").

5. **Test**
   - Run the project's test command (see `AGENTS.md` or `package.json`).
   - **Write the tests so they read as the documentation** — they are where step 4 moved the explanation, so they carry that load only if a reader can learn the behavior from them. Name each test as the sentence it proves ("a cancelled order cannot move to shipping", not "test transition 3"), keep one behavior per test so a failure names the broken rule by itself, and where a case exists for a non-obvious reason, put that _why_ in a short comment above it — that is the sentence the deleted code comment used to hold.
   - If there are no tests, ask the user what verification procedure they want.
   - If tests fail, do not move on to step 6 — if it is an implementation bug go back to step 4; if the ADR made the wrong decision, fix the ADR first and then go back to step 4.

6. **Automatic Status transition (`Proposed → Accepted`)**

   For the detailed policy see `README.md` "Automatic transition rules". What this step triggers:
   - Immediately after the step 5 tests pass, **without asking the user**, change the Status line in the target ADR body to `Accepted (YYYY-MM-DD)`
   - Update the `status` of the corresponding `adrs[]` record in `.mapping.json` to `Accepted (YYYY-MM-DD)` at the same time (`status` is in lockstep with the body — and update the summary too if the decision changed)
   - If several ADRs in one category were implemented together, update all of them
   - Tell the user about the change in one line ("Updated ADR auth/0003 Status to Accepted")

7. **Wrap up**
   - Right after the Status promotion (step 6), quickly re-verify the ADR / mapping (= ADR index) structure with the deterministic harness:

     ```bash
     node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-structure-lint.mjs <implemented category key>
     ```

     This check mechanically catches whether the edit that changed Status to `Accepted (YYYY-MM-DD)` is correctly formatted (R1), whether the `status` in `.mapping.json` `adrs[]` is consistent with the `## Status` you just changed in the body (R8 status-index-mismatch), and whether any new ADR back-references were left in the code (R17, internal `adr-invariants.sh --code-only`). If an `error` comes out, fix it before committing.

   - Then run `/adr-impl-review <category>` (report only — it does not modify code or ADRs). It first explains the actual diff in a way a junior can understand so a human can confirm the intent, and then a necessity reviewer and a sufficiency reviewer, who do not share results with each other, each attack unnecessary changes and missing behavior / counterexamples. The sufficiency reviewer actually executes targeted tests, and the final artifact is a junior-facing guide that explains code structure, runtime, and state transitions in Mermaid and includes the repair order and completion criteria. If an `[Impl-fact mismatch]` comes out of it, correct the ADR to match the code with `/adr-sync <category>`.

**Forbidden**:

- Do not jump straight to planning/implementation without the dependency check (step 2) — even a single ADR must pass the prerequisite gate first.
- Do not start with a downstream ADR while a prerequisite ADR is unimplemented (`Proposed`) without user confirmation.
- Do not implement multiple ADRs in input order — always implement in `dependsOn` topological order (prerequisites first).
- Do not implement a new feature without an ADR.
- Reflect any decision change discovered during implementation in the ADR before modifying the code.
- Do not promote an ADR to `Accepted` when tests have not passed — Status is a fact about code behavior, not a declaration of intent.
