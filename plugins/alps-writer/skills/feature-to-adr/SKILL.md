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
  - **파싱 직후 그래프 무결성을 검사한다** (위상 정렬·`dependsOn` 기록은 비순환 DAG 를 전제로 하므로 — 매핑 스키마의 "keep acyclic (no self-edge)"). (a) **self-edge**(`F1 -->|depends on| F1`)는 무시하고 `"F1 이 자기 자신에 의존 — 무시함"` 한 줄을 알린다. (b) **순환**(`F1 ↔ F2`, 또는 더 긴 back-edge)이 있으면 위상 정렬이 불가능하므로 **큐 정렬·카테고리 생성·`dependsOn` 기록을 시작하지 않고 멈춘다** — 어떤 feature 들이 서로 물려 있는지 사용자에게 알리고, Section 6.3 의 순환을 먼저 끊도록 요청한 뒤(필요 시 `/alps-init` 으로 기존 문서를 이어 6.3 수정, 또는 `mcp__alps-writer__load_alps_document`) 재실행하게 한다. 이 한 번의 검사가 아래 위상 정렬(처리 대상 결정)과 4단계 `dependsOn` 기록 두 곳을 모두 보호하므로, cyclic 그래프가 `.mapping.json` 에 영구 기록돼 하류(`adr-impl`·`adr-sync`)에서 뒤늦게 터지는 것을 막는다.
- Section 6.2(Non-Functional Requirements)와 Section 4.2(Technology Stack / 제약)도 함께 읽어둔다. 이들은 ADR 의 **Decision Drivers** 후보다 — 측정 가능한 NFR(예: "p95 3초 이내")과 전역 제약(예: "AWS 만 사용", "팀이 Node 경험만")이 옵션을 변별하는 압력이 된다. 각 NFR 의 Scope(`Global` 또는 Feature ID)를 보고 어느 feature 의 Driver 로 넘길지 분류해 둔다(3단계에서 `/adr-new` 에 전달).
- ALPS 문서가 없으면 사용자에게 알리고 `mcp__alps-writer__init_alps_document` 또는 `/alps-init`을 권유한 뒤 중단.

처리 대상 결정:

- **인자가 있는 경우**: 해당 카테고리/피쳐 ID에 매칭되는 feature 1개만 큐에 넣는다. 단 이 단일 feature 가 6.3 에서 의존하는 선행이 아직 ADR 로 변환되지 않았다면, 기록될 `dependsOn` 이 매핑에 entry 없는 카테고리 키를 가리키는 **dangling 참조**가 될 수 있다 — `adr-impl` 이 이를 미구현 선행으로 처리하지만(그쪽 step 2 의 dangling 분기), 선행이 미변환임을 알면 인자 없이 전체 Section 7 을 의존성 닫힘 순서로 변환하는 편이 깔끔하다고 한 줄 안내한다.
- **인자가 없는 경우**: Section 7 의 **모든 feature** 를 큐에 넣는다. 6.3 의존성 그래프가 있으면 **의존성 위상 순서**(의존 대상이 의존하는 쪽보다 먼저)로 큐를 정렬한다 — 그래야 카테고리를 만들 때 `dependsOn` 이 가리킬 선행 카테고리가 이미 존재한다. 그래프가 없으면 ALPS 등장 순서를 따른다. 단 `docs/adr/.mapping.json` 에 이미 ADR 이 매핑된 feature 는 큐에서 제외한다 (재실행 시 중복 방지).
- 큐가 비어 있으면 "변환할 신규 feature 가 없습니다" 메시지를 띄우고 종료.
- 큐에 2개 이상이 들어 있으면 사용자에게 처리 순서를 한 번 보여주고 "이 순서로 모든 피쳐를 ADR 로 변환하겠습니다. 진행할까요?" 한 번만 확인. 이후 각 피쳐는 `/adr-new` 의 승인 시점에서만 멈춘다.

> 아래 2~4단계는 큐의 각 feature 에 대해 **순차적으로 한 번씩 반복**한다. 한 피쳐의 `/adr-new` 승인이 완료된 뒤에야 다음 피쳐의 2단계로 넘어간다.

> **PRD 는 한 번만 import 한다**: `/feature-to-adr` 는 ALPS feature 를 ADR 로 **최초 변환**하는 one-time importer 다. 한 번 ADR 이 만들어지면 그 결정은 이후 **ADR 레벨에서 관리**된다 — PRD 가 나중에 바뀌면 매핑된 feature 를 다시 가져오지 않고, 해당 카테고리의 ADR 을 직접 편집(또는 새 ADR 로 supersede)해 변경을 흡수한다. 그래서 이미 매핑된 feature 는 재실행 시 큐에서 제외한다.

### 2. 카테고리 결정 (importer 책임)

