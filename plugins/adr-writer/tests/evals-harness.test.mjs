// Tests for the eval harness itself — the scorer, the tail parser, and the
// fixtures. Runs in pnpm test with NO model calls: a stub agent script stands in
// for the real one, so this stays deterministic and free.
//
// Why this matters: an eval whose scorer cannot tell a bad reply from a good one
// is worse than no eval, because it reports green. During development the
// requirement-value scenario's prose check did exactly that — its regex assumed
// English verb-first word order ("remove the 20-turn cap") and silently passed
// every Korean reply ("20턴 제한은 … 삭제한다"), which is the language these ADRs
// are written in. These tests pin the discriminating power that fixed it.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  mkdtempSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(HERE, "..");
const EVALS = path.join(PLUGIN_ROOT, "evals");
const RUN = path.join(EVALS, "run.mjs");

function scenarioFiles() {
  return readdirSync(path.join(EVALS, "scenarios")).filter((f) => f.endsWith(".mjs"));
}

async function loadScenario(file) {
  return (await import(path.join(EVALS, "scenarios", file))).default;
}

// A scenario that reads its target out of the environment (the real-repo one)
// throws from build() when it is unset. That is correct behaviour — a silent
// empty fixture would be worse — so the sweep tests skip it and it gets its own.
function needsEnv(scenario) {
  return scenario.name === "review-real-repo-adr";
}

// A stub "agent": ignores stdin, prints the canned reply. Stands in for the real
// command so the scorer can be exercised without a model.
function stubAgent(reply) {
  const dir = mkdtempSync(path.join(tmpdir(), "adr-eval-stub-"));
  const script = path.join(dir, "stub.sh");
  writeFileSync(script, `#!/bin/bash\ncat > /dev/null\ncat <<'ADREOF'\n${reply}\nADREOF\n`);
  chmodSync(script, 0o755);
  return script;
}

