#!/usr/bin/env node
// adr-impl-review-report.mjs — render an ADR impl-review punch list as a
// self-contained HTML review page, and collect the user's per-finding
// decisions back as feedback.json.
//
// This is the "show the report, get feedback as a file" half of
// /adr-impl-review. The adr-impl-reviewer subagent produces the judgment (a
// punch list); the main session serializes it to a findings JSON and hands it
// here. We turn that JSON into ONE standalone HTML file — no server, no
// browser automation, no python. The page frames each finding as a docket
// item: the ADR decision (the intended design) set against the code as built,
// with a direction indicator that says which side is authoritative — so the
// reviewer can see the tension and rule on it (반영 / 무시 / 보류 + a note).
// "판정 내보내기" builds the JSON in-browser and downloads feedback.json,
// which the main session reads to route follow-ups (fix the code, /adr-sync,
// update the ADR).
//
// Why static HTML and not a served page: the rest of this plugin is
// dependency-free Node/bash by design (no external LLM calls, no runtime deps),
// and the report is opened from a local file that may be offline — so the page
// also relies only on system fonts, never a network font load. A single file
// the user opens, marks up, and re-uploads keeps the same zero-dependency
// stance a long-lived HTTP server would break.
//
// Usage:
//   node adr-impl-review-report.mjs <findings.json> [--out PATH] [--stdout]
//
//   <findings.json>   the punch list produced from the subagent's report
//                     (schema below). "-" reads the JSON from stdin.
//   --out PATH        where to write the HTML (default:
//                     <findings-dir>/adr-impl-review-report.html; with stdin
//                     input, defaults to ./adr-impl-review-report.html)
//   --stdout          write the HTML to stdout instead of a file
//
// Exit: 0 = wrote the report, 2 = usage / bad input.
//
// findings.json schema (all string fields optional unless noted):
//   {
//     "adr":        "docs/adr/ordering/checkout/0001-checkout.md",  // required
//     "status":     "Accepted (2026-07-10)",
//     "verdict":    "PASS" | "FIX_REQUIRED" | "BLOCK",              // required
//     "scope":      ["src/checkout/handler.ts", "..."],   // code the reviewer read
//     "conventions":"AGENTS.md",                          // or "없음"
//     "findings": [                                       // required (may be [])
//       {
//         "id":       "f1",                               // stable id (auto if absent)
//         "category": "Spec violation",   // one of the seven tags below (no brackets)
//         "summary":  "재사용 감지 시 계열 폐기가 구현되지 않음",
//         "adrQuote": "재사용이 감지되면 그 토큰 계열 전체를 폐기한다",  // ADR decision, 1 line
//         "code":     "src/auth/refresh.ts: 재사용해도 해당 토큰만 무효화",
//         "fix":      "계열(family) 단위 폐기로 바꾼다",
//         "route":    "/adr-sync ordering/checkout",      // for Impl-fact mismatch
//         "basis":    "AGENTS.md §error-handling",         // for Best practice — the convention cited
//         "weight":   "now" | "next-cycle",               // TIMING axis (Refactor / Test gap)
//         "impact":   "low-effort/high-payoff",           // VALUE axis (Refactor / Test gap)
//         "confidence": "high" | "medium" | "low"          // evidence strength; low never pre-selects fix
//       }
//     ],
//     "notes": "…"                                        // optional free text
//   }
//
// Recognized categories (drive color, authority direction, default follow-up):
//   Spec violation · Decision changed in code · Undecided behavior ·
//   Impl-fact mismatch · Best practice · Refactor · Test gap
//
// The download (feedback.json) echoes every finding field back alongside the
// reviewer's ruling, so the main session can route follow-ups (fix / /adr-sync /
// ADR update) from the file alone — even across a context compaction where the
// original findings.json is no longer in context.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// ── category metadata ───────────────────────────────────────────────────────
// label → { hue, blurb, authority, defaultDecision }.
//   hue             severity accent (left rule + tag).
//   authority       which side the confrontation resolves toward — this drives
//                   the direction indicator AND matches the SKILL routing:
//                     "adr"        ADR is the spec → fix the code
//                     "code"       code is authoritative on this fact → fix ADR
//                     "contested"  a real decision change → user must rule
//                     "convention" measured against project conventions
//                     "advisory"   decision-neutral, no ADR↔code tension
//   defaultDecision seeds the radio so the common follow-up is pre-selected
//                   while the user stays in control.
const CATEGORIES = {
  "Spec violation": {
    hue: "#c0362c",
    blurb: "코드가 ADR 결정을 지키지 않았다 — ADR이 스펙이므로 코드를 고칠 일.",
    authority: "adr",
    defaultDecision: "fix",
  },
  "Decision changed in code": {
    hue: "#b4690e",
    blurb: "코드가 다른, 그러나 일관된 결정을 구현했다 — ADR 갱신 vs 코드 원복, 사용자 판정.",
    authority: "contested",
    defaultDecision: "defer",
  },
  "Undecided behavior": {
    hue: "#c77b0e",
    blurb: "코드가 ADR이 결정하지 않은 동작을 더 한다(scope-creep) — ADR에 결정 추가 vs 코드에서 제거, 사용자 판정.",
    authority: "contested",
    defaultDecision: "defer",
  },
  "Impl-fact mismatch": {
    hue: "#6b3fa0",
    blurb: "ADR의 구현 사실이 코드와 다르다 — 코드가 권위, /adr-sync로 ADR을 정정.",
    authority: "code",
    defaultDecision: "defer",
  },
  "Best practice": {
    hue: "#1f5fa8",
    blurb: "프로젝트 규약(1차)/일반 패턴(2차) 위반 — 코드 개선 후보.",
    authority: "convention",
    defaultDecision: "fix",
  },
  Refactor: {
    hue: "#2e7d4f",
    blurb: "결정을 바꾸지 않고 정리할 수 있는 기회.",
    authority: "advisory",
    defaultDecision: "defer",
  },
  "Test gap": {
    hue: "#566173",
    blurb: "결정한 동작이 테스트로 검증되지 않았다.",
    authority: "advisory",
    defaultDecision: "defer",
  },
};

