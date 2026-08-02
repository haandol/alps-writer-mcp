// Guards the tables that are consumed from more than one place.
//
// Three lists in this plugin used to exist as independent copies: the
// anti-pattern segments (mapping keys vs on-disk directories), the seeded
// rule-doc set (lint, test fixtures, eval fixtures, bump), and the impl-review
// finding categories (validator allow-list, report display metadata, report sort
// order). Each was verified identical by hand at the time, and nothing checked
// them afterwards — so adding an entry to one copy failed silently: a category
// the validator rejects but the report renders, a doc the lint judges but bump
// never stamps, a directory segment banned in the mapping but allowed on disk.
//
// They are single tables now. These tests assert the consumers that cannot
// import them (bump-version.mjs, which must not depend on plugin internals) still
// agree, and that each table stays complete for every consumer that reads it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  ANTIPATTERN_SEGMENTS,
  SEEDED_RULE_DOCS,
  STAMPED_RULE_DOCS,
  checkCategoryKey,
} from "../scripts/adr-lint-lib.mjs";
import {
  CATEGORIES,
  CATEGORY_NAMES,
  AUTHORITY,
  VERDICTS,
  VERDICT_NAMES,
} from "../scripts/adr-impl-review-categories.mjs";
import { TEMPLATES, PLUGIN_ROOT, RULE_DOCS } from "./helpers.mjs";

const REPO_ROOT = path.resolve(PLUGIN_ROOT, "..", "..");

// ── anti-pattern segments ─────────────────────────────────────────────────
// R5a is checked twice: on the mapping's category keys (checkCategoryKey) and on
// the ADR's on-disk directory path (so a mapping-less repo is still linted). The
// CLI held its own copy of the list for the second check. If they diverge, a
// segment is banned in one place and allowed in the other.
test("every anti-pattern segment is rejected as a category key", () => {
  for (const segment of ANTIPATTERN_SEGMENTS) {
    const issues = checkCategoryKey(segment);
    assert.ok(
      issues.some((i) => i.reason === "anti-pattern-segment"),
      `"${segment}" is in ANTIPATTERN_SEGMENTS but checkCategoryKey does not flag it`,
    );
  }
});

test("the CLI reads ANTIPATTERN_SEGMENTS rather than its own copy of the list", () => {
  const cli = readFileSync(path.join(PLUGIN_ROOT, "scripts", "adr-structure-lint.mjs"), "utf8");
  assert.match(
    cli,
    /ANTIPATTERN_SEGMENTS\.has\(/,
    "adr-structure-lint.mjs must test directory segments against the shared Set",
  );
  assert.doesNotMatch(
    cli,
    /function isAntiPattern/,
    "a local isAntiPattern() copy has come back — use ANTIPATTERN_SEGMENTS instead",
  );
});

// ── seeded rule docs ──────────────────────────────────────────────────────
test("every seeded rule doc exists in templates/adr/", () => {
  const shipped = new Set(readdirSync(TEMPLATES));
  for (const doc of STAMPED_RULE_DOCS) {
    assert.ok(
      shipped.has(doc),
      `${doc} is listed as a rule doc but templates/adr/ has no such file`,
    );
  }
});

test("the stamped set is the seeded set plus the decision-log template", () => {
  assert.deepEqual(STAMPED_RULE_DOCS, [...SEEDED_RULE_DOCS, "decision-log.template.md"]);
  // The log template is scaffolding a category copies and edits, so it carries a
  // stamp (bump rewrites it) but is deliberately outside the staleness compare.
  assert.equal(SEEDED_RULE_DOCS.includes("decision-log.template.md"), false);
});

test("test fixtures seed exactly the doc set the lint judges", () => {
  assert.deepEqual([...RULE_DOCS].sort(), [...SEEDED_RULE_DOCS].sort());
});

// bump-version.mjs spells the list out because a repo-level release script must
// not import plugin internals. That copy is the one thing left that can drift,
// and the direction that hurts is a doc the lint expects a stamp on that bump
// never rewrites — the lint then reports the plugin's own templates as stale.
test("bump-version.mjs stamps every doc the lint expects a stamp on", () => {
  const source = readFileSync(path.join(REPO_ROOT, "scripts", "bump-version.mjs"), "utf8");
  const block = source.match(/const RULE_DOCS = \[([\s\S]*?)\];/);
  assert.ok(block, "could not find the RULE_DOCS list in bump-version.mjs");
  const stamped = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => path.basename(m[1]));

  assert.deepEqual(
    stamped.sort(),
    [...STAMPED_RULE_DOCS].sort(),
    "bump-version.mjs RULE_DOCS must equal STAMPED_RULE_DOCS in adr-lint-lib.mjs",
  );
});

