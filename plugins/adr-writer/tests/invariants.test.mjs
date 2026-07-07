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

// ── defect regressions (fixes verified against the reported findings) ─────

test("FIX inv-a-relpath-fn: a genuine code→ADR ref whose CONTENT contains a slash before docs/adr/ is NOT swallowed", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    // The old whole-line post-filter dropped this because the content matched
    // "(^|/)docs/adr/"; the path-anchored filter now keeps it (file is under src/).
    fs.appendFileSync(
      path.join(dir, "src/features/login/index.ts"),
      "// see ../docs/adr/identity/login/0001-password-policy.md for rationale\n",
    );
    const { code, stdout } = runInvariants(dir, ["--code-only"]);
    assert.equal(code, 1, "genuine ref must be flagged, not swallowed");
    assert.match(stdout, /index\.ts/);
  });
});

test("FIX inv-cd-substring-fp: removing auth/0002 does NOT false-positive on oauth/0002-token.md", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    write(
      dir,
      "docs/adr/oauth/0002-token.md",
      "# 0002. token\n\n## Status\nProposed\n\n## Related\n- [self](./0002-token.md)\n",
    );
    // 'auth/0002' is a suffix of 'oauth/0002' — must not match after the fix.
    const { code, stdout } = runInvariants(dir, ["--removed", "auth/0002"]);
    assert.equal(code, 0, stdout);
    assert.doesNotMatch(stdout, /oauth\/0002-token/);
  });
});

test("FIX inv-grep-error-silent-pass: a grep that errors (exit 2) fails CLOSED, not clean", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    // Stub grep that always errors. The script must surface exit 2, not report
    // "clean" (exit 0). PATH is prepended so the stub shadows the real grep.
    const stub = path.join(dir, "stub");
    fs.mkdirSync(stub, { recursive: true });
    fs.writeFileSync(path.join(stub, "grep"), "#!/usr/bin/env bash\nexit 2\n");
    fs.chmodSync(path.join(stub, "grep"), 0o755);
    const { code, stdout } = runInvariants(dir, ["--code-only"], {
      PATH: `${stub}:${process.env.PATH}`,
    });
    assert.equal(code, 2, "must fail closed on grep error");
    assert.match(stdout, /failing closed|grep failed/i);
  });
});

test("FIX inv-b-section-overmatch: a non-ALPS 'Section N.N' (RFC) in an ADR body does NOT trip check (b)", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    fs.appendFileSync(
      path.join(dir, "docs/adr/identity/login/0001-password-policy.md"),
      "\nPer HTTP RFC 7231 Section 6.5 the 4xx codes apply.\n",
    );
    const { code, stdout } = runInvariants(dir, ["--prd-only"]);
    assert.equal(code, 0, stdout);
  });
});

test("check (b) still catches an ALPS-qualified section citation", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    fs.appendFileSync(
      path.join(dir, "docs/adr/identity/login/0001-password-policy.md"),
      "\n관련 ALPS Section 7 참조\n",
    );
    const { code, stdout } = runInvariants(dir, ["--prd-only"]);
    assert.equal(code, 1);
    assert.match(stdout, /ALPS Section/);
  });
});

test("check (b) catches a feature-id (F-LOGIN-01) in an ADR body", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    fs.appendFileSync(
      path.join(dir, "docs/adr/identity/login/0001-password-policy.md"),
      "\nrelated feature F-LOGIN-01\n",
    );
    const { code, stdout } = runInvariants(dir, ["--prd-only"]);
    assert.equal(code, 1);
    assert.match(stdout, /F-LOGIN-01/);
  });
});

// ── rollup checks (c)/(d) happy paths ─────────────────────────────────────

test("check (c) --removed flags a kebab-title link to a removed ADR", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    fs.appendFileSync(
      path.join(dir, "docs/adr/infra/0001-deploy-topology.md"),
      "\n## Related\n- [old](./identity/login/0002-old.md)\n",
    );
    const { code, stdout } = runInvariants(dir, ["--removed", "identity/login/0002"]);
    assert.equal(code, 1);
    assert.match(stdout, /✗ \(c\)/);
    assert.match(stdout, /0002-old\.md/);
  });
});

test("check (d) --renumbered flags the old id and names the new number", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    fs.appendFileSync(
      path.join(dir, "docs/adr/infra/0001-deploy-topology.md"),
      "\n관련: ADR identity/login/0004\n",
    );
    const { code, stdout } = runInvariants(dir, [
      "--renumbered",
      "identity/login/0004:identity/login/0002",
    ]);
    assert.equal(code, 1);
    assert.match(stdout, /✗ \(d\)/);
    assert.match(stdout, /0002/); // repoints to the NEW number
  });
});

test("--removed/--renumbered disable checks (a)/(b) so unrelated tree hits aren't misattributed", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    // A genuine code→ADR ref exists (would make --code-only exit 1)…
    fs.appendFileSync(
      path.join(dir, "src/features/login/index.ts"),
      '\nconst r = "ADR infra/0001";\n',
    );
    assert.equal(runInvariants(dir, ["--code-only"]).code, 1, "sanity: (a) fires alone");
    // …but under --removed for an id nothing cites, (a) is disabled → exit 0.
    const { code } = runInvariants(dir, ["--removed", "identity/login/9999"]);
    assert.equal(code, 0, "(a) must be disabled under --removed");
  });
});

// ── env / arg-parse coverage ──────────────────────────────────────────────

test("custom --adr-dir with a trailing slash is honored and normalized", () => {
  withTmp((dir) => {
    initRepo(dir);
    for (const f of ["README.md", "structure.md", "authoring-rules.md"])
      fs.copyFileSync(path.join(TEMPLATES, f), write(dir, `architecture/${f}`, ""));
    write(dir, "architecture/identity/login/0001-x.md", "# 0001\n\n## Status\nProposed\n");
    write(dir, "src/x.ts", "// see ADR identity/login/0001 here\n");
    const { code, stdout } = runInvariants(dir, ["--adr-dir", "architecture/", "--code-only"]);
    assert.equal(code, 1, stdout); // trailing slash normalized, custom root honored
    assert.match(stdout, /identity\/login\/0001/);
  });
});

test("a code→ADR ref inside a src dir that shares the 'adr' basename is still scanned", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    // src/adr/ is NOT the ADR dir; its basename must not prune it from (a).
    write(dir, "src/adr/thing.ts", '\nconst x = "ADR infra/0001";\n');
    const { code, stdout } = runInvariants(dir, ["--code-only"]);
    assert.equal(code, 1);
    assert.match(stdout, /src\/adr\/thing\.ts/);
  });
});

test("empty --adr-dir value is a usage error (exit 2)", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    assert.equal(runInvariants(dir, ["--adr-dir", ""]).code, 2);
  });
});

test("unknown flag is a usage error (exit 2)", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    assert.equal(runInvariants(dir, ["--bogus"]).code, 2);
  });
});
