import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, test } from "node:test";
import {
  LEGACY_LITE_CHAPTERS_DIR,
  LEGACY_LITE_SECTION_TITLES,
  LITE_CHAPTERS_DIR,
  LITE_SECTION_NUMBERS,
  LITE_SECTION_TITLES,
  NOT_STARTED,
} from "../src/constants.js";
import { LEGACY_LITE_ALPS_PROFILE, LITE_ALPS_PROFILE } from "../src/profiles.js";
import { DocumentService } from "../src/tools/documents/service.js";
import { TemplateService } from "../src/tools/templates/service.js";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lite-alps-test-"));
  temporaryDirectories.push(dir);
  return dir;
}

function legacyLiteDocument(project: string): string {
  const sections = Object.entries(LEGACY_LITE_SECTION_TITLES)
    .map(([id, title]) => `<section id="${id}" title="${title}">\n${NOT_STARTED}\n</section>`)
    .join("\n\n");
  return `<alps-document project="${project}" profile="lite">\n\n${sections}\n\n</alps-document>`;
}

afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("current Lite ALPS exposes four PoC-focused sections", () => {
  assert.deepEqual(LITE_SECTION_NUMBERS, [1, 2, 3, 4]);
  assert.deepEqual(Object.values(LITE_SECTION_TITLES), [
    "What to Build",
    "How It Works",
    "What to Demo",
    "What Not to Do",
  ]);

  const template = new TemplateService(LITE_ALPS_PROFILE);
  assert.equal(template.listSections().length, 4);
  assert.match(template.getOverview(), /1 → 2 → 3 → 4/);
  assert.match(template.getOverview(), /Section 4 is optional/i);
  assert.match(template.getSection(1), /1\.4 Minimum Build Scope/);
  assert.match(template.getSection(2), /2\.1 Core Ideal Use Cases/);
  assert.match(template.getSection(3), /3\.3 Success Evidence/);
  assert.match(template.getSection(4), /4\.1 Excluded Users and Use Cases \(Optional\)/);
  assert.match(template.getSectionGuide(3), /Section 1 .*Section 2/s);
});

test("current Lite templates stay at minimum PoC behavior resolution", () => {
  const source = fs
    .readdirSync(LITE_CHAPTERS_DIR)
    .filter((name) => name.endsWith(".xml"))
    .map((name) => fs.readFileSync(path.join(LITE_CHAPTERS_DIR, name), "utf8"))
    .join("\n");

  assert.doesNotMatch(source, /Technology Stack|C4Context|C4Container|Technical Description/);
  assert.doesNotMatch(source, /\bAPI\b|\bDatabase\b|UI\s*→\s*API/i);
  assert.doesNotMatch(source, /\bF\d+\b|State Matrix/i);
  assert.match(source, /Do not assign Feature IDs/i);
  assert.match(source, /Primary Persona/);
  assert.match(source, /Core Ideal Use Cases/);
  assert.match(source, /Demo Flow/);
  assert.match(source, /What Not to Do/);
});

test("optional What Not to Do does not block current Lite completion", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "minimum-poc.lite.alps.xml");
  const service = new DocumentService();

  assert.match(service.initDocument("minimum-poc", target, "lite"), /Created Lite ALPS/);

  const requiredBySection: Record<number, [string, string][]> = {
    1: [
      ["1", "Primary Persona"],
      ["2", "Problem"],
      ["3", "PoC Intent"],
      ["4", "Minimum Build Scope"],
      ["5", "Success Condition"],
    ],
    2: [["1", "Core Ideal Use Cases"]],
    3: [
      ["1", "Demo Intent"],
      ["2", "Demo Flow"],
      ["3", "Success Evidence"],
    ],
  };

  for (const [section, subsections] of Object.entries(requiredBySection)) {
    for (const [id, title] of subsections) {
      assert.match(service.saveSection(Number(section), id, title, "confirmed"), /Saved/);
    }
  }

  const status = service.getStatus();
  assert.match(status, /Section 1 .*✅ Written \(5\/5 subsections\)/);
  assert.match(status, /Section 2 .*✅ Written \(1\/1 subsections\)/);
  assert.match(status, /Section 3 .*✅ Written \(3\/3 subsections\)/);
  assert.match(status, /Section 4 .*Optional — not written/);
  assert.match(service.exportMarkdown(), /## Section 4\. What Not to Do/);

  assert.match(
    service.saveSection(4, "1", "Excluded Users and Use Cases", "Explicitly excluded"),
    /Saved 4\.1/,
  );
  assert.match(service.getStatus(), /Section 4 .*✅ Written \(1 optional subsection\)/);
});

