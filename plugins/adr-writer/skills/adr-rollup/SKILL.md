---
name: adr-rollup
description: Roll up ADRs so each logical decision lives in exactly one current-state ADR, aligned to the shipping code. Default scope is **every category** when no argument is given; an argument narrows to one category or an explicit ADR bundle. Within each category, merge the evolution chain of the same logical decision (refine / supersede / replace) into its lowest-numbered ADR and delete the rest — distinct decisions and separate categories stay untouched. Keywords - "adr rollup", "ADR 정리", "ADR 개수 줄이기", "같은 결정 합치기", "evolution chain merge", "Superseded chain 정리".
disable-model-invocation: true
---

# adr-rollup

목표는 **하나의 logical decision = 하나의 현재 상태 ADR**이다. 같은 결정이 v1 → v2 → v3로 여러 ADR에 진화 히스토리로 흩어져 있으면, 최신 코드가 실제로 하는 결정만 남도록 그 체인을 하나로 합친다. evolution history를 여러 ADR에 분산해 들고 있을 이유가 없다 — 최종 상태 하나만 보면 최신 코드의 비즈니스·기술 결정을 읽을 수 있고, 옛 버전은 Git 히스토리가 보존한다.

**ADR 개수를 줄이는 게 목적이 아니다.** 목적은 "흩어진 진화 히스토리를 결정 단위로 정돈"하는 것이고, 개수 감소는 그 결과일 뿐이다. 적정 ADR 수는 그 카테고리에 실제로 존재하는 서로 다른 logical decision의 수다 — 서로 다른 결정을 개수를 줄이려고 한 ADR에 욱여넣지 않는다. 합칠 체인이 없으면 한 건도 합치지 않는 게 정답이다.

두 가지를 동시에 한다:

1. **코드 정합(code-first)**: 통합본의 내용은 "옛 ADR들이 뭐라고 적었나"가 아니라 **현재 코드가 실제로 무엇을 하는가**를 기준으로 쓴다. 단 코드가 source of truth 인 범위는 **구현 사실·Status 에 한정**된다 — 회색지대 결정(채택 근거·대안·도메인 규칙·상태 전이·fallback·키 디자인의 의도)은 코드가 아니라 체인의 ADR 에서 살려 적는다. 코드가 그 결정과 모순되면 통합본을 코드에 맞춰 덮어쓰지 말고 5단계 3번의 분기를 따른다 (그러지 않으면 코드 변경이 ADR 을 끌고 다녀 PRD → ADR → 코드 단방향이 깨진다).
2. **관리 가능한 개수로(merge)**: 같은 결정의 체인을 가장 낮은 번호 ADR로 합치고 나머지는 삭제해, 분산된 진화 히스토리를 관리 가능한 개수의 ADR로 줄인다.

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

**합치지 않는 것** (정상이며 그대로 둔다):

- 한 카테고리에 결정이 여럿인 것 (예: `auth/`에 0001 가입, 0002 SSO, 0003 비밀번호 리셋) — 서로 다른 결정이다. 개수는 신호가 아니다. **체인의 존재가 신호다.**
- 같은 feature를 서로 다른 측면에서 다루는 ADR들 (예: "결제 흐름" + "환불 정책") — 결정 주제가 다르면 분리 유지.
- 단일 ADR의 Status만 `Proposed` → `Accepted`로 바뀐 경우 — history가 분산된 게 아니다.

판단이 모호하면 합치지 않는다. 분리 상태가 더 안전하다 — 잘못된 통합은 결정 손실로 이어진다.

## Workflow

### 1. 인덱스·매핑 로드

- `docs/adr/README.md` (인덱스 + 회색지대 모델), `docs/adr/authoring-rules.md` (포함/제외 규칙), `docs/adr/structure.md` (카테고리 정책) 읽기.
- `docs/adr/.mapping.json` 읽기 — ALPS feature ↔ ADR 매핑. 매핑에 코드 경로는 없으므로, 코드 정합 검증에 필요한 코드는 ADR Decision 을 읽고 `Glob`/`Grep` 으로 찾는다 (`structure.md` "관련 코드 찾기"). 매핑이 없으면 디스크의 `docs/adr/<category>/` 디렉토리명으로 카테고리를 추론해 진행한다.
- 대상 카테고리 결정: 인자 없으면 디스크의 `docs/adr/<category>/` 전체.

### 2. 카테고리별 체인 식별

