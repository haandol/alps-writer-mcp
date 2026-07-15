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
