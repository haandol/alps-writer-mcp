---
name: adr-manage
description: Use this skill whenever you are about to create or edit an ADR — directly, via /feature-to-adr, /adr-impl, /adr-sync, or /adr-cycle. Triggers on any user request that adds, changes, refactors, or removes feature behavior, or that explicitly mentions ADRs. Examples in any language - "F1 구현해줘", "이 부분 좀 바꿔줘", "결제 흐름 수정", "ADR 만들어줘", "새 기능 추가", "implement signup", "refactor the cart", "rework auth flow", "draft an ADR for ...". Loads the writing rules (folder-depth references, implementation-detail exclusion, Status values, DB schema co-change) so the resulting ADR passes review.
---

# adr-manage

ADR 생성 및 수정 시 `docs/adr/README.md`의 작성 규칙을 자동으로 적용한다. 본 plugin의 source of truth는 `${CLAUDE_PLUGIN_ROOT}/templates/adr/README.md` 이며, 프로젝트에 복사된 `docs/adr/README.md`가 있으면 그쪽이 우선한다.

## 트리거

- ALPS Section 7 feature → ADR 변환 (`/feature-to-adr`)
- 새 ADR 생성 요청
- 기존 ADR 수정/업데이트
- ADR 내용에 대한 논의 중 직접 편집이 필요할 때

## Workflow

### 1. 작성 규칙 로드

작업 전 반드시 `docs/adr/README.md`의 **작성 규칙** 섹션을 읽는다. 없으면 plugin 템플릿(`${CLAUDE_PLUGIN_ROOT}/templates/adr/README.md`)을 프로젝트로 복사한 뒤 시작한다.

ALPS feature를 ADR로 변환하는 작업이거나, ALPS의 9개 섹션 구조·vertical slice 의도가 기억나지 않으면 `${CLAUDE_PLUGIN_ROOT}/templates/alps/about-alps.md` 를 먼저 읽는다. ALPS의 section 의도와 vertical-slice 원칙이 ADR 분할 결정의 근거가 된다.

### 2. 새 ADR 생성

1. 카테고리(=ALPS feature 또는 도메인) 결정 — kebab-case
2. `docs/adr/<category>/` 의 기존 ADR 번호를 확인하여 다음 번호 부여
3. README 템플릿 구조: Status / Context / Decision / Consequences / Related
4. 검증 규칙 적용하여 초안 작성
5. `docs/adr/README.md`의 "카테고리별 ADR 목록"에 한 줄 요약 추가
6. `docs/adr/.mapping.json`의 해당 카테고리 `adrs` 배열에 경로 추가
7. **사용자 승인 전까지 저장하지 않는다**

### 3. 기존 ADR 수정

1. 수정 대상 ADR을 읽는다
2. 변경 사항을 적용하면서 검증 규칙을 함께 적용한다
3. 기존에 규칙을 위반하는 내용이 있으면 이번 수정 시 정리한다 (점진적 정리)
4. `Updated:` 날짜를 오늘로 갱신
5. README의 한 줄 요약도 필요 시 갱신

### 4. 검증 규칙

#### Status 값

유효: `Proposed`, `Accepted`, `Deprecated`, `Superseded by [ADR XXXX](link)`.
`Implemented`, `Done`, `Completed` 등은 무효 — **구현 완료는 `Accepted`로 표현한다**. 구현 진행 단계 부연은 괄호로: `Accepted (Phase 1 완료)`.

의미:

- `Proposed` — ADR이 시스템에 제안되었으나 **아직 구현되지 않음**. 결정 내용 자체에 대한 합의는 이 단계에서도 이미 끝났다고 본다.
- `Accepted` — **코드 구현이 완료**되어 ADR이 묘사하는 동작이 코드베이스에 실제로 존재하는 상태. 테스트가 통과한 시점에 부여한다.

자동 전환:

- 신규 ADR(`/feature-to-adr`)은 항상 `Proposed`로 저장한다 — 사용자에게 "Accepted로 할까요?"라고 묻지 않는다.
- `/adr-impl`이 구현·테스트를 마치면 ADR 본문의 Status를 `Accepted (YYYY-MM-DD)`로 직접 수정해 같은 사이클에 함께 저장한다. 사용자에게 승격 여부를 따로 확인하지 않는다.
- `/adr-sync`는 코드와 ADR을 대조해 Status를 자동 정정한다. ADR이 `Accepted`라고 주장하는데 묘사한 동작이 코드에 없으면 `Proposed`로 되돌리고, `Proposed`인데 코드에 이미 존재하면 `Accepted`로 올린다.

#### 리트머스 테스트

> "이 값/세부사항이 코드에서 바뀌면, 아키텍처 결정 자체가 바뀌는가?"
> NO → ADR에 넣지 않는다. YES → 유지.

#### 코드 참조 깊이 — 폴더 단위까지만

- 허용: `packages/api/handlers/`, `apps/web/src/components/`
- 금지: 파일명(`Login.tsx`), 줄 번호 인용, 함수 시그니처

본문·표·Mermaid 다이어그램 모두에 동일하게 적용.

#### 금지 항목

