#!/usr/bin/env node

import { statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Resolve a rendered review report to the exact path shown to the user.
 * Missing or empty reports remain invalid, and this helper never launches a host application.
 */
export function resolveReviewReportPath(reportPath) {
  const absolutePath = path.resolve(reportPath);
  try {
    const stat = statSync(absolutePath);
    if (!stat.isFile() || stat.size === 0) {
      return {
        validArtifact: false,
        path: absolutePath,
        reason: "the report is missing or empty",
      };
    }
  } catch (error) {
    return {
      validArtifact: false,
      path: absolutePath,
      reason: error.message,
    };
  }

  return { validArtifact: true, path: absolutePath, reason: "" };
}

function usage(message) {
  if (message) process.stderr.write(`adr-impl-review-path: ${message}\n`);
  process.stderr.write("Usage: node adr-impl-review-path.mjs <report.html>\n");
  process.exitCode = 2;
}

/**
 * Validate one report and print only its absolute path for the completion response.
 * A missing or empty report fails the command without invoking any external process.
 */
function main() {
  const reportPath = process.argv[2];
  if (!reportPath) {
    usage("report path is required");
    return;
  }

  const result = resolveReviewReportPath(reportPath);
  if (result.validArtifact) {
    process.stdout.write(`${result.path}\n`);
    return;
  }

  process.stderr.write(`adr-impl-review-path: ${result.reason}\n`);
  process.exitCode = 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) main();
