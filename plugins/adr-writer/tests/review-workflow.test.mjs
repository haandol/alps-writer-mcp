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

test("adr-impl-review isolates explanation, necessity, sufficiency, and report writing without a post-implementation gate", () => {
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

  assert.match(skill, /Build the review baseline without a post-implementation gate/);
  assert.match(skill, /do not stop to show it or ask the user to reconfirm/);
  assert.doesNotMatch(
    skill,
    /Never proceed to the adversarial reviews before explicit confirmation/,
  );
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
  assert.match(skill, /Notable implementation choices/);
  assert.match(
    skill,
    /selected value or behavior, code evidence, why it fits the ADR intent, and why it matters/i,
  );
  assert.match(skill, /progressive disclosure/i);
  assert.match(skill, /implementationChoices/);
  assert.match(skill, /contractCoverage/);
  assert.match(skill, /PROVEN.*VIOLATED.*UNVERIFIED.*CONTRADICTED/s);
  assert.match(skill, /caller always surfaces this human-readable package/i);
  assert.doesNotMatch(skill, /accept.*request change.*investigate/i);
  // No provider's model ID may be embedded in the prompt.
  assert.doesNotMatch(skill, /gpt-[0-9]|claude-[a-z0-9]|gemini-[0-9]/);
});

test("implementation review separates ADR decisions from code-level AI choices", () => {
  const impl = read("skills/adr-impl/SKILL.md");
  const review = read("skills/adr-impl-review/SKILL.md");
  const explainer = read("agents/adr-impl-explainer.md");
  const sufficiency = read("agents/adr-impl-sufficiency-reviewer.md");
  const reportWriter = read("agents/adr-impl-review-report-writer.md");

  assert.match(impl, /never written into the ADR/);
  assert.match(review, /admission gate/);
  assert.match(review, /Unverified risk/);
  assert.doesNotMatch(explainer, /Implementation choices not specified by the ADR/);
  assert.match(sufficiency, /Notable implementation choices/);
  assert.match(sufficiency, /not a finding and does not change the verdict/);
  assert.match(sufficiency, /Build Notable implementation choices once from code outward/);
  assert.match(sufficiency, /why it fits the ADR intent/);
  assert.match(sufficiency, /never invent historical rationale/i);
  assert.match(sufficiency, /externally checkable premises/i);
  assert.match(sufficiency, /Impact if false/i);
  assert.match(sufficiency, /Resolve requirement gaps with domain knowledge before escalation/i);
  assert.match(sufficiency, /Decision request/i);
  assert.match(review, /mark the affected coverage row `UNVERIFIED`/i);
  assert.match(review, /Do not reconstruct the implementer's private reasoning/i);
  assert.match(sufficiency, /Normalize each decision-ledger row into contract coverage/);
  assert.match(sufficiency, /replaceable tuning value or implementation means goes into/);
  assert.doesNotMatch(
    sufficiency,
    /Tuning values and replaceable libraries[\s\S]{0,200}are out of scope/,
  );
  assert.match(
    reportWriter,
    /These are material code-level choices the ADR intentionally does not own/,
  );
  assert.match(reportWriter, /Why it fits the ADR intent/);
  assert.match(reportWriter, /one row per independent ADR obligation/);
  assert.match(reportWriter, /do not amend the ADR/);
  assert.match(reportWriter, /Use progressive disclosure/);
  assert.match(reportWriter, /read-only/);
});

test("generic subagent fallbacks load agent instructions inside the child context", () => {
  const dispatch = read("references/subagent-dispatch.md");
  const skills = [
    read("skills/adr-review/SKILL.md"),
    read("skills/adr-impl-review/SKILL.md"),
    read("skills/adr-impl-refactor/SKILL.md"),
  ];

  for (const skill of skills) {
    assert.match(skill, /\$\{CLAUDE_PLUGIN_ROOT\}\/references\/subagent-dispatch\.md/);
    assert.match(skill, /read .* completely/i);
  }

  assert.match(dispatch, /absolute path/i);
  assert.match(dispatch, /read that file completely/i);
  assert.match(dispatch, /Do not load the agent file into the main session/);
  assert.match(dispatch, /fall back once to passing the file's full text/);
  assert.match(dispatch, /path-based context isolation was unavailable/);
  assert.match(dispatch, /never an instruction echo/);
});

test("Bedrock review paths avoid unsupported subagent dispatch and never retry the validation error", () => {
  const dispatch = read("references/subagent-dispatch.md");
  const review = read("skills/adr-review/SKILL.md");
  const implReview = read("skills/adr-impl-review/SKILL.md");
  const refactor = read("skills/adr-impl-refactor/SKILL.md");

  assert.match(dispatch, /Provider capability gate/);
  assert.match(dispatch, /active model provider is identified as Amazon Bedrock/);
  assert.match(dispatch, /treat subagents as unavailable/);
  assert.match(dispatch, /do not invoke either the named or generic path/);
  assert.match(dispatch, /validation_error/);
  assert.match(dispatch, /Invalid 'input': value did not match any expected variant/);
  assert.match(dispatch, /do not retry/);

  assert.match(review, /separate sequential pass per ADR/);
  assert.match(review, /passes were not isolated subagent contexts/);
  assert.match(implReview, /separate passes that do not read each other's results/);
  assert.match(refactor, /`PROPOSE_ONLY` main-session fallback/);
  assert.match(refactor, /must not classify or apply any candidate as `APPLY_NOW`/);
});

test("large skill details are loaded through explicit progressive-disclosure references", () => {
  const sync = read("skills/adr-sync/SKILL.md");
  const hygiene = read("skills/adr-sync/references/repository-hygiene.md");

  assert.match(sync, /read `references\/repository-hygiene\.md` completely/);
  assert.match(sync, /Do not read that reference.*when no candidate exists/);
  assert.match(
    sync,
    /Before starting Pass 2, read `references\/repository-hygiene\.md` completely/,
  );
  assert.doesNotMatch(sync, /^### 3\.5\./m);
  assert.ok(sync.trim().split(/\s+/).length < 5000, "adr-sync SKILL.md should stay below 5k words");

  for (const section of [
    "Category slice integrity",
    "Canonical stale Feature-ID naming",
    "Companion documents and invariants",
    "Mapping and index hygiene",
  ]) {
    assert.match(hygiene, new RegExp(`^## ${section}$`, "m"));
  }
});

test("Bedrock troubleshooting documents the supported Codex feature flag and review fallbacks", () => {
  const pluginReadme = read("README.md");
  const rootReadme = read("../../README.md");

  assert.match(pluginReadme, /Amazon Bedrock rejects a subagent request/);
  assert.match(pluginReadme, /developers\.openai\.com\/codex\/amazon-bedrock/);
  assert.match(pluginReadme, /developers\.openai\.com\/api\/docs\/guides\/responses-multi-agent/);
  assert.match(pluginReadme, /\[features\]\s+multi_agent = false/);
  assert.match(pluginReadme, /in the `~\/\.codex\/config\.toml` used by the Bedrock session/);
  assert.match(pluginReadme, /start a new Codex session/);
  assert.match(pluginReadme, /do not retry another named or generic subagent/);
  assert.match(pluginReadme, /never edits a user's Codex configuration automatically/);
  assert.doesNotMatch(pluginReadme, /agents\.enabled/);

  assert.match(
    rootReadme,
    /plugins\/adr-writer\/README\.md#amazon-bedrock-rejects-a-subagent-request/,
  );
});

test("user documentation reflects the pre-implementation baseline and single lifecycle hook", () => {
  const sources = [
    read("../../README.md"),
    read("README.md"),
    read("../../docs/usage.md"),
    read("../../docs/adr-process.md"),
  ];

  for (const source of sources) {
    assert.doesNotMatch(source, /full:\s*(human gate|사람 게이트)/i);
    assert.doesNotMatch(source, /full mode adds human intent/i);
  }

  const processReviewSection =
    sources[3].match(/## 5\. \/adr-impl-review[\s\S]*?(?=\n## 6\.)/)?.[0] ?? "";
  assert.notEqual(processReviewSection, "", "adr-process is missing the impl-review section");
  assert.doesNotMatch(processReviewSection, /human-baseline\.md|사람 게이트 — 세 가지 질문/);
  assert.doesNotMatch(processReviewSection, /사용자가 finding을 판정/);
  assert.match(processReviewSection, /review-baseline\.md/);
  assert.match(processReviewSection, /증거 기반 코드·테스트 수정 자동 반영/);

  assert.match(sources[0], /does not run for every user prompt/);
  assert.match(sources[0], /completion review does not repeat a routine human gate/);
  assert.match(sources[1], /there is no `UserPromptSubmit` hook/);
  assert.match(sources[2], /there is no per-prompt `UserPromptSubmit` hook/);
  assert.match(sources[2], /pre-approved ADR baseline/);
  assert.match(sources[3], /구현 전에 승인된 기준선/);
  assert.match(sources[0], /critical command paths, routing, and efficiency review/);
  assert.match(sources[2], /critical command paths, routing, and efficiency review/);
  assert.doesNotMatch(sources[0], /eight diagrams|one per command's internals/);
  assert.doesNotMatch(sources[2], /eight diagrams|one per command's internals/);
});

test("adr-sync names the current README and concepts split", () => {
  const sync = read("skills/adr-sync/SKILL.md");

  assert.match(sync, /README\/concepts split/);
  assert.match(sync, /concepts material sits inside `README\.md`/);
  assert.doesNotMatch(sync, /README\/AGENTS split|AGENTS material sits inside/);
});

test("adr-impl promotes only after verified refactoring, tests, and final review pass", () => {
  const impl = read("skills/adr-impl/SKILL.md");
  const initialTests = impl.indexOf("initial implementation tests pass");
  const refactor = impl.indexOf("/adr-impl-refactor <category>");
  const fullTests = impl.indexOf("full project test command", refactor);
  const finalReview = impl.indexOf("/adr-impl-review <category>", fullTests);
  const promotion = impl.indexOf("Automatic Status transition", finalReview);

  for (const [label, position] of [
    ["initial tests", initialTests],
    ["refactor pass", refactor],
    ["full test rerun", fullTests],
    ["Status promotion", promotion],
    ["final implementation review", finalReview],
  ]) {
    assert.notEqual(position, -1, `adr-impl is missing ${label}`);
  }

  assert.ok(initialTests < refactor, "refactoring must start only after the initial tests pass");
  assert.ok(refactor < fullTests, "the full test rerun must exercise the refactored code");
  assert.ok(fullTests < finalReview, "the final review must inspect tested, refactored code");
  assert.ok(finalReview < promotion, "Accepted must be gated by a passing final review");
  assert.match(impl, /Do not pass it the refactor review or result artifacts/);
  assert.match(impl, /On `FIX_REQUIRED`, preserve the current lifecycle state/);
  assert.match(impl, /`BLOCK` and unresolved `INCONCLUSIVE` preserve the current lifecycle state/);

  const finalReviewSkill = read("skills/adr-impl-review/SKILL.md");
  assert.match(finalReviewSkill, /Report-only/);
  assert.match(finalReviewSkill, /This command itself remains report-only/);
  assert.match(finalReviewSkill, /selected pre-promotion completion review/);
  assert.match(finalReviewSkill, /Select the review mode/);
  assert.match(finalReviewSkill, /Use `standard` only for localized implementation/);
  assert.match(finalReviewSkill, /Use `full` when any of these surfaces changes/);
  assert.match(finalReviewSkill, /In full mode, the necessity and sufficiency reviews run/);
  assert.match(finalReviewSkill, /Auto-remediate in the caller/);
  assert.match(finalReviewSkill, /must not ask the user to rule `apply \/ skip \/ defer`/);
  assert.match(finalReviewSkill, /no routine post-implementation approval remains/);
  assert.match(finalReviewSkill, /elapsed time, per-perspective finding counts/);

  assert.match(impl, /implementation intent baseline/);
  assert.match(impl, /once per ADR revision/);
  assert.match(impl, /reuse that approved baseline/);
  assert.match(impl, /non-blocking progress update/);
  assert.match(impl, /score is below `8\/10`[\s\S]{0,100}without asking for approval or waiting/i);
  assert.match(impl, /`8\/10` or higher[\s\S]{0,120}split-review-versus-original-ADR/i);
  assert.match(impl, /Do not include concrete split candidates/i);
  assert.match(impl, /publish the implementation plan as a progress update/i);
  assert.match(impl, /Do not demote an unchanged `Accepted` ADR to `Proposed`/i);
  assert.match(impl, /unchanged behavior-preserving reinforcement.*remains `Accepted`/i);
  assert.match(impl, /do not run the transition script/i);
  assert.doesNotMatch(impl, /only obtain normal approval for the implementation plan/i);
  assert.match(impl, /externally checkable assumption/i);
  assert.match(impl, /contract\/safety-affecting implementation premise unverified/i);
  assert.match(impl, /Resolve gaps before asking questions/i);
  assert.match(impl, /derived obligation/i);
  assert.match(impl, /Auto-resolve a domain default/i);
  assert.match(impl, /Decision request/i);
  assert.doesNotMatch(
    impl,
    /If an admitted decision or requirement changed, confirm once with the user/i,
  );
  assert.match(impl, /Do not repeat this routine confirmation after implementation/);
  assert.match(impl, /automatically apply evidence-backed changes/);
  assert.match(impl, /Do not ask the user to approve each repair/);
  assert.match(impl, /Do not ask for another approval/);
});

test("no maintenance command bypasses the final review when promoting Proposed", () => {
  const concepts = read("templates/adr/concepts.md");
  const sync = read("skills/adr-sync/SKILL.md");
  const rollup = read("skills/adr-rollup/SKILL.md");

  assert.match(
    concepts,
    /does \*\*not\*\* promote a `Proposed` ADR merely because code and tests exist/,
  );
  assert.match(sync, /Do \*\*not\*\* promote `Proposed` merely because code and tests exist/);
  assert.match(sync, /route it to `\/adr-impl <category>`/);
  assert.match(rollup, /every decision included in it came from already-`Accepted` ADRs/);
  assert.match(rollup, /tests and final implementation review pass/);
});

test("adr-impl-refactor auto-applies only locally verified behavior-preserving changes", () => {
  const skill = read("skills/adr-impl-refactor/SKILL.md");
  const reviewer = read("agents/adr-impl-refactor-reviewer.md");

  assert.match(skill, /dedicated read-only reviewer/);
  assert.match(skill, /With no target, show the `Accepted` ADR list/);
  assert.match(skill, /mixes several implementations/);
  assert.match(skill, /Auto-apply a candidate only when every condition holds/);
  assert.match(skill, /preserves the ADR decision, requirement contract, observable behavior/);
  assert.match(skill, /Confidence is `high`/);
  assert.match(skill, /tests passed before the change and can run after it/);
  assert.match(skill, /Critical priority never overrides the gate/);
  assert.match(skill, /undo only that candidate's edits/);
  assert.match(skill, /move the candidate to `PROPOSE_ONLY`/);
  assert.match(skill, /Do not use destructive worktree commands/);
  assert.match(skill, /must not classify or apply any candidate as `APPLY_NOW`/);
  assert.match(skill, /Main-session fallback findings are proposal-only/);

  for (const protectedSurface of [
    /APIs or wire forms/,
    /schemas or persistence/,
    /states or transitions/,
    /permissions or visibility/,
    /concurrency/,
    /transactions/,
    /error semantics/,
  ]) {
    assert.match(skill, protectedSurface);
  }

  assert.match(reviewer, /Never edit code, ADRs, tests, or the mapping/);
  assert.match(reviewer, /APPLY_NOW/);
  assert.match(reviewer, /PROPOSE_ONLY/);
  assert.match(reviewer, /A critical issue does not bypass this boundary/);
  assert.doesNotMatch(reviewer.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "", /Edit|Write/);
});

test("refactor review requires concrete efficiency evidence and proportionate reuse", () => {
  const skill = read("skills/adr-impl-refactor/SKILL.md");
  const reviewer = read("agents/adr-impl-refactor-reviewer.md");

  for (const source of [skill, reviewer]) {
    assert.match(source, /same-semantics duplication/);
    assert.match(source, /one caller/);
    assert.match(source, /hypothetical future/);
    assert.match(source, /speculative caching, concurrency, batching, or micro-optimization/);
  }

  assert.match(reviewer, /repeated parsing, serialization, traversal, lookup, allocation, I\/O/);
  assert.match(reviewer, /Require direct code evidence or a reproducible measurement/);
  assert.match(reviewer, /Do not merge code that only looks syntactically similar/);
  assert.match(skill, /priority, expected benefit, risk, estimated scope and verification/);
  assert.match(skill, /only when at least one candidate was kept/);
  assert.match(skill, /reuse the passing baseline/);
});

test("spec fitness is approved before implementation and not reopened as a routine completion gate", () => {
  const skill = read("skills/adr-impl-review/SKILL.md");
  const impl = read("skills/adr-impl/SKILL.md");
  const adrNew = read("skills/adr-new/SKILL.md");

  assert.match(adrNew, /complete regeneration checklist match your intent/);
  assert.match(adrNew, /routine intent\/spec-fitness confirmation/);
  assert.match(impl, /implementation intent baseline/);
  assert.match(impl, /complete enough to rebuild requirement-honoring code/);
  assert.match(skill, /does not reopen it as a routine post-implementation gate/);
  assert.match(skill, /Concrete evidence that the ADR itself is incomplete/);
  assert.doesNotMatch(skill, /confirm the following three questions/);

  // The sufficiency reviewer keeps the approved ADR as the contract.
  const sufficiency = read("agents/adr-impl-sufficiency-reviewer.md");
  assert.match(sufficiency, /assume the ADR is correct/);
  assert.match(sufficiency, /approved review baseline/);
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

test("implementation review keeps contract evidence without a mandatory merge checklist", () => {
  const writer = read("agents/adr-impl-review-report-writer.md");
  const skill = read("skills/adr-impl-review/SKILL.md");
  assert.match(writer, /ADR contract coverage/);
  assert.match(skill, /ADR contract coverage/);
  assert.match(writer, /PROVEN/);
  assert.match(skill, /contractCoverage/);
  assert.match(skill, /PASS.*every contract-coverage row.*PROVEN/is);
  assert.match(writer, /How the implementation meets it/);
  assert.match(writer, /Tests/);
  assert.match(writer, /short cells, not fewer columns/);
  assert.match(writer, /Do not collapse a material implementation choice into prose/);
  assert.match(skill, /short cells, not fewer columns/);
  assert.match(skill, /never replace the four-column implementation-choice table with prose/i);
  assert.match(writer, /Residual risks/);
  assert.doesNotMatch(writer, /Merge decision checklist/);
  assert.doesNotMatch(skill, /seven-axis merge decision checklist/);
});

test("repair guidance and Mermaid are conditional on the review evidence", () => {
  const writer = read("agents/adr-impl-review-report-writer.md");

  assert.match(writer, /FIX_REQUIRED|BLOCK/);
  assert.match(writer, /user asks/i);
  assert.match(writer, /only when/i);
  assert.match(writer, /flowchart/);
  assert.match(writer, /sequenceDiagram/);
  assert.match(writer, /stateDiagram-v2/);
  assert.match(writer, /erDiagram/);
  assert.match(writer, /Never use ASCII or box-drawing diagrams/);
  assert.match(writer, /Draw only relationships confirmed in the actual code/);
  assert.doesNotMatch(writer, /Include at least:/);
  assert.match(writer, /Files and symbols to change/);
  assert.match(writer, /Scope not to touch/);
  assert.match(writer, /Completion criteria/);
  assert.match(writer, /Residual risks/);
});
