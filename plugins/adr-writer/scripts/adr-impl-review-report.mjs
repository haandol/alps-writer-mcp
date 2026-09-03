#!/usr/bin/env node
// adr-impl-review-report.mjs — render an ADR impl-review punch list as a
// self-contained HTML review page, and collect the user's per-finding
// decisions back as feedback.json.
//
// This is the full-mode "show the report, get feedback as a file" half of
// /adr-impl-review. Independent necessity and sufficiency reviewers produce
// evidence-backed findings with reviewMode: "full"; the main session serializes
// them to JSON and hands it here. We turn that JSON into ONE standalone HTML
// file — no server, no
// browser automation, no python. The page frames each finding as a docket
// item: the ADR decision (the intended design) set against the code as built,
// with a direction indicator that says which side is authoritative — so the
// reviewer can see the tension and rule on it (apply / skip / defer + a note).
// Material code-level choices absent from the ADR render as read-only context.
// "Export rulings" builds the JSON in-browser and downloads feedback.json,
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
//     "verdict":    "PASS" | "FIX_REQUIRED" | "INCONCLUSIVE" | "BLOCK", // required
//     "atAGlance": {                                      // required by validator
//       "impact": "observable user or operational effect",
//       "action": "next required action, or None",
//       "risk": "remaining uncertainty, or None"
//     },
//     "explanation":"/tmp/.../explanation.md",
//     "report":     "/tmp/.../implementation-review.md",
//     "scope":      ["src/checkout/handler.ts", "..."],   // code the reviewer read
//     "conventions":"AGENTS.md",                          // or "none"
//     "metrics": {
//       "elapsedSeconds": 342,
//       "necessityFindingCount": 1,
//       "sufficiencyFindingCount": 0,
//       "unverifiedRiskCount": 0,
//       "testCommandCount": 2
//     },
//     "findings": [                                       // required (may be [])
//       {
//         "id":       "f1",                               // stable id (auto if absent)
//         "category": "Spec violation",   // one of the recognized tags below
//         "perspective": "necessity" | "sufficiency" | "both",
//         "summary":  "family revocation on reuse detection is not implemented",
//         "adrQuote": "when reuse is detected, revoke the entire token family",  // ADR decision, 1 line
//         "code":     "src/auth/refresh.ts: on reuse it invalidates only that one token",
//         "fix":      "switch to family-level revocation",
//         "route":    "/adr-sync ordering/checkout",      // for Impl-fact mismatch
//         "basis":    "AGENTS.md §error-handling",         // for Best practice — the convention cited
//         "weight":   "now" | "next-cycle",               // TIMING axis (Refactor / Test gap)
//         "impact":   "low-effort/high-payoff",           // VALUE axis (Refactor / Test gap)
//         "confidence": "high" | "medium" | "low",         // evidence strength; low never pre-selects fix
//         "evidence": "why the claim is supported",
//         "test": "targeted command or proposed reproduction",
//         "testResult": "PASS/FAIL/NOT RUN plus the observed result"
//       }
//     ],
//     "implementationChoices": [                          // required (may be [])
//       {
//         "choice": "retry uses a 250 ms fixed delay",
//         "evidence": "src/client.ts:42 — retryDelayMs: 250",
//         "intentFit": "keeps the ADR's bounded retry and failure guarantees intact",
//         "whyItMatters": "changes recovery latency and upstream request rate"
//       }
//     ],
//     "comprehensionCheck": {                             // required by validator
//       "prGuidance": "Do not open or send the PR until all questions pass.",
//       "questions": [
//         {
//           "id": "Q1",
//           "question": "Why does provider failure leave the payment pending?",
//           "answerCriteria": "kept out of the visible HTML",
//           "evidence": "kept out of the visible HTML"
//         }
//       ]
//     },
//     "contractCoverage": [                               // required, non-empty
//       {
//         "contractId": "D0" | "R1" | "R2" | "...",
//         "requirement": "a payment is completed at most once",
//         "status": "PROVEN" | "VIOLATED" | "UNVERIFIED" | "CONTRADICTED",
//         "adrBasis": "Requirement contract — Required guarantees",
//         "implementation": "the write path rejects an existing idempotency key",
//         "evidence": "src/payments/settle.ts:42 — exact code or execution evidence",
//         "tests": "pnpm test -- settlement — PASS"
//       }
//     ],
//     "notes": "…"                                        // optional free text
//   }
//
// Recognized categories — the vocabulary, its colors, authority direction,
// default follow-up, and remediation order all live in
// scripts/adr-impl-review-categories.mjs, which adr-impl-review-validate.mjs
// validates against so the two cannot drift.
//
// The download (feedback.json) echoes every finding field back alongside the
// reviewer's ruling, so the main session can route follow-ups (fix / /adr-sync /
// ADR update) from the file alone — even across a context compaction where the
// original findings.json is no longer in context.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CATEGORIES, AUTHORITY, VERDICTS } from "./adr-impl-review-categories.mjs";

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

