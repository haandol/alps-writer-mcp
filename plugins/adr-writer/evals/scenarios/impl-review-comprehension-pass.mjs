import {
  skillText,
  seedRuleDocs,
  seedMapping,
  TAIL_SPEC,
  expectNoText,
  expectText,
} from "../lib/harness.mjs";

export default {
  name: "impl-review-comprehension-pass",
  description:
    "The PR becomes comprehension-ready only after the final prepared question is answered with the required concept and causal relationship.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      skillText("adr-impl-review"),
      `\n---\n\n# This run`,
      `The implementation review verdict is PASS and every contract row is PROVEN.`,
      `Q1 is the only prepared comprehension question:`,
      `Why does provider failure leave the payment pending instead of completed?`,
      `Stored answer criteria: a successful provider result must cross the idempotent completion boundary before completion is recorded.`,
      `Stored evidence: ADR R2 and the provider-failure test.`,
      `The user answered: "Completion is written only after a successful provider result crosses the idempotent completion boundary, so a provider failure leaves the payment pending."`,
      `Respond as the interactive comprehension step after grading this final answer.`,
      `Keep the implementation verdict unchanged. Mark the PR comprehension-ready only if the answer contains the required concept and causal relationship.`,
      `In EVAL-FINDINGS include exactly:`,
      `QUIZ_RESULT | question=Q1; correct=true; prReady=true; verdict=PASS`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const result = tail.findings.find((finding) => finding.tag === "QUIZ_RESULT")?.summary ?? "";
    return [
      {
        pass:
          /question\s*=\s*Q1/i.test(result) &&
          /correct\s*=\s*true/i.test(result) &&
          /prReady\s*=\s*true/i.test(result) &&
          /verdict\s*=\s*PASS/i.test(result),
        detail: result || "missing QUIZ_RESULT",
        label: "marks the PR ready only after the final correct answer",
      },
      expectText(
        output,
        /PR.{0,40}(?:is\s+)?comprehension-ready|comprehension-ready.{0,40}PR/is,
        "states that the PR is comprehension-ready",
      ),
      expectText(
        output,
        /provider.{0,100}(?:success|result).{0,100}(?:completion boundary|record)|completion boundary.{0,100}provider/is,
        "confirms the causal concept that made the answer correct",
      ),
      expectNoText(
        output,
        /change the ADR|reopen the decision|Status transition|approve the architecture/i,
        "does not reopen the implementation decision or lifecycle",
      ),
    ];
  },
};
