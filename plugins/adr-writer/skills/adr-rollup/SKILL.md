---
name: adr-rollup
description: Roll up ADRs so each logical decision lives in exactly one current-state ADR, aligned to the shipping code. Default scope is **every category** when no argument is given; an argument narrows to one category or an explicit ADR bundle. Within each category, merge the evolution chain of the same logical decision (refine / supersede / replace) into its lowest-numbered ADR, harvest the chain's major transitions into the category's decision-log.md, and delete the rest — distinct decisions and separate categories stay untouched. Keywords - "adr rollup", "ADR 정리", "ADR 개수 줄이기", "같은 결정 합치기", "evolution chain merge", "Superseded chain 정리".
argument-hint: "[category-or-adr-bundle?]"
disable-model-invocation: true
---

# adr-rollup

목표는 **하나의 logical decision = 하나의 현재 상태 ADR**이다. 같은 결정이 v1 → v2 → v3로 여러 ADR에 진화 히스토리로 흩어져 있으면(과거 evolution-chain 모델의 잔재), 최신 코드가 실제로 하는 결정만 남도록 그 체인을 하나로 합친다. evolution history를 여러 ADR에 분산해 들고 있을 이유가 없다 — 최종 상태 하나만 보면 최신 코드의 비즈니스·기술 결정을 읽을 수 있다. 단 체인이 담고 있던 **주요 전환**(채택 대안 교체·핵심 알고리즘/아키텍처 변경·Driver 반전 등)은 지우지 않고 카테고리의 `decision-log.md` 로 **harvest** 한다 — 개별 diff 는 Git 히스토리가 보존하지만, "왜 갈아치웠나" 의 추적 가능한 시간축은 로그에 남긴다 (`authoring-rules.md` "결정 로그 기록 기준").

**ADR 개수를 줄이는 게 목적이 아니다.** 목적은 "흩어진 진화 히스토리를 결정 단위로 정돈"하는 것이고, 개수 감소는 그 결과일 뿐이다. 적정 ADR 수는 그 카테고리에 실제로 존재하는 서로 다른 logical decision의 수다 — 서로 다른 결정을 개수를 줄이려고 한 ADR에 욱여넣지 않는다. 합칠 체인이 없으면 한 건도 합치지 않는 게 정답이다.

**ADR 구조의 궁극 목표는 "직관적·직선적으로 읽히는 결정 집합"이다.** rollup 이 지향하는 최종 상태는 (1) 각 ADR 본문이 **최신 코드가 하는 결정으로 최신화**되어 있고, (2) ADR 간 **참조 흐름(`Related`·`dependsOn`·survivor 로의 흡수 방향)이 명확**하며, (3) 새 ADR 이 계속 쌓여도 독자가 진화 히스토리를 역추적하지 않고 **한 결정당 한 ADR 만 읽으면 현재 상태를 파악**할 수 있는 구조다. superseded 체인을 방치하면 독자가 "어느 게 살아있는 결정인지"를 링크를 타고 되짚어야 하므로 이 목표가 깨진다 — rollup 은 죽은 멤버를 survivor 로 흡수해 이 직선성을 회복한다.

세 가지를 동시에 한다:

1. **코드 정합(code-first)**: 통합본의 내용은 "옛 ADR들이 뭐라고 적었나"가 아니라 **현재 코드가 실제로 무엇을 하는가**를 기준으로 쓴다. 단 코드가 source of truth 인 범위는 **구현 사실·Status 에 한정**된다 — 회색지대 결정(채택 근거·대안·도메인 규칙·상태 전이·fallback·키 디자인의 의도)은 코드가 아니라 체인의 ADR 에서 살려 적는다. 코드가 그 결정과 모순되면 통합본을 코드에 맞춰 덮어쓰지 말고 5단계 3번의 분기를 따른다 (그러지 않으면 코드 변경이 ADR 을 끌고 다녀 PRD → ADR → 코드 단방향이 깨진다).
2. **주요 이력 harvest(log)**: 체인이 담고 있던 major 전환을 카테고리 `decision-log.md` 로 옮긴다 — 통합본 본문은 현재 상태만 서술하되, "이 결정이 어떤 전환을 거쳐 지금에 이르렀나" 의 시간축은 로그에 역순으로 남긴다 (9단계).
3. **관리 가능한 개수로(merge)**: 같은 결정의 체인을 가장 낮은 번호 ADR로 합치고 나머지는 삭제해, 분산된 진화 히스토리를 관리 가능한 개수의 ADR로 줄인다.

