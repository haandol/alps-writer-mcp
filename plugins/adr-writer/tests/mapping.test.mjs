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
import { KEY_RE, dependsOnDangling, hasCycle, selfEdges } from "../scripts/adr-lint-lib.mjs";

const SCHEMA = JSON.parse(fs.readFileSync(path.join(TEMPLATES, "mapping.schema.json"), "utf8"));

test("schema documents alpsFeatureId as the id home (key derives from name)", () => {
  const desc =
    SCHEMA.properties.categories.additionalProperties.properties.alpsFeatureId.description;
  assert.match(desc, /category KEY is derived from the feature name/i);
});

test("schema category-id doc forbids Feature-ID-as-key (fallback only)", () => {
  const desc = SCHEMA.properties.categories.description;
  assert.match(desc, /derived from the feature NAME, never from a PRD Feature ID/);
  assert.match(desc, /fallback/i);
});

test("canonical example mapping satisfies key/dependsOn invariants", () => {
  const mapping = {
    categories: {
      identity: { feature: "Identity", subdomainType: "core", adrs: [] },
      "identity/login": {
        feature: "Login",
        alpsFeatureId: "F1",
        adrs: ["docs/adr/identity/login/0001-x.md"],
        dependsOn: [],
      },
      "ordering/checkout": {
        feature: "Checkout",
        alpsFeatureId: "F3",
        adrs: ["docs/adr/ordering/checkout/0001-x.md"],
        dependsOn: ["identity/login"],
      },
    },
  };
  for (const k of Object.keys(mapping.categories))
    assert.match(k, KEY_RE, `key "${k}" must be ≤2 kebab segments`);
  assert.deepEqual(dependsOnDangling(mapping), [], "no dangling dependsOn");
  assert.equal(hasCycle(mapping), false, "must be acyclic");
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
  // $schema + alpsDocument + categories are the only allowed top-level keys
  assert.ok(SCHEMA.properties.$schema, "$schema must be an allowed top-level key");
});

test("schema adrs allows empty (context grouping) and requires uniqueItems", () => {
  const adrs = SCHEMA.properties.categories.additionalProperties.properties.adrs;
  assert.equal(adrs.uniqueItems, true, "adrs must be uniqueItems");
  assert.equal("minItems" in adrs, false, "minItems removed — context entries may have adrs:[]");
  // adrs stays required (the key must be present, even if empty)
  assert.ok(
    SCHEMA.properties.categories.additionalProperties.required.includes("adrs"),
    "adrs stays required",
  );
});
