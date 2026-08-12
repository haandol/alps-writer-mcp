#!/usr/bin/env node

import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { classifyStatus } from "./adr-lint-lib.mjs";

function usage(message) {
  if (message) console.error(`Error: ${message}`);
  console.error(
    'Usage: node adr-status-transition.mjs <adr-path> "<status>" [--summary "<text>"] [--root <repo-root>]',
  );
  process.exit(2);
}

function parseArgs(argv) {
  const positional = [];
  let summary;
  let root = process.cwd();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--summary") {
      if (i + 1 >= argv.length) usage("--summary requires a value");
      summary = argv[++i];
      continue;
    }
    if (arg === "--root") {
      if (i + 1 >= argv.length) usage("--root requires a value");
      root = argv[++i];
      continue;
    }
    if (arg.startsWith("--")) usage(`unknown option: ${arg}`);
    positional.push(arg);
  }

  if (positional.length !== 2) usage("ADR path and target status are required");
  return { adrArg: positional[0], status: positional[1], summary, root: path.resolve(root) };
}

function normalizeAdrPath(root, adrArg) {
  const absolute = path.resolve(root, adrArg);
  const relative = path.relative(root, absolute);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    usage(`ADR path must be a file inside the repository: ${adrArg}`);
  }
  return relative.split(path.sep).join("/");
}

function findStatusLine(source, adrPath) {
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.split(/\r?\n/);
  const headings = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "## Status") headings.push(i);
  }
  if (headings.length !== 1) {
    throw new Error(
      `${adrPath}: expected exactly one "## Status" heading, found ${headings.length}`,
    );
  }

  for (let i = headings[0] + 1; i < lines.length; i++) {
    if (lines[i].trim() === "") continue;
    if (lines[i].trim().startsWith("#")) {
      throw new Error(`${adrPath}: Status value is missing before the next heading`);
    }
    return { lines, index: i, value: lines[i].trim(), eol };
  }
  throw new Error(`${adrPath}: Status value is missing`);
}

function findMappingRecord(mapping, adrPath) {
  const hits = [];
  for (const [category, entry] of Object.entries(mapping.categories || {})) {
    for (const record of entry.adrs || []) {
      if (record.path === adrPath) hits.push({ category, record });
    }
  }
  if (hits.length !== 1) {
    throw new Error(`${adrPath}: expected exactly one .mapping.json record, found ${hits.length}`);
  }
  return hits[0];
}

function writeBothOrRollback(files) {
  const temps = files.map(({ target, content }) => ({
    target,
    original: readFileSync(target, "utf8"),
    temp: `${target}.adr-status-${process.pid}.tmp`,
    content,
  }));

  try {
    for (const file of temps) writeFileSync(file.temp, file.content);
    for (const file of temps) renameSync(file.temp, file.target);
  } catch (error) {
    for (const file of temps) {
      rmSync(file.temp, { force: true });
      writeFileSync(file.target, file.original);
    }
    throw error;
  }
}

function main() {
  const { adrArg, status, summary, root } = parseArgs(process.argv.slice(2));
  if (!classifyStatus(status).ok) {
    usage(`invalid ADR status: ${status}`);
  }

  const adrPath = normalizeAdrPath(root, adrArg);
  const adrFile = path.join(root, ...adrPath.split("/"));
  const mappingFile = path.join(root, "docs", "adr", ".mapping.json");
  if (!existsSync(adrFile)) throw new Error(`ADR file does not exist: ${adrPath}`);
  if (!existsSync(mappingFile)) throw new Error(`mapping file does not exist: ${mappingFile}`);

  const adrSource = readFileSync(adrFile, "utf8");
  const statusLine = findStatusLine(adrSource, adrPath);
  const mappingSource = readFileSync(mappingFile, "utf8");
  const mapping = JSON.parse(mappingSource);
  const { category, record } = findMappingRecord(mapping, adrPath);

  if (statusLine.value !== record.status) {
    throw new Error(
      `${adrPath}: refusing transition because body status "${statusLine.value}" and mapping status "${record.status}" differ`,
    );
  }

  statusLine.lines[statusLine.index] = status;
  record.status = status;
  if (summary !== undefined) record.summary = summary;

  const nextAdr = statusLine.lines.join(statusLine.eol);
  const nextMapping = `${JSON.stringify(mapping, null, 2)}\n`;
  writeBothOrRollback([
    { target: adrFile, content: nextAdr },
    { target: mappingFile, content: nextMapping },
  ]);

  console.log(
    `Updated ${adrPath} (${category}) from "${statusLine.value}" to "${status}"${
      summary === undefined ? "" : " and refreshed its summary"
    }.`,
  );
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
