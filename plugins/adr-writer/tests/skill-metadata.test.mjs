// Guards the skill/document surface a user actually sees in the client UI.
//
// These are the invariants an audit caught by hand: /adr-impl-review shipped
// without an argument-hint even though three docs tell users to pass one, and a
// seeded template drew its pipeline in box-drawing characters against the
// project's Mermaid-first rule. Both are invisible to the existing tests, which
// check prose content rather than metadata and formatting.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ADR_ROOT = path.join(HERE, "..");
const PLUGINS_ROOT = path.join(ADR_ROOT, "..");

function read(absolutePath) {
  return readFileSync(absolutePath, "utf8");
}

function frontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, "SKILL.md must open with a YAML frontmatter block");
  return match[1];
}

function skillFiles() {
  const found = [];
  for (const plugin of ["adr-writer", "alps-writer"]) {
    const skillsDir = path.join(PLUGINS_ROOT, plugin, "skills");
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      found.push({
        id: `${plugin}/${entry.name}`,
        file: path.join(skillsDir, entry.name, "SKILL.md"),
      });
    }
  }
  assert.ok(found.length >= 7, "expected to discover every skill in both plugins");
  return found;
}

test("every skill declares a name matching its directory", () => {
  for (const { id, file } of skillFiles()) {
    const declared = frontmatter(read(file)).match(/^name:\s*(\S+)/m);
    assert.ok(declared, `${id} frontmatter has no name`);
    assert.equal(declared[1], path.basename(path.dirname(file)), `${id} name/dir mismatch`);
  }
});

// A skill that parses an argument must advertise it, or the client shows no hint
// and the argument looks unsupported. /alps-init takes none, so it is exempt.
test("every argument-taking skill declares an argument-hint", () => {
  for (const { id, file } of skillFiles()) {
    if (id.endsWith("/alps-init")) continue;
    assert.match(frontmatter(read(file)), /^argument-hint:/m, `${id} is missing argument-hint`);
  }
});

// The regression: docs told users to run `/adr-impl-review <category>` while the
// skill advertised no argument at all.
test("adr-impl-review advertises the argument its own procedure parses", () => {
  const source = read(path.join(ADR_ROOT, "skills", "adr-impl-review", "SKILL.md"));
  assert.match(frontmatter(source), /^argument-hint:.*adr-path-or-category/m);
  assert.match(source, /If it is a category key/);
  assert.match(source, /--base/);
});

// Three commands review, and picking the wrong one wastes a lot or answers the
// wrong question: /adr-review judges how the ADR is WRITTEN (no code read),
// /adr-sync judges ADR↔code, /adr-impl-review judges the implementation. The
// sweep is also the one command that can fan a misjudgment across every ADR at
// once, so its report-only stance and its per-ADR isolation are load-bearing.
test("adr-review sweeps ADR documents, report-only, and stays out of the code", () => {
  const review = read(path.join(ADR_ROOT, "skills", "adr-review", "SKILL.md"));
  // no argument sweeps everything; the recursive walk is what makes that true
  assert.match(review, /\*\*No argument\*\* → every ADR on disk/);
  assert.match(review, /recursively/);
  // it delegates the rules rather than restating them — one reviewer per ADR
  assert.match(review, /adr-reviewer/);
  assert.match(review, /Never batch several ADRs into one reviewer call/);
  // report-only: a sweep that edited would fan one bad call across the set
  assert.match(review, /Report-only/);
  assert.match(review, /Never edit an ADR/);
  // the boundary that keeps a clean sweep from reading as "matches the code"
  assert.match(review, /Do not open the codebase/);
  assert.match(review, /Never report a clean sweep as "the ADRs are correct"/);
  // and it must not re-introduce the failure mode the plugin guards hardest
  assert.match(review, /Never propose deleting a requirement value/);

  // the three review commands cross-reference each other, so a user landing on
  // any one of them can find the right one
  assert.match(review, /\/adr-sync/);
  assert.match(review, /\/adr-impl-review/);
  const sync = read(path.join(ADR_ROOT, "skills", "adr-sync", "SKILL.md"));
  assert.match(sync, /use `\/adr-review` instead/);
  // the reviewer agent names the sweep as one of its invocation paths
  const reviewer = read(path.join(ADR_ROOT, "agents", "adr-reviewer.md"));
  assert.match(reviewer, /Via `\/adr-review`/);
});

