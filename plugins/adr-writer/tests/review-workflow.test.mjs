import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

function read(relativePath) {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("adr-impl-review isolates explanation, necessity, sufficiency, and report writing", () => {
  const skill = read("skills/adr-impl-review/SKILL.md");
  const agents = [
    ["agents/adr-impl-explainer.md", "name: adr-impl-explainer"],
    ["agents/adr-impl-necessity-reviewer.md", "name: adr-impl-necessity-reviewer"],
    ["agents/adr-impl-sufficiency-reviewer.md", "name: adr-impl-sufficiency-reviewer"],
    ["agents/adr-impl-review-report-writer.md", "name: adr-impl-review-report-writer"],
  ];

  for (const [file, name] of agents) {
    assert.match(read(file), new RegExp(name));
    assert.match(skill, new RegExp(name.replace("name: ", "")));
  }

  assert.match(skill, /Never proceed to the adversarial reviews before explicit confirmation/);
  assert.match(
    skill,
    /Never pass a reviewer the explanation document or the other reviewer's result/,
  );
  // Reviewer model diversification — run them on different families to break the
  // false consensus a single family reaches. Do not assert a specific model ID: models
  // are replaced faster than this skill, so pinning one makes the test hold a stale ID
  // in the prompt. Assert only the invariant properties (family separation, the top
  // reasoning tier, and the duty to record when diversification fails).
  assert.match(skill, /different model families/);
  assert.match(skill, /strongest reasoning models from different provider families/);
  assert.match(skill, /highest reasoning tier/);
  assert.match(skill, /Do not pin specific model IDs here/);
  assert.match(
    skill,
    /record in the report that models could not be diversified, along with the model each reviewer actually used/,
  );
  // No provider's model ID may be embedded in the prompt.
  assert.doesNotMatch(skill, /gpt-[0-9]|claude-[a-z0-9]|gemini-[0-9]/);
});

test("human gate asks a third spec-fitness question that reviewers never inherit", () => {
  const skill = read("skills/adr-impl-review/SKILL.md");
  // The third human-gate question: is the spec itself right (the spec axis, not the code).
  assert.match(skill, /confirm the following three questions/);
  assert.match(skill, /spec fitness/);
  assert.match(skill, /is the spec right/);
  // An inadequate spec is routed outward rather than fixed in code by impl-review.
  assert.match(
    skill,
    /whether the spec itself is right is asked only by the human at the section 2 gate/,
  );
  // The sufficiency reviewer keeps the contract of presuming the ADR is correct.
  const sufficiency = read("agents/adr-impl-sufficiency-reviewer.md");
  assert.match(sufficiency, /assume the ADR is correct/);
});

test("sufficiency reviewer tests the tests — mutation and static analysis as verification lenses", () => {
  const sufficiency = read("agents/adr-impl-sufficiency-reviewer.md");
  const skill = read("skills/adr-impl-review/SKILL.md");
  assert.match(sufficiency, /Testing the tests/);
  assert.match(sufficiency, /mutation/);
  assert.match(sufficiency, /Static\/security analysis/);
  // Use only already-configured tooling; never install anything new.
  assert.match(sufficiency, /already configured/);
  assert.match(sufficiency, /Do not install new tools/);
  assert.match(skill, /whether the tests actually catch defects/);
});

// Comments drift silently as code changes; a test fails loudly. So /adr-impl caps
// comments at ~3 lines and moves the enumerated behavior into tests, and the review
// side checks that the move actually happened. The dangerous half of this rule is the
// reverse direction: told only "shorten long comments", a reviewer deletes prose whose
// cases nothing covers, destroying the knowledge. Every stage must therefore carry both
// the cap AND the test-first ordering, plus the exemption for a *why* code cannot state.
test("the comment cap moves explanation into tests without ever dropping it", () => {
  const impl = read("skills/adr-impl/SKILL.md");
  // the cap, and that it is the WHAT that moves while a short WHY stays
  assert.match(impl, /three lines or fewer/);
  assert.match(impl, /move the [*_]what[*_] into tests/);
  // tests must read as documentation, or they cannot carry what the comment held
  assert.match(impl, /Write the tests so they read as the documentation/);
  // the guard: never trade coverage for brevity
  assert.match(impl, /Never trade coverage for brevity/);

  // the reviewers apply the same axis, and both know the ordering
  const sufficiency = read("agents/adr-impl-sufficiency-reviewer.md");
  const skill = read("skills/adr-impl-review/SKILL.md");
  for (const source of [sufficiency, skill]) {
    assert.match(source, /Do the code and tests carry the explanation/);
    // a comment whose cases are uncovered is a Test gap, never a delete-me
    // (the reviewer emphasizes the "not" as **not**, so allow the markup)
    assert.match(source, /[Nn]ever propose deleting a comment whose cases are \*{0,2}not\*{0,2}/);
    // a rationale code cannot express stays, even past the cap
    assert.match(source, /even beyond three lines/);
  }

  // the necessity pass must not treat these tests as removable scope — the mirror of
  // the rule that code enforcing a requirement value is contract, not excess
  const necessity = read("agents/adr-impl-necessity-reviewer.md");
  assert.match(necessity, /is not removable scope/);

  // and the merge checklist grounds Maintainability in that evidence
  const writer = read("agents/adr-impl-review-report-writer.md");
  assert.match(writer, /add the test first, then shorten the comment/);
});

test("junior repair report ends with a seven-axis merge-fitness checklist", () => {
  const writer = read("agents/adr-impl-review-report-writer.md");
  const skill = read("skills/adr-impl-review/SKILL.md");
  assert.match(writer, /Merge decision checklist/);
  const axes = [
    "Problem fitness",
    "Functional adequacy",
    "Contract compliance",
    "Change minimality",
    "Verification strength",
    "Operational safety",
    "Maintainability",
  ];
  for (const axis of axes) {
    // Case-insensitive: the writer names each axis as a table row ("Problem
    // fitness") while the skill lists them inline in prose ("problem fitness,
    // functional adequacy, ..."). The invariant is that both name the axis, not
    // that both capitalize it.
    assert.match(writer, new RegExp(axis, "i"));
    // the skill advertises the same axis list, or a caller writing the report
    // by hand (no subagent available) drops one silently
    assert.match(skill, new RegExp(axis, "i"), `SKILL.md must name the ${axis} axis`);
  }
  // Both must state the axis COUNT, so a dropped row is visible against it.
  // Spelled out ("seven axes" / "seven-axis") rather than digits, so key off the
  // word — and keep it derived from axes.length, so adding an axis here fails
  // until both documents are updated too.
  const COUNT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];
  const countWord = COUNT_WORDS[axes.length];
  assert.ok(countWord, `no spelled-out word for ${axes.length} axes — extend COUNT_WORDS`);
  assert.match(writer, new RegExp(`${countWord}[ -]ax(is|es)`, "i"));
  assert.match(skill, new RegExp(`${countWord}[ -]ax(is|es)`, "i"));
  // Problem fitness is a spec axis, so it is grounded in human-baseline and routed outward.
  assert.match(writer, /flagged the spec as inadequate/);
  // Contract compliance is a separate axis from functional adequacy — logic can exist while the value differs.
  assert.match(writer, /a different axis from functional adequacy/);
});

test("junior repair report requires grounded Mermaid and executable fix guidance", () => {
  const writer = read("agents/adr-impl-review-report-writer.md");

  assert.match(
    writer,
    /junior developer seeing this code for the first time can fix it from alone/,
  );
  assert.match(writer, /flowchart/);
  assert.match(writer, /sequenceDiagram/);
  assert.match(writer, /stateDiagram-v2/);
  assert.match(writer, /erDiagram/);
  assert.match(writer, /Never use ASCII or box-drawing diagrams/);
  assert.match(writer, /Draw only relationships confirmed in the actual code/);
  assert.match(writer, /Files and symbols to change/);
  assert.match(writer, /Scope not to touch/);
  assert.match(writer, /Completion criteria/);
  assert.match(writer, /Verification checklist/);
  assert.match(writer, /## 11\. Review limits and questions/);
});
