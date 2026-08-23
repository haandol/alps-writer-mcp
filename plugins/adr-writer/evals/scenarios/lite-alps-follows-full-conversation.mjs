import {
  alpsLiteGuideText,
  alpsSkillText,
  expectText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const SOURCE = `
새 Lite PRD 작성을 시작한다.
사용자는 "여행 준비를 도와주는 PoC를 만들고 싶다"고만 말했다.
대상 사용자와 해결할 핵심 문제는 아직 설명하지 않았다.

Full ALPS와 같은 방식으로 정상적인 다음 대화 한 단계만 진행하라.
도구를 호출하거나 Section 내용을 저장하지 마라.
`;

export default {
  name: "lite-alps-follows-full-conversation",
  description:
    "Lite ALPS must use Full ALPS's focused-question conversation to fill missing Section context.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("lite-alps-init"),
      alpsLiteGuideText(1),
      `\n---\n\n# This run`,
      SOURCE,
      `Respond naturally in Korean.`,
      `In the tail use FOCUSED_QUESTION, MISSING_CONTEXT, and WAIT_FOR_ANSWER once each.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const visible = output.split(/---\s*\n\s*## Machine-readable tail|===\s*EVAL-VERDICT/i)[0];
    const questionCount = (visible.match(/\?/g) ?? []).length;

    return [
      expectText(visible, /사용자|누구|대상/i, "asks about the target user"),
      expectText(visible, /문제|어려움|불편/i, "asks about the core problem"),
      {
        pass: questionCount >= 1 && questionCount <= 2,
        detail: `${questionCount} visible questions`,
        label: "asks one or at most two focused questions",
      },
      expectText(tail.raw, /FOCUSED_QUESTION/i, "records a focused question"),
      expectText(tail.raw, /MISSING_CONTEXT/i, "records the missing context"),
      expectText(tail.raw, /WAIT_FOR_ANSWER/i, "waits for the user's answer before saving"),
    ];
  },
};