function inlineScriptJson(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (char) => {
    const escapes = {
      "<": "\\u003c",
      ">": "\\u003e",
      "&": "\\u0026",
      "\u2028": "\\u2028",
      "\u2029": "\\u2029",
    };
    return escapes[char];
  });
}

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
        `adr-impl-review-report: warning — unrecognized category "${category}" (finding ${f.id || i + 1}); rendered as uncategorized.\n`,
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
      perspective: f.perspective || "",
      evidence: f.evidence || "",
      test: f.test || "",
      testResult: f.testResult || "",
    };
  });
  // Stable sort by remediation priority; unknown categories float to the top so
  // they cannot hide. Array.prototype.sort is stable in Node, so ties keep the
  // reviewer's original ordering.
  return mapped
    .map((f, i) => ({ f, i }))
    .sort((a, b) => {
      const pa = a.f.unknownCat ? -1 : (CATEGORIES[a.f.category]?.priority ?? 99);
      const pb = b.f.unknownCat ? -1 : (CATEGORIES[b.f.category]?.priority ?? 99);
      return pa - pb || a.i - b.i;
    })
    .map((x) => x.f);
}

function normalizeImplementationChoices(data) {
  const choices = Array.isArray(data.implementationChoices) ? data.implementationChoices : [];
  return choices.map((choice) => ({
    choice: choice.choice || "",
    evidence: choice.evidence || "",
    intentFit: choice.intentFit || "",
    whyItMatters: choice.whyItMatters || "",
  }));
}

function normalizeAtAGlance(data) {
  const value =
    data.atAGlance && typeof data.atAGlance === "object" && !Array.isArray(data.atAGlance)
      ? data.atAGlance
      : {};
  return {
    impact: value.impact || "",
    action: value.action || "",
    risk: value.risk || "",
  };
}

function markdownSection(source, heading, nextHeadings) {
  const lines = String(source ?? "").split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) return "";
  const stop = new Set(nextHeadings.map((next) => `## ${next}`));
  const body = [];
  for (let index = start + 1; index < lines.length; index++) {
    if (stop.has(lines[index].trim())) break;
    body.push(lines[index]);
  }
  return body.join("\n").trim();
}

function loadExplanationSections(data, inputPath) {
  if (
    data.explanationSections &&
    typeof data.explanationSections === "object" &&
    !Array.isArray(data.explanationSections)
  ) {
    return data.explanationSections;
  }
  if (!data.report || typeof data.report !== "string") return {};

  const baseDir = inputPath === "-" ? process.cwd() : path.dirname(path.resolve(inputPath));
  const reportPath = path.isAbsolute(data.report)
    ? data.report
    : path.resolve(baseDir, data.report);
  if (!existsSync(reportPath)) return {};

  const report = readFileSync(reportPath, "utf8");
  return {
    background: markdownSection(report, "Background", ["Intuition"]),
    intuition: markdownSection(report, "Intuition", ["Code walkthrough"]),
    codeWalkthrough: markdownSection(report, "Code walkthrough", [
      "Visual map",
      "ADR contract coverage",
    ]),
  };
}

function normalizeExplanationSections(data) {
  const value =
    data.explanationSections &&
    typeof data.explanationSections === "object" &&
    !Array.isArray(data.explanationSections)
      ? data.explanationSections
      : {};
  return {
    background: value.background || "",
    intuition: value.intuition || "",
    codeWalkthrough: value.codeWalkthrough || "",
  };
}

function normalizeComprehensionCheck(data) {
  const value =
    data.comprehensionCheck &&
    typeof data.comprehensionCheck === "object" &&
    !Array.isArray(data.comprehensionCheck)
      ? data.comprehensionCheck
      : {};
  const questions = Array.isArray(value.questions) ? value.questions : [];
  return {
    prGuidance: value.prGuidance || "",
    questions: questions.map((question, index) => ({
      id: question.id || `Q${index + 1}`,
      question: question.question || "",
    })),
  };
}

