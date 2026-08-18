import {
  alpsSkillText,
  seedRuleDocs,
  seedMapping,
  TAIL_SPEC,
  expectNoText,
  expectText,
} from "../lib/harness.mjs";

const BRIEF = `
F1: 워크스페이스 멤버 초대
- 관리자만 이메일 주소로 멤버를 초대할 수 있다.
- 같은 워크스페이스와 이메일에 활성 초대가 있으면 중복 초대를 거부한다.
- 초대는 7일 뒤 만료된다 (보안 정책).
- 이메일 전송은 SendGrid SDK로 구현할 계획이지만 같은 계약을 지키는 다른 클라이언트로 교체할 수 있다.

F2: 워크스페이스 내보내기
- 활성 워크스페이스 멤버만 내보내기를 요청할 수 있다.
- 완료된 export는 30일 뒤 삭제한다 (개인정보 정책).
- 장기 보관은 외부 ArchiveCo에 위임하고 장애 시 24시간 로컬 보관 후 재전송한다
  (법무 승인과 운영 복구 정책).
- F2의 권한 판정은 F1이 확립한 워크스페이스 membership 계약을 전제로 한다.
`;

function visibleOutput(output) {
  return output.split(/===\s*EVAL-VERDICT:/i)[0];
}

function featureBlock(output, ownPattern, nextPattern) {
  const lines = visibleOutput(output).split(/\r?\n/);
  const start = lines.findIndex((line) => ownPattern.test(line));
  if (start < 0) return "";
  const next = lines.findIndex((line, index) => index > start && nextPattern.test(line));
  return lines.slice(start, next < 0 ? lines.length : next).join("\n");
}

function labeledSections(block, headingPattern) {
  const lines = block.split(/\r?\n/);
  const sections = [];
  const headingText = (line) =>
    line
      .trim()
      .replace(/^#{1,6}\s*/, "")
      .replace(/\*\*/g, "")
      .replace(/\s*\([^)]*\)\s*$/, "")
      .replace(/:\s*$/, "")
      .trim();
  for (let start = 0; start < lines.length; start++) {
    if (!headingPattern.test(headingText(lines[start]))) continue;
    let end = start + 1;
    while (
      end < lines.length &&
      !/^(?:#{1,6}\s*)?(?:ADR-owned|Implementation discretion|Legacy planning context|Unresolved|ADR candidates?|Dependency result)\s*:?\s*$/i.test(
        headingText(lines[end]),
      ) &&
      !/^(?:Transfer coverage|Result)\s*:/i.test(lines[end].trim())
    ) {
      end++;
    }
    sections.push(
      lines
        .slice(start + 1, end)
        .join("\n")
        .trim(),
    );
  }
  return sections.filter(Boolean).join("\n");
}

function completeCoverage(block) {
  const match = block.match(/Transfer coverage:\s*(\d+)\s*\/\s*(\d+)/i);
  return {
    pass: Boolean(match) && Number(match[1]) === Number(match[2]),
    detail: match ? `Transfer coverage: ${match[1]}/${match[2]}` : "no numeric Transfer coverage",
  };
}

