// Tests for the ADR structure-lint harness — both the pure checkers in
// scripts/adr-lint-lib.mjs (unit) and the CLI scripts/adr-structure-lint.mjs
// end-to-end against fixture repos (integration). This is the deterministic
// self-test the user asked for: it proves each "ADR item well-formed?" rule
// fires on a bad fixture and passes a clean one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { withTmp, write, runStructureLint, parseLint } from "./helpers.mjs";
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
  numberingGaps,
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

test("classifyStatus coerces a non-string without throwing (forgotten-quotes status)", () => {
  // a hand-edited mapping can carry `"status": 2026` (number) or true (boolean);
  // classifyStatus must return a reason, never throw on .trim of a non-string
  assert.doesNotThrow(() => classifyStatus(2026));
  assert.equal(classifyStatus(2026).ok, false);
  assert.equal(classifyStatus(true).ok, false);
  assert.equal(classifyStatus(null).reason, "empty");
  assert.equal(classifyStatus(undefined).reason, "empty");
});

test("classifyStatus rejects extra text after the Accepted/Deprecated date (date-only)", () => {
  // the parentheses must hold ONLY the date — no reference / feature-id / note
  assert.equal(classifyStatus("Accepted (2026-07-09) — F1 구현").reason, "date-only");
  assert.equal(classifyStatus("Accepted (2026-07-09, ref)").reason, "date-only");
  assert.equal(classifyStatus("Accepted 2026-07-09").reason, "date-only");
  assert.equal(classifyStatus("Deprecated (2026-07-09) 사유 있음").reason, "date-only");
  // the clean date-only forms still pass
  assert.equal(classifyStatus("Accepted (2026-07-09)").ok, true);
  assert.equal(classifyStatus("Deprecated (2026-07-09)").ok, true);
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
        adrs: [{ path: "docs/adr/identity/login/0001-x.md", status: "Proposed", summary: "s" }],
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
  const rec = (p) => ({ path: p, status: "Proposed", summary: "s" });
  const m = {
    categories: {
      api: { adrs: [rec("docs/adr/api/0001-x.md")], dependson: ["x"] }, // typo'd field + anti-pattern key
      a: { adrs: [rec("docs/adr/api/0001-x.md")], dependsOn: ["a", "ghost"] }, // self-edge + dangling + double-index
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

// ── unit: numberingGaps (rollup advisory) ───────────────────────────────
test("numberingGaps returns empty for a contiguous-from-0001 category", () => {
  const gaps = numberingGaps({ auth: ["0001-a.md", "0002-b.md", "0003-c.md"] });
  assert.deepEqual(gaps, []);
});

test("numberingGaps flags a hole and reports present + missing numbers", () => {
  // 0002 deleted by a rollup, 0003 not yet renumbered → gap at 2.
  const gaps = numberingGaps({ auth: ["0001-a.md", "0003-c.md"] });
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].category, "auth");
  assert.deepEqual(gaps[0].present, [1, 3]);
  assert.deepEqual(gaps[0].missing, [2]);
});

test("numberingGaps flags a missing 0001 (sequence not starting at 1)", () => {
  const gaps = numberingGaps({ auth: ["0002-b.md", "0003-c.md"] });
  assert.deepEqual(gaps[0].missing, [1]);
});

test("numberingGaps is per-category and ignores non-canonical basenames", () => {
  const gaps = numberingGaps(
    new Map([
      ["auth", ["0001-a.md", "0004-d.md"]], // gap 2,3
      ["billing", ["0001-a.md", "0002-b.md"]], // clean
      ["misc", ["decision-log.md", "0001-a.md"]], // non-NNNN ignored → clean
    ]),
  );
  assert.deepEqual(
    gaps.map((g) => g.category),
    ["auth"],
  );
  assert.deepEqual(gaps[0].missing, [2, 3]);
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
            {
              path: "docs/adr/identity/login/0001-password-policy.md",
              status: "Accepted (2026-07-02)",
              summary: "bcrypt 최소 12자",
            },
            {
              path: "docs/adr/identity/login/0002-rate-limit.md",
              status: "Proposed",
              summary: "토큰 버킷 레이트 리밋",
            },
          ],
          dependsOn: [],
        },
      },
    }),
  );
  // .mapping.json is the single ADR index; the README carries no ADR list.
  write(dir, "docs/adr/README.md", `# ADR\n\nADR 인덱스는 .mapping.json 참조.\n`);
}