// /adr-new authors under the same rules adr-reviewer applies, so reviewing the
// draft it just wrote re-derives a judgment made one turn earlier — and a punch
// list of items the author already got right is how a user learns to skim the
// findings that matter. So the reviewer subagent runs only from /adr-review, on
// ADRs whose authoring context is gone (hand-edited, inherited, another session).
//
// The danger of removing that call is silent: the reviewer was the only stage
// carrying R18a (a missing requirement value) and R19 (the regeneration test),
// and those are exactly the axes self-review is weakest on — the value was in
// the conversation, so an incomplete draft reads as complete to its author. If
// /adr-new drops the delegation without picking the axes up explicitly, nothing
// fails; the requirement just disappears from the pipeline. Hence both halves.
test("/adr-new verifies its own draft instead of delegating to adr-reviewer", () => {
  const adrNew = read(path.join(ADR_ROOT, "skills", "adr-new", "SKILL.md"));

  // it must not spawn the reviewer, by name or by the generic-subagent fallback
  assert.doesNotMatch(adrNew, /invoke it|adr-reviewer\.md/);
  assert.match(adrNew, /this command does not delegate to a review subagent/);
  // ...and it must say why, or the next editor reads the removal as an oversight
  assert.match(adrNew, /same rule set R1-R20 tests/);

  // the absence axes the reviewer used to own, now carried here explicitly
  assert.match(adrNew, /ADR review checklist/);
  assert.match(adrNew, /R18a/);
  assert.match(adrNew, /regeneration test \(R19\)/i);
  // self-review is structurally weak on these two, so they are written out
  // rather than concluded — a checklist item silently marked done is the failure
  assert.match(adrNew, /for \*\*R18a and R19, write the check out\*\*/);
  assert.match(adrNew, /never invent a number/i);
  // the requirement gate still precedes the filters that would delete a value
  assert.match(adrNew, /Applying a filter before the gate/);

  // the user is told which axes were self-judged, and how to get a second opinion
  assert.match(adrNew, /self-checked R1-R20 \(no reviewer subagent\)/);

  // the reviewer agent names /adr-review as its path, and disclaims /adr-new
  const reviewer = read(path.join(ADR_ROOT, "agents", "adr-reviewer.md"));
  assert.match(reviewer, /\*\*Not from `\/adr-new`\.\*\*/);
  assert.match(reviewer, /nobody holds an authoring context for/);
  // the sweep owns the independent read, and runs on request rather than always
  const sweep = read(path.join(ADR_ROOT, "skills", "adr-review", "SKILL.md"));
  assert.match(sweep, /`\/adr-new` does not call a reviewer/);
  assert.match(sweep, /edited by hand, changed by another session, or inherited/);
});

// Removing the reviewer call made /adr-new's step 6(b) DEPEND on the seeded
// checklist — it says "walk the ADR review checklist, it is the authority here"
// instead of restating the rules. That is the right call (one source, no drift),
// but it moves the failure mode: trimming an item from the checklist now silently
// removes an axis from every /adr-new run, and nothing else in the pipeline
// re-checks it. So the checklist must carry every axis step 6(b) delegates to it.
test("the seeded checklist carries every axis /adr-new delegates to it", () => {
  const checklist = read(path.join(ADR_ROOT, "templates", "adr", "authoring-rules.md")).slice(
    read(path.join(ADR_ROOT, "templates", "adr", "authoring-rules.md")).indexOf(
      "## ADR review checklist",
    ),
  );
  assert.ok(checklist.startsWith("## ADR review checklist"), "the checklist section must exist");

  // The judgment axes /adr-new step 6(b) spends its pass on. Each is an axis the
  // deterministic harness cannot settle, so the checklist is the only thing
  // standing behind it once the reviewer is out of the authoring path.
  for (const axis of [
    /\*\*Regeneration test\*\*/,
    /\*\*Requirement values appear verbatim\*\*/,
    /\*\*Non-numeric requirements survived too\*\*/,
    /\*\*No tuning values\*\*/,
    /\*\*Code-readthrough test\*\*/,
    /\*\*Gray-zone check\*\*/,
    /\*\*Decision Drivers\*\*/,
    /\*\*At least two alternatives\*\*/,
    /\*\*One ADR = one decision\*\*/,
    /\*\*No forbidden items\*\*/,
    /\*\*Prose style\*\*/,
  ]) {
    assert.match(checklist, axis, `the checklist must keep ${axis} — /adr-new step 6(b) needs it`);
  }

  // ...and /adr-new must actually point at it by name, or it is working from
  // remembered rules and the coupling above proves nothing.
  const adrNew = read(path.join(ADR_ROOT, "skills", "adr-new", "SKILL.md"));
  assert.match(adrNew, /\*\*ADR review checklist\*\* in `docs\/adr\/authoring-rules\.md`/);
  assert.match(adrNew, /do not work from memory of it/);
});

