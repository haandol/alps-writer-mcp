---
name: adr-manage
description: Use this skill whenever you are about to create or edit an ADR — directly, via /adr-new, /feature-to-adr, /adr-impl, or /adr-sync. Triggers on any user request that adds, changes, refactors, or removes feature behavior, or that explicitly mentions ADRs. Examples in any language - "ADR 만들어줘", "F1 구현해줘", "이 부분 좀 바꿔줘", "결제 흐름 수정", "새 기능 추가", "draft an ADR for ...", "implement signup", "refactor the cart", "rework auth flow". Loads the writing rules (folder-depth references, implementation-detail exclusion, Status values, DB schema co-change) so the resulting ADR passes review.
---

# adr-manage

ADR 생성·수정의 **절차**를 정의한다. 작성 규칙(금지 항목, 유지 항목, vertical slice 원칙, Status 의미, 다이어그램 가이드, DB 동시 작업, 리뷰 체크리스트 등) **자체**는 `docs/adr/README.md`(없으면 `${CLAUDE_PLUGIN_ROOT}/templates/adr/README.md`)가 source of truth이므로 본 스킬에서 다시 풀어쓰지 않는다.

ADR은 이 plugin의 일급 산출물이다 — ALPS PRD 가 있든 없든 ADR 자체로 작성·관리하고, 코드는 ADR을 근거로 구현한다. ALPS Section 7 → ADR 자동 변환(`/feature-to-adr`)은 그 위에 얹는 helper다.

## 트리거

- 새 ADR 생성 요청 — 기본 경로는 `/adr-new <category>` (ALPS PRD 유무와 무관)
- 기존 ADR 수정/업데이트
- ALPS Section 7 feature → ADR 일괄 변환 (`/feature-to-adr`)
- ADR 내용에 대한 논의 중 직접 편집이 필요할 때

## Workflow

### 1. 작성 규칙 로드 (필수)

작업 전 반드시 `docs/adr/README.md`의 다음 섹션을 읽는다 — 본 스킬에서 다시 풀어쓰지 않는다.

- "ADR이 다루는 영역 — 비즈니스와 코드 사이의 회색지대" — **모든 작성/수정의 1차 필터**. 코드 직독 테스트로 코드가 source of truth 인 항목은 ADR 에서 빼고, 회색지대(채택 근거·비즈니스 규칙의 시스템 번역·도메인 규칙·외부 의존 fallback) 만 남긴다
- "ADR이 다루는 결정의 종류" / "ADR이 아닌 것 (anti-patterns)" — 작성 여부 판단
- "디렉토리 구조" / "흔한 카테고리 예시" — vertical slice 원칙, 금지 카테고리(안티패턴), cross-cutting 카테고리 사용 조건
- "상태" / "자동 전환 규칙" — Status 값 의미와 자동 전환 정책
- "작성 규칙" — 두 단계 필터(코드 직독 + 리트머스), 코드 참조 깊이, 금지/유지 항목, 다이어그램 내 코드 참조, API 섹션, DB 스키마 동시 작업, 한 ADR=한 결정, 길이/다이어그램 가이드, 한국어 작성
- "ADR 리뷰 체크리스트" — 머지 전 최종 확인 (코드 직독 테스트 / 회색지대 점검 항목 포함)

`docs/adr/README.md`가 없으면 plugin 템플릿(`${CLAUDE_PLUGIN_ROOT}/templates/adr/README.md`)을 프로젝트로 복사한 뒤 시작한다. 프로젝트에 복사된 README가 있으면 그쪽이 우선한다.

ALPS Section 7 → ADR 변환 작업(`/feature-to-adr`)이거나 ALPS의 9개 섹션 구조·vertical-slice 의도가 기억나지 않으면 `${CLAUDE_PLUGIN_ROOT}/templates/alps/about-alps.md`를 추가로 읽는다. ALPS PRD 가 없는 일반 ADR 작성에서는 이 단계를 건너뛴다.

### 2. 새 ADR 생성

1. 카테고리 결정 — README "디렉토리 구조" / "흔한 카테고리 예시"에 따라 피쳐(vertical slice) 단위로. 안티패턴 카테고리(`frontend/`, `backend/`, `api/`, `db/` 등) 회피, cross-cutting은 두 개 이상의 피쳐가 의존할 때만
2. `docs/adr/<category>/`의 기존 ADR 번호를 확인하여 다음 번호 부여 (split으로 빠진 번호는 결번으로 두고 renumber 금지). 파일명 `XXXX-kebab-title.md`
3. README 템플릿 구조로 초안 작성: Status / Context / Decision / Consequences / Related — Decision은 UI → API → 데이터 single slice로 묘사 (시퀀스 다이어그램 권장)
4. **새 ADR은 기본 `Proposed`로 시작**. 같은 작업에서 작성·구현·검증이 모두 끝난다면 처음부터 `Accepted (YYYY-MM-DD)`로 시작해도 된다
5. `docs/adr/README.md`의 "카테고리별 ADR 목록"에 한 줄 요약 추가. 새 카테고리면 디렉토리 구조에도 추가
6. `docs/adr/.mapping.json`의 해당 카테고리 entry 갱신 (codePaths도 피쳐 단위로 묶여 있는지 확인)
7. **사용자 승인 전까지 저장하지 않는다**

