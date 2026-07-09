// Tests for the .mapping.json invariants that the skills promise to uphold
// (schema: templates/adr/mapping.schema.json). No JSON-schema lib is vendored,
// so we assert the load-bearing invariants directly — the same ones adr-sync
// step 6 ("dependsOn integrity") and feature-to-adr step 1 (acyclic) enforce.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TEMPLATES } from "./helpers.mjs";
// The pure invariant checkers now live in scripts/adr-lint-lib.mjs so the same
// logic backs both these tests (fixtures) and the adr-structure-lint harness
// (a project's real .mapping.json). Import them instead of redefining inline.
import {
  KEY_RE,
  dependsOnDangling,
  hasCycle,
  selfEdges,
  validateMappingShape,
} from "../scripts/adr-lint-lib.mjs";

const SCHEMA = JSON.parse(fs.readFileSync(path.join(TEMPLATES, "mapping.schema.json"), "utf8"));

test("schema carries no ALPS/PRD field — adr-writer is standalone", () => {
  const entryProps = SCHEMA.properties.categories.additionalProperties.properties;
  assert.equal("alpsFeatureId" in entryProps, false, "no alpsFeatureId on entries");
  assert.equal("alpsDocument" in SCHEMA.properties, false, "no top-level alpsDocument");
  // the only allowed top-level keys are $schema + categories
  assert.deepEqual(Object.keys(SCHEMA.properties).sort(), ["$schema", "categories"]);
});

test("schema category-id doc keeps keys name-derived, Feature-ID-as-key forbidden", () => {
  const desc = SCHEMA.properties.categories.description;
  assert.match(desc, /derived from the feature NAME/i);
  assert.match(desc, /Feature ID is never used as a key/i);
  assert.match(desc, /fallback/i);
});

test("canonical example mapping satisfies key/dependsOn invariants", () => {
  const mapping = {
    categories: {
      identity: { feature: "Identity", subdomainType: "core", adrs: [] },
      "identity/login": {
        feature: "Login",
        adrs: [{ path: "docs/adr/identity/login/0001-x.md", status: "Proposed", summary: "s" }],
        dependsOn: [],
      },
      "ordering/checkout": {
        feature: "Checkout",
        adrs: [
          {
            path: "docs/adr/ordering/checkout/0001-x.md",
            status: "Accepted (2026-07-02)",
            summary: "s",
          },
        ],
        dependsOn: ["identity/login"],
      },
    },
  };
  for (const k of Object.keys(mapping.categories))
    assert.match(k, KEY_RE, `key "${k}" must be ≤2 kebab segments`);
  assert.deepEqual(dependsOnDangling(mapping), [], "no dangling dependsOn");
  assert.equal(hasCycle(mapping), false, "must be acyclic");
  assert.deepEqual(
    validateMappingShape(mapping).filter((i) => i.level === "error"),
    [],
    "clean object-shaped adrs pass",
  );
});

test("dangling dependsOn is detected", () => {
  const mapping = {
    categories: {
      "ordering/checkout": { adrs: [], dependsOn: ["identity/login"] }, // login absent
    },
  };
  assert.deepEqual(dependsOnDangling(mapping), ["ordering/checkout→identity/login"]);
});

test("cyclic dependsOn is detected", () => {
  const mapping = {
    categories: {
      a: { adrs: [], dependsOn: ["b"] },
      b: { adrs: [], dependsOn: ["a"] },
    },
  };
  assert.equal(hasCycle(mapping), true);
});

test("Feature-ID-shaped keys (f1) still pass key regex as a fallback layout", () => {
  // fallback is allowed by the schema when no meaningful kebab name exists
  assert.match("f1", KEY_RE);
  assert.match("f-auth-01", KEY_RE);
});

test("self-edge (a→a) is detected as a cycle AND by selfEdges", () => {
  const mapping = { categories: { a: { adrs: [], dependsOn: ["a"] } } };
  assert.equal(hasCycle(mapping), true, "a self-loop is a cycle");
  assert.deepEqual(selfEdges(mapping), ["a"]);
});

