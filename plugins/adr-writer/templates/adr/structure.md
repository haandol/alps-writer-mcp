# ADR 디렉토리 구조와 매핑

`docs/adr/` 의 폴더 레이아웃, 카테고리 분할 규칙, ALPS feature ↔ ADR ↔ 코드 경로의 매핑 정책을 모은다. 작성 규칙은 [`authoring-rules.md`](./authoring-rules.md), 개념과 의존성 모델은 [`README.md`](./README.md) 참조.

## 디렉토리 구조

기본은 **피쳐(vertical slice) 단위**의 서브디렉토리. 워크숍·소규모 프로젝트는 플랫 구조도 허용한다.

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
- 새 카테고리를 추가하면 README의 디렉토리 구조와 카테고리별 ADR 목록을 함께 갱신한다.

### 카테고리가 비대해질 때 — sub-vertical-slice 분할

ADR이 누적되면 한 카테고리에 결정이 쌓여 번호만 보고는 무엇을 다루는 ADR인지 찾기 어려워진다. 카테고리는 vertical slice 단위라는 원칙을 유지하면서, **한 단계 더 작은 vertical slice (sub-feature) 로 나눠 한 단계의 sub-folder** 만 둘 수 있게 한다.

**분할 임계값**: 한 카테고리(또는 sub-folder) 안의 ADR이 **15개 이상**이면 분할을 제안한다. 그 미만은 평면 구조 유지가 기본 — 너무 이른 분할은 카테고리 자체를 작게 쪼개 vertical slice 추적을 약화시킨다.

**분할 규칙**:

- **최대 1단계 깊이**: `docs/adr/<feature>/<sub-feature>/NNNN-...md` 까지만. 2단계 이상은 만들지 않는다 (`auth/login/social/...` 금지).
- **sub-feature 도 vertical slice**: ALPS Section 7 의 sub-feature 와 1:1 로 매핑되는 사용자가 인지하는 단위로 자른다 — `auth/login/`, `auth/signup/`, `auth/password-reset/`, `orders/checkout/`, `orders/refund/` 처럼 한 사용자 동작에 해당하는 묶음. UI/API/Data 결정이 sub-folder 안에서 모두 끝나야 한다.
- **금지되는 sub-folder**: `auth/api/`, `auth/db/`, `auth/components/`, `auth/services/` 같은 **기술 레이어 분할** — 카테고리 분할 규칙(안티패턴)과 동일하게 vertical slice 가 깨진다. 분할 후에도 한 sub-folder 안에 UI → API → Data 가 모여야 한다.
- **번호 정책**: sub-folder 안에서 `NNNN` 을 새로 시작한다. 분할 시 기존 ADR 의 번호를 재배치하지 않는다 — 결번을 유지하고 git 이력으로 추적. 분할 시점은 Roll-up 이 아니므로 본문은 그대로 옮기기만 한다.
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
- ADR이 많아도 모두 같은 sub-feature 라면 — 그건 `/adr-rollup` 이 다룰 evolution chain 일 가능성이 높다. 먼저 rollup 으로 압축한 뒤 그래도 비대하면 분할.
- vertical slice 경계가 모호하면 분할하지 않는다 — 잘못 자르면 한 결정이 두 폴더에 흩어진다.

**점검·제안 절차** (`/adr-new`, `/adr-sync` 가 카테고리에 손댈 때 공통 호출):

1. 작업 대상 카테고리(또는 sub-folder)의 `*.md` 개수를 센다 — README 인덱스가 아니라 실제 파일 기준.
2. **15개 미만이면 그대로 진행**. 분할은 제안조차 하지 않는다.
3. **15개 이상이면 한 번 제안한다**. 사용자가 거절하면 같은 세션에서 다시 묻지 않고 계속 진행한다 — 분할은 강제가 아니다.
4. 제안할 때 sub-feature 후보를 함께 보여준다. 기존 ADR 제목·Decision 한 줄 요약을 훑어 사용자가 인지하는 단위(로그인, 가입, 비밀번호 재설정 같은 한 동작)로 묶고, ALPS Section 7 sub-feature 가 있으면 그대로 매핑한다. 카테고리 전체에 걸친 cross-cutting ADR 은 부모 폴더 직속에 남기고, `auth/api/`·`auth/db/` 같은 기술 레이어 분할은 후보로 만들지 않는다.
5. 분할이 합의되면 위 분할 규칙(1단계 깊이, README 인덱스, `.mapping.json` 키)에 따라 폴더 이동을 수행한다.
6. 같은 logical decision 의 evolution chain 이 보이면 분할 전에 `/adr-rollup` 부터 권한다 — 분할로 흩으면 chain 추적이 어려워진다.

> `/adr-rollup` 은 evolution chain 압축에만 집중하고 분할 제안은 하지 않는다 — 두 작업이 섞이면 사용자가 한 사이클에서 너무 많은 결정을 떠맡게 된다.

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

## ALPS ↔ ADR 매핑

`docs/adr/.mapping.json`이 ADR과 영향 받는 코드 경로(그리고 선택적으로 ALPS feature)의 관계를 저장한다. `adr-writer` plugin의 PreToolUse hook이 이 파일을 읽어, 코드 수정이 매핑된 ADR보다 새로우면 ADR 동기화를 환기한다.

```json
{
  "$schema": "https://raw.githubusercontent.com/haandol/alps-writer-plugins/main/plugins/adr-writer/templates/adr/mapping.schema.json",
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

### codePaths 추천 절차

`/adr-new`, `/feature-to-adr` 등이 `.mapping.json` 의 `codePaths` 를 채울 때 공통으로 쓰는 절차다 — PreToolUse hook 이 신뢰하는 값이라 정확해야 한다. 비어 있는 채로 저장하지 말고 **추천 후 확인** 으로 진행한다.

1. 사용자가 답한 영역 + ADR Decision 의 키워드(페이지·컴포넌트·서비스명) 추출.
2. `Glob`/`Bash ls` 로 프로젝트 디렉토리 구조를 한 번 본다 — `src/features/`, `packages/`, `apps/`, `services/` 등 source 진입점 확인.
3. **codePaths 도 vertical slice 로 묶는다** — 한 피쳐의 UI/API/Data 코드를 모두 같은 카테고리의 codePaths에 넣는다. 다른 카테고리에 흩어 두지 않는다.
4. 글롭 후보 2-4개를 만든다. 프로젝트 구조에 따라 두 패턴:
   - **Feature-sliced 단일 트리** (권장) — `src/features/<feature>/**` 가 UI/API/Data 를 모두 포함.
   - **레이어 단위 모노레포** — 같은 피쳐의 코드가 여러 레이어 폴더에 흩어졌으면 한 카테고리의 codePaths에 모두 합쳐 적는다 (예 `orders` 카테고리: `["packages/web/src/orders/**", "services/orders/**", "packages/db/orders/**"]`). `frontend-orders/`, `backend-orders/` 처럼 쪼개지 않는다.
5. 후보를 보여주고 "이대로 사용/추가/제거하시겠어요?" 한 번 확인.
6. 사용자가 자연어로 답하면 글롭으로 변환해 저장.

**추측 금지**: 코드 베이스를 한 번도 보지 않은 채 글롭을 만들지 않는다. 사용자가 "잘 모르겠다" 면 가장 보수적인 글롭(상위 디렉토리 `**`)을 두고 이후 `/adr-sync` 에서 좁히자고 안내한다.
