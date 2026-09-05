import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveReviewReportPath } from "../scripts/adr-impl-review-path.mjs";

function withReport(run) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "adr-review-path-"));
  const report = path.join(dir, "adr-impl-review-report.html");
  try {
    writeFileSync(report, "<!doctype html><title>Review</title>");
    run(report);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("a valid report resolves to its exact absolute path", () => {
  withReport((report) => {
    const result = resolveReviewReportPath(report);

    assert.equal(result.validArtifact, true);
    assert.equal(result.path, path.resolve(report));
    assert.equal(result.reason, "");
  });
});

test("the CLI prints only the exact absolute path", () => {
  withReport((report) => {
    const script = fileURLToPath(new URL("../scripts/adr-impl-review-path.mjs", import.meta.url));
    const result = spawnSync(process.execPath, [script, report], { encoding: "utf8" });

    assert.equal(result.status, 0);
    assert.equal(result.stdout, `${path.resolve(report)}\n`);
    assert.equal(result.stderr, "");
  });
});

test("path reporting has no host opener dependency", () => {
  const source = readFileSync(
    new URL("../scripts/adr-impl-review-path.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /node:child_process|spawnSync|xdg-open|cmd\.exe/);
});

test("a missing report is rejected", () => {
  const result = resolveReviewReportPath("/tmp/adr-review-report-that-does-not-exist.html");

  assert.equal(result.validArtifact, false);
  assert.equal(result.path, "/tmp/adr-review-report-that-does-not-exist.html");
  assert.ok(result.reason);
});

test("an empty report is rejected", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "adr-review-path-empty-"));
  const report = path.join(dir, "adr-impl-review-report.html");
  writeFileSync(report, "");
  try {
    const result = resolveReviewReportPath(report);

    assert.equal(result.validArtifact, false);
    assert.match(result.reason, /missing or empty/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
