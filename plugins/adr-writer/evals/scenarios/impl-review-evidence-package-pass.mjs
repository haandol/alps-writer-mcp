import {
  agentText,
  skillText,
  seedRuleDocs,
  seedMapping,
  TAIL_SPEC,
  expectNoText,
  validateReviewArtifact,
  write,
} from "../lib/harness.mjs";

const CASE = `
The approved ADR has one Decision and two independent requirement-contract obligations:

1. D0 Decision: Payment settlement uses an idempotent completion boundary and preserves
   the pending state on provider failure.
2. R1: A payment is completed at most once.
   Observable evidence: repeating the same settlement request leaves one completed payment.
3. R2: Provider failure never records payment completion.
   Observable evidence: a failed provider call leaves the payment pending.

The implementation review found:

- The Decision is supported by the guarded settlement flow and the two tests below.
- Obligation 1 is supported by an idempotency guard and a passing duplicate-settlement test.
- Obligation 2 is supported by provider failure injection and a passing test that leaves
  the payment pending.
- The ADR did not specify retry timing. The code chose a fixed 250 ms delay. This remains
  below ADR resolution, keeps retries bounded, preserves the failure result, and affects
  recovery latency and upstream request rate.
- There are no confirmed findings or unverified core risks.
`;

const ADR = `# ADR 0001: idempotent payment settlement

Date: 2026-08-17

## Status

Accepted (2026-08-17)

## Context

Payment settlement must remain consistent across duplicate requests and provider failure.

## Decision Drivers

- Duplicate requests must not create duplicate completion.
- Provider failure must preserve pending state.
- Review evidence must remain implementation-independent.

## Decision

Payment settlement uses an idempotent completion boundary and preserves the pending state on provider failure.

### Requirement contract

- A payment is completed at most once.
- Provider failure never records payment completion.

### Alternatives

- Guard settlement at the completion boundary.
- Reconcile duplicates after completion.

## Consequences

Settlement requires duplicate and provider-failure verification.

## Related

- 없음
`;

function taggedSummary(tail, tag) {
  return tail.findings.find((finding) => finding.tag === tag)?.summary ?? "";
}

