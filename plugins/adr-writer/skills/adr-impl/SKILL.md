---
name: adr-impl
description: Implement an ADR — check dependencies first, implement prerequisites in topological order, write code, run tests, then auto-promote ADR Status from Proposed to Accepted. Enforces the ADR-first development cycle. Use when the user invokes /adr-impl or asks to implement an ADR / a Proposed feature whose decision is already recorded. Keywords - "/adr-impl", "ADR 구현", "implement ADR", "Proposed ADR 코드 반영".
argument-hint: "[adr-path-or-category]"
disable-model-invocation: true
---

# adr-impl

지정한 ADR을 코드로 구현하고, 구현·테스트가 통과하면 ADR Status를 자동으로 `Accepted`로 갱신합니다. **ADR이 없으면 먼저 ADR을 작성한 뒤 진행한다** — 일반 케이스는 `/adr-new <category>` 로 직접 작성, ALPS Section 7 feature 가 이미 있다면 `/feature-to-adr` 로 일괄 변환.

> Status 의미: `Proposed`는 "ADR이 제안되었으나 미구현", `Accepted`는 "구현 완료". 이 명령은 마지막에 Status 전환까지 책임진다.

## 절차

1. **대상 ADR 식별**

   인자별 분기:
   - **인자가 파일 경로** → 그 ADR 파일 한 개를 대상으로 한다.
   - **인자가 카테고리 또는 ALPS Feature ID** (예: `f1`, `F1`, `auth`, `f-auth-01`) → `docs/adr/.mapping.json` 의 카테고리 키 또는 entry 의 `alpsFeatureId` 와 대조해 매칭. `/adr-new` 와 `/feature-to-adr` 모두 카테고리 키를 그대로 사용하므로 워크숍처럼 번호 기반 PRD 라면 1:1 로 맞다.
   - **인자가 비어 있거나 매칭이 모호하거나 매핑/매핑 파일이 없을 때** — `Proposed` 상태(미구현)인 ADR 목록을 한 번에 보여주고 사용자에게 어떤 ADR 을 구현할지 묻는다 (아래 "Proposed 목록 출력" 절차).

   **Proposed 목록 출력 절차**:
   1. `docs/adr/.mapping.json` 이 있으면 모든 카테고리를 순회. 없으면 `docs/adr/*/*.md` 를 직접 grep 해서 ADR 파일 목록을 만든다.
   2. 각 ADR 파일의 `## Status` 섹션을 읽어 `Proposed` 만 추린다 (`Accepted`, `Deprecated`, `Superseded` 는 제외).
   3. 사용자에게 다음 형식으로 한 번 보여주고 선택을 받는다:

      ```
      아직 구현되지 않은 ADR 이 N개 있습니다. 어떤 ADR 을 구현할까요?

      1. f1 — 이메일 가입 (docs/adr/f1/0001-email-signup.md)
      2. f2 — 비밀번호 재설정 (docs/adr/f2/0001-password-reset.md)
      3. cart — 장바구니 합산 (docs/adr/cart/0003-cart-totals.md)

      번호 또는 카테고리/Feature ID 로 답해주세요. 한 번에 여러 개를 구현하려면 "1,2" 또는 "f1, f2" 처럼 답하세요.
      ```

   4. 사용자가 답하면 그 선택을 카테고리 인자로 받아 다시 1단계 시작 부분으로 돌아간다.
   5. **Proposed ADR 이 0 개** 면 _"모든 ADR 이 이미 구현되어 있습니다. 새 결정을 남기려면 `/adr-new <category>` 로 ADR 을 먼저 작성하세요. ALPS Section 7 feature 를 일괄 변환하려면 `/feature-to-adr` 를 사용해도 됩니다."_ 라고 안내하고 종료한다.
   6. **ADR 자체가 디스크에 한 개도 없으면** _"ADR 이 아직 없습니다. `/adr-new <category>` 로 직접 작성하거나, ALPS Section 7 feature 가 있다면 `/feature-to-adr` 로 변환한 뒤 다시 호출해주세요."_ 라고 안내하고 종료한다.

   대상 ADR 이 식별되면 현재 Status 를 확인한다 — 이 명령은 `Proposed → Accepted` 전환을 자동 처리한다. 이미 `Accepted` 인 ADR 을 다시 구현 대상으로 받은 경우 부분 변경/보강 의도인지 사용자에게 한 번 확인하고 진행.

   **대상이 식별되면 어떤 경우에도 곧바로 3단계(계획)로 가지 않는다. 반드시 2단계 의존성 확인을 먼저 수행한다.** 단일 ADR 이든, 사용자가 `1,2` / `f1, f2` 처럼 여러 개를 한 번에 고른 경우든 예외 없이 2단계를 거친다.

