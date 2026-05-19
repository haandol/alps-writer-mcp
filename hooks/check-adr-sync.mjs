#!/usr/bin/env node
// PreToolUse(Edit|Write|MultiEdit) — verify the file being modified has an ADR
// in sync with its mapped category. Default behavior is "warn" (exit 0 with
// stderr message). Set ALPS_ADR_ENFORCE=block to make the hook block writes
// (exit 2) when a mapped ADR is older than the code it governs.

import fs from "node:fs";
import path from "node:path";
import { readFileSync, statSync, existsSync } from "node:fs";

const MODE = (process.env.ALPS_ADR_ENFORCE || "warn").toLowerCase();
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

function globToRegExp(glob) {
  // Minimal glob → regex. Supports **, *, ?.
  let re = "^";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      re += ".*";
      i++;
    } else if (c === "*") {
      re += "[^/]*";
    } else if (c === "?") {
      re += "[^/]";
    } else if (".+^${}()|[]\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  re += "$";
  return new RegExp(re);
}

function matchesAny(file, globs) {
  return globs.some((g) => globToRegExp(g).test(file));
}

function findMappedCategory(file, mapping) {
  if (!mapping?.categories) return null;
  for (const [cat, entry] of Object.entries(mapping.categories)) {
    if (matchesAny(file, entry.codePaths || [])) {
      return { id: cat, ...entry };
    }
  }
  return null;
}

function newest(paths) {
  let max = 0;
  for (const p of paths) {
    if (existsSync(p)) {
      const m = statSync(p).mtimeMs;
      if (m > max) max = m;
    }
  }
  return max;
}

function emit({ block, message }) {
  // Per Claude Code docs: exit 2 = block (PreToolUse), stderr → assistant context.
  // exit 0 = allow, stderr is shown to user but not the model.
  process.stderr.write(message + "\n");
  process.exit(block ? 2 : 0);
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

  const tool = event.tool_name || event.toolName;
  if (!["Edit", "Write", "MultiEdit"].includes(tool)) process.exit(0);

  const input = event.tool_input || event.toolInput || {};
  const filePath = input.file_path || input.filePath;
  if (!filePath) process.exit(0);

  const cwd = event.cwd || process.cwd();
  const rel = path.relative(cwd, filePath);
  if (rel.startsWith("..")) process.exit(0); // Outside repo, skip.

  // Skip the ADR docs themselves and the mapping file.
  if (rel.startsWith("docs/adr/")) process.exit(0);
  if (rel.endsWith(".alps.xml")) process.exit(0);

  const mappingPath = path.join(cwd, MAPPING_PATH);
  const mapping = loadJSON(mappingPath);
  if (!mapping) process.exit(0); // No mapping yet — pre-bootstrap, stay quiet.

  const cat = findMappedCategory(rel, mapping);
  if (!cat) process.exit(0); // File not under any tracked category.

  const adrPaths = (cat.adrs || []).map((p) => path.join(cwd, p));
  const presentAdrs = adrPaths.filter(existsSync);
  if (presentAdrs.length === 0) {
    return emit({
      block: MODE === "block",
      message:
        `[alps-writer] Category "${cat.id}" maps to ${rel} but has no ADR file on disk.\n` +
        `  Run: /feature-to-adr ${cat.id}\n` +
        (MODE === "block"
          ? `  (ALPS_ADR_ENFORCE=block — write blocked.)`
          : `  (warn mode — proceeding. Set ALPS_ADR_ENFORCE=block to enforce.)`),
    });
  }

  // Compare ADR mtime with the newest matching source file mtime.
  // If code is newer than every ADR by > grace period, surface it.
  const codeNewest = existsSync(filePath) ? statSync(filePath).mtimeMs : Date.now();
  const adrNewest = newest(presentAdrs);
  const GRACE_MS = 24 * 60 * 60 * 1000; // 1 day

  if (codeNewest - adrNewest > GRACE_MS) {
    const adrList = cat.adrs.map((p) => `  - ${p}`).join("\n");
    return emit({
      block: MODE === "block",
      message:
        `[alps-writer] ADR may be stale for category "${cat.id}".\n` +
        `  Editing: ${rel}\n` +
        `  Mapped ADRs:\n${adrList}\n` +
        `  Code is newer than ADR by >24h. Consider /adr-sync ${cat.id} before/after this edit.\n` +
        (MODE === "block"
          ? `  (ALPS_ADR_ENFORCE=block — write blocked until ADR is reviewed.)`
          : `  (warn mode — proceeding.)`),
    });
  }

  process.exit(0);
}

main();
