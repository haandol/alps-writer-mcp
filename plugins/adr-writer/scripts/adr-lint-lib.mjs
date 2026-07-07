// adr-lint-lib.mjs — pure, dependency-free checkers shared by the
// adr-structure-lint CLI and the node:test suite. Nothing here touches the
// filesystem or process; every function takes strings/objects and returns
// plain data, so the same logic is exercised by tests (against fixtures) and
// by the harness (against a project's real docs/adr).
//
// The deterministic checks here are the ones the LLM adr-reviewer can OFFLOAD
// (R1 Status enum, R5a anti-pattern key, R8 index/mapping presence, R10
// Related-link existence, R13/R14 counts, R16 dependsOn integrity, plus
// filename / path-depth / required-section shape). Judgment-only rules (R4
// two-stage filter, R12 gray-zone fidelity, R14 strawman nuance, R3) stay with
// the reviewer — see agents/adr-reviewer.md.

// ── category-key shape ───────────────────────────────────────────────────
// ≤2 lowercase-kebab segments (context or context/feature). Stricter than a
// bare [a-z0-9-]+ : rejects leading/trailing hyphens and empty segments, and
// caps depth at two. Matches the pattern seeded into mapping.schema.json
// (propertyNames.pattern). Feature-ID fallback keys (f1, f-auth-01) pass.
export const KEY_RE = /^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)?$/;

// Technical-layer / work-type names banned as EITHER category segment
// (structure.md "안티패턴 카테고리"). vertical-slice tracing breaks when a
// feature's decision is split along these.
export const ANTIPATTERN_SEGMENTS = new Set([
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
]);

// Recognized entry field names (mapping.schema.json). Unknown keys are typos
// that silently drop dependsOn/subdomainType, so the harness flags them (the
// schema also sets additionalProperties:false).
export const KNOWN_ENTRY_FIELDS = new Set([
  "feature",
  "alpsFeatureId",
  "subdomainType",
  "adrs",
  "dependsOn",
  "tableDocs",
]);

export const SUBDOMAIN_TYPES = new Set(["core", "supporting", "generic"]);

// Sections the README ADR template marks as the load-bearing spine. HARD =
// must be present (structural well-formedness). SOFT = expected but their
// absence is advisory (Decision Drivers / 대안 검토 / Related — their深 quality
// is an LLM call, so only presence is checked, and only as a warning).
export const HARD_SECTIONS = ["Status", "Context", "Decision", "Consequences"];

// ── dependsOn graph integrity (R16) ──────────────────────────────────────
// These three lived only inside tests/mapping.test.mjs; promoted here so the
// harness runs the SAME logic over a project's real .mapping.json.

// keys referenced in some dependsOn that do not exist as a category key.
export function dependsOnDangling(mapping) {
  const cats = mapping?.categories || {};
  const keys = new Set(Object.keys(cats));
  const bad = [];
  for (const [k, e] of Object.entries(cats))
    for (const d of e?.dependsOn || []) if (!keys.has(d)) bad.push(`${k}→${d}`);
  return bad;
}

// entries that list themselves in dependsOn (self-edge — schema: "no self-edge").
// Reported separately from a multi-node cycle because the fix differs.
export function selfEdges(mapping) {
  const cats = mapping?.categories || {};
  const bad = [];
  for (const [k, e] of Object.entries(cats)) if ((e?.dependsOn || []).includes(k)) bad.push(k);
  return bad;
}

// true when the dependsOn digraph has any cycle (self-loop or longer back-edge).
// DFS with on-stack (state 1) coloring. Mirrors the checker adr-sync step 6 and
// feature-to-adr step 1 promise to run.
export function hasCycle(mapping) {
  const g = mapping?.categories || {};
  const state = {}; // 0/undef = unvisited, 1 = on-stack, 2 = done
  let cyclic = false;
  const dfs = (n) => {
    if (!g[n]) return;
    state[n] = 1;
    for (const m of g[n].dependsOn || []) {
      if (state[m] === 1) cyclic = true;
      else if (!state[m]) dfs(m);
    }
    state[n] = 2;
  };
  for (const n of Object.keys(g)) if (!state[n]) dfs(n);
  return cyclic;
}

