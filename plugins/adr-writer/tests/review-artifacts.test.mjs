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
  return `# ADR implementation review

## Review mode
full

## Scope
stream settlement

## ADR contract coverage
| Requirement | Status |
| --- | --- |
| Settlement completes at most once | VIOLATED |

## Notable implementation choices
- 250 ms fixed retry — src/stream.mjs:8 — affects recovery latency

## Findings
### F1. Duplicate settlement
- Files and symbols to change: src/stream.mjs
- Scope not to touch: protocol
- Completion criteria: one record
- Needs confirmation: none

## Tests
node --test test/stream.test.mjs — FAIL

## Residual risks
None beyond F1.

## Repair guide
Fix F1 before merge.
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
        choice: "retry uses a 250 ms fixed delay",
        evidence: "src/stream.mjs:8 — retryDelayMs: 250",
        intentFit: "preserves the ADR's bounded recovery and failure guarantees",
        whyItMatters: "changes recovery latency and request rate",
      },
    ],
    contractCoverage: [
      {
        requirement: "Settlement completes at most once",
        status: "VIOLATED",
        adrBasis: "Requirement contract — Prohibitions",
        implementation: "the current settlement path can write twice",
        evidence: "src/stream.mjs:12 — duplicate writes reproduced",
        tests: "node --test test/stream.test.mjs — FAIL: expected 1, got 2",
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

## ADR contract coverage
| Requirement | Status |
| --- | --- |
| Existing parsing behavior remains unchanged | PROVEN |

## Notable implementation choices
None found.

## Findings
None

## Tests
node --test test/parser.test.mjs — PASS

## Residual risks
One isolated sufficiency pass; no protected surface changed.
`;
}

test("review artifact validator accepts a concise full report without Mermaid", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), "# explanation\n");
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(validFindings(dir), null, 2));

    const result = validate(dir);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("review artifact validator rejects missing core headings and evidence fields", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), "# explanation\n");
    writeFileSync(path.join(dir, "implementation-review.md"), "# short report\n");
    const findings = validFindings(dir);
    delete findings.findings[0].evidence;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /evidence must be a non-empty string/);
    assert.match(result.stderr, /missing: ## ADR contract coverage/);
    assert.doesNotMatch(result.stderr, /Mermaid|flowchart|sequenceDiagram/);
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

test("review artifact validator rejects incomplete notable implementation choices", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), "# explanation\n");
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    const findings = validFindings(dir);
    delete findings.implementationChoices[0].intentFit;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /implementationChoices\[0\]\.intentFit must be a non-empty string/);
  });
});

test("review artifact validator rejects missing coverage fields and non-proven PASS rows", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "implementation-review.md"), validStandardReport());
    const findings = validFindings(dir);
    findings.reviewMode = "standard";
    findings.verdict = "PASS";
    findings.findings = [];
    findings.implementationChoices = [];
    findings.metrics.sufficiencyFindingCount = 0;
    findings.contractCoverage[0].status = "UNVERIFIED";
    delete findings.contractCoverage[0].evidence;
    delete findings.explanation;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /contractCoverage\[0\]\.evidence must be a non-empty string/);
    assert.match(result.stderr, /PASS requires every contractCoverage row to be PROVEN/);
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
    findings.contractCoverage = [
      {
        requirement: "Existing parsing behavior remains unchanged",
        status: "PROVEN",
        adrBasis: "Decision",
        implementation: "the parser uses the same accepted inputs and outputs",
        evidence: "src/parser.mjs — behavior-preserving helper extraction",
        tests: "node --test test/parser.test.mjs — PASS",
      },
    ];
    findings.metrics.sufficiencyFindingCount = 0;
    delete findings.explanation;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("standard-mode artifacts reject necessity findings and missing contract coverage", () => {
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
    assert.match(result.stderr, /missing: ## ADR contract coverage/);
  });
});
