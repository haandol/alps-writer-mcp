import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { CHAPTERS_DIR, GUIDES_DIR, SECTION_REFERENCES } from "../src/constants.js";
import { TemplateService } from "../src/tools/templates/service.js";

const PLUGIN_ROOT = path.resolve(CHAPTERS_DIR, "..", "..", "..");

test("Section 7 requires a product-level Feature Demo connected to Section 3", () => {
  assert.deepEqual(SECTION_REFERENCES[7], [3, 6]);

  const guide = fs.readFileSync(path.join(GUIDES_DIR, "07.md"), "utf8");
  for (const expected of [
    "Section 3 \\(Demo Scenario\\)",
    "Feature Demo",
    "preconditions",
    "actions does the user perform",
    "observable result",
    "representative failure",
    "success judgment",
    "PR boundaries",
    "commits",
  ]) {
    assert.match(guide, new RegExp(expected, "i"));
  }

  const chapterFile = fs
    .readdirSync(CHAPTERS_DIR)
    .find((name) => name.startsWith("07-") && name.endsWith(".xml"));
  assert.ok(chapterFile);
  const chapter = fs.readFileSync(path.join(CHAPTERS_DIR, chapterFile), "utf8");
  assert.match(chapter, /id="7\.x\.7" title="Feature Demo"/);
  assert.match(chapter, /Section 3 end-to-end demo/);
  assert.match(chapter, /product-level preconditions/);
  assert.match(chapter, /observable result/);
  assert.match(chapter, /representative user-visible rejection or failure/);
  assert.match(chapter, /success judgment/);
  assert.match(chapter, /Do not include test files, deployment commands, PR or commit plans/);

  const skill = fs.readFileSync(path.join(PLUGIN_ROOT, "skills", "alps-init", "SKILL.md"), "utf8");
  assert.match(skill, /Review Section 3 and Section 6 first/);
  assert.match(skill, /Every Feature must include a Feature Demo/);
  assert.match(skill, /preconditions, user actions, observable result/);
  assert.match(skill, /representative failure behavior/);
  assert.match(skill, /success judgment/);
});

test("the Section 7 runtime surfaces the Feature Demo and both dependencies", () => {
  const service = new TemplateService();
  const template = service.getSection(7, true);
  const guide = service.getSectionGuide(7);

  assert.match(template, /#### 7\.x\.7 Feature Demo/);
  assert.match(template, /Role in the Section 3 demo/);
  assert.match(template, /Representative failure/);
  assert.match(template, /Success judgment/);

  assert.match(guide, /Section 3 \(Demo Scenario\), Section 6 \(Requirements Summary\)/);
  assert.match(guide, /read_alps_section\(3\), read_alps_section\(6\)/);
});