## 범위 (Scope)

- **인자 없음 → 전체 ADR**: `docs/adr/`의 모든 카테고리를 순회하며 각 카테고리 안의 진화 체인을 찾아 통합한다. 이게 기본 동작이다.
- **인자가 카테고리** (`adr-rollup auth`): 해당 카테고리만.
- **인자가 ADR 묶음** (사용자가 "auth/0001, 0002, 0003 합쳐줘"): 그 묶음만.

**통합은 항상 한 카테고리(leaf — 피쳐 sub-folder 또는 단일-피쳐 context) 안에서만 일어난다.** 카테고리 분류는 vertical slice(피쳐) 단위이고 `.mapping.json`·hook이 의존하는 신뢰 기반이므로, 같은 logical decision처럼 보여도 카테고리 경계를 넘어 합치지 않는다 — 특히 **같은 bounded context 를 공유한다는 이유만으로 서로 다른 피쳐 sub-folder(`identity/login` 과 `identity/signup`)의 ADR 을 합치지 않는다**. context 직속 cross-cutting ADR(`identity/0001-...`)도 그 자리에서만 체인을 합친다. 카테고리 자체가 잘못 쪼개져 있다고 의심되면 통합하지 말고 `Suggestions`로 보고한다 (재분류는 `adr-sync`/`structure.md` 절차).

## 무엇을 합치고 무엇을 남기는가

roll-up 대상은 **"같은 결정의 진화 체인"** — 동일 logical decision에 시간순으로 누적된 ADR들이다. 다음 중 둘 이상이 성립할 때만 체인으로 본다:

1. 한 ADR이 다른 ADR을 명시적으로 supersede / replace / extend한다 (Status가 `Superseded by [...]`이거나 본문에 "0002의 결정을 대체한다" 류 서술).
2. 같은 엔티티/도메인 모델/시스템 컴포넌트의 **같은 측면**(키 디자인, 라이프사이클, API 표면 등)을 다룬다.
3. 시간이 지나며 같은 질문(WHAT/HOW)에 대한 답이 바뀌었다.

**Superseded 는 가장 강한 체인 신호다.** Status 에 `Superseded by [...]` 가 있거나 `Superseded` 로 표시된 ADR 은 사실상 "이 결정은 다른 ADR 로 옮겨갔다"는 명시적 선언이므로, 최우선 머지 대상이다 — 죽은(superseded) 멤버를 살아있는 결정으로 흡수하고 삭제해, 독자가 죽은 ADR 을 거쳐 살아있는 결정을 역추적하지 않게 만든다. 즉 rollup 은 이 superseded 관계를 **본문 흡수 + 파일 삭제**로 실체화하는 단계다 (Status 표기만 남기고 파일을 방치하지 않는다). 단 흡수 후 **어느 파일이 survivor 로 남는지**는 4단계 규칙(가장 낮은 번호)을 따른다 — superseding 쪽이 높은 번호여도 survivor 는 낮은 번호이며, superseding 이 담고 있던 최신 결정 내용이 그 낮은 번호 파일로 들어간다.

**합치지 않는 것** (정상이며 그대로 둔다):

- 한 카테고리에 결정이 여럿인 것 (예: `auth/`에 0001 가입, 0002 SSO, 0003 비밀번호 리셋) — 서로 다른 결정이다. 개수는 신호가 아니다. **체인의 존재가 신호다.**
- 같은 feature를 서로 다른 측면에서 다루는 ADR들 (예: "결제 흐름" + "환불 정책") — 결정 주제가 다르면 분리 유지.
- 단일 ADR의 Status만 `Proposed` → `Accepted`로 바뀐 경우 — history가 분산된 게 아니다.

판단이 모호하면 합치지 않는다. 분리 상태가 더 안전하다 — 잘못된 통합은 결정 손실로 이어진다.

## Workflow

### 1. 인덱스·매핑 로드

