import {
  alpsGuideText,
  skillText,
  seedRuleDocs,
  seedMapping,
  TAIL_SPEC,
  expectNoText,
} from "../lib/harness.mjs";

const CASES = `
A. Feature: 사용자가 알림 설정 화면에서 주간 이메일 수신 여부를 켜거나 끈다.
   저장 성공과 실패 메시지만 있으며 외부 시스템, 상태 전이, 동시성은 없다.

B. ADR: 결제 요청을 idempotency key로 중복 방지하고, 승인/실패/취소 상태 전이를
   관리하며, 외부 결제사 timeout 시 fallback을 수행한다. webhook 중복·역순 도착,
   원장 기록의 transaction 일관성, 재시도와 부분 실패를 함께 검증해야 한다.
`;

function scoreValue(findings, tag) {
  const summary = findings.find((finding) => new RegExp(tag, "i").test(finding.tag))?.summary ?? "";
  const value = Number(summary.match(/\b(10|[1-9])\s*\/\s*10\b/)?.[1]);
  return { summary, value };
}

function visibleScore(lines, label) {
  const match = lines
    .map((line) =>
      line.match(
        new RegExp(
          `^${label}\\s*(?:—|-|:)?\\s*(?:인지비용|Comprehension load)\\s*:\\s*(10|[1-9])\\s*\\/\\s*10\\s*$`,
          "i",
        ),
      ),
    )
    .find(Boolean);
  return match ? Number(match[1]) : null;
}

export default {
  name: "comprehension-load-score-only",
  description:
    "Feature and ADR workflows must show only an advisory 1-10 comprehension-load score while keeping the five-axis calculation internal and non-blocking.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsGuideText(7),
      skillText("adr-new"),
      `\n---\n\n# This run`,
      `Estimate the comprehension load for A as an ALPS Feature and B as an ADR.`,
      `Return the normal user-facing result first. Follow the shipped score-only format:`,
      `one labeled score line for A and one for B, with no rationale, axis breakdown,`,
      `automatic split proposal, checkpoint, approval request, or blocking action.`,
      CASES,
      `In the machine-readable tail use FEATURE_SCORE and ADR_SCORE tags.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const feature = scoreValue(tail.findings, "FEATURE_SCORE");
    const adr = scoreValue(tail.findings, "ADR_SCORE");
    const visible = output.split(/---\s*\n\s*## Machine-readable tail|===\s*EVAL-VERDICT/i)[0];
    const visibleLines = visible
      .trim()
      .split(/\r?\n/)
      .filter((line) => line.trim());
    const visibleFeature = visibleScore(visibleLines, "A");
    const visibleAdr = visibleScore(visibleLines, "B");
    return [
      {
        pass: Number.isInteger(feature.value) && feature.value >= 1 && feature.value <= 5,
        detail: feature.summary || "missing FEATURE_SCORE",
        label: "scores the simple Feature in the lower half",
      },
      {
        pass: Number.isInteger(adr.value) && adr.value >= 7 && adr.value <= 10,
        detail: adr.summary || "missing ADR_SCORE",
        label: "scores the cross-boundary ADR as high load",
      },
      {
        pass: visibleLines.length === 2 && visibleFeature !== null && visibleAdr !== null,
        detail: `visible lines: ${visibleLines.join(" | ") || "none"}`,
        label: "shows only the exact two score lines",
      },
      {
        pass: visibleFeature !== null && visibleFeature === feature.value,
        detail: `visible A: ${visibleFeature ?? "missing"}; tail A: ${feature.value || "missing"}`,
        label: "matches the visible Feature score to the machine tail",
      },
      {
        pass: visibleAdr !== null && visibleAdr === adr.value,
        detail: `visible B: ${visibleAdr ?? "missing"}; tail B: ${adr.value || "missing"}`,
        label: "matches the visible ADR score to the machine tail",
      },
      expectNoText(
        visible,
        /conceptual breadth|contract density|state and flow complexity|boundary coupling|uncertainty and verification burden|개념 범위|계약 밀도|상태.흐름 복잡도|경계 결합도|불확실성.검증 부담/i,
        "keeps the five-axis calculation internal",
      ),
      expectNoText(
        visible,
        /must split|split required|mandatory checkpoint|approval required|blocked|Stacked PR|PR stack|차단|필수 분할|승인 필요|체크포인트/i,
        "does not turn the score into a process gate or delivery plan",
      ),
    ];
  },
};
