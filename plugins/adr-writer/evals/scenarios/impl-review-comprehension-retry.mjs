import {
  skillText,
  seedRuleDocs,
  seedMapping,
  TAIL_SPEC,
  expectNoText,
  expectText,
} from "../lib/harness.mjs";

export default {
  name: "impl-review-comprehension-retry",
  description:
    "A wrong comprehension answer must keep the implementation PASS, explain the missing concept with evidence, retry the same question, and keep the PR not ready.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      skillText("adr-impl-review"),
      `\n---\n\n# This run`,
      `The implementation review verdict is PASS and every contract row is PROVEN.`,
      `There is one prepared comprehension question:`,
      `Q1: Why does provider failure leave the payment pending instead of completed?`,
      `Stored answer criteria: a successful provider result must cross the idempotent completion boundary before completion is recorded.`,
      `Stored evidence: ADR R2 and the provider-failure test.`,
      `The user answered: "Because the retry delay is 250 ms."`,
      `Respond as the interactive comprehension step after grading this answer.`,
      `Keep the implementation verdict unchanged. If the answer is wrong, say the PR is not comprehension-ready, explain the missing concept using the evidence, and retry Q1 rather than creating a new question.`,
      `In EVAL-FINDINGS include exactly:`,
      `QUIZ_RESULT | question=Q1; correct=false; prReady=false; retry=Q1; verdict=PASS`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const result = tail.findings.find((finding) => finding.tag === "QUIZ_RESULT")?.summary ?? "";
    return [
      {
        pass:
          /question\s*=\s*Q1/i.test(result) &&
          /correct\s*=\s*false/i.test(result) &&
          /prReady\s*=\s*false/i.test(result) &&
          /retry\s*=\s*Q1/i.test(result) &&
          /verdict\s*=\s*PASS/i.test(result),
        detail: result || "missing QUIZ_RESULT",
        label: "keeps PASS separate while retrying the failed comprehension question",
      },
      expectText(
        output,
        /PR.{0,40}(?:not|isn't|is not).{0,30}(?:ready|comprehension-ready)|(?:not|isn't|is not).{0,30}PR.{0,30}ready/is,
        "states that the PR is not comprehension-ready",
      ),
      expectText(
        output,
        /provider.{0,100}(?:success|result).{0,100}(?:completion boundary|record)|completion boundary.{0,100}provider/is,
        "explains the missing causal concept",
      ),
      expectText(output, /Q1[\s\S]*Why does provider failure/i, "retries Q1"),
      expectNoText(
        output,
        /change the ADR|reopen the decision|Status transition|approve the architecture/i,
        "does not reopen the implementation decision or lifecycle",
      ),
    ];
  },
};
