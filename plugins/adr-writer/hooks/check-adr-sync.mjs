#!/usr/bin/env node
// PreToolUse(Edit|Write|MultiEdit) — keep the PRD → ADR → code dependency in
// sync, in both propagation directions:
//
//   • Editing CODE — verify the file has an ADR in sync with its mapped
//     category. Default "warn" (exit 0 + stderr); ALPS_ADR_ENFORCE=block makes
//     it block the write when a mapped ADR is older than the code it governs.
//   • Editing the PRD (*.alps.xml) — the most-upstream source. The edit is
//     ALWAYS allowed (never blocked, even in block mode — blocking it would
//     invert PRD → ADR → code), but if downstream ADRs now predate the PRD we
//     surface a warn-only notice so the change propagates forward.

import fs from "node:fs";
import path from "node:path";
import { readFileSync, statSync, existsSync } from "node:fs";

const MODE = (process.env.ALPS_ADR_ENFORCE || "warn").toLowerCase();
const MAPPING_PATH = process.env.ALPS_ADR_MAPPING || "docs/adr/.mapping.json";

// Grace window: code/PRD must be newer than the ADR by more than this before
// we treat the ADR as stale. Absorbs same-session co-edits.
const GRACE_MS = 24 * 60 * 60 * 1000; // 1 day

// Top-level directories that almost always hold source code we want under
// ADR coverage. Used to detect "user is editing real code but no ADR is
// mapped yet" — the most common gap in the early days of a project.
const SOURCE_DIR_HINTS = [
  "src/",
  "lib/",
  "app/",
  "apps/",
  "packages/",
  "services/",
  "pages/",
  "components/",
  "server/",
  "client/",
  "internal/",
  "cmd/",
];

// Files we never want to bother with — config, lockfiles, generated output.
// Even when they live under packages/ we don't ask for an ADR.
const EXCLUDE_FILE_PATTERNS = [
  /(^|\/)package\.json$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)package-lock\.json$/,
  /(^|\/)tsconfig.*\.json$/,
  /(^|\/)\.eslintrc/,
  /(^|\/)\.prettierrc/,
  /(^|\/)nx\.json$/,
  /(^|\/)project\.json$/,
  /(^|\/)README(\.|$)/i,
  /(^|\/)AGENTS\.md$/i,
  /(^|\/)CLAUDE\.md$/i,
  /(^|\/)CONTRIBUTING\.md$/i,
  /(^|\/)LICENSE/i,
  /\.lock$/,
  /\.min\.(js|css)$/,
  /\.d\.ts$/,
];

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
  // PreToolUse JSON schema (per Claude Code docs):
  //   - block:  permissionDecision="deny" + permissionDecisionReason → reason
  //             reaches the model so it can self-correct.
  //   - warn:   PreToolUse does not support additionalContext, so we just
  //             allow the call and surface the message via stderr for the
  //             user. The same drift will be caught on the next turn by
  //             surface-adr-context.mjs's mapping snapshot, so the model
  //             still has visibility — without false-blocking every edit.
  if (block) {
    const out = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: message,
      },
    };
    process.stdout.write(JSON.stringify(out) + "\n");
  } else {
    process.stderr.write(message + "\n");
  }
  process.exit(0);
}

