#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { CATEGORY_NAMES, VERDICT_NAMES } from "./adr-impl-review-categories.mjs";

const ALLOWED_VERDICTS = VERDICT_NAMES;
const ALLOWED_CATEGORIES = CATEGORY_NAMES;
const ALLOWED_MODES = new Set(["standard", "full"]);
const ALLOWED_PERSPECTIVES = new Set(["necessity", "sufficiency", "both"]);
const ALLOWED_CONFIDENCE = new Set(["high", "medium", "low"]);
const ALLOWED_COVERAGE_STATUSES = new Set(["PROVEN", "VIOLATED", "UNVERIFIED", "CONTRADICTED"]);
const REQUIRED_REPORT_TEXT = [
  "# ADR implementation review",
  "## Review mode",
  "## Scope",
  "## ADR contract coverage",
  "## Notable implementation choices",
  "## Findings",
  "## Tests",
  "## Residual risks",
];
const REQUIRED_REPAIR_TEXT = [
  "## Repair guide",
  "Files and symbols to change:",
  "Scope not to touch:",
  "Completion criteria:",
  "Needs confirmation:",
];

function usage(message) {
  if (message) process.stderr.write(`adr-impl-review-validate: ${message}\n`);
  process.stderr.write("Usage: node adr-impl-review-validate.mjs <artifact-dir>\n");
  process.exit(2);
}

function readJson(file, errors) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`${path.basename(file)} is not valid JSON: ${error.message}`);
    return null;
  }
}

function resolveArtifact(baseDir, value) {
  if (!value || typeof value !== "string") return null;
  return path.isAbsolute(value) ? value : path.resolve(baseDir, value);
}

function validateFinding(finding, index, errors) {
  const label = `findings[${index}]`;
  if (!finding || typeof finding !== "object" || Array.isArray(finding)) {
    errors.push(`${label} must be an object`);
    return;
  }

  for (const field of [
    "category",
    "perspective",
    "summary",
    "confidence",
    "code",
    "evidence",
    "test",
    "testResult",
  ]) {
    if (typeof finding[field] !== "string" || !finding[field].trim()) {
      errors.push(`${label}.${field} must be a non-empty string`);
    }
  }

  if (finding.category && !ALLOWED_CATEGORIES.has(finding.category)) {
    errors.push(`${label}.category is not recognized: ${finding.category}`);
  }
  if (finding.perspective && !ALLOWED_PERSPECTIVES.has(finding.perspective)) {
    errors.push(`${label}.perspective must be necessity, sufficiency, or both`);
  }
  if (finding.confidence && !ALLOWED_CONFIDENCE.has(finding.confidence)) {
    errors.push(`${label}.confidence must be high, medium, or low`);
  }
}

function validateImplementationChoice(choice, index, errors) {
  const label = `implementationChoices[${index}]`;
  if (!choice || typeof choice !== "object" || Array.isArray(choice)) {
    errors.push(`${label} must be an object`);
    return;
  }

  for (const field of ["choice", "evidence", "intentFit", "whyItMatters"]) {
    if (typeof choice[field] !== "string" || !choice[field].trim()) {
      errors.push(`${label}.${field} must be a non-empty string`);
    }
  }
}

function validateContractCoverage(row, index, errors) {
  const label = `contractCoverage[${index}]`;
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    errors.push(`${label} must be an object`);
    return;
  }

  for (const field of [
    "requirement",
    "status",
    "adrBasis",
    "implementation",
    "evidence",
    "tests",
  ]) {
    if (typeof row[field] !== "string" || !row[field].trim()) {
      errors.push(`${label}.${field} must be a non-empty string`);
    }
  }

  if (row.status && !ALLOWED_COVERAGE_STATUSES.has(row.status)) {
    errors.push(`${label}.status must be PROVEN, VIOLATED, UNVERIFIED, or CONTRADICTED`);
  }
}

function validateMetrics(metrics, findings, errors) {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
    errors.push("findings.json metrics must be an object");
    return;
  }

  for (const field of ["startedAt", "completedAt"]) {
    if (typeof metrics[field] !== "string" || !metrics[field].trim()) {
      errors.push(`findings.json metrics.${field} must be a non-empty string`);
    } else if (Number.isNaN(Date.parse(metrics[field]))) {
      errors.push(`findings.json metrics.${field} must be an ISO date-time`);
    }
  }

  for (const field of [
    "elapsedSeconds",
    "necessityFindingCount",
    "sufficiencyFindingCount",
    "unverifiedRiskCount",
    "testCommandCount",
  ]) {
    if (!Number.isInteger(metrics[field]) || metrics[field] < 0) {
      errors.push(`findings.json metrics.${field} must be a non-negative integer`);
    }
  }

  const unverifiedRiskCount = findings.filter(
    (finding) => finding?.category === "Unverified risk",
  ).length;
  if (
    Number.isInteger(metrics.unverifiedRiskCount) &&
    metrics.unverifiedRiskCount !== unverifiedRiskCount
  ) {
    errors.push(
      `findings.json metrics.unverifiedRiskCount is ${metrics.unverifiedRiskCount}, expected ${unverifiedRiskCount}`,
    );
  }
}

