# Architecture Decision Records (ADR)

이 디렉토리는 프로젝트의 주요 아키텍처 결정을 문서화합니다. ADR 은 코드 구현의 근거이며, 새 결정은 `/adr-new <category>` 로 직접 작성합니다. ALPS (PRD) 가 함께 있는 프로젝트라면 Section 7 의 각 feature 를 `/feature-to-adr` helper 로 한 번에 ADR 로 변환할 수도 있습니다.

## ADR이란?

Architecture Decision Record (ADR)는 소프트웨어 개발 과정에서 내린 중요한 아키텍처 결정을 기록하는 문서입니다. 각 ADR은 다음을 포함합니다:

- **Context**: 결정이 필요했던 배경과 문제
- **Decision**: 내린 결정과 그 이유
- **Consequences**: 결정의 긍정적/부정적 영향

## ADR이 다루는 영역 — 비즈니스와 코드 사이의 회색지대

ADR 은 **비즈니스 요구사항(WHY)** 과 **코드(WHAT/HOW)** 사이에 끼어 있는 모호한 영역을 구체화하는 문서다. 이 회색지대만 ADR 에 적는다.

```mermaid
flowchart LR
    A["비즈니스 요구사항<br/>(ALPS / 사용자 스토리)"] --> B["회색지대<br/>(ADR이 채우는 영역)"]
    B --> C["코드<br/>(구현 자체가 사실)"]
```

**회색지대에 해당하는 것들** — 코드만 읽어서는 동기와 근거가 안 보이는 결정.

- 같은 요구사항을 풀 수 있는 **여러 접근 중 왜 이것을 골랐는가** (대안 비교와 채택 근거)
- 코드 곳곳에 흩어져 있어 한 곳에서 보지 않으면 안 보이는 **횡단 결정** (예: 토큰 회전 정책, 키 디자인 패턴, 상태 머신 전체)
- 비즈니스 규칙이 시스템 동작으로 **번역되는 방식** (예: "가입 후 7일 grace period" → 어떤 트리거·테이블·상태값으로 표현되는가)
- 도메인 모델 사이의 **개념 수준 관계** (필드 정의가 아니라 "Flashcard 와 Vocabulary 는 phrase hash 로 연결된다" 수준)
- 외부 시스템·서비스에 의존할 때의 **fallback / degradation 정책**
- 한 결정이 가진 **의도된 트레이드오프와 리스크**

**회색지대가 아닌 것들** — 에이전트/리뷰어가 codePaths 의 코드를 직접 읽으면 알 수 있는 것은 ADR 의 일이 아니다.

- 함수/클래스/메서드의 책임 분담, 호출 그래프, 모듈 의존 관계
- 함수 시그니처·파라미터·반환 타입
- 필드별 타입 정의·검증 규칙·디폴트 값
- 라이브러리 사용 패턴, 디자인 패턴 적용 (Repository, Strategy 등)
- 디렉토리/파일 레이아웃, 네이밍 규칙
- 에러 메시지 문자열, 로그 포맷, UI 라벨 텍스트
- 설정 값·튜닝 상수·환경 변수 이름
- 알고리즘의 단계별 의사코드

이런 항목은 코드와 docstring·README·AGENTS.md 가 source of truth 이고, ADR 에 옮겨 적으면 코드 변경 때마다 ADR 도 함께 갱신해야 하는 부담만 늘고 drift 가 쌓인다.

### 코드 직독 테스트 (1차 필터)

ADR 에 한 줄을 적기 전에 다음을 묻는다.