// authority → the center indicator between ADR and code.
const AUTHORITY = {
  adr: { glyph: "→", label: "ADR 기준", hint: "코드가 결정을 따라야 함" },
  code: { glyph: "←", label: "코드 기준", hint: "ADR을 코드에 맞춰 정정" },
  contested: { glyph: "⇄", label: "판정 필요", hint: "어느 쪽이 옳은지 결정" },
  convention: { glyph: "▸", label: "규약 기준", hint: "프로젝트 규약과 대조" },
  advisory: { glyph: "·", label: "권고", hint: "결정-중립" },
};

const VERDICTS = {
  PASS: { hue: "#2e7d4f", note: "회색지대 결정이 코드에 모두 반영됨 (advisory만 남음)." },
  FIX_REQUIRED: { hue: "#b4690e", note: "후속 조치 필요 — 코드 수정(Spec violation·Best practice), ADR 정정(Impl-fact mismatch → /adr-sync), 또는 사람 판정(Decision changed·Undecided)." },
  BLOCK: { hue: "#c0362c", note: "vertical slice 조각화·안티패턴·결정 역전 — 구조 조정 필요." },
};

// ── arg parse ────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = { in: null, out: null, stdout: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") opts.out = argv[++i];
    else if (a === "--stdout") opts.stdout = true;
    else if (a === "-h" || a === "--help") opts.help = true;
    else if (!opts.in) opts.in = a;
    else die(`unexpected argument: ${a}`);
  }
  return opts;
}

function die(msg) {
  process.stderr.write(`adr-impl-review-report: ${msg}\n`);
  process.exit(2);
}

// ── HTML helpers ─────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Remediation priority — lower sorts first. Code must-fix (Spec violation,
// Undecided behavior, Best practice) rises above ADR-side actions (Decision
// changed, Impl-fact mismatch) and advisory (Refactor, Test gap), so the docket
// reads top-to-bottom as "fix these first". Mirrors SKILL step 5 routing.
const PRIORITY = {
  "Spec violation": 0,
  "Undecided behavior": 1,
  "Best practice": 2,
  "Decision changed in code": 3,
  "Impl-fact mismatch": 4,
  Refactor: 5,
  "Test gap": 6,
};