- `docs/adr/README.md` (개념 인덱스 + 회색지대 모델 — ADR 목록은 없다), `docs/adr/authoring-rules.md` (포함/제외 규칙), `docs/adr/structure.md` (카테고리 정책) 읽기.
- `docs/adr/.mapping.json` 읽기 — 단일 ADR 인덱스(카테고리 → adrs[] 의 path·status·summary) + `dependsOn`. 매핑에 코드 경로도 PRD 참조도 없으므로, 코드 정합 검증에 필요한 코드는 ADR Decision 을 읽고 `Glob`/`Grep` 으로 찾는다 (`structure.md` "관련 코드 찾기"). 매핑이 없으면 디스크의 `docs/adr/<category>/` 디렉토리명으로 카테고리를 추론해 진행한다.
- 대상 카테고리 결정: 인자 없으면 디스크의 `docs/adr/<category>/` 전체.

### 2. 카테고리별 체인 식별

각 카테고리에서 ADR 본문, `.mapping.json` 의 adrs[] 레코드(summary·status), `Related`, `Superseded by` 링크를 모두 읽고 "같은 logical decision"끼리 묶는다 (README 에는 ADR별 한 줄 요약이 없다 — 인덱스는 매핑에 있다). 한 카테고리에 묶음이 여럿일 수도, 하나도 없을 수도 있다. 묶음이 없는 카테고리는 건너뛴다.

전체 범위 실행이면 카테고리마다 이 과정을 반복하되, 통합은 카테고리 내부로 한정한다.

### 3. 체인 전체 + 현재 코드 읽기 (code-first)

각 묶음에 대해:

1. 체인의 **모든 ADR 본문**을 읽는다 — 중요한 결정·대안·다이어그램을 놓치지 않기 위해.
2. ADR Decision 의 키워드로 관련 코드를 `Glob`/`Grep` 해 **현재 코드가 실제로 무엇을 하는지** 확인한다. 옛 ADR이 묘사한 동작 중 코드에 더 이상 없는 것, 코드엔 있는데 어느 ADR에도 없는 결정, 값이 바뀐 것(요구사항 값·상태값·연동 방식)을 식별한다. 체인 안에서 **요구사항 값이 서로 다르게 적혀 있으면**(옛 ADR "10턴" ↔ 새 ADR "20턴") 그 차이 자체가 harvest 할 전환이므로 통합 전에 목록으로 뽑아둔다.

통합본의 **구현 사실·Status** 는 이 코드 사실을 기준으로 쓴다 — 옛 ADR은 "무엇이 결정 대상이었나"를 알려주는 입력일 뿐, 구현 사실의 근거는 코드다. 반면 **회색지대 결정**(채택 근거·대안·도메인 규칙·상태 전이·fallback·키 디자인의 의도)은 체인의 ADR 에서 살려 적고, 코드가 그것과 모순되면 5단계 3번대로 분기한다 (코드가 회색지대 결정을 덮어쓰지 않는다).

### 4. 통합 ADR 작성 (현재 상태만)

체인의 **가장 낮은 번호 ADR을 유지 대상(survivor)**으로 삼고 그 파일에 통합본을 덮어쓴다. 다른 묶음·다른 카테고리는 건드리지 않는다.

**survivor 는 항상 체인의 가장 낮은 번호다 — superseding ADR 이 아니다.** superseded 체인(예: `0001` 이 `0003` 에 의해 superseded)에서 "살아있는 결정"은 최신인 `0003` 이지만, 그 **내용**을 가장 낮은 번호 `0001` 파일로 흡수하고 `0003`(및 중간 멤버)은 삭제한다. 이유는 rollup 의 "흔적 없음" 철학이다 — 낮은 번호를 유지하고 7단계 renumber 로 결번을 메우면 카테고리 번호가 `0001, 0002, ...` 로 직선을 이뤄, 새 ADR 이 쌓여도 독자가 "몇 번이 살아있나"를 되짚을 필요가 없다. survivor 파일 안의 결정은 superseding 이 담고 있던 최신 상태(code-first)로 채운다 — 즉 **파일 번호는 최저, 내용은 최신**이다.

```markdown
# ADR NNNN: 결정 이름

Date: <오늘>

## Status

{현재 코드 상태에 따라 — 4-규칙 0 참조}

## Context

{현재 시점에서 본 문제 정의. "원래는 ~했다가 ~로 바꿨다" 같은 진화 서술 금지}

## Decision Drivers

- {옵션을 변별하는 압력·제약 3-5개. 일반 품질 속성 나열 금지}

## Decision

{현재 시스템이 이렇게 동작한다. 시간순 나열 금지}

### 대안 검토

{현재 결정 이해에 중요한 대안 ≥2개. 폐기 접근은 "채택하지 않은 이유"로 서술}

## Consequences

### Positive

### Negative

### Risks

## Related

{현재 유효한 ADR/문서 링크만 — 같은 카테고리의 다른 logical decision ADR은 링크 유지}
```

