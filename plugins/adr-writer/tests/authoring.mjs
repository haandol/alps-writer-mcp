// authoring.mjs — an executable model of the DETERMINISTIC contract that
// /adr-new and /adr-impl promise to produce.
//
// The skills themselves are LLM prompts, so node:test can't run them. But the
// artifacts they must emit — the seeded rule docs, the Proposed ADR file, the
// .mapping.json entry, the README index line, and the Proposed→Accepted Status
// flip — are all deterministic, and scripts/adr-structure-lint.mjs is the
// oracle for "were they emitted correctly?". These helpers reproduce those
// artifacts step by step so lifecycle.test.mjs can drive the full
// author→implement flow and assert the harness stays green, then prove each
// step is load-bearing (skip one → the harness goes red).
//
// Each function is annotated with the SKILL.md step it mirrors, so if a skill's
// deterministic contract changes, this file is the one place to update.
import { readFileSync, writeFileSync, copyFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { write, TEMPLATES } from "./helpers.mjs";

// /adr-new step 1 ("매핑 상태 점검") — first run in a repo with no docs/adr:
// seed the three rule docs from templates/ and an empty mapping skeleton.
export function seedScaffold(dir) {
  for (const f of ["README.md", "structure.md", "authoring-rules.md"])
    copyFileSync(path.join(TEMPLATES, f), write(dir, `docs/adr/${f}`, ""));
  write(dir, "docs/adr/.mapping.json", JSON.stringify({ categories: {} }, null, 2) + "\n");
  return dir;
}

// Build a well-formed ADR body. Every field defaults to a valid value; a test
// perturbs exactly one to exercise a single structure-lint rule.
export function adrBody({
  num = "0001",
  title = "제목",
  date = "2026-07-01",
  status = "Proposed",
  context = "이 결정이 필요한 배경.",
  drivers = ["옵션을 변별하는 제약 1", "제약 2", "제약 3"],
  decision = "사용자 동작 → API → 데이터 흐름으로 결정한다.",
  alternatives = ["대안 A: 채택 — 이유", "대안 B: 미채택 — 이유"],
  related = [], // array of { label, href }
} = {}) {
  const lines = [
    `# ADR ${num}: ${title}`,
    "",
    `Date: ${date}`,
    "",
    "## Status",
    "",
    status,
    "",
    "## Context",
    "",
    context,
    "",
    "## Decision Drivers",
    "",
    ...drivers.map((d) => `- ${d}`),
    "",
    "## Decision",
    "",
    decision,
    "",
    "### 대안 검토",
    "",
    ...alternatives.map((a) => `- ${a}`),
    "",
    "## Consequences",
    "",
    "### Positive",
    "",
    "- 긍정적 영향",
  ];
  if (related.length) {
    lines.push("", "## Related", "");
    for (const r of related) lines.push(`- [${r.label}](${r.href})`);
  }
  return lines.join("\n") + "\n";
}

// /adr-new step 3 — write docs/adr/<category>/NNNN-slug.md. Returns the
// repo-relative path (docs/adr/...) so the caller can register it in the map.
export function authorAdr(dir, { category, num = "0001", slug, ...body }) {
  const rel = `docs/adr/${category}/${num}-${slug}.md`;
  write(dir, rel, adrBody({ num, ...body }));
  return rel;
}

// /adr-new step 4 — merge a category entry into .mapping.json (create the
// entry or push onto an existing one's adrs[]). dependsOn defaults to [] per
// the skill rule "물어봤으면 [] 로 기록, 키 생략 금지".
export function registerMapping(
  dir,
  { key, feature, adr, dependsOn = [], alpsFeatureId, subdomainType },
) {
  const p = path.join(dir, "docs/adr/.mapping.json");
  const m = JSON.parse(readFileSync(p, "utf8"));
  m.categories ||= {};
  const entry = m.categories[key] || { adrs: [] };
  if (feature !== undefined) entry.feature = feature;
  if (alpsFeatureId !== undefined) entry.alpsFeatureId = alpsFeatureId;
  if (subdomainType !== undefined) entry.subdomainType = subdomainType;
  if (adr && !entry.adrs.includes(adr)) entry.adrs.push(adr);
  entry.dependsOn = dependsOn;
  m.categories[key] = entry;
  writeFileSync(p, JSON.stringify(m, null, 2) + "\n");
  return m;
}

// /adr-new step 5 — add a one-line index entry to README's category list.
// The link href ends with the ADR's path-relative-to-root so structure-lint's
// readmeLinksTo() resolves it.
export function indexInReadme(dir, { adr, summary = "" }) {
  const relFromAdr = adr.replace(/^docs\/adr\//, "");
  const line = `- [${path.basename(adr)}](./${relFromAdr})${summary ? ` — ${summary}` : ""}`;
  appendFileSync(path.join(dir, "docs/adr/README.md"), `\n${line}\n`);
}

// Compose the deterministic half of one /adr-new invocation: author + map +
// index. Returns the ADR's repo-relative path. (The reviewer/user-approval
// steps are LLM/interactive and out of scope for a deterministic test.)
export function adrNew(dir, opts) {
  const adr = authorAdr(dir, opts);
  registerMapping(dir, {
    key: opts.category,
    feature: opts.feature,
    adr,
    dependsOn: opts.dependsOn,
    alpsFeatureId: opts.alpsFeatureId,
    subdomainType: opts.subdomainType,
  });
  indexInReadme(dir, { adr, summary: opts.summary });
  return adr;
}

// /adr-impl step 6 — the automatic Proposed → Accepted (YYYY-MM-DD) promotion
// after tests pass. Rewrites only the value line under ## Status.
export function promote(dir, adr, date = "2026-07-02", status = `Accepted (${date})`) {
  const p = path.join(dir, adr);
  const src = readFileSync(p, "utf8");
  const out = src.replace(/(##\s+Status\s*\n\s*\n)([^\n]+)/, `$1${status}`);
  if (out === src) throw new Error(`promote: could not find Status line in ${adr}`);
  writeFileSync(p, out);
  return out;
}
