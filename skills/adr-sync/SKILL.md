---
name: adr-sync
description: ADR이 현재 코드베이스를 정확히 기술하는지 검증하고 drift를 수정한다. 카테고리별 코드 경로 매핑(docs/adr/.mapping.json)을 사용한다. 키워드 - "/adr-sync", "ADR 동기화", "ADR drift 검사".
---

# adr-sync

`docs/adr/`의 모든 ADR이 shipping 코드와 일치하는지 검증한다. drift된 ADR을 수정하고, 관련 ADR 사이의 모순을 잡고, README 인덱스를 동기화한다.

기본은 **deep mode**: 범위 내 모든 ADR 본문을 읽고 모든 주장(API, error code, enum, 엔티티 필드, Status, Related 링크)을 코드와 대조한다. `--quick` 플래그가 있으면 README 한 줄 요약만 빠르게 점검.

## 모드

| Flag      | 모드  | 사용 시점                                   |
| --------- | ----- | ------------------------------------------- |
| (default) | Deep  | 정기 감사, 큰 리팩터링 후, 온보딩 정리      |
| `--quick` | Quick | 작은 코드 변경 후 회귀 점검, 토큰 예산 제약 |

인자가 카테고리면 해당 카테고리만 대상으로 한다 (`/adr-sync auth`).

## Workflow

### 1. 인덱스와 매핑 로드

- `docs/adr/README.md` 읽기 (인덱스 + 작성 규칙)
- `docs/adr/.mapping.json` 읽기 (카테고리 → 코드 경로 매핑). hook이 사용하는 같은 파일.
- 디스크의 ADR 파일 전수 조회: `docs/adr/<category>/*.md`. README에 없는 파일이 있거나, README는 가리키는데 파일이 없으면 그 자체가 drift.

#### 매핑 파일이 없을 때

`docs/adr/.mapping.json`이 아직 없거나 비어 있으면 다음 순서로 fallback한다:

1. 디스크의 `docs/adr/<category>/` 디렉토리 이름을 카테고리 후보로 추론한다.
2. 사용자에게 각 카테고리의 `codePaths` (영향 받는 코드 glob)를 묻는다 — **추측하지 않는다**. hook이 이 값을 신뢰하므로 정확해야 한다.
3. 답을 받아 `docs/adr/.mapping.json`을 생성한 뒤, 같은 명령을 이어서 수행한다.

매핑 없이 sync를 강행하면 검증 범위가 ADR 본문에 명시된 폴더 인용에 한정돼 Pass 1이 사실상 무력화된다.

### 2. Pass 1 — quick drift 검출 (quick mode entry point)

각 ADR에 대해 `docs/adr/README.md`의 한 줄 Key Decision을 추출하고, 카테고리 `codePaths`에 grep을 돌린다. 결과를 **In Sync** 또는 **Drift Suspected**로 표시.

Quick mode는 이 단계만 수행한다.

### 3. Pass 2 — deep verification (deep mode 항상 실행)

각 대상 ADR에 대해:

1. ADR 본문을 전부 읽는다.
2. 검증 가능한 주장 추출:
   - **Status** — codePaths grep으로 코드 실재 여부를 확인하고 Status drift를 자동 정정한다 (`Accepted`인데 코드에 없으면 `Proposed`로, `Proposed`인데 코드+테스트가 있으면 `Accepted (YYYY-MM-DD)`로). 상태 값 의미·자동 전환 정책 상세는 [adr-manage SKILL.md §4](../adr-manage/SKILL.md) 및 README "자동 전환 규칙" 참조. 정정 내역은 7단계 보고 **Fixed** 섹션에 기재.
   - **API endpoints** — method + path 표. 라우터/핸들러 grep.
   - **Error codes** — 상수 grep.
   - **Enum / 타입 값** — `oneof=...`, validate 태그, TS union grep.
   - **엔티티 필드 이름** — DB 태그 (`dynamodbav`, ORM annotation) grep.
   - **GSI/sparse 인덱스 키 패턴** — 파티션 명·sort key prefix grep.
   - **UI 라벨/상수** — 사용자 노출 문자열 grep.
   - **Source-of-truth 포인터** — "스키마는 `docs/tables/auth.md` 참조" 같은 외부 문서 경로가 아직 존재하고 그 파일 자체와도 일치하는지.
   - **Related ADR 링크** — 존재 여부와 Status 정합성.
3. 구현 세부사항 bloat 식별 — 파일 경로(폴더 이하), 코드 스니펫, 상수, 엔티티 필드 상세 표 → 점진적 정리로 제거.
4. ADR을 코드에 맞게 수정. `docs/adr/README.md`의 한 줄 요약도 함께 갱신.

