import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPORT = path.join(HERE, "../scripts/adr-impl-review-report.mjs");

function render(data) {
  return spawnSync(process.execPath, [REPORT, "-", "--stdout"], {
    input: JSON.stringify(data),
    encoding: "utf8",
  });
}

test("inline findings JSON cannot terminate the report script element", () => {
  const payload = "</script><script>globalThis.__injected = true</script>";
  const result = render({
    adr: payload,
    verdict: "PASS",
    findings: [{ id: "f1", category: "Refactor", summary: payload }],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /<\/script><script>globalThis\.__injected/);
  assert.match(result.stdout, /\\u003c\/script\\u003e\\u003cscript\\u003e/);
  assert.equal((result.stdout.match(/<script>/g) ?? []).length, 1);
});

test("arbitrary finding IDs are not interpolated into DOM selectors", () => {
  const hostileId = 'x"] :checked, script[data-x="';
  const result = render({
    adr: "docs/adr/test.md",
    verdict: "FIX_REQUIRED",
    findings: [{ id: hostileId, category: "Test gap", summary: "coverage" }],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /name="dec-0"/);
  assert.match(result.stdout, /data-finding-index="0"/);
  assert.equal(result.stdout.includes(`name="dec-${hostileId}`), false);
});

test("necessity and sufficiency evidence survives into the interactive report", () => {
  const result = render({
    adr: "docs/adr/streaming/0001-cancel.md",
    verdict: "FIX_REQUIRED",
    atAGlance: {
      impact: "A cancelled request may continue consuming upstream resources.",
      action: "Remove the unnecessary event bus and verify restart recovery.",
      risk: "Restart recovery was not exercised locally.",
    },
    explanation: "/tmp/review/explanation.md",
    report: "/tmp/review/implementation-review.md",
    metrics: {
      elapsedSeconds: 42,
      necessityFindingCount: 1,
      sufficiencyFindingCount: 1,
      unverifiedRiskCount: 1,
      testCommandCount: 1,
    },
    implementationChoices: [
      {
        choice: "retry uses a 250 ms fixed delay",
        evidence: "src/stream/client.ts:20 — retryDelayMs: 250",
        intentFit: "keeps retries bounded without changing the ADR's failure result",
        whyItMatters: "changes recovery latency and request rate",
      },
    ],
    contractCoverage: [
      {
        contractId: "D0",
        requirement: "Cancellation stops the upstream request",
        status: "PROVEN",
        adrBasis: "Requirement contract — Required guarantees",
        implementation: "the abort signal reaches the upstream client",
        evidence: "src/stream/client.ts:18 — signal passed to fetch",
        tests: "pnpm test -- cancel — PASS",
      },
      {
        contractId: "R1",
        requirement: "Restart recovery preserves queued work",
        status: "UNVERIFIED",
        adrBasis: "Requirement contract — Failure guarantees",
        implementation: "queue recovery exists but was not executed locally",
        evidence: "src/stream/queue.ts:44 — recovery branch",
        tests: "NOT RUN — no local queue",
      },
    ],
    findings: [
      {
        id: "n1",
        category: "Unnecessary change",
        perspective: "necessity",
        summary: "event bus is removable",
        evidence: "the existing abort signal reaches the upstream client",
        test: "pnpm test -- cancel",
        testResult: "PASS",
        confidence: "high",
      },
      {
        id: "s1",
        category: "Unverified risk",
        perspective: "sufficiency",
        summary: "restart recovery was not exercised",
        testResult: "NOT RUN: no local queue",
        confidence: "low",
      },
    ],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /Unnecessary change/);
  assert.match(result.stdout, /Unverified risk/);
  assert.match(result.stdout, /At a glance/);
  assert.match(result.stdout, /A cancelled request may continue consuming upstream resources/);
  assert.match(result.stdout, /Remove the unnecessary event bus/);
  assert.match(result.stdout, /Restart recovery was not exercised locally/);
  assert.match(result.stdout, /the existing abort signal reaches the upstream client/);
  assert.match(result.stdout, /pnpm test -- cancel/);
  assert.match(result.stdout, /implementation-review\.md/);
  assert.match(result.stdout, /explanation\.md/);
  assert.match(result.stdout, /Review metrics/);
  assert.match(result.stdout, /42s/);
  assert.match(result.stdout, /retry uses a 250 ms fixed delay/);
  assert.match(result.stdout, /src\/stream\/client\.ts:20/);
  assert.match(result.stdout, /keeps retries bounded without changing the ADR/);
  assert.match(result.stdout, /changes recovery latency and request rate/);
  assert.match(result.stdout, /Cancellation stops the upstream request/);
  assert.match(result.stdout, /Restart recovery preserves queued work/);
  assert.match(result.stdout, /D0 · PROVEN/);
  assert.match(result.stdout, /R1 · UNVERIFIED/);
  assert.match(result.stdout, /1 \/ 2 proven/);
  assert.match(result.stdout, /How the implementation meets it/);
  assert.match(result.stdout, /Review report/);
  assert.ok(
    result.stdout.indexOf("ADR contract coverage ·") <
      result.stdout.indexOf("notable implementation choice(s) ·"),
    "contract coverage must appear before implementation choices",
  );
  assert.ok(
    result.stdout.indexOf("ADR contract coverage ·") < result.stdout.indexOf("finding(s) ·"),
    "contract coverage must appear before findings",
  );
  assert.doesNotMatch(result.stdout, /Repair guide ·/);
  assert.doesNotMatch(result.stdout, /Review this implementation choice/);
  assert.doesNotMatch(result.stdout, /choice_reviews/);
});

test("notable implementation choice content is escaped and read-only", () => {
  const payload = "</script><script>globalThis.__choiceInjected = true</script>";
  const result = render({
    adr: "docs/adr/test.md",
    verdict: "PASS",
    findings: [],
    contractCoverage: [
      {
        contractId: "D0",
        requirement: "The response remains backward compatible",
        status: "PROVEN",
        adrBasis: "Decision",
        implementation: "the public response shape is unchanged",
        evidence: "src/example.ts:1",
        tests: "node --test — PASS",
      },
    ],
    implementationChoices: [
      {
        choice: payload,
        evidence: "src/example.ts:1",
        intentFit: "preserves the ADR contract",
        whyItMatters: "different local convention",
      },
    ],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /<\/script><script>globalThis\.__choiceInjected/);
  assert.match(result.stdout, /src\/example\.ts:1/);
  assert.match(result.stdout, /different local convention/);
  assert.doesNotMatch(result.stdout, /name="choice-dec-/);
  assert.doesNotMatch(result.stdout, /data-choice-index=/);
});

test("At a glance content is escaped in HTML and embedded feedback data", () => {
  const payload = "</script><script>globalThis.__overviewInjected = true</script>";
  const result = render({
    adr: "docs/adr/test.md",
    verdict: "PASS",
    atAGlance: {
      impact: payload,
      action: "None.",
      risk: "None.",
    },
    findings: [],
    contractCoverage: [],
    implementationChoices: [],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /<\/script><script>globalThis\.__overviewInjected/);
  assert.match(result.stdout, /\\u003c\/script\\u003e\\u003cscript\\u003e/);
  assert.equal((result.stdout.match(/<script>/g) ?? []).length, 1);
});

test("INCONCLUSIVE with no findings does not render a false conforming claim", () => {
  const result = render({
    adr: "docs/adr/streaming/0001-cancel.md",
    verdict: "INCONCLUSIVE",
    findings: [],
    contractCoverage: [
      {
        contractId: "D0",
        requirement: "Cancellation survives process restart",
        status: "UNVERIFIED",
        adrBasis: "Failure guarantees",
        implementation: "cannot determine",
        evidence: "queue unavailable",
        tests: "NOT RUN — no local queue",
      },
    ],
    implementationChoices: [],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /INCONCLUSIVE/);
  assert.match(result.stdout, /the review did not complete/);
  assert.doesNotMatch(result.stdout, /No unnecessary changes or counterexamples were confirmed/);
});
