import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VALIDATOR = path.join(HERE, "../scripts/adr-impl-review-validate.mjs");
const FULL_AT_A_GLANCE = {
  impact: "Settlement can create two records for one request.",
  action: "Fix the completion boundary before merge.",
  risk: "No residual risk beyond the confirmed duplicate-settlement finding.",
};
const STANDARD_AT_A_GLANCE = {
  impact: "Existing parser inputs and outputs remain unchanged.",
  action: "None.",
  risk: "The review used the standard sufficiency perspective because no protected surface changed.",
};
const PR_GUIDANCE =
  "Do not open or send the PR until every comprehension question is answered correctly without reading the answer criteria.";

function validExplanation() {
  return `# Implementation explanation

## ADR intent
Settlement must turn a provider result into one durable completion record without charging twice.

## A duplicate request reaches the completion boundary
The boundary admits one successful result and returns the stored result for a retry.

## Provider failure leaves the payment pending
The handler records completion only after provider success, so failure never looks completed.
`;
}

function validComprehensionCheck() {
  return {
    prGuidance: PR_GUIDANCE,
    questions: [
      {
        id: "Q1",
        question: "Why must settlement record completion only once?",
        answerCriteria:
          "The idempotency boundary prevents duplicate requests from creating duplicate completion records.",
        evidence: "ADR R1; src/stream.mjs:4; duplicate settlement test",
      },
    ],
  };
}

function validParserComprehensionCheck() {
  return {
    prGuidance: PR_GUIDANCE,
    questions: [
      {
        id: "Q1",
        question: "Why does the helper extraction preserve parser compatibility?",
        answerCriteria:
          "The accepted inputs, validation order, and public output shape remain unchanged.",
        evidence: "ADR R1; src/parser.mjs; parser compatibility test",
      },
    ],
  };
}

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

function writeAdr(dir, requirement = "Settlement completes at most once") {
  const adr = path.join(dir, "docs/adr/streaming/0001.md");
  mkdirSync(path.dirname(adr), { recursive: true });
  writeFileSync(
    adr,
    `# ADR 0001: settlement

## Decision

Settlement uses an idempotent completion boundary.

### Requirement contract

- ${requirement}

### Alternatives

1. one
2. two

## Consequences

Current state.
`,
  );
  return adr;
}

function validReport() {
  return `# ADR implementation review

## At a glance
- Verdict: FIX_REQUIRED
- Impact: ${FULL_AT_A_GLANCE.impact}
- Action: ${FULL_AT_A_GLANCE.action}
- Risk: ${FULL_AT_A_GLANCE.risk}

## Review mode
full

## Scope
stream settlement

## ADR intent
Settlement must create one durable completion record and preserve pending state on provider failure.

## A duplicate request cannot create a second settlement
The completion boundary admits one result and rejects or reuses duplicate work.

## Provider failure does not cross the completion boundary
The handler records completion only after provider success.

## ADR contract coverage
| Contract ID | Requirement | Status | ADR basis | How the implementation meets it | Evidence | Tests |
| --- | --- | --- | --- | --- | --- | --- |
| D0 | Idempotent settlement boundary | PROVEN | Decision | Settlement has a single completion boundary | src/stream.mjs:4 | node --test test/stream.test.mjs — PASS |
| R1 | Settlement completes at most once | VIOLATED | Settlement completes at most once | The current settlement path can write twice | src/stream.mjs:12 | node --test test/stream.test.mjs — FAIL |

## Notable implementation choices
| Selected value or behavior | Code evidence | Why it fits the ADR intent | Why it matters |
| --- | --- | --- | --- |
| 250 ms fixed retry | src/stream.mjs:8 | Preserves bounded recovery | Affects recovery latency |

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

## Comprehension check
${PR_GUIDANCE}

1. Q1 — Why must settlement record completion only once?

## Repair guide
Fix F1 before merge.
`;
}

