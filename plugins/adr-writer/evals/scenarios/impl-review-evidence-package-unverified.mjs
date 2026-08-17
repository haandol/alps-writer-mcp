import { skillText, seedRuleDocs, seedMapping, TAIL_SPEC, expectNoText } from "../lib/harness.mjs";

const CASE = `
The approved ADR has two independent obligations:

1. A payment is completed at most once.
   Observable evidence: repeating the same settlement request leaves one completed payment.
2. Provider failure never records payment completion.
   Observable evidence: a failed provider call leaves the payment pending.

The implementation review found:

- Obligation 1 is supported by an idempotency guard and a passing duplicate-settlement test.
- Obligation 2 could not be executed because provider failure injection is unavailable.
- The ADR did not specify retry timing. The code chose a fixed 250 ms delay. This remains
  below ADR resolution, keeps retries bounded, preserves the failure result, and affects
  recovery latency and upstream request rate.
- There are no confirmed code defects.
`;

function taggedSummary(tail, tag) {
  return tail.findings.find((finding) => finding.tag === tag)?.summary ?? "";
}

function visibleOutput(output) {
  return output.split(/---\s*\n\s*## Machine-readable tail|===\s*EVAL-VERDICT/i)[0];
}

function coverageRow(visible, status) {
  return visible
    .split("\n")
    .find((line) => line.includes("|") && new RegExp(`\\b${status}\\b`, "i").test(line));
}

function completeTableRow(row) {
  return Boolean(row && row.split("|").filter((cell) => cell.trim()).length >= 5);
}

function orderedSections(visible) {
  const lines = visible.split("\n");
  const coverageRows = [
    lines.findIndex((line) => line.includes("|") && /\bPROVEN\b/i.test(line)),
    lines.findIndex((line) => line.includes("|") && /\bUNVERIFIED\b/i.test(line)),
  ];
  const choiceRow = lines.findIndex((line) => line.includes("|") && /250\s*ms/i.test(line));
  const findingHeading = lines.findIndex((line) =>
    /^#{2,3}\s+(?:Findings|발견 사항|검토 결과|Residual risks|잔여 리스크|사람 판단)/i.test(line),
  );
  const lastCoverageRow = Math.max(...coverageRows);
  return (
    coverageRows.every((index) => index >= 0) &&
    choiceRow > lastCoverageRow &&
    (findingHeading < 0 || findingHeading > choiceRow)
  );
}

export default {
  name: "impl-review-evidence-package-unverified",
  description:
    "/adr-impl-review must return INCONCLUSIVE for a material UNVERIFIED obligation while presenting complete coverage and ADR-intent fit without per-row approval.",

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
      `HUMAN_REVIEW | verdict=...; exception=...; action=...; noPerRowApproval=true`,
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
    const c1Row = coverageRow(visible, "PROVEN");
    const c2Row = coverageRow(visible, "UNVERIFIED");

    return [
      {
        pass: tail.verdict === "INCONCLUSIVE",
        detail: `verdict=${tail.verdict ?? "missing"}`,
        label: "returns INCONCLUSIVE when a core obligation is UNVERIFIED",
      },
      {
        pass:
          /status\s*=\s*PROVEN/i.test(c1) &&
          /implementation\s*=\s*[^;]+/i.test(c1) &&
          /evidence\s*=\s*[^;]+/i.test(c1) &&
          /tests\s*=\s*[^;]*(?:PASS|통과)/i.test(c1),
        detail: c1 || "missing COVERAGE_C1",
        label: "machine coverage records C1 as PROVEN with implementation, evidence, and tests",
      },
      {
        pass:
          /status\s*=\s*UNVERIFIED/i.test(c2) &&
          /implementation\s*=\s*[^;]+/i.test(c2) &&
          /evidence\s*=\s*[^;]+/i.test(c2) &&
          /tests\s*=\s*[^;]*(?:NOT RUN|미실행|실행하지 못)/i.test(c2),
        detail: c2 || "missing COVERAGE_C2",
        label:
          "machine coverage records C2 as UNVERIFIED with implementation, evidence, and test limits",
      },
      {
        pass: completeTableRow(c1Row) && completeTableRow(c2Row),
        detail: `C1=${c1Row ?? "missing"} ; C2=${c2Row ?? "missing"}`,
        label: "human-facing coverage gives each obligation a complete table row",
      },
      {
        pass:
          /250\s*ms/i.test(choice) &&
          /evidence\s*=\s*[^;]+/i.test(choice) &&
          /intentFit\s*=\s*[^;]*(?:bounded|failure|contract|ADR|보존|계약|실패)/i.test(choice) &&
          /impact\s*=\s*[^;]*(?:latency|request rate|지연|요청률)/i.test(choice),
        detail: choice || "missing CHOICE",
        label: "material implementation discretion includes evidence, ADR-intent fit, and impact",
      },
      {
        pass:
          /verdict\s*=\s*INCONCLUSIVE/i.test(humanReview) &&
          /exception\s*=\s*[^;]*(?:UNVERIFIED|provider|프로바이더|failure|실패|미검증|의무\s*2|C2)/i.test(
            humanReview,
          ) &&
          /action\s*=\s*[^;]*(?:verify|inject|accept|검증|주입|수용)/i.test(humanReview) &&
          /noPerRowApproval\s*=\s*true/i.test(humanReview),
        detail: humanReview || "missing HUMAN_REVIEW",
        label: "human review focuses on the material verification exception, not every row",
      },
      {
        pass: orderedSections(visible),
        detail: "expected coverage, choices, then findings or residual risks",
        label: "human-facing package leads with coverage before choices and findings",
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
