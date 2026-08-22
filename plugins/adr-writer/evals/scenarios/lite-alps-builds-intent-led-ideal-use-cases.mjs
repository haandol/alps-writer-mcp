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

제품의 핵심 의도는 소유자가 영업 시작 전 재고 부족 품목을 이해하고 발주 결정을 내리도록
돕는 것이다. 첫 PoC의 Core User Flow는 재고 현황 열기 → 부족 품목 확인 → 보충 품목과 수량 선택
→ 발주 결정 확정이다.

프로모션 비교, 바리스타 교대 관리, 네트워크 단절, 잘못된 재고 입력 복구는 첫 Core User Flow에
필요하지 않다. 위 정보를 바탕으로 Section 2 초안을 작성하라. 도구를 호출하지 마라.
`;

export default {
  name: "lite-alps-builds-intent-led-ideal-use-cases",
  description:
    "Lite ALPS must keep one confirmed persona and default to one minimum Core User Flow with sequential user actions and observable completion.",
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
      `In the tail use PRIMARY_PERSONA, CORE_FLOW, USER_ACTION_SEQUENCE, COMPLETION_RESULT, and DEFERRED_SCOPE once each.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const visible = output.split(/---\s*\n\s*## Machine-readable tail|===\s*EVAL-VERDICT/i)[0];
    const coreFlows = tail.findings.filter((finding) => /CORE_FLOW/i.test(finding.tag));
    const coreFlowText = coreFlows.map((finding) => finding.summary).join("\n");
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
        pass: coreFlows.length === 1,
        detail: `${coreFlows.length} core flows`,
        label: "keeps one minimum Core User Flow",
      },
      {
        pass: actionSequences.length === 1,
        detail: `${actionSequences.length} user-action sequences`,
        label: "builds the Core User Flow from sequential user actions",
      },
      {
        pass: completionResults.length === 1,
        detail: `${completionResults.length} completion results`,
        label: "states one observable completion result",
      },
      expectText(
        visible,
        /(재고 부족|부족 품목).{0,240}(확인|검토).{0,240}(발주|보충).{0,240}(결정|확정)/is,
        "shows sequential owner actions for the pre-opening use case",
      ),
      expectText(tail.raw, /DEFERRED_SCOPE/i, "defers non-core personas and edge cases"),
      expectNoText(
        coreFlowText,
        /프로모션|바리스타|교대|네트워크|단절|복구|재시도/is,
        "keeps later flows and edge cases outside the Core User Flow",
      ),
    ];
  },
};