function validReportWithInlineCodeCells() {
  return validReport()
    .replace(
      "| D0 | Idempotent settlement boundary | PROVEN |",
      "| `D0` | Idempotent settlement boundary | `PROVEN` |",
    )
    .replace(
      "| R1 | Settlement completes at most once | VIOLATED |",
      "| `R1` | Settlement completes at most once | `VIOLATED` |",
    );
}

function validFindings(dir) {
  const adr = writeAdr(dir);
  return {
    reviewMode: "full",
    adr,
    verdict: "FIX_REQUIRED",
    atAGlance: { ...FULL_AT_A_GLANCE },
    explanation: path.join(dir, "explanation.md"),
    report: path.join(dir, "implementation-review.md"),
    scope: ["src/stream.mjs", "test/stream.test.mjs"],
    changeScope: ["src/stream.mjs"],
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
    comprehensionCheck: validComprehensionCheck(),
    contractCoverage: [
      {
        contractId: "D0",
        requirement: "Idempotent settlement boundary",
        status: "PROVEN",
        adrBasis: "Decision",
        implementation: "settlement has a single completion boundary",
        evidence: "src/stream.mjs:4 — completion boundary",
        tests: "node --test test/stream.test.mjs — PASS",
      },
      {
        contractId: "R1",
        requirement: "Settlement completes at most once",
        status: "VIOLATED",
        adrBasis: "Settlement completes at most once",
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

## At a glance
- Verdict: PASS
- Impact: ${STANDARD_AT_A_GLANCE.impact}
- Action: ${STANDARD_AT_A_GLANCE.action}
- Risk: ${STANDARD_AT_A_GLANCE.risk}

## Review mode
standard — localized implementation reinforcement

## Scope
src/parser.mjs

## ADR intent
The parser refactor must preserve every accepted input and public output.

## Existing callers see the same parser behavior
The helper extraction changes organization without changing validation or output.

## Invalid input still fails at the same boundary
Input validation remains ahead of output construction.

## ADR contract coverage
| Contract ID | Requirement | Status | ADR basis | How the implementation meets it | Evidence | Tests |
| --- | --- | --- | --- | --- | --- | --- |
| D0 | Parser compatibility | PROVEN | Decision | The parser preserves accepted inputs and outputs | src/parser.mjs | node --test test/parser.test.mjs — PASS |
| R1 | Existing parsing behavior remains unchanged | PROVEN | Existing parsing behavior remains unchanged | The parser preserves accepted inputs and outputs | src/parser.mjs | node --test test/parser.test.mjs — PASS |

## Notable implementation choices
None found.

## Findings
None

## Tests
node --test test/parser.test.mjs — PASS

## Residual risks
Standard sufficiency perspective only; no protected surface changed.

## Comprehension check
${PR_GUIDANCE}

1. Q1 — Why does the helper extraction preserve parser compatibility?
`;
}

test("review artifact validator accepts a concise full report without Mermaid", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(validFindings(dir), null, 2));

    const result = validate(dir);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("review artifact validator accepts inline-code contract IDs and statuses", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validReportWithInlineCodeCells());
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(validFindings(dir), null, 2));

    const result = validate(dir);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("review artifact validator rejects missing core headings and evidence fields", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
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
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
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
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    const findings = validFindings(dir);
    delete findings.implementationChoices[0].intentFit;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /implementationChoices\[0\]\.intentFit must be a non-empty string/);
  });
});

test("review artifact validator requires a complete At a glance handoff", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(
      path.join(dir, "implementation-review.md"),
      validReport().replace(`- Risk: ${FULL_AT_A_GLANCE.risk}\n`, ""),
    );
    const findings = validFindings(dir);
    delete findings.atAGlance.risk;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /atAGlance\.risk must be a non-empty string/);
  });
});

test("review artifact validator requires separate implementation and change scopes", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    const findings = validFindings(dir);
    delete findings.changeScope;
    findings.scope = [];
    findings.verdict = "PASS";
    findings.findings = [];
    findings.metrics.sufficiencyFindingCount = 0;
    findings.contractCoverage = findings.contractCoverage.map((row) => ({
      ...row,
      status: "PROVEN",
      tests: "node --test test/stream.test.mjs — PASS",
    }));
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /changeScope must be an array/);
    assert.match(result.stderr, /PASS requires a non-empty complete implementation scope/);
  });
});

test("review artifact validator rejects missing coverage fields and non-proven PASS rows", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validStandardReport());
    const findings = validFindings(dir);
    findings.reviewMode = "standard";
    findings.verdict = "PASS";
    findings.atAGlance = { ...STANDARD_AT_A_GLANCE };
    findings.comprehensionCheck = validParserComprehensionCheck();
    findings.findings = [];
    findings.implementationChoices = [];
    findings.metrics.sufficiencyFindingCount = 0;
    findings.contractCoverage[1].status = "UNVERIFIED";
    delete findings.contractCoverage[1].evidence;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /contractCoverage\[1\]\.evidence must be a non-empty string/);
    assert.match(result.stderr, /PASS requires every contractCoverage row to be PROVEN/);
  });
});

test("review artifact validator accepts concise standard-mode artifacts without Mermaid", () => {
  withArtifacts((dir) => {
    writeAdr(dir, "Existing parsing behavior remains unchanged");
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validStandardReport());
    const findings = validFindings(dir);
    writeAdr(dir, "Existing parsing behavior remains unchanged");
    findings.reviewMode = "standard";
    findings.verdict = "PASS";
    findings.atAGlance = { ...STANDARD_AT_A_GLANCE };
    findings.comprehensionCheck = validParserComprehensionCheck();
    findings.findings = [];
    findings.implementationChoices = [];
    findings.contractCoverage = [
      {
        contractId: "D0",
        requirement: "Parser compatibility",
        status: "PROVEN",
        adrBasis: "Decision",
        implementation: "the parser uses the same accepted inputs and outputs",
        evidence: "src/parser.mjs — behavior-preserving helper extraction",
        tests: "node --test test/parser.test.mjs — PASS",
      },
      {
        contractId: "R1",
        requirement: "Existing parsing behavior remains unchanged",
        status: "PROVEN",
        adrBasis: "Existing parsing behavior remains unchanged",
        implementation: "the parser uses the same accepted inputs and outputs",
        evidence: "src/parser.mjs — behavior-preserving helper extraction",
        tests: "node --test test/parser.test.mjs — PASS",
      },
    ];
    findings.metrics.sufficiencyFindingCount = 0;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("standard-mode artifacts reject necessity findings and missing contract coverage", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), "# ADR implementation review\n");
    const findings = validFindings(dir);
    findings.reviewMode = "standard";
    findings.atAGlance = { ...STANDARD_AT_A_GLANCE };
    findings.comprehensionCheck = validParserComprehensionCheck();
    findings.metrics.necessityFindingCount = 1;
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /necessityFindingCount must be 0/);
    assert.match(result.stderr, /missing: ## ADR contract coverage/);
  });
});

test("PASS rejects omitted ADR rows, duplicate IDs, unexecuted tests, and blocking findings", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "implementation-review.md"), validStandardReport());
    const findings = validFindings(dir);
    writeAdr(dir, "Existing parsing behavior remains unchanged");
    findings.reviewMode = "standard";
    findings.verdict = "PASS";
    findings.atAGlance = { ...STANDARD_AT_A_GLANCE };
    findings.comprehensionCheck = validParserComprehensionCheck();
    findings.contractCoverage = [
      {
        contractId: "D0",
        requirement: "Parser compatibility",
        status: "PROVEN",
        adrBasis: "Decision",
        implementation: "claimed compatible",
        evidence: "static inspection only",
        tests: "NOT RUN",
      },
      {
        contractId: "D0",
        requirement: "Duplicate decision row",
        status: "PROVEN",
        adrBasis: "Decision",
        implementation: "claimed compatible",
        evidence: "duplicate",
        tests: "NOT RUN",
      },
    ];
    findings.metrics.testCommandCount = 0;
    findings.metrics.sufficiencyFindingCount = 1;
    findings.findings = [
      {
        category: "Test gap",
        perspective: "sufficiency",
        summary: "parser behavior was not executed",
        confidence: "high",
        code: "src/parser.mjs",
        evidence: "no executed parser test",
        test: "node --test test/parser.test.mjs",
        testResult: "NOT RUN",
      },
    ];
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /duplicate contractId: D0/);
    assert.match(result.stderr, /missing ADR contract row: R1/);
    assert.match(result.stderr, /tests must not contain failed or unexecuted results/);
    assert.match(result.stderr, /at least one executed test/);
    assert.match(result.stderr, /unresolved blocking findings: 1/);
  });
});

test("human-facing report requires complete coverage and implementation-choice tables", () => {
  withArtifacts((dir) => {
    writeFileSync(
      path.join(dir, "implementation-review.md"),
      validReport()
        .replace(
          "| R1 | Settlement completes at most once | VIOLATED | Settlement completes at most once | The current settlement path can write twice | src/stream.mjs:12 | node --test test/stream.test.mjs — FAIL |",
          "| R1 | Settlement completes at most once | VIOLATED |",
        )
        .replace(
          "| 250 ms fixed retry | src/stream.mjs:8 | Preserves bounded recovery | Affects recovery latency |",
          "| 250 ms fixed retry | src/stream.mjs:8 |",
        ),
    );
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(validFindings(dir), null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /must have seven non-empty columns/);
    assert.match(result.stderr, /must have four non-empty columns/);
  });
});

test("review artifact validator enforces an intent-first subject-specific explanation", () => {
  withArtifacts((dir) => {
    writeFileSync(
      path.join(dir, "explanation.md"),
      validExplanation().replace("## ADR intent", "## Background"),
    );
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(validFindings(dir), null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /must start with ## ADR intent/);
  });

  withArtifacts((dir) => {
    writeFileSync(
      path.join(dir, "explanation.md"),
      "# Implementation explanation\n\n## ADR intent\nIntent only.\n",
    );
    writeFileSync(path.join(dir, "implementation-review.md"), validReport());
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(validFindings(dir), null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /subject-specific heading after ## ADR intent/);
  });
});

test("review artifact validator requires one to five hidden-answer comprehension questions", () => {
  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    const findings = validFindings(dir);
    findings.comprehensionCheck.questions = Array.from({ length: 6 }, (_, index) => ({
      id: `Q${index + 1}`,
      question: `Question ${index + 1}?`,
      answerCriteria: `Answer ${index + 1}`,
      evidence: `Evidence ${index + 1}`,
    }));
    writeFileSync(
      path.join(dir, "implementation-review.md"),
      validReport().replace(
        "1. Q1 — Why must settlement record completion only once?",
        `1. Q1 — Why must settlement record completion only once?\n\n${findings.comprehensionCheck.questions
          .slice(1)
          .map((question, index) => `${index + 2}. ${question.id} — ${question.question}`)
          .join("\n")}`,
      ),
    );
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /must contain 1 to 5 questions/);
  });

  withArtifacts((dir) => {
    writeFileSync(path.join(dir, "explanation.md"), validExplanation());
    const findings = validFindings(dir);
    writeFileSync(
      path.join(dir, "implementation-review.md"),
      validReport().replace(
        "1. Q1 — Why must settlement record completion only once?",
        `1. Q1 — Why must settlement record completion only once?\n\n${findings.comprehensionCheck.questions[0].answerCriteria}`,
      ),
    );
    writeFileSync(path.join(dir, "findings.json"), JSON.stringify(findings, null, 2));

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /exposes comprehensionCheck\.questions\[0\]\.answerCriteria/);
  });
});