**규칙**:

0. **Status는 "현재 코드 상태"를 따른다**: 통합 대상이 구현·운영 중이면 `Accepted (오늘 날짜)`. 통합본의 일부가 아직 코드에 없다면 그 부분은 별도 ADR로 분리하거나 통합본을 `Proposed`로 두고 `/adr-impl`에서 자동 승격되게 한다 — 사용자에게 묻지 않는다.
1. **Seamless merge**: 결과물에 rollup 흔적을 남기지 않는다. 파일명·제목·README 링크에 `(Roll-up)` 표기 금지. **ADR 본문에 Evolution History 섹션을 만들지 않는다** — 본문은 현재 상태만 서술한다. 체인이 담고 있던 major 전환의 근거는 버리지 않고 9단계에서 `decision-log.md` 로 harvest 하며, 개별 diff 는 Git 이 보존한다.
2. **현재 상태만 서술**: "~를 추가했다" 대신 "~로 구성된다".
3. **Decision Drivers / 대안 ≥2 유지**: 통합본도 일반 ADR 작성 규칙(`authoring-rules.md`)을 그대로 따른다. 체인 어딘가에 있던 진짜 대안을 살려 적는다.
4. **중요 결정 유지**: 상태 전이, 행동 규칙, 엔티티 관계, 연동 방식, 비즈니스 로직.
   4-a. **요구사항 계약 무손실 이월**: 체인의 어느 ADR 에 있던 **요구사항 값**(한도·정원·주기·보존 기간·상한·목표치)·권한 규칙·필수 검증 조건은 통합본에 **하나도 빠짐없이** 옮긴다. 값이 체인 안에서 바뀌었으면 **최신 값**을 본문에 쓰고 그 전환을 9단계 harvest 로 `decision-log.md` 에 남긴다. 통합은 압축이지 요구사항 손실이 아니다 — 통합본을 쓴 뒤 [재생성 테스트](../../templates/adr/authoring-rules.md)("코드를 지우고 이 ADR 만으로 요구사항을 지키는 코드를 다시 만들 수 있는가")로 한 번 확인한다.
5. **Mermaid 다이어그램 보존**: 현재 유효한 것을 통합/수정해 유지.
6. **구현 세부 배제**: `authoring-rules.md`의 "ADR에 포함하지 않는 것" 표(+"요구사항이면 예외" 열) + `README.md`의 "코드 직독 테스트"를 적용 — 코드를 읽으면 자명하고 **요구사항도 아닌** 항목(함수 책임, 필드 타입, 환경 변수 이름, 의사코드, 구현 튜닝값 등)이 옛 ADR들에 섞여 있었다면 통합본에서 제거한다. **요구사항 관문을 통과한 항목은 제거 대상이 아니다** (위 4-a).
7. **Error Handling 전략 유지**: graceful degradation·폴백 등 아키텍처 수준의 처리는 유지.

### 5. 코드 정합 검증 (이 스킬이 직접 수행)

통합본을 코드에 대조해 마지막으로 맞춘다 — 별도 `adr-sync` 호출 없이 여기서 끝낸다. grep 전략 상세는 `adr-sync` Pass 2 참조.

1. 통합 ADR에서 검증 가능한 주장 추출 — Status, 엔티티 이름·필드·상태값, API method+path, error code, enum/타입 값, 시스템 연동 방식, 에러 처리 전략, 사용/미사용 명시 기능.
2. 각 주장을, ADR Decision 키워드로 찾은 관련 코드에서 grep으로 검증.
3. **불일치 발견 시 — `adr-sync` "source of truth 의 범위"와 동일하게 분기한다** (코드가 권위인 범위는 구현 사실·Status 에 한정된다. 회색지대 결정까지 코드에 맞춰 덮으면 코드 변경이 ADR 을 끌고 다녀 PRD → ADR → 코드 단방향이 깨진다):
   - **구현 사실·Status (코드가 권위)** — API 표·error code·enum·필드 이름·키 패턴·Status 실재 여부가 코드와 다르면 통합 ADR 을 코드에 맞춰 정정한다. (이건 코드가 자연히 앞서는 정상 방향이다.)
   - **회색지대 결정 (ADR 이 권위)** — 채택 근거·대안·도메인 규칙·상태 전이·외부 의존 fallback·키 디자인의 _의도_ 가 코드와 **모순**되면 통합본을 코드에 맞춰 조용히 고치지 **않는다**. 이건 누군가 ADR-first 사이클을 건너뛰고 결정을 바꾼 신호다 — 10단계 보고의 `[Code re-alignment needed] <category>` 버킷에 기록하고 "의도된 결정 변경인가 위반인가"를 사용자에게 묻는다 (결정 변경이면 ADR 먼저 갱신, 위반이면 코드 정정 대상). rollup 이 단독으로 판정해 ADR 을 덮어쓰지 않는다.
