// Tests for the ADR structure-lint harness — both the pure checkers in
// scripts/adr-lint-lib.mjs (unit) and the CLI scripts/adr-structure-lint.mjs
// end-to-end against fixture repos (integration). This is the deterministic
// self-test the user asked for: it proves each "ADR item well-formed?" rule
// fires on a bad fixture and passes a clean one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTmp, write, runStructureLint } from "./helpers.mjs";
import {
  classifyStatus,
  checkFilename,
  categoryDepth,
  checkSections,
  countDrivers,
  countAlternatives,
  relatedLinkTargets,
  codeRefHits,
  validateMappingShape,
  checkCategoryKey,
} from "../scripts/adr-lint-lib.mjs";

// ── unit: classifyStatus ────────────────────────────────────────────────
test("classifyStatus accepts the four sanctioned forms", () => {
  assert.equal(classifyStatus("Proposed").ok, true);
  assert.equal(classifyStatus("Accepted (2026-07-02)").ok, true);
  assert.equal(classifyStatus("Deprecated (2026-07-02)").ok, true);
  assert.equal(classifyStatus("Superseded by [ADR 0007](./0007-x.md)").ok, true);
});

test("classifyStatus rejects informal / mis-dated statuses with a reason", () => {
  assert.equal(classifyStatus("Done").reason, "informal-status");
  assert.equal(classifyStatus("Implemented").reason, "informal-status");
  assert.equal(classifyStatus("Accepted").reason, "missing-date");
  assert.equal(classifyStatus("Proposed (2026-07-02)").reason, "proposed-should-not-carry-date");
  assert.equal(classifyStatus("Superseded").reason, "superseded-needs-adr-link");
  assert.equal(classifyStatus("").reason, "empty");
});

// ── unit: checkFilename ─────────────────────────────────────────────────
test("checkFilename accepts canonical NNNN-kebab and rejects fN-/uppercase", () => {
  assert.equal(checkFilename("0001-password-policy.md").ok, true);
  assert.equal(checkFilename("0001-f1-email-signup.md").reason, "stale-fN-prefix");
  assert.equal(checkFilename("0001-Password.md").reason, "uppercase");
  assert.equal(checkFilename("1-x.md").reason, "not-canonical");
});

// ── unit: categoryDepth ─────────────────────────────────────────────────
test("categoryDepth counts directory segments, capping the 2-segment rule", () => {
  assert.equal(categoryDepth("auth/0001-x.md"), 1);
  assert.equal(categoryDepth("identity/login/0001-x.md"), 2);
  assert.equal(categoryDepth("identity/login/social/0001-x.md"), 3); // violation
});

// ── unit: checkCategoryKey (R5a) ────────────────────────────────────────
test("checkCategoryKey flags anti-pattern segments and over-deep keys", () => {
  assert.deepEqual(checkCategoryKey("identity/login"), []);
  assert.ok(checkCategoryKey("api").some((i) => i.reason === "anti-pattern-segment"));
  assert.ok(checkCategoryKey("identity/api").some((i) => i.reason === "anti-pattern-segment"));
  assert.ok(checkCategoryKey("a/b/c").some((i) => i.reason === "too-deep"));
});

// ── unit: section / count parsers ───────────────────────────────────────
const GOOD_BODY = `# ADR 0001: x

## Status
Proposed

## Context
c

## Decision Drivers
- one
- two
- three

## Decision
d

### 대안 검토
- opt A
- opt B

## Consequences
ok

## Related
- [y](./0002-y.md)
`;

test("checkSections finds all hard sections + alternatives + drivers present", () => {
  const s = checkSections(GOOD_BODY);
  assert.deepEqual(s.missingHard, []);
  assert.equal(s.hasAlternatives, true);
  assert.equal(s.hasDrivers, true);
  assert.equal(s.hasRelated, true);
});

