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
