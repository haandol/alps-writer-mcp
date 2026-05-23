---
name: feature-to-adr
description: Helper — convert ALPS Section 7 feature(s) into Proposed ADR drafts and seed docs/adr/.mapping.json. Use only when an ALPS PRD already exists; for direct ADR authoring use /adr-new instead. Keywords - "/feature-to-adr", "ALPS feature ADR 변환", "Section 7 일괄 ADR".
argument-hint: "[category-or-feature-id?]"
disable-model-invocation: true
---

# feature-to-adr

ALPS Section 7 의 feature 를 ADR 초안으로 일괄 변환하는 helper 입니다 — ALPS PRD 가 이미 있을 때 편하게 쓰기 위한 경로이고, ADR 자체의 일급 작성 경로는 `/adr-new <category>` 입니다. 인자가 있으면 **해당 feature 한 개만** 처리하고, 인자가 없으면 **Section 7 전체 feature 를 순차적으로 모두** ADR 로 변환합니다.

## 절차

### 1. ALPS 로드 및 처리 대상 결정

- `mcp__alps-writer__load_alps_document`로 현재 문서를 로드.
- `mcp__alps-writer__read_alps_section(7)`로 feature 목록 추출.
- ALPS 문서가 없으면 사용자에게 알리고 `mcp__alps-writer__init_alps_document` 또는 `/alps-init`을 권유한 뒤 중단.

처리 대상 결정:

- **인자가 있는 경우**: 해당 카테고리/피쳐 ID에 매칭되는 feature 1개만 큐에 넣는다.
- **인자가 없는 경우**: Section 7 의 **모든 feature** 를 ALPS 에 등장한 순서대로 큐에 넣는다. 단 `docs/adr/.mapping.json` 에 이미 ADR 이 매핑된 feature 는 큐에서 제외한다 (재실행 시 중복 방지).
- 큐가 비어 있으면 "변환할 신규 feature 가 없습니다" 메시지를 띄우고 종료.
- 큐에 2개 이상이 들어 있으면 사용자에게 처리 순서를 한 번 보여주고 "이 순서로 모든 피쳐를 ADR 로 변환하겠습니다. 진행할까요?" 한 번만 확인. 이후 각 피쳐는 8단계 승인 시점에서만 멈춘다.

> 아래 2~8단계는 큐의 각 feature 에 대해 **순차적으로 한 번씩 반복**한다. 한 피쳐의 8단계 승인이 완료된 뒤에야 다음 피쳐의 2단계로 넘어간다.

### 2. 카테고리 결정

ALPS feature 는 그 자체가 vertical slice (UI → API → Data) 단위이므로, **카테고리는 feature 와 1:1 로 매핑** 한다. 한 feature 에서 파생되는 UI/API/Data 결정은 **같은 카테고리** 안에 모두 들어가야 한다 — vertical slice 원칙 상세는 README "디렉토리 구조" 참조.

카테고리 키 결정 규칙은 **ALPS Section 7 의 feature 에 명시적 ID 가 있는지** 로 갈린다.

- **명시적 Feature ID 가 있는 경우 (워크숍·번호 기반 PRD — 예: `F1`, `F-AUTH-01`)** — 그 ID 를 소문자 kebab-case 로 변환한 값을 카테고리 키로 **고정 사용** (`F1` → `f1`, `F-AUTH-01` → `f-auth-01`). 사용자가 `/adr-impl f1` 처럼 ALPS feature ID 그대로 호출할 수 있어야 하므로 의미 기반 이름으로 대체하지 않는다.
- **명시적 ID 가 없는 일반 PRD** — feature 이름을 kebab-case 로 변환해 의미 있는 카테고리 id 를 만든다 (예: "User Authentication" → `auth`, "Marketplace Listings" → `marketplace`).

ALPS feature 가 이름에 기술 레이어를 포함하더라도 ADR 카테고리는 사용자가 인지하는 기능 단위 이름으로 다듬는다 — 안티패턴 카테고리 목록은 README "흔한 카테고리 예시 — 안티패턴 카테고리" 참조.

이어서:

- `docs/adr/<category>/` 디렉토리를 생성한다 (플랫 구조면 `docs/adr/`만 사용).
- `docs/adr/README.md`가 없으면 `${CLAUDE_PLUGIN_ROOT}/templates/adr/README.md`를 복사한다.

### 3. ADR 초안 작성

`${CLAUDE_PLUGIN_ROOT}/skills/adr-manage/SKILL.md` 절차와 README "작성 규칙" 을 엄격히 따른다.

