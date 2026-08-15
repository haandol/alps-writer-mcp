import {
  alpsSkillText,
  seedRuleDocs,
  seedMapping,
  TAIL_SPEC,
  expectText,
} from "../lib/harness.mjs";

const BRIEF = `
F1: AI 호출 클라이언트 교체
- GPT-5.6 through Amazon Bedrock라는 provider/model 경계, fallback, 사용자 동작은 유지한다.
- AWS SDK v3와 default credential provider chain으로 구현만 교체한다.

F2: 워크스페이스 내보내기
- 완료된 export는 30일 뒤 삭제한다 (개인정보 정책).
- 장기 보관은 외부 ArchiveCo에 위임하고 장애 시 24시간 로컬 보관 후 재전송한다
  (법무 승인과 운영 복구 정책).
- F2 구현은 F1의 공통 요청 클라이언트를 재사용한다.
`;

export default {
  name: "feature-handoff-zero-or-many",
  description:
    "/feature-to-adr must produce zero ADRs for a replaceable SDK feature, several candidates for independent durable decisions, and no placeholder dependency.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("feature-to-adr"),
      `\n---\n\n# This run`,
      `Analyze the following completed ALPS features. Do not write files; return only the`,
      `decision-discovery and dependency result that the skill would show before drafting.`,
      BRIEF,
      `In the machine-readable tail use ZERO_ADR, ADR_CANDIDATE, and FEATURE_DEP_ONLY as tags.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const candidates = tail.findings.filter((finding) => /ADR_CANDIDATE/i.test(finding.tag));
    const f1Candidates = candidates.filter((finding) =>
      /\bF1\b|SDK|credential/i.test(finding.summary),
    );
    const placeholderDependencies = tail.findings.filter(
      (finding) =>
        /PLACEHOLDER|ADR_DEPENDENCY|DEPENDS_ON/i.test(finding.tag) &&
        /\bF1\b/i.test(finding.summary),
    );
    return [
      expectText(
        `${output}\n${tail.raw}`,
        /ZERO_ADR.{0,160}(F1|SDK|credential)/is,
        "classifies the SDK-only feature as zero ADRs",
      ),
      {
        pass: candidates.length >= 2,
        detail: `ADR candidates: ${candidates.map((item) => item.summary).join(" ; ") || "none"}`,
        label: "discovers multiple independent ADR candidates for F2",
      },
      expectText(
        candidates.map((item) => item.summary).join("\n"),
        /30\s*일|30 days/i,
        "keeps the 30-day retention contract as a candidate",
      ),
      expectText(
        candidates.map((item) => item.summary).join("\n"),
        /ArchiveCo|fallback|24\s*시간|24 hours/i,
        "keeps the archive provider and fallback as a separate candidate",
      ),
      expectText(
        `${output}\n${tail.raw}`,
        /FEATURE_DEP_ONLY.{0,180}(F1|implementation|구현)/is,
        "keeps the F1 dependency as implementation guidance",
      ),
      {
        pass: f1Candidates.length === 0 && placeholderDependencies.length === 0,
        detail:
          [...f1Candidates, ...placeholderDependencies]
            .map((finding) => `${finding.tag} | ${finding.summary}`)
            .join(" ; ") || "no F1 ADR candidate or placeholder dependency",
        label: "does not create a placeholder ADR dependency",
      },
    ];
  },
};
