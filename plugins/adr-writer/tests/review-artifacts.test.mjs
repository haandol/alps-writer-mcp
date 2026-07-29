import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VALIDATOR = path.join(HERE, "../scripts/adr-impl-review-validate.mjs");

function withArtifacts(run) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "adr-review-artifacts-"));
  try {
    mkdirSync(dir, { recursive: true });
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function validate(dir) {
  return spawnSync(process.execPath, [VALIDATOR, dir], { encoding: "utf8" });
}

function validReport() {
  return `# ADR 구현 리뷰 및 수정 가이드

## 1. 판정 요약
## 2. 먼저 알아야 할 목표
## 3. 코드를 읽는 순서
## 4. 현재 구현 지도
\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`
## 5. 런타임 흐름
\`\`\`mermaid
sequenceDiagram
  A->>B: request
\`\`\`
## 6. 상태·데이터·실패 모델
## 7. 발견 사항
### F1. Duplicate settlement
- 수정할 파일과 심볼: src/stream.mjs
- 건드리지 말아야 할 범위: protocol
- 완료 조건: one record
- 확인 필요: none
## 8. 수정 실행 순서
## 9. 검증 체크리스트
## 10. 머지 판정 체크리스트
| 축 | 판정 |
| --- | --- |
| 문제 적합성 | 충족 |
| 기능 충분성 | 미충족 |
| 계약 준수 | 충족 |
| 변경 최소성 | 충족 |
| 검증 강도 | 충족 |
| 운영 안전성 | 판정불가 |
| 유지보수성 | 충족 |
## 11. 리뷰 한계와 질문
`;
}

function validFindings(dir) {
  return {
    adr: "docs/adr/streaming/0001.md",
    verdict: "FIX_REQUIRED",
    explanation: path.join(dir, "explanation.md"),
    report: path.join(dir, "implementation-review.md"),
    findings: [
      {
        category: "Spec violation",
        perspective: "sufficiency",
        summary: "settlement can run twice",
        confidence: "high",
        code: "src/stream.mjs:12",
        evidence: "deterministic race reproduced two records",
        test: "node --test test/stream.test.mjs",
        testResult: "FAIL: expected 1, got 2",
      },
    ],
  };
}

test("review artifact validator accepts a self-contained junior repair guide", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), "# explanation\n");
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(validFindings(dir), null, 2));

    const result = validate(dir);
    assert.equal(result.status, 0, result.stderr);
  });
});

// A report can carry heading 10 and still omit an axis from the table. The axis
// most likely to vanish is 계약 준수 — a review that found no bug reads complete
// without ever checking whether the ADR's requirement values were honored.
test("review artifact validator rejects a merge-fitness table missing an axis", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), "# explanation\n");
    writeFileSync(
      path.join(dir, "implementation-review.md"),
      validReport().replace("| 계약 준수 | 충족 |\n", ""),
    );
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(validFindings(dir), null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing axis: 계약 준수/);
  });
});

test("review artifact validator rejects missing Mermaid and evidence fields", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), "# explanation\n");
    writeFileSync(path.join(dir, "implementation-review.md"), "# short report\n");
    const findings = validFindings(dir);
    delete findings.findings[0].evidence;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /evidence must be a non-empty string/);
    assert.match(result.stderr, /at least two Mermaid diagrams/);
  });
});
