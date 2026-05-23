---
name: adr-rollup
description: Merge ADRs that capture the **evolution history of the same logical decision** into one current-state ADR. Trigger only when two or more ADRs progressively change/replace the same decision (refine, supersede, replace) — not when a category simply has many ADRs covering different decisions. Multiple ADRs per category is normal and stays untouched. Keywords - "adr rollup", "같은 결정 합치기", "evolution chain merge", "Superseded chain 정리".
disable-model-invocation: true
---

# adr-rollup

여러 ADR이 **같은 logical decision의 evolution history**를 분산해서 들고 있을 때, 이를 하나의 "현재 상태" ADR로 통합합니다.

## 역할 한정 — 잘못 발동되지 않도록

- **roll-up 대상은 "같은 결정의 진화 체인"**: A 결정의 v1 → v1을 개선한 v2 → v2를 다시 대체한 v3 처럼 동일 logical decision에 대해 시간순으로 누적된 ADR들.
- **roll-up 대상이 아닌 것**:
  - 한 카테고리 안에 ADR이 많은 것 (예: `auth/`에 0001 가입, 0002 SSO, 0003 비밀번호 리셋) — **이건 정상**. 서로 다른 결정이므로 통합하지 않는다.
  - 같은 feature를 서로 다른 측면에서 다루는 ADR들 (예: 같은 결제 시스템의 "결제 흐름" + "환불 정책") — 결정 주제가 다르면 통합하지 않는다.
  - 단일 ADR이 작성된 뒤 Status만 `Proposed`(미구현) → `Accepted`(구현 완료)로 바뀐 경우 — history가 분산된 게 아니다.
- 카테고리 ADR 개수만 보고 호출하지 않는다. 개수는 신호가 아니다. **체인의 존재가 신호다.**

## 진화 체인을 식별하는 기준

다음 중 둘 이상이 동시에 성립할 때만 체인으로 본다:

1. ADR이 다른 ADR의 결정을 명시적으로 supersede / replace / extend한다 (Status가 `Superseded by [...]`이거나 본문에 "0002의 결정을 대체한다" 같은 서술).
2. 같은 엔티티/도메인 모델/시스템 컴포넌트의 **같은 측면**(예: 키 디자인, 라이프사이클, API 표면)을 다룬다.
3. 시간이 지나면서 같은 질문(WHAT/HOW)에 대한 답이 변경되었다.

판단이 모호하면 통합하지 않는다 — 정보 손실 위험이 더 크다.

## Workflow

### 1. 후보 식별

대상 카테고리(또는 사용자가 지정한 ADR 묶음)에서 위 기준을 만족하는 체인을 찾는다.

- `docs/adr/<category>/`의 ADR 본문과 README의 한 줄 요약, `Status`, `Related`, `Superseded by` 링크를 모두 읽는다.
- 같은 logical decision인 ADR들을 묶는다. 한 카테고리에 여러 묶음이 있을 수 있고, 묶음이 하나도 없을 수도 있다.
- 묶음이 없으면 **"통합할 것이 없다"**고 사용자에게 보고하고 종료. 카테고리에 ADR이 많다는 이유로 억지로 묶지 않는다.

### 2. 체인 전체 읽기

각 묶음의 모든 ADR 본문을 읽는다. 중요한 결정·대안·다이어그램을 놓치지 않기 위해.

### 3. 통합 ADR 작성

체인의 **가장 낮은 번호 ADR을 유지 대상**으로 삼고, 그 파일에 통합본을 덮어쓴다. 다른 카테고리·다른 묶음의 ADR은 건드리지 않는다.

```markdown
# ADR NNNN: 결정 이름

Date: <오늘>

## Status

Accepted

## Context

{현재 시점에서 본 문제 정의. "원래는 ~했다가 ~로 바꿨다" 같은 진화 서술 금지}

## Decision

{현재 시스템이 이렇게 동작한다. 시간순 나열 금지}

### 대안 검토

{현재 결정 이해에 중요한 대안만. 폐기 접근은 "채택하지 않은 이유"로 서술}

## Consequences

### Positive

### Negative

### Risks

## Related

{현재 유효한 ADR/문서 링크만 — 같은 카테고리의 다른 logical decision ADR은 그대로 링크 유지}
```