// ── Status line (R1 enum/format half) ────────────────────────────────────
// The code-reality half of R1 ("does the described behavior exist in code?")
// is LLM/adr-sync territory; only the closed vocabulary + date convention is
// deterministic here. README "상태" + "자동 전환 규칙":
//   Proposed                                (never dated)
//   Accepted (YYYY-MM-DD)
//   Deprecated (YYYY-MM-DD)
//   Superseded by [ADR ...](...)            (successor link, not a date)
// Informal states (Implemented/Done/Completed) are explicitly banned.
const STATUS_MATCHERS = [
  /^Proposed$/,
  /^Accepted \(\d{4}-\d{2}-\d{2}\)$/,
  /^Deprecated \(\d{4}-\d{2}-\d{2}\)$/,
  /^Superseded by \[ADR [^\]]+\]\([^)]+\)$/,
];

export function classifyStatus(statusValue) {
  const v = (statusValue || "").trim();
  if (!v) return { ok: false, reason: "empty" };
  if (STATUS_MATCHERS.some((re) => re.test(v))) return { ok: true, value: v };
  // Diagnose the common near-misses so the report is actionable.
  if (/^(Implemented|Done|Completed)\b/i.test(v))
    return { ok: false, reason: "informal-status", value: v };
  if (/^Proposed\s*\(/.test(v))
    return { ok: false, reason: "proposed-should-not-carry-date", value: v };
  if (/^Accepted$/.test(v) || /^Deprecated$/.test(v))
    return { ok: false, reason: "missing-date", value: v };
  if (/^Superseded\b/.test(v)) return { ok: false, reason: "superseded-needs-adr-link", value: v };
  return { ok: false, reason: "unrecognized", value: v };
}

// ── filename canonicality ─────────────────────────────────────────────────
// authoring-rules "명명 규칙": NNNN-kebab-case-title.md, and NO Feature ID in
// the filename (the stale fN- prefix adr-sync 3.7 case (1) fixes).
export function checkFilename(basename) {
  const canonical = /^[0-9]{4}-[a-z0-9]+(-[a-z0-9]+)*\.md$/;
  const staleFn = /^[0-9]{4}-f[0-9]+-/i;
  if (staleFn.test(basename)) return { ok: false, reason: "stale-fN-prefix", basename };
  if (!canonical.test(basename)) {
    if (/[A-Z]/.test(basename)) return { ok: false, reason: "uppercase", basename };
    return { ok: false, reason: "not-canonical", basename };
  }
  return { ok: true, basename };
}

// ── path depth ────────────────────────────────────────────────────────────
// structure.md: at most 2 category segments → at most 2 DIRECTORY levels
// between the ADR root and the file. e.g. identity/login/0001.md = 2 (ok);
// identity/login/social/0001.md = 3 (fail — "최대 1단계 깊이" for sub-folders).
// relPath is the ADR path relative to the ADR root (no leading docs/adr/).
export function categoryDepth(relPath) {
  const parts = relPath.split("/").filter(Boolean);
  return Math.max(0, parts.length - 1); // drop the filename
}

// ── anti-pattern segment check (R5a) ──────────────────────────────────────
// A key (or a docs/adr directory path relative to root) must be ≤2 kebab
// segments with no technical-layer segment. Slice-coherence (R5b/c) is LLM.
export function checkCategoryKey(key) {
  const issues = [];
  if (!KEY_RE.test(key)) issues.push({ reason: "bad-shape", key });
  const segs = key.split("/");
  if (segs.length > 2) issues.push({ reason: "too-deep", key });
  for (const s of segs)
    if (ANTIPATTERN_SEGMENTS.has(s))
      issues.push({ reason: "anti-pattern-segment", key, segment: s });
  return issues;
}

// ── markdown heading model ────────────────────────────────────────────────
// Parse ATX headings, ignoring lines inside fenced code blocks (``` or ~~~) so
// a "## foo" inside a code sample isn't mistaken for a section.
export function parseHeadings(body) {
  const lines = body.split(/\r?\n/);
  const heads = [];
  let fence = null; // current fence marker when inside a code block
  lines.forEach((line, i) => {
    const f = line.match(/^\s*(```+|~~~+)/);
    if (f) {
      if (fence && line.trim().startsWith(fence)) fence = null;
      else if (!fence) fence = f[1];
      return;
    }
    if (fence) return;
    const m = line.match(/^(#{1,6})\s+(.*?)\s*$/);
    if (m) heads.push({ level: m[1].length, text: m[2], line: i });
  });
  return { lines, heads };
}

// Return the line range [start, end) of the section whose heading matches
// `pred`, ending at the next heading of the SAME-or-higher level. null if none.
export function sectionRange(body, pred) {
  const { lines, heads } = parseHeadings(body);
  const idx = heads.findIndex((h) => pred(h));
  if (idx === -1) return null;
  const start = heads[idx].line;
  const level = heads[idx].level;
  let end = lines.length;
  for (let j = idx + 1; j < heads.length; j++) {
    if (heads[j].level <= level) {
      end = heads[j].line;
      break;
    }
  }
  return { start, end, lines, heading: heads[idx] };
}

// presence of each HARD_SECTIONS heading (## level) + soft-section presence.
export function checkSections(body) {
  const { heads } = parseHeadings(body);
  const h2 = new Set(heads.filter((h) => h.level === 2).map((h) => h.text.trim()));
  const missingHard = HARD_SECTIONS.filter((s) => !h2.has(s));
  const hasDrivers = h2.has("Decision Drivers");
  // 대안 검토 is authored at ## or ### depending on the template variant.
  const hasAlternatives = heads.some(
    (h) => h.level >= 2 && h.level <= 4 && /^대안\s*검토$/.test(h.text.trim()),
  );
  const hasRelated = h2.has("Related");
  return { missingHard, hasDrivers, hasAlternatives, hasRelated };
}

// ── Decision Drivers count (R13 numeric envelope) ─────────────────────────
export function countDrivers(body) {
  const sec = sectionRange(body, (h) => h.text.trim() === "Decision Drivers");
  if (!sec) return { present: false, count: 0 };
  let count = 0;
  for (let i = sec.start + 1; i < sec.end; i++) if (/^\s*[-*]\s+\S/.test(sec.lines[i])) count++;
  return { present: true, count };
}

// ── alternatives count (R14 — count only; strawman detection is LLM) ──────
// Alternatives are authored as a table, a bullet list, or #### option blocks.
// Take the strongest structural signal available so a table-based ADR and a
// bullet-based one both yield a sensible count.
export function countAlternatives(body) {
  const sec = sectionRange(body, (h) => /^대안\s*검토$/.test(h.text.trim()));
  if (!sec) return { present: false, count: 0 };
  let bullets = 0;
  let subheads = 0;
  let tableRows = 0;
  let tableSeen = false;
  for (let i = sec.start + 1; i < sec.end; i++) {
    const l = sec.lines[i];
    if (/^\s*[-*]\s+\S/.test(l)) bullets++;
    if (/^#{4}\s+\S/.test(l)) subheads++;
    if (/^\s*\|.*\|\s*$/.test(l)) {
      // skip the header separator row (|---|---|)
      if (/^\s*\|[\s:|-]+\|\s*$/.test(l)) tableSeen = true;
      else tableRows++;
    }
  }
  // In a table, the first non-separator row is the header → subtract it.
  const tableCount = tableSeen ? Math.max(0, tableRows - 1) : 0;
  const count = Math.max(bullets, subheads, tableCount);
  return { present: true, count };
}

// ── Related-link targets (R10) ────────────────────────────────────────────
// markdown links inside the ## Related section. Returns local (non-URL)
// targets with their anchors stripped, for the CLI to resolve against disk.
export function relatedLinkTargets(body) {
  const sec = sectionRange(body, (h) => h.text.trim() === "Related");
  if (!sec) return [];
  const text = sec.lines.slice(sec.start + 1, sec.end).join("\n");
  const out = [];
  const re = /\[[^\]]*\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(text))) {
    let target = m[1].trim();
    if (/^(https?:|mailto:|#)/i.test(target)) continue; // external / in-page
    target = target.split("#")[0].trim(); // drop anchor
    if (target) out.push(target);
  }
  return out;
}

// ── code-reference depth (R2 — advisory heuristic) ────────────────────────
// authoring-rules "코드 참조 깊이 — 폴더 단위까지만": no file-level path or
// file:line citation. FP-prone (must not flag .md Related/table links), so the
// CLI emits these as WARN, not ERROR — the reviewer confirms true violations.
const SRC_EXT = "tsx?|jsx?|go|py|java|rb|rs|c|cc|cpp|h|hpp|cs|kt|swift|php|scala|sql|sh|ya?ml|toml";
export function codeRefHits(body) {
  const all = body.split(/\r?\n/);
  const hits = [];
  const pathRe = new RegExp(`[\\w./-]+\\.(?:${SRC_EXT})\\b`);
  const lineCiteRe = /[\w./-]+\.[a-z0-9]+:[0-9]+/;
  all.forEach((line, i) => {
    // Skip markdown-link targets pointing at .md (Related/table docs are allowed).
    const stripped = line.replace(/\([^)]*\.md[^)]*\)/g, "");
    if (pathRe.test(stripped) || lineCiteRe.test(stripped))
      hits.push({ line: i + 1, text: line.trim().slice(0, 120) });
  });
  return hits;
}

// ── mapping.json shape (subset of mapping.schema.json, hand-rolled) ───────
// No JSON-schema lib is vendored. Assert the load-bearing shape the skills and
// hook depend on. Returns an array of {level, code, msg}.
export function validateMappingShape(mapping) {
  const issues = [];
  const err = (code, msg) => issues.push({ level: "error", code, msg });
  const warn = (code, msg) => issues.push({ level: "warn", code, msg });

  if (mapping == null || typeof mapping !== "object") {
    err("not-object", ".mapping.json is not a JSON object");
    return issues;
  }
  const cats = mapping.categories;
  if (cats == null || typeof cats !== "object" || Array.isArray(cats)) {
    err("no-categories", "missing or non-object `categories`");
    return issues;
  }
  const seenAdrs = new Map(); // path → keys, to detect a file indexed twice
  for (const [key, entry] of Object.entries(cats)) {
    for (const iss of checkCategoryKey(key))
      err(
        `key-${iss.reason}`,
        `category key "${key}": ${iss.reason}${iss.segment ? ` (${iss.segment})` : ""}`,
      );
    if (entry == null || typeof entry !== "object" || Array.isArray(entry)) {
      err("entry-not-object", `category "${key}" entry is not an object`);
      continue;
    }
    // adrs: required (key present), array of strings, unique. Empty allowed —
    // a context-grouping entry may hold no context-direct ADR (its ADRs live
    // in feature sub-folder entries). See mapping.schema.json adrs note.
    if (!("adrs" in entry)) err("adrs-missing", `category "${key}": required "adrs" field absent`);
    else if (!Array.isArray(entry.adrs))
      err("adrs-not-array", `category "${key}": "adrs" is not an array`);
    else {
      for (const p of entry.adrs) {
        if (typeof p !== "string") {
          err("adrs-item-type", `category "${key}": non-string adrs entry`);
          continue;
        }
        const keys = seenAdrs.get(p) || [];
        keys.push(key);
        seenAdrs.set(p, keys);
      }
    }
    if ("subdomainType" in entry && !SUBDOMAIN_TYPES.has(entry.subdomainType))
      err(
        "subdomaintype-enum",
        `category "${key}": subdomainType "${entry.subdomainType}" not in core|supporting|generic`,
      );
    if ("dependsOn" in entry) {
      if (!Array.isArray(entry.dependsOn))
        err("dependson-not-array", `category "${key}": "dependsOn" is not an array`);
      else if (new Set(entry.dependsOn).size !== entry.dependsOn.length)
        err("dependson-dup", `category "${key}": duplicate dependsOn entries`);
    }
    if ("tableDocs" in entry && !Array.isArray(entry.tableDocs))
      err("tabledocs-not-array", `category "${key}": "tableDocs" is not an array`);
    for (const f of Object.keys(entry))
      if (!KNOWN_ENTRY_FIELDS.has(f))
        warn("unknown-field", `category "${key}": unknown field "${f}" (typo? silently ignored)`);
  }
  // a single ADR path indexed under two category keys
  for (const [p, keys] of seenAdrs)
    if (keys.length > 1)
      err("adr-double-indexed", `ADR "${p}" listed in multiple categories: ${keys.join(", ")}`);

  // dependsOn integrity (R16)
  for (const d of dependsOnDangling(mapping))
    err("dependson-dangling", `dependsOn references a missing category key: ${d}`);
  for (const k of selfEdges(mapping))
    err("dependson-self-edge", `category "${k}" depends on itself`);
  if (hasCycle(mapping)) err("dependson-cycle", "dependsOn graph has a cycle (not a DAG)");

  return issues;
}
