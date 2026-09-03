# Human-facing review reports

Use this guide only when writing the report or chat summary a person will read.
Internal reviewer artifacts keep their evidence-complete formats.

Read `${CLAUDE_PLUGIN_ROOT}/references/reader-first-writing.md` completely and
apply it with this report-specific guide.

The reader is a junior developer seeing the subject for the first time. Explain it
like a new teammate, not like a child: preserve exact contracts and evidence, but
remove the reconstruction work.

## Start with the answer

Lead with `At a glance` before detailed findings or evidence:

- **Verdict** — what the review concluded.
- **Impact** — what a user, operator, or maintainer can observe.
- **Action** — what must happen next, or `None`.
- **Risk** — what remains uncertain or costly, or `None`.

Keep each item to one or two sentences. A reader should understand the outcome
without knowing the rule IDs, file layout, or internal symbol names.

After this summary, preserve the complete evidence required by the owning skill.
Easy wording never permits dropping a requirement value, allowed set, state rule,
permission, mandatory field, ordering rule, unit, finding, unverified axis, test
result, or residual risk.

## Use plain, exact language

- Name the actor and observable behavior: `The checkout API rejects a second
settlement`, not `idempotency is handled`.
- Explain an unavoidable domain or technical term on first use in one short clause.
- Put the user or operational symptom before an internal category or symbol name.
- Use paths, symbols, rule IDs, commands, and quotations in the evidence section,
  not as the first explanation of the result.
- Keep one idea per sentence and one finding per paragraph or list item.

## Visualize relationships the reader would reconstruct

Include the smallest grounded Mermaid diagram when any trigger applies:

- three or more participants, processing steps, states, components, or ADRs;
- a system boundary, dependency, or contradiction;
- an asynchronous or cross-system request or event flow;
- a state transition, failure, retry, rollback, or fallback;
- a changed data relationship; or
- a refactor spanning multiple call sites or changing how work moves between them.

Choose the diagram by the review question:

| Question                                                            | Mermaid           |
| ------------------------------------------------------------------- | ----------------- |
| Who calls whom, and in what order?                                  | `sequenceDiagram` |
| Which states and transitions matter?                                | `stateDiagram-v2` |
| Where does the flow branch, fail, retry, or depend on another item? | `flowchart`       |
| Which changed data relationships matter?                            | `erDiagram`       |

Draw only relationships established by the ADR, code, diff, or executed evidence.
Use short behavior labels instead of implementation trivia. After the diagram,
write one sentence beginning with `Notice:` that states the review point.

The prose must remain independently reviewable when Mermaid does not render.
A local one-file PASS or a single-document PASS may omit a diagram when the entire
relationship is clear in one or two sentences. Do not add a diagram to satisfy a
format quota, and do not repeat the same relationship in several diagram types.

## Remove AI slop

Every sentence must contribute a verdict, contract, evidence, impact, action, or
risk. Delete:

- praise, reassurance, and conversational applause;
- scene-setting, throat-clearing, and restating the user's request;
- repeated conclusions, findings, evidence, or diagram narration;
- generic best-practice advice without a project rule, code location, and concrete
  failure or maintenance cost;
- speculative future extensibility and hypothetical work outside the review scope;
- vague instructions such as `improve this`, `handle appropriately`, or `add
necessary tests`;
- empty headings and sections whose only content is `none`, unless the owning
  artifact schema requires the section.

Also rewrite repeated contrast templates, one-off ornamental English labels,
forced numbered symmetry, filler bridges, and visual elements that repeat
adjacent prose. Never invent a user story, project result, measurement, or
causal relationship to make a report feel more narrative.

Prefer the shortest wording that preserves the full contract. Concision is not a
reason to hide evidence or merge independent obligations.

## Review-specific visual emphasis

- **ADR document review** — visualize cross-ADR contradictions, duplication,
  dependencies, or repeated leaks. A single ADR style finding rarely needs a
  diagram.
- **ADR sync** — visualize a changed decision flow, dependency/category movement,
  or unresolved ADR-versus-code branch. Keep semantic diffs in text.
- **Implementation review** — after At a glance and scope, explain `ADR intent`
  before implementation detail. Between `ADR intent` and contract coverage, use
  one or more subject-specific headings ordered by importance. Follow a verified
  user, operator, request, state, or failure flow when it makes the behavior
  easier to understand; otherwise lead with the most consequential behavior and
  its result. Execution order is optional. End the report with `Comprehension
check` containing one to five material free-response questions. Keep the
  answer criteria out of the visible report until the reader answers, and state
  that a code `PASS` does not make the PR comprehension-ready.
- **Implementation refactor** — visualize before/after work flow only when several
  call sites or processing stages are involved. A local rename or extraction does
  not need one.