function normalizeContractCoverage(data) {
  const rows = Array.isArray(data.contractCoverage) ? data.contractCoverage : [];
  return rows.map((row) => ({
    contractId: row.contractId || "",
    requirement: row.requirement || "",
    status: row.status || "UNVERIFIED",
    adrBasis: row.adrBasis || "",
    implementation: row.implementation || "",
    evidence: row.evidence || "",
    tests: row.tests || "",
  }));
}

function contractCoverageCard(row, index, total) {
  const idx = String(index + 1).padStart(2, "0");
  const status = String(row.status || "UNVERIFIED").toUpperCase();
  const statusClass = ["PROVEN", "VIOLATED", "UNVERIFIED", "CONTRADICTED"].includes(status)
    ? status.toLowerCase()
    : "unverified";

  return `
  <article class="coverage coverage--${statusClass}">
    <header class="finding__head">
      <span class="coverage__status">${esc(row.contractId)} · ${esc(status)}</span>
      <span class="finding__idx">${idx}<span class="finding__idx-total"> / ${String(total).padStart(2, "0")}</span></span>
    </header>
    <h3 class="finding__title">${esc(row.requirement) || "(no requirement)"}</h3>
    <div class="coverage__implementation">
      <span class="side__label">How the implementation meets it</span>
      <p>${esc(row.implementation)}</p>
    </div>
    <div class="meta">
      <div class="meta__row"><span class="meta__k">ADR</span><span class="meta__v">${esc(row.adrBasis)}</span></div>
      <div class="meta__row"><span class="meta__k">Evidence</span><span class="meta__v meta__v--mono">${esc(row.evidence)}</span></div>
      <div class="meta__row"><span class="meta__k">Tests</span><span class="meta__v meta__v--mono">${esc(row.tests)}</span></div>
    </div>
  </article>`;
}

function implementationChoiceCard(choice, index, total) {
  const idx = String(index + 1).padStart(2, "0");

  return `
  <article class="choice">
    <header class="finding__head">
      <span class="tag choice__tag">implementation choice</span>
      <span class="finding__idx">${idx}<span class="finding__idx-total"> / ${String(total).padStart(2, "0")}</span></span>
    </header>
    <h3 class="finding__title">${esc(choice.choice) || "(no choice)"}</h3>
    <div class="choice__value">
      <span class="side__label">Why it fits the ADR intent</span>
      <p>${esc(choice.intentFit)}</p>
    </div>
    <div class="meta">
      <div class="meta__row"><span class="meta__k">Evidence</span><span class="meta__v meta__v--mono">${esc(choice.evidence)}</span></div>
      <div class="meta__row"><span class="meta__k">Impact</span><span class="meta__v">${esc(choice.whyItMatters)}</span></div>
    </div>
  </article>`;
}

function comprehensionQuestionCard(question) {
  return `
  <article class="quiz">
    <span class="quiz__id">${esc(question.id)}</span>
    <p class="quiz__question">${esc(question.question)}</p>
  </article>`;
}

function explanationCard(title, body) {
  if (!body) return "";
  return `
  <section class="explanation">
    <h2 class="explanation__title">${esc(title)}</h2>
    <div class="explanation__body">${esc(body)}</div>
  </section>`;
}