function validateReport(report, data, errors) {
  for (const text of REQUIRED_REPORT_TEXT) {
    if (!report.includes(text)) errors.push(`implementation-review.md missing: ${text}`);
  }

  for (const [index, row] of (data.contractCoverage ?? []).entries()) {
    if (!report.includes(row.requirement)) {
      errors.push(`implementation-review.md missing contractCoverage[${index}].requirement text`);
    }
    if (!report.includes(row.status)) {
      errors.push(`implementation-review.md missing contractCoverage[${index}].status`);
    }
  }

  if (["FIX_REQUIRED", "BLOCK"].includes(data.verdict)) {
    for (const text of REQUIRED_REPAIR_TEXT) {
      if (!report.includes(text)) errors.push(`implementation-review.md missing: ${text}`);
    }
    const findingSections = report.match(/^### F\d+\.\s+/gm) ?? [];
    if (findingSections.length < data.findings.length) {
      errors.push(
        `implementation-review.md has ${findingSections.length} finding sections for ${data.findings.length} findings`,
      );
    }
  }
}

function main() {
  const artifactDirArg = process.argv[2];
  if (!artifactDirArg || process.argv.length !== 3) usage();

  const artifactDir = path.resolve(artifactDirArg);
  const findingsPath = path.join(artifactDir, "findings.json");
  const expectedReport = path.join(artifactDir, "implementation-review.md");
  const errors = [];

  if (!existsSync(findingsPath)) errors.push("missing findings.json");
  if (!existsSync(expectedReport)) errors.push("missing implementation-review.md");
  if (errors.length) {
    process.stderr.write(`${errors.join("\n")}\n`);
    process.exit(1);
  }

  const data = readJson(findingsPath, errors);
  if (data) {
    if (!ALLOWED_MODES.has(data.reviewMode)) {
      errors.push("findings.json reviewMode must be standard or full");
    }
    if (typeof data.adr !== "string" || !data.adr.trim()) errors.push("findings.json missing adr");
    if (!ALLOWED_VERDICTS.has(data.verdict)) {
      errors.push(`findings.json verdict is invalid: ${data.verdict ?? "(missing)"}`);
    }

    if (!Array.isArray(data.findings)) {
      errors.push("findings.json findings must be an array");
    } else {
      data.findings.forEach((finding, index) => validateFinding(finding, index, errors));
      validateMetrics(data.metrics, data.findings, errors);
      if (
        data.reviewMode === "standard" &&
        Number.isInteger(data.metrics?.necessityFindingCount) &&
        data.metrics.necessityFindingCount !== 0
      ) {
        errors.push("standard review metrics.necessityFindingCount must be 0");
      }
      if (
        data.reviewMode === "standard" &&
        data.findings.some((finding) => ["necessity", "both"].includes(finding?.perspective))
      ) {
        errors.push("standard review findings must use the sufficiency perspective");
      }
    }

    if (!Array.isArray(data.implementationChoices)) {
      errors.push("findings.json implementationChoices must be an array");
    } else {
      data.implementationChoices.forEach((choice, index) =>
        validateImplementationChoice(choice, index, errors),
      );
    }

    if (!Array.isArray(data.contractCoverage) || data.contractCoverage.length === 0) {
      errors.push("findings.json contractCoverage must be a non-empty array");
    } else {
      data.contractCoverage.forEach((row, index) => validateContractCoverage(row, index, errors));
      if (
        data.verdict === "PASS" &&
        data.contractCoverage.some((row) => row?.status !== "PROVEN")
      ) {
        errors.push("PASS requires every contractCoverage row to be PROVEN");
      }
    }

    const reportPath = resolveArtifact(artifactDir, data.report);
    if (!reportPath || path.resolve(reportPath) !== path.resolve(expectedReport)) {
      errors.push("findings.json report must point to implementation-review.md");
    }
    if (data.reviewMode === "full") {
      const explanationPath = resolveArtifact(artifactDir, data.explanation);
      if (!explanationPath || !existsSync(explanationPath)) {
        errors.push("full review explanation must point to an existing file");
      }
    }

    if (existsSync(expectedReport)) {
      validateReport(readFileSync(expectedReport, "utf8"), data, errors);
    }
  }

  if (errors.length) {
    process.stderr.write(`${errors.map((error) => `- ${error}`).join("\n")}\n`);
    process.exit(1);
  }

  process.stdout.write("ADR implementation review artifacts are valid\n");
}

main();
