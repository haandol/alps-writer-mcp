// Tests for hooks/surface-adr-context.mjs — the per-turn ADR-first directive
// + mapping snapshot. Focus: canonical keys group by context, Feature IDs
// surface via alpsFeatureId (NOT the key), and the corruption/empty/missing
// branches behave.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTmp, write, runHook } from "./helpers.mjs";

const CANONICAL_MAPPING = {
  alpsDocument: "prd/shop.alps.xml",
  categories: {
    identity: { feature: "Identity & Access", subdomainType: "core", adrs: [] },
    "identity/login": {
      feature: "Login",
      alpsFeatureId: "F1",
      adrs: ["docs/adr/identity/login/0001-password-policy.md"],
      dependsOn: [],
    },
    "ordering/checkout": {
      feature: "Checkout",
      alpsFeatureId: "F3",
      adrs: ["docs/adr/ordering/checkout/0001-checkout-flow.md"],
      dependsOn: ["identity/login"],
    },
    infra: {
      feature: "Infra",
      subdomainType: "generic",
      adrs: ["docs/adr/infra/0001-deploy-topology.md"],
      dependsOn: [],
    },
  },
};

test("missing mapping file → hook stays quiet ({})", () => {
  withTmp((dir) => {
    const raw = runHook(dir, { raw: true });
    assert.deepEqual(raw, {});
  });
});

test("empty categories → renders the empty hint, not a crash", () => {
  withTmp((dir) => {
    write(dir, "docs/adr/.mapping.json", JSON.stringify({ categories: {} }));
    const ctx = runHook(dir);
    assert.match(ctx, /empty — no ADRs registered/);
  });
});

test("corrupt mapping JSON → surfaces a warning, not '(empty)'", () => {
  withTmp((dir) => {
    write(dir, "docs/adr/.mapping.json", "{ categories: { broken,,, ");
    const ctx = runHook(dir);
    assert.match(ctx, /JSON 파싱에 실패/);
    assert.doesNotMatch(ctx, /no ADRs registered/);
  });
});

test("canonical snapshot groups by bounded context (▸) with feature keys (•)", () => {
  withTmp((dir) => {
    write(dir, "docs/adr/.mapping.json", JSON.stringify(CANONICAL_MAPPING));
    // ADR files present so no [missing] marker appears
    for (const c of Object.values(CANONICAL_MAPPING.categories))
      for (const a of c.adrs) write(dir, a, "# adr\n");
    const ctx = runHook(dir);
    assert.match(ctx, /▸ identity \(core\)/);
    assert.match(ctx, /▸ ordering/);
    assert.match(ctx, /▸ infra \(generic\)/);
    assert.match(ctx, /• identity\/login/);
  });
});

test("Feature ID surfaces via alpsFeatureId, never as the category key", () => {
  withTmp((dir) => {
    write(dir, "docs/adr/.mapping.json", JSON.stringify(CANONICAL_MAPPING));
    for (const c of Object.values(CANONICAL_MAPPING.categories))
      for (const a of c.adrs) write(dir, a, "# adr\n");
    const ctx = runHook(dir);
    // canonical key present with the id shown as a bracketed tag
    assert.match(ctx, /• identity\/login \[F1\] — Login/);
    assert.match(ctx, /• ordering\/checkout \[F3\] — Checkout/);
    // the key itself must not be a bare "f1"/"f3" folder
    assert.doesNotMatch(ctx, /• f1\b/);
    assert.doesNotMatch(ctx, /• f3\b/);
  });
});

test("dependsOn renders on the depending category", () => {
  withTmp((dir) => {
    write(dir, "docs/adr/.mapping.json", JSON.stringify(CANONICAL_MAPPING));
    for (const c of Object.values(CANONICAL_MAPPING.categories))
      for (const a of c.adrs) write(dir, a, "# adr\n");
    const ctx = runHook(dir);
    assert.match(ctx, /depends on: identity\/login/);
  });
});

test("missing ADR file on disk is marked [missing]", () => {
  withTmp((dir) => {
    write(dir, "docs/adr/.mapping.json", JSON.stringify(CANONICAL_MAPPING));
    // deliberately do NOT create the adr files
    const ctx = runHook(dir);
    assert.match(ctx, /\[missing\]/);
  });
});

test("directive always carries the ADR-first cycle framing", () => {
  withTmp((dir) => {
    write(dir, "docs/adr/.mapping.json", JSON.stringify({ categories: {} }));
    const ctx = runHook(dir);
    assert.match(ctx, /\[ADR-first directive\]/);
  });
});