| 항목                     | 대안                         |
| ------------------------ | ---------------------------- |
| 파일 경로 또는 그 이하   | 폴더 단위                    |
| 코드 스니펫              | 코드 자체가 source of truth  |
| 엔티티 상세 필드 표      | `docs/tables/`로 위임        |
| 구현 상수/튜닝값         | 개념만 ("재시도는 제한된다") |
| 마이그레이션/운영 명령어 | 스크립트 자체에 문서화       |
| 전체 API JSON 응답 예시  | 1-2문장 요약                 |

#### 유지 항목

- 문제 배경과 동기 (WHY)
- 결정 요약과 대안 비교
- 엔티티 관계 (개념 수준)
- 행동 규칙·상태 전이
- 시스템 간 연동 방식
- Mermaid 다이어그램 (sequenceDiagram / stateDiagram / flowchart)
- Consequences (긍정/부정/리스크)
- DB 키 디자인·액세스 패턴 (해당 시)

#### Vertical Slice 원칙 (ALPS 변환 시)

ALPS는 각 feature를 UI → API → 데이터의 vertical slice로 정의한다. ADR도 이 흐름을 보존해야 한다.

- Decision 섹션에서 사용자 동작 → API → 데이터 변형까지의 단일 슬라이스를 한 단락 또는 시퀀스 다이어그램으로 묘사한다.
- 슬라이스 경계가 모호하면 ADR을 분리한다.

#### 다이어그램 내 코드 참조

Mermaid 다이어그램 안에서도 함수명/메서드 호출 대신 동작을 서술한다.

- Bad: `stats.IncrementSourceCount("diarychat")`
- Good: `sourceCounts.diarychat 증가`

이 규칙은 sequenceDiagram, stateDiagram, flowchart 모두에 동일하게 적용된다.

#### API 섹션

API 엔드포인트 표(Method, Path, 설명)는 아키텍처 결정의 일부이므로 유지한다. 단, 전체 요청/응답 JSON 예시·헤더 상세·에러 응답 페이로드는 포함하지 않는다 (1-2문장 요약으로 대체).

#### DB 스키마와 액세스 패턴

키 디자인(PK/SK/GSI)은 **아키텍처 결정의 핵심**이므로 ADR에 유지한다. 키 패턴이 바뀌면 액세스 가능 범위·핫 파티션 위험·인덱스 비용이 달라져 결정 자체가 흔들린다.

ADR에 포함:

- **키 디자인 표**: PK / SK / GS1PK / GS1SK 패턴, sparse 인덱스 적용 여부
- **액세스 패턴 표**: 용도, 쿼리(Table/GSI/GetItem/BatchGet), 호출 빈도(고/중/저)
- **설계 근거**: 왜 이 파티셔닝이 안전한가, sparse 인덱스 사용 이유, 진도/카운터 분리 정책

ADR에서 제외:

- 엔티티의 **모든 속성을 나열한 필드 표** → `docs/tables/{테이블}.md` 로 위임
- 마이그레이션 스크립트, 백필 명령어

**싱글 테이블/공유 스키마 동시 작업 규칙 (필수):**

ADR이 새 엔티티를 추가하거나 기존 키 패턴을 바꾸는 경우, 다음을 **하나의 변경 단위로** 처리한다:

1. ADR 본문에 키 디자인·액세스 패턴 표 작성
2. `docs/tables/{테이블}.md` 에 해당 엔티티 추가/갱신 (필드 정의·SK prefix 가능 패턴·예시 포함)
3. `docs/tables/{테이블}.md` 의 **Related ADRs** 섹션에 새 ADR 역참조 링크 추가
4. ADR 의 Related 섹션에서 해당 테이블 문서 링크 추가

세 곳(ADR, 테이블 문서, 양방향 링크)이 모두 갱신돼야 한 작업이 끝난 것으로 본다. 한쪽만 업데이트하면 검토 시 불일치가 누적된다.

`docs/tables/`를 사용하지 않는 프로젝트라면 동등한 스키마 문서(예: `prisma/schema.prisma`, `db/schema.sql`, OpenAPI 스펙)와의 양방향 링크로 대체한다 — source-of-truth 문서와 ADR이 항상 함께 움직이게 하는 것이 핵심이다.

### 5. 한국어 작성

ADR 본문은 한국어로 작성. 기술 용어, 코드 식별자, 영문 고유명사는 원어 그대로.

### 6. 최종 확인

1. Status 값이 유효한지
2. 폴더 단위 이하 참조가 남아 있지 않은지 (다이어그램 내부도 동일)
3. `docs/adr/README.md` 인덱스가 갱신되었는지
4. `docs/adr/.mapping.json`이 갱신되었는지
5. Related 링크가 유효한지
6. DB 스키마 변경이 있었다면:
   - 키 디자인·액세스 패턴 표가 ADR에 있는지
   - `docs/tables/{테이블}.md` (또는 동등 문서)가 갱신됐는지
   - 테이블 문서의 Related ADRs 섹션에 이 ADR 링크가 있는지
   - ADR 의 Related 섹션에 테이블 문서 링크가 있는지