4. **검증 범위**: 아키텍처 수준의 결정 + **요구사항 계약**. 구현 튜닝값(커넥션 풀·백오프·캐시 TTL)·파일 경로는 검증 대상이 아니다. 반면 요구사항 값(최대 턴 수·사용량 한도·보존 기간 등)은 검증 대상이다 — ADR 과 코드의 값이 다르면 `adr-sync` 의 "요구사항 값 (ADR 이 권위)" 분기대로 조용히 코드 쪽으로 고치지 않고 `[Code re-alignment needed]` 에 기록해 사용자에게 묻는다.

### 6. 체인의 나머지 ADR 삭제

체인 안의 더 높은 번호 ADR 파일을 삭제한다 (Deprecated로 남기지 않음). 삭제 전에 그 파일들이 담은 major 전환은 9단계 harvest 로 `decision-log.md` 에 보존되고, 개별 diff 는 Git 히스토리에 남는다. 이 시점엔 결번이 생기지만 그대로 두고, 7단계(번호 정리)에서 한 번에 메운다.

같은 카테고리에 있더라도 **다른 logical decision을 다루는 ADR은 절대 삭제하지 않는다.** 삭제는 항상 묶음 단위.

### 7. 번호 정리 (gap 메우기 — rollup 한정)

삭제 후 생긴 결번을 메워 카테고리 번호를 다시 연속으로 만든다. **이 renumber 는 rollup 에만 있는 단계다** — split(`structure.md`)·`adr-sync` 는 여전히 "결번 유지, renumber 금지"다 (그쪽은 통합이 아니라 분산이므로 흔적이 남는 게 정상). rollup 은 "rollup 흔적을 남기지 않는다"(4단계 규칙 1)는 철학을 따르고, 결번 자체가 흔적이므로 여기서 메운다.

**이번 rollup 에서 ADR 을 실제로 삭제한 카테고리(leaf)에만 적용한다.** 체인을 못 찾아 건너뛴 카테고리, merge 가 한 건도 없던 카테고리는 건드리지 않는다 (그 카테고리의 기존 split 결번은 그대로 보존).

절차 (카테고리 단위, 한 카테고리 안에서만):

1. 삭제 후 **살아남은** ADR 파일들을 현재 번호 오름차순으로 정렬한다 — survivor(통합본)도, 한 번도 체인이 아니었던 독립 ADR 도 모두 포함.
2. 카테고리의 **가장 낮은 번호부터 1씩 증가**하도록 연속 번호를 재배정한다. 상대 순서는 유지. 예: `0001`(통합본), `0004`, `0005` 만 남았으면 → `0001`, `0002`, `0003`. `0001` 은 이미 자리가 맞으니 그대로, `0004 → 0002`, `0005 → 0003`.
3. 번호가 바뀌는 파일을 `git mv` 로 rename 한다 (`git mv docs/adr/<cat>/0004-foo.md docs/adr/<cat>/0002-foo.md`) — kebab title 부분은 그대로. Git 으로 옮겨야 이력이 따라온다.
4. **파일 안의 제목 `# ADR NNNN: ...` 헤더의 번호도 새 번호로 고친다** — 파일명만 바꾸고 본문 제목을 두면 불일치가 남는다.

renumber 로 경로가 바뀐 ADR 은 8단계의 cross-reference 갱신에서 삭제분과 함께 한 번에 repoint 한다.

