---
description: One-command entry into the ADR-first feedback loop. Figures out where you are (no ADR / stale ADR / ready to implement / ready to sync) and runs the right next step.
argument-hint: "[feature-id-or-category-or-natural-language?]"
---

ADR-first 사이클(ADR 확인 → ADR 작성/수정 → 코드 → 테스트 → /adr-sync)의 단일 진입점입니다. 인자가 있으면 그 feature/카테고리에 한정, 없으면 직전 사용자 요청을 분석해서 대상을 결정합니다.

## 절차

### 1. 상태 파악

대상 카테고리(또는 신규 후보)를 식별한다.

- `docs/adr/.mapping.json` 로드.
- 인자가 카테고리 id면 그 entry 사용. Feature ID 형태(`f1`, `F-AUTH-01`)면 alpsFeatureId로 매칭.
- 인자가 자연어거나 비어 있으면 **직전 사용자 요청과 대화 컨텍스트**에서 어떤 feature를 의미하는지 판단한다. 매칭이 모호하면 사용자에게 1줄 질문으로 확인한다 ("F1(이메일 가입) 말씀이신가요?").
- mapping이 비어 있거나 일치가 없으면 **"신규 카테고리"** 분기로.

### 2. 분기 결정

| 상태                                           | 다음 단계                                                                                                                          |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 신규 카테고리 (매칭 없음)                      | `/feature-to-adr <id>` 실행 → 사용자 승인 → 3단계로                                                                                |
| 매핑은 있는데 ADR 파일 누락                    | `/feature-to-adr <id>` 실행 → 3단계                                                                                                |
| ADR 존재, 코드 변경 의도가 ADR Decision과 다름 | ADR을 먼저 편집(또는 `/adr-sync <id>` 부분 사용) → `adr-reviewer` subagent 검토 → 사용자에게 변경된 Decision 보여주고 승인 → 3단계 |
| ADR 존재, 변경이 Decision 범위 안              | 바로 3단계                                                                                                                         |
| 코드 이미 변경됨, ADR 미수정                   | `/adr-sync <id>` 실행 → 4단계                                                                                                      |

### 3. 구현 (`/adr-impl <id>` 위임)

- ADR Decision을 읽고 vertical slice 단위로 작은 변경.
- PreToolUse hook이 stale ADR을 발견하면 즉시 멈추고 2단계로 돌아간다.
- 한 사이클에 여러 ADR을 건드리지 않는다 — 영향 범위가 넘치면 별도 사이클로 쪼갠다.

### 4. 테스트 / 검증

- `package.json`/`AGENTS.md`에서 정의된 테스트 명령을 실행한다.
- UI 변경이면 사용자에게 dev 서버에서 확인을 요청한다 (워크숍 컨벤션상 에이전트가 dev 서버를 띄우지 않는다).
- 실패하면 ADR Decision이 잘못된 것인지, 구현 버그인지 분류한다. ADR 문제면 2단계, 구현 문제면 3단계로 돌아간다.

### 5. 동기화 / 학습 (`/adr-sync <id>` 위임)

- 이번 사이클에서 배운 점을 ADR에 반영한다 — Decision 보강, 새 대안 검토, Risk 추가, 한 줄 요약 갱신.
- `lastSyncedAt`을 ISO 타임스탬프로 갱신.
- Status가 `Proposed`였다면 사용자 합의 후 `Accepted`로 전환.

### 6. 다음 사이클 권장

- 이번 변경이 다른 카테고리에 영향을 줬으면 그쪽 ADR도 점검할지 사용자에게 묻는다.
- 같은 logical decision에 대한 ADR이 여러 개로 분산되었음을 발견하면 (예: 0002가 0001을 supersede·extend, 같은 키 디자인을 다른 ADR이 다시 결정) `/adr-rollup`을 권유한다. 단순히 카테고리 ADR 개수가 많다는 이유로는 권유하지 않는다.

## 빠른 반복을 위한 원칙

- **사이클은 작게**: 한 사이클 = 한 Feature 의 한 Decision 변화. 여러 결정을 한 번에 처리하지 않는다.
- **ADR-first 위반 시 멈춤**: PreToolUse hook 경고가 떴는데 그대로 진행하지 않는다 — 2단계로 돌아간다.
- **테스트 실패 ≠ ADR 정답**: 테스트가 실패하면 먼저 ADR Decision이 현실에 맞는지 다시 본다.
- **opt-out 존중**: 사용자가 "ADR 건너뛰자"고 명시하면 따른다. 단 deferred 항목으로 기억해 두고 다음 사이클에서 회수 제안.
