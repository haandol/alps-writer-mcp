import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, test } from "node:test";
import { LITE_CHAPTERS_DIR, LITE_SECTION_NUMBERS, LITE_SECTION_TITLES } from "../src/constants.js";
import { LITE_ALPS_PROFILE } from "../src/profiles.js";
import { DocumentService } from "../src/tools/documents/service.js";
import { TemplateService } from "../src/tools/templates/service.js";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lite-alps-test-"));
  temporaryDirectories.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("Lite ALPS exposes the approved eight-section product outline", () => {
  assert.deepEqual(LITE_SECTION_NUMBERS, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(Object.values(LITE_SECTION_TITLES), [
    "Product Overview",
    "MVP Goals and Scope",
    "Primary User Scenario",
    "Key Features and Behavior",
    "Key Screens",
    "Shared Product Principles",
    "PoC Validation Plan",
    "Open Questions",
  ]);

  const template = new TemplateService(LITE_ALPS_PROFILE);
  assert.equal(template.listSections().length, 8);
  assert.match(template.getOverview(), /1 → 2 → 3 → 4 → 6 → 5 → 7 → 8/);
  assert.match(template.getSection(2), /2\.3 Out of Scope \(Optional\)/);
  assert.match(template.getSection(4), /User Flow and Product Response/);
  assert.match(template.getSection(4), /4\.x\.5 States and Exceptions \(Optional\)/);
  assert.match(template.getSectionGuide(5), /Section 3 .*Section 4 .*Section 6/s);
});

test("Lite chapter templates stay at product behavior resolution", () => {
  const source = fs
    .readdirSync(LITE_CHAPTERS_DIR)
    .filter((name) => name.endsWith(".xml"))
    .map((name) => fs.readFileSync(path.join(LITE_CHAPTERS_DIR, name), "utf8"))
    .join("\n");

  assert.doesNotMatch(source, /Technology Stack|C4Context|C4Container|Technical Description/);
  assert.doesNotMatch(source, /\bAPI\b|\bDatabase\b|UI\s*→\s*API/i);
  assert.match(source, /Permissions and Visibility/);
  assert.match(source, /Failure and Recovery/);
  assert.match(source, /Completion Checkpoint/);
});

test("optional edge-oriented subsections do not block Lite completion", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "ideal-path.lite.alps.xml");
  const service = new DocumentService();

  assert.match(service.initDocument("ideal-path", target, "lite"), /Created Lite ALPS/);

  const requiredBySection: Record<number, [string, string][]> = {
    2: [
      ["1", "Validation Hypothesis"],
      ["2", "In-Scope Features"],
      ["4", "Success Criteria"],
    ],
    3: [
      ["1", "User and Starting Context"],
      ["2", "Main Flow"],
      ["3", "Completion Result"],
    ],
    5: [
      ["1", "Screen Inventory"],
      ["2", "Navigation"],
    ],
    6: [
      ["1", "Permissions and Visibility"],
      ["2", "Confirmation and Changes"],
      ["4", "Accessibility and Sensitive Information"],
    ],
  };

  for (const [section, subsections] of Object.entries(requiredBySection)) {
    for (const [id, title] of subsections) {
      service.saveSection(
        Number(section),
        id,
        title,
        id === "2" && section === "2" ? "- F1: Ideal path" : "confirmed",
      );
    }
  }

  assert.match(
    service.saveSection(
      4,
      "1",
      "F1: Ideal path",
      "User goal, ideal-path flow, product response, rules, and completion checkpoint.",
    ),
    /Saved 4\.1/,
  );

  const status = service.getStatus();
  assert.match(status, /Section 2 .*✅ Written \(3\/3 subsections\)/);
  assert.match(status, /Section 3 .*✅ Written \(3\/3 subsections\)/);
  assert.match(status, /Section 4 .*✅ Written \(1\/1 features\)/);
  assert.match(status, /Section 5 .*✅ Written \(2\/2 subsections\)/);
  assert.match(status, /Section 6 .*✅ Written \(3\/3 subsections\)/);

  assert.match(service.saveSection(2, "3", "Out of Scope", "Explicitly excluded"), /Saved 2\.3/);
  assert.match(service.getStatus(), /Section 2 .*✅ Written \(3\/3 subsections\)/);
});