**결번 검출은 lint 가 사후에 알려준다.** rollup 이 끝난 뒤 (또는 renumber 를 건너뛴 뒤) `adr-structure-lint` 를 돌리면, 삭제로 생긴 결번을 `numbering-gap` **경고**로 표시한다 (에러가 아니다 — split/adr-sync 결번은 정상이므로). 이 경고가 보이면 **사용자에게 "이 카테고리에 결번(예: 0002 없음)이 있는데 지금 renumber 로 메울까요, 아니면 그대로 둘까요?" 를 물어** 결정한다:

- **메운다** → 위 1~4 절차로 renumber 후 8단계 repoint 를 수행한다 (rollup 기본 철학: 흔적 없음).
- **그대로 둔다** → 외부 영구 링크가 많거나(아래 "renumber 의 외부 영향") 사용자가 결번 유지를 원하면 renumber 를 건너뛴다. 이 경우 결번은 남지만 `numbering-gap` 은 경고일 뿐이라 lint 를 막지 않는다.

**기본값(사용자가 응답하지 않으면): 메운다.** renumber 로 결번을 메우는 게 rollup 의 기본 철학("흔적 없음")이므로, 사용자가 명시적으로 "그대로 둬 달라"고 하지 않는 한 renumber 를 수행한다. 물어보되 무응답·불명확한 경우엔 메우는 쪽으로 진행하고, 10단계 요약에 "결번을 메웠다(옛→새)"를 남긴다.

경로 rename 은 외부 링크를 깨는 파괴적 변경이므로 10단계 승인 범위에 포함된다 — 다만 이는 rollup 전체 승인의 일부이지, renumber 만 따로 재확인받는다는 뜻은 아니다 (기본은 메우기).

### 8. 매핑 인덱스 + cross-reference 갱신 (삭제 + renumber 함께 반영)

7단계까지 끝난 **최종 번호** 기준으로 모든 참조를 한 번에 맞춘다. ADR 인덱스는 `.mapping.json` 한 곳이다 (README 에는 ADR 목록이 없다):

- `docs/adr/.mapping.json`의 해당 카테고리 `adrs` 배열에서 삭제된 ADR 레코드 제거, renumber 로 바뀐 레코드의 `path` 를 새 경로로 갱신, 통합(survivor) ADR 레코드의 `summary`·`status` 를 현재 결정에 맞게 갱신.
- 다른 ADR이 삭제된/번호가 바뀐 ADR을 참조하는 Related 링크를 최종 번호로 변경.
- 코드 주석·문서에 남은 stale ADR 인용을 정정한다. **삭제분과 renumber 분은 repoint 방향이 다르므로 스크립트에 서로 다른 플래그로 넘긴다** — 한 번의 호출에 둘 다 줄 수 있다:

  ```bash
  ${CLAUDE_PLUGIN_ROOT}/scripts/adr-invariants.sh --rollup-only \
    --removed "<cat>/<삭제된-NNNN> ..." \
    --renumbered "<cat>/<옛-NNNN>:<cat>/<새-NNNN> ..."
  ```

  - `--removed` (check **(c)**) — 체인에서 **삭제된** ADR id. 출력은 "repoint to the consolidated ADR" — 그 인용을 **통합(survivor) ADR** 로 옮긴다 (결정이 거기로 흡수됐으므로).
  - `--renumbered` (check **(d)**) — renumber 로 번호만 바뀐 같은 ADR 의 `옛:새` 쌍. 출력은 "repoint to its new number" — 그 인용을 **그 ADR 의 새 번호** 로 옮긴다 (결정은 다른 ADR 로 이동한 게 아니라 번호만 바뀌었으므로).
  - 두 플래그를 분리해 넘기므로 스크립트가 `(c)`/`(d)` 로 구분 출력하고, "통합본으로" vs "새 번호로" repoint 를 혼동하지 않는다. 이 grep 은 코드→ADR·ADR→PRD 검사와 같은 source of truth 다.
  - **이 finder 는 repoint 전(前) 대상 locator 이지 사후 검증 게이트가 아니다.** renumber 가 번호를 재사용하므로(0003→0002 등), repoint 를 끝낸 뒤 같은 인자로 다시 돌리면 **새로 올바르게 배치된 파일을 오탐**한다 — 예: `--removed payment/0002` 는 방금 renumber 된 새 `0002-...md` 를, `--renumbered payment/0003:...` 는 새 `0003-...md` 를 다시 잡는다(finder 는 kebab 무시하고 `<cat>/NNNN` 번호 토큰만 매칭). repoint 를 마쳤는지 확인하는 **사후 오라클은 `adr-structure-lint` 의 `related-broken`·`decision-log-link-broken`(둘 다 0 이어야 함) + 삭제/옛 kebab 파일명 grep(0 이어야 함)** 이다 — `decision-log-link-broken` 은 9단계에서 쓴 로그의 `현재 ADR` 포인터가 renumber 후 경로를 가리키는지 보는 검사로, finder 는 로그의 상대 링크(`./NNNN-title.md`)를 매칭하지 못하므로 이 lint 가 유일한 자동 확인이다. 이 finder 는 repoint 를 시작하기 전 한 번만 쓴다.

