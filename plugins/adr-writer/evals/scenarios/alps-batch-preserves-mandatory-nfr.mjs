import {
  alpsSkillText,
  alpsGuideText,
  seedRuleDocs,
  seedMapping,
  TAIL_SPEC,
  expectText,
} from "../lib/harness.mjs";

const SOURCE = `
사용자는 완성된 제품 브리프를 제공했고 Sections 1, 2, 3, 6, 7을 한 번에 검토하고 싶다고
명시했다. 네 가지 Must-Have NFR:
1. 결제 데이터는 저장하지 않는다 (보안).
2. GDPR 삭제 요청은 30일 이내 완료한다 (규제).
3. WCAG 2.2 AA를 충족한다 (접근성 계약).
4. 월말 정산 API는 99.9% 가용해야 한다 (고객 계약).
추가 선택 NFR은 검색 p95 2초와 동시 사용자 1,000명이다.
Section 7에는 F1 결제 조회와 F2 GDPR 삭제 두 기능이 완성된 형태로 들어 있다.
`;

export default {
  name: "alps-batch-preserves-mandatory-nfr",
  description:
    "/alps-init must allow explicit batch confirmation while keeping separate save units and preserving mandatory NFRs beyond the top-three focus set.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("alps-init"),
      alpsGuideText(6),
      alpsGuideText(7),
      `\n---\n\n# This run`,
      SOURCE,
      `Describe the confirmation and save plan. Do not call tools.`,
      `Use BATCH_ALLOWED, SEPARATE_SAVE_UNIT, FOCUS_SET, and MANDATORY_NFR tags in the tail.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const all = `${output}\n${tail.raw}`;
    const mandatory = tail.findings.filter((finding) => /MANDATORY_NFR/i.test(finding.tag));
    const mandatoryText = mandatory.map((item) => item.summary).join("\n");
    const mandatoryContracts = [
      /결제.{0,40}(저장하지|미저장|0건)|payment.{0,40}(not stored|no storage)/is,
      /GDPR.{0,40}30\s*일|GDPR.{0,40}30 days/is,
      /WCAG\s*2\.2\s*AA/is,
      /99\.9\s*%/is,
    ];
    return [
      expectText(all, /BATCH_ALLOWED/i, "allows the explicitly requested batch"),
      expectText(
        all,
        /SEPARATE_SAVE_UNIT.{0,180}(section|feature|7\.1|7\.2|각)/is,
        "keeps sections and features as separate save units",
      ),
      expectText(all, /FOCUS_SET.{0,120}(3|three|상위)/is, "uses top three as a focus set"),
      {
        pass: mandatoryContracts.every((pattern) => pattern.test(mandatoryText)),
        detail: `mandatory NFRs: ${mandatoryText || "none"}`,
        label: "preserves all four mandatory NFRs",
      },
      expectText(
        mandatoryText,
        /GDPR|30\s*일|WCAG|99\.9|결제 데이터/is,
        "names the mandatory security, regulatory, accessibility, and contract constraints",
      ),
    ];
  },
};
