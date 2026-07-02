// Tests for the .mapping.json invariants that the skills promise to uphold
// (schema: templates/adr/mapping.schema.json). No JSON-schema lib is vendored,
// so we assert the load-bearing invariants directly — the same ones adr-sync
// step 6 ("dependsOn integrity") and feature-to-adr step 1 (acyclic) enforce.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TEMPLATES } from "./helpers.mjs";

const SCHEMA = JSON.parse(
  fs.readFileSync(path.join(TEMPLATES, "mapping.schema.json"), "utf8"),
);

// --- pure invariant checkers (mirror what the skills must guarantee) ---

const KEY_RE = /^[a-z0-9-]+(\/[a-z0-9-]+)?$/; // ≤2 kebab segments

function dependsOnDangling(mapping) {
  const keys = new Set(Object.keys(mapping.categories));
  const bad = [];
  for (const [k, e] of Object.entries(mapping.categories))
    for (const d of e.dependsOn || []) if (!keys.has(d)) bad.push(`${k}→${d}`);
  return bad;
}

function hasCycle(mapping) {
  const g = mapping.categories;
  const state = {}; // 0=unvisited,1=onstack,2=done
  let cyclic = false;
  const dfs = (n) => {
    if (!g[n]) return;
    state[n] = 1;
    for (const m of g[n].dependsOn || []) {
      if (state[m] === 1) cyclic = true;
      else if (!state[m]) dfs(m);
    }
    state[n] = 2;
  };
  for (const n of Object.keys(g)) if (!state[n]) dfs(n);
  return cyclic;
}

test("schema documents alpsFeatureId as the id home (key derives from name)", () => {
  const desc = SCHEMA.properties.categories.additionalProperties.properties.alpsFeatureId.description;
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