export default {
  name: "feature-handoff-ownership-transfer",
  description:
    "/feature-to-adr must show complete Feature-specific ADR-owned inventories, keep replaceable SDKs in code, separate durable decisions, and preserve required Feature prerequisites.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("feature-to-adr"),
      `\n---\n\n# This run`,
      `Analyze the following completed ALPS features. Do not write files; return only the`,
      `decision-discovery and dependency result that the skill would show before drafting.`,
      BRIEF,
      `Follow the skill's normal Feature result format, including ADR-owned,`,
      `Implementation discretion, Transfer coverage, and Result for each Feature.`,
      `Write each Feature's Transfer coverage on its own line as a numeric X/X ratio.`,
      `In the machine-readable tail use ADR_CANDIDATE and ADR_DEPENDENCY as tags.`,
      `Use ENRICHMENT_QUESTION only if this completed source actually leaves a`,
      `contract or durable decision unanswered.`,
      `Put each tag exactly to the left of the | separator.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const candidates = tail.findings.filter((finding) => /ADR_CANDIDATE/i.test(finding.tag));
    const dependencies = tail.findings.filter((finding) =>
      /ADR_DEPENDENCY|DEPENDS_ON/i.test(finding.tag),
    );
    const enrichmentQuestions = tail.findings.filter((finding) =>
      /ENRICHMENT_QUESTION/i.test(finding.tag),
    );
    const f1 = featureBlock(
      output,
      /(?:\bF1\b.*(?:초대|invite)|워크스페이스 멤버 초대)/i,
      /(?:\bF2\b.*(?:내보내기|export)|워크스페이스 내보내기)/i,
    );
    const f2 = featureBlock(output, /(?:\bF2\b.*(?:내보내기|export)|워크스페이스 내보내기)/i, /$a/);
    const f1Owned = labeledSections(f1, /^(?:#{1,6}\s*)?ADR-owned\s*:?\s*$/i);
    const f2Owned = labeledSections(f2, /^(?:#{1,6}\s*)?ADR-owned\s*:?\s*$/i);
    const f1Discretion = labeledSections(f1, /^(?:#{1,6}\s*)?Implementation discretion\s*:?\s*$/i);
    const f1Candidates = candidates.filter((finding) =>
      /F1|invite|invitation|초대|workspace[/-]member/i.test(finding.summary),
    );
    const f2Candidates = candidates.filter((finding) =>
      /F2|export|내보내기|workspace[/-]export/i.test(finding.summary),
    );
    const f1Evidence = [f1Owned, ...f1Candidates.map((finding) => finding.summary)].join("\n");
    const f2Evidence = [f2Owned, ...f2Candidates.map((finding) => finding.summary)].join("\n");
    const f1DiscretionEvidence = [
      f1Discretion,
      ...tail.findings
        .filter(
          (finding) =>
            /IMPLEMENTATION_DISCRETION/i.test(finding.tag) ||
            (/SendGrid|SDK|client|클라이언트/i.test(finding.summary) &&
              /재량|제외|replaceable|discretion/i.test(finding.summary)),
        )
        .map((finding) => finding.summary),
    ].join("\n");
    const f1Coverage = completeCoverage(f1);
    const f2Coverage = completeCoverage(f2);

    return [
      expectText(
        f1Evidence,
        /관리자|admin/i,
        "keeps F1 invitation permission in the ADR-owned inventory",
      ),
      expectText(
        f1Evidence,
        /중복|duplicate|활성.{0,80}(?:있|존재).{0,80}(?:거부|reject)|(?:거부|reject).{0,80}활성/is,
        "keeps F1 active-invitation uniqueness in the ADR-owned inventory",
      ),
      expectText(
        f1Evidence,
        /7\s*일|7 days/i,
        "keeps F1's 7-day expiry in the ADR-owned inventory",
      ),
      {
        pass: f1Candidates.length >= 1,
        detail: `F1 ADR candidates: ${f1Candidates.map((item) => item.summary).join(" ; ") || "none"}`,
        label: "maps the F1 ADR-owned inventory to a real ADR candidate",
      },
      {
        ...f1Coverage,
        label: "reports complete transfer coverage for F1",
      },
      {
        pass:
          /SendGrid|SDK|client|클라이언트/i.test(f1Discretion) ||
          /(?:SendGrid|SDK|client|클라이언트)[\s\S]{0,100}(?:재량|제외|replaceable|discretion)|(?:재량|제외|replaceable|discretion)[\s\S]{0,100}(?:SendGrid|SDK|client|클라이언트)/i.test(
            f1DiscretionEvidence,
          ),
        detail: f1DiscretionEvidence || "no implementation-discretion evidence",
        label: "keeps the replaceable SDK in Implementation discretion",
      },
      expectNoText(
        f1Owned,
        /SendGrid|SDK|client|클라이언트/i,
        "does not place the replaceable SDK in F1's ADR-owned inventory",
      ),
      {
        pass: enrichmentQuestions.length === 0,
        detail:
          enrichmentQuestions.map((item) => item.summary).join(" ; ") ||
          "no unnecessary enrichment question",
        label: "does not re-ask contracts already established by the completed PRD",
      },
      expectText(
        f2Evidence,
        /활성.{0,40}(멤버|member)|(?:멤버|member).{0,40}활성/is,
        "keeps F2 request permission in the ADR-owned inventory",
      ),
      expectText(
        f2Evidence,
        /30\s*일|30 days/i,
        "keeps F2's 30-day retention in the ADR-owned inventory",
      ),
      expectText(
        f2Evidence,
        /ArchiveCo[\s\S]{0,180}(24\s*시간|24 hours)|(24\s*시간|24 hours)[\s\S]{0,180}ArchiveCo/i,
        "keeps F2's archive boundary and 24-hour fallback in the ADR-owned inventory",
      ),
      {
        ...f2Coverage,
        label: "reports complete transfer coverage for F2",
      },
      {
        pass: f2Candidates.length >= 2,
        detail: `F2 ADR candidates: ${f2Candidates.map((item) => item.summary).join(" ; ") || "none"}`,
        label: "discovers separate F2 retention and archive ADR candidates",
      },
      expectText(
        dependencies.map((item) => item.summary).join("\n"),
        /(?:(F2|export|내보내기).{0,160}(F1|member|membership|멤버)|(F1|member|membership|멤버).{0,160}(F2|export|내보내기))/is,
        "preserves the required F2 to F1 contract dependency",
      ),
    ];
  },
};
