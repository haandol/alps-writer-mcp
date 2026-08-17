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
## 7. Implementation choices and assumptions
### C1. Retry delay
- Selected value or behavior: 250 ms fixed delay
## 8. Findings
### F1. Duplicate settlement
- Files and symbols to change: src/stream.mjs
- Scope not to touch: protocol
- Completion criteria: one record
- Needs confirmation: none
## 9. Fix execution order
## 10. Verification checklist
## 11. Merge decision checklist
| Axis | Verdict |
| --- | --- |
| Problem fitness | met |
| Functional adequacy | not met |
| Contract compliance | met |
| Change minimality | met |
| Verification strength | met |
| Operational safety | undetermined |
| Maintainability | met |
## 12. Review limits and questions
`;
}

function validFindings(dir) {
  return {
    reviewMode: "full",
    adr: "docs/adr/streaming/0001.md",
    verdict: "FIX_REQUIRED",
    explanation: path.join(dir, "explanation.md"),
    report: path.join(dir, "implementation-review.md"),
    metrics: {
      startedAt: "2026-08-15T06:30:00.000Z",
      completedAt: "2026-08-15T06:35:42.000Z",
      elapsedSeconds: 342,
      necessityFindingCount: 0,
      sufficiencyFindingCount: 1,
      unverifiedRiskCount: 0,
      testCommandCount: 1,
    },
    implementationChoices: [
      {
        kind: "implementation-default",
        topic: "retry delay",
        selectedValue: "250 ms fixed delay",
        basis: "matches the existing client retry policy",
        evidence: "src/stream.mjs:8 — retryDelayMs: 250",
        impactIfChanged: "changes recovery latency and request rate",
        confidence: "high",
        alternatives: "exponential backoff; no retry",
      },
    ],
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

function validStandardReport() {
  return `# ADR implementation review

## Review mode
standard — localized implementation reinforcement

## Scope
src/parser.mjs

## Decision ledger
- Existing parsing behavior remains unchanged: accounted for by parser tests

## Implementation choices and assumptions
None found.

## Findings
None

## Tests
node --test test/parser.test.mjs — PASS

## Review limits
One isolated sufficiency pass; no protected surface changed.
`;
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

test("review artifact validator requires internally consistent review metrics", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), "# explanation\n");
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    const findings = validFindings(dir);
    findings.metrics.unverifiedRiskCount = 1;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unverifiedRiskCount is 1, expected 0/);
  });
});

test("review artifact validator rejects incomplete implementation choices", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), "# explanation\n");
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    const findings = validFindings(dir);
    delete findings.implementationChoices[0].impactIfChanged;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /implementationChoices\[0\]\.impactIfChanged must be a non-empty string/,
    );
  });
});

test("review artifact validator accepts concise standard-mode artifacts without Mermaid or explanation", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "implementation-review.md"), validStandardReport());
    const findings = validFindings(dir);
    findings.reviewMode = "standard";
    findings.verdict = "PASS";
    findings.findings = [];
    findings.implementationChoices = [];
    findings.metrics.sufficiencyFindingCount = 0;
    delete findings.explanation;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("standard-mode artifacts reject necessity findings and missing ledger headings", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "implementation-review.md"), "# ADR implementation review\n");
    const findings = validFindings(dir);
    findings.reviewMode = "standard";
    findings.metrics.necessityFindingCount = 1;
    delete findings.explanation;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /necessityFindingCount must be 0/);
    assert.match(result.stderr, /missing: ## Decision ledger/);
  });
});
