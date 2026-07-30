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
  return `# ADR implementation review and repair guide

## 1. Verdict summary
## 2. What to know first
## 3. Order to read the code
## 4. Map of the current implementation
\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`
## 5. Runtime flow
\`\`\`mermaid
sequenceDiagram
  A->>B: request
\`\`\`
## 6. State, data, and failure model
## 7. Findings
### F1. Duplicate settlement
- Files and symbols to change: src/stream.mjs
- Scope not to touch: protocol
- Completion criteria: one record
- Needs confirmation: none
## 8. Fix execution order
## 9. Verification checklist
## 10. Merge decision checklist
| Axis | Verdict |
| --- | --- |
| Problem fitness | met |
| Functional adequacy | not met |
| Contract compliance | met |
| Change minimality | met |
| Verification strength | met |
| Operational safety | undetermined |
| Maintainability | met |
## 11. Review limits and questions
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
// most likely to vanish is "Contract compliance" — a review that found no bug reads complete
// without ever checking whether the ADR's requirement values were honored.
test("review artifact validator rejects a merge-fitness table missing an axis", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), "# explanation\n");
    writeFileSync(
      path.join(dir, "implementation-review.md"),
      validReport().replace("| Contract compliance | met |\n", ""),
    );
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(validFindings(dir), null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing axis: Contract compliance/);
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