test("Lite documents initialize, validate, resume, and export without changing Full ALPS", () => {
  const dir = temporaryDirectory();
  const liteTarget = path.join(dir, "product.lite.alps.xml");
  const fullTarget = path.join(dir, "product.alps.xml");
  const service = new DocumentService();

  assert.match(service.initDocument("product", liteTarget, "lite"), /Created Lite ALPS document/);
  const rawLite = fs.readFileSync(liteTarget, "utf8");
  assert.match(rawLite, /<alps-document project="product" profile="lite">/);
  assert.equal([...rawLite.matchAll(/<section id="/g)].length, 8);
  assert.match(service.getStatus(), /Lite ALPS Document: product/);
  assert.doesNotMatch(service.getStatus(), /Section 9/);

  assert.match(
    service.saveSection(2, "2", "In-Scope Features", "- F1: Guided idea capture\n- F2: Preview"),
    /Saved 2\.2/,
  );
  assert.match(
    service.saveSection(4, "1", "F1: Guided idea capture", "Observable Feature behavior"),
    /Saved 4\.1/,
  );
  const beforeInvalidFeature = fs.readFileSync(liteTarget, "utf8");
  assert.match(
    service.saveSection(4, "2", "F2: Wrong name", "Must not be saved"),
    /title must be "F2: Preview"/,
  );
  assert.match(
    service.saveSection(4, "3", "F3: Undeclared", "Must not be saved"),
    /must be declared with a name in Section 2\.2/,
  );
  assert.equal(fs.readFileSync(liteTarget, "utf8"), beforeInvalidFeature);
  assert.match(service.getStatus(), /Section 4 .*In progress \(1\/2 features\)/);
  assert.match(service.saveSection(9, "1", "Anything", "x"), /Must be 1-8 for Lite ALPS/);
  assert.match(
    service.saveSection(1, "1", "Purpose", "wrong profile title"),
    /must be "Product Name"/,
  );
  assert.match(service.exportMarkdown(), /^# product Lite ALPS/m);
  assert.match(service.exportMarkdown(), /## Section 8\. Open Questions/);
  assert.doesNotMatch(service.exportMarkdown(), /## Section 9\./);

  const resumed = new DocumentService();
  assert.match(resumed.loadDocument(liteTarget), /get_lite_alps_section_guide/);
  assert.match(resumed.getStatus(), /Section 4 .*1\/2 features/);

  const full = new DocumentService();
  assert.match(full.initDocument("product", fullTarget), /Created ALPS document/);
  assert.match(full.getStatus(), /Section 9 \(Out of Scope\)/);
  assert.match(full.saveSection(1, "1", "Purpose", "Full ALPS remains unchanged"), /Saved 1\.1/);
});

test("profile and filename mismatches preserve the original document", () => {
  const dir = temporaryDirectory();
  const wrongLitePath = path.join(dir, "wrong.alps.xml");
  const wrongFullPath = path.join(dir, "wrong.lite.alps.xml");
  const wrongTitlePath = path.join(dir, "wrong-title.lite.alps.xml");
  const wrongFeaturePath = path.join(dir, "wrong-feature.lite.alps.xml");
  const wrongOrderPath = path.join(dir, "wrong-order.lite.alps.xml");
  const service = new DocumentService();

  assert.match(
    service.initDocument("lite", wrongLitePath, "lite"),
    /must use the \.lite\.alps\.xml extension/,
  );
  assert.equal(fs.existsSync(wrongLitePath), false);
  assert.match(service.initDocument("full", wrongFullPath), /must use the \.alps\.xml extension/);
  assert.equal(fs.existsSync(wrongFullPath), false);

  fs.writeFileSync(
    wrongLitePath,
    '<alps-document project="mismatch" profile="lite"><section id="1" title="Product Overview"><!-- Not started --></section></alps-document>',
  );
  assert.match(service.loadDocument(wrongLitePath), /must contain Sections 1-8 exactly once/);
  assert.match(fs.readFileSync(wrongLitePath, "utf8"), /profile="lite"/);

  assert.match(service.initDocument("lite", wrongTitlePath, "lite"), /Created Lite ALPS/);
  const wrongTitle = fs
    .readFileSync(wrongTitlePath, "utf8")
    .replace('title="Product Overview"', 'title="Overview"');
  fs.writeFileSync(wrongTitlePath, wrongTitle);
  assert.match(service.loadDocument(wrongTitlePath), /Section 1 title must be "Product Overview"/);
  assert.equal(fs.readFileSync(wrongTitlePath, "utf8"), wrongTitle);

  assert.match(service.initDocument("lite", wrongFeaturePath, "lite"), /Created Lite ALPS/);
  assert.match(
    service.saveSection(2, "2", "In-Scope Features", "- F1: Guided idea capture"),
    /Saved 2\.2/,
  );
  const wrongFeature = fs
    .readFileSync(wrongFeaturePath, "utf8")
    .replace(
      '<!-- Not started -->\n</section>\n\n<section id="5"',
      '<subsection id="4.2" title="F2: Undeclared">Invalid</subsection>\n</section>\n\n<section id="5"',
    );
  fs.writeFileSync(wrongFeaturePath, wrongFeature);
  assert.match(
    service.loadDocument(wrongFeaturePath),
    /Feature F2 must be declared with a name in Section 2\.2/,
  );
  assert.equal(fs.readFileSync(wrongFeaturePath, "utf8"), wrongFeature);

  assert.match(service.initDocument("lite", wrongOrderPath, "lite"), /Created Lite ALPS/);
  const wrongOrder = fs
    .readFileSync(wrongOrderPath, "utf8")
    .replace('<section id="2"', '<section id="1"');
  fs.writeFileSync(wrongOrderPath, wrongOrder);
  assert.match(
    service.loadDocument(wrongOrderPath),
    /must contain Sections 1-8 exactly once and in order/,
  );
  assert.equal(fs.readFileSync(wrongOrderPath, "utf8"), wrongOrder);
});

test("Lite authoring guidance preserves the approved interaction and scope rules", () => {
  const skill = fs.readFileSync(
    path.join(PACKAGE_ROOT, "skills", "lite-alps-init", "SKILL.md"),
    "utf8",
  );
  const guideDir = path.join(PACKAGE_ROOT, "src", "guides", "lite");
  const guides = fs
    .readdirSync(guideDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => fs.readFileSync(path.join(guideDir, name), "utf8"))
    .join("\n");

  assert.match(skill, /Atomic is the default/);
  assert.match(skill, /explicitly requests it or supplies a complete structured\s+source/);
  assert.match(skill, /one focused question, or at most two/);
  assert.match(skill, /1 → 2 → 3 → 4 → 6 → 5 → 7 → 8/);
  assert.match(skill, /one `4\.x` entry for each approved Feature/);
  assert.match(skill, /language the user uses/);
  assert.match(skill, /must not introduce a new product capability/);
  assert.match(skill, /Do not present completion as a\s+Full ALPS or automatic ADR handoff/s);
  assert.match(skill, /Out of Scope, Key Interruptions, States and Exceptions, Screen States/);
  assert.match(skill, /Prioritize the representative ideal path/);
  assert.doesNotMatch(guides, /technology stack|C4Context|C4Container|\bAPI\b|\bdatabase\b/i);
  assert.match(guides, /assumptions and unresolved product choices/);
  assert.match(guides, /Out of Scope may remain empty/);
  assert.match(guides, /Screen States is optional/);
  assert.match(guides, /one validation row per Feature completion checkpoint/);
});