test("current Lite documents initialize, validate, resume, and export independently from Full ALPS", () => {
  const dir = temporaryDirectory();
  const liteTarget = path.join(dir, "product.lite.alps.xml");
  const fullTarget = path.join(dir, "product.alps.xml");
  const service = new DocumentService();

  assert.match(service.initDocument("product", liteTarget, "lite"), /Created Lite ALPS document/);
  const rawLite = fs.readFileSync(liteTarget, "utf8");
  assert.match(rawLite, /<alps-document project="product" profile="lite">/);
  assert.equal([...rawLite.matchAll(/<section id="/g)].length, 4);
  assert.match(service.getStatus(), /Lite ALPS Document: product/);
  assert.doesNotMatch(service.getStatus(), /Section 5/);

  assert.match(
    service.saveSection(1, "1", "Primary Persona", "Adult English learner"),
    /Saved 1\.1/,
  );
  const beforeInvalid = fs.readFileSync(liteTarget, "utf8");
  assert.match(service.saveSection(5, "1", "Anything", "x"), /Must be 1-4 for Lite ALPS/);
  assert.match(
    service.saveSection(1, "1", "Product Name", "wrong current title"),
    /must be "Primary Persona"/,
  );
  assert.equal(fs.readFileSync(liteTarget, "utf8"), beforeInvalid);
  assert.match(service.exportMarkdown(), /^# product Lite ALPS/m);
  assert.match(service.exportMarkdown(), /## Section 4\. What Not to Do/);
  assert.doesNotMatch(service.exportMarkdown(), /## Section 5\./);

  const resumed = new DocumentService();
  assert.match(resumed.loadDocument(liteTarget), /get_lite_alps_section_guide/);
  assert.doesNotMatch(resumed.loadDocument(liteTarget), /get_legacy_lite_alps_section_guide/);

  const full = new DocumentService();
  assert.match(full.initDocument("product", fullTarget), /Created ALPS document/);
  assert.match(full.getStatus(), /Section 9 \(Out of Scope\)/);
  assert.match(full.saveSection(1, "1", "Purpose", "Full ALPS remains independent"), /Saved 1\.1/);
  assert.doesNotMatch(fs.readFileSync(liteTarget, "utf8"), /Full ALPS remains independent/);
});

test("legacy eight-section Lite documents remain editable and are never auto-converted", () => {
  const dir = temporaryDirectory();
  const target = path.join(dir, "legacy.lite.alps.xml");
  const original = legacyLiteDocument("legacy");
  fs.writeFileSync(target, original);

  const service = new DocumentService();
  const loaded = service.loadDocument(target);
  assert.match(loaded, /Legacy Lite ALPS Document: legacy/);
  assert.match(loaded, /get_legacy_lite_alps_section_guide/);
  assert.doesNotMatch(loaded, /get_lite_alps_section_guide\(N\)/);
  assert.match(service.getStatus(), /Section 8 \(Open Questions\)/);

  assert.match(service.saveSection(1, "1", "Product Name", "Legacy product"), /Saved 1\.1/);
  assert.match(
    service.saveSection(2, "2", "In-Scope Features", "- F1: Guided idea capture"),
    /Saved 2\.2/,
  );
  assert.match(
    service.saveSection(4, "1", "F1: Guided idea capture", "Legacy Feature behavior"),
    /Saved 4\.1/,
  );
  assert.match(service.exportMarkdown(), /## Section 8\. Open Questions/);

  const saved = fs.readFileSync(target, "utf8");
  assert.equal([...saved.matchAll(/<section id="/g)].length, 8);
  assert.match(saved, /title="Product Overview"/);
  assert.doesNotMatch(saved, /title="What to Build"/);
});

test("current and legacy profile mismatches preserve the original document", () => {
  const dir = temporaryDirectory();
  const wrongLitePath = path.join(dir, "wrong.alps.xml");
  const wrongFullPath = path.join(dir, "wrong.lite.alps.xml");
  const wrongShapePath = path.join(dir, "wrong-shape.lite.alps.xml");
  const wrongTitlePath = path.join(dir, "wrong-title.lite.alps.xml");
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
    wrongShapePath,
    '<alps-document project="mismatch" profile="lite"><section id="1" title="What to Build"><!-- Not started --></section></alps-document>',
  );
  const wrongShape = fs.readFileSync(wrongShapePath, "utf8");
  assert.match(service.loadDocument(wrongShapePath), /current Sections 1-4 or legacy Sections 1-8/);
  assert.equal(fs.readFileSync(wrongShapePath, "utf8"), wrongShape);

  assert.match(service.initDocument("lite", wrongTitlePath, "lite"), /Created Lite ALPS/);
  const wrongTitle = fs
    .readFileSync(wrongTitlePath, "utf8")
    .replace('title="What to Build"', 'title="Product Overview"');
  fs.writeFileSync(wrongTitlePath, wrongTitle);
  assert.match(service.loadDocument(wrongTitlePath), /Section 1 title must be "What to Build"/);
  assert.equal(fs.readFileSync(wrongTitlePath, "utf8"), wrongTitle);

  assert.match(service.initDocument("lite", wrongOrderPath, "lite"), /Created Lite ALPS/);
  const wrongOrder = fs
    .readFileSync(wrongOrderPath, "utf8")
    .replace('<section id="2"', '<section id="1"');
  fs.writeFileSync(wrongOrderPath, wrongOrder);
  assert.match(service.loadDocument(wrongOrderPath), /current Sections 1-4 or legacy Sections 1-8/);
  assert.equal(fs.readFileSync(wrongOrderPath, "utf8"), wrongOrder);
});

test("current Lite guidance is minimal, optional at Section 4, and independent from Full ALPS", () => {
  const skill = fs.readFileSync(
    path.join(PACKAGE_ROOT, "skills", "lite-alps-init", "SKILL.md"),
    "utf8",
  );
  const runtime = fs.readFileSync(path.join(PACKAGE_ROOT, "src", "index.ts"), "utf8");
  const overview = fs.readFileSync(
    path.join(PACKAGE_ROOT, "src", "templates", "lite", "overview.md"),
    "utf8",
  );
  const guides = [1, 2, 3, 4]
    .map((section) =>
      fs.readFileSync(
        path.join(PACKAGE_ROOT, "src", "guides", "lite", `${String(section).padStart(2, "0")}.md`),
        "utf8",
      ),
    )
    .join("\n");

  for (const source of [skill, runtime, overview]) {
    assert.match(source, /What to Build/i);
    assert.match(source, /How It Works/i);
    assert.match(source, /What to Demo/i);
    assert.match(source, /What Not to Do/i);
    assert.match(source, /separate goal|separate goals|separate.*process/i);
    assert.match(
      source,
      /never (?:reads? or updates?|reads?, updates?|read, update)|never uses Lite state/i,
    );
  }

  assert.match(skill, /1 → 2 → 3 → 4/);
  assert.match(skill, /Section 4 is optional/i);
  assert.match(skill, /Legacy Lite ALPS/i);
  assert.match(skill, /never convert it automatically/i);
  assert.doesNotMatch(skill, /start a separate Full ALPS|use the Lite document as a reference/i);
  assert.doesNotMatch(guides, /technology stack|C4Context|C4Container|\bAPI\b|\bdatabase\b/i);
  assert.doesNotMatch(guides, /Full ALPS/i);
  assert.match(guides, /Do not introduce Feature IDs/i);
  assert.match(guides, /Section is optional/i);
  assert.match(guides, /Do not invent non-goals/i);
});

test("legacy template assets remain complete and separate from the current profile", () => {
  const legacyTemplate = new TemplateService(LEGACY_LITE_ALPS_PROFILE);
  assert.equal(legacyTemplate.listSections().length, 8);
  assert.match(legacyTemplate.getOverview(), /Legacy Lite ALPS Template/);
  assert.match(legacyTemplate.getSection(4), /Feature Template/);
  assert.match(legacyTemplate.getSectionGuide(7), /PoC Validation Plan/);

  const legacyFiles = fs
    .readdirSync(LEGACY_LITE_CHAPTERS_DIR)
    .filter((name) => name.endsWith(".xml"));
  assert.equal(legacyFiles.length, 8);
  assert.equal(fs.readdirSync(LITE_CHAPTERS_DIR).filter((name) => name.endsWith(".xml")).length, 4);
});
