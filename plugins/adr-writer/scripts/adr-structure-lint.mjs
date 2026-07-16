#!/usr/bin/env node
// adr-structure-lint.mjs — deterministic self-test for ADR well-formedness.
//
// The companion to scripts/adr-invariants.sh. That script is the repo-wide
// one-way-dependency oracle (code→ADR, ADR→PRD reverse references, rollup
// stale citations). THIS harness is the per-ADR + mapping index structure
// checker: it parses each ADR body and docs/adr/.mapping.json (the single ADR
// index — the README carries no ADR list) and asserts the shape rules the LLM
// adr-reviewer would otherwise eyeball — the deterministic half of
// R1/R5a/R8/R10/R13/R14/R16 plus filename, path-depth, required-section, and
// mapping-status↔body checks. Judgment-only rules (R4 two-stage filter, R12
// gray-zone fidelity, R14 strawman nuance, R3 impl-detail) are NOT attempted
// here — they stay with the reviewer.
//
// It shells out to adr-invariants.sh (unless --no-invariants) so a single run
// covers reverse references too, folding that exit code into the aggregate.
//
// Usage:
//   node adr-structure-lint.mjs [--adr-dir docs/adr] [category] [--json]
//                               [--no-invariants] [--warn-as-error]
//
//   [category]        limit to one category key (e.g. identity/login)
//   --adr-dir DIR     ADR root (default: docs/adr)
//   --json            emit machine-readable JSON instead of the text report
//   --no-invariants   skip the adr-invariants.sh (a)/(b) sub-run
//   --warn-as-error   treat warnings as failures (exit 1 on any warn)
//
// Exit: 0 = clean, 1 = at least one error (or warn with --warn-as-error),
//       2 = usage / environment error.
//
// Dependency-free: Node built-ins only, mirroring the plugin's zero-dep stance.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  classifyStatus,
  checkFilename,
  categoryDepth,
  checkSections,
  countDrivers,
  countAlternatives,
  relatedLinkTargets,
  codeRefHits,
  validateMappingShape,
  sectionRange,
  numberingGaps,
} from "./adr-lint-lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ── arg parse ─────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = {
    adrDir: "docs/adr",
    category: null,
    json: false,
    invariants: true,
    warnAsError: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--adr-dir") {
      const v = argv[++i];
      if (!v) usage(`--adr-dir requires a value`);
      opts.adrDir = v.replace(/\/+$/, "");
    } else if (a === "--json") opts.json = true;
    else if (a === "--no-invariants") opts.invariants = false;
    else if (a === "--warn-as-error") opts.warnAsError = true;
    else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    } else if (a.startsWith("--")) usage(`unknown flag: ${a}`);
    else if (!opts.category) opts.category = a;
    else usage(`unexpected argument: ${a}`);
  }
  return opts;
}

function usage(msg) {
  process.stderr.write(`adr-structure-lint: ${msg}\n`);
  process.exit(2);
}

function printHelp() {
  process.stdout.write(
    `adr-structure-lint — deterministic ADR structure checker\n\n` +
      `Usage: node adr-structure-lint.mjs [--adr-dir docs/adr] [category] [--json] [--no-invariants] [--warn-as-error]\n`,
  );
}

// ── finding collector ───────────────────────────────────────────────────
class Report {
  constructor() {
    this.items = [];
  }
  add(level, rule, where, msg) {
    this.items.push({ level, rule, where, msg });
  }
  error(rule, where, msg) {
    this.add("error", rule, where, msg);
  }
  warn(rule, where, msg) {
    this.add("warn", rule, where, msg);
  }
  get errors() {
    return this.items.filter((i) => i.level === "error");
  }
  get warns() {
    return this.items.filter((i) => i.level === "warn");
  }
}

// ── ADR file discovery (recursive, capped at the ≤2-segment key depth) ────
// Enumerate docs/adr/**/NNNN-*.md. Recursive so 2-segment feature sub-folder
// ADRs (identity/login/0001.md) are found — the flat glob docs/adr/*/*.md
// would miss them.
function findAdrFiles(root) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && /^[0-9]{4}-.*\.md$/.test(e.name)) out.push(full);
    }
  };
  walk(root);
  return out.sort();
}

