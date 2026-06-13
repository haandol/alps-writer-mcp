---
name: feature-to-adr
description: Helper — convert ALPS Section 7 feature(s) into Proposed ADR drafts by delegating each feature to the adr-writer plugin's /adr-new. Use only when an ALPS PRD already exists and the adr-writer plugin is installed. Keywords - "/feature-to-adr", "ALPS feature ADR 변환", "Section 7 일괄 ADR".
argument-hint: "[category-or-feature-id?]"
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
- `mcp__alps-writer__read_alps_section(6)`로 **Section 6.3 Feature Dependency Diagram 을 항상 확인**한다. ALPS 는 feature 사이 의존성을 6.3 의 Mermaid `graph TD`(`F2 -->|depends on| F1` 형태)로 들고 있다 — 이 그래프가 곧 "어떤 feature 가 어떤 feature 보다 먼저 구현돼야 하는가"의 source of truth 다. 그래프가 있으면 의존 엣지를 모두 파싱해 둔다(4단계에서 매핑에 옮긴다). 그래프가 비어 있거나 6.3 자체가 없으면 feature 간 의존이 없는 것으로 본다 — 억지로 만들어내지 않는다.
- ALPS 문서가 없으면 사용자에게 알리고 `mcp__alps-writer__init_alps_document` 또는 `/alps-init`을 권유한 뒤 중단.

처리 대상 결정 — 각 Section 7 feature 를 매핑 상태에 따라 **신규(new)** / **변경(changed)** / **그대로(unchanged)** 세 부류로 나눈다:

- 매핑에 해당 feature 의 카테고리 entry 가 **없으면 → 신규(new)**. ADR 을 새로 생성한다.
- entry 는 있는데 그 entry 의 `alpsRevision` 이 **현재 Section 7 feature 내용과 다르면 → 변경(changed)**. PRD 가 ADR 보다 앞서간 상태이므로 기존 ADR 을 **재검토 후보**로 표시한다 (아래 변경 처리 절차).
- entry 가 있고 `alpsRevision` 이 현재 내용과 같으면 → **그대로(unchanged)**. 큐에서 제외한다 (재실행 시 중복 방지).

> **변경 감지 기준**: `alpsRevision` 은 변환 시점에 기록한 그 feature 의 짧은 content digest 또는 한 줄 요약이다(스키마: `mapping.schema.json`). 현재 Section 7 feature 의 동일 방식 요약과 비교해 다르면 changed 로 본다. `alpsRevision` 이 비어 있는 레거시 entry 는 비교 불가이므로 unchanged 로 두되, 사용자에게 "이 카테고리는 revision 기록이 없어 변경 감지를 건너뜁니다 — 필요하면 changed 로 강제 재검토할 수 있습니다" 한 줄 안내.

처리 대상 결정:

- **인자가 있는 경우**: 해당 카테고리/피쳐 ID에 매칭되는 feature 1개만 위 분류에 따라 처리한다 (인자로 지정했으면 unchanged 라도 사용자 의도로 보고 changed 로 처리).
- **인자가 없는 경우**: Section 7 의 **모든 feature** 를 분류한 뒤, **new + changed** 만 큐에 넣는다. 6.3 의존성 그래프가 있으면 **의존성 위상 순서**(의존 대상이 의존하는 쪽보다 먼저)로 큐를 정렬한다 — 그래야 카테고리를 만들 때 `dependsOn` 이 가리킬 선행 카테고리가 이미 존재한다. 그래프가 없으면 ALPS 등장 순서를 따른다.
- 큐가 비어 있으면 "변환/갱신할 feature 가 없습니다 (모두 최신)" 메시지를 띄우고 종료.
- 큐에 항목이 있으면 사용자에게 처리 목록을 **new / changed 로 구분해** 한 번 보여주고 "이 순서로 진행할까요?" 한 번만 확인. 이후 각 피쳐는 `/adr-new`(또는 변경 처리) 의 승인 시점에서만 멈춘다.

  ```
  ALPS Section 7 대비 ADR 매핑 점검 결과:

  신규(ADR 생성):
  1. f4 — 위시리스트

  변경(PRD 가 ADR 보다 앞섬 — 재검토 필요):
  2. f2 — 장바구니  (alpsRevision 불일치)

  신규는 /adr-new 로 생성하고, 변경은 기존 ADR 재검토 후보로 안내합니다. 진행할까요?
  ```

