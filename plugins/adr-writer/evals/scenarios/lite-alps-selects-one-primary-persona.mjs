import {
  alpsLiteGuideText,
  alpsSkillText,
  expectNoText,
  expectText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const SOURCE = `
새 Lite PRD 작성을 시작한다. 현재 후보 사용자는 세 명이다.

- 프랜차이즈 소유자: 여러 매장의 매출과 재고를 판단한다.
- 매장 관리자: 근무 교대와 현장 업무를 조정한다.
- 고객: 메뉴를 탐색하고 주문한다.

아직 어느 페르소나가 이번 PoC의 핵심인지 결정하지 않았다. 정상적인 다음 대화 한 단계만
진행하라. 도구를 호출하거나 Section 내용을 저장하지 마라.
`;

export default {
  name: "lite-alps-selects-one-primary-persona",
  description:
    "Lite ALPS must anchor one concrete hypothetical case to exactly one Primary Persona when the user explicitly presents several unresolved candidates.",
  bugReport:
    "사용자가 여러 페르소나를 언급할 때만 한 명으로 정리하고, 해결하려는 구체적인 가정 사례를 물어봐야 한다.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("lite-alps-init"),
      alpsLiteGuideText(1),
      `\n---\n\n# This run`,
      SOURCE,
      `Ask the next focused question in Korean.`,
      `In the tail use CASE_ANCHOR, PERSONA_SELECTION, NO_SILENT_CHOICE, NO_COMPOSITE, and NO_SAVE_BEFORE_SELECTION once each.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const visible = output.split(/---\s*\n\s*## Machine-readable tail|===\s*EVAL-VERDICT/i)[0];
    return [
      expectText(
        visible,
        /(한 명|하나|1명).{0,100}(선택|정하|정해|결정|고르)|어느.{0,100}(한 명|페르소나|사용자).{0,100}(선택|정하|정해|결정|고르)|중.{0,100}(누구|어느)/is,
        "asks the user to choose one persona from the explicit candidates",
      ),
      expectText(
        visible,
        /(사례|상황).{0,160}(무엇을 하|하려).{0,160}(문제|어려움).{0,80}(가정|겪고 있)/is,
        "anchors the persona choice to one concrete hypothetical problem case",
      ),
      expectText(tail.raw, /CASE_ANCHOR/i, "records the concrete case anchor"),
      expectText(tail.raw, /PERSONA_SELECTION/i, "records the persona selection gate"),
      expectText(tail.raw, /NO_SILENT_CHOICE/i, "forbids silently choosing a persona"),
      expectText(tail.raw, /NO_COMPOSITE/i, "forbids a composite persona"),
      expectText(
        tail.raw,
        /NO_SAVE_BEFORE_SELECTION/i,
        "keeps Section 1 unsaved before persona selection",
      ),
      expectNoText(
        visible,
        /(Primary Persona|핵심 페르소나)\s*[:：]\s*(프랜차이즈 소유자|매장 관리자|고객)/i,
        "does not silently declare a selected persona",
      ),
    ];
  },
};