### 9. 주요 이력 harvest → decision-log.md (맨 마지막)

체인이 담고 있던 **major 전환**을 카테고리 `docs/adr/<category>/decision-log.md` 로 옮긴다. 이 단계는 8단계 이후 **맨 마지막**에 수행한다 — 8단계의 stale-citation finder(`--removed/--renumbered`)는 **로그를 쓰기 전** 기존 트리를 스캔하는 사전 locator 이므로, 로그를 먼저 만들면 finder 가 방금 쓴 로그 엔트리를 오탐한다 (그래서 harvest 는 finder·repoint 가 끝난 뒤에 온다).

무엇을 남기는가 (`authoring-rules.md` "결정 로그 기록 기준" — major 만):

- 채택 대안 교체, Decision Driver 반전, 핵심 알고리즘·아키텍처 변경, 동작을 바꾸는 핵심 버그 수정, `Superseded` 멤버가 대체했던 옛 결정 방향, 대체 없이 폐기된 결정.
- 체인의 각 전환마다 로그 엔트리 하나. 날짜는 그 전환이 실제로 일어난 시점을 알 수 있으면(옛 ADR 의 `Date:`·Status 전환일·git 로그) 그것을, 모르면 오늘로 둔다.
- **minor 는 harvest 하지 않는다** — 경계 서술 다듬기·표현·구현 사실 정정은 로그에 넣지 않는다 (Git 이 보존). 로그를 노이즈로 채우지 않는다. 단 **요구사항 값이 달라진 전환**(최대 20턴 → 30턴)은 minor 가 아니라 harvest 대상이다 — 결과물이 지켜야 하는 계약이 바뀌었기 때문이다.

기록 기준은 `authoring-rules.md` "결정 로그 기록 기준", 포맷은 시드 `decision-log.template.md` 를 그대로 따른다. rollup 이 특히 지켜야 할 것:

- **프로즈에 옛 ADR 번호를 박지 않는다.** 각 엔트리는 `현재 ADR` 링크 한 줄로만 **통합(survivor) ADR 의 최종 경로**(7단계 renumber 후 번호)를 가리킨다. 옛 번호(0002, 0003…)를 본문 텍스트에 적으면, 이후 rollup 의 `scan_citation` 이 로그를 stale 인용으로 오탐한다.
- 로그가 없으면 `docs/adr/decision-log.template.md`(없으면 `${CLAUDE_PLUGIN_ROOT}/templates/adr/decision-log.template.md`)를 카테고리 폴더의 `decision-log.md` 로 복사해 시작하고, 있으면 역순(최신 먼저) 맨 위에 엔트리를 추가한다.
- **삭제하는 `Superseded`/체인 멤버의 회색지대 근거는 harvest 로 보존된다** — 통합본(현재 상태) + 로그(전환 이력)가 함께 옛 결정을 담으므로, 삭제로 결정이 유실되지 않는다.

harvest 는 `.mapping.json` 을 건드리지 않는다 (로그는 컨벤션 파일, 미인덱스 — `structure.md`).

### 10. 사용자 확인 (파괴적 변경 전 항상)

**어떤 파일도 덮어쓰거나 삭제하기 전에 항상 사용자 승인을 먼저 받는다 — 예외 없다.** 특히 superseded 체인 머지는 (a) survivor 파일 덮어쓰기, (b) 나머지 체인 멤버 삭제, (c) renumber 로 인한 rename 을 수반하므로, 아래 요약을 제시하고 명시적 승인을 받은 뒤에만 4·6·7·8·9단계의 쓰기/삭제를 실제로 수행한다. 승인 전에는 계획만 보여주고 디스크를 건드리지 않는다. 전체 범위 실행이면 카테고리별로 묶어 보고하고, 사용자가 일부 카테고리만 승인하면 그 카테고리만 적용한다.