> 아래 2~4단계는 큐의 각 feature 에 대해 **순차적으로 한 번씩 반복**한다. **신규**는 2~4단계를 그대로 따르고, **변경**은 2단계(카테고리는 이미 결정됨, 재사용)를 건너뛰고 아래 "변경(changed) feature 처리"로 분기한다. 한 피쳐의 처리가 완료된 뒤에야 다음 피쳐로 넘어간다.

### 1.5. 변경(changed) feature 처리

PRD 가 기존 ADR 보다 앞서간 경우다. 본 helper 는 ADR 본문을 직접 고치지 않고 — **변경 사실을 매핑에 기록하고 사용자에게 재검토 경로를 안내**하는 데 그친다 (ADR 갱신 권위는 `/adr-sync`·`/adr-impl` 에 있다).

1. 해당 카테고리 entry 의 `syncStatus` 를 `pending-review` 로 표시하고, `alpsRevision` 은 **아직 갱신하지 않는다** (ADR 이 새 내용을 반영해 재검토를 마친 뒤에 갱신해야 "무엇이 바뀌었는지" 추적이 유지된다).
2. 사용자에게 변경된 Section 7 feature 발췌와, 그 카테고리의 기존 ADR 목록을 함께 보여주고 안내한다:

   ```
   `f2`(장바구니) 의 PRD 가 기존 ADR(docs/adr/f2/0001-...md) 보다 앞서 있습니다.
   - 기존 결정을 바꾸는 변경이면: /adr-sync f2 로 ADR↔PRD drift 를 정렬하거나, 새 결정이면 /adr-new f2 로 ADR 을 추가(supersede 포함)하세요.
   - 구현까지 이어지면: /adr-impl f2.
   재검토가 끝나면 매핑의 syncStatus 가 synced 로, alpsRevision 이 현재 내용으로 갱신됩니다.
   ```

3. 사용자가 즉시 재검토를 원하면 위 명령으로 이어가고, 미루면 `pending-review` 상태를 남긴 채 다음 큐 항목으로 진행한다 — drift 가 매핑에 남아 다음 `/adr-sync` 에서 다시 잡힌다.

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
- 해당 카테고리 entry 의 `dependsOn` — 1단계에서 파싱한 6.3 의존성 그래프에서 **이 feature 가 의존하는** 대상들을 카테고리 키로 변환해 배열로 기록한다. 예: 6.3 에 `F3 -->|depends on| F1` 이 있으면 `f3` 카테고리의 `dependsOn` 에 `f1` 을 넣는다 (카테고리 키 변환 규칙은 2단계와 동일). 의존이 없는 feature 는 `dependsOn` 을 생략하거나 `[]` 로 둔다. 이 필드가 `/adr-impl` 이 선행 ADR 을 먼저 구현하도록 강제하는 근거가 된다 — 6.3 의 의존성이 ADR 사이클로 넘어오는 유일한 통로이므로 빠뜨리지 않는다.
- 해당 카테고리 entry 의 `alpsRevision` — 이번에 변환한 Section 7 feature 의 짧은 content digest 또는 한 줄 요약을 기록한다. 다음 `/feature-to-adr` 재실행 때 이 값과 현재 feature 내용을 비교해 changed 를 감지한다 (1단계 변경 감지의 기준값). `syncStatus` 는 신규 변환 시 `synced` 로 둔다.

```json
{
  "alpsDocument": "<현재 .alps.xml 경로>",
  "categories": {
    "<category>": {
      "alpsFeatureId": "<있으면>",
      "dependsOn": ["<선행 카테고리 키>"],
      "alpsRevision": "<이번에 변환한 Section 7 feature 의 digest/요약>",
      "syncStatus": "synced"
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
