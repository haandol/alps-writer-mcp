import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { TemplateService } from "../src/tools/templates/service.js";

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(PLUGIN_ROOT, relativePath), "utf8");
}

test("approval guidance uses a contract-complete plain-text digest", () => {
  const sources = [
    read("src/index.ts"),
    read("skills/alps-init/SKILL.md"),
    read("src/templates/overview.md"),
  ];

  for (const source of sources) {
    assert.match(source, /plain-text approval digest/i);
    assert.match(source, /requirement (?:value|contract)/i);
    assert.match(source, /permission|권한/i);
    assert.match(source, /transition|전이/i);
    assert.match(source, /full pending content|전체 내용|전체 원문/i);
    assert.match(source, /absent from the (?:approval )?digest|digest에 없던/i);
    assert.match(source, /do not name omitted implementation details/i);
  }

  const overview = new TemplateService().getOverview();
  assert.match(overview, /readable as raw text/i);
  assert.match(overview, /approve, revise a named item, or defer/i);
  assert.doesNotMatch(overview, /print FULL section/i);
});

test("Full and Lite authoring infer product constants before asking", () => {
  const sources = [
    read("src/index.ts"),
    read("skills/alps-init/SKILL.md"),
    read("skills/lite-alps-init/SKILL.md"),
    read("src/templates/overview.md"),
    read("src/templates/lite/overview.md"),
    read("src/tools/documents/service.ts"),
  ];

  for (const source of sources) {
    assert.match(source, /inference-first/i);
    assert.match(source, /AI-inferred/i);
    assert.match(source, /ask (?:no|zero) question/i);
    assert.match(source, /money|permissions|legal|regulatory|privacy|safety/i);
    assert.match(source, /explicit (?:approval|confirmation)|user approv/i);
  }

  const guidePaths = [
    ...Array.from(
      { length: 9 },
      (_, index) => `src/guides/${String(index + 1).padStart(2, "0")}.md`,
    ),
    ...Array.from(
      { length: 4 },
      (_, index) => `src/guides/lite/${String(index + 1).padStart(2, "0")}.md`,
    ),
  ];
  for (const guidePath of guidePaths) {
    assert.match(read(guidePath), /<inference_first>/i, guidePath);
  }
});

test("Section 7 keeps Feature-level save units and suggests splits at seven or higher", () => {
  const guide = new TemplateService().getSectionGuide(7);
  const skill = read("skills/alps-init/SKILL.md");

  for (const source of [guide, skill]) {
    assert.match(source, /7\/10.*or higher|7\/10.*이상/i);
    assert.match(source, /up to three|최대 세 개/i);
    assert.match(source, /(?:keep|keeping) the original Feature|원래 Feature/i);
    assert.match(source, /never blocks approval or saving|승인.*저장.*차단하지/i);
    assert.match(source, /independently (?:demonstrable|observable) user[-\s]+behavior/i);
    assert.match(source, /Section 6 and Section 7 Feature boundaries\s+together/i);
  }

  assert.match(guide, /Feature `7\.x` is one approval and save unit/i);
  assert.match(guide, /`7\.x\.1`-`7\.x\.6`/i);
});