test("checkSections reports a missing hard section", () => {
  const noConseq = GOOD_BODY.replace(/## Consequences\nok\n/, "");
  assert.deepEqual(checkSections(noConseq).missingHard, ["Consequences"]);
});

test("countDrivers counts bullets under Decision Drivers", () => {
  assert.deepEqual(countDrivers(GOOD_BODY), { present: true, count: 3 });
});

test("countAlternatives counts bullet-form alternatives", () => {
  assert.deepEqual(countAlternatives(GOOD_BODY), { present: true, count: 2 });
});

test("countAlternatives counts table rows minus the header", () => {
  const body = `## Decision
d
### 대안 검토
| 옵션 | pros | cons |
| --- | --- | --- |
| A | p | c |
| B | p | c |
## Consequences
`;
  assert.deepEqual(countAlternatives(body), { present: true, count: 2 });
});

test("parsers ignore headings inside fenced code blocks", () => {
  const body = `## Status
Proposed
## Context
\`\`\`
## Decision
this is inside a fence, not a real heading
\`\`\`
## Consequences
`;
  // Decision is only inside the fence → reported missing
  assert.ok(checkSections(body).missingHard.includes("Decision"));
});

// ── unit: relatedLinkTargets ────────────────────────────────────────────
test("relatedLinkTargets returns local targets, skips URLs, strips anchors", () => {
  const body = `## Related
- [a](./0002-a.md)
- [ext](https://example.com)
- [b](../other/0003-b.md#section)
`;
  assert.deepEqual(relatedLinkTargets(body), ["./0002-a.md", "../other/0003-b.md"]);
});

// ── unit: codeRefHits (advisory R2) ─────────────────────────────────────
test("codeRefHits flags a source-file path but not a .md Related link", () => {
  assert.equal(codeRefHits("apps/web/src/Login.tsx 를 고친다").length, 1);
  assert.equal(codeRefHits("- [x](./0002-x.md)").length, 0);
  assert.equal(codeRefHits("services/auth/auth_service.go:42 참조").length, 1);
});

// ── unit: validateMappingShape ──────────────────────────────────────────
test("validateMappingShape passes a clean mapping", () => {
  const m = {
    categories: {
      "identity/login": {
        feature: "Login",
        adrs: ["docs/adr/identity/login/0001-x.md"],
        dependsOn: [],
      },
      identity: { feature: "Identity", subdomainType: "core", adrs: [] },
    },
  };
  assert.deepEqual(
    validateMappingShape(m).filter((i) => i.level === "error"),
    [],
  );
});

test("validateMappingShape flags dangling, self-edge, unknown field, double-index", () => {
  const m = {
    categories: {
      api: { adrs: ["docs/adr/api/0001-x.md"], dependson: ["x"] }, // typo'd field + anti-pattern key
      a: { adrs: ["docs/adr/api/0001-x.md"], dependsOn: ["a", "ghost"] }, // self-edge + dangling + double-index
    },
  };
  const codes = validateMappingShape(m).map((i) => i.code);
  assert.ok(codes.includes("key-anti-pattern-segment"));
  assert.ok(codes.includes("dependson-self-edge"));
  assert.ok(codes.includes("dependson-dangling"));
  assert.ok(codes.includes("dependson-cycle"));
  assert.ok(codes.includes("adr-double-indexed"));
  assert.ok(codes.includes("unknown-field")); // warn level
});

// ── integration: CLI end-to-end ─────────────────────────────────────────
// A reusable clean fixture. inScope/mapping/README all consistent.
function seedClean(dir) {
  write(
    dir,
    "docs/adr/identity/login/0001-password-policy.md",
    `# ADR 0001: 비밀번호 정책

Date: 2026-07-01

## Status
Accepted (2026-07-02)

## Context
가입 시 비밀번호 강도.

## Decision Drivers
- 크리덴셜 스터핑 방어
- 이탈률 5% 이내
- 보안 전문가 부재

## Decision
bcrypt, 최소 12자.

### 대안 검토
- bcrypt: 표준
- argon2: 최신

## Consequences
### Positive
- 강력

## Related
- [0002](./0002-rate-limit.md)
`,
  );
  write(
    dir,
    "docs/adr/identity/login/0002-rate-limit.md",
    `# ADR 0002: 레이트 리밋

Date: 2026-07-01

## Status
Proposed

## Context
무차별 대입 방어.

## Decision Drivers
- 초당 제한
- 정상 사용자 영향 최소
- 분산 고려

## Decision
토큰 버킷.

### 대안 검토
- 토큰 버킷
- 고정 윈도우

## Consequences
### Positive
- 방어력

## Related
- [0001](./0001-password-policy.md)
`,
  );
  write(
    dir,
    "docs/adr/.mapping.json",
    JSON.stringify({
      categories: {
        "identity/login": {
          feature: "Login",
          adrs: [
            "docs/adr/identity/login/0001-password-policy.md",
            "docs/adr/identity/login/0002-rate-limit.md",
          ],
          dependsOn: [],
        },
      },
    }),
  );
  write(
    dir,
    "docs/adr/README.md",
    `# ADR
## 카테고리별 ADR 목록
- [0001](./identity/login/0001-password-policy.md) — Accepted
- [0002](./identity/login/0002-rate-limit.md) — Proposed
`,
  );
}

test("CLI: clean repo exits 0 with no errors", () => {
  withTmp((dir) => {
    seedClean(dir);
    const { code, stdout } = runStructureLint(dir, ["--no-invariants"]);
    assert.equal(code, 0, stdout);
    const r = JSON.parse(stdout);
    assert.equal(r.ok, true);
    assert.deepEqual(r.errors, []);
  });
});

test("CLI: bad Status enum is a hard error", () => {
  withTmp((dir) => {
    seedClean(dir);
    write(
      dir,
      "docs/adr/identity/login/0001-password-policy.md",
      `# ADR 0001: x\n\nDate: 2026-07-01\n\n## Status\nDone\n\n## Context\nc\n\n## Decision\nd\n\n### 대안 검토\n- a\n- b\n\n## Consequences\nok\n\n## Related\n- [0002](./0002-rate-limit.md)\n`,
    );
    const { code, stdout } = runStructureLint(dir, ["--no-invariants"]);
    assert.equal(code, 1);
    assert.ok(JSON.parse(stdout).errors.some((e) => e.rule === "status-enum"));
  });
});

test("CLI: 3-segment nesting is flagged as path-depth error", () => {
  withTmp((dir) => {
    seedClean(dir);
    write(
      dir,
      "docs/adr/identity/login/social/0001-oauth.md",
      `# ADR 0001: x\n\n## Status\nProposed\n\n## Context\nc\n\n## Decision\nd\n\n### 대안 검토\n- a\n- b\n\n## Consequences\nok\n`,
    );
    const { code, stdout } = runStructureLint(dir, ["--no-invariants"]);
    assert.equal(code, 1);
    assert.ok(JSON.parse(stdout).errors.some((e) => e.rule === "path-depth"));
  });
});

test("CLI: mapping adrs path with no file on disk is flagged", () => {
  withTmp((dir) => {
    seedClean(dir);
    write(
      dir,
      "docs/adr/.mapping.json",
      JSON.stringify({
        categories: {
          "identity/login": {
            feature: "Login",
            adrs: [
              "docs/adr/identity/login/0001-password-policy.md",
              "docs/adr/identity/login/0002-rate-limit.md",
              "docs/adr/identity/login/0099-ghost.md",
            ],
            dependsOn: [],
          },
        },
      }),
    );
    const { code, stdout } = runStructureLint(dir, ["--no-invariants"]);
    assert.equal(code, 1);
    assert.ok(JSON.parse(stdout).errors.some((e) => e.rule === "mapping-dangling-adr"));
  });
});

test("CLI: an on-disk ADR absent from mapping is an index orphan", () => {
  withTmp((dir) => {
    seedClean(dir);
    write(
      dir,
      "docs/adr/identity/login/0003-lockout.md",
      `# ADR 0003: x\n\n## Status\nProposed\n\n## Context\nc\n\n## Decision\nd\n\n### 대안 검토\n- a\n- b\n\n## Consequences\nok\n`,
    );
    const { code, stdout } = runStructureLint(dir, ["--no-invariants"]);
    assert.equal(code, 1);
    assert.ok(JSON.parse(stdout).errors.some((e) => e.rule === "index-orphan-mapping"));
  });
});

test("CLI: no docs/adr dir → clean exit 0 (nothing to lint)", () => {
  withTmp((dir) => {
    const { code } = runStructureLint(dir, ["--no-invariants"]);
    assert.equal(code, 0);
  });
});

test("CLI: --warn-as-error turns a warning into a failure", () => {
  withTmp((dir) => {
    seedClean(dir);
    // add a file-level code ref → advisory warning
    write(
      dir,
      "docs/adr/identity/login/0001-password-policy.md",
      `# ADR 0001: x\n\nDate: 2026-07-01\n\n## Status\nAccepted (2026-07-02)\n\n## Context\napps/web/src/Login.tsx 를 고친다\n\n## Decision Drivers\n- a\n- b\n- c\n\n## Decision\nd\n\n### 대안 검토\n- a\n- b\n\n## Consequences\nok\n\n## Related\n- [0002](./0002-rate-limit.md)\n`,
    );
    const clean = runStructureLint(dir, ["--no-invariants"]);
    assert.equal(clean.code, 0, "warning alone does not fail");
    const strict = runStructureLint(dir, ["--no-invariants", "--warn-as-error"]);
    assert.equal(strict.code, 1, "--warn-as-error escalates the warning");
  });
});

test("CLI: usage error (unknown flag) exits 2", () => {
  withTmp((dir) => {
    seedClean(dir);
    const { code } = runStructureLint(dir, ["--bogus"]);
    assert.equal(code, 2);
  });
});