2. **의존성 확인 (선행 ADR 게이트) — 건너뛸 수 없는 필수 단계**

   feature 는 서로 의존한다 — 예를 들어 "결제(f3)" 는 "장바구니(f2)" 가 먼저 동작해야 구현이 의미가 있다. 이 의존을 무시하고 요청받은 ADR 부터 구현하면 선행이 없는 위에 코드를 쌓게 되어 실제 동작 순서와 어긋난다. 그래서 **구현·계획에 앞서 의존부터 본다 — 이 단계는 생략하거나 뒤로 미룰 수 없다.**
   - 대상 카테고리의 `docs/adr/.mapping.json` entry 에서 `dependsOn` 을 읽는다 (이 값은 `/feature-to-adr` 가 ALPS Section 6.3 Feature Dependency Diagram 에서 옮겨오거나, `/adr-new` 가 작성 시 선행 조건으로 직접 기록한 것이다).
     - entry 는 있는데 **`dependsOn` 키 자체가 없으면** — 의존이 선언되지 않은 것이다. 한 줄로 "이 ADR 에 `dependsOn` 이 선언돼 있지 않아 선행 점검 없이 진행합니다 — 선행 ADR 이 있으면 `.mapping.json` 의 `dependsOn` 또는 `/feature-to-adr` 로 보강하세요" 라고 알린 뒤 3단계로 진행한다 ("의존 없음" 과 "의존 미선언" 을 조용히 같게 취급하지 않는다).
     - `dependsOn` 이 **빈 배열(`[]`)** 이면 의존 없음을 명시적으로 점검 완료한 것이므로 안내 없이 3단계로 진행한다.
   - `dependsOn` 에 키가 있으면 그래프를 **한 노드씩 따라가며 전이적 선행 카테고리**를 방문한다(예: f3 → f2 → f1). 방문하는 각 노드가 **dangling 참조**(`.mapping.json` entry 가 없거나 ADR 파일이 디스크에 한 개도 없음)이면 그 자리에서 멈춘다 — 전이 확장은 그 노드의 entry·`dependsOn` 을 읽어야 다음 hop 으로 넘어가므로, 중간 노드가 dangling 이면 더 깊은 선행에 도달할 수 없다(그래서 "다 모은 뒤" 가 아니라 hop 마다 점검한다). dangling 이 아니면 그 노드의 `dependsOn` 을 읽어 더 깊은 선행으로 확장하고, 방문한 노드의 ADR Status 를 확인한다.
   - **dangling 참조를 만나면** — `dependsOn` 이 아직 변환·작성되지 않은 선행을 가리키는 경우다 (특히 `/feature-to-adr` 를 단일 feature 인자로 돌렸을 때 발생). 미구현 선행과 동일하게 구현을 멈추고, 그 선행은 ADR 자체가 없음을 알린 뒤 `/adr-new <category>` 로 직접 작성하거나 `/feature-to-adr` 로 해당 feature 를 변환하도록 안내한다.
   - **선행 ADR 이 전부 `Accepted`(구현 완료)** 면 의존이 충족된 것이므로 그대로 3단계로 진행한다.
   - **선행 ADR 중 `Proposed`(미구현) 가 하나라도 있으면 구현을 멈추고**, 무엇이 먼저 필요한지 사용자에게 안내한 뒤 선택을 받는다. 사용자가 선행부터 구현하기로 하면 의존 위상 순서(가장 깊은 선행부터)로 대상 목록을 재구성해 1단계 식별 결과에 더한다.
   - **대상이 여러 ADR 일 때는(사용자가 직접 여러 개를 골랐든, 위에서 선행을 더했든) 항상 `dependsOn` 그래프로 위상 정렬한 뒤 가장 깊은 선행부터 순서대로 구현한다.** 사용자가 입력한 나열 순서(`f3, f1, f2`)를 그대로 따르지 않는다 — 의존 순서가 입력 순서보다 우선한다. 정렬한 구현 순서를 사용자에게 한 줄로 보여주고("구현 순서: f1 → f2 → f3") 진행한다.
   - 의존 그래프에 순환이 있으면(예: f1 ↔ f2) 위상 정렬이 불가능하므로 구현을 멈추고, 어떤 카테고리들이 서로 물려 있는지 알린 뒤 어디부터 끊어서 시작할지 사용자에게 묻는다.

     ```
     `f3`(결제) 은 `f2`(장바구니) 에 의존하는데 `f2` 가 아직 미구현(Proposed) 입니다.
     의존 순서상 `f2` 를 먼저 구현해야 `f3` 가 제대로 동작합니다.

     - `f2` 부터 순서대로 구현하려면: "f2부터" 또는 "둘 다 순서대로"
     - 그래도 `f3` 만 먼저 구현하려면: "f3만" (선행이 미구현이라 일부 동작이 비어 있을 수 있음)
     ```

   - `.mapping.json` 자체가 없거나 대상 카테고리의 entry 가 아예 없는 레거시 ADR 셋이라면 의존을 알 수 없으므로 게이트를 건너뛰되, 한 줄로 "의존성 정보가 없어 순서 점검을 건너뜁니다 (`/feature-to-adr` 또는 `.mapping.json` 의 `dependsOn` 으로 보강 가능)" 라고 알린다. (entry 는 있는데 `dependsOn` 키만 없는 경우는 위 "의존 미선언" 분기로 처리하지 이 레거시 케이스가 아니다.)