test("selfEdges is empty for a clean acyclic mapping", () => {
  const mapping = {
    categories: {
      "identity/login": { adrs: [], dependsOn: [] },
      "ordering/checkout": { adrs: [], dependsOn: ["identity/login"] },
    },
  };
  assert.deepEqual(selfEdges(mapping), []);
});

test("KEY_RE REJECTS 3-segment, uppercase, and trailing-slash keys", () => {
  assert.equal(KEY_RE.test("identity/login/social"), false, "3 segments banned");
  assert.equal(KEY_RE.test("Identity"), false, "uppercase banned");
  assert.equal(KEY_RE.test("identity/"), false, "trailing slash banned");
  assert.equal(KEY_RE.test("-lead"), false, "leading hyphen banned");
  assert.equal(KEY_RE.test("trail-"), false, "trailing hyphen banned");
});

// --- schema hardening (mapping.schema.json) ---

test("schema pins category keys to ≤2 kebab segments via propertyNames.pattern", () => {
  const pat = SCHEMA.properties.categories.propertyNames?.pattern;
  assert.ok(pat, "categories must declare propertyNames.pattern");
  const re = new RegExp(pat);
  assert.equal(re.test("identity/login"), true);
  assert.equal(re.test("identity/login/social"), false);
  assert.equal(re.test("F1"), false);
});

test("schema rejects unknown entry fields (additionalProperties:false)", () => {
  const entry = SCHEMA.properties.categories.additionalProperties;
  assert.equal(entry.additionalProperties, false, "entry must forbid unknown fields");
  assert.equal(SCHEMA.additionalProperties, false, "top-level must forbid unknown fields");
  // $schema + categories are the only allowed top-level keys (no alpsDocument)
  assert.ok(SCHEMA.properties.$schema, "$schema must be an allowed top-level key");
});

test("schema adrs items are {path,status,summary} objects, path+status required", () => {
  const adrs = SCHEMA.properties.categories.additionalProperties.properties.adrs;
  assert.equal(adrs.uniqueItems, true, "adrs must be uniqueItems");
  assert.equal("minItems" in adrs, false, "minItems removed — context entries may have adrs:[]");
  assert.equal(adrs.items.type, "object", "each adr is an index record object");
  assert.equal(adrs.items.additionalProperties, false, "adr record forbids unknown fields");
  assert.deepEqual(adrs.items.required.sort(), ["path", "status"]);
  assert.ok(adrs.items.properties.summary, "summary is an allowed (optional) field");
  // adrs stays required (the key must be present, even if empty)
  assert.ok(
    SCHEMA.properties.categories.additionalProperties.required.includes("adrs"),
    "adrs stays required",
  );
});

test("validateMappingShape flags bad adr records (non-object, missing status, bad enum)", () => {
  const m = {
    categories: {
      a: { adrs: ["docs/adr/a/0001-x.md"] }, // legacy bare string → adrs-item-type
      b: { adrs: [{ path: "docs/adr/b/0001-x.md" }] }, // missing status
      c: { adrs: [{ path: "docs/adr/c/0001-x.md", status: "Done" }] }, // invalid enum
    },
  };
  const codes = validateMappingShape(m).map((i) => i.code);
  assert.ok(codes.includes("adrs-item-type"), "bare string is not an index record");
  assert.ok(codes.includes("adrs-item-status-missing"));
  assert.ok(codes.includes("adrs-item-status-enum"));
});

test("validateMappingShape detects a path double-indexed across categories", () => {
  const m = {
    categories: {
      a: { adrs: [{ path: "docs/adr/shared/0001-x.md", status: "Proposed" }] },
      b: { adrs: [{ path: "docs/adr/shared/0001-x.md", status: "Proposed" }] },
    },
  };
  assert.ok(validateMappingShape(m).some((i) => i.code === "adr-double-indexed"));
});