// The stale-wiring guard. Four documents used to say the automated review happens
// inside /adr-new; each was a separate place a reader (or a future edit) could
// restore the delegation from. Nothing pinned them, which is why they all drifted
// together — so pin the invariant at the surface a user reads.
test("no document tells a user /adr-new runs the reviewer subagent", () => {
  const surfaces = [
    path.join(ADR_ROOT, "README.md"),
    path.join(ADR_ROOT, "skills", "adr-new", "SKILL.md"),
    path.join(ADR_ROOT, "skills", "adr-review", "SKILL.md"),
    path.join(ADR_ROOT, "agents", "adr-reviewer.md"),
    path.join(PLUGINS_ROOT, "alps-writer", "skills", "feature-to-adr", "SKILL.md"),
    path.join(PLUGINS_ROOT, "..", "docs", "usage.md"),
    path.join(PLUGINS_ROOT, "..", "docs", "adr-process.md"),
  ];
  for (const file of surfaces) {
    const source = read(file);
    const label = path.basename(file);
    // the two phrasings the old wiring used, plus the shape a re-introduction
    // would most likely take ("/adr-new ... calls the reviewer")
    assert.doesNotMatch(source, /automated review \(adr-reviewer\)/, `${label}: stale wiring`);
    assert.doesNotMatch(
      source,
      /`?\/adr-new`? \(calls the reviewer/,
      `${label}: says /adr-new calls the reviewer`,
    );
    assert.doesNotMatch(
      source,
      /\/adr-new` before its reviewer/,
      `${label}: orders the harness before a reviewer /adr-new no longer runs`,
    );
  }
});

// Every user-facing prompt / seeded template that could carry a diagram: the
// skills, the agent definitions, the ADR docs copied into docs/adr/, and the
// ALPS explainer.
function diagramTargets() {
  const markdownIn = (...segments) => {
    const dir = path.join(...segments);
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => path.join(dir, f));
  };
  return [
    ...skillFiles().map((s) => s.file),
    path.join(PLUGINS_ROOT, "alps-writer", "templates", "alps", "about-alps.md"),
    ...markdownIn(ADR_ROOT, "agents"),
    ...markdownIn(ADR_ROOT, "templates", "adr"),
  ];
}

// Mermaid-first (CLAUDE.md). Directory trees drawn with ├── └── are the one
// documented exception; anything else using box-drawing characters is a diagram
// that should have been Mermaid.
test("user-facing prompts and templates draw diagrams in Mermaid, not ASCII", () => {
  for (const file of diagramTargets()) {
    const offenders = read(file)
      .split("\n")
      .map((line, index) => [index + 1, line])
      .filter(([, line]) => /[─│┌┐└┘┬┴┼]/.test(line) && !/├──|└──/.test(line));

    assert.deepEqual(
      offenders,
      [],
      `${path.relative(PLUGINS_ROOT, file)} uses box-drawing characters outside a directory tree — use Mermaid`,
    );
  }
});

// The same defect class as box-drawing, but with arrow glyphs: a flow drawn as
// ```text  A → B → C  ```. Scoped to `text`/untagged fences whose lines are
// almost entirely arrows, so the many legitimate uses stay unflagged — prose
// arrows, `bash` fences whose comments say "code → ADR", and the output-format
// templates in agents/ and the ADR skills, which are report skeletons, not
// diagrams.
test("flow diagrams are Mermaid, not arrow-glyph text blocks", () => {
  for (const file of diagramTargets()) {
    const source = read(file);
    const offenders = [];

    for (const block of source.matchAll(/^```(\w*)\n([\s\S]*?)^```/gm)) {
      const [, lang, body] = block;
      if (lang && lang !== "text") continue;

      const lines = body.split("\n").filter((line) => line.trim());
      // A flow diagram: most lines carry an arrow, and none look like the
      // markdown headings/bullets/tables of an output-format skeleton.
      const arrowed = lines.filter((line) => /[→←↔▼▲]/.test(line)).length;
      const structural = lines.filter((line) => /^\s*(#{1,6} |[-*|] |\| )/.test(line)).length;
      if (lines.length && arrowed >= lines.length / 2 && structural === 0) {
        offenders.push(body.trim().split("\n")[0]);
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `${path.relative(PLUGINS_ROOT, file)} draws a flow with arrow glyphs in a text block — use Mermaid`,
    );
  }
});

test("the ALPS-to-ADR pipeline in about-alps.md is a Mermaid flowchart", () => {
  const source = read(path.join(PLUGINS_ROOT, "alps-writer", "templates", "alps", "about-alps.md"));
  const mermaid = source.match(/```mermaid\n([\s\S]*?)```/g) ?? [];
  assert.ok(mermaid.length >= 1, "about-alps.md must render the cycle as Mermaid");
  const pipeline = mermaid.join("\n");
  assert.match(pipeline, /flowchart/);
  for (const command of ["/feature-to-adr", "/adr-impl", "/adr-sync"]) {
    assert.ok(pipeline.includes(command), `the flowchart must keep the ${command} edge`);
  }
});

// The seeded doc set. /adr-new copies these into docs/adr/ on first use, and
// three prompts (adr-new, adr-reviewer, adr-impl-sufficiency-reviewer) fall back
// to reading them from the plugin root. If a file is added to templates/adr/ but
// the seeding step is not updated, users never receive it — which is exactly how
// decision-log.template.md's format stayed prompt-only.
test("every ADR template on disk is named in the /adr-new seeding step", () => {
  const templateDir = path.join(ADR_ROOT, "templates", "adr");
  const onDisk = readdirSync(templateDir).sort();
  const seedStep = read(path.join(ADR_ROOT, "skills", "adr-new", "SKILL.md"));

  // mapping.schema.json is referenced separately (as the schema for the mapping
  // file), not copied as a rule doc — assert it is still cited somewhere.
  assert.match(seedStep, /mapping\.schema\.json/);

  for (const file of onDisk.filter((f) => f !== "mapping.schema.json")) {
    assert.ok(seedStep.includes(file), `templates/adr/${file} is never seeded by /adr-new`);
  }
});

// ── requirement-value preservation (R18/R19) ──────────────────────────────
// The rule this plugin is most exposed to losing: an ADR must carry the values
// the RESULT has to honor (max turns, quotas, retention) while leaving the
// implementation's tuning values in code. Every stage that could quietly filter
// them out — authoring, review, sync, rollup, implementation, import — has to
// name the distinction, or one prompt reverts to "no constants in an ADR" and
// the requirement disappears from the pipeline.
test("the authoring rules gate requirements ahead of the code-readthrough filter", () => {
  const rules = read(path.join(ADR_ROOT, "templates", "adr", "authoring-rules.md"));
  // the gate exists and runs first
  assert.match(rules, /Requirement gate/);
  assert.match(rules, /Regeneration test/);
  assert.match(rules, /Why the gate comes first/);
  // the requirement-value vs tuning-value split, with both directions stated
  assert.match(rules, /keep requirement values, drop tuning values/);
  assert.match(rules, /tuning value/);
  // the old blanket ban on constants must be gone — it swept requirements away
  assert.doesNotMatch(rules, /구현 상수\/튜닝값/);
  assert.doesNotMatch(rules, /no constants in an ADR/i);
});

test("the ADR admission gate keeps replaceable implementation means out of every decision path", () => {
  const rules = read(path.join(ADR_ROOT, "templates", "adr", "authoring-rules.md"));
  const concepts = read(path.join(ADR_ROOT, "templates", "adr", "concepts.md"));

  for (const source of [rules, concepts]) {
    assert.match(source, /ADR admission gate/);
    assert.match(source, /implementation substitution test/);
    assert.match(source, /GPT-5\.6 through Amazon Bedrock/);
    assert.match(source, /credential provider chain/);
    assert.match(source, /Do not create or update an ADR|Do not create or update an ADR/i);
  }

  // Technology categories that used to make code-level choices look
  // automatically ADR-worthy must not remain as blanket examples.
  assert.doesNotMatch(concepts, /Authentication method,/);
  assert.doesNotMatch(concepts, /state-management library choice/);
  assert.doesNotMatch(concepts, /Secret management strategy/);

  const stages = {
    "hooks/surface-adr-context.mjs": [
      /ADR admission gate/,
      /Replaceable implementation choices are exempt/,
    ],
    "skills/adr-new/SKILL.md": [/Apply the ADR admission gate before eliciting or drafting/],
    "skills/adr-impl/SKILL.md": [/replaceable implementation means changes/],
    "skills/adr-sync/SKILL.md": [/Retire low-level ADR/, /New ADR needed.*admission gate/s],
    "skills/adr-rollup/SKILL.md": [/apply the ADR admission gate/i],
    "skills/adr-impl-review/SKILL.md": [
      /Never promote implementation discretion into `Undecided behavior`/,
    ],
    "agents/adr-reviewer.md": [/ADR admission \+ gray-zone substance/],
    "agents/adr-impl-sufficiency-reviewer.md": [
      /Do not file replaceable implementation means here/,
    ],
  };

  for (const [rel, patterns] of Object.entries(stages)) {
    const source = read(path.join(ADR_ROOT, rel));
    for (const pattern of patterns) assert.match(source, pattern, `${rel} must state ${pattern}`);
  }

  const adrNew = read(path.join(ADR_ROOT, "skills", "adr-new", "SKILL.md"));
  assert.ok(
    adrNew.indexOf("before any filesystem write or mapping initialization") <
      adrNew.indexOf("Create `docs/adr/`"),
    "/adr-new must reject implementation detail before creating ADR scaffolding",
  );
});

// An ADR is read under time pressure by someone deciding whether to trust it, so
// padding costs the reader attention the decision needed, and the passive voice
// hides the actor — which in a decision record is often the whole point. The rule
// is therefore stated once in authoring-rules and applied at authoring time and at
// review time. Its danger is that "make it shorter" reads as license to delete, so
// every surface must also carry the never-cut-content guard, and the review side
// must keep it advisory so a style nit cannot outweigh a missing requirement.
test("prose style is stated once, applied at authoring and review, and never cuts content", () => {
  const rules = read(path.join(ADR_ROOT, "templates", "adr", "authoring-rules.md"));
  assert.match(rules, /## Prose style/);
  assert.match(rules, /Active voice by default/);
  assert.match(rules, /Cut the words that carry no information/);
  assert.match(rules, /One idea per sentence/);
  // the guard, and the test that separates padding from a constraint
  assert.match(rules, /Never trade completeness for brevity/);
  assert.match(rules, /if a sentence can lose a word without losing meaning/);
  // it is on the review checklist too
  assert.match(rules, /- \[ \] \*\*Prose style\*\*/);

  // authoring applies it while drafting
  const adrNew = read(path.join(ADR_ROOT, "skills", "adr-new", "SKILL.md"));
  assert.match(adrNew, /active voice/i);
  assert.match(adrNew, /never shorten by deleting content/i);

  // the reviewer owns it as R20, advisory so it cannot block or outrank a real defect
  const reviewer = read(path.join(ADR_ROOT, "agents", "adr-reviewer.md"));
  assert.match(reviewer, /R20/);
  assert.match(reviewer, /advisory and never blocks/);
  assert.match(reviewer, /Never propose a cut that removes content/);
  assert.match(reviewer, /### Prose style \(R20, advisory\)/);

  // the sweep reports it as ONE grouped finding — N per-ADR style nags would bury
  // the findings that matter
  const sweep = read(path.join(ADR_ROOT, "skills", "adr-review", "SKILL.md"));
  assert.match(sweep, /one grouped finding for the whole sweep/);
  assert.match(sweep, /never propose a cut that removes content/i);
});

// ADR edits tended to preserve the requested result by narrating what it
// replaced ("do not mix A and B; use only B"). That makes the body grow with
// every revision and forces a reader to reconstruct the current contract. Every
// path that writes ADR prose must instead state the final result directly,
// while preserving genuine prohibitions and routing history to its own homes.
test("ADR mutation paths record the final state without transition residue", () => {
  const rules = read(path.join(ADR_ROOT, "templates", "adr", "authoring-rules.md"));
  assert.match(rules, /## Final-state wording/);
  assert.match(rules, /`LEGACY_EVENT`와 `CURRENT_EVENT`를 혼용하지 않고 `CURRENT_EVENT`만/);
  assert.match(rules, /이벤트 이름은 `CURRENT_EVENT`다/);
  assert.match(rules, /타임아웃을 10초에서 30초로 변경한다/);
  assert.match(rules, /타임아웃은 30초다/);
  assert.match(rules, /\.mapping\.json.*summary/);
  assert.match(rules, /not a blanket ban on negative sentences/i);
  assert.match(rules, /requirement gate/i);
  assert.match(rules, /- \[ \] \*\*Final-state wording\*\*/);

  const sources = {
    "adr-new": read(path.join(ADR_ROOT, "skills", "adr-new", "SKILL.md")),
    "adr-impl": read(path.join(ADR_ROOT, "skills", "adr-impl", "SKILL.md")),
    "adr-sync": read(path.join(ADR_ROOT, "skills", "adr-sync", "SKILL.md")),
    "adr-rollup": read(path.join(ADR_ROOT, "skills", "adr-rollup", "SKILL.md")),
    reviewer: read(path.join(ADR_ROOT, "agents", "adr-reviewer.md")),
  };

  for (const [name, source] of Object.entries(sources)) {
    assert.match(source, /final-state|final state/i, `${name} must apply final-state wording`);
    assert.match(
      source,
      /mapping summary|\.mapping\.json.*summary/i,
      `${name} must cover the mapping summary`,
    );
    assert.match(
      source,
      /current prohibition|forbidden transition|negative sentence/i,
      `${name} must preserve current prohibitions`,
    );
  }

  assert.match(sources["adr-sync"], /Final-state reconstruction/);
  assert.match(sources.reviewer, /non-final-state narration/);
  assert.match(sources.reviewer, /Alternatives.*decision-log\.md/);

  const allShippedGuidance = [
    rules,
    ...Object.values(sources),
    read(path.join(ADR_ROOT, "templates", "adr", "concepts.md")),
    read(path.join(ADR_ROOT, "templates", "adr", "README.md")),
    read(path.join(ADR_ROOT, "templates", "adr", "decision-log.template.md")),
  ].join("\n");
  assert.match(allShippedGuidance, /LEGACY_EVENT/);
  assert.match(allShippedGuidance, /CURRENT_EVENT/);
});

// Requirements do not arrive only as numbers. An allowed value set, a mandatory
// field, a permission rule and a forbidden transition are contracts too, and the
// "code readthrough" filter sweeps them out just as easily as it swept out
// numbers — so the rules must extend the same gate to non-numeric facts, and
// must split enum (set = ADR, identifier = code) rather than calling enums
// wholesale code-authoritative.
test("the authoring rules keep non-numeric requirements, splitting enum set from identifier", () => {
  const rules = read(path.join(ADR_ROOT, "templates", "adr", "authoring-rules.md"));
  assert.match(rules, /### Non-numeric requirements/);
  // the load-bearing categories a regenerated implementation must honor
  for (const kind of [
    /Allowed value set/,
    /Mandatory or not/,
    /Permission\/visibility/,
    /Ordering\/uniqueness/,
    /Unit\/format/,
    /Allowed\/forbidden transitions/,
  ])
    assert.match(rules, kind);
  // the split that keeps a business-defined value set from being overwritten
  assert.match(
    rules,
    /set and transitions belong to the ADR, names and representation to the code/,
  );
  // an enum whose allowed set changed is a contract change, never a minor edit
  const minor = rules.match(/- \*\*Do not log it \(minor\)\*\*[^\n]*/)?.[0] ?? "";
  assert.notStrictEqual(minor, "", "the minor-vs-major log criteria must be present");
  assert.match(minor, /allowed set_ changing is major/);
});

// A requirement value lives in BOTH the ADR (the contract) and the code (its
// enforcement) — that duplication is by design, not something the code-readthrough
// filter should collapse. Only the ADR records that the number is a contract
// rather than a value the implementation happened to pick, which is why changing
// it means editing the ADR first and the code second. Without this stated, "the
// code already has the 7" reads as grounds for dropping it from the ADR, and
// "just bump the constant" reads as a change that skips the cycle entirely.
test("the rules state requirements live in both layers, ADR first when changing them", () => {
  const rules = read(path.join(ADR_ROOT, "templates", "adr", "authoring-rules.md"));
  assert.match(rules, /### Requirements live in the code and in the ADR/);
  // the two layers hold different things — contract vs enforcement
  assert.match(rules, /\*\*ADR = the contract\*\*/);
  assert.match(rules, /\*\*Code = enforcement of that contract\*\*/);
  // the ordering, and the explicit ban on the reverse
  assert.match(rules, /ADR first, code second/);
  assert.match(rules, /Never change the code first and reconcile the ADR later/);
  // concepts.md must carry the same framing where the gray-zone model is read —
  // it owns the principle and the cycle; README.md is the directory index.
  const concepts = read(path.join(ADR_ROOT, "templates", "adr", "concepts.md"));
  assert.match(concepts, /Requirements live in both the ADR and the code/);
  // and the code-readthrough filter must not be readable as a reason to drop it
  assert.match(concepts, /is not grounds for dropping a requirement that passed the gate/);
});

// The seeded docs split by role, mirroring the ladder they describe: README.md
// is the index (what an ADR is, the template, where the list lives) and
// concepts.md is the working model (the principle, the dependency model, Status).
//
// README MUST link concepts.md, and prominently. The whole point of the split is
// that an agent opening docs/adr/ reaches the principle — a reader who stops at
// the index gets the rules with no ground for them, which is how "why can't I
// put the field types here" turns into arbitrary-looking pushback. The naming
// follows the sibling files (authoring-rules, structure) rather than AGENTS.md,
// which would collide with a team's own docs/adr/AGENTS.md and with the project
// root's conventions file that the impl prompts cite.
test("README is the index and links to concepts.md, which holds the principle", () => {
  const dir = path.join(ADR_ROOT, "templates", "adr");
  const readme = read(path.join(dir, "README.md"));
  const concepts = read(path.join(dir, "concepts.md"));
  // the principle lives in concepts, with the named applications of its test
  assert.match(concepts, /## The abstraction ladder/);
  assert.match(concepts, /single-level read test/);
  for (const name of [/Regeneration test/, /Requirement gate/, /Stability gradient/]) {
    assert.match(concepts, name, `concepts.md must name ${name}`);
  }
  // README keeps the index role: the template, and no ADR list of its own
  assert.match(readme, /## ADR template/);
  assert.match(readme, /Where the ADR index lives/);
  // ...and routes the reader to the principle before the rules
  assert.match(readme, /\[`concepts\.md`\]\(\.\/concepts\.md\)/);
  assert.match(readme, /Read \[`concepts\.md`\]\(\.\/concepts\.md\) before writing or reviewing/);
  // the principle is stated once, in concepts, not duplicated into the index
  assert.doesNotMatch(readme, /single-level read test/);
  assert.doesNotMatch(readme, /## The abstraction ladder/);
  // the seeded docs must not be named AGENTS.md — a team may already have its
  // own docs/adr/AGENTS.md, and seeding would silently overwrite it
  assert.doesNotMatch(readme, /\bAGENTS\.md\b/);
  assert.doesNotMatch(concepts, /^#{1,3}.*\bAGENTS\.md\b/m);
});

// The per-turn hook is the only guard when a user just says "bump 7 turns to 10"
// without invoking a skill. If its scope test reads as "new feature or behavior
// change", a bare constant edit looks exempt — so the directive has to name a
// requirement-value change as in-scope and state the ADR-then-code ordering,
// while keeping tuning-value edits exempt.
test("the per-turn directive treats a requirement-value change as in-scope", () => {
  const hook = read(path.join(ADR_ROOT, "hooks", "surface-adr-context.mjs"));
  assert.match(
    hook,
    /changes a requirement value or rule is a behavior change even when it looks like a one-line constant edit/,
  );
  // the ordering the directive must enforce
  assert.match(hook, /fix the ADR before the code/);
  // tuning values stay exempt, so the directive does not swallow every constant
  assert.match(hook, /Keep replaceable libraries, SDKs, adapters, tuning values[^"]*in code/);
});

test("the hook command accepts either Codex or Claude plugin-root variables", () => {
  const hooks = JSON.parse(read(path.join(ADR_ROOT, "hooks", "hooks.json")));
  const command = hooks.hooks.UserPromptSubmit[0].hooks[0].command;

  for (const variable of ["PLUGIN_ROOT", "CLAUDE_PLUGIN_ROOT"]) {
    const env = { ...process.env };
    delete env.PLUGIN_ROOT;
    delete env.CLAUDE_PLUGIN_ROOT;
    env[variable] = ADR_ROOT;

    const result = spawnSync("/bin/sh", ["-c", command], {
      cwd: PLUGINS_ROOT,
      env,
      input: "{}\n",
      encoding: "utf8",
    });

    assert.equal(
      result.status,
      0,
      `${variable}-only hook execution failed:\n${result.stderr || result.stdout}`,
    );
    assert.doesNotMatch(result.stderr, /Cannot find module/);
  }
});

// Every stage that compares an ADR against code must apply the enum split, or a
// business-defined value set gets silently rewritten to whatever the code says
// under the banner of "implementation facts are code-authoritative".
test("stages that reconcile ADR against code split enum set from enum identifier", () => {
  const stages = {
    "skills/adr-sync/SKILL.md": [
      /Non-numeric requirements \(the ADR is authoritative\)/,
      /allowed states being added or removed, or a formerly forbidden transition becoming allowed, is a contract change/,
    ],
    "skills/adr-rollup/SKILL.md": [/non-numeric requirements/],
    "skills/adr-impl/SKILL.md": [/Non-numeric requirements are the same/],
    "agents/adr-impl-sufficiency-reviewer.md": [/Non-numeric requirement compliance/],
    "agents/adr-reviewer.md": [/non-numeric requirements/],
    "skills/adr-new/SKILL.md": [/Record non-numeric requirements in the same place/],
  };
  for (const [rel, patterns] of Object.entries(stages)) {
    const source = read(path.join(ADR_ROOT, rel));
    for (const pattern of patterns) assert.match(source, pattern, `${rel} must state ${pattern}`);
  }
});

test("every stage that filters an ADR body names the requirement-value rule", () => {
  const stages = {
    "agents/adr-reviewer.md": [/Requirement gate/, /R18/, /R19/],
    "skills/adr-new/SKILL.md": [/requirement value/, /regeneration test/],
    "skills/adr-sync/SKILL.md": [/requirement gate/, /Missing requirement/],
    "skills/adr-rollup/SKILL.md": [/Carry the requirement contract over without loss/],
    "skills/adr-impl/SKILL.md": [/Enforce the requirement values the ADR records, at face value/],
    "agents/adr-impl-sufficiency-reviewer.md": [/Requirement-value compliance/],
    "agents/adr-impl-necessity-reviewer.md": [
      /Requirement values recorded in the ADR are contract/,
    ],
    "agents/adr-impl-explainer.md": [/What the ADR specifies vs what the code does/],
    "agents/adr-impl-review-report-writer.md": [/Contract compliance/],
    // concepts.md owns the principle and the completeness standard; README.md is
    // the directory index, so the regeneration test is asserted there instead.
    "templates/adr/concepts.md": [/regeneration test/],
  };
  for (const [rel, patterns] of Object.entries(stages)) {
    const source = read(path.join(ADR_ROOT, rel));
    for (const pattern of patterns) assert.match(source, pattern, `${rel} must state ${pattern}`);
  }
  // the ALPS-side importer must hand the numbers over instead of summarizing
  assert.match(
    read(path.join(PLUGINS_ROOT, "alps-writer", "skills", "feature-to-adr", "SKILL.md")),
    /requirement values and non-numeric rules verbatim with their basis/,
  );
});

test("feature-to-adr separates feature order from zero-to-many ADR decisions", () => {
  const importer = read(
    path.join(PLUGINS_ROOT, "alps-writer", "skills", "feature-to-adr", "SKILL.md"),
  );

  assert.match(importer, /zero, one, or several ADRs/);
  assert.match(importer, /feature implementation order/);
  assert.match(importer, /not copied wholesale into ADR `dependsOn`/);
  assert.match(importer, /Do not silently exclude a feature because its category already exists/);
  assert.match(importer, /PRD contract changed/);
  assert.match(importer, /If there are zero admitted decisions/);
  assert.match(importer, /Never create a placeholder ADR/);
  assert.match(importer, /decision prerequisites/);
});

test("alps-init resumes from status in the dependency-respecting section order", () => {
  const init = read(path.join(PLUGINS_ROOT, "alps-writer", "skills", "alps-init", "SKILL.md"));

  assert.match(init, /1 → 2 → 3 → 4 → 6 → 5 → 7 → 8 → 9/);
  assert.match(init, /get_alps_document_status/);
  assert.match(init, /first section in that order that is not `✅ Written`/);
  assert.match(init, /Do not reopen or re-confirm a completed unchanged section/);
  assert.match(init, /user requests a full review/);
});

test("alps-init defaults to atomic confirmation but supports explicit batch approval", () => {
  const init = read(path.join(PLUGINS_ROOT, "alps-writer", "skills", "alps-init", "SKILL.md"));
  const nfr = read(path.join(PLUGINS_ROOT, "alps-writer", "src", "guides", "06.md"));
  const feature = read(path.join(PLUGINS_ROOT, "alps-writer", "src", "guides", "07.md"));

  assert.match(init, /Atomic is the default/);
  assert.match(init, /Batch is opt-in/);
  assert.match(init, /complete structured source/);
  assert.match(init, /separately labeled draft/);
  assert.match(init, /separate.*save_alps_section/s);
  assert.match(feature, /Batch approval is allowed only/);
  assert.match(feature, /separately labeled/);
  assert.match(nfr, /top-3 focus set/);
  assert.match(
    nfr,
    /Preserve every mandatory security, privacy, regulatory, accessibility, contractual/,
  );
  assert.doesNotMatch(nfr, /Maximum 3 non-functional requirements/);
});

// Section 7 is where a requirement value first enters the pipeline. If the guide
// never asks for it, /feature-to-adr has nothing to hand over and the ADR cannot
// invent it — the contract is lost before the ADR cycle begins. Both the source
// guide and the built copy the MCP server serves must carry the question.
test("ALPS Section 7 elicits the values the result must honor", () => {
  for (const dir of ["src", "dist"]) {
    const guide = read(path.join(PLUGINS_ROOT, "alps-writer", dir, "guides", "07.md"));
    const label = `alps-writer/${dir}/guides/07.md`;
    assert.match(guide, /limits, quotas, retention periods, size caps/, label);
    assert.match(guide, /must NOT decide on their own/, label);
    // the split rule, and the guard against inventing a number the user never gave
    assert.match(guide, /would a developer picking a different value break the requirement/, label);
    assert.match(guide, /Never invent a requirement value the user did not give/, label);
    // the rule cuts both ways — tuning constants stay excluded
    assert.match(guide, /tuning constants/, label);
    // requirements are not only numbers: the guide must elicit the non-numeric ones
    assert.match(guide, /Requirements do not arrive only as numbers/, label);
    assert.match(guide, /which transitions are forbidden/, label);
  }
});

// The chapter template is what lands in the user's own .alps.xml, so the rule has
// to be there too — a guide-only fix leaves the document itself saying "no
// constants", which is what dropped requirement values in the first place.
test("the Section 7 chapter template keeps requirement values and drops tuning constants", () => {
  for (const dir of ["src", "dist"]) {
    const chapter = read(
      path.join(PLUGINS_ROOT, "alps-writer", dir, "templates", "chapters", "07-feature-spec.xml"),
    );
    const label = `alps-writer/${dir}/templates/chapters/07-feature-spec.xml`;
    assert.match(chapter, /VALUES AND RULES the result must honor/, label);
    assert.match(chapter, /Values the result must honor:/, label);
    assert.match(
      chapter,
      /would a developer picking a different value break the requirement/,
      label,
    );
    assert.match(chapter, /A requirement value is not a tuning constant/, label);
    // acceptance criteria must restate the values so the number is verifiable
    assert.match(chapter, /Restate every value from 7\.x\.3/, label);
    // non-numeric requirements must survive into the user's own document too
    assert.match(chapter, /Requirements are not only numbers/, label);
  }
});

// A requirement value change alters the contract a regenerated implementation
// must honor, so it cannot be filed as a minor (unlogged) edit.
test("a requirement value change is logged as major, not swept up as minor", () => {
  const rules = read(path.join(ADR_ROOT, "templates", "adr", "authoring-rules.md"));
  const major = rules.match(/- \*\*Log it \(major\)\*\*[^\n]*/)?.[0] ?? "";
  assert.match(major, /a requirement value change/);
  // and its non-numeric twin, so a changed value set is not filed as minor either
  assert.match(major, /non-numeric requirement change/);
  const minor = rules.match(/- \*\*Do not log it \(minor\)\*\*[^\n]*/)?.[0] ?? "";
  assert.doesNotMatch(minor, /threshold/i, "threshold tweaks must not read as always-minor");
  assert.match(
    read(path.join(ADR_ROOT, "templates", "adr", "decision-log.template.md")),
    /requirement value change/,
  );
});

// The decision-log seed is the single source for the log format. authoring-rules
// must point at it rather than carrying a second, drift-prone copy of the header.
test("the decision-log format has one source: the seed file", () => {
  const seed = read(path.join(ADR_ROOT, "templates", "adr", "decision-log.template.md"));
  assert.match(seed, /^# Decision Log: <category>/);
  assert.match(seed, /\*\*Current ADR\*\*/);

  const rules = read(path.join(ADR_ROOT, "templates", "adr", "authoring-rules.md"));
  assert.match(rules, /decision-log\.template\.md/);
  // The old inline copy of the file header must be gone, or the two can drift.
  assert.doesNotMatch(rules, /# Decision Log: <category>/);
});

// ── routing and confidence invariants ─────────────────────────────────────
// An ADR edit has owners: /adr-impl (reworking code in the same cycle),
// /adr-sync (code already stands, ADR catches up), /adr-new (the topic forked,
// so supersede). /adr-impl-review is report-only, so when it surfaces a decision
// disagreement it must NAME one of those rather than saying "edit-in-place" and
// leaving the user to guess which command does it.
test("impl-review routes ADR edits to the commands that own them", () => {
  const skill = read(path.join(ADR_ROOT, "skills", "adr-impl-review", "SKILL.md"));
  const decisionChanged = skill.slice(skill.indexOf("- `Decision changed in code` →"));
  const block = decisionChanged.slice(0, decisionChanged.indexOf("- `Impl-fact mismatch`"));
  for (const cmd of [/\/adr-impl /, /\/adr-sync/, /\/adr-new/]) {
    assert.match(block, cmd, `the Decision-changed routing must name ${cmd}`);
  }
  // a decision change of this kind is major, so the log line is part of the job —
  // without it the old approach's rationale is lost when the body is overwritten
  assert.match(block, /decision-log\.md/);
  assert.match(block, /major/);
  // and the command stays report-only regardless
  assert.match(skill, /This command itself remains report-only/);
});

// The plugin must not run two confidence scales. The impl-review validator
// hard-enforces high|medium|low on findings JSON, so the document reviewer uses
// the same three words rather than inventing certain/likely/possible.
test("one confidence vocabulary across document and implementation review", () => {
  const validator = read(path.join(ADR_ROOT, "scripts", "adr-impl-review-validate.mjs"));
  const reviewer = read(path.join(ADR_ROOT, "agents", "adr-reviewer.md"));
  // the validator is the machine-checked end of the scale
  assert.match(validator, /ALLOWED_CONFIDENCE/);
  for (const level of ["high", "medium", "low"]) {
    assert.match(validator, new RegExp(`"${level}"`), `validator must allow ${level}`);
  }
  // ...and the document reviewer reports on the same scale
  assert.match(reviewer, /\(confidence: high\|medium\|low\)/);
  assert.match(reviewer, /the same three-level vocabulary/);
  // a hedge must not be able to block a save
  assert.match(reviewer, /never let one carry a `BLOCK`/);
});

// A PASS count is only as good as the rules the reviewer could reach. If the
// repo's docs lag, or the sweep batched, some rule went unevaluated across the
// whole set — and it rides along inside PASS unless the report says otherwise.
// The reviewer's three verdict values stay untouched (a fourth would fork the
// vocabulary); the sweep reports the gap in Scope instead.
test("the sweep reports unjudged axes without forking the verdict vocabulary", () => {
  const sweep = read(path.join(ADR_ROOT, "skills", "adr-review", "SKILL.md"));
  assert.match(sweep, /- Unjudged axes:/);
  assert.match(sweep, /PASS count excludes those rules/);
  // the per-ADR verdict stays three-valued
  assert.match(sweep, /<n> PASS · <n> FIX_REQUIRED · <n> BLOCK/);
  assert.match(sweep, /do not invent a fourth/);
  const reviewer = read(path.join(ADR_ROOT, "agents", "adr-reviewer.md"));
  assert.doesNotMatch(reviewer, /^PASS \| FIX_REQUIRED \| INCONCLUSIVE/m);
});

// /adr-impl and /adr-sync are the two commands that may rewrite an ADR body to
// current state, so the procedure each owns has to actually be there — the
// report-only commands route to them by name and would otherwise dead-end.
test("the edit-in-place procedure has owners, with the log and Status handling", () => {
  const impl = read(path.join(ADR_ROOT, "skills", "adr-impl", "SKILL.md"));
  assert.match(impl, /edit-in-place/);
  assert.match(impl, /decision-log\.md/);
  // /adr-impl is the one that reverts Status while the code is reworked
  assert.match(impl, /revert Status to `Proposed`/);
  const sync = read(path.join(ADR_ROOT, "skills", "adr-sync", "SKILL.md"));
  assert.match(sync, /An intended decision change/);
  assert.match(sync, /decision-log/);
});

test("every automatic Status correction uses the exact-path transition script", () => {
  for (const skill of ["adr-impl", "adr-sync"]) {
    const source = read(path.join(ADR_ROOT, "skills", skill, "SKILL.md"));
    assert.match(source, /adr-status-transition\.mjs/, `${skill} must invoke the status script`);
    assert.match(source, /exact target ADR path/, `${skill} must address the exact ADR path`);
    assert.match(
      source,
      /Do not edit .*Status|Do not edit ADR Status fields/,
      `${skill} must forbid manual Status edits`,
    );
  }
});
