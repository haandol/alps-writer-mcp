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
Lite PRD의 Primary Persona는 "독립 카페 소유자"로 확정되었다.

제품의 핵심 의도는 소유자가 수요 변화를 빠르게 이해하고 재고 보충 결정을 내리도록 돕는
것이다. Section 2에 담을 핵심 ideal use case는 두 개다.

1. 영업 시작 전 재고 부족 품목을 확인하고 발주 결정을 완료한다.
2. 프로모션 종료 후 판매 변화를 비교하고 다음 주 재고 수량을 조정한다.

바리스타용 교대 관리, 네트워크 단절, 잘못된 재고 입력 복구는 이번 PoC의 핵심 흐름이
아니다. 위 정보를 바탕으로 Section 2 초안을 작성하라. 도구를 호출하지 마라.
`;

export default {
  name: "lite-alps-builds-intent-led-ideal-use-cases",
  description:
    "Lite ALPS must keep one confirmed persona and express each core ideal use case as intent, sequential user actions, and observable completion.",
  bugReport:
    "lite prd 는 페르소나 하나의 핵심 ideal 유즈케이스들에 집중 방식으로 대화를 이끌어 나가야한다.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("lite-alps-init"),
      alpsLiteGuideText(2),
      `\n---\n\n# This run`,
      SOURCE,
      `Draft the normal user-facing Section 2 content in Korean.`,
      `In the tail use PRIMARY_PERSONA once, IDEAL_USE_CASE twice, INTENT twice, USER_ACTION_SEQUENCE twice, COMPLETION_RESULT twice, and DEFERRED_SCOPE once.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const visible = output.split(/---\s*\n\s*## Machine-readable tail|===\s*EVAL-VERDICT/i)[0];
    const useCases = tail.findings.filter((finding) => /IDEAL_USE_CASE/i.test(finding.tag));
    const useCaseText = useCases.map((finding) => finding.summary).join("\n");
    const intents = tail.findings.filter((finding) => /^INTENT$/i.test(finding.tag));
    const actionSequences = tail.findings.filter((finding) =>
      /USER_ACTION_SEQUENCE/i.test(finding.tag),
    );
    const completionResults = tail.findings.filter((finding) =>
      /COMPLETION_RESULT/i.test(finding.tag),
    );

    return [
      expectText(
        `${visible}\n${tail.raw}`,
        /PRIMARY_PERSONA.{0,120}독립 카페 소유자|독립 카페 소유자.{0,120}Primary Persona/is,
        "keeps the confirmed Primary Persona",
      ),
      {
        pass: useCases.length === 2,
        detail: `${useCases.length} ideal use cases`,
        label: "keeps both approved core ideal use cases",
      },
      {
        pass: intents.length === 2,
        detail: `${intents.length} intent statements`,
        label: "states one explicit intent per use case",
      },
      {
        pass: actionSequences.length === 2,
        detail: `${actionSequences.length} user-action sequences`,
        label: "builds each use case from sequential user actions",
      },
      {
        pass: completionResults.length === 2,
        detail: `${completionResults.length} completion results`,
        label: "states one observable completion result per use case",
      },
      expectText(
        visible,
        /(재고 부족|부족 품목).{0,240}(확인|검토).{0,240}(발주|보충).{0,240}(결정|확정)/is,
        "shows sequential owner actions for the pre-opening use case",
      ),
      expectText(
        visible,
        /(프로모션|판매 변화).{0,240}(비교|검토).{0,240}(재고|수량).{0,240}(조정|결정|확정)/is,
        "shows sequential owner actions for the post-promotion use case",
      ),
      expectText(tail.raw, /DEFERRED_SCOPE/i, "defers non-core personas and edge cases"),
      expectNoText(
        useCaseText,
        /바리스타|교대|네트워크|단절|복구|재시도/is,
        "does not classify secondary personas or edge cases as core ideal use cases",
      ),
    ];
  },
};
