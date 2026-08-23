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
현재 Lite ALPS Sections 1-2가 승인되어 저장되었다.

Section 2.2 Required Acceptance Tests:

1. 표현별 연습 문제가 보인다
   - 시작 조건: 학습자가 연습 화면에 있다.
   - 사용자 행동: "break the ice"를 입력한다.
   - 통과 조건: "break the ice"에 관한 연습 문제가 보인다.
2. 연습 결과가 저장된다
   - 시작 조건: "break the ice" 연습 문제가 보인다.
   - 사용자 행동: 문제에 답한다.
   - 통과 조건: 결과가 보이고 "break the ice"가 저장된다.
3. 저장한 표현을 다시 찾을 수 있다
   - 시작 조건: "break the ice"가 저장되어 있다.
   - 사용자 행동: 표현 목록을 연다.
   - 통과 조건: 저장 목록에 "break the ice"가 보인다.

명시적 제외 범위는 없다. 정상적인 Section 4 다음 응답을 작성하라.
도구를 호출하거나 저장하지 마라.
`;

export default {
  name: "lite-alps-generates-demo-from-required-tests",
  description:
    "Lite ALPS must generate and show a complete Demo Scenario that covers every approved Required Acceptance Test without asking the user to restate the flow.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("lite-alps-init"),
      alpsLiteGuideText(2),
      alpsLiteGuideText(4),
      `\n---\n\n# This run`,
      SOURCE,
      `Respond naturally in Korean and show the complete generated scenario before approval.`,
      `In the tail use AUTO_GENERATED_DEMO, COVERS_ALL_REQUIRED_TESTS, SHOWS_FULL_SCENARIO, NO_RESTATEMENT_QUESTION, and OVERALL_PASS_REQUIRES_ALL once each.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const visible = output.split(/---\s*\n\s*## Machine-readable tail|===\s*EVAL-VERDICT/i)[0];
    return [
      expectText(visible, /표현별 연습 문제가 보인다/i, "covers the question-generation test"),
      expectText(visible, /연습 결과가 저장된다/i, "covers the save-result test"),
      expectText(visible, /저장한 표현을 다시 찾을 수 있다/i, "covers the later-retrieval test"),
      expectText(
        visible,
        /모든|전체.{0,30}(필수 인수 테스트|Required Acceptance Tests).{0,30}통과/i,
        "makes overall pass require every required test",
      ),
      expectText(visible, /승인|수정|보류/i, "shows the generated scenario for approval"),
      expectNoText(
        visible,
        /데모 흐름.{0,30}(알려|작성)|어떤.{0,20}(시작 상태|입력).{0,20}(정할|사용할|알려)/i,
        "does not ask the user to restate executable demo information",
      ),
      expectText(tail.raw, /AUTO_GENERATED_DEMO/i, "records automatic demo generation"),
      expectText(tail.raw, /COVERS_ALL_REQUIRED_TESTS/i, "records complete required-test coverage"),
      expectText(tail.raw, /SHOWS_FULL_SCENARIO/i, "records that the full scenario is shown"),
      expectText(
        tail.raw,
        /NO_RESTATEMENT_QUESTION/i,
        "records that no redundant flow question is asked",
      ),
      expectText(tail.raw, /OVERALL_PASS_REQUIRES_ALL/i, "records the all-tests overall pass rule"),
    ];
  },
};