function findingCard(f, i, total) {
  // Unrecognized category → a loud "uncategorized" card (bright orange, own blurb) so a
  // mislabeled finding demands attention instead of blending into advisory grey.
  const meta = f.unknownCat
    ? {
        hue: "#e8710a",
        blurb: `uncategorized "${f.category}" — possibly a typo in the subagent tag. Confirm the original intent before ruling.`,
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
  const tagText = f.unknownCat ? `uncategorized: ${f.category}` : f.category;
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
           <span class="side__label">ADR decision</span>
           <p class="side__body side__body--quote">${esc(f.adrQuote)}</p>
         </div>`
      : "";
    const codeSide = hasCode
      ? `<div class="side side--code">
           <span class="side__label">Current code</span>
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
  // advisory axes — weight (timing) and impact (effort×payoff), kept distinct so the
  // reviewer can tell a cheap high-value cleanup from an expensive low-value one.
  const meta_rows = [];
  if (f.fix)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">Suggestion</span><span class="meta__v">${esc(f.fix)}</span></div>`,
    );
  if (f.basis)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">Basis</span><span class="meta__v">${esc(f.basis)}</span></div>`,
    );
  if (f.route)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">Route</span><span class="meta__v meta__v--mono">${esc(f.route)}</span></div>`,
    );
  if (f.weight)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">Weight</span><span class="meta__v">${esc(f.weight)}</span></div>`,
    );
  if (f.impact)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">Impact</span><span class="meta__v">${esc(f.impact)}</span></div>`,
    );
  if (f.perspective)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">Perspective</span><span class="meta__v">${esc(f.perspective)}</span></div>`,
    );
  if (f.evidence)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">Evidence</span><span class="meta__v">${esc(f.evidence)}</span></div>`,
    );
  if (f.test)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">Test</span><span class="meta__v meta__v--mono">${esc(f.test)}</span></div>`,
    );
  if (f.testResult)
    meta_rows.push(
      `<div class="meta__row"><span class="meta__k">Result</span><span class="meta__v">${esc(f.testResult)}</span></div>`,
    );
  const metaBlock = meta_rows.length ? `<div class="meta">${meta_rows.join("")}</div>` : "";

  // Low-confidence findings must NOT pre-select "apply" — weak evidence should
  // not nudge the user toward a code change. Fall back to "defer" so the user
  // opts in deliberately.
  const conf = String(f.confidence || "").toLowerCase();
  const dec = conf === "low" && meta.defaultDecision === "fix" ? "defer" : meta.defaultDecision;
  const confChip =
    conf === "low" || conf === "medium" || conf === "high"
      ? `<span class="conf conf--${conf}" title="evidence strength">${conf}</span>`
      : "";
  const opt = (val, label) => {
    const id = `r-${i}-${val}`;
    return `<input type="radio" class="seg__input" id="${id}" name="dec-${i}" value="${val}"${
      dec === val ? " checked" : ""
    }><label class="seg__label" for="${id}">${label}</label>`;
  };

  return `
  <article class="finding" style="--sev:${meta.hue}">
    <header class="finding__head">
      <span class="tag">${esc(tagText)}</span>
      <span class="finding__head-right">${confChip}<span class="finding__idx">${idx}<span class="finding__idx-total"> / ${String(total).padStart(2, "0")}</span></span></span>
    </header>
    <h3 class="finding__title">${esc(f.summary) || "(no summary)"}</h3>
    ${meta.blurb ? `<p class="finding__blurb">${esc(meta.blurb)}</p>` : ""}
    ${confront}
    ${metaBlock}
    <footer class="ruling">
      <span class="ruling__label">Ruling</span>
      <div class="seg" role="radiogroup" aria-label="${esc(f.summary)} ruling">
        ${opt("fix", "apply")}
        ${opt("skip", "skip")}
        ${opt("defer", "defer")}
      </div>
      <textarea class="ruling__note" data-finding-index="${i}" rows="2" placeholder="note (optional) — the basis for your ruling, or the fix direction"></textarea>
    </footer>
  </article>`;
}

