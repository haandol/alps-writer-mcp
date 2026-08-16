import {
  skillText,
  ruleText,
  seedRuleDocs,
  seedMapping,
  write,
  TAIL_SPEC,
  expectFinding,
  expectNoFinding,
} from "../lib/harness.mjs";

const ADR = `# ADR 0001: 구현 검토

Date: 2026-08-16

## Status

Proposed

## Context

구현 완료 전에 계약 준수와 불필요한 변경을 검토한다.

## Decision Drivers

- 검토 가능한 경로는 계속 수행한다
- 지원하지 않는 provider 요청은 반복하지 않는다
- 독립 reviewer 없는 자동 리팩토링은 금지한다

## Decision

provider capability에 따라 독립 검토와 메인 세션 fallback을 선택한다.

### Alternatives

- 모든 provider에서 하위 agent를 시도한다
- provider capability에 따라 fallback한다

## Consequences

독립 컨텍스트가 없으면 제한을 보고하고 보수적으로 동작한다.
`;

export default {
  name: "bedrock-subagent-fallback",
  description:
    "Review skills must avoid subagent dispatch on Amazon Bedrock, never retry the known validation error, and preserve conservative main-session fallbacks.",
  bugReport:
    "Amazon Bedrock sessions frequently fail immediately after a review skill starts a subagent with Invalid 'input': value did not match any expected variant.",

  build(dir) {
    seedRuleDocs(dir);
    write(dir, "docs/adr/review/0001-provider-capability.md", ADR);
    seedMapping(dir, {
      categories: {
        review: {
          feature: "Implementation review",
          adrs: [
            {
              path: "docs/adr/review/0001-provider-capability.md",
              status: "Proposed",
              summary: "provider capability에 따라 독립 검토와 fallback을 선택한다",
            },
          ],
          dependsOn: [],
        },
      },
    });

    return [
      skillText("adr-review"),
      skillText("adr-impl-review"),
      skillText("adr-impl-refactor"),
      ruleText("concepts.md"),
      `\n---\n# This run`,
      `Repository: ${dir}`,
      `Client: Codex`,
      `Active model provider: Amazon Bedrock`,
      `No subagent has been dispatched yet.`,
      `When dispatched in this environment, the known failure is:`,
      `validation_error: Invalid 'input': value did not match any expected variant`,
      `Explain how all three review skills proceed and whether any named or generic subagent retry is allowed.`,
      `Do not edit files.`,
      `In the machine-readable tail, use these tags for the applicable conclusions:`,
      `NO_DISPATCH, NO_RETRY, MAIN_SESSION_FALLBACK, PROPOSE_ONLY.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail }) {
    return [
      expectFinding(tail, /NO_DISPATCH/i, "known Bedrock provider prevents subagent dispatch"),
      expectFinding(tail, /NO_RETRY/i, "known validation error is never retried"),
      expectFinding(
        tail,
        /MAIN_SESSION_FALLBACK/i,
        "document and implementation reviews continue in the main session",
      ),
      expectFinding(
        tail,
        /PROPOSE_ONLY/i,
        "refactor fallback never auto-applies without an isolated reviewer",
      ),
      expectNoFinding(tail, /RETRY_SUBAGENT|SPAWN_SUBAGENT/i, "no subagent retry is proposed"),
      expectNoFinding(tail, /APPLY_NOW/i, "Bedrock refactor fallback emits no APPLY_NOW item"),
    ];
  },
};
