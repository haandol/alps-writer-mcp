// Tests for hooks/surface-adr-context.mjs — the per-turn ADR-first directive
// + mapping snapshot. Focus: canonical keys group by context, each ADR renders
// with its Status + one-line summary from the adrs[] index (no Feature-ID
// bracket — adr-writer is standalone), and the corruption/empty/missing
// branches behave.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTmp, write, runHook } from "./helpers.mjs";

const CANONICAL_MAPPING = {
  categories: {
    identity: { feature: "Identity & Access", subdomainType: "core", adrs: [] },
    "identity/login": {
      feature: "Login",
      adrs: [
        {
          path: "docs/adr/identity/login/0001-password-policy.md",
          status: "Proposed",
          summary: "bcrypt 최소 12자",
        },
      ],
      dependsOn: [],
    },
    "ordering/checkout": {
      feature: "Checkout",
      adrs: [
        {
          path: "docs/adr/ordering/checkout/0001-checkout-flow.md",
          status: "Accepted (2026-07-02)",
          summary: "체크아웃 흐름",
        },
      ],
      dependsOn: ["identity/login"],
    },
    infra: {
      feature: "Infra",
      subdomainType: "generic",
      adrs: [{ path: "docs/adr/infra/0001-deploy-topology.md", status: "Proposed" }],
      dependsOn: [],
    },
  },
};

// flatten all adr paths in the fixture for file-seeding
const ALL_ADR_PATHS = Object.values(CANONICAL_MAPPING.categories).flatMap((c) =>
  c.adrs.map((r) => r.path),
);

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
    for (const p of ALL_ADR_PATHS) write(dir, p, "# adr\n");
    const ctx = runHook(dir);
    assert.match(ctx, /▸ identity \(core\)/);
    assert.match(ctx, /▸ ordering/);
    assert.match(ctx, /▸ infra \(generic\)/);
    assert.match(ctx, /• identity\/login/);
  });
});

test("each ADR renders with its Status + summary; no Feature-ID bracket, no fN key", () => {
  withTmp((dir) => {
    write(dir, "docs/adr/.mapping.json", JSON.stringify(CANONICAL_MAPPING));
    for (const p of ALL_ADR_PATHS) write(dir, p, "# adr\n");
    const ctx = runHook(dir);
    // canonical key with the human feature name, no [F1]/[F3] tag
    assert.match(ctx, /• identity\/login — Login/);
    assert.match(ctx, /• ordering\/checkout — Checkout/);
    assert.doesNotMatch(ctx, /\[F\d/, "no Feature-ID bracket — adr-writer is standalone");
    // the ADR line carries the Status + one-line summary from the index
    assert.match(ctx, /0001-password-policy\.md — Proposed: bcrypt 최소 12자/);
    assert.match(ctx, /0001-checkout-flow\.md — Accepted \(2026-07-02\): 체크아웃 흐름/);
    // the key itself must not be a bare "f1"/"f3" folder
    assert.doesNotMatch(ctx, /• f1\b/);
    assert.doesNotMatch(ctx, /• f3\b/);
  });
});

test("dependsOn renders on the depending category", () => {
  withTmp((dir) => {
    write(dir, "docs/adr/.mapping.json", JSON.stringify(CANONICAL_MAPPING));
    for (const p of ALL_ADR_PATHS) write(dir, p, "# adr\n");
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

test("absolute ALPS_ADR_MAPPING is honored as-is (not joined onto CLAUDE_PROJECT_DIR)", () => {
  withTmp((dirA) => {
    withTmp((dirB) => {
      // dirA (the project dir) has NO mapping; dirB holds the real one at an
      // absolute path. The hook must read dirB's mapping, not emit '{}'.
      const abs = write(dirB, "custom-mapping.json", JSON.stringify(CANONICAL_MAPPING));
      const raw = runHook(dirA, { raw: true, env: { ALPS_ADR_MAPPING: abs } });
      const ctx = raw.hookSpecificOutput?.additionalContext ?? "";
      assert.match(ctx, /▸ identity \(core\)/, "absolute mapping path must be loaded");
    });
  });
});

test("subdomainType falls back to a feature sub-folder when no context-level entry declares it", () => {
  withTmp((dir) => {
    // Only 'identity/login' exists (no bare 'identity' entry), and it carries
    // subdomainType — the context heading should borrow it.
    write(
      dir,
      "docs/adr/.mapping.json",
      JSON.stringify({
        categories: {
          "identity/login": {
            feature: "Login",
            subdomainType: "core",
            adrs: [{ path: "docs/adr/identity/login/0001-x.md", status: "Proposed" }],
            dependsOn: [],
          },
        },
      }),
    );
    write(dir, "docs/adr/identity/login/0001-x.md", "# adr\n");
    const ctx = runHook(dir);
    assert.match(ctx, /▸ identity \(core\)/);
  });
});