function buildHtml(data) {
  const adr = esc(data.adr || "(no path)");
  const status = esc(data.status || "");
  const verdictKey = (data.verdict || "").toUpperCase();
  const vmeta = VERDICTS[verdictKey] || { hue: "#566173", note: "" };
  const scope = Array.isArray(data.scope) ? data.scope : [];
  const metrics = data.metrics && typeof data.metrics === "object" ? data.metrics : null;
  const findings = normalizeFindings(data);
  const atAGlance = normalizeAtAGlance(data);
  const explanationSections = normalizeExplanationSections(data);
  const comprehensionCheck = normalizeComprehensionCheck(data);
  const contractCoverage = normalizeContractCoverage(data);
  const implementationChoices = normalizeImplementationChoices(data);
  const cards = findings.map((f, i) => findingCard(f, i, findings.length)).join("\n");
  const coverageCards = contractCoverage
    .map((row, index) => contractCoverageCard(row, index, contractCoverage.length))
    .join("\n");
  const choiceCards = implementationChoices
    .map((choice, index) => implementationChoiceCard(choice, index, implementationChoices.length))
    .join("\n");
  const comprehensionCards = comprehensionCheck.questions
    .map((question) => comprehensionQuestionCard(question))
    .join("\n");
  const count = findings.length;
  const coverageCount = contractCoverage.length;
  const choiceCount = implementationChoices.length;
  const provenCount = contractCoverage.filter((row) => row.status === "PROVEN").length;

  const empty =
    count === 0 && verdictKey === "PASS"
      ? `<div class="conforms">
           <div class="conforms__stamp">Conforms</div>
           <p class="conforms__lead">No unnecessary changes or counterexamples were confirmed.</p>
           <p class="conforms__sub">The contract coverage above contains the implementation and targeted-test evidence.</p>
         </div>`
      : count === 0
        ? `<div class="conforms">
             <div class="conforms__stamp">${esc(verdictKey || "unruled")}</div>
             <p class="conforms__lead">There are no confirmed findings, but the review did not complete.</p>
             <p class="conforms__sub">Address the verdict note above and the "needs confirmation" items in the detailed report first.</p>
           </div>`
        : "";

  // Embed the findings so the download echoes the original context back
  // alongside the reviewer's rulings — the main session gets both in one file.
  const embedded = inlineScriptJson({
    adr: data.adr || "",
    verdict: verdictKey,
    atAGlance,
    findings,
    contractCoverage,
    implementationChoices,
    comprehensionCheck,
  });

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

  .overview {
    background: var(--card); border: 1px solid var(--line); border-radius: 10px;
    padding: 16px 18px; margin: 18px 0 8px;
  }
  .overview__title {
    font: 700 11px/1 var(--mono); letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--ink-2); margin: 0 0 12px;
  }
  .overview__grid {
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px;
  }
  .overview__item {
    background: var(--paper); border: 1px solid var(--line);
    border-radius: 8px; padding: 11px 12px;
  }
  .overview__key {
    display: block; font: 700 10px/1 var(--mono); letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--ink-2); margin-bottom: 7px;
  }
  .overview__value { margin: 0; font-size: 13.5px; }
  .explanation {
    background: var(--card); border: 1px solid var(--line); border-radius: 10px;
    padding: 16px 18px; margin: 14px 0;
  }
  .explanation__title {
    font: 700 11px/1 var(--mono); letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--ink-2); margin: 0 0 12px;
  }
  .explanation__body {
    white-space: pre-wrap; font-size: 13.5px; overflow-wrap: anywhere;
  }

  .count { font: 600 11px/1 var(--mono); letter-spacing: 0.16em; text-transform: uppercase;
           color: var(--ink-2); margin: 22px 0 12px; }

  /* ── finding ───────────────────────────────────────────────────── */
  .finding {
    background: var(--card); border: 1px solid var(--line);
    border-left: 3px solid var(--sev); border-radius: 10px;
    padding: 16px 18px 14px; margin-bottom: 14px;
  }
  .coverage {
    --coverage: #566173;
    background: var(--card); border: 1px solid var(--line);
    border-left: 3px solid var(--coverage); border-radius: 8px;
    padding: 16px 18px 14px; margin-bottom: 14px;
  }
  .coverage--proven { --coverage: #2e7d4f; }
  .coverage--violated { --coverage: #c0362c; }
  .coverage--unverified { --coverage: #b4690e; }
  .coverage--contradicted { --coverage: #7b3f91; }
  .coverage__status {
    font: 700 10.5px/1 var(--mono); letter-spacing: 0.14em;
    color: var(--coverage);
  }
  .coverage__implementation {
    background: color-mix(in srgb, var(--coverage) 8%, var(--card));
    border: 1px solid var(--line); border-radius: 7px;
    padding: 11px 13px; margin: 10px 0 12px;
  }
  .coverage__implementation p { margin: 0; font-size: 13.5px; }
  .choice {
    background: var(--card); border: 1px solid var(--line);
    border-left: 3px solid #217a68; border-radius: 8px;
    padding: 16px 18px 14px; margin-bottom: 14px;
  }
  .choice__tag { background: #217a68; }
  .choice__value {
    background: color-mix(in srgb, #217a68 9%, var(--card));
    border: 1px solid var(--line); border-radius: 7px;
    padding: 11px 13px; margin: 10px 0 12px;
  }
  .choice__value p { margin: 0; font: 600 13.5px/1.5 var(--mono); word-break: break-word; }
  .quiz {
    background: var(--card); border: 1px solid var(--line);
    border-left: 3px solid #7457a6; border-radius: 8px;
    padding: 14px 16px; margin-bottom: 12px;
  }
  .quiz__id {
    display: block; font: 700 10.5px/1 var(--mono); letter-spacing: 0.14em;
    color: #7457a6; margin-bottom: 8px;
  }
  .quiz__question { margin: 0; font-size: 14px; }
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
    .overview__grid { grid-template-columns: 1fr; }
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
            ? `<div>Scope reviewed · ${scope.map((s) => `<code>${esc(s)}</code>`).join(" ")}</div>`
            : ""
        }
        ${data.conventions ? `<div>Project conventions · <code>${esc(data.conventions)}</code></div>` : ""}
        ${data.explanation ? `<div>Plain explanation · <code>${esc(data.explanation)}</code></div>` : ""}
        ${data.report ? `<div>Review report · <code>${esc(data.report)}</code></div>` : ""}
        ${
          metrics
            ? `<div>Review metrics · ${esc(metrics.elapsedSeconds)}s · necessity ${esc(metrics.necessityFindingCount)} · sufficiency ${esc(metrics.sufficiencyFindingCount)} · tests ${esc(metrics.testCommandCount)}</div>`
            : ""
        }
      </div>
    </div>
    <div class="stamp">
      <div class="stamp__k">VERDICT</div>
      <div class="stamp__v">${esc(verdictKey || "—")}</div>
    </div>
    ${vmeta.note ? `<p class="vnote">${esc(vmeta.note)}</p>` : ""}
  </header>

  ${
    atAGlance.impact || atAGlance.action || atAGlance.risk
      ? `<section class="overview">
           <h2 class="overview__title">At a glance</h2>
           <div class="overview__grid">
             <div class="overview__item"><span class="overview__key">Impact</span><p class="overview__value">${esc(atAGlance.impact || "Not provided")}</p></div>
             <div class="overview__item"><span class="overview__key">Action</span><p class="overview__value">${esc(atAGlance.action || "Not provided")}</p></div>
             <div class="overview__item"><span class="overview__key">Risk</span><p class="overview__value">${esc(atAGlance.risk || "Not provided")}</p></div>
           </div>
         </section>`
      : ""
  }

  ${explanationCard("Background", explanationSections.background)}
  ${explanationCard("Intuition", explanationSections.intuition)}
  ${explanationCard("Code walkthrough", explanationSections.codeWalkthrough)}

  ${
    coverageCount
      ? `<p class="count">ADR contract coverage · ${provenCount} / ${coverageCount} proven · read-only evidence</p>${coverageCards}`
      : ""
  }
  ${
    choiceCount
      ? `<p class="count">${choiceCount} notable implementation choice(s) · read-only context</p>${choiceCards}`
      : ""
  }
  ${empty}
  ${count ? `<p class="count">${count} finding(s) · rule on each one</p>` : ""}
  ${cards}

  ${
    comprehensionCheck.questions.length
      ? `<p class="count">Comprehension check · ${comprehensionCheck.questions.length} question(s) · PR gate</p>
         <section class="overview">
           <h2 class="overview__title">PR comprehension readiness</h2>
           <p class="overview__value">${esc(comprehensionCheck.prGuidance)}</p>
         </section>
         ${comprehensionCards}`
      : ""
  }

  ${
    data.notes
      ? `<section class="notes"><div class="notes__k">Notes</div><p class="notes__v">${esc(data.notes)}</p></section>`
      : ""
  }
</div>

<div class="bar">
  <div class="bar__inner">
    <span class="hint">Review the findings, add notes, then export.</span>
    <button class="export" id="export">Export rulings</button>
  </div>
</div>

<script>
  const EMBED = ${embedded};
  document.getElementById("export").addEventListener("click", () => {
    const reviews = EMBED.findings.map((f, index) => {
      const picked = document.querySelector('input[name="dec-' + index + '"]:checked');
      const note = document.querySelector('textarea.ruling__note[data-finding-index="' + index + '"]');
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
    const out = {
      adr: EMBED.adr,
      verdict: EMBED.verdict,
      contractCoverage: EMBED.contractCoverage,
      implementationChoices: EMBED.implementationChoices,
      comprehensionCheck: EMBED.comprehensionCheck,
      reviews,
      status: "complete",
    };
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
    btn.textContent = "Saved · feedback.json";
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
      "Usage: node adr-impl-review-report.mjs <findings.json|-> [--out PATH] [--stdout]\n",
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
  data.explanationSections = loadExplanationSections(data, opts.in);

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
