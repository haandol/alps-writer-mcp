# Decision Log: alps-authoring/lite-format

This document is the **major decision-change history** of the alps-authoring/lite-format category.
Each ADR body describes only the current state, while the timeline of "what changed and why"
accumulates here, newest first. Git preserves the individual diffs.

## 2026-08-23 — 필수 인수 테스트에서 Demo Scenario를 자동 생성

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: requirement rule change
- **What**: 일반 Core User Flow와 별도 Demo Scenario → 이름·시작 조건·행동·관찰 가능한 통과
  조건을 가진 Required Acceptance Tests를 먼저 승인하고, 모든 테스트를 커버하는 Demo
  Scenario 전체와 커버리지를 자동 생성해 승인 전에 제시.
- **Why**: 사용자가 비슷한 흐름을 두 번 작성하지 않으면서 PoC가 반드시 통과해야 할 조건과
  데모의 검증 범위를 명확히 연결해야 한다.

## 2026-08-23 — 일반 사용자 흐름과 구체적인 인수 데모를 분리

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: requirement rule change
- **What**: Core User Flow와 Demo Scenario가 같은 실행 정보를 반복하고 빈 선택 Section을
  내보내는 구조 → 일반적인 제품 여정과 구체적인 인수 실행을 분리하고, `Key Assumption`의
  검증 범위를 과장하지 않으며, 작성하지 않은 선택 Section을 질문과 Markdown에서 생략.
- **Why**: Lite의 각 입력이 서로 다른 질문에 답하고 최종 문서가 최소 PoC 범위만 보여야
  한다.

## 2026-08-23 — Lite를 기존 Full 작성 방식의 간소화 템플릿으로 재정렬

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: architecture and requirement rule change
- **What**: Lite 전용 inference-first, 페르소나 선택 절차와 세밀한 출력 제약 → Lite 도입
  직전 Full의 1–2개 집중 질문, 답변 통합과 승인 흐름을 그대로 사용하고 네 Section의 제품
  입력만 유지.
- **Why**: Lite는 별도 작성 방법론이 아니라 기존 Full ALPS의 작성 경험을 보존한 간소화
  템플릿이어야 한다.

## 2026-08-22 — Start persona framing from one hypothetical problem case

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: requirement rule change
- **What**: Persona-first selection → one concrete hypothetical case that identifies who is trying
  to do what in which situation and what problem they are assumed to face; persona selection occurs
  only when the user explicitly presents multiple candidates.
- **Why**: Lite authoring should capture the PoC's problem context without requiring persona
  taxonomy work or pretending the user has a recent real-world incident to report.

## 2026-08-22 — Align Lite names and Demo Scenario structure with Full ALPS

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: requirement rule change
- **What**: Why/How/What Not to Do and separate Acceptance Scenario/Learning Check → Overview,
  Solution and User Flow, optional Out of Scope, and one `Demo Scenario` subsection.
- **Why**: Lite and Full ALPS should share recognizable product-document terminology, while Lite
  keeps its minimal executable PoC flow without a separate learning-plan field.

## 2026-08-22 — Compress method concepts into a minimal PoC learning loop

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: requirement rule change
- **What**: Separate customer promise, business impact, hypotheses, acceptance fields, and learning
  fields → two integrated inputs each for Why, How, and Demo, plus one optional exclusion list.
- **Why**: Lite authoring should preserve problem framing, acceptance, and validated learning without
  delaying the first PoC with method-specific paperwork.

## 2026-08-22 — Start from why and finish with an acceptance-test demo

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: architecture and requirement rule change
- **What**: Build-first PoC sections and legacy-format compatibility → Why, How, optional explicit
  exclusions, and a required Demo Scenario that doubles as an acceptance test.
- **Why**: The concrete problem and team or organizational business impact must constrain the
  solution, while explicit non-goals must constrain what the final demo claims to validate.

## 2026-08-22 — Reduce Lite ALPS to four PoC-focused sections

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: architecture and requirement rule change
- **What**: Eight implementation-preparation-oriented sections → three required sections for build,
  behavior, and demo plus one optional explicit-exclusion section; legacy eight-section documents
  remain editable without automatic conversion.
- **Why**: Lite ALPS should minimize authoring before a PoC and remain completely separate from the
  goal, authoring process, and management lifecycle of Full ALPS.

## 2026-08-22 — Anchor Lite authoring in one persona's core ideal use cases

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: requirement rule change
- **What**: One representative ideal path → one confirmed Primary Persona with one or more core
  ideal use cases, each carrying an explicit intent, sequential user actions, and an observable
  completion result.
- **Why**: Lite PRD conversations need one stable user perspective while still covering the few
  ideal use cases that reveal the product's core intent.

## 2026-08-20 — Make edge-oriented Lite ALPS inputs optional

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: requirement rule change
- **What**: Mandatory exclusion, interruption, exception, screen-state, and recovery inputs →
  optional inputs included only when they affect the mockup or PoC.
- **Why**: Lite ALPS should prioritize the representative ideal path and leave nonessential edge
  cases for later product and implementation work.

<!-- adr-writer:rules-version 0.8.0 — seeded by /adr-new. `adr-structure-lint` warns when this trails the installed plugin; refresh with /adr-new (it re-seeds a stale doc set). Keep this line on re-seed. -->
