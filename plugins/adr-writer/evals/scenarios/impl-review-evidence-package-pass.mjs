import { skillText, seedRuleDocs, seedMapping, TAIL_SPEC, expectNoText } from "../lib/harness.mjs";

const CASE = `
The approved ADR has two independent obligations:

1. A payment is completed at most once.
   Observable evidence: repeating the same settlement request leaves one completed payment.
2. Provider failure never records payment completion.
   Observable evidence: a failed provider call leaves the payment pending.

The implementation review found:

- Obligation 1 is supported by an idempotency guard and a passing duplicate-settlement test.
- Obligation 2 is supported by provider failure injection and a passing test that leaves
  the payment pending.
- The ADR did not specify retry timing. The code chose a fixed 250 ms delay. This remains
  below ADR resolution, keeps retries bounded, preserves the failure result, and affects
  recovery latency and upstream request rate.
- There are no confirmed findings or unverified core risks.
`;

function taggedSummary(tail, tag) {
  return tail.findings.find((finding) => finding.tag === tag)?.summary ?? "";
}

function visibleOutput(output) {
  return output.split(/---\s*\n\s*## Machine-readable tail|===\s*EVAL-VERDICT/i)[0];
}

function coverageRows(visible) {
  return visible.split("\n").filter((line) => line.includes("|") && /\bPROVEN\b/i.test(line));
}

function completeTableRow(row) {
  return Boolean(row && row.split("|").filter((cell) => cell.trim()).length >= 5);
}

export default {
  name: "impl-review-evidence-package-pass",
  description:
    "/adr-impl-review must return PASS without another human gate when every obligation is PROVEN, while still surfacing complete read-only coverage and ADR-intent fit.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      skillText("adr-impl-review"),
      `\n---\n\n# This run`,
      `Produce the concise human-facing Evidence Package for this completed review.`,
      `Do not invent files or tests beyond the facts below. Show the normal response first.`,
      `The normal response must lead with contract coverage, then notable implementation`,
      `choices, then findings or residual risks. Coverage and choices are read-only.`,
      `Keep five separate coverage columns: Requirement, Status, How the implementation`,
      `meets it, Evidence, Tests. Keep four separate choice columns: Selected behavior,`,
      `Evidence, Why it fits the ADR intent, Why it matters. Do not collapse either table.`,
      `In EVAL-FINDINGS use exactly these four tags and include every named field:`,
      `COVERAGE_C1 | status=...; implementation=...; evidence=...; tests=...`,
      `COVERAGE_C2 | status=...; implementation=...; evidence=...; tests=...`,
      `CHOICE | value=...; evidence=...; intentFit=...; impact=...`,
      `HUMAN_REVIEW | verdict=...; decisionRequired=...; noPerRowApproval=true`,
      CASE,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const visible = visibleOutput(output);
    const c1 = taggedSummary(tail, "COVERAGE_C1");
    const c2 = taggedSummary(tail, "COVERAGE_C2");
    const choice = taggedSummary(tail, "CHOICE");
    const humanReview = taggedSummary(tail, "HUMAN_REVIEW");
    const [c1Row, c2Row] = coverageRows(visible);

    return [
      {
        pass: tail.verdict === "PASS",
        detail: `verdict=${tail.verdict ?? "missing"}`,
        label: "returns PASS when every obligation is PROVEN",
      },
      {
        pass:
          /status\s*=\s*PROVEN/i.test(c1) &&
          /implementation\s*=\s*[^;]+/i.test(c1) &&
          /evidence\s*=\s*[^;]+/i.test(c1) &&
          /tests\s*=\s*[^;]*(?:PASS|통과)/i.test(c1) &&
          /status\s*=\s*PROVEN/i.test(c2) &&
          /implementation\s*=\s*[^;]+/i.test(c2) &&
          /evidence\s*=\s*[^;]+/i.test(c2) &&
          /tests\s*=\s*[^;]*(?:PASS|통과)/i.test(c2),
        detail: `C1=${c1 || "missing"} ; C2=${c2 || "missing"}`,
        label: "machine coverage records both obligations as fully evidenced PROVEN rows",
      },
      {
        pass: completeTableRow(c1Row) && completeTableRow(c2Row),
        detail: `C1=${c1Row ?? "missing"} ; C2=${c2Row ?? "missing"}`,
        label: "human-facing coverage gives both obligations complete table rows",
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