카테고리 키 결정은 ALPS 측 지식이므로 importer 가 직접 정해 `/adr-new` 에 넘긴다. ALPS feature 는 그 자체가 vertical slice (UI → API → Data) 단위이므로, **한 feature 는 한 카테고리(leaf) 와 1:1 로 매핑** 한다. 다만 폴더는 DDD 도메인(bounded context) × 피쳐 두 축으로 조직되므로(`structure.md` "디렉토리 구조"), 카테고리 키가 단일 세그먼트(`auth`)인지 2-세그먼트(`identity/login`)인지는 아래 그룹핑 여부로 갈린다. **키는 언제나 feature 이름에서 파생하고 명시적 Feature ID 는 키에 쓰지 않는다** (아래 규칙 — ID 는 `alpsFeatureId` 로만 보존).

**카테고리 키는 언제나 feature 이름에서 canonical 하게 뽑는다** — feature 이름을 kebab-case 로 변환해 의미 있는 카테고리 키를 만든다 (예: "User Authentication" → `auth`, "Marketplace Listings" → `marketplace`). **기본은 단일 세그먼트(평면)** 다.

- **명시적 Feature ID(`F1`, `F-AUTH-01`)가 있어도 그 ID 를 카테고리 키로 쓰지 않는다.** ID 는 4단계에서 entry 의 `alpsFeatureId` 필드로만 보존한다. 이렇게 해야 canonical ADR 구조(`identity/login/0001-...md`, `infra/0001-...md`)를 그대로 쓰고, 폴더명·파일명에 `f1` 이 중복으로 남지 않는다.
  - **`/adr-impl f1` 처럼 ID 로 호출하는 경로는 그대로 살아 있다** — `/adr-impl` 1단계가 카테고리 키뿐 아니라 entry 의 `alpsFeatureId` 와도 대조해 매칭하므로(`adr-impl` step 1), 폴더가 의미 기반 이름(`identity/login`)이어도 `F1`/`f1` 호출이 해당 카테고리를 찾아낸다. 그래서 키를 ID 로 고정할 이유가 없다.
- **fallback** — feature 이름이 없거나 `F1` 처럼 번호뿐이라 의미 있는 kebab 을 뽑을 수 없을 때만, ID 를 소문자로 변환한 값(`f1`, `f-auth-01`)을 단일 세그먼트 키로 쓴다. 이 경우에만 키와 `alpsFeatureId` 가 1:1 로 겹친다.

**도메인(bounded context) 그룹핑 — 기본 끔, 요청 시에만**: ALPS 에는 feature 위에 도메인을 묶는 개념이 없다 (Section 6.1/6.3/7 모두 feature 가 최소·최대 단위). 그래서 importer 는 **PRD 가 주지 않은 도메인 경계를 임의로 만들어내지 않는다** — adr-writer 가 ALPS-agnostic 이라는 불변식과 같은 선이다. 두 경우에만 2-세그먼트 `<context>/<feature>` 키를 쓴다:

1. ALPS Section 7 가 이미 feature 를 그룹/epic/상위 묶음으로 조직하고 있어 도메인 경계가 PRD 에 명시돼 있는 경우 — 그 그룹명을 context 로 쓴다.
2. 사용자가 명시적으로 "이 feature 들을 `identity` 로 묶어줘" 같이 그룹핑을 요청한 경우 — 큐를 만들 때(1단계) 또는 진행 확인 시 한 번 물어 확인하고 적용한다.

둘 다 아니면 **평면(단일 세그먼트) 유지가 기본**이다. 단일-context/소규모 PRD 는 그룹핑하지 않는다.

ALPS feature 가 이름에 기술 레이어를 포함하더라도 ADR 카테고리는 사용자가 인지하는 기능 단위 이름으로 다듬는다 (안티패턴 카테고리 `frontend/`·`backend/`·`api/`·`db/` 회피 — context 폴더·피쳐 sub-folder 양쪽 모두).

### 3. /adr-new 위임

결정한 카테고리로 **`/adr-new <category>` 를 호출**하고, 해당 feature 의 ALPS Section 7 발췌를 컨텍스트로 함께 전달한다. ADR 초안 작성·자동 검토(adr-reviewer)·README 인덱스 갱신·`.mapping.json` 의 ADR 관련 필드 작성·`Proposed` 저장·사용자 승인은 **전부 `/adr-new`(→ adr-writer) 가 처리**한다. 본 스킬에서 ADR 작성 규칙을 다시 풀어쓰지 않는다.

`/adr-new` 에 넘기는 입력:

- **카테고리 키** — 2단계에서 결정한 값.
- **Context 재료** — ALPS 의 비즈니스 동기·user story·acceptance criteria 핵심.
- **Decision 재료** — Section 7 의 user flow / technical description (vertical slice: 사용자 동작 → API → 데이터 흐름).
- **Decision Drivers 후보** — 1단계에서 분류한, 이 feature 에 걸리는 NFR(6.2 에서 Scope 가 `Global` 이거나 이 Feature ID 인 것)과 전역 아키텍처 제약(4.2). 측정 가능한 제약 형태로 그대로 넘긴다(예: "p95 3초 이내", "AWS 만 사용"). `/adr-new` 는 이를 Decision Drivers 의 출발점으로 삼아 대안을 변별한다 — PRD 의 비기능 요구가 ADR 의 의사결정 근거로 이어지는 통로다.
- **영향 영역 힌트** — user flow / technical description 에서 추출한 페이지·컴포넌트 키워드. ADR Decision 의 vertical slice 서술에 쓰인다 (매핑에 코드 경로로 저장되지는 않는다).

