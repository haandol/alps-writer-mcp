---
name: feature-to-adr
description: Helper — convert ALPS Section 7 feature(s) into Proposed ADR drafts by delegating each feature to the adr-writer plugin's /adr-new. Use only when an ALPS PRD already exists and the adr-writer plugin is installed. Keywords - "/feature-to-adr", "ALPS feature ADR 변환", "Section 7 일괄 ADR".
argument-hint: "[category-or-feature-id?]"
disable-model-invocation: true
---

# feature-to-adr

ALPS Section 7 의 feature 를 ADR 초안으로 일괄 변환하는 helper 입니다. **ADR 작성 자체는 별도 플러그인 `adr-writer` 의 `/adr-new` 에 위임**하고, 본 스킬은 ALPS 를 읽어 feature 큐를 만들고 카테고리를 정한 뒤 각 feature 를 `/adr-new` 로 넘기는 **얇은 importer** 역할만 합니다. 의존 방향은 alps-writer → adr-writer 한 방향이며, adr-writer 는 ALPS 를 전혀 알지 못합니다.

인자가 있으면 **해당 feature 한 개만** 처리하고, 인자가 없으면 **Section 7 전체 feature 를 순차적으로 모두** 변환합니다.

## 절차

### 1. 선행 조건 확인 및 ALPS 로드

먼저 **adr-writer 플러그인이 설치되어 있는지** 확인한다 — `/adr-new` 스킬을 호출할 수 있어야 한다. 없으면 다음을 안내하고 중단한다:

```
/feature-to-adr 는 ADR 작성을 adr-writer 플러그인의 /adr-new 에 위임합니다.
adr-writer 를 먼저 설치해 주세요:  /plugin install adr-writer@alps-writer
```

이어서 ALPS 를 로드한다:

- `mcp__alps-writer__load_alps_document`로 현재 문서를 로드.
- `mcp__alps-writer__read_alps_section(7)`로 feature 목록 추출.
- ALPS 문서가 없으면 사용자에게 알리고 `mcp__alps-writer__init_alps_document` 또는 `/alps-init`을 권유한 뒤 중단.

처리 대상 결정:

- **인자가 있는 경우**: 해당 카테고리/피쳐 ID에 매칭되는 feature 1개만 큐에 넣는다.
- **인자가 없는 경우**: Section 7 의 **모든 feature** 를 ALPS 에 등장한 순서대로 큐에 넣는다. 단 `docs/adr/.mapping.json` 에 이미 ADR 이 매핑된 feature 는 큐에서 제외한다 (재실행 시 중복 방지).
- 큐가 비어 있으면 "변환할 신규 feature 가 없습니다" 메시지를 띄우고 종료.
- 큐에 2개 이상이 들어 있으면 사용자에게 처리 순서를 한 번 보여주고 "이 순서로 모든 피쳐를 ADR 로 변환하겠습니다. 진행할까요?" 한 번만 확인. 이후 각 피쳐는 `/adr-new` 의 승인 시점에서만 멈춘다.

> 아래 2~4단계는 큐의 각 feature 에 대해 **순차적으로 한 번씩 반복**한다. 한 피쳐의 `/adr-new` 승인이 완료된 뒤에야 다음 피쳐의 2단계로 넘어간다.

### 2. 카테고리 결정 (importer 책임)

카테고리 키 결정은 ALPS 측 지식이므로 importer 가 직접 정해 `/adr-new` 에 넘긴다. ALPS feature 는 그 자체가 vertical slice (UI → API → Data) 단위이므로, **카테고리는 feature 와 1:1 로 매핑** 한다.

카테고리 키 결정 규칙은 **ALPS Section 7 의 feature 에 명시적 ID 가 있는지** 로 갈린다.

- **명시적 Feature ID 가 있는 경우 (워크숍·번호 기반 PRD — 예: `F1`, `F-AUTH-01`)** — 그 ID 를 소문자 kebab-case 로 변환한 값을 카테고리 키로 **고정 사용** (`F1` → `f1`, `F-AUTH-01` → `f-auth-01`). 사용자가 `/adr-impl f1` 처럼 ALPS feature ID 그대로 호출할 수 있어야 하므로 의미 기반 이름으로 대체하지 않는다.
- **명시적 ID 가 없는 일반 PRD** — feature 이름을 kebab-case 로 변환해 의미 있는 카테고리 id 를 만든다 (예: "User Authentication" → `auth`, "Marketplace Listings" → `marketplace`).

ALPS feature 가 이름에 기술 레이어를 포함하더라도 ADR 카테고리는 사용자가 인지하는 기능 단위 이름으로 다듬는다 (안티패턴 카테고리 `frontend/`·`backend/`·`api/`·`db/` 회피).

### 3. /adr-new 위임

결정한 카테고리로 **`/adr-new <category>` 를 호출**하고, 해당 feature 의 ALPS Section 7 발췌를 컨텍스트로 함께 전달한다. ADR 초안 작성·codePaths 추천·자동 검토(adr-reviewer)·README 인덱스 갱신·`.mapping.json` 의 ADR 관련 필드 작성·`Proposed` 저장·사용자 승인은 **전부 `/adr-new`(→ adr-writer) 가 처리**한다. 본 스킬에서 ADR 작성 규칙을 다시 풀어쓰지 않는다.

`/adr-new` 에 넘기는 입력:

- **카테고리 키** — 2단계에서 결정한 값.
- **Context 재료** — ALPS 의 비즈니스 동기·user story·acceptance criteria 핵심.
- **Decision 재료** — Section 7 의 user flow / technical description (vertical slice: 사용자 동작 → API → 데이터 흐름).
- **codePaths 힌트** — user flow / technical description 에서 추출한 페이지·컴포넌트 키워드.

ALPS feature 가 워크숍식 ID 를 가진 경우, `/adr-new` 가 부여하는 파일명이 `NNNN-fN-kebab-title.md` 형태가 되도록 카테고리/제목에 그 ID 를 반영해 전달한다.

### 4. ALPS 연결 필드 보강 (importer 책임)

`/adr-new` 가 `.mapping.json` 의 카테고리 entry(feature·codePaths·adrs 등)를 채운 뒤, importer 는 ALPS 지식이 필요한 **연결 필드만** 추가로 채운다 — adr-writer 는 ALPS 를 모르므로 이 부분은 importer 의 책임이다:

- `alpsDocument` — 현재 `.alps.xml` 경로.
- 해당 카테고리 entry 의 `alpsFeatureId` — 명시적 Feature ID 가 있으면 기록.

```json
{
  "alpsDocument": "<현재 .alps.xml 경로>",
  "categories": {
    "<category>": {
      "alpsFeatureId": "<있으면>"
    }
  }
}
```

큐에 다음 feature 가 남아 있으면 "다음 피쳐(`<이름>`)로 계속 진행합니다" 한 줄을 출력하고 2단계로 돌아간다. 큐가 비면 전체 변환 결과 요약(생성된 ADR 목록)을 보여주고 종료.

### 5. opt-out 처리

사용자가 "ADR 없이 바로 구현해줘", "임시로 빨리", "hotfix" 등을 명시하면:

- 리스크(검토 부담↓·드리프트↑)를 한 줄로 안내한다.
- 그래도 진행을 원하면 최소 ADR(Status: `Proposed`, Decision 1문단, codePaths만)이라도 `/adr-new` 로 작성한 뒤 코드로 넘어가자고 권유한다.
- 사용자가 끝까지 거부하면 따른다. 단 다음 `/adr-sync` 시점에 ADR을 채울 deferred 항목으로 기록한다.