- 카테고리 내 다음 번호 부여. 파일명: `NNNN-kebab-title.md` (워크숍은 `NNNN-fN-kebab-title.md`)
- **Status는 항상 `Proposed` 로 저장** — `/adr-impl` 이 구현·테스트 후 자동으로 `Accepted` 로 전환한다. 사용자에게 승격 여부를 묻지 않는다 ([adr-manage SKILL.md §4](../adr-manage/SKILL.md) 및 README "자동 전환 규칙" 참조)
- Context: ALPS의 비즈니스 동기·user story·acceptance criteria의 핵심을 1-3문단
- Decision: **한 ADR 안에서 vertical slice 를 끝까지 묘사** — 사용자 동작 → API → 데이터 흐름을 한 단락 또는 mermaid sequenceDiagram 으로. 같은 feature의 UI/API/Data 결정을 별도 ADR로 쪼개지 않는다
- 대안 검토 / Consequences (긍정·부정·Risk)
- 금지/유지 항목 상세는 README "작성 규칙" 참조 (다이어그램 내부도 동일)

### 4. codePaths 추천 + 확인

[adr-manage SKILL.md §4 "codePaths 추천 절차"](../adr-manage/SKILL.md) 를 그대로 따른다 — ALPS Section 7 의 user flow / technical description 에서 추출한 페이지·컴포넌트 키워드를 입력으로 전달.

### 5. 매핑 갱신

`docs/adr/.mapping.json` (없으면 생성, 스키마: `${CLAUDE_PLUGIN_ROOT}/templates/adr/mapping.schema.json`)

```json
{
  "alpsDocument": "<현재 .alps.xml 경로>",
  "categories": {
    "<category>": {
      "feature": "<feature 이름>",
      "alpsFeatureId": "<있으면>",
      "codePaths": ["<4단계에서 확인된 글롭들>"],
      "adrs": ["docs/adr/<category>/NNNN-...md"],
      "tableDocs": ["<DB 변경이 있고 docs/tables 또는 schema.prisma 등을 갱신했다면>"],
      "lastSyncedAt": "<ISO timestamp>"
    }
  }
}
```

### 6. README 인덱스 갱신

`docs/adr/README.md`의 "카테고리별 ADR 목록"에 한 줄 요약을 추가한다.

### 7. 자동 검토 (adr-reviewer 위임)

저장 직전, `adr-reviewer` subagent 를 호출하여 격리된 컨텍스트에서 룰 검증을 받는다.

- 입력: 작성된 ADR 파일 경로, 매핑 entry 변경 전/후, ALPS Section 7 발췌
- 출력: `PASS` / `FIX_REQUIRED` / `BLOCK` punch list

`PASS` 가 아니면 결과를 사용자에게 요약해 보여주고, `FIX_REQUIRED` 항목은 본 세션에서 직접 패치한다. `BLOCK` 이면 ADR 분리 또는 보조 문서 동시 작업이 필요하므로 8단계로 가지 말고 3단계로 돌아간다.

### 8. 사용자 확인

검토를 통과한 ADR과 매핑을 보여주고 다음 형식으로 승인 요청:

```
## ADR <NNNN>: <제목>

**Decision (요약)**: <2-3문장>
**영향 범위 (codePaths)**: <글롭 목록>
**선행 조건**: <의존 ADR 또는 없음>

이대로 `Proposed`(미구현)로 저장하고 구현(/adr-impl)으로 넘어갈까요? 구현·테스트가 끝나면 `/adr-impl`이 자동으로 `Accepted`로 전환합니다.
```

승인 전까지 코드 수정을 시작하지 않는다. 사용자가 수정을 요청하면 ADR을 갱신한 뒤 다시 확인.

큐에 다음 feature 가 남아 있으면, 승인 직후 "다음 피쳐(`<이름>`)로 계속 진행합니다" 한 줄을 출력하고 2단계로 돌아간다. 큐가 비면 전체 변환 결과 요약(생성된 ADR 목록)을 보여주고 종료.

### 9. opt-out 처리

사용자가 "ADR 없이 바로 구현해줘", "임시로 빨리", "hotfix" 등을 명시하면:

- 리스크(검토 부담↓·드리프트↑)를 한 줄로 안내한다.
- 그래도 진행을 원하면 최소 ADR(Status: `Proposed`, Decision 1문단, codePaths만)이라도 작성한 뒤 코드로 넘어가자고 권유한다.
- 사용자가 끝까지 거부하면 따른다. 단 다음 `/adr-sync` 시점에 ADR을 채울 deferred 항목으로 기록한다.