test("every stamped template actually carries a rules-version stamp today", () => {
  for (const doc of STAMPED_RULE_DOCS) {
    const body = readFileSync(path.join(TEMPLATES, doc), "utf8");
    assert.match(
      body,
      /<!--\s*adr-writer:rules-version\s+\d+\.\d+\.\d+/,
      `${doc} is in STAMPED_RULE_DOCS but carries no stamp for bump to rewrite`,
    );
  }
});

// ── impl-review finding categories ────────────────────────────────────────
test("every finding category is complete for both consumers", () => {
  for (const [name, meta] of Object.entries(CATEGORIES)) {
    assert.equal(typeof meta.hue, "string", `${name} has no hue`);
    assert.match(meta.hue, /^#[0-9a-f]{6}$/i, `${name} hue is not a hex color`);
    assert.ok(meta.blurb, `${name} has no blurb`);
    assert.ok(
      Object.prototype.hasOwnProperty.call(AUTHORITY, meta.authority),
      `${name} authority "${meta.authority}" has no AUTHORITY entry — the report would fall back to advisory`,
    );
    assert.ok(
      ["fix", "skip", "defer"].includes(meta.defaultDecision),
      `${name} defaultDecision "${meta.defaultDecision}" is not a ruling the report renders`,
    );
    assert.equal(
      typeof meta.priority,
      "number",
      `${name} has no priority — it would sort by the ?? 99 fallback`,
    );
  }
});

test("finding priorities are a unique contiguous ranking", () => {
  const priorities = Object.values(CATEGORIES)
    .map((m) => m.priority)
    .sort((a, b) => a - b);
  assert.deepEqual(
    priorities,
    priorities.map((_, i) => i),
    "priorities must be 0..N-1 with no gap or tie, so the docket order is total",
  );
});

test("the validator's allow-list is the shared category table", () => {
  const source = readFileSync(
    path.join(PLUGIN_ROOT, "scripts", "adr-impl-review-validate.mjs"),
    "utf8",
  );
  assert.match(
    source,
    /ALLOWED_CATEGORIES = CATEGORY_NAMES/,
    "adr-impl-review-validate.mjs must take its categories from the shared table",
  );
  assert.deepEqual([...CATEGORY_NAMES].sort(), Object.keys(CATEGORIES).sort());
});

test("the renderer holds no second copy of the category or verdict tables", () => {
  const source = readFileSync(
    path.join(PLUGIN_ROOT, "scripts", "adr-impl-review-report.mjs"),
    "utf8",
  );
  for (const forbidden of ["const CATEGORIES = {", "const PRIORITY = {", "const VERDICTS = {"]) {
    assert.equal(
      source.includes(forbidden),
      false,
      `adr-impl-review-report.mjs re-declared ${forbidden.slice(6)} — import it from adr-impl-review-categories.mjs`,
    );
  }
});

test("every verdict is complete and named", () => {
  assert.deepEqual([...VERDICT_NAMES].sort(), Object.keys(VERDICTS).sort());
  for (const [name, meta] of Object.entries(VERDICTS)) {
    assert.match(meta.hue, /^#[0-9a-f]{6}$/i, `${name} hue is not a hex color`);
    assert.ok(meta.note, `${name} has no note`);
  }
});

// The SKILL prompt tells the reviewing subagent which category tags to emit. A
// tag it invents that the validator does not accept fails the run; a category
// added here that the SKILL never mentions is dead vocabulary. Assert the shipped
// prompt names every one.
test("the impl-review SKILL documents every finding category", () => {
  const skill = readFileSync(
    path.join(PLUGIN_ROOT, "skills", "adr-impl-review", "SKILL.md"),
    "utf8",
  );
  for (const name of CATEGORY_NAMES) {
    assert.ok(skill.includes(name), `SKILL.md never mentions the "${name}" category`);
  }
});
