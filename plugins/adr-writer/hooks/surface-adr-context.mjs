#!/usr/bin/env node
// UserPromptSubmit — emit a short ADR-first directive plus the current
// docs/adr/.mapping.json snapshot every turn.
//
// Why every turn (not SessionStart): Claude Code compacts long sessions, and
// a one-shot SessionStart injection vanishes after compaction. A small
// per-turn directive survives because it is re-injected with each user turn.
//
// Why no regex: classifying "is this a feature request?" needs the full
// conversation context, file references, and git state. The main session
// model already has all of that and decides better than any keyword list
// or auxiliary LLM call. The directive just tells the model what cycle to
// apply when it judges the request as in-scope.

import path from "node:path";
import { readFileSync, existsSync } from "node:fs";

const MAPPING_PATH = process.env.ALPS_ADR_MAPPING || "docs/adr/.mapping.json";

// Drain stdin so Claude Code never sees a broken pipe. The prompt content
// is not parsed because intent classification belongs to the main model.
function drainStdin() {
  try {
    readFileSync(0);
  } catch {
    /* ignore */
  }
}

function loadJSON(p) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function summarizeMapping(mapping, cwd) {
  const cats = Object.entries(mapping?.categories || {});
  if (cats.length === 0) {
    return "(empty — no ADRs registered yet. Create one with /adr-new <category>, or with /feature-to-adr if you already have an ALPS Section 7 feature to convert.)";
  }
  const lines = [];
  for (const [cat, entry] of cats) {
    const fid = entry.alpsFeatureId ? ` [${entry.alpsFeatureId}]` : "";
    const feature = entry.feature ? ` — ${entry.feature}` : "";
    lines.push(`• ${cat}${fid}${feature}`);
    for (const adr of entry.adrs || []) {
      const exists = existsSync(path.join(cwd, adr)) ? "" : " [missing]";
      lines.push(`    ${adr}${exists}`);
    }
  }
  return lines.join("\n");
}

function main() {
  drainStdin();

  const cwd = process.cwd();
  const eventCwd = process.env.CLAUDE_PROJECT_DIR || cwd;
  const mappingFile = path.join(eventCwd, MAPPING_PATH);
  const mapping = loadJSON(mappingFile);

  // Stay quiet in repos that haven't opted into the cycle (no mapping file).
  if (!existsSync(mappingFile)) {
    process.stdout.write("{}\n");
    process.exit(0);
  }

  const directive = [
    "[ADR-first directive] 이번 사용자 요청이 신규 기능 추가나 기존 기능의 동작/구조 변경에 해당하는지 직접 판단하라. 단순 버그픽스, 리팩터링, lint/포맷, 문서 수정, 운영/배포 명령, 정보 조회는 면제다.",
    "",
    "해당한다면 다음 사이클을 따른다 — 사용자에게 한 줄로 'ADR을 먼저 점검/작성하겠다'고 알리고 진행:",
    "1. 아래 매핑 스냅샷에서 영향 받는 카테고리를 찾아 docs/adr/<category>/ 의 ADR을 먼저 읽는다. 신규 영역이면 /adr-new <category> 로 ADR을 직접 작성한다 (ALPS Section 7 feature가 이미 있다면 /feature-to-adr 로 일괄 변환해도 된다 — helper 경로).",
    "2. ADR을 짧게 작성/수정한다 — WHY, 대안 비교, Consequences, DB 키 디자인만. 구현 세부(파일 경로 이하·코드 스니펫·상수)는 넣지 않는다. 작성 규칙은 docs/adr/authoring-rules.md 를 따른다.",
    "3. ADR이 정한 결정대로 코드를 작성한다. 코드에는 ADR ID·경로를 박지 않고, ADR 본문에도 파일 경로·함수명을 박지 않는다(연결은 코드에도 ADR에도 두지 않는다 — 관련 코드는 ADR을 읽고 그때그때 찾는다). 구현 중 결정이 바뀌면 ADR을 즉시 갱신해 같은 커밋에 함께 담는다.",
    "4. 테스트/검증 결과로 ADR의 Consequences·엣지케이스를 보강한다. 끝나면 /adr-sync 로 ADR↔코드 정합과 README 인덱스를 정렬한다.",
    "",
    "면제 작업이라고 판단했다면 이 directive는 조용히 무시하고 평소대로 진행한다 — 사용자에게 면제 사실을 따로 알릴 필요는 없다.",
    "",
    "Current mapping (docs/adr/.mapping.json):",
    summarizeMapping(mapping, eventCwd),
  ].join("\n");

  const out = {
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: directive,
    },
  };
  process.stdout.write(JSON.stringify(out) + "\n");
  process.exit(0);
}

main();
