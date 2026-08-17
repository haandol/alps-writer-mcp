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
const PASS_ADVISORY_CATEGORIES = new Set(["Refactor"]);

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

function stripFencedBlocks(source) {
  return source.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1\s*$/gm, "");
}

function sectionBody(source, headingPattern, stopPattern) {
  const lines = stripFencedBlocks(source).split(/\r?\n/);
  const start = lines.findIndex((line) => headingPattern.test(line));
  if (start < 0) return "";
  const body = [];
  for (let index = start + 1; index < lines.length; index++) {
    if (stopPattern.test(lines[index])) break;
    body.push(lines[index]);
  }
  return body.join("\n").trim();
}

function topLevelBullets(source) {
  const bullets = [];
  let current = null;
  for (const line of source.split(/\r?\n/)) {
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (current) bullets.push(current);
      current = bullet[1].trim();
      continue;
    }
    if (current && /^\s{2,}\S/.test(line)) {
      current += ` ${line.trim()}`;
      continue;
    }
    if (current && line.trim()) {
      bullets.push(current);
      current = null;
    }
  }
  if (current) bullets.push(current);
  return bullets;
}

function resolveAdrPath(artifactDir, value) {
  if (!value || typeof value !== "string") return null;
  if (path.isAbsolute(value)) return value;
  const cwdPath = path.resolve(process.cwd(), value);
  if (existsSync(cwdPath)) return cwdPath;
  return path.resolve(artifactDir, value);
}

function expectedContractRows(artifactDir, adrValue, errors) {
  const adrPath = resolveAdrPath(artifactDir, adrValue);
  if (!adrPath || !existsSync(adrPath)) {
    errors.push(
      `findings.json adr does not resolve to an existing file: ${adrValue ?? "(missing)"}`,
    );
    return [];
  }

  const source = readFileSync(adrPath, "utf8");
  const decision = sectionBody(source, /^## Decision\s*$/i, /^##\s+/);
  const decisionCore = decision.split(/^###\s+/m)[0].trim();
  if (!decisionCore) {
    errors.push("ADR Decision section must contain reviewable text");
    return [];
  }

  const requirementContract = sectionBody(
    source,
    /^### Requirement contract\s*$/i,
    /^### (?!#)|^##\s+/,
  );
  return [
    { contractId: "D0", adrBasis: "Decision" },
    ...topLevelBullets(requirementContract).map((adrBasis, index) => ({
      contractId: `R${index + 1}`,
      adrBasis,
    })),
  ];
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
    "contractId",
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

function validateContractCompleteness(rows, expectedRows, errors) {
  const expected = new Map(expectedRows.map((row) => [row.contractId, row]));
  const seen = new Set();

  for (const [index, row] of rows.entries()) {
    if (!row || typeof row !== "object") continue;
    const contractId = row.contractId;
    if (seen.has(contractId)) {
      errors.push(`contractCoverage contains duplicate contractId: ${contractId}`);
      continue;
    }
    seen.add(contractId);

    const expectedRow = expected.get(contractId);
    if (!expectedRow) {
      errors.push(`contractCoverage[${index}].contractId is not present in the ADR: ${contractId}`);
      continue;
    }
    if (row.adrBasis !== expectedRow.adrBasis) {
      errors.push(
        `contractCoverage[${index}].adrBasis must exactly match ${contractId}'s ADR source row`,
      );
    }
  }

  for (const contractId of expected.keys()) {
    if (!seen.has(contractId)) {
      errors.push(`contractCoverage is missing ADR contract row: ${contractId}`);
    }
  }
}

function validatePass(data, errors) {
  if (data.verdict !== "PASS") return;

  if (data.contractCoverage.some((row) => row?.status !== "PROVEN")) {
    errors.push("PASS requires every contractCoverage row to be PROVEN");
  }
  if (
    data.contractCoverage.some((row) =>
      /\b(?:NOT RUN|FAIL(?:ED)?)\b|미실행|실행하지 못/i.test(row?.tests ?? ""),
    )
  ) {
    errors.push("PASS contractCoverage tests must not contain failed or unexecuted results");
  }
  if (!Number.isInteger(data.metrics?.testCommandCount) || data.metrics.testCommandCount < 1) {
    errors.push("PASS requires at least one executed test or reproduction command");
  }
  if (data.metrics?.unverifiedRiskCount > 0) {
    errors.push("PASS cannot contain an Unverified risk");
  }

  const blocking = data.findings.filter(
    (finding) =>
      finding &&
      !PASS_ADVISORY_CATEGORIES.has(finding.category) &&
      !(finding.category === "Best practice" && finding.weight === "next-cycle"),
  );
  if (blocking.length > 0) {
    errors.push(`PASS cannot contain unresolved blocking findings: ${blocking.length}`);
  }
}

function tableRows(report, heading, nextHeading) {
  const section = sectionBody(
    report,
    new RegExp(`^## ${heading}\\s*$`, "i"),
    new RegExp(`^## ${nextHeading}\\s*$`, "i"),
  );
  const rows = section
    .split(/\r?\n/)
    .filter((line) => /^\s*\|.*\|\s*$/.test(line))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim().replace(/^`([^`]*)`$/, "$1")),
    );
  const separator = rows.findIndex(
    (cells) => cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell)),
  );
  return separator >= 0 ? rows.slice(separator + 1) : [];
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

  const coverageRows = tableRows(report, "ADR contract coverage", "Notable implementation choices");
  const coverageById = new Map(coverageRows.map((cells) => [cells[0], cells]));
  for (const [index, row] of (data.contractCoverage ?? []).entries()) {
    const cells = coverageById.get(row.contractId);
    if (!cells) {
      errors.push(`implementation-review.md missing contractCoverage[${index}] table row`);
    } else if (cells.length < 7 || cells.some((cell) => !cell)) {
      errors.push(
        `implementation-review.md contractCoverage[${index}] must have seven non-empty columns`,
      );
    } else if (cells[2] !== row.status) {
      errors.push(`implementation-review.md contractCoverage[${index}] status does not match JSON`);
    }
  }

  const choiceRows = tableRows(report, "Notable implementation choices", "Findings");
  if (choiceRows.length < (data.implementationChoices ?? []).length) {
    errors.push(
      `implementation-review.md has ${choiceRows.length} complete implementation-choice rows for ${data.implementationChoices.length} choices`,
    );
  }
  for (const [index, cells] of choiceRows.entries()) {
    if (cells.length < 4 || cells.some((cell) => !cell)) {
      errors.push(
        `implementation-review.md implementationChoices[${index}] must have four non-empty columns`,
      );
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
      validateContractCompleteness(
        data.contractCoverage,
        expectedContractRows(artifactDir, data.adr, errors),
        errors,
      );
      validatePass(data, errors);
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
