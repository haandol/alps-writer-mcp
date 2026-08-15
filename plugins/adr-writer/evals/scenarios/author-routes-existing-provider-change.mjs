// Scenario: the provider changes, but the architectural question remains the
// same model/provider boundary. /adr-new must reuse the existing ADR identity
// and route the change to edit-in-place instead of allocating 0002. Reverting
// the provider later follows the same route.
import {
  skillText,
  seedRuleDocs,
  seedMapping,
  write,
  read,
  TAIL_SPEC,
  expectText,
} from "../lib/harness.mjs";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const ADR_PATH = "docs/adr/ai/model-provider/0001-select-model-provider-boundary.md";

const ADR = `# ADR 0001: 모델 제공자 경계 선택

Date: 2026-08-01

## Status

Accepted (2026-08-10)

## Context

서비스는 GPT-5.6을 외부 모델로 사용하며 모델 제공자 경계가 비용, 가용성, 데이터 처리 조건을 결정한다.

## Decision Drivers

- GPT-5.6 모델 동작을 유지해야 한다.
- 외부 제공자의 비용과 할당량을 통제해야 한다.
- 요청 데이터의 처리 경계를 명확히 해야 한다.

## Decision

서비스는 GPT-5.6을 Amazon Bedrock을 통해 사용한다.

### Alternatives

1. **Amazon Bedrock**
   - 장점: 기존 클라우드 경계 안에서 운영한다.
   - 단점: Bedrock의 모델 가용성과 할당량에 의존한다.
2. **OpenAI API**
   - 장점: 모델 제공자와 직접 통합한다.
   - 단점: 별도 외부 제공자 경계를 운영해야 한다.

## Consequences

### Positive

운영자는 모델 제공자 경계를 한 곳에서 확인할 수 있다.

### Negative

제공자 장애와 정책 변경이 서비스에 영향을 준다.
`;

export default {
  name: "author-routes-existing-provider-change",
  description:
    "/adr-new must route a Bedrock-to-OpenAI provider change and later reversal to the existing provider-boundary ADR instead of creating another ADR.",
  bugReport:
    "“모델은 그대로 두고 Amazon Bedrock에서 OpenAI API로 바꿀 때 새 ADR을 만들고, 다시 되돌릴 때도 또 ADR을 만든다. 기존 ADR의 Driver와 내용만 업데이트해야 한다.”",

  build(dir) {
    seedRuleDocs(dir);
    write(dir, ADR_PATH, ADR);
    seedMapping(dir, {
      categories: {
        "ai/model-provider": {
          feature: "Model provider boundary",
          adrs: [
            {
              path: ADR_PATH,
              status: "Accepted (2026-08-10)",
              summary: "서비스는 GPT-5.6을 Amazon Bedrock을 통해 사용한다",
            },
          ],
          dependsOn: [],
        },
      },
    });

    return [
      skillText("adr-new"),
      `\n---\n\n# This run`,
      `Repository: ${dir}`,
      `Argument: ai/model-provider`,
      ``,
      `This is a NON-INTERACTIVE routing run. The repository already contains the`,
      `mapping record and ADR body reproduced below. The user wants to keep GPT-5.6`,
      `but change the provider from Amazon Bedrock to the OpenAI API. The old and new`,
      `provider choices do not coexist. State whether /adr-new creates another ADR or`,
      `routes the existing ADR to its owning update workflow. Also state how a later`,
      `reversion to Amazon Bedrock is handled. Do not implement code in this run.`,
      ``,
      `## Existing mapping`,
      "```json",
      read(dir, "docs/adr/.mapping.json"),
      "```",
      ``,
      `## Existing ADR`,
      ADR,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output, dir }) {
    const numbered = findNumberedAdrFiles(path.join(dir, "docs", "adr"));
    const mapping = JSON.parse(read(dir, "docs/adr/.mapping.json") ?? '{"categories":{}}');
    const records = mapping.categories?.["ai/model-provider"]?.adrs ?? [];

    return [
      {
        pass:
          numbered.length === 1 && numbered[0].endsWith("0001-select-model-provider-boundary.md"),
        detail: `numbered ADRs: ${numbered.join(", ") || "none"}`,
        label: "does not allocate a second ADR for the provider change",
      },
      {
        pass: records.length === 1 && records[0]?.path === ADR_PATH,
        detail: `mapping records: ${JSON.stringify(records)}`,
        label: "keeps one mapping identity for the provider-boundary decision",
      },
      expectText(
        output,
        /decision identity|same (?:architectural )?(?:question|decision)|기존.*(?:결정|ADR)/i,
        "recognizes the existing logical decision owner",
      ),
      expectText(
        output,
        /edit(?:-|\s+)in(?:-|\s+)place|update the existing ADR|기존 ADR.*(?:갱신|수정|업데이트)|제자리 (?:갱신|수정|재작성)/i,
        "routes the provider change to edit-in-place",
      ),
      expectText(output, /\/adr-impl\s+ai\/model-provider/, "names the owning update workflow"),
      expectText(
        output,
        /revert|reversion|return|되돌|원복/i,
        "treats a later provider reversal as the same ADR identity",
      ),
      expectText(
        output,
        /(?:(?:0002|new ADR|새 ADR).{0,80}(?:없|금지|not|no|without)|(?:없|금지|not|no|without).{0,80}(?:0002|new ADR|새 ADR))/i,
        "does not recommend a new ADR for either direction",
      ),
      {
        pass: tail.verdict !== null && !/^(BLOCK|FIX_REQUIRED)$/i.test(tail.verdict.trim()),
        detail: tail.verdict ? `verdict was ${tail.verdict}` : "no verdict in the tail block",
        label: "reports deterministic reuse routing",
      },
    ];
  },
};

function findNumberedAdrFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry);
      if (statSync(full).isDirectory()) stack.push(full);
      else if (/^\d{4}-.*\.md$/.test(entry)) out.push(full);
    }
  }
  return out.sort();
}