// PRD (*.alps.xml) was edited. PRD is the most-upstream source, so the edit is
// always allowed — we NEVER block it (blocking would let ADR/code drag the PRD,
// inverting the dependency). We only emit a warn-only notice listing categories
// whose ADRs now predate the PRD, so the change propagates forward to ADR+code.
function checkPrdEdit(rel, cwd, mapping) {
  if (!mapping?.categories) process.exit(0); // Cycle not adopted — stay quiet.

  const prdPath = path.join(cwd, rel);
  const prdMtime = existsSync(prdPath) ? statSync(prdPath).mtimeMs : Date.now();

  // Categories whose newest ADR is older than the PRD by > grace period, and
  // whose entry is tied to this PRD (alpsDocument unset, or pointing at it).
  const stale = [];
  for (const [cat, entry] of Object.entries(mapping.categories)) {
    const tiedToThisPrd =
      !mapping.alpsDocument || mapping.alpsDocument === rel;
    if (!tiedToThisPrd) continue;
    const adrPaths = (entry.adrs || []).map((p) => path.join(cwd, p));
    const present = adrPaths.filter(existsSync);
    if (present.length === 0) continue;
    if (prdMtime - newest(present) > GRACE_MS) {
      stale.push({ id: cat, adrs: entry.adrs || [] });
    }
  }

  if (stale.length === 0) process.exit(0);

  const list = stale
    .map((c) => `  • ${c.id}\n${c.adrs.map((p) => `      - ${p}`).join("\n")}`)
    .join("\n");
  // Always warn-only (block:false) regardless of MODE — see function comment.
  return emit({
    block: false,
    message:
      `[alps-writer] PRD(${rel})를 수정했습니다. 변경은 그대로 진행됩니다.\n` +
      `  PRD 가 다음 카테고리의 ADR 보다 최신입니다 — 변경이 ADR·코드로 전파됐는지 점검하세요:\n${list}\n` +
      `  영향 받는 feature 를 ADR 로 반영하려면: /feature-to-adr (갱신 모드), 이어서 /adr-sync.\n` +
      `  (PRD → ADR → code 단방향 — 이 알림은 차단이 아니라 전파 환기입니다.)`,
  });
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

  const mappingPath = path.join(cwd, MAPPING_PATH);
  const mapping = loadJSON(mappingPath);

  // PRD edits propagate DOWNSTREAM (PRD → ADR → code). The edit is always
  // allowed; we only surface a warn-only notice when ADRs now lag the PRD.
  if (rel.endsWith(".alps.xml")) return checkPrdEdit(rel, cwd, mapping);

  // Skip pure docs/configuration that don't carry architectural decisions.
  if (EXCLUDE_FILE_PATTERNS.some((re) => re.test(rel))) process.exit(0);
  if (rel.startsWith("docs/") && !rel.startsWith("docs/adr/")) process.exit(0);
  const looksLikeSource = SOURCE_DIR_HINTS.some(
    (h) => rel === h.replace(/\/$/, "") || rel.startsWith(h),
  );

  if (!mapping) {
    // No mapping file at all. If this looks like real source, prompt the user
    // to bootstrap it; otherwise stay quiet.
    if (!looksLikeSource) process.exit(0);
    return emit({
      block: MODE === "block",
      message:
        `[alps-writer] No \`docs/adr/.mapping.json\` found, but you're editing source: ${rel}\n` +
        `  Draft an ADR first:\n` +
        `    • \`/adr-new <category>\` — write an ADR directly (default path).\n` +
        `    • \`/feature-to-adr [id]\` — convert an ALPS Section 7 feature into an ADR (only if you already have an ALPS PRD).\n` +
        (MODE === "block"
          ? `  (ALPS_ADR_ENFORCE=block — write blocked until the cycle starts.)`
          : `  (warn mode — proceeding. Set ALPS_ADR_ENFORCE=block to enforce.)`),
    });
  }

  const cat = findMappedCategory(rel, mapping);
  if (!cat) {
    // Mapping exists but no category claims this file. For source dirs that
    // is a gap the cycle should fill; for everything else we stay quiet.
    if (!looksLikeSource) process.exit(0);
    return emit({
      block: MODE === "block",
      message:
        `[alps-writer] No ADR category covers ${rel}.\n` +
        `  This file lives under a source directory but isn't claimed by any \`codePaths\` in \`docs/adr/.mapping.json\`.\n` +
        `  Either:\n` +
        `    • Run \`/adr-new <category>\` to create a new ADR + category for this area (or \`/feature-to-adr\` if it maps to an ALPS Section 7 feature), or\n` +
        `    • Extend an existing category's \`codePaths\` if this file belongs there.\n` +
        (MODE === "block"
          ? `  (ALPS_ADR_ENFORCE=block — write blocked.)`
          : `  (warn mode — proceeding.)`),
    });
  }

  const adrPaths = (cat.adrs || []).map((p) => path.join(cwd, p));
  const presentAdrs = adrPaths.filter(existsSync);
  if (presentAdrs.length === 0) {
    return emit({
      block: MODE === "block",
      message:
        `[alps-writer] Category "${cat.id}" maps to ${rel} but has no ADR file on disk.\n` +
        `  Run: /adr-new ${cat.id}   (or /feature-to-adr ${cat.id} if backed by an ALPS Section 7 feature)\n` +
        (MODE === "block"
          ? `  (ALPS_ADR_ENFORCE=block — write blocked.)`
          : `  (warn mode — proceeding. Set ALPS_ADR_ENFORCE=block to enforce.)`),
    });
  }

  // Compare ADR mtime with the newest matching source file mtime.
  // If code is newer than every ADR by > grace period, surface it.
  const codeNewest = existsSync(filePath) ? statSync(filePath).mtimeMs : Date.now();
  const adrNewest = newest(presentAdrs);

  if (codeNewest - adrNewest > GRACE_MS) {
    const adrList = cat.adrs.map((p) => `  - ${p}`).join("\n");
    return emit({
      block: MODE === "block",
      message:
        `[alps-writer] Code is newer than the mapped ADR for category "${cat.id}" (>24h).\n` +
        `  Editing: ${rel}\n` +
        `  Mapped ADRs:\n${adrList}\n` +
        `  코드가 ADR 보다 앞서 있습니다. 다음 중 어느 경우인지 구분하세요:\n` +
        `    (a) ADR 결정을 그대로 구현/보강한 것 → /adr-impl 이 Status 를 Accepted 로 올리거나, /adr-sync ${cat.id} 가 구현 사실을 정렬.\n` +
        `    (b) ADR 결정 자체를 코드에서 바꾼 것 → 먼저 ADR 을 갱신(또는 새 ADR 로 supersede)해야 한다. 회색지대 결정은 ADR 이 권위 — 코드에 맞춰 ADR 을 덮어쓰지 않는다.\n` +
        (MODE === "block"
          ? `  (ALPS_ADR_ENFORCE=block — write blocked until ADR is reviewed.)`
          : `  (warn mode — proceeding.)`),
    });
  }

  process.exit(0);
}

main();