> "에이전트가 이 카테고리의 codePaths 를 그대로 읽으면, 이 사실을 발견할 수 있는가?"
>
> **YES** → ADR 에 넣지 않는다 (코드가 source of truth).
> **NO** → 회색지대 후보다. 그 다음으로 [리트머스 테스트](#리트머스-테스트)를 통과해야 ADR 에 들어간다.

두 테스트를 모두 통과한 내용만 ADR 본문에 남긴다.

## ADR이 다루는 결정의 종류

다음 중 하나에 해당하면 ADR을 작성한다.

| 종류             | 예                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------- |
| **도메인 결정**  | 인증 방식, 결제 모델, 권한 체계, 핵심 도메인 엔티티의 관계와 상태 머신                 |
| **인프라 결정**  | 배포 토폴로지, 캐시 전략, 모니터링·알람 구조, CDN/이미지 처리 정책                     |
| **데이터 결정**  | DB 키 디자인(PK/SK/GSI), 단일 테이블 vs 다중 테이블, 마이그레이션 전략                 |
| **외부 연동**    | LLM/결제/메일/푸시 등 외부 서비스 선정과 graceful degradation 정책                     |
| **보안·운영**    | 비밀 관리 전략, 토큰 회전, 감사 로그 범위, 백업/복구 RPO·RTO                           |
| **UX 아키텍처**  | 라우팅 구조, 상태 관리 라이브러리 선택, 디자인 시스템 채택 — 토큰 자체는 디자인 문서로 |
| **마이그레이션** | API 버전 전환 전략, 백필 절차의 안전성, downtime 허용 범위                             |

카테고리 폴더(`docs/adr/<category>/`)는 **피쳐(vertical slice) 단위**로 묶는다. ALPS Section 7 의 feature 와 그대로 1:1 매핑되는 것이 기본이다 — `marketplace/`, `auth/`, `orders/`, `chat/` 처럼 사용자가 인지하는 기능 단위로 만든다.

**기술 레이어로 카테고리를 만들지 않는다** — `frontend/`, `backend/`, `api/`, `db/`, `ui/` 같은 폴더는 ADR 카테고리로 쓰지 않는다. ALPS 가 각 feature 를 UI → API → 데이터의 vertical slice 로 정의하듯이, ADR 카테고리도 같은 슬라이스를 따라야 한 결정이 한 카테고리 안에서 끝까지 추적된다.

`infra/`, `data/`, `integration/`, `security/` 같은 **cross-cutting 카테고리**는 진짜로 여러 피쳐가 동시에 의존하는 결정에만 사용한다 (예: 공통 배포 토폴로지, 공유 단일 테이블 디자인). 한 피쳐만의 DB/인프라 결정은 그 피쳐 카테고리 안에 둔다.

## ADR이 아닌 것 (anti-patterns)

다음은 ADR로 만들지 않는다. 만들면 ADR 신뢰도가 떨어지고 검토 부담만 커진다.

- **버그 수정 결정** — "이 함수의 null 체크를 추가했다"는 ADR 사유가 아니다. 코드와 커밋 메시지로 충분
- **스타일/포매팅 변경** — Prettier·ESLint 규칙 변경은 PR 설명·CONTRIBUTING.md 영역
- **의존성 패치 업그레이드** — `lodash 4.17.20 → 4.17.21`. 메이저 업그레이드(`React 17 → 18`)는 ADR 후보
- **단순 리팩토링** — 함수 분리, 변수 이름 변경. 인터페이스가 바뀌고 호출자 영향이 크면 ADR 후보
- **임시 실험·POC** — "다음 주에 결정" 단계는 결정이 확정된 뒤 ADR로 적는다
- **개인 작업 가이드** — "이 모듈은 항상 internal/ 하위에 둔다" 같은 컨벤션은 AGENTS.md/README

판단이 애매하면 [리트머스 테스트](#리트머스-테스트)를 적용한다.

## ADR vs ALPS vs 디자인 문서

세 문서는 같은 결정을 **다른 추상화 레벨에서** 다룬다. 같은 정보를 중복으로 적지 않는다.

| 문서                      | 답하는 질문              | 예                                                           |
| ------------------------- | ------------------------ | ------------------------------------------------------------ |
| **ALPS PRD**              | WHAT / WHY (사용자 관점) | "이메일 가입 feature를 추가한다. 신규 가입 전환율 +10% 목표" |
| **ADR**                   | HOW (아키텍처 관점)      | "JWT는 단기 access + 7일 refresh로 회전한다"                 |
| **디자인 문서/토큰**      | HOW (시각·인터랙션 관점) | "primary 컬러, 입력 필드 높이 48px, 에러 토스트 패턴"        |
| **코드/AGENTS.md/README** | HOW (상세 구현)          | "파일 구조, 함수 시그니처, 셋업 명령어"                      |

규칙:

- ALPS의 user story·acceptance criteria를 ADR에 복사하지 않는다 — Related 링크만 남긴다.
- 디자인 토큰 값(`#0070F3`, `padding: 16px`)은 ADR이 아니라 디자인 문서로 간다.
- 함수 시그니처·파일 경로는 ADR이 아니라 코드와 docstring으로 간다.

## 디렉토리 구조

기본은 **피쳐(vertical slice) 단위**의 서브디렉토리. 워크숍·소규모 프로젝트는 플랫 구조도 허용합니다.

```
docs/adr/
├── README.md         # 인덱스 + 작성 규칙 (source of truth)
├── .mapping.json     # ALPS feature ↔ ADR ↔ code paths 매핑 (alps-writer plugin hook이 참조)
├── marketplace/      # 피쳐 카테고리 (vertical slice — UI/API/Data 모두 포함)
│   └── NNNN-kebab-title.md
├── auth/             # 피쳐 카테고리
│   └── NNNN-kebab-title.md
├── orders/           # 피쳐 카테고리
│   └── NNNN-kebab-title.md
└── infra/            # cross-cutting 카테고리 (여러 피쳐가 공유하는 결정만)
    └── NNNN-kebab-title.md
```

규칙:

- 카테고리는 **사용자가 인지하는 피쳐 단위**로 만든다 (`marketplace/`, `auth/`, `orders/`, `chat/`, `search/`, `feed/`).
- **금지**: `frontend/`, `backend/`, `api/`, `ui/`, `db/`, `controllers/`, `services/` 같은 기술 레이어 카테고리. 한 피쳐의 결정이 레이어별로 흩어지면 vertical slice 추적이 깨진다.
- 한 피쳐 안에서 UI / API / 데이터 결정이 모두 같은 카테고리에 모인다 — 다이어그램 하나로 user action → API → store 흐름이 끝까지 보여야 한다.
- cross-cutting 카테고리(`infra/`, `data/`, `integration/`, `security/`)는 두 개 이상의 피쳐가 명시적으로 의존할 때만 만든다.
- 파일명: `NNNN-kebab-case-title.md`. 번호는 카테고리 내에서 순차 증가.
- 새 카테고리를 추가하면 이 README의 디렉토리 구조와 카테고리별 ADR 목록을 함께 갱신한다.

새 ADR을 추가할 때는 이 README의 인덱스도 함께 갱신하세요.

### 카테고리가 비대해질 때 — sub-vertical-slice 분할

ADR이 누적되면 한 카테고리에 결정이 쌓여 번호만 보고는 무엇을 다루는 ADR인지 찾기 어려워진다. 카테고리는 vertical slice 단위라는 원칙을 유지하면서, **한 단계 더 작은 vertical slice (sub-feature) 로 나눠 한 단계의 sub-folder** 만 둘 수 있게 한다.

**분할 임계값**: 한 카테고리(또는 sub-folder) 안의 ADR이 **15개 이상**이면 분할을 제안한다. 그 미만은 평면 구조 유지가 기본 — 너무 이른 분할은 카테고리 자체를 작게 쪼개 vertical slice 추적을 약화시킨다.

**분할 규칙**:

- **최대 1단계 깊이**: `docs/adr/<feature>/<sub-feature>/NNNN-...md` 까지만. 2단계 이상은 만들지 않는다 (`auth/login/social/...` 금지).
- **sub-feature 도 vertical slice**: ALPS Section 7 의 sub-feature 와 1:1 로 매핑되는 사용자가 인지하는 단위로 자른다 — `auth/login/`, `auth/signup/`, `auth/password-reset/`, `orders/checkout/`, `orders/refund/` 처럼 한 사용자 동작에 해당하는 묶음. UI/API/Data 결정이 sub-folder 안에서 모두 끝나야 한다.
- **금지되는 sub-folder**: `auth/api/`, `auth/db/`, `auth/components/`, `auth/services/` 같은 **기술 레이어 분할** — 카테고리 분할 규칙(안티패턴)과 동일하게 vertical slice 가 깨진다. 분할 후에도 한 sub-folder 안에 UI → API → Data 가 모여야 한다.
- **번호 정책**: sub-folder 안에서 `NNNN` 을 새로 시작한다. 분할 시 기존 ADR 의 번호를 재배치하지 않는다 — 결번을 유지하고 git 이력으로 추적. 분할 시점은 [Roll-up](#디렉토리-구조)이 아니므로 본문은 그대로 옮기기만 한다.
- **분할 vs 형제 카테고리 (`auth-login/`)**: vertical slice 가 진짜로 독립이고 cross-cutting 결정도 거의 공유하지 않으면 형제 카테고리(`auth-login/`, `auth-sso/`)가 더 깔끔하다. 한 도메인 안에서 공통 결정(예: `auth/0001-token-rotation.md`)을 부모 폴더에 남겨야 하는 경우에만 sub-folder 를 쓴다.
- **README 인덱스**: sub-folder 가 생기면 README 의 카테고리 목록을 `auth/login/`, `auth/signup/` 처럼 sub-folder 별로 한 줄씩 풀어 적는다. 부모 카테고리 직속에 남은 cross-cutting ADR(예: `auth/0001-token-rotation.md`)은 부모 라인에 그대로 둔다.
- **`.mapping.json` 정책**: sub-folder 도 별도 카테고리 entry 로 등록한다 — 키는 `auth/login` 처럼 슬래시를 유지. `codePaths` 는 그 sub-feature 의 vertical slice 만 가리키게 좁힌다 (예: `src/features/auth/login/**`). hook 이 카테고리 키로 lookup 하므로 키 형식의 일관성이 중요하다.

```
docs/adr/
├── README.md
├── .mapping.json
├── auth/                        # 부모 vertical slice
│   ├── 0001-token-rotation.md   # auth 전반에 걸친 cross-cutting 결정 (부모에 그대로)
│   ├── login/                   # sub-vertical-slice
│   │   ├── 0001-password-policy.md
│   │   └── 0002-rate-limit.md
│   └── signup/
│       └── 0001-email-verification.md
└── orders/
    └── 0001-...md               # 임계값(15) 미만이면 분할하지 않는다
```

**언제 sub-folder 를 만들지 않는가**:

- ADR 개수가 15 미만 — 평면 구조 유지.
- ADR이 많아도 모두 같은 sub-feature 라면 — 그건 [`/adr-rollup`](#) 이 다룰 evolution chain 일 가능성이 높다. 먼저 rollup 으로 압축한 뒤 그래도 비대하면 분할.
- vertical slice 경계가 모호하면 분할하지 않는다 — 잘못 자르면 한 결정이 두 폴더에 흩어진다.

## 구현 레퍼런스

- ALPS PRD: `prd/<doc>.alps.xml` (Section 7이 feature spec의 source of truth)
- 매핑: `docs/adr/.mapping.json` (feature ↔ 코드 경로 ↔ ADR)

> **권장**: 이 섹션 아래에 프로젝트별 **피쳐 진입점**을 명시한다. vertical slice 구조에서는 한 피쳐의 UI/API/Data 코드가 같은 폴더 트리에 모이므로, 카테고리 → 진입점 매핑이 자연스럽게 1:1 이 된다.
>
> 예:
>
> - `auth/` ADR → `src/features/auth/` (UI 컴포넌트, 핸들러, 토큰 정책 모두 포함)
> - `marketplace/` ADR → `src/features/marketplace/`
> - `orders/` ADR → `src/features/orders/`
> - `infra/` ADR (cross-cutting) → `src/shared/infra/`, `infra/`
>
> ADR 본문에서는 폴더 단위까지만 참조하므로, 진입점 매핑이 README 에 있어야 검토자가 빠르게 코드를 찾을 수 있다. 한 피쳐의 결정이 여러 진입점에 흩어진다면 그 자체가 vertical slice 위반 신호다.

## 흔한 카테고리 예시

피쳐(vertical slice) 카테고리가 기본이고, 정말로 여러 피쳐가 공유하는 결정만 cross-cutting 카테고리에 둔다.

### 피쳐(vertical slice) 카테고리 — 기본

각 카테고리는 UI → API → 데이터까지의 한 슬라이스를 모두 다룬다.

| 카테고리       | 다루는 결정 (한 피쳐 안의 UI/API/Data 결정 모두 포함)              |
| -------------- | ------------------------------------------------------------------ |
| `auth/`        | 가입/로그인/세션/SSO/권한 — 폼 UX, 토큰 정책, users 테이블 키 패턴 |
| `marketplace/` | 상품 리스팅/검색/필터 — 리스트 UI, 검색 API, 인덱스 구조           |
| `orders/`      | 주문 생성/상태 머신/취소 — 체크아웃 UI, 주문 API, 주문 테이블      |
| `billing/`     | 요금제/결제/환불/크레딧 — 결제 UI, 결제 게이트웨이, 트랜잭션 기록  |
| `chat/`        | 메시지 송수신/스레드/알림 — 채팅 UI, WebSocket 연결, 메시지 저장   |
| `search/`      | 검색 입력/추천/결과 정렬 — 검색 박스, 검색 API, 인덱싱 정책        |
| `feed/`        | 피드 노출/페이지네이션/랭킹 — 피드 UI, 피드 API, 캐시 전략         |

### cross-cutting 카테고리 — 정말 공유하는 결정만

두 개 이상의 피쳐가 같은 결정에 의존할 때만 만든다. 한 피쳐만의 DB/인프라 결정은 해당 피쳐 카테고리에 둔다.

| 카테고리       | 다루는 결정                                                                  |
| -------------- | ---------------------------------------------------------------------------- |
| `data/`        | 여러 피쳐가 공유하는 단일 테이블 디자인, 글로벌 키 컨벤션, 마이그레이션 전략 |
| `infra/`       | 배포 토폴로지, 모니터링/알람, CDN, 비용 최적화 — 전 시스템에 영향            |
| `integration/` | LLM·결제·메일·푸시 등 여러 피쳐가 함께 의존하는 외부 서비스 연동 정책        |
| `security/`    | 비밀 관리, 토큰 회전 정책, 감사 로그 — 시스템 전체 정책                      |
| `platform/`    | 라우팅 컨벤션, 디자인 시스템, 공통 상태 관리 — 모든 피쳐 UI 가 따르는 규약   |

### 안티패턴 카테고리

이런 카테고리는 만들지 않는다 — 한 피쳐의 결정이 흩어져 vertical slice 가 깨진다.

- `frontend/`, `backend/`, `mobile/`, `web/` — 기술 레이어/플랫폼 단위
- `api/`, `ui/`, `db/`, `cache/` — 시스템 레이어 단위
- `controllers/`, `services/`, `repositories/` — 코드 구조 단위
- `bugfix/`, `refactor/` — 작업 종류 단위 (애초에 ADR 대상 아님)

## 상태

```
Proposed → Accepted → Deprecated
                   → Superseded by [ADR XXXX]
```

| 상태       | 의미                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------- |
| Proposed   | ADR이 시스템에 제안된 상태. 결정 자체는 합의되었더라도 **아직 코드 구현이 끝나지 않음**         |
| Accepted   | **코드 구현이 완료된 상태**. ADR이 묘사하는 동작이 실제로 코드베이스에 존재하고 테스트를 통과함 |
| Deprecated | 더 이상 유효하지 않음. 대체 ADR 없이 폐기                                                       |
| Superseded | 새로운 ADR로 대체됨. `Superseded by [ADR XXXX](link)` 형태로 후속 ADR을 명시                    |

### 자동 전환 규칙

상태는 **사람이 손으로 묻고 바꾸는 값이 아니라 사이클이 자동으로 갱신하는 값**이다.

- `/feature-to-adr`로 새 ADR이 만들어지면 항상 `Proposed`로 저장된다.
- `/adr-impl`이 ADR을 구현하고 테스트가 통과하면 그 명령이 ADR Status를 `Accepted`로 자동 갱신한다 — 사용자에게 승격 여부를 따로 묻지 않는다.
- `/adr-sync`는 코드와 ADR을 대조해 Status drift를 잡는다: ADR이 `Accepted`인데 묘사한 동작이 코드에 없으면 `Proposed`로 되돌리고, ADR이 `Proposed`인데 코드에 이미 존재하면 `Accepted`로 올린다.
- 상태 변경 시 날짜를 함께 기록한다: `Accepted (YYYY-MM-DD)`.
- `Implemented`, `Done`, `Completed` 같은 비공식 상태는 사용하지 않는다 — 구현 완료는 `Accepted`로 표현한다. 진행 단계 부연이 필요하면 괄호로: `Accepted (Phase 1 완료)`.

## ADR 템플릿

```markdown
# ADR XXXX: 제목

Date: YYYY-MM-DD

## Status

Proposed | Accepted | Deprecated | Superseded by [ADR XXXX](link)

## Context

결정이 필요한 배경과 문제. ALPS feature ID가 있으면 첫 줄에 명시.

## Decision

내린 결정과 그 이유.

### 시퀀스 다이어그램

비동기 처리·서비스 간 연동·이벤트 흐름이 포함된 결정이라면 Mermaid 다이어그램을 추가한다.
상태 전이가 핵심이면 stateDiagram-v2, 분기 흐름이면 flowchart를 사용한다.

\`\`\`mermaid
sequenceDiagram
participant A as 서비스 A
participant B as 서비스 B
A->>B: 요청
B-->>A: 응답
\`\`\`

### 대안 검토

채택하지 않은 접근과 그 이유.

## Consequences

### Positive

긍정적 영향.

### Negative

부정적 영향.

### Risks

잠재적 위험.

## Implementation Notes

아키텍처 수준의 구현 고려사항만. 코드 스니펫·파일 경로·필드별 스키마·구현 상수는 포함하지 않는다.
DB 스키마는 `docs/tables/` 또는 동등 문서 참조.

## Related

- ALPS feature: `prd/<doc>.alps.xml` Section 7 #<feature-id>
- 관련 ADR: [...]
- 스키마/테이블 문서: [...] (DB 변경이 있는 경우)
```

## 작성 규칙

ADR은 아키텍처 결정(Context, Decision, Consequences)을 기록하는 문서다. 코드를 변경할 때마다 ADR을 함께 수정해야 하는 부담을 줄이기 위해, **구현 세부사항은 ADR에 포함하지 않는다.**

### 두 단계 필터

ADR 본문의 한 줄 한 줄에 두 질문을 차례로 적용한다. 둘 다 통과해야 남긴다.

1. **코드 직독 테스트**: "에이전트가 codePaths 를 그대로 읽으면 이 사실을 발견할 수 있는가?" — YES 면 ADR 에 넣지 않는다 (코드가 source of truth).
2. **리트머스 테스트**: "이 값/세부사항이 코드에서 바뀌면, 아키텍처 결정 자체가 바뀌는가?" — NO 면 ADR 에 넣지 않는다.

리트머스 테스트만 단독으로 적용하면 "코드를 읽어도 알 수 있는 결정 사실"까지 ADR 에 들어와 회색지대가 흐려진다. 코드 직독 테스트로 먼저 거른 뒤 리트머스 테스트로 다시 거른다.

### 코드 참조 깊이 — 폴더 단위까지만

ADR 안에서 코드를 가리킬 때는 **폴더(디렉토리) 단위**까지만 허용한다. 파일 단위 이하로 내려가지 않는다.

- 허용: `packages/api/handlers/`, `apps/web/src/components/`, `services/<domain>/`
- 금지: `apps/web/src/components/Login.tsx`, `services/auth/auth_service.go`
- 금지: 파일명·줄 번호 인용 (예: `prompt_template.md:42`)

본문, 표, Mermaid 다이어그램 모두에 동일하게 적용된다. 함수명·클래스명·파일명을 본문에서 직접 인용해야 한다면 그 결정은 ADR이 아니라 docstring·README·인라인 주석에 적합한지 다시 판단한다.

### 다이어그램 내 코드 참조

Mermaid 다이어그램 안에서도 함수명·메서드 호출 대신 동작을 서술한다.

- Bad: `stats.IncrementSourceCount("chat")`
- Good: `sourceCounts.<source> 증가`

이 규칙은 sequenceDiagram, stateDiagram, flowchart 모두에 동일하게 적용된다.

### ADR에 포함하지 않는 것

코드 직독으로 알 수 있는 것 + 회색지대를 벗어난 세부사항은 모두 제외한다.

| 금지 항목                       | 예                                    | 대안                                |
| ------------------------------- | ------------------------------------- | ----------------------------------- |
| 파일 경로 또는 그 이하          | `apps/web/src/Login.tsx`              | 폴더 단위까지만 (`apps/web/src/`)   |
| 코드 스니펫                     | 함수 시그니처, 인터페이스, 구조체     | 코드 자체가 source of truth         |
| 함수/클래스 책임 분담           | "AuthService 가 SessionStore 를 호출" | 코드와 docstring                    |
| 모듈/패키지 의존 그래프         | "auth → users → notifications"        | 코드의 import 문 자체               |
| 디자인 패턴 적용 사실           | "Repository 패턴 사용", "DI 컨테이너" | 코드 구조에서 자명                  |
| 엔티티 상세 필드 표             | `phraseHash \| S \| ...`              | `docs/tables/`로 위임               |
| 필드 타입·검증 규칙·디폴트 값   | `email: string, required, max 255`    | 코드의 스키마/zod/ORM 정의          |
| 구현 상수/튜닝값                | `MAX_RETRY = 3`, `TIMER = {1: 60}`    | "재시도는 제한된다" 같은 개념만     |
| 환경 변수 이름·설정 키          | `AUTH_TOKEN_TTL`, `DB_POOL_SIZE`      | 설정 문서·코드의 default 값         |
| 에러 메시지·UI 라벨·로그 문자열 | "Invalid credentials"                 | 코드의 i18n / 메시지 카탈로그       |
| 마이그레이션/운영 명령어        | `uv run python migrate_...`           | 스크립트 자체에 문서화              |
| 전체 API JSON 응답 예시         | 20줄짜리 요청/응답                    | 목적·핵심 파라미터를 1-2문장으로    |
| 알고리즘 의사코드               | "1. 토큰 검증 2. 세션 생성 3. ..."    | 함수 본문이 source of truth         |
| 디렉토리/파일 네이밍 규칙       | "핸들러는 `*-handler.ts`"             | AGENTS.md / CONTRIBUTING.md         |
| CSS 클래스·Tailwind 유틸        | `bg-primary`, `flex-col`              | 디자인 토큰 단위 (DESIGN.md 등)으로 |

### ADR에 유지하는 것

회색지대만 남긴다 — 코드 직독으로 알 수 없거나, 한 곳에 모아 보지 않으면 의도가 흐려지는 것들.

- **문제 배경과 동기** (WHY) — 왜 이 결정이 필요했는가. 비즈니스 요구가 어떤 제약·전제 위에서 이 선택을 강제했는지
- **결정 요약** — 무엇을 결정했고, 대안 대비 왜 이것을 선택했는가 (선택 근거가 핵심 — 결정 자체는 코드에 드러나지만, "왜 그쪽이 아니었는가" 는 코드에 안 남는다)
- **대안 비교표** — 검토한 대안들과 채택하지 않은 이유. 비어 있으면 회색지대가 비었다는 신호이므로 ADR 의 가치가 약하다
- **비즈니스 규칙의 시스템 번역** — "가입 후 7일 grace period" 같은 비즈니스 규칙이 어떤 트리거·상태값·이벤트로 표현되는지의 매핑 (개념 수준, 함수 호출 체인 아님)
- **엔티티 관계** (개념 수준) — "Flashcard는 Vocabulary와 별도 엔티티로 phrase hash로 연결" (필드 목록 아님)
- **DB 키 디자인** — PK/SK/GSI 패턴, sparse 인덱스 여부 — 키 구조가 바뀌면 결정이 흔들리므로 ADR에 유지 (필드별 타입 정의는 `docs/tables/`)
- **액세스 패턴** — 용도·쿼리(Table/GSI/GetItem/BatchGet)·호출 빈도 — 키 디자인의 검증 근거
- **행동 규칙과 상태 전이** — Grade 체계, 상태 머신, 도메인 invariant. 코드 여러 곳에 흩어져 있어 모아서 봐야 의미가 보이는 것
- **시스템 간 연동 방식** — "퀴즈 완료 시 SRS 리뷰를 트리거한다" (함수 호출 체인이 아니라 도메인 이벤트 수준)
- **외부 의존의 fallback / degradation 정책** — "LLM 응답 실패 시 캐시된 마지막 결과 반환, 그것도 없으면 빈 결과로 graceful 처리"
- **Mermaid 다이어그램** — 비동기 흐름, 서비스 간 연동, 이벤트 기반 처리에 적극 사용. 텍스트 설명보다 다이어그램이 명확하면 다이어그램을 우선. 다이어그램 안에서도 함수명이 아닌 도메인 동작을 표현
- **Consequences** — 긍정적·부정적 영향, 의도된 트레이드오프, 리스크
- **API 엔드포인트 표** — Method / Path / 목적 한 줄 (요청/응답 스키마는 코드와 OpenAPI 가 source of truth)

### API 섹션

API 엔드포인트 목록(Method, Path, 설명)은 아키텍처 결정의 일부이므로 유지한다. 전체 요청/응답 JSON 예시·헤더 상세·에러 응답 페이로드는 포함하지 않는다 (1-2문장 요약으로 대체).

### DB 스키마와 액세스 패턴 — 동시 작업 규칙

키 디자인(PK/SK/GSI)은 아키텍처 결정의 핵심이므로 ADR에 유지한다. ADR이 새 엔티티를 추가하거나 기존 키 패턴을 바꾸는 경우, 다음을 **하나의 변경 단위로** 처리한다:

1. ADR 본문에 키 디자인·액세스 패턴 표 작성
2. `docs/tables/{테이블}.md` 에 해당 엔티티 추가/갱신 (필드 정의·SK prefix 가능 패턴·예시 포함)
3. `docs/tables/{테이블}.md` 의 **Related ADRs** 섹션에 새 ADR 역참조 링크 추가
4. ADR의 Related 섹션에서 해당 테이블 문서 링크 추가

세 곳(ADR, 테이블 문서, 양방향 링크)이 모두 갱신돼야 한 작업이 완료된 것으로 본다. 한쪽만 업데이트하면 검토 시 불일치가 누적된다.

`docs/tables/`를 사용하지 않는 프로젝트라면 동등한 스키마 문서(예: `prisma/schema.prisma`, `db/schema.sql`, OpenAPI 스펙)와의 양방향 링크로 대체한다 — source-of-truth 문서와 ADR이 항상 함께 움직이게 하는 것이 핵심이다.

### 한 ADR = 한 결정

하나의 ADR은 하나의 logical decision만 다룬다. 여러 결정이 한 파일에 섞이면 검토·supersede·roll-up이 모두 어려워진다.

분리 신호:

- 본문이 5페이지(약 250-300줄)를 넘는다
- 서로 다른 엔티티/시스템에 대한 결정이 한 파일에 들어가 있다
- "그리고 추가로…"로 시작하는 절이 두 개 이상 있다
- Status가 부분적으로만 적용된다 (핵심 흐름은 구현돼서 Accepted여야 하지만 일부 흐름은 아직 미구현이라 Proposed로 남아 있는 상태)

이 신호 중 둘 이상이면 ADR을 분리한다 (예: `0003-payment.md` → `0003-payment-checkout.md` + `0004-payment-refund.md`).

### 같은 결정이 진화하면 새 ADR을 만든다

같은 logical decision이 시간이 지나며 바뀌면 기존 ADR을 덮어쓰지 않고 **새 ADR을 만들어 history를 남긴다** — 옛 ADR은 `Status: Superseded by [ADR XXXX](link)`로 표시한다. 한 카테고리 안에 ADR이 여럿 있는 것은 정상이며, 통합 대상이 아니다.

같은 결정의 진화 history가 너무 분산되어 현재 상태를 한눈에 보기 어려워졌을 때만 `/adr-rollup`으로 그 묶음을 통합한다 (전체 카테고리가 아니라 묶음 단위). roll-up 절차와 판정 기준은 `${CLAUDE_PLUGIN_ROOT}/skills/adr-rollup/SKILL.md` 참조.

### 길이 가이드

표준은 1-3페이지(50-150줄). Mermaid 다이어그램과 대안 비교표를 제외한 본문이 너무 짧으면(< 30줄) 결정의 동기·대안이 부족한 것이고, 너무 길면(> 300줄) 분리 신호다.

### 다이어그램 선택

| 다이어그램        | 사용 시점                                                        |
| ----------------- | ---------------------------------------------------------------- |
| `sequenceDiagram` | 비동기 흐름·서비스 간 호출·이벤트 기반 처리                      |
| `stateDiagram-v2` | 상태 전이가 결정의 핵심 (주문 상태 머신, 챌린지 라이프사이클 등) |
| `flowchart`       | 조건 분기·결정 트리·라우팅 규칙                                  |
| `erDiagram`       | 새 엔티티 관계가 핵심이고 `docs/tables/`로 위임할 수 없을 때만   |

텍스트 설명보다 다이어그램이 명확하면 다이어그램을 우선한다.

### 점진적 정리

기존 ADR 중 위 규칙에 맞지 않는 내용이 포함된 것은, 해당 ADR이 업데이트될 때 점진적으로 제거한다. 한 번에 모든 ADR을 정리할 필요는 없다.

### 한국어 작성

ADR 본문은 한국어로 작성한다. 기술 용어, 코드 식별자, 영문 고유명사는 원어 그대로 쓴다.

## 명명 규칙

- 파일명: `XXXX-kebab-case-title.md` (워크숍 등에서 PRD Feature ID를 추적하고 싶으면 `XXXX-fN-kebab-case-title.md` 형태)
- 번호는 카테고리 내에서 순차적으로 증가. split으로 빠진 번호는 결번으로 둔다 (renumber 금지)
- 제목은 명확하고 간결하게

## ALPS ↔ ADR 매핑

`docs/adr/.mapping.json`이 ALPS feature와 ADR, 영향 받는 코드 경로의 관계를 저장한다. `alps-writer` plugin의 PreToolUse hook이 이 파일을 읽어, 코드 수정이 매핑된 ADR보다 새로우면 ADR 동기화를 환기한다.

```json
{
  "$schema": "https://raw.githubusercontent.com/haandol/alps-writer-mcp/main/templates/adr/mapping.schema.json",
  "alpsDocument": "prd/example.alps.xml",
  "categories": {
    "auth": {
      "feature": "User Authentication",
      "alpsFeatureId": "F-AUTH-01",
      "codePaths": ["src/features/auth/**", "src/shared/middleware/auth*"],
      "adrs": ["docs/adr/auth/0001-jwt-rotation.md"],
      "tableDocs": ["docs/tables/users.md"]
    },
    "marketplace": {
      "feature": "Marketplace Listings",
      "alpsFeatureId": "F-MKT-01",
      "codePaths": ["src/features/marketplace/**"],
      "adrs": ["docs/adr/marketplace/0001-listing-search.md"],
      "tableDocs": ["docs/tables/listings.md"]
    }
  }
}
```

매핑 파일은 `/feature-to-adr` 명령으로 생성·갱신된다. 플랫 구조 프로젝트는 카테고리 키로 Feature ID(`f1`, `f2`)를 그대로 써도 된다.

## ADR 리뷰 체크리스트

PR 리뷰어 또는 작성자 본인이 머지 전에 확인한다.

- [ ] **Status가 유효한 값**인가 (`Proposed`/`Accepted`/`Deprecated`/`Superseded by [...]`)
- [ ] **결정 한 줄 요약**이 README의 카테고리별 목록에 갱신되었는가
- [ ] **코드 직독 테스트** — 본문의 모든 단락에 대해 "이 사실이 codePaths 의 코드를 읽으면 자명한가?" 를 물었을 때, 자명한 항목이 본문에 남아 있지 않은가 (자명한 것은 코드가 source of truth)
- [ ] **회색지대 점검** — 본문에 (a) 채택 근거 / 대안 비교, (b) 비즈니스 규칙의 시스템 번역, (c) 도메인 규칙·상태 전이, (d) 외부 의존 fallback 중 **하나 이상**이 실제로 들어 있는가 (없으면 ADR 의 가치가 약함)
- [ ] **폴더 단위 이하 코드 참조**가 본문/표/다이어그램 어디에도 남아 있지 않은가
- [ ] **금지 항목**(코드 스니펫, 구현 상수, 함수 호출 그래프, 필드 타입표, 환경 변수 이름, 의사코드, 전체 JSON, 마이그레이션 명령어)이 들어가지 않았는가
- [ ] **대안 검토** 절이 있고, 채택하지 않은 이유가 적혀 있는가
- [ ] **Mermaid 다이어그램**이 필요한 결정인데 누락되지 않았는가
- [ ] **DB 키 패턴**을 바꿨다면 `docs/tables/{name}.md`(또는 동등 문서)와 양방향 링크가 있는가
- [ ] **Related**에 ALPS feature ID와 의존 ADR 링크가 모두 있는가
- [ ] **한 ADR = 한 결정** 원칙이 지켜졌는가 (분리 신호 없음)
- [ ] **`.mapping.json`**의 해당 카테고리 entry가 새 ADR을 포함하고 `lastSyncedAt`이 갱신되었는가

## 카테고리별 ADR 목록

새 ADR을 추가하면 이 섹션에 한 줄 요약을 직접 추가한다. 자동 생성하지 않는다. 한 줄 요약은 다음 quick-mode 동기화 점검의 진입점이 되므로 본문이 바뀔 때 함께 갱신한다.

<!-- 예시:
### Auth
- [0001: JWT Rotation](./auth/0001-jwt-rotation.md) — Accepted. 구현됨. Refresh token rotation, 7일 만료, sliding session.
- [0002: SSO Integration](./auth/0002-sso-integration.md) — Proposed. 미구현. SAML 기반 사내 SSO, IdP는 추후 결정.

### Billing
- [0001: Subscription Tiers](./billing/0001-subscription-tiers.md) — Accepted. 구현됨. Free/Pro/Enterprise 3티어, 월/연 토글.
-->

## 참고

- [ADR GitHub](https://adr.github.io/) — ADR 일반 자료 모음
- [Joel Parker Henderson — ADR templates](https://github.com/joelparkerhenderson/architecture-decision-record) — 다양한 템플릿 비교
- [Michael Nygard — Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) — 원조 ADR 글
- [alps-writer plugin](https://github.com/haandol/alps-writer-mcp) — 이 plugin 자체
