import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { LITE_ALPS_PROFILE } from "../src/profiles.js";
import { TemplateService } from "../src/tools/templates/service.js";

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(PLUGIN_ROOT, relativePath), "utf8");
}

function c4Declarations(source: string): string[] {
  return [...source.matchAll(/^C4[A-Za-z]+\s*$/gm)].map((match) => match[0].trim());
}

const expectedC4Levels = ["C4Context", "C4Container"];

test("Section 4 ships required Context and Container examples without lower C4 levels", () => {
  const template = read("src/templates/chapters/04-architecture.xml");
  const runtimeSection = new TemplateService().getSection(4, true);

  assert.deepEqual(c4Declarations(template), expectedC4Levels);
  assert.deepEqual(c4Declarations(runtimeSection), expectedC4Levels);
  assert.match(template, /Context diagram is required/);
  assert.match(template, /Container diagram is required/);
  assert.match(template, /only C4 levels allowed/);
  assert.doesNotMatch(template, /Container diagram is optional/);
});

test("the Section 4 guide requires both diagrams and keeps implementation detail out", () => {
  const guide = read("src/guides/04.md");
  const runtimeGuide = new TemplateService().getSectionGuide(4);

  for (const source of [guide, runtimeGuide]) {
    assert.deepEqual(c4Declarations(source), expectedC4Levels);
    assert.match(source, /MUST contain both/);
    assert.match(source, /only C4 levels ALPS uses/);
    assert.match(source, /modules, classes, functions, files, or methods/);
  }
});

test("the overview and alps-init keep Context and Container as the only C4 levels", () => {
  const overview = read("src/templates/overview.md");
  const skill = read("skills/alps-init/SKILL.md");

  for (const source of [overview, skill]) {
    assert.match(source, /C4Context/);
    assert.match(source, /C4Container/);
    assert.match(source, /only C4 levels/);
    assert.match(source, /Component, Dynamic, Deployment, or Code-level/);
  }
});

test("Lite Solution Strategy ships one product-level Context without Container", () => {
  const template = read(
    "src/templates/lite/chapters/02-solution-and-essential-user-experiences.xml",
  );
  const guide = read("src/guides/lite/02.md");
  const runtimeSection = new TemplateService(LITE_ALPS_PROFILE).getSection(2, true);

  assert.deepEqual(c4Declarations(template), ["C4Context"]);
  assert.deepEqual(c4Declarations(runtimeSection), ["C4Context"]);
  for (const source of [template, guide]) {
    assert.match(source, /Product Context Diagram/);
    assert.match(source, /exactly one Mermaid `C4Context`/i);
    assert.match(source, /target user.*PoC system.*external systems/is);
    assert.match(source, /C4Container/);
    assert.match(source, /API|APIs/);
    assert.match(source, /database/i);
  }
});
