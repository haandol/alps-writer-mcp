# ADR behaviour evals

`pnpm test` proves the prompts **say** something. These evals check whether an
agent given those prompts **does** it.

They exist to reproduce reported defects. When someone says "the reviewer told me
to delete my requirement value", you encode that situation once, run it ten
times, and learn whether it happens 1/10 or 8/10 — a number a pass/fail verdict
would throw away, and the number that decides the fix. An intermittent
misjudgement usually means the rule is present but out-competed by another
instruction; a deterministic one usually means the rule is absent, unreachable,
or contradicted.

**Not part of `pnpm test`.** These call a real model: they cost money, take
minutes, and are non-deterministic. Never gate CI on them.

## Running

```bash
cd plugins/adr-writer

node evals/run.mjs --list                        # scenario names
node evals/run.mjs --dry-run --only review-      # build fixtures, print prompts, no agent
node evals/run.mjs --only review-catches         # one scenario, one run
node evals/run.mjs --only review-catches --runs 10   # rates
node evals/run.mjs --runs 5 --out /tmp/report.md     # everything, shareable report
```

The agent command is configurable, since this plugin ships for two clients and
models outlive this directory:

```bash
ADR_EVAL_CMD="claude -p --allowedTools ''" node evals/run.mjs      # default
ADR_EVAL_CMD="claude -p --model opus --allowedTools ''" node evals/run.mjs
ADR_EVAL_CMD="codex exec" node evals/run.mjs
```

The command receives the prompt on **stdin** and must print the reply to stdout.
Scenarios that only read files can run with tools disabled; `author-*` scenarios
write an ADR, so they need write access to the fixture directory:

```bash
ADR_EVAL_CMD="claude -p --add-dir . --allowedTools 'Read Write Edit Bash'" \
  node evals/run.mjs --only author-
```

Exit code is 0 whenever the run completed, **including when checks fail** — a
failing check is the finding, not an error. Exit 2 means the harness itself could
not run (bad `--only`, agent produced nothing).

## Reproducing a reported bug

1. **Copy the closest scenario** in `scenarios/` and rename it.
2. **Put the reporter's situation in the fixture.** Change the ADR body, the
   diff, or the brief until it matches what they had. Keep it minimal — one
   defect per scenario, so a failure names its own cause.
3. **Record the report verbatim** in `bugReport`. It lands in the shareable
   report, which is what lets the reporter confirm you reproduced _their_
   problem rather than an adjacent one.
4. **Write the checks as the behaviour you expect**, not as the text you expect.
   `expectNotMiscategorized(tail, /cancel/, /Impl-fact/)` survives rewording;
   `expectText(output, /the transition is forbidden/)` breaks on a synonym.
5. `--runs 10` and read the rate.
6. After a fix, run again — **and run the paired scenario.** Most of these come
   in pairs (`review-requirement-value-preserved` ↔ `review-catches-blurred-value`)
   because a prompt can be made to pass one by breaking the other: telling the
   reviewer "never touch a number" fixes the first and disables the second.

## Scenario shape

```js
export default {
  name: "kebab-name",
  description: "one line — what behaviour is under test",
  bugReport: "the reporter's words (optional)",
  build(dir) {
    /* write the fixture, return the prompt */
  },
  score({ tail, output, dir }) {
    /* return an array of {pass, detail, label} */
  },
};
```

`build` gets a fresh temp directory and returns the whole prompt. `score` gets
the parsed tail block, the raw reply, and the fixture path — so a check can read
what the agent wrote to disk, not just what it said.

Helpers are in `lib/harness.mjs`: `skillText` / `agentText` (real instruction
text), `seedRuleDocs` / `seedMapping` / `write`, the `expect*` scorers, and
`expectLintClean` which runs the shipped `adr-structure-lint.mjs` over the
result.

## Two directions, and why both

- **Evaluate an input** (`review-*`, `impl-review-*`) — hand the agent a
  fixture built to contain one specific defect (or built to be clean) and score
  the judgement. Cheap, sharply targeted.
- **Generate, then evaluate** (`author-*`) — hand it a decision brief, let it
  write the ADR, then score the artifact. Slower and noisier, but it is the only
  way to catch what authoring silently drops. Its strongest check needs no model
  judgement at all: the ADR must pass the same deterministic lint a hand-written
  one faces.

## What this does not prove

Be honest about the gap when reading a result.

- **The prompt is real; the surrounding context is not.** Scenarios pass the
  actual `SKILL.md` / `agents/*.md` text — reconstructing a prompt would test
  this directory's summary of the rules instead of the rules that ship — via the
  same "read the agent file, hand it to a generic subagent" path the skills
  document as their fallback. But a real session also carries conversation
  history, the UserPromptSubmit directive, the user's own CLAUDE.md, and a
  multi-turn exchange with the user. A defect that only appears after twenty
  turns of context will not reproduce here.
- **The tail block is an addition.** Scenarios append a machine-readable
  summary request so scoring does not have to parse prose. That is a real
  deviation: asking for a structured summary can itself sharpen the answer. A
  defect that disappears when you ask for a tail block is worth noting as such.
- **Non-interactive runs skip the questions.** `/adr-new` is built to ask the
  user one thing at a time; `author-*` tells it the answers are already given.
  So these scenarios cannot catch anything about the elicitation itself — whether
  it asks about requirement values unprompted, for instance.
- **A passing check is evidence, not proof.** Same standing as a passing test in
  `/adr-impl-review`: no counterexample was found among the runs executed. Ten
  green runs do not make an eleventh green.
