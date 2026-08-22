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
새 Lite PRD 작성을 시작한다. 사용자는 "여행 준비를 도와주는 PoC를 만들고 싶다"고만 말했다.
누가 어떤 상황에서 무엇을 하려는지와 해결하려는 구체적인 문제는 아직 없다. 사용자는 여러
페르소나 후보를 제시하지 않았다. 정상적인 다음 대화 한 단계만 진행하라. 도구를 호출하거나
Section 내용을 저장하지 마라.
`;

export default {
  name: "lite-alps-starts-from-concrete-hypothetical-case",
  description:
    "Lite ALPS must ask for one concrete hypothetical problem case without requiring persona enumeration or a recent real experience.",
  bugReport:
    "페르소나부터 묻지 말고 누가 어떤 상황에서 무엇을 하려다 어떤 문제를 겪고 있다고 가정하는지 한 사례를 물어봐야 한다.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("lite-alps-init"),
      alpsLiteGuideText(1),
      `\n---\n\n# This run`,
      SOURCE,
      `Ask the next focused question in Korean.`,
      `In the tail use CONCRETE_HYPOTHETICAL_CASE, ASSUMED_PROBLEM, NO_RECENT_EXPERIENCE, and NO_PERSONA_ENUMERATION once each.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const visible = output.split(/---\s*\n\s*## Machine-readable tail|===\s*EVAL-VERDICT/i)[0];
    return [
      expectText(
        visible,
        /누가.{0,100}(어떤 상황|상황에서).{0,140}(무엇을 하|하려).{0,140}(어떤 문제|문제).{0,100}(겪고 있다고 가정|가정하)/is,
        "asks who is assumed to face what problem while trying to act in one situation",
      ),
      expectText(tail.raw, /CONCRETE_HYPOTHETICAL_CASE/i, "records one concrete hypothetical case"),
      expectText(tail.raw, /ASSUMED_PROBLEM/i, "records the problem as an assumption"),
      expectText(
        tail.raw,
        /NO_RECENT_EXPERIENCE/i,
        "does not require a recent or actual experience",
      ),
      expectText(
        tail.raw,
        /NO_PERSONA_ENUMERATION/i,
        "does not ask the user to enumerate persona candidates",
      ),
      expectNoText(
        visible,
        /최근.{0,60}(사례|경험)|실제로.{0,60}(겪|발생)|페르소나.{0,60}(후보|목록|여러 명)/is,
        "avoids recent-experience and persona-enumeration questions",
      ),
    ];
  },
};
