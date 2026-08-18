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
Section 7 Feature: 워크스페이스 멤버 관리

한 Feature 안에서 관리자는 이메일 초대, 역할 변경, 접근 회수, 감사 기록 내보내기를
수행한다. 각 행동은 별도로 시연할 수 있고 권한 규칙, 상태 전이, 오류 처리와 데이터
보존 조건이 서로 다르다. 이 Feature의 인지비용을 평가하고 승인 단계를 제시한다.
`;

export default {
  name: "alps-high-load-suggests-feature-split",
  description:
    "A Section 7 Feature scored seven or higher must receive up to three non-blocking split candidates based on independently demonstrable user behavior, with an option to keep the original.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("alps-init"),
      alpsGuideText(7),
      `\n---\n\n# This run`,
      SOURCE,
      `Do not call tools. Show the normal user-facing score and split suggestion.`,
      `In the tail include FEATURE_SCORE once, two or three SPLIT_CANDIDATE findings,`,
      `KEEP_ORIGINAL once, and NON_BLOCKING once.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const visible = output.split(/---\s*\n\s*## Machine-readable tail|===\s*EVAL-VERDICT/i)[0];
    const scoreText =
      tail.findings.find((finding) => /FEATURE_SCORE/i.test(finding.tag))?.summary ?? "";
    const score = Number(scoreText.match(/\b(10|[1-9])\s*\/\s*10\b/)?.[1]);
    const candidates = tail.findings.filter((finding) => /SPLIT_CANDIDATE/i.test(finding.tag));
    const candidateText = candidates.map((finding) => finding.summary).join("\n");
    return [
      {
        pass: Number.isInteger(score) && score >= 7 && score <= 10,
        detail: scoreText || "missing FEATURE_SCORE",
        label: "scores the multi-behavior Feature at seven or higher",
      },
      {
        pass: candidates.length >= 2 && candidates.length <= 3,
        detail: `${candidates.length} candidates: ${candidateText || "none"}`,
        label: "offers two or three split candidates",
      },
      expectText(
        candidateText,
        /초대|invite[\s\S]*(역할|role|접근|revoke|감사|audit)/is,
        "splits on independently demonstrable user behavior",
      ),
      expectNoText(
        candidateText,
        /frontend|backend|database|data layer|API layer|UI layer|프론트엔드|백엔드|데이터 계층/,
        "does not split by technical layer",
      ),
      expectText(
        visible,
        /원래 Feature|keep the original Feature|그대로 유지|원본 유지|원안 유지|분할하지 않고/i,
        "offers keeping the original Feature",
      ),
      expectText(
        tail.raw,
        /NON_BLOCKING[\s\S]{0,200}(승인|저장|approval|saving).{0,100}(차단하지|막지|continue|not block|전제 조건.{0,20}아님|필수.{0,20}아님)/i,
        "keeps approval and saving non-blocking",
      ),
      expectText(tail.raw, /KEEP_ORIGINAL/i, "records the keep-original option"),
    ];
  },
};