function visibleOutput(output) {
  return output.split(/---\s*\n\s*## Machine-readable tail|===\s*EVAL-VERDICT/i)[0];
}

function coverageRows(visible) {
  return visible.split("\n").filter((line) => line.includes("|") && /\b(?:D0|R1|R2)\b/.test(line));
}

function completeTableRow(row) {
  return Boolean(row && row.split("|").filter((cell) => cell.trim()).length >= 7);
}

export default {
  name: "impl-review-evidence-package-pass",
  description:
    "/adr-impl-review must return PASS without another human gate when every obligation is PROVEN, while still surfacing complete read-only coverage and ADR-intent fit.",

  build(dir) {
    seedRuleDocs(dir);
    write(dir, "docs/adr/payments/settlement/0001-idempotent-payment-settlement.md", ADR);
    seedMapping(dir, {
      categories: {
        "payments/settlement": {
          feature: "Payment settlement",
          adrs: [
            {
              path: "docs/adr/payments/settlement/0001-idempotent-payment-settlement.md",
              status: "Accepted (2026-08-17)",
              summary:
                "Payment settlement is idempotent and preserves pending state on provider failure",
            },
          ],
          dependsOn: [],
        },
      },
    });
    return [
      skillText("adr-impl-review"),
      agentText("adr-impl-review-report-writer"),
      `\n---\n\n# This run`,
      `Produce the concise human-facing Evidence Package for this completed review.`,
      `The normal response must be the exact complete contents of implementation-review.md,`,
      `starting with "# ADR implementation review" and including every required core heading.`,
      `Do not put conversational prose before or instead of the report file contents.`,
      `Do not invent files or tests beyond the facts below. Show the normal response first.`,
      `The normal response must lead with contract coverage, then notable implementation`,
      `choices, then findings or residual risks. Coverage and choices are read-only.`,
      `Keep seven separate coverage columns: Contract ID, Requirement, Status, ADR basis,`,
      `How the implementation meets it, Evidence, Tests. Keep four choice columns: Selected behavior,`,
      `Evidence, Why it fits the ADR intent, Why it matters. Do not collapse either table.`,
      `In EVAL-FINDINGS use exactly these five tags and include every named field:`,
      `COVERAGE_D0 | status=...; implementation=...; evidence=...; tests=...`,
      `COVERAGE_R1 | status=...; implementation=...; evidence=...; tests=...`,
      `COVERAGE_R2 | status=...; implementation=...; evidence=...; tests=...`,
      `CHOICE | value=...; evidence=...; intentFit=...; impact=...`,
      `HUMAN_REVIEW | verdict=...; decisionRequired=...; noPerRowApproval=true`,
      CASE,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output, dir }) {
    const visible = visibleOutput(output);
    const d0 = taggedSummary(tail, "COVERAGE_D0");
    const r1 = taggedSummary(tail, "COVERAGE_R1");
    const r2 = taggedSummary(tail, "COVERAGE_R2");
    const choice = taggedSummary(tail, "CHOICE");
    const humanReview = taggedSummary(tail, "HUMAN_REVIEW");
    const [d0Row, r1Row, r2Row] = coverageRows(visible);
    const artifact = validateReviewArtifact(dir, visible, {
      reviewMode: "full",
      adr: "docs/adr/payments/settlement/0001-idempotent-payment-settlement.md",
      status: "Accepted (2026-08-17)",
      verdict: "PASS",
      metrics: {
        startedAt: "2026-08-17T00:00:00.000Z",
        completedAt: "2026-08-17T00:00:02.000Z",
        elapsedSeconds: 2,
        necessityFindingCount: 0,
        sufficiencyFindingCount: 0,
        unverifiedRiskCount: 0,
        testCommandCount: 2,
      },
      implementationChoices: [
        {
          choice: "retry uses a 250 ms fixed delay",
          evidence: "review evidence: fixed 250 ms delay",
          intentFit: "keeps retries bounded and preserves the failure result",
          whyItMatters: "changes recovery latency and upstream request rate",
        },
      ],
      contractCoverage: [
        {
          contractId: "D0",
          requirement: "Idempotent settlement and pending-on-failure decision",
          status: "PROVEN",
          adrBasis: "Decision",
          implementation: "guarded settlement flow preserves both outcomes",
          evidence: "guard and failure injection evidence",
          tests: "duplicate settlement and provider failure tests — PASS",
        },
        {
          contractId: "R1",
          requirement: "A payment is completed at most once",
          status: "PROVEN",
          adrBasis: "A payment is completed at most once.",
          implementation: "idempotency guard prevents duplicate completion",
          evidence: "repeated settlement leaves one completion",
          tests: "duplicate settlement test — PASS",
        },
        {
          contractId: "R2",
          requirement: "Provider failure never records payment completion",
          status: "PROVEN",
          adrBasis: "Provider failure never records payment completion.",
          implementation: "provider failure leaves payment pending",
          evidence: "failure injection preserves pending state",
          tests: "provider failure test — PASS",
        },
      ],
      findings: [],
    });

    return [
      {
        pass: tail.verdict === "PASS",
        detail: `verdict=${tail.verdict ?? "missing"}`,
        label: "returns PASS when every obligation is PROVEN",
      },
      {
        pass:
          /status\s*=\s*PROVEN/i.test(d0) &&
          /implementation\s*=\s*[^;]+/i.test(d0) &&
          /evidence\s*=\s*[^;]+/i.test(d0) &&
          /tests\s*=\s*[^;]*(?:PASS|통과)/i.test(d0) &&
          /status\s*=\s*PROVEN/i.test(r1) &&
          /implementation\s*=\s*[^;]+/i.test(r1) &&
          /evidence\s*=\s*[^;]+/i.test(r1) &&
          /tests\s*=\s*[^;]*(?:PASS|통과)/i.test(r1) &&
          /status\s*=\s*PROVEN/i.test(r2) &&
          /implementation\s*=\s*[^;]+/i.test(r2) &&
          /evidence\s*=\s*[^;]+/i.test(r2) &&
          /tests\s*=\s*[^;]*(?:PASS|통과)/i.test(r2),
        detail: `D0=${d0 || "missing"} ; R1=${r1 || "missing"} ; R2=${r2 || "missing"}`,
        label: "machine coverage records the Decision and both obligations as PROVEN",
      },
      {
        pass: completeTableRow(d0Row) && completeTableRow(r1Row) && completeTableRow(r2Row),
        detail: `D0=${d0Row ?? "missing"} ; R1=${r1Row ?? "missing"} ; R2=${r2Row ?? "missing"}`,
        label: "human-facing coverage gives every ADR-derived ID a complete table row",
      },
      {
        pass: artifact.pass,
        detail: artifact.detail,
        label: "generated report passes the shipped artifact validator and HTML renderer",
      },
      {
        pass:
          /250\s*ms/i.test(choice) &&
          /evidence\s*=\s*[^;]+/i.test(choice) &&
          /intentFit\s*=\s*[^;]*(?:bounded|failure|contract|ADR|보존|계약|실패)/i.test(choice) &&
          /impact\s*=\s*[^;]*(?:latency|request rate|지연|요청률)/i.test(choice),
        detail: choice || "missing CHOICE",
        label: "PASS package still explains material implementation discretion",
      },
      {
        pass:
          /verdict\s*=\s*PASS/i.test(humanReview) &&
          /decisionRequired\s*=\s*(?:false|none|no|없음|불필요)/i.test(humanReview) &&
          /noPerRowApproval\s*=\s*true/i.test(humanReview),
        detail: humanReview || "missing HUMAN_REVIEW",
        label: "PASS completes without another human decision or per-row approval",
      },
      expectNoText(
        visible,
        /approve (?:each|this (?:coverage|choice))[^.\n?]*\?|각 (?:행|선택)[^.\n?]*승인(?:해\s*주세요|하시겠습니까|\?)/i,
        "does not ask the user to approve each coverage row or implementation choice",
      ),
      expectNoText(
        visible,
        /\b(?:src|test|tests)\/[\w./-]+|[\w./-]+\.(?:ts|js|mjs):\d+/i,
        "does not invent code or test paths absent from the supplied evidence",
      ),
    ];
  },
};