**규칙**:

0. **Status는 "현재 코드 상태"를 따른다**: 통합 대상이 이미 구현·운영 중이면 `Accepted (오늘 날짜)`. 통합본의 일부가 아직 코드에 없다면 그 부분은 별도 ADR로 분리하거나 통합본을 `Proposed`로 두고 `/adr-impl`에서 자동 승격되도록 한다 — 사용자에게 묻지 않는다.
1. **Seamless merge**: 결과물에 rollup 흔적을 남기지 않는다. 파일명·제목·README 링크에 `(Roll-up)` 같은 표기 금지. Evolution History 섹션도 만들지 않는다 — Git 히스토리가 source of truth.
2. **현재 상태만 서술**: "~를 추가했다" 대신 "~로 구성된다".
3. **중요 결정 유지**: 상태 전이, 행동 규칙, 엔티티 관계, 연동 방식, 비즈니스 로직.
4. **Mermaid 다이어그램 보존**: 현재 유효한 것을 통합/수정해 유지.
5. **대안 비교표 보존**: 현재 결정 이해에 중요한 것만.
6. **구현 세부 배제**: README "ADR에 포함하지 않는 것" 표 그대로 적용
7. **Error Handling 전략 유지**: graceful degradation, 폴백 패턴 등 아키텍처 수준의 처리는 유지.

### 4. 체인의 나머지 ADR 삭제

체인 안의 더 높은 번호 ADR 파일을 삭제한다 (Deprecated로 남기지 않음). Git 히스토리에 원본이 보존된다.

같은 카테고리에 있더라도 **다른 logical decision을 다루는 ADR은 절대 삭제하지 않는다**. 통합은 항상 묶음 단위.

### 5. README + 매핑 갱신

- `docs/adr/README.md`의 카테고리 목록에서 삭제된 ADR 항목 제거, 통합 ADR의 한 줄 요약 갱신
- `docs/adr/.mapping.json`의 해당 카테고리 `adrs` 배열에서 삭제된 경로 제거

### 6. Cross-reference 갱신

다른 ADR이 삭제된 ADR을 참조하는 Related 링크를 통합 ADR로 변경한다.

### 7. 사용자 확인

변경 요약을 제시하고 승인 전까지 저장하지 않는다.

```
## ADR Roll-up 결과

### <카테고리>

- 통합 ADR: NNNN-<이름>.md (← <같은 logical decision> 체인: 0001, 0002, 0003 통합)
- 핵심 결정: <1-2문장>
- 유지된 결정: <목록>
- 제거된 내용: <이미 해결된 리스크, 폐기된 접근 등>

### 통합되지 않은 같은 카테고리 ADR

- 0004-<독립 결정 A>.md, 0005-<독립 결정 B>.md, ...
  (다른 logical decision이라 그대로 둠)
```

### 8. 코드 동기화 검증

파일 저장 후 통합 ADR의 핵심 아키텍처 결정이 실제 코드베이스와 일치하는지 검증한다. 자세한 grep 전략은 `adr-sync` 스킬 참조.

**검증 절차:**

1. 통합 ADR에서 핵심 아키텍처 주장 추출 — 엔티티 이름·필드·상태값, 시스템 간 연동 방식, 에러 처리 전략, 사용/미사용 명시 기능
2. 각 주장을 `docs/adr/.mapping.json`의 해당 카테고리 `codePaths`에서 grep으로 검증
3. **불일치 발견 시**: 코드가 source of truth이므로 통합 ADR을 코드에 맞게 수정. `docs/adr/README.md`의 한 줄 요약도 함께 갱신
4. 검증 결과를 사용자에게 보고

**검증 범위**: 아키텍처 수준의 결정만. 구현 상수·튜닝값·파일 경로는 검증 대상이 아니다.

## Notes

- Roll-up은 **정보 손실이 아니라 정보 압축**이다. 중요한 결정 누락 금지.
- 의심스러우면 통합하지 않는다 (혹은 사용자에게 묻는다). 분리 상태가 안전.
- Roll-up 후 `/adr-sync <category>` 권장.
