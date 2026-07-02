// Tests for scripts/adr-invariants.sh — the PRD→ADR→code one-way oracle.
// Focus: the two reverse-reference checks and the A2 regression (canonical
// two-segment refs must be caught, not just flat one-segment ones).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { withTmp, write, initRepo, runInvariants, TEMPLATES } from "./helpers.mjs";

// A minimal but realistic canonical fixture: DDD context × feature folders,
// canonical NNNN-title.md filenames (no fN prefix), seeded rule docs.
function seedCanonicalRepo(dir) {
  initRepo(dir);
  // seeded rule docs legitimately mention ALPS — check (b) must not flag them
  for (const f of ["README.md", "structure.md", "authoring-rules.md"]) {
    fs.copyFileSync(path.join(TEMPLATES, f), write(dir, `docs/adr/${f}`, ""));
  }
  write(
    dir,
    "docs/adr/identity/login/0001-password-policy.md",
    "# 0001. 비밀번호 정책\n\n## Status\nAccepted (2026-07-02)\n\n## Decision\nbcrypt.\n",
  );
  write(
    dir,
    "docs/adr/infra/0001-deploy-topology.md",
    "# 0001. 배포\n\n## Status\nAccepted (2026-07-02)\n\n## Decision\n단일 리전.\n",
  );
  write(dir, "docs/adr/.mapping.json", JSON.stringify({ categories: {} }));
  write(dir, "src/features/login/index.ts", 'export const login = () => "ok";\n');
}

test("clean canonical repo passes all invariants (exit 0)", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    const { code, stdout } = runInvariants(dir);
    assert.equal(code, 0, stdout);
    assert.match(stdout, /invariants clean/);
  });
});

test("A2 regression: canonical TWO-segment code→ADR ref is caught", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    // This is the form the plugin emits today; the old regex missed it.
    fs.appendFileSync(
      path.join(dir, "src/features/login/index.ts"),
      "// see ADR identity/login/0001 for rationale\n",
    );
    const { code, stdout } = runInvariants(dir, ["--code-only"]);
    assert.equal(code, 1, "two-segment ref must be flagged");
    assert.match(stdout, /identity\/login\/0001/);
  });
});

test("flat ONE-segment code→ADR ref is still caught", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    fs.appendFileSync(
      path.join(dir, "src/features/login/index.ts"),
      'const r = "ADR infra/0001";\n',
    );
    const { code, stdout } = runInvariants(dir, ["--code-only"]);
    assert.equal(code, 1);
    assert.match(stdout, /infra\/0001/);
  });
});

test("ADR_REF token in code is caught", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    fs.appendFileSync(
      path.join(dir, "src/features/login/index.ts"),
      'const ADR_REF = "identity/login/0001";\n',
    );
    const { code } = runInvariants(dir, ["--code-only"]);
    assert.equal(code, 1);
  });
});

test("seeded rule docs' ALPS mentions do NOT trip check (b)", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    // (b) scopes to NNNN-*.md only, so README/structure ALPS text is exempt.
    const { code, stdout } = runInvariants(dir, ["--prd-only"]);
    assert.equal(code, 0, stdout);
  });
});

test("PRD reference inside an ADR body trips check (b)", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    fs.appendFileSync(
      path.join(dir, "docs/adr/identity/login/0001-password-policy.md"),
      "\n관련 PRD: prd/shop.alps.xml Section 6.3\n",
    );
    const { code, stdout } = runInvariants(dir, ["--prd-only"]);
    assert.equal(code, 1);
    assert.match(stdout, /alps\.xml|Section 6\.3/);
  });
});

test("ADR↔ADR Related links under docs/adr/ are NOT flagged as code refs", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    // A legit Related link from one ADR to another lives under docs/adr/ and
    // must be excluded by the post-filter, not reported as a code→ADR ref.
    fs.appendFileSync(
      path.join(dir, "docs/adr/infra/0001-deploy-topology.md"),
      "\n## Related\n- docs/adr/identity/login/0001-password-policy.md\n",
    );
    const { code, stdout } = runInvariants(dir, ["--code-only"]);
    assert.equal(code, 0, stdout);
  });
});

test("malformed --renumbered pair is a usage error (exit 2), not a violation", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    const { code } = runInvariants(dir, ["--renumbered", "bad-no-colon"]);
    assert.equal(code, 2);
  });
});