function readSafe(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

// ── main ──────────────────────────────────────────────────────────────────
function main() {
  const opts = parseArgs(process.argv.slice(2));
  const rep = new Report();

  const adrRoot = opts.adrDir;
  if (!existsSync(adrRoot) || !statSync(adrRoot).isDirectory()) {
    // No ADR tree → nothing to lint. Not an error (a fresh repo hasn't run
    // /adr-new yet); say so and exit clean.
    finish(rep, opts, `ADR 디렉토리 없음: ${adrRoot} (아직 ADR이 없습니다)`);
    return;
  }

  // ── load mapping ─────────────────────────────────────────────────────
  const mappingPath = path.join(adrRoot, ".mapping.json");
  let mapping = null;
  let mappingRaw = null;
  if (existsSync(mappingPath)) {
    mappingRaw = readSafe(mappingPath);
    try {
      mapping = JSON.parse(mappingRaw);
    } catch (e) {
      rep.error("mapping-parse", mappingPath, `JSON 파싱 실패: ${e.message}`);
    }
  } else {
    rep.warn("mapping-missing", mappingPath, "매핑 파일이 없습니다 (디스크의 ADR 디렉토리로 진행)");
  }

  // ── mapping shape (R16 + schema subset) ──────────────────────────────
  if (mapping) {
    for (const iss of validateMappingShape(mapping)) {
      if (iss.level === "error") rep.error(`map-${iss.code}`, mappingPath, iss.msg);
      else rep.warn(`map-${iss.code}`, mappingPath, iss.msg);
    }
  }

  // ── discover ADR files on disk ────────────────────────────────────────
  const files = findAdrFiles(adrRoot);
  // paths relative to repo root (docs/adr/...), forward-slashed for matching
  const relFromRepo = (p) => path.relative(process.cwd(), p).split(path.sep).join("/");
  const diskAdrs = new Set(files.map(relFromRepo));

  // mapping's declared ADR set + the Status it records per path. The adrs[]
  // records are the ADR index (path + Status + summary); the README carries no
  // separate list, so the harness reconciles disk ↔ mapping only, and cross-
  // checks each record's status against the ADR body below.
  const mappedAdrs = new Set();
  const mappedStatusByPath = new Map();
  if (mapping?.categories) {
    for (const entry of Object.values(mapping.categories))
      for (const rec of entry?.adrs || []) {
        const p = rec && typeof rec === "object" ? rec.path : rec;
        if (typeof p === "string" && p) {
          mappedAdrs.add(p);
          if (rec && typeof rec === "object" && "status" in rec)
            mappedStatusByPath.set(p, rec.status);
        }
      }
  }

  // ── category filter ───────────────────────────────────────────────────
  const inScope = (relPath) => {
    if (!opts.category) return true;
    const rel = relPath.replace(new RegExp(`^${escapeRe(adrRoot)}/`), "");
    const dir = rel.split("/").slice(0, -1).join("/");
    // a category is either the full dir (context/feature or flat context)
    return dir === opts.category || dir.startsWith(opts.category + "/");
  };

  // ── per-ADR checks ────────────────────────────────────────────────────
  // (Anti-pattern segments on mapping KEYS are covered by validateMappingShape;
  // the per-ADR loop below independently checks the on-disk DIRECTORY path so a
  // mapping-less repo is still linted.)
  for (const file of files) {
    const rel = relFromRepo(file);
    if (!inScope(rel)) continue;
    const relFromAdr = path.relative(adrRoot, file).split(path.sep).join("/");
    const where = rel;
    const base = path.basename(file);

    // filename canonicality
    const fn = checkFilename(base);
    if (!fn.ok) rep.error("filename", where, filenameMsg(fn));

    // path depth ≤2 category segments
    const depth = categoryDepth(relFromAdr);
    if (depth > 2)
      rep.error(
        "path-depth",
        where,
        `카테고리 세그먼트 ${depth}단계 (최대 2단계 — 3-세그먼트 중첩 금지)`,
      );

    // R5a: anti-pattern segment on the directory path (works without mapping)
    const dirSegs = relFromAdr.split("/").slice(0, -1);
    for (const seg of dirSegs)
      if (isAntiPattern(seg))
        rep.error(
          "anti-pattern-dir",
          where,
          `디렉토리 세그먼트 "${seg}" 는 기술 레이어 이름 (금지)`,
        );

    const body = readSafe(file);
    if (body == null) {
      rep.error("read", where, "파일을 읽을 수 없습니다");
      continue;
    }

    // title header number == filename number
    const numFromName = base.slice(0, 4);
    const titleMatch = body.match(/^#\s+ADR\s+0*(\d+)\s*[:.]/m) || body.match(/^#\s+0*(\d+)[.:]/m);
    if (titleMatch) {
      const titleNum = String(titleMatch[1]).padStart(4, "0");
      if (titleNum !== numFromName)
        rep.error(
          "title-number",
          where,
          `제목 번호(${titleNum}) 가 파일명 번호(${numFromName}) 와 불일치`,
        );
    }

    // R1: Status enum/format + mapping-index agreement. The adrs[] record's
    // status is the single ADR-status index (README has none), so it must
    // mirror the body's ## Status line — adr-impl/adr-sync update both in
    // lockstep. A mismatch means the index went stale.
    const statusSec = sectionRange(body, (h) => h.text.trim() === "Status");
    if (!statusSec) rep.error("status-missing", where, "## Status 섹션이 없습니다");
    else {
      const val = firstNonEmpty(statusSec.lines, statusSec.start + 1, statusSec.end);
      const st = classifyStatus(val);
      if (!st.ok)
        rep.error("status-enum", where, `Status "${val ?? ""}" — ${statusReason(st.reason)}`);
      else if (mapping?.categories && mappedStatusByPath.has(rel)) {
        const mapped = String(mappedStatusByPath.get(rel) || "").trim();
        if (mapped !== val)
          rep.error(
            "status-index-mismatch",
            where,
            `.mapping.json 의 status "${mapped}" 가 본문 ## Status "${val}" 와 불일치`,
          );
      }
    }

    // required sections
    const secs = checkSections(body);
    for (const m of secs.missingHard)
      rep.error("section-missing", where, `필수 섹션 누락: ## ${m}`);
    if (!secs.hasAlternatives)
      rep.warn("alternatives-missing", where, "대안 검토 섹션이 없습니다 (권장)");
    if (!secs.hasDrivers)
      rep.warn("drivers-missing", where, "Decision Drivers 섹션이 없습니다 (권장)");

    // R13: Decision Drivers count 3-5
    const dr = countDrivers(body);
    if (dr.present && (dr.count < 3 || dr.count > 5))
      rep.warn("drivers-count", where, `Decision Drivers ${dr.count}개 (권장 3-5개)`);

    // R14: alternatives ≥2 (count only; strawman is LLM)
    const alt = countAlternatives(body);
    if (alt.present && alt.count < 2)
      rep.error("alternatives-count", where, `대안 ${alt.count}개 (최소 2개 필요)`);

    // R10: Related-link targets resolve on disk
    for (const target of relatedLinkTargets(body)) {
      const resolved = path.resolve(path.dirname(file), target);
      if (!existsSync(resolved))
        rep.error("related-broken", where, `Related 링크 대상 없음: ${target}`);
    }

    // R2: code-reference depth (advisory)
    for (const hit of codeRefHits(body))
      rep.warn("code-ref-depth", `${where}:${hit.line}`, `파일 단위 코드 참조 의심: ${hit.text}`);

    // R8 (disk→mapping): this file must be listed in .mapping.json adrs[].
    // .mapping.json is the single ADR index (README has no ADR list), so an
    // on-disk ADR missing from it is a hard orphan.
    if (mapping?.categories && !mappedAdrs.has(rel))
      rep.error("index-orphan-mapping", where, ".mapping.json 의 어느 adrs[] 에도 없음");
  }

  // ── mapping→disk: every adrs[] path exists ────────────────────────────
  if (mapping?.categories) {
    for (const [key, entry] of Object.entries(mapping.categories)) {
      for (const rec of entry?.adrs || []) {
        const a = rec && typeof rec === "object" ? rec.path : rec;
        if (typeof a !== "string" || !a) continue; // shape errors already reported
        if (opts.category && !(key === opts.category || key.startsWith(opts.category + "/")))
          continue;
        if (!diskAdrs.has(a))
          rep.error(
            "mapping-dangling-adr",
            mappingPath,
            `카테고리 "${key}" 의 adrs 경로가 디스크에 없음: ${a}`,
          );
      }
    }
  }

  // ── numbering gaps (rollup advisory, warning-only) ────────────────────
  // Group in-scope on-disk ADRs by category (directory under the ADR root) and
  // flag any category whose NNNN sequence has a hole. This is NOT an error:
  // split/adr-sync intentionally keep gaps ("결번 유지"). It's a heads-up that
  // if adr-rollup just deleted a chain member, its step 7 renumber may be
  // pending — the rollup skill reads this warning and asks the user whether to
  // fill the gap. Skipped when --category narrows to one leaf with no siblings.
  {
    const byCategory = new Map();
    for (const file of files) {
      const rel = relFromRepo(file);
      if (!inScope(rel)) continue;
      const relFromAdr = path.relative(adrRoot, file).split(path.sep).join("/");
      const cat = relFromAdr.split("/").slice(0, -1).join("/") || "(root)";
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push(path.basename(file));
    }
    for (const g of numberingGaps(byCategory))
      rep.warn(
        "numbering-gap",
        `docs/adr/${g.category}`,
        `번호 결번: ${g.missing.map((n) => String(n).padStart(4, "0")).join(", ")} 없음 ` +
          `(존재: ${g.present.map((n) => String(n).padStart(4, "0")).join(", ")}). ` +
          `방금 adr-rollup 을 실행했다면 7단계 renumber 가 남았을 수 있습니다 — 결번을 메울지 사용자에게 확인하세요. ` +
          `(split/adr-sync 로 생긴 결번이면 정상이니 그대로 둡니다.)`,
      );
  }

  // ── adr-invariants.sh (a)/(b) sub-run ─────────────────────────────────
  let invExit = 0;
  if (opts.invariants) {
    const invScript = path.join(HERE, "adr-invariants.sh");
    const r = spawnSync("bash", [invScript, "--adr-dir", adrRoot], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    invExit = r.status ?? -1;
    if (invExit === 2) {
      rep.error(
        "invariants-env",
        invScript,
        `adr-invariants.sh 환경 오류(exit 2): ${(r.stderr || "").trim()}`,
      );
    } else if (invExit === 1) {
      // fold each reported reverse-ref line as an error
      for (const line of (r.stdout || "").split("\n")) {
        const t = line.trim();
        if (t && !t.startsWith("✓")) rep.error("invariants", invScript, t);
      }
    } else if (invExit < 0) {
      rep.error("invariants-spawn", invScript, "adr-invariants.sh 실행 실패 (bash/스크립트 확인)");
    }
  }

  finish(rep, opts, files.length === 0 ? "검사할 ADR 파일이 없습니다" : null);
}

// ── helpers ────────────────────────────────────────────────────────────────
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAntiPattern(seg) {
  return [
    "frontend",
    "backend",
    "mobile",
    "web",
    "api",
    "ui",
    "db",
    "cache",
    "controllers",
    "services",
    "repositories",
    "bugfix",
    "refactor",
  ].includes(seg);
}

function firstNonEmpty(lines, start, end) {
  for (let i = start; i < end; i++) {
    const t = lines[i].trim();
    if (t) return t;
  }
  return null;
}

function filenameMsg(fn) {
  const map = {
    "stale-fN-prefix":
      "파일명에 stale fN- 접두사 (Feature ID 는 파일명·카테고리 키에 넣지 않음 — canonical NNNN-kebab-title.md)",
    uppercase: "파일명에 대문자 (kebab-case 만 허용)",
    "not-canonical": "canonical 형식 아님 (NNNN-kebab-case-title.md)",
  };
  return `${fn.basename} — ${map[fn.reason] || fn.reason}`;
}

function statusReason(reason) {
  return (
    {
      empty: "값이 비어 있음",
      "informal-status": "비공식 상태 (Implemented/Done/Completed 금지)",
      "proposed-should-not-carry-date": "Proposed 에는 날짜를 붙이지 않음",
      "missing-date": "날짜 누락 (Accepted/Deprecated 는 (YYYY-MM-DD) 필요)",
      "date-only":
        "괄호 안에는 날짜만 (Accepted/Deprecated (YYYY-MM-DD) — 날짜 뒤 참조·설명·feature-id 등 부가 텍스트 금지)",
      "superseded-needs-adr-link":
        "Superseded 는 후속 ADR 링크 필요 (Superseded by [ADR ...](link))",
      unrecognized: "허용된 Status 값이 아님 (Proposed/Accepted/Deprecated/Superseded)",
    }[reason] || reason
  );
}

function finish(rep, opts, note) {
  const failed = rep.errors.length > 0 || (opts.warnAsError && rep.warns.length > 0);
  if (opts.json) {
    process.stdout.write(
      JSON.stringify(
        { ok: !failed, errors: rep.errors, warnings: rep.warns, note: note || undefined },
        null,
        2,
      ) + "\n",
    );
  } else {
    const lines = [];
    lines.push(`## ADR Structure Lint`);
    if (note) lines.push(`- ${note}`);
    if (rep.errors.length) {
      lines.push(`\n### ✗ Errors (${rep.errors.length})`);
      for (const e of rep.errors) lines.push(`- [${e.rule}] ${e.where}\n    ${e.msg}`);
    }
    if (rep.warns.length) {
      lines.push(`\n### ⚠ Warnings (${rep.warns.length})`);
      for (const w of rep.warns) lines.push(`- [${w.rule}] ${w.where}\n    ${w.msg}`);
    }
    if (!rep.errors.length && !rep.warns.length) lines.push(`\n✓ ADR structure clean`);
    else if (!rep.errors.length)
      lines.push(`\n✓ no errors${rep.warns.length ? ` (${rep.warns.length} warning(s))` : ""}`);
    process.stdout.write(lines.join("\n") + "\n");
  }
  process.exit(failed ? 1 : 0);
}

main();
