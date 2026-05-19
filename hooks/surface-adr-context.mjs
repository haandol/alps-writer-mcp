#!/usr/bin/env node
// UserPromptSubmit — when the user mentions a feature/category by name or asks
// to change requirements, inject related ADR paths as additional context so
// the model considers them before editing code.

import path from "node:path";
import { readFileSync, existsSync } from "node:fs";

const MAPPING_PATH = process.env.ALPS_ADR_MAPPING || "docs/adr/.mapping.json";

function readStdinSync() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function loadJSON(p) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function main() {
  const raw = readStdinSync();
  if (!raw) process.exit(0);
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const prompt = (event.prompt || event.userPrompt || "").toLowerCase();
  if (!prompt) process.exit(0);

  const cwd = event.cwd || process.cwd();
  const mapping = loadJSON(path.join(cwd, MAPPING_PATH));
  if (!mapping?.categories) process.exit(0);

  const matches = [];
  for (const [cat, entry] of Object.entries(mapping.categories)) {
    const needles = [cat, entry.feature, entry.alpsFeatureId]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase());
    if (needles.some((n) => n && prompt.includes(n))) {
      matches.push({ cat, entry });
    }
  }

  if (matches.length === 0) process.exit(0);

  const lines = ["[alps-writer] Related ADRs for mentioned features:"];
  for (const { cat, entry } of matches) {
    lines.push(`  • ${cat}${entry.feature ? ` (${entry.feature})` : ""}`);
    for (const adr of entry.adrs || []) {
      const exists = existsSync(path.join(cwd, adr)) ? "" : " [missing]";
      lines.push(`      ${adr}${exists}`);
    }
  }
  lines.push(
    "  Review these before editing code; run /adr-sync <category> if requirements changed.",
  );

  // stdout for UserPromptSubmit becomes additional context for the model.
  process.stdout.write(lines.join("\n") + "\n");
  process.exit(0);
}

main();