function normalizeFindings(data) {
  const findings = Array.isArray(data.findings) ? data.findings : [];
  const known = Object.prototype.hasOwnProperty.bind(CATEGORIES);
  const mapped = findings.map((f, i) => {
    const category = f.category || "Refactor";
    // An unrecognized category (typo, brackets left on, wrong case) must not
    // silently sink into the grey advisory bucket — a mislabeled must-fix would
    // vanish. Flag it so the card renders a visible warning, and warn on stderr.
    const unknownCat = !known(category);
    if (unknownCat) {
      process.stderr.write(
        `adr-impl-review-report: warning — unrecognized category "${category}" (finding ${f.id || i + 1}); rendered as 미분류.\n`
      );
    }
    return {
      id: f.id || `f${i + 1}`,
      category,
      unknownCat,
      summary: f.summary || "",
      adrQuote: f.adrQuote || "",
      code: f.code || "",
      fix: f.fix || "",
      route: f.route || "",
      basis: f.basis || "",
      weight: f.weight || "",
      impact: f.impact || "",
      confidence: f.confidence || "",
    };
  });
  // Stable sort by remediation priority; unknown categories float to the top so
  // they cannot hide. Array.prototype.sort is stable in Node, so ties keep the
  // reviewer's original ordering.
  return mapped
    .map((f, i) => ({ f, i }))
    .sort((a, b) => {
      const pa = a.f.unknownCat ? -1 : PRIORITY[a.f.category] ?? 99;
      const pb = b.f.unknownCat ? -1 : PRIORITY[b.f.category] ?? 99;
      return pa - pb || a.i - b.i;
    })
    .map((x) => x.f);
}

function findingCard(f, i, total) {
  // Unrecognized category → a loud "미분류" card (bright orange, own blurb) so a
  // mislabeled finding demands attention instead of blending into advisory grey.
  const meta = f.unknownCat
    ? {
        hue: "#e8710a",
        blurb: `미분류 category "${f.category}" — subagent 태그 오탈자일 수 있음. 판정 전 원래 의도를 확인하세요.`,
        authority: "contested",
        defaultDecision: "defer",
      }
    : CATEGORIES[f.category] || {
        hue: "#566173",
        blurb: "",
        authority: "advisory",
        defaultDecision: "defer",
      };
  const auth = AUTHORITY[meta.authority] || AUTHORITY.advisory;
  const tagText = f.unknownCat ? `미분류: ${f.category}` : f.category;
  const idx = String(i + 1).padStart(2, "0");

  // Confrontation: the ADR decision vs the code as built. Render the center
  // direction indicator only when both sides are present; degrade to a single
  // column (or drop the block entirely for advisory findings) otherwise.
  const hasAdr = !!f.adrQuote;
  const hasCode = !!f.code;
  let confront = "";
  if (hasAdr || hasCode) {
    const adrSide = hasAdr
      ? `<div class="side side--adr">
           <span class="side__label">ADR 결정</span>
           <p class="side__body side__body--quote">${esc(f.adrQuote)}</p>
         </div>`
      : "";
    const codeSide = hasCode
      ? `<div class="side side--code">
           <span class="side__label">현재 코드</span>
           <p class="side__body side__body--mono">${esc(f.code)}</p>
         </div>`
      : "";
    const center =
      hasAdr && hasCode
        ? `<div class="rel" title="${esc(auth.hint)}">
             <span class="rel__glyph">${auth.glyph}</span>
             <span class="rel__label">${esc(auth.label)}</span>
           </div>`
        : "";
    const single = hasAdr && hasCode ? "" : " confront--single";
    confront = `<div class="confront${single}">${adrSide}${center}${codeSide}</div>`;
  }

  // Follow-up meta: suggested action, sync route, convention basis, and the two
  // advisory axes — 무게 (timing) and 효과 (effort×payoff), kept distinct so the
  // reviewer can tell a cheap high-value cleanup from an expensive low-value one.
  const meta_rows = [];
  if (f.fix)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">제안</span><span class="meta__v">${esc(f.fix)}</span></div>`
    );
  if (f.basis)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">근거</span><span class="meta__v">${esc(f.basis)}</span></div>`
    );
  if (f.route)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">경로</span><span class="meta__v meta__v--mono">${esc(f.route)}</span></div>`
    );
  if (f.weight)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">무게</span><span class="meta__v">${esc(f.weight)}</span></div>`
    );
  if (f.impact)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">효과</span><span class="meta__v">${esc(f.impact)}</span></div>`
    );
  const metaBlock = meta_rows.length ? `<div class="meta">${meta_rows.join("")}</div>` : "";

  // Low-confidence findings must NOT pre-select "반영" — weak evidence should
  // not nudge the user toward a code change. Fall back to "보류" so the user
  // opts in deliberately.
  const conf = String(f.confidence || "").toLowerCase();
  const dec = conf === "low" && meta.defaultDecision === "fix" ? "defer" : meta.defaultDecision;
  const confChip =
    conf === "low" || conf === "medium" || conf === "high"
      ? `<span class="conf conf--${conf}" title="증거 강도">${conf}</span>`
      : "";
  const opt = (val, label) => {
    const id = `r-${esc(f.id)}-${val}`;
    return `<input type="radio" class="seg__input" id="${id}" name="dec-${esc(f.id)}" value="${val}"${
      dec === val ? " checked" : ""
    }><label class="seg__label" for="${id}">${label}</label>`;
  };

  return `
  <article class="finding" style="--sev:${meta.hue}">
    <header class="finding__head">
      <span class="tag">${esc(tagText)}</span>
      <span class="finding__head-right">${confChip}<span class="finding__idx">${idx}<span class="finding__idx-total"> / ${String(total).padStart(2, "0")}</span></span></span>
    </header>
    <h3 class="finding__title">${esc(f.summary) || "(요약 없음)"}</h3>
    ${meta.blurb ? `<p class="finding__blurb">${esc(meta.blurb)}</p>` : ""}
    ${confront}
    ${metaBlock}
    <footer class="ruling">
      <span class="ruling__label">판정</span>
      <div class="seg" role="radiogroup" aria-label="${esc(f.summary)} 판정">
        ${opt("fix", "반영")}
        ${opt("skip", "무시")}
        ${opt("defer", "보류")}
      </div>
      <textarea class="ruling__note" data-fid="${esc(f.id)}" rows="2" placeholder="note (선택) — 판정 근거나 수정 방향"></textarea>
    </footer>
  </article>`;
}

