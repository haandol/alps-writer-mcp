import {
  skillText,
  seedRuleDocs,
  seedMapping,
  write,
  read,
  TAIL_SPEC,
  expectText,
  expectNoText,
} from "../lib/harness.mjs";

const ADR_PATH = "docs/adr/runtime/mode/0001-execution-mode.md";

const ADR = `# ADR 0001: 실행 모드

Date: 2026-08-15

## Status

Accepted (2026-08-15)

## Context

처리 경로마다 다른 모드를 사용하면 동일한 요청이 서로 다른 결과를 낸다.

## Decision Drivers

- 모든 처리 경로가 같은 의미를 사용해야 한다
- 운영자가 현재 모드를 한 문장으로 확인할 수 있어야 한다
- 완료된 작업은 다시 실행되지 않아야 한다

## Decision

\`MODE_A\`와 \`MODE_B\`를 혼용하지 않고 \`MODE_B\`만 사용한다.

### Requirement contract

- 완료된 작업은 처리 중 상태로 돌아가지 않는다.

### Alternatives

1. **단일 실행 모드**
   - 장점: 모든 경로가 같은 의미를 사용한다.
   - 단점: 전환 전에 모든 호출자를 확인해야 한다.
2. **경로별 실행 모드**
   - 장점: 각 경로를 독립적으로 변경할 수 있다.
   - 단점: 같은 요청이 경로에 따라 다르게 처리될 수 있다.

## Consequences

### Positive

운영자는 현재 실행 모드를 직접 확인할 수 있다.

### Negative

새 처리 경로도 같은 실행 모드를 따라야 한다.
`;

export default {
  name: "sync-rewrites-final-state-only",
  description:
    "/adr-sync must replace comparison-based transition prose with the direct current result while preserving a genuine current prohibition.",
  bugReport:
    "“ADR 수정 시 최종 결과만 쓰면 되는데 이전 이름과 혼용하지 않는다는 중간 과정까지 본문에 남아 문서가 길어진다.”",

  build(dir) {
    seedRuleDocs(dir);
    write(dir, ADR_PATH, ADR);
    seedMapping(dir, {
      categories: {
        "runtime/mode": {
          feature: "Execution mode",
          adrs: [
            {
              path: ADR_PATH,
              status: "Accepted (2026-08-15)",
              summary: "MODE_A와 MODE_B를 혼용하지 않고 MODE_B만 사용한다",
            },
          ],
          dependsOn: [],
        },
      },
    });
    write(
      dir,
      "src/runtime/mode.ts",
      `export const executionMode = "MODE_B";\n` +
        `export const allowedTransitions = { processing: ["completed"], completed: [] };\n`,
    );
    write(
      dir,
      "tests/runtime-mode.test.ts",
      `execution mode is MODE_B\ncompleted work cannot return to processing\n`,
    );

    return [
      skillText("adr-sync"),
      `\n---\n\n# This run`,
      `Repository: ${dir}`,
      `Target category: runtime/mode`,
      ``,
      `This is a NON-INTERACTIVE deep sync. The user has confirmed that MODE_B is`,
      `the intended current decision and that completed work must never return to`,
      `processing. The code already matches both contracts. Correct only the ADR`,
      `wording and its mapping summary; do not ask another question.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ dir }) {
    const body = read(dir, ADR_PATH) ?? "";
    const decision = body.match(/## Decision\n([\s\S]*?)\n### Alternatives/)?.[1] ?? "";
    const mapping = read(dir, "docs/adr/.mapping.json") ?? "";

    return [
      expectText(decision, /실행 모드는\s*`?MODE_B`?다/, "states MODE_B as the direct result"),
      expectNoText(decision, /MODE_A/, "removes the replaced mode from current-state prose"),
      expectNoText(
        decision,
        /혼용하지|대신|rather than|instead of|no longer/i,
        "removes transition and comparison carriers",
      ),
      expectText(
        decision,
        /완료된 작업은 처리 중 상태로 돌아가지 않는다/,
        "preserves the current forbidden transition",
      ),
      expectText(mapping, /"summary":\s*"[^"]*MODE_B[^"]*"/, "updates the mapping summary"),
      expectNoText(mapping, /"summary":\s*"[^"]*MODE_A[^"]*"/, "removes MODE_A from the summary"),
    ];
  },
};