ALPS feature 가 명시적 ID 를 가지더라도 파일명·폴더명에 그 ID 를 넣지 않는다 — `/adr-new` 가 부여하는 파일명은 canonical 하게 `NNNN-kebab-title.md` 형태다. ID 는 4단계에서 `alpsFeatureId` 로만 기록하고, ID 기반 호출(`/adr-impl f1`)은 그 필드로 매칭되므로 파일명에 흔적을 남길 필요가 없다.

### 4. ALPS 연결 필드 보강 (importer 책임)

`/adr-new` 가 `.mapping.json` 의 카테고리 entry(feature·adrs 등)를 채운 뒤, importer 는 ALPS 지식이 필요한 **연결 필드만** 추가로 채운다 — adr-writer 는 ALPS 를 모르므로 이 부분은 importer 의 책임이다:

- `alpsDocument` — 현재 `.alps.xml` 경로.
- 해당 카테고리 entry 의 `alpsFeatureId` — 명시적 Feature ID 가 있으면 기록.
- 해당 카테고리 entry 의 `dependsOn` — 1단계에서 파싱(및 무결성 검사)한 6.3 의존성 그래프에서 **이 feature 가 의존하는** 대상들을 카테고리 키로 변환해 배열로 기록한다. 6.3 의 의존 엣지는 Feature ID(`F3 -->|depends on| F1`)로 표현되지만, **`dependsOn` 에는 각 ID 가 아니라 그 feature 의 카테고리 키(2단계에서 이름 기반으로 정한 값)를 넣는다.** 예: `checkout` feature(`F3`)가 `login` feature(`F1`)에 의존하면 `checkout` entry(또는 그룹핑 시 `ordering/checkout`)의 `dependsOn` 에 `login`(또는 `identity/login`)을 넣는다. ID 를 그대로 키로 못 쓰므로 매핑할 때 `alpsFeatureId → 카테고리 키` 대응을 참조한다 (이번 배치에서 각 feature 의 키를 이미 정했으니 그 표를 재사용). **6.3 그래프를 점검한 결과 이 feature 에 선행이 없더라도 `dependsOn` 을 `[]` 로 기록한다 — 키를 생략하지 않는다.** 6.3 을 실제로 점검한 이상 이 상태는 "의존 없음(점검 완료)" 이지 "미선언" 이 아니며, `/adr-impl` 선행 게이트는 `[]`(안내 없이 진행) 와 키 생략("의존 미선언" 경고) 을 다르게 처리하기 때문이다 (`/adr-new` 4단계와 동일 규칙). 이 필드가 `/adr-impl` 이 선행 ADR 을 먼저 구현하도록 강제하는 근거가 된다 — 6.3 의 의존성이 ADR 사이클로 넘어오는 유일한 통로이므로 빠뜨리지 않는다. 의존 엣지는 **다른 context 의 feature 를 가리켜도 정상**이다 (DDD context 사이 관계).
  - 기록 전 각 `dependsOn` 키가 **이미 매핑에 entry 가 있는(또는 이번 배치에서 먼저 생성될) 카테고리 키**인지 확인한다 (스키마 invariant "Must reference existing category keys"). 전체 배치 실행은 1단계 위상 정렬로 선행이 먼저 생성되므로 충족되지만, 단일 feature 인자 실행은 위 dangling 케이스가 정상이다. 1단계 무결성 검사를 통과했으므로 self-edge·순환은 여기 도달하지 않는다.
- (선택) context 수준 entry 의 `subdomainType` — 2단계에서 도메인 그룹핑을 적용했고 그 도메인의 DDD 분류가 명확하면 `core`/`supporting`/`generic` 중 하나를 context entry 에 기록한다. PRD 에 신호가 없거나 평면 구조면 **생략한다** — advisory 메타데이터이므로 비워도 매핑은 유효하고, 억지로 분류하지 않는다.

```json
{
  "alpsDocument": "<현재 .alps.xml 경로>",
  "categories": {
    "<category>": {
      "alpsFeatureId": "<있으면>",
      "dependsOn": ["<선행 카테고리 키>"]
    }
  }
}
```

큐에 다음 feature 가 남아 있으면 "다음 피쳐(`<이름>`)로 계속 진행합니다" 한 줄을 출력하고 2단계로 돌아간다. 큐가 비면 전체 변환 결과 요약(생성된 ADR 목록)을 보여주고 종료.

### 5. opt-out 처리

사용자가 "ADR 없이 바로 구현해줘", "임시로 빨리", "hotfix" 등을 명시하면:

- 리스크(검토 부담↓·드리프트↑)를 한 줄로 안내한다.
- 그래도 진행을 원하면 최소 ADR(Status: `Proposed`, Decision 1문단)이라도 `/adr-new` 로 작성한 뒤 코드로 넘어가자고 권유한다.
- 사용자가 끝까지 거부하면 따른다. 단 다음 `/adr-sync` 시점에 ADR을 채울 deferred 항목으로 기록한다.