function buildHtml(data) {
  const adr = esc(data.adr || "(경로 없음)");
  const status = esc(data.status || "");
  const verdictKey = (data.verdict || "").toUpperCase();
  const vmeta = VERDICTS[verdictKey] || { hue: "#566173", note: "" };
  const scope = Array.isArray(data.scope) ? data.scope : [];
  const findings = normalizeFindings(data);
  const cards = findings.map((f, i) => findingCard(f, i, findings.length)).join("\n");
  const count = findings.length;

  const empty =
    count === 0
      ? `<div class="conforms">
           <div class="conforms__stamp">적합</div>
           <p class="conforms__lead">이 ADR의 결정이 코드에 모두 반영되었습니다.</p>
           <p class="conforms__sub">고칠 항목이 없습니다. advisory가 있었다면 다음 사이클에 반영하세요.</p>
         </div>`
      : "";

  // Embed the findings so the download echoes the original context back
  // alongside the reviewer's rulings — the main session gets both in one file.
  const embedded = JSON.stringify(
    { adr: data.adr || "", verdict: verdictKey, findings },
    null,
    0
  );

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ADR Impl Review — ${adr}</title>
<style>
  :root {
    color-scheme: light dark;
    --sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    --mono: ui-monospace, "SF Mono", SFMono-Regular, "Cascadia Code", Menlo, Consolas, monospace;
    --paper: #e6eaee;
    --card: #fcfdfe;
    --ink: #1b2431;
    --ink-2: #586372;
    --line: #d3dae1;
    --adr-wash: #e9eff5;   /* cool — the intended design (blueprint) */
    --code-wash: #f5f0e9;  /* warm — the thing as built (material)   */
    --focus: #1f5fa8;
    --verdict: ${vmeta.hue};
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --paper: #14171b;
      --card: #1e232a;
      --ink: #e4e8ed;
      --ink-2: #9aa4b0;
      --line: #2c333c;
      --adr-wash: #1b2530;
      --code-wash: #2a2620;
      --focus: #5b9bd8;
    }
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0; background: var(--paper); color: var(--ink);
    font: 15px/1.6 var(--sans);
    padding-bottom: 96px;
  }
  .wrap { max-width: 860px; margin: 0 auto; padding: 40px 20px 32px; }

  /* ── docket header ─────────────────────────────────────────────── */
  .doc {
    display: flex; flex-wrap: wrap; gap: 18px 24px;
    align-items: flex-start; justify-content: space-between;
    padding-bottom: 18px; margin-bottom: 8px;
    border-bottom: 2px solid var(--verdict);
  }
  .doc__id { min-width: 0; flex: 1 1 320px; }
  .eyebrow {
    font: 600 11px/1 var(--mono); letter-spacing: 0.22em; text-transform: uppercase;
    color: var(--ink-2); margin: 0 0 10px;
  }
  .doc__path {
    font: 500 15px/1.45 var(--mono); color: var(--ink);
    word-break: break-all; margin: 0;
  }
  .doc__status { font: 500 12px/1 var(--mono); color: var(--ink-2); margin-top: 8px; }
  .doc__meta { margin-top: 12px; font-size: 12.5px; color: var(--ink-2); }
  .doc__meta div { margin-top: 3px; }
  .doc__meta code {
    font: 12px/1.5 var(--mono);
    background: color-mix(in srgb, var(--ink) 6%, transparent);
    padding: 1px 5px; border-radius: 4px;
  }

  /* verdict stamp */
  .stamp {
    flex: 0 0 auto; text-align: center;
    border: 2px solid var(--verdict); border-radius: 8px;
    padding: 10px 16px; box-shadow: inset 0 0 0 2px var(--card), inset 0 0 0 3px var(--verdict);
    background: color-mix(in srgb, var(--verdict) 8%, var(--card));
  }
  .stamp__k { font: 600 9px/1 var(--mono); letter-spacing: 0.24em; color: var(--ink-2); }
  .stamp__v { font: 700 20px/1.1 var(--mono); letter-spacing: 0.06em; color: var(--verdict); margin-top: 6px; }
  .vnote { flex: 1 1 100%; font-size: 13px; color: var(--ink-2); margin: 2px 0 0; }

  .count { font: 600 11px/1 var(--mono); letter-spacing: 0.16em; text-transform: uppercase;
           color: var(--ink-2); margin: 22px 0 12px; }

  /* ── finding ───────────────────────────────────────────────────── */
  .finding {
    background: var(--card); border: 1px solid var(--line);
    border-left: 3px solid var(--sev); border-radius: 10px;
    padding: 16px 18px 14px; margin-bottom: 14px;
  }
  .finding__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .tag {
    font: 600 10.5px/1 var(--mono); letter-spacing: 0.14em; text-transform: uppercase;
    color: #fff; background: var(--sev); padding: 4px 9px; border-radius: 5px;
  }
  .finding__head-right { display: inline-flex; align-items: center; gap: 10px; }
  .finding__idx { font: 600 12px/1 var(--mono); color: var(--sev); }
  .finding__idx-total { color: var(--ink-2); font-weight: 500; }
  .conf { font: 600 9.5px/1 var(--mono); letter-spacing: 0.1em; text-transform: uppercase;
          padding: 3px 7px; border-radius: 4px; border: 1px solid var(--line); color: var(--ink-2); }
  .conf--high { color: #2e7d4f; border-color: color-mix(in srgb, #2e7d4f 45%, var(--line)); }
  .conf--medium { color: #b4690e; border-color: color-mix(in srgb, #b4690e 45%, var(--line)); }
  .conf--low { color: #c0362c; border-color: color-mix(in srgb, #c0362c 45%, var(--line)); }
  .finding__title {
    font: 660 17px/1.35 var(--sans); letter-spacing: -0.01em;
    margin: 11px 0 5px;
  }
  .finding__blurb { font-size: 13px; color: var(--ink-2); margin: 0 0 14px; }

  /* confrontation: ADR decision vs code as built */
  .confront {
    display: grid; grid-template-columns: 1fr auto 1fr; align-items: stretch;
    gap: 0; border: 1px solid var(--line); border-radius: 8px; overflow: hidden;
    margin-bottom: 12px;
  }
  .confront--single { grid-template-columns: 1fr; }
  .side { padding: 11px 13px; min-width: 0; }
  .side--adr { background: var(--adr-wash); }
  .side--code { background: var(--code-wash); }
  .side__label {
    display: block; font: 600 10px/1 var(--mono); letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--ink-2); margin-bottom: 7px;
  }
  .side__body { margin: 0; font-size: 13.5px; }
  .side__body--quote { font-style: normal; color: var(--ink); }
  .side__body--mono { font: 12.5px/1.5 var(--mono); color: var(--ink); word-break: break-word; }
  .rel {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 4px; padding: 8px 12px; background: var(--card);
    border-left: 1px solid var(--line); border-right: 1px solid var(--line);
  }
  .rel__glyph { font: 600 18px/1 var(--mono); color: var(--sev); }
  .rel__label { font: 600 9px/1.1 var(--mono); letter-spacing: 0.08em; text-transform: uppercase;
                color: var(--ink-2); text-align: center; white-space: nowrap; }

  .meta { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
  .meta__row { display: flex; gap: 10px; font-size: 13px; }
  .meta__k { flex: 0 0 42px; font: 600 11px/1.5 var(--mono); letter-spacing: 0.08em;
             text-transform: uppercase; color: var(--ink-2); }
  .meta__v { flex: 1; }
  .meta__v--mono { font: 12.5px/1.5 var(--mono); }

  /* ruling — segmented control + note */
  .ruling { border-top: 1px dashed var(--line); padding-top: 12px; }
  .ruling__label { display: block; font: 600 10px/1 var(--mono); letter-spacing: 0.16em;
                   text-transform: uppercase; color: var(--ink-2); margin-bottom: 8px; }
  .seg { display: inline-flex; border: 1px solid var(--line); border-radius: 7px;
         overflow: hidden; margin-bottom: 10px; }
  .seg__input { position: absolute; opacity: 0; pointer-events: none; }
  .seg__label {
    font: 600 13px/1 var(--sans); padding: 8px 18px; cursor: pointer;
    color: var(--ink-2); background: var(--card); border-left: 1px solid var(--line);
    transition: background 0.12s, color 0.12s;
  }
  .seg__label:first-of-type { border-left: none; }
  .seg__input:checked + .seg__label { background: var(--ink); color: var(--card); }
  .seg__input:focus-visible + .seg__label { outline: 2px solid var(--focus); outline-offset: -2px; }
  .seg__label:hover { color: var(--ink); }
  .seg__input:checked + .seg__label:hover { color: var(--card); }
  .ruling__note {
    display: block; width: 100%; font: 13.5px/1.5 var(--sans);
    padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px;
    background: var(--paper); color: var(--ink); resize: vertical;
  }
  .ruling__note:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; border-color: var(--focus); }

  /* notes footer */
  .notes { background: var(--card); border: 1px solid var(--line); border-radius: 10px;
           padding: 14px 18px; margin-top: 4px; }
  .notes__k { font: 600 10px/1 var(--mono); letter-spacing: 0.16em; text-transform: uppercase;
              color: var(--ink-2); }
  .notes__v { font-size: 13.5px; color: var(--ink); margin: 8px 0 0; }

  /* conforming (empty) state */
  .conforms { text-align: center; padding: 48px 24px; }
  .conforms__stamp {
    display: inline-block; font: 700 22px/1 var(--mono); letter-spacing: 0.1em;
    color: var(--verdict); border: 2px solid var(--verdict); border-radius: 10px;
    padding: 14px 28px; box-shadow: inset 0 0 0 2px var(--card), inset 0 0 0 3px var(--verdict);
    background: color-mix(in srgb, var(--verdict) 8%, var(--card));
  }
  .conforms__lead { font: 660 17px/1.4 var(--sans); margin: 20px 0 4px; }
  .conforms__sub { font-size: 13.5px; color: var(--ink-2); margin: 0; }

  /* ── action bar ────────────────────────────────────────────────── */
  .bar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 5;
    background: color-mix(in srgb, var(--card) 92%, transparent);
    backdrop-filter: saturate(180%) blur(8px);
    border-top: 1px solid var(--line);
    padding: 12px 20px;
  }
  .bar__inner { max-width: 860px; margin: 0 auto; display: flex; align-items: center;
                justify-content: space-between; gap: 16px; }
  .hint { font-size: 12.5px; color: var(--ink-2); }
  button.export {
    font: 600 14px/1 var(--sans); padding: 11px 22px; border: 1px solid var(--ink);
    border-radius: 8px; background: var(--ink); color: var(--card); cursor: pointer;
    transition: opacity 0.12s;
  }
  button.export:hover { opacity: 0.88; }
  button.export:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  button.export.done { background: #2e7d4f; border-color: #2e7d4f; }

  @media (max-width: 620px) {
    .confront, .confront--single { grid-template-columns: 1fr; }
    .rel { flex-direction: row; gap: 8px; border-left: none; border-right: none;
           border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
    .rel__glyph { transform: rotate(90deg); }
    .bar__inner { flex-direction: column; align-items: stretch; }
    .bar .hint { text-align: center; }
    button.export { width: 100%; }
  }
  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header class="doc">
    <div class="doc__id">
      <p class="eyebrow">ADR IMPL REVIEW</p>
      <p class="doc__path">${adr}</p>
      ${status ? `<div class="doc__status">${status}</div>` : ""}
      <div class="doc__meta">
        ${
          scope.length
            ? `<div>검토 범위 · ${scope.map((s) => `<code>${esc(s)}</code>`).join(" ")}</div>`
            : ""
        }
        ${data.conventions ? `<div>프로젝트 규약 · <code>${esc(data.conventions)}</code></div>` : ""}
      </div>
    </div>
    <div class="stamp">
      <div class="stamp__k">VERDICT</div>
      <div class="stamp__v">${esc(verdictKey || "—")}</div>
    </div>
    ${vmeta.note ? `<p class="vnote">${esc(vmeta.note)}</p>` : ""}
  </header>

  ${count ? `<p class="count">지적 ${count}건 · 항목마다 판정하세요</p>` : ""}
  ${empty}
  ${cards}

  ${
    data.notes
      ? `<section class="notes"><div class="notes__k">부기</div><p class="notes__v">${esc(data.notes)}</p></section>`
      : ""
  }
</div>

<div class="bar">
  <div class="bar__inner">
    <span class="hint">각 지적에 판정을 내리고 필요하면 note를 남긴 뒤 내보내세요.</span>
    <button class="export" id="export">판정 내보내기</button>
  </div>
</div>

<script>
  const EMBED = ${embedded};
  document.getElementById("export").addEventListener("click", () => {
    const reviews = EMBED.findings.map((f) => {
      const picked = document.querySelector('input[name="dec-' + f.id + '"]:checked');
      const note = document.querySelector('textarea.ruling__note[data-fid="' + f.id + '"]');
      // Echo the whole finding back (route/fix/adrQuote/code/basis/weight/…)
      // and add the ruling, so feedback.json is a self-contained handoff: the
      // main session can route follow-ups from the file alone even after a
      // context compaction dropped the original findings.json.
      return {
        ...f,
        finding_id: f.id,
        decision: picked ? picked.value : "defer",
        comment: note ? note.value.trim() : "",
      };
    });
    const out = { adr: EMBED.adr, verdict: EMBED.verdict, reviews, status: "complete" };
    const blob = new Blob([JSON.stringify(out, null, 2) + "\\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "feedback.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    const btn = document.getElementById("export");
    btn.textContent = "저장됨 · feedback.json";
    btn.classList.add("done");
  });
</script>
</body>
</html>`;
}

// ── main ─────────────────────────────────────────────────────────────────────
function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.in) {
    process.stdout.write(
      "Usage: node adr-impl-review-report.mjs <findings.json|-> [--out PATH] [--stdout]\n"
    );
    process.exit(opts.help ? 0 : 2);
  }

  let raw;
  try {
    raw = opts.in === "-" ? readFileSync(0, "utf8") : readFileSync(opts.in, "utf8");
  } catch (e) {
    die(`cannot read ${opts.in}: ${e.message}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    die(`findings JSON is not valid JSON: ${e.message}`);
  }
  if (!data || typeof data !== "object") die("findings JSON must be an object");
  if (!data.adr) die("findings JSON missing required field: adr");
  if (!data.verdict) die("findings JSON missing required field: verdict");

  const html = buildHtml(data);

  if (opts.stdout) {
    process.stdout.write(html);
    return;
  }

  let outPath = opts.out;
  if (!outPath) {
    const dir = opts.in === "-" ? process.cwd() : path.dirname(path.resolve(opts.in));
    outPath = path.join(dir, "adr-impl-review-report.html");
  }
  try {
    writeFileSync(outPath, html);
  } catch (e) {
    die(`cannot write ${outPath}: ${e.message}`);
  }
  process.stdout.write(`wrote ${outPath}\n`);
}

main();