```
## ADR Roll-up 결과

### <카테고리>

- 통합 ADR: NNNN-<이름>.md (← <같은 logical decision> 체인: 0001, 0002, 0003 통합)
- 핵심 결정: <1-2문장, 현재 코드 기준>
- 코드 정합: <검증한 주장과 코드에 맞춰 고친 부분>
- 제거된 내용: <이미 해결된 리스크, 폐기된 접근 등>
- decision-log 반영: <harvest 한 major 전환 개수와 요약, 예: 채택 대안 교체 1건·아키텍처 변경 1건> (harvest 한 게 없으면 생략)
- 번호 정리: <renumber 된 파일 옛→새, 예: 0004→0002, 0005→0003> (바뀐 게 없으면 생략)

### 통합되지 않은 같은 카테고리 ADR

- 0002-<독립 결정 A>.md, 0003-<독립 결정 B>.md, ...
  (다른 logical decision이라 그대로 둠 — 단 renumber 로 번호는 당겨질 수 있음)

### Code re-alignment needed (회색지대 결정이 코드와 모순)

- [Code re-alignment needed] <카테고리> — 통합본의 <결정>이 코드와 어긋남. "의도된 결정 변경(ADR 먼저 갱신)인가 / 코드 위반(코드 정정)인가" 사용자 판단 필요. (없으면 이 섹션 생략)

### 다음 단계 (Proposed로 남은 통합본)

- 통합본 일부가 아직 코드에 없어 `Proposed`로 둠 → `/adr-impl <카테고리>` 로 구현을 이어가면 테스트 통과 시 자동 `Accepted` 전환. (전부 구현되어 있으면 이 섹션 생략)

### 체인 없음 (그대로 둔 카테고리)

- billing, notifications, ...
```

## Notes

- Roll-up은 **정보 손실이 아니라 정보 압축**이다. 중요한 결정 누락 금지 — 통합본(현재 상태) + `decision-log.md`(major 전환 이력)가 함께 체인의 결정을 보존한다.
- 의심스러우면 합치지 않는다. 분리 상태가 안전하다.
- 코드가 source of truth 인 것은 **구현 사실·Status 에 한정**된다 — 이것들이 코드와 충돌하면 통합본을 코드에 맞춰 정정한다. 반면 **회색지대 결정(채택 근거·도메인 규칙·상태 전이·fallback·키 디자인의 의도)은 ADR 이 권위**다. 코드가 이 결정과 모순되면 통합본을 코드에 맞춰 덮어쓰지 말고 5단계 3번처럼 "결정 변경 vs 위반"으로 분기해 사용자에게 묻는다. 회색지대 결정까지 코드에 맞추면 코드 변경이 ADR 을 끌고 다녀 PRD → ADR → 코드 단방향이 깨진다 (`adr-sync` "source of truth 의 범위"와 같은 프레이밍).

### renumber 의 외부 영향 (7단계 적용 시 인지할 것)

7단계 renumber 는 repo 안의 참조를 8단계에서 모두 정정하지만, repo 밖·이력 도구에는 영향이 남는다. 손실이 아니라 trade-off 이므로 인지하고 진행한다:

- **외부 링크는 깨진다**: 옛 경로(`docs/adr/<cat>/0004-...md`)를 가리키던 PR·이슈·위키·북마크의 URL 은 renumber 후 404 가 된다 (GitHub 은 파일 rename 에 리다이렉트를 주지 않는다). 자주 인용되는 ADR 을 renumber 한다면 10단계 보고에 "옛 경로 → 새 경로" 표를 남겨 사용자가 외부 참조를 갱신할 수 있게 한다.
- **git blame 해석**: `git mv` 로 옮겼으므로 라인 이력은 따라오지만, renumber 커밋 직후 `git blame` 은 모든 라인을 그 커밋의 rename 으로 표시할 수 있다. 실제 결정 변경 이력을 보려면 rename 을 건너뛰는 `git log --follow` 또는 rollup 커밋의 `git show` 로 본다.
- 이 두 비용이 부담스러운 카테고리(예: 외부에서 영구 링크로 많이 참조됨)면, renumber 를 건너뛰고 결번을 유지하는 선택지를 사용자에게 제시할 수 있다 — 단 그건 split·sync 의 기본 동작(결번 유지)으로 돌아가는 것이고, rollup 의 "흔적 없음" 철학과는 trade-off 다.
