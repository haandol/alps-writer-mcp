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
import { readdirSync, writeFileSync, chmodSync, mkdtempSync, mkdirSync, existsSync } from "node:fs";
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
    timeout: 120_000,
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
  assert.match(out, /refactor-safe-local-duplicate/);
  assert.match(out, /refactor-protected-state-transition/);
  assert.match(out, /refactor-no-subagent-proposal-only/);
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
    assert.match(prompt, /abstraction ladder|requirement gate|Regeneration|decision ledger/i);
    // and the machine-readable tail the scorer depends on
    assert.match(prompt, /EVAL-VERDICT/);
    assert.match(prompt, /EVAL-FINDINGS/);
  }
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