각 카테고리에서 ADR 본문, README 한 줄 요약, `Status`, `Related`, `Superseded by` 링크를 모두 읽고 "같은 logical decision"끼리 묶는다. 한 카테고리에 묶음이 여럿일 수도, 하나도 없을 수도 있다. 묶음이 없는 카테고리는 건너뛴다.

전체 범위 실행이면 카테고리마다 이 과정을 반복하되, 통합은 카테고리 내부로 한정한다.

### 3. 체인 전체 + 현재 코드 읽기 (code-first)

각 묶음에 대해:

1. 체인의 **모든 ADR 본문**을 읽는다 — 중요한 결정·대안·다이어그램을 놓치지 않기 위해.
2. ADR Decision 의 키워드로 관련 코드를 `Glob`/`Grep` 해 **현재 코드가 실제로 무엇을 하는지** 확인한다. 옛 ADR이 묘사한 동작 중 코드에 더 이상 없는 것, 코드엔 있는데 어느 ADR에도 없는 결정, 값이 바뀐 것(임계값·상태값·연동 방식)을 식별한다.

통합본의 **구현 사실·Status** 는 이 코드 사실을 기준으로 쓴다 — 옛 ADR은 "무엇이 결정 대상이었나"를 알려주는 입력일 뿐, 구현 사실의 근거는 코드다. 반면 **회색지대 결정**(채택 근거·대안·도메인 규칙·상태 전이·fallback·키 디자인의 의도)은 체인의 ADR 에서 살려 적고, 코드가 그것과 모순되면 5단계 3번대로 분기한다 (코드가 회색지대 결정을 덮어쓰지 않는다).

### 4. 통합 ADR 작성 (현재 상태만)

체인의 **가장 낮은 번호 ADR을 유지 대상**으로 삼고 그 파일에 통합본을 덮어쓴다. 다른 묶음·다른 카테고리는 건드리지 않는다.

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
1. **Seamless merge**: 결과물에 rollup 흔적을 남기지 않는다. 파일명·제목·README 링크에 `(Roll-up)` 표기 금지. Evolution History 섹션도 만들지 않는다 — Git이 source of truth.
2. **현재 상태만 서술**: "~를 추가했다" 대신 "~로 구성된다".
3. **Decision Drivers / 대안 ≥2 유지**: 통합본도 일반 ADR 작성 규칙(`authoring-rules.md`)을 그대로 따른다. 체인 어딘가에 있던 진짜 대안을 살려 적는다.
4. **중요 결정 유지**: 상태 전이, 행동 규칙, 엔티티 관계, 연동 방식, 비즈니스 로직.
5. **Mermaid 다이어그램 보존**: 현재 유효한 것을 통합/수정해 유지.
6. **구현 세부 배제**: `authoring-rules.md`의 "ADR에 포함하지 않는 것" 표 + `README.md`의 "코드 직독 테스트"를 적용 — 코드를 읽으면 자명한 항목(함수 책임, 필드 타입, 환경 변수, 의사코드 등)이 옛 ADR들에 섞여 있었다면 통합본에서 제거한다 (회색지대만 남긴다).
7. **Error Handling 전략 유지**: graceful degradation·폴백 등 아키텍처 수준의 처리는 유지.

### 5. 코드 정합 검증 (이 스킬이 직접 수행)

통합본을 코드에 대조해 마지막으로 맞춘다 — 별도 `adr-sync` 호출 없이 여기서 끝낸다. grep 전략 상세는 `adr-sync` Pass 2 참조.

1. 통합 ADR에서 검증 가능한 주장 추출 — Status, 엔티티 이름·필드·상태값, API method+path, error code, enum/타입 값, 시스템 연동 방식, 에러 처리 전략, 사용/미사용 명시 기능.
2. 각 주장을, ADR Decision 키워드로 찾은 관련 코드에서 grep으로 검증.
3. **불일치 발견 시 — `adr-sync` "source of truth 의 범위"와 동일하게 분기한다** (코드가 권위인 범위는 구현 사실·Status 에 한정된다. 회색지대 결정까지 코드에 맞춰 덮으면 코드 변경이 ADR 을 끌고 다녀 PRD → ADR → 코드 단방향이 깨진다):
   - **구현 사실·Status (코드가 권위)** — API 표·error code·enum·필드 이름·키 패턴·Status 실재 여부가 코드와 다르면 통합 ADR 을 코드에 맞춰 정정한다. (이건 코드가 자연히 앞서는 정상 방향이다.)
   - **회색지대 결정 (ADR 이 권위)** — 채택 근거·대안·도메인 규칙·상태 전이·외부 의존 fallback·키 디자인의 _의도_ 가 코드와 **모순**되면 통합본을 코드에 맞춰 조용히 고치지 **않는다**. 이건 누군가 ADR-first 사이클을 건너뛰고 결정을 바꾼 신호다 — 8단계 보고의 `[Code re-alignment needed] <category>` 버킷에 기록하고 "의도된 결정 변경인가 위반인가"를 사용자에게 묻는다 (결정 변경이면 ADR 먼저 갱신, 위반이면 코드 정정 대상). rollup 이 단독으로 판정해 ADR 을 덮어쓰지 않는다.