test("CLI: clean repo exits 0 with no errors", () => {
  withTmp((dir) => {
    seedClean(dir);
    const r = parseLint(dir);
    assert.equal(r.code, 0, JSON.stringify(r.errors));
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
    const r = parseLint(dir);
    assert.equal(r.code, 1);
    assert.ok(r.errors.some((e) => e.rule === "status-enum"));
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
    const r = parseLint(dir);
    assert.equal(r.code, 1);
    assert.ok(r.errors.some((e) => e.rule === "path-depth"));
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
              {
                path: "docs/adr/identity/login/0001-password-policy.md",
                status: "Accepted (2026-07-02)",
                summary: "bcrypt 최소 12자",
              },
              {
                path: "docs/adr/identity/login/0002-rate-limit.md",
                status: "Proposed",
                summary: "토큰 버킷",
              },
              {
                path: "docs/adr/identity/login/0099-ghost.md",
                status: "Proposed",
                summary: "존재하지 않는 ADR",
              },
            ],
            dependsOn: [],
          },
        },
      }),
    );
    const r = parseLint(dir);
    assert.equal(r.code, 1);
    assert.ok(r.errors.some((e) => e.rule === "mapping-dangling-adr"));
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
    const r = parseLint(dir);
    assert.equal(r.code, 1);
    assert.ok(r.errors.some((e) => e.rule === "index-orphan-mapping"));
  });
});

test("CLI: a decision-log.md in a category folder is invisible to the harness (not an ADR)", () => {
  // decision-log.md is a convention file, not an ADR: it is NOT registered in
  // .mapping.json and must not trip index-orphan-mapping, filename, or any
  // per-ADR check. findAdrFiles only enumerates ^NNNN-*.md, so the log — which
  // starts with 'd' — is never seen as an ADR. This locks in that guarantee.
  withTmp((dir) => {
    seedClean(dir);
    write(
      dir,
      "docs/adr/identity/login/decision-log.md",
      `# Decision Log: identity/login

이 문서는 identity/login 카테고리의 주요 결정 변경 이력이다.

## 2026-07-02 — 비밀번호 해시를 argon2 에서 bcrypt 로 교체

- **현재 ADR**: [password-policy](./0001-password-policy.md)
- **변경 유형**: 채택 대안 교체
- **무엇이**: argon2id → bcrypt(최소 12자)
- **왜**: 운영 표준 라이브러리 가용성
`,
    );
    // structural lint (no invariants): still clean — log is not enumerated.
    const r = parseLint(dir);
    assert.equal(r.code, 0, JSON.stringify(r.errors));
    assert.equal(r.ok, true);
    assert.deepEqual(r.errors, []);
    // full run (with adr-invariants.sh check (a)): the log's ADR link lives
    // under docs/adr/ so the (a) post-filter drops it — no code→ADR violation.
    const full = parseLint(dir, [], { full: true });
    assert.equal(full.code, 0, JSON.stringify(full.errors));
    assert.deepEqual(
      full.errors.filter((e) => e.rule === "invariants"),
      [],
    );
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

// ── integration: numbering-gap advisory (rollup renumber pending) ────────
// A minimal valid ADR body (no mapping → no orphan noise; Related empty so no
// broken-link error). Two of these with a hole between them = a gap.
const gapAdr = (n, title) =>
  `# ADR ${n}: ${title}\n\nDate: 2026-07-01\n\n## Status\nProposed\n\n## Context\nc\n\n## Decision Drivers\n- a\n- b\n- c\n\n## Decision\nd\n\n### 대안 검토\n- a\n- b\n\n## Consequences\nok\n\n## Related\n`;

test("CLI: a numbering gap is a WARNING, not an error (rollup renumber pending)", () => {
  withTmp((dir) => {
    // auth/0001 + auth/0003 — 0002 was deleted by a rollup, renumber not done.
    write(dir, "docs/adr/auth/0001-session-key.md", gapAdr("0001", "세션 키"));
    write(dir, "docs/adr/auth/0003-sso.md", gapAdr("0003", "SSO"));
    write(dir, "docs/adr/README.md", `# ADR\n`);
    const r = parseLint(dir);
    assert.equal(r.code, 0, "gap alone must not fail the lint");
    const gap = r.warnings.find((w) => w.rule === "numbering-gap");
    assert.ok(gap, "numbering-gap warning must be present");
    assert.match(gap.msg, /0002/, "names the missing number");
    assert.match(gap.msg, /renumber/, "points the LLM at rollup step 7");
  });
});

test("CLI: --warn-as-error escalates a numbering gap so a rollup can gate on it", () => {
  withTmp((dir) => {
    write(dir, "docs/adr/auth/0001-session-key.md", gapAdr("0001", "세션 키"));
    write(dir, "docs/adr/auth/0003-sso.md", gapAdr("0003", "SSO"));
    write(dir, "docs/adr/README.md", `# ADR\n`);
    const { code } = runStructureLint(dir, ["--no-invariants", "--warn-as-error"]);
    assert.equal(code, 1);
  });
});

test("CLI: a contiguous-from-0001 category emits no numbering-gap warning", () => {
  withTmp((dir) => {
    write(dir, "docs/adr/auth/0001-session-key.md", gapAdr("0001", "세션 키"));
    write(dir, "docs/adr/auth/0002-sso.md", gapAdr("0002", "SSO"));
    write(dir, "docs/adr/README.md", `# ADR\n`);
    const r = parseLint(dir);
    assert.equal(r.code, 0);
    assert.equal(r.warnings.filter((w) => w.rule === "numbering-gap").length, 0);
  });
});
