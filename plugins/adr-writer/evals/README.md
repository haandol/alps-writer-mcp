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
   in pairs because a prompt can be made to pass one by breaking the other:
   - `review-requirement-value-preserved` ↔ `review-catches-blurred-value` —
     telling the reviewer "never touch a number" fixes the first and disables the
     second.
   - `author-keeps-values-and-lints` ↔ `author-self-checks-missing-value` — the
     first gives the author every value and checks they survive; the second gives
     it none and checks it says so. Pushing the author toward "always record a
     requirement value" passes the first and makes the second invent one.
   - `sync-rewrites-final-state-only` carries both sides in one artifact: remove
     the replaced mode and comparison narration, but preserve the current
     forbidden transition. A blanket "remove negative sentences" rule fails the
     second half.
   - `feature-handoff-zero-or-many` checks that replaceable implementation work
     produces zero ADRs, independent durable decisions remain separate, and a
     feature-only prerequisite does not manufacture a placeholder ADR.
   - `impl-blocks-proposed-prerequisite` checks the mandatory dependency gate;
     user confirmation must not create a downstream-only override.
   - `hook-admission-routing` pairs one replaceable SDK swap with one requirement
     quota change so tightening either side cannot silently capture the other.
   - `author-routes-existing-provider-change` checks that Bedrock → OpenAI API
     and a later reversal reuse one provider-boundary ADR instead of allocating
     a new ADR for each direction.
   - `alps-batch-preserves-mandatory-nfr` checks explicit batch approval together
     with separate save units and mandatory NFR preservation beyond the top-three
     focus set.
   - `impl-review-selects-risk-mode` checks both directions of the review-mode
     classifier: localized implementation uses standard, while contract and
     public-surface changes use full.
   - `bedrock-subagent-fallback` checks that a known Amazon Bedrock provider
     prevents named and generic subagent dispatch, the known input validation
     error is not retried, document and implementation review continue as
     main-session passes, and refactoring remains `PROPOSE_ONLY`.
   - `impl-completes-without-reconfirmation` checks that a pre-approved ADR is
     not reconfirmed after implementation, evidence-backed defects are repaired
     and re-reviewed automatically, and only a real contract change escalates.

   The two axes also split by pipeline stage, and that split is deliberate.
   `/adr-new` no longer calls `adr-reviewer` (it self-checks at its step 6(b)), so
   the `review-*` scenarios now cover only the `/adr-review` path — a hand-edited
   or inherited ADR read by a fresh agent. `author-self-checks-missing-value` is
   what covers the same axis at authoring time. A change to step 6(b), or to the
   `authoring-rules.md` checklist it delegates to, needs the author-side pair;
   a change to `agents/adr-reviewer.md` needs the review-side pair.

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

## Reviewing a real repository

`review-real-repo-adr` points the reviewer at a shipped ADR instead of a planted
fixture. Synthetic fixtures make scoring sharp but are tidier than anything real;
a shipped ADR mixes genuine requirement values with detail that crept in, and
that mix is where the requirement-vs-detail call actually gets hard.

```bash
ADR_EVAL_REPO=~/git/pixelbank \
ADR_EVAL_ADR=docs/adr/token/0002-free-trial.md \
ADR_EVAL_VALUES="2회,3회,1회" \
ADR_EVAL_CMD="claude -p --allowedTools 'Read Grep Glob'" \
  node evals/run.mjs --only review-real-repo-adr --runs 3 --out /tmp/report.md
```

The ADR, its sibling category, the repo's own rule docs, and **everything the ADR
links to** are copied into a throwaway directory. The source repo is only read.

Scoring is necessarily thinner here: nobody knows the whole correct answer for a
real ADR. It checks what is knowable regardless of content — the values named in
`ADR_EVAL_VALUES` must survive, and the report must reach a verdict — then prints
the findings for a human to read. Treat a real-repo run as a reproduction aid,
not a graded exam.

**Copy what the ADR links to, or you manufacture findings.** The first pixelbank
run reported `../../FREE_USAGE.md` as a broken link when the file exists — the
fixture had simply not copied it. That is worse than noise: it trains the reader
to discount R10. Fixing it also _gained_ a real finding, because the reviewer
could then read that document and spot that its free-usage counts (3/5/2)
contradict the ADR's table (2/3/1/1) — a genuine drift invisible while the file
was absent. A fixture that omits context does not just add false findings, it
hides true ones.

## What this does not prove

Be honest about the gap when reading a result.

- **The prompt is real; the surrounding context is not.** Scenarios pass the
  actual `SKILL.md` / `agents/*.md` text — reconstructing a prompt would test
  this directory's summary of the rules instead of the rules that ship — via the
  same "read the agent file, hand it to a generic subagent" path the skills
  document as their fallback. But a real session also carries conversation
  history, the SessionStart directive, the user's own CLAUDE.md, and a
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