4. **검증 범위**: 아키텍처 수준의 결정만. 구현 상수·튜닝값·파일 경로는 검증 대상이 아니다.

### 6. 체인의 나머지 ADR 삭제

체인 안의 더 높은 번호 ADR 파일을 삭제한다 (Deprecated로 남기지 않음). Git 히스토리에 원본이 보존된다. 빠진 번호는 결번으로 둔다 — renumber 금지.

같은 카테고리에 있더라도 **다른 logical decision을 다루는 ADR은 절대 삭제하지 않는다.** 삭제는 항상 묶음 단위.

### 7. README + 매핑 + cross-reference 갱신

- `docs/adr/README.md` 카테고리 목록에서 삭제된 ADR 항목 제거, 통합 ADR의 한 줄 요약을 현재 결정에 맞게 갱신.
- `docs/adr/.mapping.json`의 해당 카테고리 `adrs` 배열에서 삭제된 경로 제거.
- 다른 ADR이 삭제된 ADR을 참조하는 Related 링크를 통합 ADR로 변경.
- 코드 주석·문서에 남은 stale ADR 인용을 정정한다. 삭제한 ADR id 들을 `${CLAUDE_PLUGIN_ROOT}/scripts/adr-invariants.sh --rollup-only --removed "<cat>/<NNNN> ..."` 로 점검하면(코드→ADR·ADR→PRD grep 과 같은 source of truth) 위반마다 `file:line` 이 출력되고, 그 인용들을 통합 ADR 로 repoint 한다.

### 8. 사용자 확인

저장(삭제 포함) 전까지 변경 요약을 제시하고 승인을 받는다. 전체 범위 실행이면 카테고리별로 묶어 보고한다.

```
## ADR Roll-up 결과

### <카테고리>

- 통합 ADR: NNNN-<이름>.md (← <같은 logical decision> 체인: 0001, 0002, 0003 통합)
- 핵심 결정: <1-2문장, 현재 코드 기준>
- 코드 정합: <검증한 주장과 코드에 맞춰 고친 부분>
- 제거된 내용: <이미 해결된 리스크, 폐기된 접근 등>

### 통합되지 않은 같은 카테고리 ADR

- 0004-<독립 결정 A>.md, 0005-<독립 결정 B>.md, ...
  (다른 logical decision이라 그대로 둠)

### Code re-alignment needed (회색지대 결정이 코드와 모순)

- [Code re-alignment needed] <카테고리> — 통합본의 <결정>이 코드와 어긋남. "의도된 결정 변경(ADR 먼저 갱신)인가 / 코드 위반(코드 정정)인가" 사용자 판단 필요. (없으면 이 섹션 생략)

### 다음 단계 (Proposed로 남은 통합본)

- 통합본 일부가 아직 코드에 없어 `Proposed`로 둠 → `/adr-impl <카테고리>` 로 구현을 이어가면 테스트 통과 시 자동 `Accepted` 전환. (전부 구현되어 있으면 이 섹션 생략)

### 체인 없음 (그대로 둔 카테고리)

- billing, notifications, ...
```

## Notes

- Roll-up은 **정보 손실이 아니라 정보 압축**이다. 중요한 결정 누락 금지.
- 의심스러우면 합치지 않는다. 분리 상태가 안전하다.
- 코드가 source of truth 인 것은 **구현 사실·Status 에 한정**된다 — 이것들이 코드와 충돌하면 통합본을 코드에 맞춰 정정한다. 반면 **회색지대 결정(채택 근거·도메인 규칙·상태 전이·fallback·키 디자인의 의도)은 ADR 이 권위**다. 코드가 이 결정과 모순되면 통합본을 코드에 맞춰 덮어쓰지 말고 5단계 3번처럼 "결정 변경 vs 위반"으로 분기해 사용자에게 묻는다. 회색지대 결정까지 코드에 맞추면 코드 변경이 ADR 을 끌고 다녀 PRD → ADR → 코드 단방향이 깨진다 (`adr-sync` "source of truth 의 범위"와 같은 프레이밍).
