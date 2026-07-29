// Guards the skill/document surface a user actually sees in the client UI.
//
// These are the invariants an audit caught by hand: /adr-impl-review shipped
// without an argument-hint even though three docs tell users to pass one, and a
// seeded template drew its pipeline in box-drawing characters against the
// project's Mermaid-first rule. Both are invisible to the existing tests, which
// check prose content rather than metadata and formatting.

import { test } from "node:test";
import assert from "node:assert/strict";
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
  assert.match(source, /카테고리 키면/);
  assert.match(source, /--base/);
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
// arrows, `bash` fences whose comments say "코드 → ADR", and the output-format
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
  assert.match(rules, /요구사항 관문/);
  assert.match(rules, /재생성 테스트/);
  // the requirement-value vs tuning-value split, with both directions stated
  assert.match(rules, /요구사항 값은 반드시 적고/);
  assert.match(rules, /구현 튜닝값/);
  // the old blanket ban on constants must be gone — it swept requirements away
  assert.doesNotMatch(rules, /구현 상수\/튜닝값/);
});

test("every stage that filters an ADR body names the requirement-value rule", () => {
  const stages = {
    "agents/adr-reviewer.md": [/요구사항 관문/, /R18/, /R19/],
    "skills/adr-new/SKILL.md": [/요구사항 값/, /재생성 테스트/],
    "skills/adr-sync/SKILL.md": [/요구사항 관문/, /Missing requirement/],
    "skills/adr-rollup/SKILL.md": [/요구사항 계약 무손실 이월/],
    "skills/adr-impl/SKILL.md": [/요구사항 값은 값 그대로 시행/],
    "agents/adr-impl-sufficiency-reviewer.md": [/요구사항 값 준수/],
    "agents/adr-impl-necessity-reviewer.md": [/요구사항 값은 계약/],
    "agents/adr-impl-explainer.md": [/ADR이 정한 값과 코드의 값/],
    "agents/adr-impl-review-report-writer.md": [/계약 준수/],
    "templates/adr/README.md": [/재생성 테스트/],
  };
  for (const [rel, patterns] of Object.entries(stages)) {
    const source = read(path.join(ADR_ROOT, rel));
    for (const pattern of patterns) assert.match(source, pattern, `${rel} must state ${pattern}`);
  }
  // the ALPS-side importer must hand the numbers over instead of summarizing
  assert.match(
    read(path.join(PLUGINS_ROOT, "alps-writer", "skills", "feature-to-adr", "SKILL.md")),
    /요구사항 계약 재료/,
  );
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
    assert.match(chapter, /VALUES the result must honor/, label);
    assert.match(chapter, /Values the result must honor:/, label);
    assert.match(
      chapter,
      /would a developer picking a different value break the requirement/,
      label,
    );
    assert.match(chapter, /A requirement value is not a tuning constant/, label);
    // acceptance criteria must restate the values so the number is verifiable
    assert.match(chapter, /Restate every value from 7\.x\.3/, label);
  }
});

// A requirement value change alters the contract a regenerated implementation
// must honor, so it cannot be filed as a minor (unlogged) edit.
test("a requirement value change is logged as major, not swept up as minor", () => {
  const rules = read(path.join(ADR_ROOT, "templates", "adr", "authoring-rules.md"));
  const major = rules.match(/- \*\*로그에 남긴다 \(major\)\*\*[^\n]*/)?.[0] ?? "";
  assert.match(major, /요구사항 값 변경/);
  const minor = rules.match(/- \*\*로그에 남기지 않는다 \(minor\)\*\*[^\n]*/)?.[0] ?? "";
  assert.doesNotMatch(minor, /임계/, "threshold tweaks must not read as always-minor");
  assert.match(
    read(path.join(ADR_ROOT, "templates", "adr", "decision-log.template.md")),
    /요구사항 값 변경/,
  );
});

// The decision-log seed is the single source for the log format. authoring-rules
// must point at it rather than carrying a second, drift-prone copy of the header.
test("the decision-log format has one source: the seed file", () => {
  const seed = read(path.join(ADR_ROOT, "templates", "adr", "decision-log.template.md"));
  assert.match(seed, /^# Decision Log: <category>/);
  assert.match(seed, /\*\*현재 ADR\*\*/);

  const rules = read(path.join(ADR_ROOT, "templates", "adr", "authoring-rules.md"));
  assert.match(rules, /decision-log\.template\.md/);
  // The old inline copy of the file header must be gone, or the two can drift.
  assert.doesNotMatch(rules, /# Decision Log: <category>/);
});
