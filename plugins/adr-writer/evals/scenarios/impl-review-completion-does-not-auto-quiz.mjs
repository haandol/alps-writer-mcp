import {
  skillText,
  seedRuleDocs,
  seedMapping,
  TAIL_SPEC,
  expectNoText,
  expectText,
} from "../lib/harness.mjs";

export default {
  name: "impl-review-completion-does-not-auto-quiz",
  description:
    "An ordinary implementation-review completion response returns the verdict, tests, and HTML path without printing Q1 or starting interactive grading.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      skillText("adr-impl-review"),
      `\n---\n\n# This run`,
      `The implementation review is complete: verdict PASS, every contract row is PROVEN, and all tests passed.`,
      `The validated HTML report is /tmp/review/adr-impl-review-report.html and contains this prepared question:`,
      `Q1: Why does provider failure leave the payment pending instead of completed?`,
      `The user did not request an interactive comprehension check.`,
      `Return the ordinary main-session completion response.`,
      `It must report the verdict, tests, and HTML path without printing any question, grading criterion, evidence, or answer request.`,
      `In EVAL-FINDINGS include exactly:`,
      `COMPLETION | autoQuiz=false; questionVisible=false; reportPath=true; verdict=PASS`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const completion = tail.findings.find((finding) => finding.tag === "COMPLETION")?.summary ?? "";
    return [
      {
        pass:
          /autoQuiz\s*=\s*false/i.test(completion) &&
          /questionVisible\s*=\s*false/i.test(completion) &&
          /reportPath\s*=\s*true/i.test(completion) &&
          /verdict\s*=\s*PASS/i.test(completion),
        detail: completion || "missing COMPLETION",
        label: "completes without automatically starting the comprehension quiz",
      },
      expectText(output, /PASS/i, "returns the implementation verdict"),
      expectText(output, /adr-impl-review-report\.html/i, "returns the HTML report path"),
      expectText(output, /test|테스트/i, "returns the test result"),
      expectNoText(
        output,
        /(?:^|\n)\s*(?:Q1|이해도 Q1)\b|Why does provider failure|answer this question|답변해|답해주세요/i,
        "does not expose or ask the prepared question",
      ),
      expectNoText(
        output,
        /answer criteria|grading evidence|채점 기준|stored evidence/i,
        "does not expose hidden grading data",
      ),
    ];
  },
};
