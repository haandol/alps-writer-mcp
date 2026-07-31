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
import { readdirSync, writeFileSync, chmodSync, mkdtempSync } from "node:fs";
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
});

// The prompt has to carry the SHIPPED instruction text. If a scenario ever
// paraphrased the rules instead, the eval would measure the paraphrase — the one
// failure mode that makes the whole directory misleading.
test("prompts embed the real skill/agent text, not a paraphrase", async () => {
  for (const file of scenarioFiles()) {
    const s = await loadScenario(file);
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
    // ADR yet, which is the point of the scenario.
    if (s.name.startsWith("author-")) continue;
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
