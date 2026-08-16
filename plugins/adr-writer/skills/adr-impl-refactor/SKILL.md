---
name: adr-impl-refactor
description: Review an ADR implementation for efficiency and proportionate reuse, immediately apply only high-confidence local behavior-preserving refactors with before/after tests, and leave all other opportunities as evidence-backed proposals. Runs inside /adr-impl before final Status promotion and /adr-impl-review.
argument-hint: "[adr-path-or-category] [--base <ref>]"
---

# adr-impl-refactor

Refactor an ADR implementation conservatively before it is declared complete. A dedicated read-only reviewer finds opportunities; the main session applies only candidates that pass every safety gate. The final `/adr-impl-review` remains report-only and reviews the resulting code.

This skill may also be invoked directly for an existing ADR implementation. It never changes an ADR decision or requirement contract. If an opportunity needs either to change, route it to `/adr-impl` or `/adr-sync` instead of treating it as a refactor.

## 1. Fix the target and scope

Identify the ADR and diff with the same target rules as `/adr-impl-review`:

1. Use an explicit ADR path or category when supplied.
2. With no target, show the `Accepted` ADR list and take a selection. Include `Proposed` ADRs only when current changes indicate a partial implementation, and confirm that partial-review intent once.
3. Use the user's PR / commit range or `--base` when supplied.
4. Otherwise use current staged and unstaged changes.
5. For a clean worktree, use the merge-base diff against the default branch.

Read the full ADR, its `.mapping.json` entry, the raw diff, direct call paths, related tests, the repo's seeded `docs/adr/concepts.md` and `docs/adr/authoring-rules.md`, and project conventions. Confirm the code scope by opening the actual code; never infer it from the category name alone.

If the selected diff mixes several implementations and cannot be mapped cleanly to the target ADR, stop and get a narrower base or range. Do not apply a refactor across an uncertain ownership boundary.

Create an artifact directory at `${TMPDIR:-/tmp}/adr-impl-refactor-<adr-slug>-<timestamp>/`.

## 2. Establish the test baseline

Run the narrowest existing tests that cover the changed path before applying any refactor. Record the command and result.

- If the relevant tests fail, stop. Refactoring a failing baseline makes cause and effect ambiguous.
- If no related tests exist, produce proposals only. Do not auto-apply a candidate whose behavior cannot be checked before and after.
- Do not install new tools or create product tests solely to qualify an automatic refactor. A missing test is a proposal and belongs in the result.

## 3. Run the independent refactor reviewer

Run `adr-impl-refactor-reviewer` in a fresh read-only context.

1. If the named agent exists, invoke it.
2. Otherwise resolve `${CLAUDE_PLUGIN_ROOT}/agents/adr-impl-refactor-reviewer.md` to an **absolute path** and run a generic read-only subagent instructed to read that file completely and follow it. Do not load the agent file into the main session or paste its full text into the dispatch prompt. Pass the ADR, mapping entry, diff, code scope, tests, rule docs, and project conventions separately as task input.
3. If the generic subagent cannot read the absolute agent-file path, fall back once to passing the file's full text so review capability is preserved, and record that the path-based context isolation was unavailable.
4. If subagents are unavailable, the main session performs the same analysis only to produce `PROPOSE_ONLY` items and records that the independent context was unavailable. **It must not classify or apply any candidate as `APPLY_NOW` without an isolated read-only reviewer.**

Give the reviewer only the original ADR, mapping entry, raw diff, confirmed code scope, related tests, seeded rule docs, and project conventions. Do not give it necessity/sufficiency results, an implementation explanation, or earlier refactor conclusions.

Require only the reviewer file's existing `Refactor Review` output in the response. Do not ask the subagent to echo its instructions, raw inputs, or exploratory notes.

Save the result as `refactor-review.md`.

## 4. Verify the auto-apply gate

The reviewer proposes; the main session verifies. An `APPLY_NOW` label is not sufficient by itself.

Auto-apply a candidate only when every condition holds:

- The candidate came from an isolated read-only reviewer context. Main-session fallback findings are proposal-only.
- It preserves the ADR decision, requirement contract, observable behavior, and public contract.
- It is local to the confirmed implementation scope and has a small, mechanically explainable patch.
- Confidence is `high`, with exact code and call-path evidence.
- Related tests passed before the change and can run after it.
- It does not alter APIs or wire forms, schemas or persistence, dependencies, states or transitions, permissions or visibility, mandatory validation, ordering or uniqueness, concurrency, transactions, retries, timeouts, fallbacks, resource lifetime, or error semantics.
- An efficiency improvement removes work that is directly visible or reproducible; it is not speculative caching, concurrency, batching, or micro-optimization.
- A reuse extraction is backed by current same-semantics duplication and simplifies its call sites. It does not introduce a generic abstraction, extension point, or configuration surface for one caller or a hypothetical future use.
- Project conventions and sibling ownership do not contradict the change.

Critical priority never overrides the gate. A critical item that fails one condition becomes `PROPOSE_ONLY`.

## 5. Apply safe candidates one at a time

For each verified candidate:

1. Make the smallest patch that realizes only that refactor.
2. Run its targeted test immediately.
3. If the test passes, keep the patch and continue.
4. If the test fails or the change expands beyond the verified boundary, undo only that candidate's edits, keep the previously verified work, and move the candidate to `PROPOSE_ONLY` with the observed failure.

Do not use destructive worktree commands. Track the exact patch for each candidate so only work introduced by this skill is undone.

After all candidates, rerun the combined targeted test set **only when at least one candidate was kept**. When zero candidates changed the worktree, reuse the passing baseline as the final targeted result instead of testing identical state twice. When this skill is called by `/adr-impl`, `/adr-impl` must still rerun the project's full test command after an applied refactor.

## 6. Write the result

Save `refactor-results.md` in the artifact directory:

Every proposal must state its priority, expected benefit, risk, estimated scope and verification method.

```markdown
# ADR implementation refactor result

## Applied

- <candidate> - <files/symbols> - <benefit> - <before/after test result>

## Proposed

- <priority> <candidate> - <expected benefit> - <risk or failed gate> - <estimated scope> - <verification needed>

## Rejected

- <candidate> - <why it was speculative, taste-only, or not worth the abstraction>

## Tests

- `<command>` -> PASS|FAIL|NOT RUN - <result>

## Limits

- <missing tests, unavailable call path, or lack of independent reviewer context>
```

Summarize the applied count, proposal count, and tests in chat. Do not present a proposal as though it was already implemented.

## 7. Continue the cycle

- When called from `/adr-impl`, return control to its test step. The required project tests and final implementation review must pass on the refactored code before `Proposed -> Accepted`.
- Then `/adr-impl-review` reviews the final diff without reading `refactor-review.md` or `refactor-results.md`. Its necessity and sufficiency reviewers must derive their conclusions independently from the ADR, final code, diff, tests, and human baseline.

## Prohibited

- Do not change the ADR, mapping, requirement contract, or decision log.
- Do not auto-apply when tests are missing or the baseline is failing.
- Do not auto-apply when an isolated read-only reviewer is unavailable.
- Do not let priority or severity bypass the auto-apply gate.
- Do not introduce speculative reuse or a framework for one caller.
- Do not optimize tuning values without concrete evidence of repeated unnecessary work.
- Do not hide failed automatic edits; move them to the proposal list with the test result.
