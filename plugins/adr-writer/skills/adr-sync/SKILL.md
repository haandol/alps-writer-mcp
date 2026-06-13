---
name: adr-sync
description: Verify that ADRs in docs/adr/ accurately describe the current codebase and fix any drift. Uses the category-to-code-path mapping at docs/adr/.mapping.json. Use when the user invokes /adr-sync or asks to audit ADRs against shipping code. Keywords - "/adr-sync", "ADR sync", "ADR drift check", "ADR 동기화", "ADR drift 검사".
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

- `docs/adr/README.md` (인덱스 + 회색지대/의존성 모델), `docs/adr/authoring-rules.md` (작성 규칙·리뷰 체크리스트), `docs/adr/structure.md` (디렉토리·매핑 정책) 읽기
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
   - **Status** — codePaths grep으로 코드 실재 여부를 확인하고 Status drift를 자동 정정한다 (`Accepted`인데 코드에 없으면 `Proposed`로, `Proposed`인데 코드+테스트가 있으면 `Accepted (YYYY-MM-DD)`로). 상태 값 의미·자동 전환 정책 상세는 `README.md` "자동 전환 규칙" 참조. 정정 내역은 7단계 보고 **Fixed** 섹션에 기재.
   - **API endpoints** — method + path 표. 라우터/핸들러 grep.
   - **Error codes** — 상수 grep.
   - **Enum / 타입 값** — `oneof=...`, validate 태그, TS union grep.
   - **엔티티 필드 이름** — DB 태그 (`dynamodbav`, ORM annotation) grep.
   - **GSI/sparse 인덱스 키 패턴** — 파티션 명·sort key prefix grep.
   - **UI 라벨/상수** — 사용자 노출 문자열 grep.
   - **Source-of-truth 포인터** — "스키마는 `docs/tables/auth.md` 참조" 같은 외부 문서 경로가 아직 존재하고 그 파일 자체와도 일치하는지.
   - **Related ADR 링크** — 존재 여부와 Status 정합성.
3. 구현 세부사항 bloat 식별 — 다음 두 기준으로 본문을 훑고 점진적으로 제거한다:
   - **코드 직독 테스트** (`README.md` "ADR이 다루는 영역 — 비즈니스와 코드 사이의 회색지대"): 본문 단락이 codePaths 의 코드를 읽으면 자명한가? 자명하면 ADR 에서 뺀다 (함수 책임 분담, 모듈 의존 그래프, 필드 타입표, 에러 메시지·UI 라벨, 환경 변수 이름, 의사코드 등).
   - **금지 항목 표** (`authoring-rules.md` "ADR에 포함하지 않는 것"): 파일 경로(폴더 이하), 코드 스니펫, 구현 상수·튜닝값, 엔티티 필드 상세 표, 마이그레이션 명령어, 전체 JSON.
4. 회색지대 충실도 점검 — 본문에 (a) 대안 비교/채택 근거 (b) 비즈니스 규칙의 시스템 번역 (c) 도메인 규칙·상태 전이 (d) 외부 의존 fallback 중 하나도 없으면 ADR 가치가 약하다는 신호 → `Suggestions` 에 "회색지대 보강 또는 ADR 폐기 검토" 로 기록.
5. Decision Drivers / 대안 ≥2 점검 (`authoring-rules.md` "Decision Drivers" / "대안 검토 — 최소 2개 이상"):
   - Decision Drivers 가 빈약(0-2개)하거나 일반 품질 속성("유지보수성", "확장성") 일색이면 → `Suggestions` 에 "Drivers 를 옵션 변별하는 사실/제약으로 보강" 으로 기록
   - 대안이 1개뿐이거나 strawman 이면 → `Suggestions` 에 "현실적 대안 추가 또는 ADR 폐기 검토" 로 기록 (이미 `Accepted` 인 ADR 이 흔한 누락 케이스 — 회고적으로라도 검토 당시의 옵션을 적는다)
6. ADR을 코드에 맞게 수정. `docs/adr/README.md`의 한 줄 요약도 함께 갱신.

**주의**: 새 구현 세부사항을 ADR에 추가하지 않는다. ADR은 비즈니스 ↔ 코드 사이의 회색지대(결정의 근거·도메인 규칙·트레이드오프) 만 다룬다 — 코드를 직접 읽어 알 수 있는 사실은 코드와 docstring 으로 보낸다.

### 3.5. 카테고리 슬라이스 무결성 점검

`.mapping.json` 의 카테고리 키와 `codePaths` 가 vertical slice 원칙(피쳐 단위)을 따르는지 함께 본다 — 안티패턴 카테고리 목록과 cross-cutting 사용 조건은 `structure.md` "흔한 카테고리 예시" 참조.