function runEvals(args, cmd) {
  const r = spawnSync("node", [RUN, ...args], {
    cwd: PLUGIN_ROOT,
    encoding: "utf8",
    env: { ...process.env, ...(cmd ? { ADR_EVAL_CMD: cmd } : {}) },
    // Match the production eval timeout. The full test command schedules
    // several subprocess-heavy files together, so 120 seconds can kill a
    // completed stub run while its parent runner is still exiting.
    timeout: 600_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  return { code: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

test("every scenario exports the shape the runner requires", async () => {
  const files = scenarioFiles();
  assert.ok(files.length >= 3, "expected several scenarios");
  for (const file of files) {
    const s = await loadScenario(file);
    assert.match(s.name, /^[a-z0-9-]+$/, `${file}: name must be kebab-case`);
    assert.ok(s.description?.length > 20, `${file}: needs a real description`);
    assert.equal(typeof s.build, "function", `${file}: build must be a function`);
    assert.equal(typeof s.score, "function", `${file}: score must be a function`);
  }
});

test("--list names every scenario without invoking an agent", () => {
  const { code, out } = runEvals(["--list"]);
  assert.equal(code, 0);
  assert.match(out, /review-requirement-value-preserved/);
  assert.match(out, /author-keeps-values-and-lints/);
  assert.match(out, /author-rejects-implementation-detail/);
  assert.match(out, /refactor-safe-local-duplicate/);
  assert.match(out, /refactor-protected-state-transition/);
  assert.match(out, /refactor-no-subagent-proposal-only/);
  assert.match(out, /feature-handoff-zero-or-many/);
  assert.match(out, /impl-blocks-proposed-prerequisite/);
  assert.match(out, /hook-admission-routing/);
  assert.match(out, /alps-batch-preserves-mandatory-nfr/);
  assert.match(out, /impl-review-selects-risk-mode/);
  assert.match(out, /bedrock-subagent-fallback/);
  assert.match(out, /comprehension-load-score-only/);
});

// The prompt has to carry the SHIPPED instruction text. If a scenario ever
// paraphrased the rules instead, the eval would measure the paraphrase — the one
// failure mode that makes the whole directory misleading.
test("prompts embed the real skill/agent text, not a paraphrase", async () => {
  for (const file of scenarioFiles()) {
    const s = await loadScenario(file);
    // Scenarios that point at a repo supplied via the environment cannot build
    // without it; the real-repo one has its own test below.
    if (needsEnv(s)) continue;
    const dir = mkdtempSync(path.join(tmpdir(), "adr-eval-shape-"));
    const prompt = await s.build(dir);
    assert.ok(prompt.length > 5000, `${s.name}: prompt is too short to hold a real skill body`);
    // a distinctive line from the shipped docs, not something a summary would coin
    if (s.name === "alps-batch-preserves-mandatory-nfr") {
      assert.match(prompt, /Atomic is the default|top-3 focus set|separately labeled draft/i);
    } else {
      assert.match(
        prompt,
        /abstraction ladder|requirement gate|admission gate|Regeneration|decision ledger/i,
      );
    }
    // and the machine-readable tail the scorer depends on
    assert.match(prompt, /EVAL-VERDICT/);
    assert.match(prompt, /EVAL-FINDINGS/);
  }
});

test("prompt loaders include only explicitly selected direct references", async () => {
  const { skillText } = await import(path.join(EVALS, "lib", "harness.mjs"));

  const reviewBase = skillText("adr-review");
  assert.doesNotMatch(reviewBase, /# Loaded reference:/);
  assert.doesNotMatch(reviewBase, /Invalid 'input': value did not match any expected variant/);

  const review = skillText("adr-review", {
    references: ["references/subagent-dispatch.md"],
  });
  assert.match(review, /# Loaded reference: references\/subagent-dispatch\.md/);
  assert.match(review, /Invalid 'input': value did not match any expected variant/);

  const sync = skillText("adr-sync", {
    references: ["skills/adr-sync/references/repository-hygiene.md"],
  });
  assert.match(sync, /# Loaded reference: skills\/adr-sync\/references\/repository-hygiene\.md/);
  assert.match(sync, /^## Canonical stale Feature-ID naming$/m);

  assert.throws(
    () =>
      skillText("adr-review", {
        references: ["references/not-directly-referenced.md"],
      }),
    /not directly referenced/,
  );
});

// Fixtures must be repos the plugin would accept. A fixture that trips the
// shipped lint teaches the agent about a defect the scenario never meant to test
// — during development the enum scenario shipped a bare "Accepted" in the
// mapping, which the lint flags as status-index-mismatch.
test("review fixtures are valid repos by the shipped lint", async () => {
  const lint = path.join(PLUGIN_ROOT, "scripts", "adr-structure-lint.mjs");
  for (const file of scenarioFiles()) {
    const s = await loadScenario(file);
    // author-* scenarios start from an empty mapping on purpose — there is no
    // ADR yet, which is the point of the scenario. Env-driven ones lint whatever
    // the target repo holds, which is not this harness's business.
    if (s.name.startsWith("author-") || needsEnv(s)) continue;
    const dir = mkdtempSync(path.join(tmpdir(), "adr-eval-lint-"));
    await s.build(dir);
    const r = spawnSync("node", [lint, "--no-invariants", "--json"], {
      cwd: dir,
      encoding: "utf8",
    });
    const report = JSON.parse(r.stdout);
    assert.deepEqual(
      report.errors ?? [],
      [],
      `${s.name}: fixture has lint errors: ${JSON.stringify(report.errors)}`,
    );
  }
});

// ── the scorer must discriminate ──────────────────────────────────────────
// The reply that follows the rules, and the reply that commits the exact defect
// the scenario names. Both in Korean, since that is what these ADRs are written
// in and the word-order bug lived there.
const GOOD_REVIEW = `## ADR Review

### Verdict
PASS

### Findings
- [R20] 문장이 길다 (confidence: low) — "세션 단위로 대화 길이를 제한하고"
  Suggested fix: 두 문장으로 나눈다

### Regeneration check (R19)
- Contracts honored when rebuilding from this ADR alone: 20턴, 월 5회, 30일
- Missing, must be asked about: none

=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
R20 | 문장이 길다 — 분리 권고
=== EVAL-END ===`;

const BAD_REVIEW = `## ADR Review

### Verdict
FIX_REQUIRED

### Findings
- [R4] 코드 통독으로 알 수 있다 (confidence: high) — "한 채팅 세션은 최대 20턴"
  Suggested fix: 20턴 제한은 코드에 이미 있으므로 ADR에서 삭제한다

### Regeneration check (R19)
- Contracts honored when rebuilding from this ADR alone: 월 5회
- Missing, must be asked about: none

=== EVAL-VERDICT: FIX_REQUIRED ===
=== EVAL-FINDINGS ===
R4 | 20턴 제한은 코드에 있으므로 ADR에서 삭제
=== EVAL-END ===`;

test("the requirement-value scorer passes a compliant reply", () => {
  const { code, out } = runEvals(["--only", "review-requirement-value"], stubAgent(GOOD_REVIEW));
  assert.equal(code, 0);
  assert.doesNotMatch(out, /✗/, `a compliant reply must fail no check:\n${out}`);
});

test("the requirement-value scorer catches the delete-my-value defect", () => {
  const { code, out } = runEvals(["--only", "review-requirement-value"], stubAgent(BAD_REVIEW));
  assert.equal(code, 0, "a failing check is a finding, not a harness error");
  // the rule-tag route
  assert.match(out, /✗.*no rule fires against a recorded requirement value/);
  // and the prose route — Korean word order (object before verb), which a
  // verb-first-only regex misses
  assert.match(out, /✗.*no prose advice to remove a value/);
});

test("the implementation-detail admission scorer distinguishes rejection from over-creation", async () => {
  const scenario = await loadScenario("author-rejects-implementation-detail.mjs");

  const goodDir = mkdtempSync(path.join(tmpdir(), "adr-eval-admission-good-"));
  await scenario.build(goodDir);
  const goodChecks = scenario.score({
    tail: { verdict: "PASS", findings: [] },
    output:
      "ADR admission gate: AWS SDK v3와 default credential provider chain은 기존 GPT-5.6 Amazon Bedrock provider boundary를 유지하는 구현 디테일이므로 ADR을 만들지 않습니다.\n=== EVAL-VERDICT: PASS ===",
    dir: goodDir,
  });
  assert.ok(
    goodChecks.every((check) => check.pass),
    JSON.stringify(goodChecks),
  );

  const badDir = mkdtempSync(path.join(tmpdir(), "adr-eval-admission-bad-"));
  await scenario.build(badDir);
  const adrDir = path.join(badDir, "docs", "adr", "llm", "bedrock-client");
  mkdirSync(adrDir, { recursive: true });
  writeFileSync(
    path.join(adrDir, "0001-use-aws-sdk-v3.md"),
    "# ADR 0001: Use AWS SDK v3\n\n## Status\n\nProposed\n",
  );
  writeFileSync(
    path.join(badDir, "docs", "adr", ".mapping.json"),
    JSON.stringify({
      categories: {
        "llm/bedrock-client": {
          feature: "Bedrock client",
          adrs: [
            {
              path: "docs/adr/llm/bedrock-client/0001-use-aws-sdk-v3.md",
              status: "Proposed",
              summary: "AWS SDK v3와 credential provider chain을 사용한다",
            },
          ],
          dependsOn: [],
        },
      },
    }),
  );
  const badChecks = scenario.score({
    tail: { verdict: "PASS", findings: [] },
    output: "AWS SDK v3와 credential provider chain을 위한 ADR을 작성하고 저장했습니다.",
    dir: badDir,
  });
  assert.equal(badChecks.find((check) => check.label.includes("creates no ADR"))?.pass, false);
  assert.equal(badChecks.find((check) => check.label.includes("creates no mapping"))?.pass, false);
});

test("refactor safety scorers distinguish safe, protected, and no-subagent outcomes", () => {
  const cases = [
    [
      "refactor-safe-local-duplicate",
      "APPLY_NOW | extract current duplicate normalization into one local helper",
    ],
    [
      "refactor-protected-state-transition",
      "PROPOSE_ONLY | state-transition change touches the ADR contract",
    ],
    [
      "refactor-no-subagent-proposal-only",
      "PROPOSE_ONLY | independent reviewer unavailable, so do not auto-apply",
    ],
  ];

  for (const [name, finding] of cases) {
    const reply = `=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
${finding}
=== EVAL-END ===`;
    const { code, out } = runEvals(["--only", name], stubAgent(reply));
    assert.equal(code, 0, out);
    assert.doesNotMatch(out, /✗/, `${name} compliant classification failed:\n${out}`);
  }
});

test("Bedrock fallback scorer requires no dispatch, no retry, main-session review, and proposal-only refactoring", async () => {
  const scenario = await loadScenario("bedrock-subagent-fallback.mjs");
  const compliant = scenario.score({
    tail: {
      findings: [
        { tag: "NO_DISPATCH", summary: "Amazon Bedrock is known before dispatch" },
        { tag: "NO_RETRY", summary: "the validation error is terminal for this command" },
        { tag: "MAIN_SESSION_FALLBACK", summary: "review passes continue without isolation" },
        { tag: "PROPOSE_ONLY", summary: "refactor candidates are not auto-applied" },
      ],
    },
  });
  assert.ok(
    compliant.every((check) => check.pass),
    JSON.stringify(compliant, null, 2),
  );

  const unsafe = scenario.score({
    tail: {
      findings: [
        { tag: "SPAWN_SUBAGENT", summary: "try a generic reviewer after the named agent fails" },
        { tag: "APPLY_NOW", summary: "apply a local refactor from the main session" },
      ],
    },
  });
  assert.ok(
    unsafe.some((check) => !check.pass),
    "unsafe Bedrock routing must fail the scorer",
  );
});

test("critical workflow scorers accept compliant classifications and reject collapsed ones", () => {
  const cases = [
    {
      name: "feature-handoff-zero-or-many",
      good: `SDK 교체는 ADR이 아니다. placeholder ADR도 만들지 않는다.
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
ZERO_ADR | F1 SDK와 credential 교체는 구현 디테일
ADR_CANDIDATE | F2 export는 30일 뒤 삭제
ADR_CANDIDATE | F2 ArchiveCo와 24시간 fallback 정책
FEATURE_DEP_ONLY | F2가 F1 구현을 재사용하지만 ADR dependsOn은 만들지 않음
=== EVAL-END ===`,
      bad: `=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
ADR_CANDIDATE | F1 AWS SDK v3 선택
=== EVAL-END ===`,
    },
    {
      name: "impl-blocks-proposed-prerequisite",
      good: `identity/login이 Accepted가 된 뒤 진행해야 한다. checkout-only 우회 구현은 허용하지 않는다.
=== EVAL-VERDICT: BLOCK ===
=== EVAL-FINDINGS ===
BLOCKED | identity/login 선행 ADR이 Proposed라 downstream 구현 중단
=== EVAL-END ===`,
      bad: `checkout-only로 우회 구현을 허용한다.
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
NONE
=== EVAL-END ===`,
    },
    {
      name: "hook-admission-routing",
      good: `=== EVAL-VERDICT: A=EXEMPT, B=ADR_FIRST ===
=== EVAL-FINDINGS ===
EXEMPT | SDK와 credential adapter 교체는 코드 수준
ADR_FIRST | 업로드 quota를 5에서 3으로 바꾸는 요구사항 변경
=== EVAL-END ===`,
      bad: `=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
ADR_FIRST | SDK 교체를 ADR로 작성
=== EVAL-END ===`,
    },
    {
      name: "alps-batch-preserves-mandatory-nfr",
      good: `=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
BATCH_ALLOWED | 완전한 입력과 명시적 요청으로 batch 승인
SEPARATE_SAVE_UNIT | 각 section과 7.1, 7.2 Feature를 별도 저장
FOCUS_SET | 선택 NFR 중 상위 3개를 집중 항목으로 표시
MANDATORY_NFR | 결제 데이터를 저장하지 않음, GDPR 삭제는 30일 이내, WCAG 2.2 AA, 정산 API 99.9% 가용성
=== EVAL-END ===`,
      bad: `=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
FOCUS_SET | NFR은 최대 3개이므로 WCAG를 삭제
=== EVAL-END ===`,
    },
    {
      name: "impl-review-selects-risk-mode",
      good: `=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
STANDARD | A private local helper consolidation; public API unchanged
FULL | B retention 30 to 90 days and public API change
=== EVAL-END ===`,
      bad: `=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
STANDARD | B public API retention change
=== EVAL-END ===`,
    },
    {
      name: "comprehension-load-score-only",
      good: `A — 인지비용: 2/10
B — 인지비용: 9/10
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
FEATURE_SCORE | A 2/10
ADR_SCORE | B 9/10
=== EVAL-END ===`,
      bad: `A — 인지비용: 2/10
B — 인지비용: 9/10
B는 여러 시스템이 연결되어 있어서 이해하기 어렵다.
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
FEATURE_SCORE | A 2/10
ADR_SCORE | B 9/10
=== EVAL-END ===`,
    },
    {
      name: "author-routes-existing-provider-change",
      good: `기존 ADR 0001이 같은 결정을 소유하므로 제자리 재작성하고 /adr-impl ai/model-provider로 라우팅한다. 원복도 같은 ADR이며 새 ADR이나 0002는 없다.
=== EVAL-VERDICT: ROUTE_TO_EXISTING ===
=== EVAL-FINDINGS ===
DECISION_IDENTITY | 기존 provider boundary ADR을 유지하고 Bedrock 원복도 같은 0001에 반영
=== EVAL-END ===`,
      bad: `OpenAI API 전환용 ADR 0002를 새로 작성한다.
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
NEW_ADR | provider 변경마다 새 ADR 생성
=== EVAL-END ===`,
    },
    {
      name: "impl-completes-without-reconfirmation",
      good: `PASS_PATH는 추가 승인 없이 Accepted로 완료한다. FIX_PATH는 사용자 승인 없이 자동 수정하고 최종 보고에 수정과 검증을 정리한다. ESCALATE_ONLY만 사용자에게 묻는다.
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
PASS_PATH | 추가 승인 없이 Accepted로 전환
FIX_PATH | 사용자 승인 없이 자동으로 Spec violation 코드를 수정하고 Test gap 테스트를 추가한 뒤 재실행하고 동일 모드로 재리뷰
ESCALATE_ONLY | 계약 변경 결정만 사용자에게 질문하며 자동 수정 없음
=== EVAL-END ===`,
      bad: `구현 후 재생성 가능한지 다시 확인받고 각 finding을 apply/skip/defer로 판정받는다.
=== EVAL-VERDICT: BLOCK ===
=== EVAL-FINDINGS ===
PASS_PATH | 사용자 승인 대기
=== EVAL-END ===`,
    },
  ];

  for (const { name, good, bad } of cases) {
    const goodRun = runEvals(["--only", name], stubAgent(good));
    assert.equal(goodRun.code, 0, goodRun.out);
    assert.doesNotMatch(goodRun.out, /✗/, `${name} rejected a compliant result:\n${goodRun.out}`);

    const badRun = runEvals(["--only", name], stubAgent(bad));
    assert.equal(badRun.code, 0, badRun.out);
    assert.match(badRun.out, /✗/, `${name} scorer failed to reject the collapsed behavior`);
  }
});

test("final-state sync scorer rejects transition residue and preserves current prohibitions", async () => {
  const scenario = await loadScenario("sync-rewrites-final-state-only.mjs");

  const badDir = mkdtempSync(path.join(tmpdir(), "adr-eval-final-state-bad-"));
  await scenario.build(badDir);
  const badChecks = await scenario.score({ dir: badDir, output: "", tail: null });
  assert.ok(
    badChecks.some((check) => !check.pass),
    "the planted transition narration must not score as compliant",
  );

  const goodDir = mkdtempSync(path.join(tmpdir(), "adr-eval-final-state-good-"));
  await scenario.build(goodDir);
  const adrPath = path.join(goodDir, "docs/adr/runtime/event/0001-event-name.md");
  const mappingPath = path.join(goodDir, "docs/adr/.mapping.json");
  writeFileSync(
    adrPath,
    readFileSync(adrPath, "utf8").replace(
      "`LEGACY_EVENT`와 `CURRENT_EVENT`를 혼용하지 않고 `CURRENT_EVENT`만 사용한다.",
      "이벤트 이름은 `CURRENT_EVENT`다.",
    ),
  );
  writeFileSync(
    mappingPath,
    readFileSync(mappingPath, "utf8").replace(
      "LEGACY_EVENT와 CURRENT_EVENT를 혼용하지 않고 CURRENT_EVENT만 사용한다",
      "이벤트 이름은 CURRENT_EVENT다",
    ),
  );

  const goodChecks = await scenario.score({ dir: goodDir, output: "", tail: null });
  assert.deepEqual(
    goodChecks.filter((check) => !check.pass),
    [],
    `a direct final-state rewrite must pass: ${JSON.stringify(goodChecks)}`,
  );
});

// ── the author-side scorer must discriminate too ───────────────────────────
// author-self-checks-missing-value scores an ARTIFACT, not just a reply, so its
// stub has to write the ADR the way a real run would. That makes it the one
// scenario whose scorer could pass vacuously: most of its checks assert the
// ABSENCE of a bad value in the body, and an empty body satisfies every one of
// them. The "an ADR was written" check exists for that reason, and these two
// tests pin that it actually carries the weight.
//
// The pair matters as much here as it does on the review side. A stub that
// blurs the contract must fail, and a stub that names the gaps must pass — a
// scorer tuned to catch only one of those directions would greenlight the
// behaviour that reintroduces the defect.
const AUTHOR_ADR_PATH = "docs/adr/pricing/0001-free-plan-session-limit.md";

// The correct behaviour: contracts the brief never gave are named as open
// questions, nothing is invented, tuning values stay out.
const GOOD_AUTHOR_ADR = `# ADR 0001: 무료 플랜 채팅 세션 제한

Date: 2026-07-01

## Status

Proposed

## Context

무료 사용자의 LLM 호출 비용이 예측 불가능하게 늘고 있다. 재무팀이 원가 상한을 승인했다.

## Decision Drivers

- 무료 플랜 1인당 월 LLM 원가를 통제해야 한다
- 상한에 걸린 사용자의 이탈을 최소화해야 한다
- 서버가 세션 상태를 오래 들고 있지 않아야 한다

## Decision

세션 단위로 대화 길이를 제한하고, 상한에 도달하면 새 세션을 시작하도록 안내한다.

### Requirement contract

- 세션당 대화 길이 상한: **아직 정해지지 않았다 — 오너에게 확인 필요**
- 세션 기록 보관 기간: **미정, 확인 필요**
- 세션의 허용 상태 집합: 브리프가 어떤 상태인지 말하지 않아 **미정, 확인 필요**

## Consequences

### Positive

원가가 예측 가능해진다.

### Negative

긴 대화가 필요한 사용자는 맥락을 다시 제공해야 한다.

### Alternatives

- **토큰 총량 제한**: 원가와 정확히 연동되지만 남은 양을 예측할 수 없다.
- **월 누적 턴 수 제한**: 단순하지만 서버가 누적치를 들고 있어야 해 운영 제약에 어긋난다.
`;

// The pre-fix behaviour: the hole is written into the ADR as "적절히", the state
// set is summarized away, and the draft is reported clean.
const BAD_AUTHOR_ADR = GOOD_AUTHOR_ADR.replace(
  /### Requirement contract[\s\S]*?\n\n## Consequences/,
  `### Requirement contract

- 한 세션의 대화 길이는 적절히 제한된다
- 세션 기록은 일정 기간 보관 후 삭제된다
- 세션에는 몇 가지 상태가 있으며 상태 전이를 관리한다
- 세션 캐시 TTL은 300초다

## Consequences`,
);

// A stub that writes the ADR into its cwd (the fixture) and then prints a reply.
// The runner passes cwd=fixture, which is what makes an author-side stub possible.
function stubAuthor(adrBody, reply) {
  const dir = mkdtempSync(path.join(tmpdir(), "adr-eval-author-stub-"));
  const bodyFile = path.join(dir, "adr.md");
  writeFileSync(bodyFile, adrBody);
  const script = path.join(dir, "stub.sh");
  writeFileSync(
    script,
    `#!/bin/bash\ncat > /dev/null\n` +
      `mkdir -p "$(dirname ${AUTHOR_ADR_PATH})"\ncp ${bodyFile} ${AUTHOR_ADR_PATH}\n` +
      `cat <<'ADREOF'\n${reply}\nADREOF\n`,
  );
  chmodSync(script, 0o755);
  return script;
}

const GOOD_AUTHOR_REPLY = `step 6(a) 하네스: 통과.

step 6(b) 자기 점검 — R19 재생성 테스트를 적어냅니다.

재구축이 지켜야 할 계약:
- 세션당 대화 길이 상한 — **없음. 브리프에 숫자가 없어 확인 필요**
- 세션 기록 보관 기간 — **없음, 미정이라 물어봐야 합니다**
- 허용 상태 집합 — **어떤 상태인지 정해지지 않았습니다**

숫자를 만들어 넣지 않았고, 캐시 TTL과 워커 수는 튜닝값이라 본문에서 제외했습니다.

=== EVAL-VERDICT: FIX_REQUIRED ===
=== EVAL-FINDINGS ===
R18a | 세션당 대화 길이 상한이 브리프에 없어 미정 — 오너 확인 필요
R19 | 보관 기간과 허용 상태 집합이 비어 재구축 불가
=== EVAL-END ===`;

const BAD_AUTHOR_REPLY = `ADR을 작성했고 하네스도 통과했습니다. 계약은 완전합니다.

=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
NONE
=== EVAL-END ===`;

test("the author self-check scorer passes a draft that names its gaps", () => {
  const { code, out } = runEvals(
    ["--only", "author-self-checks"],
    stubAuthor(GOOD_AUTHOR_ADR, GOOD_AUTHOR_REPLY),
  );
  assert.equal(code, 0);
  assert.doesNotMatch(out, /✗/, `a compliant author run must fail no check:\n${out}`);
});

test("the author self-check scorer catches a blurred contract reported as clean", () => {
  const { code, out } = runEvals(
    ["--only", "author-self-checks"],
    stubAuthor(BAD_AUTHOR_ADR, BAD_AUTHOR_REPLY),
  );
  assert.equal(code, 0, "a failing check is a finding, not a harness error");
  // the exact pre-fix behaviour: the hole written in as 적절히 / 일정 기간
  assert.match(out, /✗.*does not blur the missing contract/);
  // a self-reviewer's default conclusion — "the contract is complete"
  assert.match(out, /✗.*does not report a clean pass while contracts are unresolved/);
  // the gaps went unnamed, so the open-question checks must fail rather than
  // being satisfied by the ADR merely mentioning the subject
  assert.match(out, /✗.*names the missing retention period as an open question/);
  // and the tuning value pulled up into the body is still scored
  assert.match(out, /✗.*leaves the cache TTL out/);
});

// The costliest failure this scenario watches for: a value the brief never gave,
// written into the ADR as though approved. /adr-impl enforces ADR values at face
// value, so a fabricated cap becomes a real product limit nobody signed off on.
//
// This test exists because the check's first version silently passed it. JS `\b`
// is defined over ASCII word characters, so it never matches after a Hangul
// syllable: `/\d+\s*(턴|일)\b/` does not match "최대 20턴으로" or "30일 후". The
// scenario reported green on an ADR that had invented both numbers — the same
// defect class as the Korean word-order bug this file's header describes, and the
// reason a scorer needs its own adversarial fixture rather than just a good one.
test("the invented-value check fires on Korean units, where \\b does not apply", () => {
  const invented = GOOD_AUTHOR_ADR.replace(
    /### Requirement contract[\s\S]*?\n\n## Consequences/,
    `### Requirement contract

- 한 세션은 최대 20턴으로 제한된다
- 세션 기록은 30일 후 삭제된다

## Consequences`,
  );
  const { code, out } = runEvals(
    ["--only", "author-self-checks"],
    stubAuthor(invented, BAD_AUTHOR_REPLY),
  );
  assert.equal(code, 0);
  assert.match(out, /✗.*invents no requirement value the brief never gave/);
});

// The vacuous-pass guard. Most of this scenario's checks assert an ABSENCE, so an
// agent that writes no ADR at all satisfies them — which would report a run that
// produced nothing as mostly green. The "an ADR was written" check must fail, and
// the open-question checks must not be satisfied by an empty artifact.
test("an author run that writes no ADR fails rather than passing vacuously", () => {
  const { code, out } = runEvals(["--only", "author-self-checks"], stubAgent(GOOD_AUTHOR_REPLY));
  assert.equal(code, 0);
  assert.match(out, /✗.*an ADR was written/);
  // the brief's alternatives can only be scored against a body, so this one too
  assert.match(out, /✗.*records the token-quota alternative/);
});

// A reply with no tail block is a result, not a crash: the agent ignored a
// format instruction, and the run should say so rather than throw.
test("a reply with no tail block is reported, not fatal", () => {
  const { code, out } = runEvals(
    ["--only", "review-requirement-value"],
    stubAgent("리뷰를 완료했습니다. 문제 없습니다."),
  );
  assert.equal(code, 0);
  assert.match(out, /NO TAIL BLOCK/);
});

// Rates are the whole output of this tool, so an all-or-nothing summary would
// defeat it. With a stub that alternates, the run must report a fraction.
test("runs are aggregated as a rate, not collapsed to pass/fail", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "adr-eval-flaky-"));
  const counter = path.join(dir, "n");
  const good = stubAgent(GOOD_REVIEW);
  const bad = stubAgent(BAD_REVIEW);
  const script = path.join(dir, "flaky.sh");
  writeFileSync(
    script,
    `#!/bin/bash\nN=$(cat ${counter} 2>/dev/null || echo 0)\necho $((N+1)) > ${counter}\n` +
      `if [ $((N % 2)) -eq 0 ]; then exec ${bad}; else exec ${good}; fi\n`,
  );
  chmodSync(script, 0o755);

  const { code, out } = runEvals(["--only", "review-requirement-value", "--runs", "4"], script);
  assert.equal(code, 0);
  // 2 of 4 replies commit the defect, so the check must read 2/4 — not ✔ and not 0/4
  assert.match(out, /✗\s+2\/4\s+no rule fires against a recorded requirement value/);
});

// The runner must fail loudly when the agent command is wrong, or a
// misconfigured run reads as "everything passed".
test("an agent that produces nothing is an error, not a silent pass", () => {
  const { code, out } = runEvals(["--only", "review-requirement-value"], "true");
  assert.equal(code, 2);
  assert.match(out, /agent never produced output|did not run/);
});

// The real-repo scenario copies a shipped ADR into a throwaway fixture. If it
// copies the ADR but not what the ADR LINKS to, every outbound link reads as
// broken and the reviewer spends R10 findings on the fixture's own trimming.
// The first pixelbank run did exactly that: it reported ../../FREE_USAGE.md as
// missing when the file exists. A fixture that manufactures findings is worse
// than a noisy one — it teaches the reader to discount that rule.
test("the real-repo fixture resolves the ADR's own local links", async (t) => {
  const scenario = await loadScenario("review-real-repo-adr.mjs");

  // Build a miniature "real repo": an ADR that links to a sibling and to a doc
  // outside docs/adr/, plus a link that is genuinely absent.
  const repo = mkdtempSync(path.join(tmpdir(), "adr-eval-fakerepo-"));
  const w = (rel, body) => {
    const full = path.join(repo, rel);
    require$mkdir(path.dirname(full));
    writeFileSync(full, body);
  };
  w("docs/adr/README.md", "# ADR\n");
  w("docs/adr/.mapping.json", JSON.stringify({ categories: {} }));
  w("docs/FREE_USAGE.md", "# free usage\n");
  w("docs/adr/token/0001-billing.md", "# ADR 0001: billing\n\n## Status\n\nProposed\n");
  w(
    "docs/adr/token/0002-free-trial.md",
    `# ADR 0002: free trial\n\nDate: 2026-01-01\n\n## Status\n\nProposed\n\n## Context\n\nc\n\n## Decision\n\nd\n\n## Consequences\n\nok\n\n## Related\n\n- [0001](./0001-billing.md)\n- [FREE_USAGE.md](../../FREE_USAGE.md)\n- [gone](../../NOPE.md)\n- [external](https://example.com/x.md)\n`,
  );

  // The scenario reads its target from the environment, so drive it that way.
  const prev = { repo: process.env.ADR_EVAL_REPO, adr: process.env.ADR_EVAL_ADR };
  process.env.ADR_EVAL_REPO = repo;
  process.env.ADR_EVAL_ADR = "docs/adr/token/0002-free-trial.md";
  t.after(() => {
    if (prev.repo === undefined) delete process.env.ADR_EVAL_REPO;
    else process.env.ADR_EVAL_REPO = prev.repo;
    if (prev.adr === undefined) delete process.env.ADR_EVAL_ADR;
    else process.env.ADR_EVAL_ADR = prev.adr;
  });

  // Re-import with a cache-busting query so the module re-reads the env.
  const fresh = (
    await import(
      `${path.join(EVALS, "scenarios", "review-real-repo-adr.mjs")}?repo=${encodeURIComponent(repo)}`
    )
  ).default;
  const dir = mkdtempSync(path.join(tmpdir(), "adr-eval-real-"));
  await fresh.build(dir);

  const exists = (rel) => existsSync(path.join(dir, rel));
  assert.ok(exists("docs/adr/token/0002-free-trial.md"), "the ADR itself must be copied");
  assert.ok(exists("docs/adr/token/0001-billing.md"), "a sibling ADR link must resolve");
  assert.ok(exists("docs/FREE_USAGE.md"), "a link outside docs/adr/ must resolve");
  // A link with no target stays absent — that is a real finding, not an artifact.
  assert.ok(!exists("NOPE.md"), "a genuinely missing target must stay missing");
  // The real repo is read-only from here.
  assert.ok(
    !existsSync(path.join(repo, "docs", "adr", "concepts.md")),
    "must not write to the source repo",
  );
  assert.equal(scenario.name, "review-real-repo-adr");
});

function require$mkdir(dir) {
  mkdirSync(dir, { recursive: true });
}
