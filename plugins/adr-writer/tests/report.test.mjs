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
        kind: "implementation-default",
        topic: "retry delay",
        selectedValue: "250 ms fixed delay",
        basis: "matches the existing stream client",
        evidence: "src/stream/client.ts:20 — retryDelayMs: 250",
        impactIfChanged: "changes recovery latency and request rate",
        confidence: "high",
        alternatives: "exponential backoff; no retry",
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
  assert.match(result.stdout, /the existing abort signal reaches the upstream client/);
  assert.match(result.stdout, /pnpm test -- cancel/);
  assert.match(result.stdout, /implementation-review\.md/);
  assert.match(result.stdout, /explanation\.md/);
  assert.match(result.stdout, /Review metrics/);
  assert.match(result.stdout, /42s/);
  assert.match(result.stdout, /retry delay/);
  assert.match(result.stdout, /250 ms fixed delay/);
  assert.match(result.stdout, /request change/);
  assert.match(result.stdout, /investigate/);
  assert.match(result.stdout, /choice_reviews/);
});

test("implementation choice content is escaped and uses stable DOM indexes", () => {
  const payload = "</script><script>globalThis.__choiceInjected = true</script>";
  const result = render({
    adr: "docs/adr/test.md",
    verdict: "PASS",
    findings: [],
    implementationChoices: [
      {
        id: 'x"] script[',
        kind: "project-convention",
        topic: payload,
        selectedValue: payload,
        basis: "AGENTS.md",
        evidence: "src/example.ts:1",
        impactIfChanged: "different local convention",
        confidence: "medium",
        alternatives: "another convention",
      },
    ],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /<\/script><script>globalThis\.__choiceInjected/);
  assert.match(result.stdout, /name="choice-dec-0"/);
  assert.match(result.stdout, /data-choice-index="0"/);
  assert.match(
    result.stdout,
    /name="choice-dec-0" value="investigate" checked/,
    "medium-confidence choices should default to investigate",
  );
  assert.doesNotMatch(
    result.stdout,
    /name="choice-dec-0" value="accept" checked/,
    "uncertain choices must not be pre-accepted",
  );
  assert.equal(result.stdout.includes('name="choice-dec-x"]'), false);
});

test("INCONCLUSIVE with no findings does not render a false conforming claim", () => {
  const result = render({
    adr: "docs/adr/streaming/0001-cancel.md",
    verdict: "INCONCLUSIVE",
    findings: [],
    implementationChoices: [],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /INCONCLUSIVE/);
  assert.match(result.stdout, /the review did not complete/);
  assert.doesNotMatch(result.stdout, /No unnecessary changes or counterexamples were confirmed/);
});