### 3. 기존 ADR 수정

1. 수정 대상 ADR을 읽는다
2. 변경 사항을 적용하면서 README의 "작성 규칙"을 함께 적용. 기존에 규칙을 위반하는 내용이 있으면 점진적으로 정리한다
3. `Updated:` 날짜를 오늘로 갱신
4. 본문 변경이 있다면 README 카테고리 목록의 한 줄 요약도 갱신

### 4. codePaths 추천 절차 (공통)

`/adr-new`, `/feature-to-adr` 등이 `docs/adr/.mapping.json` 의 `codePaths` 를 채울 때 공통으로 쓰는 절차다 — PreToolUse hook 이 신뢰하는 값이라 정확해야 한다. 비어 있는 채로 저장하지 말고 **추천 후 확인** 으로 진행한다.

추천 절차:

1. 사용자가 답한 영역 + ADR Decision 의 키워드(페이지·컴포넌트·서비스명) 추출
2. `Glob`/`Bash ls` 로 프로젝트 디렉토리 구조를 한 번 본다 — `src/features/`, `packages/`, `apps/`, `services/` 등 source 진입점 확인
3. **codePaths 도 vertical slice 로 묶는다** — 한 피쳐의 UI/API/Data 코드를 모두 같은 카테고리의 codePaths에 넣는다. 다른 카테고리에 흩어 두지 않는다
4. 글롭 후보 2-4개를 만든다. 프로젝트 구조에 따라 두 패턴:
   - **Feature-sliced 단일 트리** (권장) — `src/features/<feature>/**` 가 UI/API/Data 를 모두 포함
   - **레이어 단위 모노레포** — 같은 피쳐의 코드가 여러 레이어 폴더에 흩어졌으면 한 카테고리의 codePaths에 모두 합쳐 적는다 (예 `orders` 카테고리: `["packages/web/src/orders/**", "services/orders/**", "packages/db/orders/**"]`). `frontend-orders/`, `backend-orders/` 처럼 쪼개지 않는다
5. 후보를 보여주고 "이대로 사용/추가/제거하시겠어요?" 한 번 확인
6. 사용자가 자연어로 답하면 글롭으로 변환해 저장

추측 금지:

- 코드 베이스를 한 번도 보지 않은 채 글롭을 만들지 않는다
- 사용자가 "잘 모르겠다" 면 가장 보수적인 글롭(상위 디렉토리 `**`)을 두고 이후 `/adr-sync` 에서 좁히자고 안내

### 5. Status 자동 전환 (의무)

상태는 사람이 묻고 바꾸는 값이 아니라 사이클이 자동으로 갱신하는 값이다. 각 명령이 트리거하는 전환만 짧게 정리한다 — 상태 값 의미와 괄호 표기 규칙 등 상세는 README "상태" 섹션 참조.

- **`/adr-new`, `/feature-to-adr`** — 신규 ADR을 항상 `Proposed`로 저장. 사용자에게 "Accepted로 할까요?" 묻지 않는다
- **`/adr-impl`** — 구현·테스트가 끝난 ADR의 Status를 같은 사이클에 `Accepted (YYYY-MM-DD)`로 자동 전환. 사용자에게 승격 여부를 따로 확인하지 않는다
- **`/adr-sync`** — 코드와 ADR을 대조해 drift를 정정한다. ADR이 `Accepted`인데 코드에 없으면 `Proposed`로 되돌리고, `Proposed`인데 코드에 이미 존재하면 `Accepted`로 올린다

전환 시 항상 함께 갱신할 것: ADR 본문 Status 줄, `docs/adr/README.md` 카테고리 목록의 라벨, (필요 시) Decision/Consequences/엣지케이스.

### 6. 한국어 작성 / 최종 확인

- 본문은 한국어 작성, 기술 용어·코드 식별자·영문 고유명사는 원어 그대로 — README "한국어 작성" 참조
- 머지 전 README의 **"ADR 리뷰 체크리스트"** 항목을 모두 점검한다. 본 스킬에서 별도 체크리스트를 두지 않는다
