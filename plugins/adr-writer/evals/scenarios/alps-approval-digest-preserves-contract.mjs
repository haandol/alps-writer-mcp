import {
  alpsGuideText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
  expectNoText,
  expectText,
} from "../lib/harness.mjs";

const SOURCE = `
Section 7 Feature: 팀 작업 세션

사용자는 팀 작업 세션을 만들고 승인된 결과를 보관한다.
- 한 세션은 최대 20턴이다 (요금 정책).
- 승인되지 않은 세션은 30일 뒤 삭제한다 (보관 비용 정책).
- 워크스페이스 owner만 결과를 외부로 내보낼 수 있다 (권한 정책).
- 상태는 draft, approved, archived이며 archived는 draft로 돌아갈 수 없다.
- Demo checkpoint: 승인 후 팀 대시보드에 결과가 표시된다.

구현 메모에는 PostgreSQL, Redis, 3회 재시도가 적혀 있지만 이는 요구사항이 아니다.
`;

export default {
  name: "alps-approval-digest-preserves-contract",
  description:
    "ALPS approval must show a concise raw-text digest while preserving every contract value, permission, state rule, and demo outcome and excluding implementation detail.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("alps-init"),
      alpsGuideText(7),
      `\n---\n\n# This run`,
      SOURCE,
      `Produce the user-facing approval digest only; do not call tools or print the full Feature.`,
      `Keep it readable as raw text and end with approve, revise, and defer choices.`,
      `In the tail use CONTRACT_ITEM for each preserved contract, RESPONSE_OPTIONS once,`,
      `NO_UNSEEN_CONTRACT once, and SEPARATE_SAVE_UNIT once.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const visible = output.split(/---\s*\n\s*## Machine-readable tail|===\s*EVAL-VERDICT/i)[0];
    const contracts = tail.findings
      .filter((finding) => /CONTRACT_ITEM/i.test(finding.tag))
      .map((finding) => finding.summary)
      .join("\n");
    return [
      expectText(visible, /20\s*턴|20\s*turns/i, "keeps the 20-turn requirement"),
      expectText(visible, /30\s*일|30\s*days/i, "keeps the 30-day retention rule"),
      expectText(
        visible,
        /owner.{0,50}(내보|export)|내보.{0,50}owner/is,
        "keeps export permission",
      ),
      expectText(
        visible,
        /draft.{0,100}approved.{0,100}archived|archived.{0,100}draft/is,
        "keeps the allowed states and forbidden transition",
      ),
      expectText(visible, /Demo checkpoint|팀 대시보드|team dashboard/i, "keeps the demo outcome"),
      expectText(
        visible,
        /승인|approve[\s\S]{0,120}수정|revise[\s\S]{0,120}보류|defer/i,
        "offers approve, revise, and defer",
      ),
      expectText(
        contracts,
        /20[\s\S]*30[\s\S]*(owner|내보)[\s\S]*(archived|draft)/is,
        "tail preserves every contract",
      ),
      expectText(
        tail.raw,
        /NO_UNSEEN_CONTRACT[\s\S]{0,200}(digest|다이제스트|요약|추가하지|absent|미노출|보이지|없는.{0,50}저장|저장.{0,50}없)/i,
        "forbids unseen saved requirements",
      ),
      expectText(tail.raw, /SEPARATE_SAVE_UNIT[\s\S]{0,120}7\.x/i, "keeps the Feature save unit"),
      expectNoText(
        visible,
        /PostgreSQL|Redis|3\s*회\s*재시도|retry.{0,20}3|\|[^|]+\|/,
        "omits implementation detail and Markdown tables",
      ),
    ];
  },
};
