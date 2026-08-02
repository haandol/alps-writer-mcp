#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { CATEGORY_NAMES, VERDICT_NAMES } from "./adr-impl-review-categories.mjs";

// The category and verdict vocabularies come from the shared table the HTML
// renderer draws from, so a findings.json this validator accepts is always one
// the report can render (and rank) — the two lists used to be separate copies.
const ALLOWED_VERDICTS = VERDICT_NAMES;
const ALLOWED_CATEGORIES = CATEGORY_NAMES;
const ALLOWED_PERSPECTIVES = new Set(["necessity", "sufficiency", "both"]);
const ALLOWED_CONFIDENCE = new Set(["high", "medium", "low"]);
const REQUIRED_REPORT_TEXT = [
  "# ADR implementation review and repair guide",
  "## 1. Verdict summary",
  "## 2. What to know first",
  "## 3. Order to read the code",
  "## 4. Map of the current implementation",
  "## 5. Runtime flow",
  "## 6. State, data, and failure model",
  "## 7. Findings",
  "## 8. Fix execution order",
  "## 9. Verification checklist",
  "## 10. Merge decision checklist",
  "## 11. Review limits and questions",
];
const REQUIRED_FINDING_TEXT = [
  "Files and symbols to change:",
  "Scope not to touch:",
  "Completion criteria:",
  "Needs confirmation:",
];
// The merge-fitness axes under "## 10". Checking the heading alone let a writer
// ship a table with an axis quietly missing — and the one most likely to be
// dropped is "Contract compliance" (requirement-value conformance), because a
// report that found no bug reads as complete without it.
const REQUIRED_MERGE_AXES = [
  "Problem fitness",
  "Functional adequacy",
  "Contract compliance",
  "Change minimality",
  "Verification strength",
  "Operational safety",
  "Maintainability",
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

function validateReport(report, findingCount, errors) {
  for (const text of REQUIRED_REPORT_TEXT) {
    if (!report.includes(text)) errors.push(`implementation-review.md missing: ${text}`);
  }

  const mermaidBlocks = [...report.matchAll(/^```mermaid\s*\n([\s\S]*?)^```/gm)].map(
    (match) => match[1],
  );
  if (mermaidBlocks.length < 2) {
    errors.push("implementation-review.md must contain at least two Mermaid diagrams");
  }
  if (!mermaidBlocks.some((block) => /^\s*flowchart\b/m.test(block))) {
    errors.push("implementation-review.md missing a Mermaid flowchart");
  }
  if (!mermaidBlocks.some((block) => /^\s*sequenceDiagram\b/m.test(block))) {
    errors.push("implementation-review.md missing a Mermaid sequenceDiagram");
  }

  for (const axis of REQUIRED_MERGE_AXES) {
    if (!report.includes(axis))
      errors.push(`implementation-review.md merge-fitness checklist missing axis: ${axis}`);
  }

  if (findingCount > 0) {
    const findingSections = report.match(/^### F\d+\.\s+/gm) ?? [];
    if (findingSections.length < findingCount) {
      errors.push(
        `implementation-review.md has ${findingSections.length} finding sections for ${findingCount} findings`,
      );
    }
    for (const text of REQUIRED_FINDING_TEXT) {
      if (!report.includes(text)) errors.push(`implementation-review.md missing: ${text}`);
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

  if (!existsSync(findingsPath)) {
    errors.push("missing findings.json");
  }
  if (!existsSync(expectedReport)) {
    errors.push("missing implementation-review.md");
  }
  if (errors.length) {
    process.stderr.write(`${errors.join("\n")}\n`);
    process.exit(1);
  }

  const data = readJson(findingsPath, errors);
  if (data) {
    if (typeof data.adr !== "string" || !data.adr.trim()) errors.push("findings.json missing adr");
    if (!ALLOWED_VERDICTS.has(data.verdict)) {
      errors.push(`findings.json verdict is invalid: ${data.verdict ?? "(missing)"}`);
    }
    if (!Array.isArray(data.findings)) {
      errors.push("findings.json findings must be an array");
    } else {
      data.findings.forEach((finding, index) => validateFinding(finding, index, errors));
    }

    const reportPath = resolveArtifact(artifactDir, data.report);
    if (!reportPath || path.resolve(reportPath) !== path.resolve(expectedReport)) {
      errors.push("findings.json report must point to implementation-review.md");
    }
    const explanationPath = resolveArtifact(artifactDir, data.explanation);
    if (!explanationPath || !existsSync(explanationPath)) {
      errors.push("findings.json explanation must point to an existing file");
    }

    if (existsSync(expectedReport)) {
      validateReport(
        readFileSync(expectedReport, "utf8"),
        Array.isArray(data.findings) ? data.findings.length : 0,
        errors,
      );
    }
  }

  if (errors.length) {
    process.stderr.write(`${errors.map((error) => `- ${error}`).join("\n")}\n`);
    process.exit(1);
  }

  process.stdout.write("ADR implementation review artifacts are valid\n");
}

main();
