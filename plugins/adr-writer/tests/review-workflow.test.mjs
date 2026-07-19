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

  assert.match(skill, /명시적 확인 전에는 적대적 리뷰로 넘어가지 않는다/);
  assert.match(skill, /리뷰어에게 설명문이나 상대 리뷰 결과를 넘기지 않는다/);
  assert.match(skill, /openai\.gpt-5\.6-sol/);
  assert.match(skill, /reasoning_effort: high/);
  // 리뷰어 모델 다양화 — 같은 계열의 거짓 합의를 깨기 위해 서로 다른 모델로 돌린다.
  assert.match(skill, /서로 다른 모델 계열/);
  assert.match(skill, /다른 계열의 최고 추론 모델/);
});

test("human gate asks a third spec-fitness question that reviewers never inherit", () => {
  const skill = read("skills/adr-impl-review/SKILL.md");
  // 세 번째 인간 게이트 질문: 명세 자체가 옳은가 (코드가 아니라 명세 축).
  assert.match(skill, /다음 세 질문을 확인한다/);
  assert.match(skill, /명세 적합성/);
  assert.match(skill, /명세가 옳은가/);
  // 명세 부족은 impl-review가 코드로 고치지 않고 밖으로 라우팅한다.
  assert.match(skill, /명세 자체가 옳은지는 오직 2절 인간 게이트/);
  // 충분성 리뷰어는 ADR을 옳다고 전제하는 계약을 유지한다.
  const sufficiency = read("agents/adr-impl-sufficiency-reviewer.md");
  assert.match(sufficiency, /ADR 이 옳다고 전제/);
});

test("sufficiency reviewer tests the tests — mutation and static analysis as verification lenses", () => {
  const sufficiency = read("agents/adr-impl-sufficiency-reviewer.md");
  const skill = read("skills/adr-impl-review/SKILL.md");
  assert.match(sufficiency, /테스트의 테스트/);
  assert.match(sufficiency, /mutation/);
  assert.match(sufficiency, /정적\/보안 분석/);
  // 이미 구성된 도구만 쓰고 새로 설치하지 않는다.
  assert.match(sufficiency, /이미 구성/);
  assert.match(sufficiency, /새 도구를 설치하지 않는다/);
  assert.match(skill, /테스트가 결함을 실제로 잡는지/);
});

test("junior repair report ends with a six-axis merge-fitness checklist", () => {
  const writer = read("agents/adr-impl-review-report-writer.md");
  assert.match(writer, /머지 판정 체크리스트/);
  for (const axis of [
    "문제 적합성",
    "기능 충분성",
    "변경 최소성",
    "검증 강도",
    "운영 안전성",
    "유지보수성",
  ]) {
    assert.match(writer, new RegExp(axis));
  }
  // 문제 적합성은 명세 축이라 human-baseline을 근거로 삼고 밖으로 라우팅한다.
  assert.match(writer, /명세 부족을 지적했으면/);
});

test("junior repair report requires grounded Mermaid and executable fix guidance", () => {
  const writer = read("agents/adr-impl-review-report-writer.md");

  assert.match(writer, /처음 보는 주니어 개발자가 혼자 수정/);
  assert.match(writer, /flowchart/);
  assert.match(writer, /sequenceDiagram/);
  assert.match(writer, /stateDiagram-v2/);
  assert.match(writer, /erDiagram/);
  assert.match(writer, /ASCII\/box-drawing 다이어그램은 쓰지 않는다/);
  assert.match(writer, /실제 코드에서 확인한 관계만 Mermaid로 그린다/);
  assert.match(writer, /수정할 파일과 심볼/);
  assert.match(writer, /건드리지 말아야 할 범위/);
  assert.match(writer, /완료 조건/);
  assert.match(writer, /검증 체크리스트/);
});