**주의**: 새 구현 세부사항을 ADR에 추가하지 않는다. ADR은 결정/아키텍처 레이어에 머문다.

### 3.5. 카테고리 슬라이스 무결성 점검

`.mapping.json` 의 카테고리 키와 `codePaths` 가 vertical slice 원칙(피쳐 단위)을 따르는지 함께 본다 — 안티패턴 카테고리 목록과 cross-cutting 사용 조건은 README "흔한 카테고리 예시" 참조.

- **카테고리 키 검사** — README 안티패턴 카테고리(기술 레이어/구조 단위)가 있으면 drift로 표시. 사용자에게 피쳐 단위로 재정렬하자고 제안
- **codePaths 슬라이스 검사** — 같은 피쳐의 UI/API/Data 코드가 서로 다른 카테고리의 codePaths에 흩어져 있으면 drift. 한 피쳐의 모든 레이어 글롭은 한 카테고리에 모아야 한다
- 위반은 `Suggestions` 가 아니라 `Fixed` 또는 `Contradictions Resolved` 에 기록한다 — 카테고리 분류는 ADR 사이클의 신뢰 기반이라 미루지 않는다.

### 4. Cross-ADR 모순 점검

각 수정된 ADR의 Related 링크를 따라 다른 ADR을 점검한다:

- 같은 동작을 다르게 묘사하는지 (임계값, 에러 코드, 흐름 단계)
- Status 충돌: `Accepted`(구현 완료) ADR이 `Proposed`(미구현) ADR의 기능에만 의존하고 있는지 — 의존 ADR이 미구현이면 의존하는 ADR도 실제로는 동작하지 않을 수 있으므로 Status 검증
- Superseded ADR이 옛 ADR의 모든 결정을 커버하지 못함
- 카테고리 이관 후 stale한 cross-reference

### 5. 보조 doc 점검

ADR이 의존하는 비-ADR 문서도 함께 본다:

- `docs/tables/**` 또는 동등한 스키마 문서 — 엔티티 관계가 ADR에서 바뀌었으면 같은 변경이 테이블 문서에도 반영되어야 한다. 양방향 Related 링크가 살아 있는지 확인.
- `docs/adr/<category>/*-data-flow.md` 같은 보조 문서 — API 표·예시 레코드·키 명세가 코드와 정렬돼 있는지.
- 코드 주석에 박힌 ADR 인용 (`// See ADR auth/0002 §1`) — 카테고리 이관·split·번호 변경 후 stale 인용이 없는지.

수정 후 stale ADR 인용 sanity grep을 돌린다 (예시):

```bash
# 카테고리 이관·split 후 흔히 발견되는 stale 패턴
grep -rn "ADR <옛-카테고리>/<옛-번호>\|<제거된-경로>" -- packages/ apps/ src/ docs/ .claude/
```

찾은 stale 인용은 같은 PR에서 정정한다.

### 6. 매핑·인덱스 hygiene

- `docs/adr/.mapping.json`의 `adrs` 배열이 디스크의 실제 파일과 일치
- `lastSyncedAt`을 ISO 타임스탬프로 갱신
- README의 모든 항목이 존재하는 파일을 가리킴
- 디스크의 모든 ADR 파일이 정확히 한 번 인덱싱됨

### 7. Report

```
## ADR Sync Results (mode: deep|quick)

### Scope
- Categories: <list or "all">
- ADRs inspected: <n>

### Fixed
- [ADR <category>/NNNN: ...] — X 섹션이 이제 Y라고 함 (이유: <근거>)

### Contradictions Resolved
- [ADR A ↔ ADR B] — 무엇이 충돌했고 어떻게 화해시켰는지

### In Sync
- [ADR ...], ...

### Index Hygiene
- README/매핑 변경 사항

### Suggestions
- [New ADR needed?] — ADR 없는 결정 발견
- [Supersede recommended?] — 패치 범위를 넘은 drift
```

## Notes

- ADR은 **왜 이 결정이 내려졌는지**를 기록. 작은 버그 수정·스타일 변경은 ADR 갱신 사유가 아니다.
- 카테고리 내 번호는 순차 증가. split으로 내용이 빠진 번호는 결번으로 둔다 (renumber 금지).
- 코드가 source of truth — 코드와 ADR이 충돌하면 ADR을 고친다 (정책상 ADR이 옳아야 한다는 사용자 명시가 없는 한).