- **카테고리 키 검사** — `structure.md` "안티패턴 카테고리"(기술 레이어/구조 단위)가 있으면 drift로 표시. 사용자에게 피쳐 단위로 재정렬하자고 제안
- **codePaths 슬라이스 검사** — 같은 피쳐의 UI/API/Data 코드가 서로 다른 카테고리의 codePaths에 흩어져 있으면 drift. 한 피쳐의 모든 레이어 글롭은 한 카테고리에 모아야 한다
- 위반은 `Suggestions` 가 아니라 `Fixed` 또는 `Contradictions Resolved` 에 기록한다 — 카테고리 분류는 ADR 사이클의 신뢰 기반이라 미루지 않는다.

### 3.6. 카테고리 비대화 점검 (분할 권고)

각 카테고리(또는 sub-folder)의 ADR 파일 수가 `structure.md` "카테고리가 비대해질 때 — sub-vertical-slice 분할" 에서 정한 임계값(15) 이상인지 본다. 이상이면 같은 섹션의 "점검·제안 절차" 의 sub-feature 후보 도출을 그대로 적용한다.

- sync 사이클에서는 **분할을 자동 수행하지 않는다** — 폴더 이동은 cross-reference·hook lookup 키·README 인덱스에 동시 영향을 주므로 사용자 합의가 필요하다.
- 결과는 `Suggestions` 섹션에 `[Sub-folder split recommended] <category> 안에 ADR <n>개 — 후보 sub-feature: ...` 형태로 한 줄 권고로 남긴다. 다음 사이클에서 사용자가 합의하면 `structure.md` 의 분할 절차로 분할.
- evolution chain 신호(여러 ADR 의 Status 가 `Superseded by` 로 묶여 있음)가 함께 보이면 분할 대신 **rollup 우선** 을 권고에 명시한다 — chain 을 sub-folder 로 흩으면 추적이 어려워진다.

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
- 코드 주석·상수·import 에 남은 ADR 인용 (`// See ADR auth/0002 §1`, `ADR_REF = "auth/0002"`) — **코드 → ADR 역참조는 원칙상 금지**다 (`README.md` "의존성은 단방향, 참조는 어느 방향으로도 직접 적지 않는다"). 정정이 아니라 **제거**하고, 그 코드↔ADR 연결이 아직 매핑에 없으면 `.mapping.json` 의 해당 카테고리 `codePaths`/`adrs` 로 옮긴다. ADR 번호는 split/rollup/supersede 로 이동하므로 코드가 ADR ID 를 들고 있으면 결정이 안 바뀌었는데도 구조 변경이 코드 수정을 줄줄이 강제한다.
- ADR 본문(Context·Related 포함)에 남은 PRD 인용 (`prd/foo.alps.xml`, `ALPS Section 7 #F-AUTH-01`, `Section 6.3`) — **ADR → PRD 역참조도 원칙상 금지**다 (같은 의존성 모델). 코드↔ADR 과 대칭으로, 정정이 아니라 **제거**하고 그 PRD↔ADR 연결을 `.mapping.json` 의 `alpsDocument`/해당 카테고리 `alpsFeatureId` 로 옮긴다. ALPS feature 가 split/재번호/재구성되면 결정이 안 바뀌었는데도 ADR 본문 수정을 강제하므로, 연결은 매핑 한 곳에만 둔다. (제거 결과는 7단계 보고 **Fixed** 에 기재.)

수정 후 양방향 역참조 sanity grep을 돌린다 (예시):

```bash
# (a) 코드·문서 본문에 남은 ADR ID/경로 — 코드 → ADR 역참조 (원칙상 0건)
grep -rn "ADR <카테고리>/<번호>\|docs/adr/<카테고리>" -- packages/ apps/ src/ .claude/

# (b) ADR 본문에 남은 PRD 경로/Section 인용 — ADR → PRD 역참조 (원칙상 0건)
grep -rnE "\.alps\.xml|ALPS Section|Section [0-9]" -- docs/adr/
```

(a) 에서 찾은 코드→ADR 역참조는 코드에서 제거해 `.mapping.json` 으로, (b) 에서 찾은 ADR→PRD 역참조는 ADR 본문에서 제거해 `alpsDocument`/`alpsFeatureId` 로 이전한다 — 둘 다 같은 PR 에서 처리. `docs/adr/` 내부의 ADR ↔ ADR Related 링크는 정상이므로 (a) 의 grep 대상에서 코드/소스 디렉토리만 둔다.

### 6. 매핑·인덱스 hygiene

- `docs/adr/.mapping.json`의 `adrs` 배열이 디스크의 실제 파일과 일치
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