3. **계획 수립**
   - ADR의 Decision/Mermaid 다이어그램에서 vertical slice 를 추출한다 (UI → API → 데이터). 한 ADR 은 한 피쳐의 슬라이스 전체를 다루므로, 구현 계획도 같은 피쳐 안에서 UI/API/Data 모든 레이어를 **함께** 변경하는 단위로 잡는다.
   - 카테고리가 안티패턴 카테고리(`frontend/`, `backend/`, `api/` 등 — `structure.md` "흔한 카테고리 예시 — 안티패턴 카테고리" 참조)로 잡혀 있어 vertical slice 추출이 불가능하면 구현을 멈추고 `/adr-sync` 로 카테고리 재정렬을 권한다.
   - ADR Decision 의 키워드로 `Glob`/`Grep` 해 관련 기존 코드를 찾아 읽고 차이를 식별한다 (코드 위치는 매핑에 없으므로 ADR 을 읽고 직접 탐색 — `structure.md` "관련 코드 찾기"). 같은 피쳐의 UI/API/Data 코드가 한곳에 모여 있는지 확인.
   - 변경 계획을 사용자에게 제시하고 승인받는다.

   여러 ADR 을 순서대로 구현하기로 한 경우(2단계에서 선행을 더했을 때), 아래 4~6단계를 **의존 위상 순서의 가장 깊은 선행부터 한 ADR 씩** 반복한다 — 선행이 `Accepted` 가 된 뒤에야 다음 ADR 의 4단계로 넘어간다.

4. **구현**
   - 작은 단위로 Edit/Write.
   - ADR에 명시된 행동 규칙·상태 전이·연동 방식을 그대로 따른다. ADR과 다르게 구현하려면 먼저 ADR을 수정한다.
   - 구현 도중 ADR의 회색지대 결정(채택 근거·도메인 규칙·상태 전이·fallback)을 바꿔야겠다고 판단되면, 코드부터 고치지 말고 멈춰서 "의도된 결정 변경인가, 아니면 ADR을 지키는 게 맞는가"를 사용자와 분기한다 — 결정 변경이면 ADR을 먼저 갱신(또는 새 ADR로 supersede)한 뒤 같은 커밋에 담고, 아니면 ADR대로 구현한다. 코드가 회색지대 결정을 조용히 끌고 가면 PRD → ADR → 코드 단방향이 깨진다 (`adr-sync` "source of truth 의 범위"와 같은 프레이밍).

5. **테스트**
   - 프로젝트의 테스트 명령(`AGENTS.md` 또는 `package.json` 참조)을 실행한다.
   - 테스트가 없으면 사용자에게 어떤 검증 절차를 원하는지 묻는다.
   - 테스트가 실패하면 6단계로 넘어가지 않는다 — 구현 버그면 4단계로, ADR이 잘못된 결정이면 ADR을 먼저 수정하고 다시 4단계로.

6. **Status 자동 전환 (`Proposed → Accepted`)**

   상세 정책은 `README.md` "자동 전환 규칙" 참조. 본 단계가 트리거하는 동작:
   - 5단계 테스트 통과 직후, **사용자 확인 없이** 대상 ADR 본문의 Status 줄을 `Accepted (YYYY-MM-DD)` 로 수정
   - `docs/adr/README.md` 카테고리별 ADR 목록의 한 줄 요약 라벨도 동시 갱신
   - 한 카테고리에 여러 ADR이 함께 구현되었으면 모두 갱신
   - 변경 사항을 사용자에게 한 줄로 알린다 ("ADR auth/0003 Status를 Accepted로 갱신했습니다")

7. **마무리**
   - 변경된 코드와 ADR이 정합한지 한 번 더 확인 (`/adr-sync <category>`).

**금지**:

- 의존성 확인(2단계) 없이 곧바로 계획·구현으로 넘어가지 않는다 — 단일 ADR 이라도 선행 게이트를 먼저 통과해야 한다.
- 선행 ADR 이 미구현(`Proposed`) 인데 사용자 확인 없이 후행 ADR 부터 구현하지 않는다.
- 여러 ADR 을 구현할 때 입력 순서대로 구현하지 않는다 — 반드시 `dependsOn` 위상 순서(선행 우선) 로 구현한다.
- ADR 없이 새 기능을 구현하지 않는다.
- 구현 중 발견한 결정 변경은 코드 수정 전에 ADR에 반영한다.
- 테스트가 통과하지 않은 ADR을 `Accepted`로 올리지 않는다 — Status는 코드 동작의 사실이지 의도 표명이 아니다.
