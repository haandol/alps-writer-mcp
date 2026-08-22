import {
  alpsGuideText,
  alpsSkillText,
  expectNoText,
  expectText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const SOURCE = `
새 Full ALPS 문서의 프로젝트 이름은 "북클럽 읽기 목록"이다.

동네 북클럽 운영자는 추천 도서가 메신저 여러 대화에 흩어져 다음 모임의 책을 정하는 데
시간이 걸린다. 회원들이 후보 도서를 한곳에 추가하고, 운영자가 다음 모임의 책 한 권을
확정할 수 있는 간단한 웹 제품을 만들려 한다. 첫 MVP는 한 북클럽만 지원하면 충분하다.

위 정보만으로 Section 1 승인 초안을 작성하라. 도구를 호출하지 마라. 회수 가능한 정보를
다시 질문하지 말고, 사용자가 직접 말하지 않았지만 안전하게 일반화한 중요한 항목은
AI-inferred로 표시하라.
`;

export default {
  name: "alps-infers-before-asking",
  description:
    "Full ALPS must infer a complete safe Section draft from supplied context and ask no redundant question while exposing important inferred constants for approval.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("alps-init"),
      alpsGuideText(1),
      `\n---\n\n# This run`,
      SOURCE,
      `Produce the normal user-facing approval digest in Korean.`,
      `In the tail use INFERRED_DRAFT, AI_INFERRED, NO_REDUNDANT_QUESTION, and APPROVAL_REQUIRED once each.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const visible = output.split(/---\s*\n\s*## Machine-readable tail|===\s*EVAL-VERDICT/i)[0];
    return [
      expectText(visible, /북클럽 운영자/i, "infers the target user"),
      expectText(visible, /추천 도서.{0,100}(흩어|메신저)/is, "keeps the concrete problem"),
      expectText(visible, /후보 도서.{0,120}(한곳|추가)/is, "infers the solution strategy"),
      expectText(visible, /한 북클럽|단일 북클럽/i, "keeps the first-MVP scope"),
      expectText(visible, /AI-inferred/i, "labels important inferred constants"),
      expectText(tail.raw, /INFERRED_DRAFT/i, "records the inferred draft"),
      expectText(tail.raw, /AI_INFERRED/i, "records visible inference"),
      expectText(tail.raw, /NO_REDUNDANT_QUESTION/i, "does not re-ask recoverable facts"),
      expectText(tail.raw, /APPROVAL_REQUIRED/i, "keeps explicit approval"),
      expectNoText(
        visible,
        /누구인가요|무엇인가요|어떤 .*인가요|알려\s*주세요|\?/i,
        "asks no redundant question",
      ),
    ];
  },
};
