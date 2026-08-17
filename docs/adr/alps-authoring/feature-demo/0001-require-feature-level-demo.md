# ADR 0001: Section 7 Feature마다 데모 계약을 기록

Date: 2026-08-17

## Status

Accepted (2026-08-17)

## Context

Section 3은 MVP의 핵심 가설을 검증하는 전체 데모 여정을 설명한다. Section 7은 각 Feature를 수직 슬라이스로 정의하지만, 현재는 그 Feature가 전체 데모에서 어떤 역할을 하고 사용자가 무엇을 관찰해야 하는지 독립적으로 확인하기 어렵다.

기술 흐름과 인수 조건만으로는 비개발자 Builder가 AI가 작성한 Feature를 직접 실행해 이해하기 어렵다. 각 Feature는 전체 데모와의 관계를 유지하면서도 하나의 관찰 가능한 행동으로 시연할 수 있어야 한다.

## Decision Drivers

- Builder는 구현 세부사항을 읽지 않고 Feature의 동작을 직접 확인할 수 있어야 한다.
- 전체 MVP 데모와 개별 Feature 명세의 관계가 문서 안에서 드러나야 한다.
- Feature 데모는 Section 3 전체 시나리오를 복제하지 않고 해당 Feature의 기여만 설명해야 한다.
- 성공 결과뿐 아니라 사용자가 확인해야 하는 대표 실패 동작도 명확해야 한다.
- Feature Demo는 구현 기술이나 코드 작업 단위를 포함하지 않아야 한다.

## Decision

Section 7의 모든 Feature는 기존 명세에 더해 **Feature Demo**를 기록한다.

Feature Demo는 Section 3 전체 데모에서 해당 Feature가 담당하는 역할을 밝히고, 데모를 시작하기 위한 사전 조건, 사용자의 실행 행동, 사용자가 관찰할 결과, 대표 실패 시나리오와 성공 판정을 제품 행동 수준에서 설명한다. Section 7 작성 전에 Section 3과 Section 6을 모두 검토한다.

### Requirement contract

#### 필수 보장

- Section 7의 모든 `7.x` Feature는 `7.x.7 Feature Demo`를 포함한다.
- Feature Demo는 Section 3 전체 데모에서 해당 Feature가 담당하거나 지원하는 역할을 기록한다.
- Feature Demo는 데모 시작에 필요한 사전 조건을 기록한다.
- Feature Demo는 사용자가 수행할 행동을 순서대로 기록한다.
- Feature Demo는 화면이나 외부 동작으로 확인할 수 있는 관찰 결과를 기록한다.
- 사용자에게 보이는 거부 또는 오류 동작이 있으면 대표 실패 시나리오를 기록하고, 해당 사항이 없으면 적용되지 않는다고 명시한다.
- Feature Demo는 성공 여부를 판정할 수 있는 결과를 기록하며 같은 Feature의 Acceptance Criteria와 모순되지 않아야 한다.
- Section 7 작성자는 Section 3과 Section 6을 먼저 읽고 핵심 내용을 요약한다.
- Atomic과 batch 작성 모두 Feature Demo가 포함된 Feature 단위로 승인하고 저장한다.

#### 금지

- Feature Demo는 구현 라이브러리, 코드 구조, 테스트 파일, PR 또는 커밋 계획을 기록하지 않는다.

### Alternatives

1. **Section 3 전체 데모만 유지**
   - 장점: 문서 길이가 늘어나지 않는다.
   - 단점: 개별 Feature를 독립적으로 어떻게 확인해야 하는지 알기 어렵다.

2. **Section 7 Acceptance Criteria만 데모 기준으로 사용**
   - 장점: 기존 구조를 바꾸지 않는다.
   - 단점: 사전 조건, 실행 순서, 관찰 결과와 전체 데모에서의 역할이 분리되어 있지 않다.

3. **Section 3 전체 데모와 Section 7 Feature Demo를 함께 사용**
   - 장점: 전체 사용자 여정과 개별 Feature의 관찰 가능한 행동을 각각의 해상도에서 이해할 수 있다.
   - 단점: 각 Feature에 데모 설명을 추가로 작성해야 한다.

## Consequences

### Positive

- Builder가 각 Feature를 직접 시연하며 AI가 작성한 요구사항을 이해할 수 있다.
- 전체 데모에서 빠진 Feature나 독립적으로 확인할 수 없는 Feature를 발견하기 쉬워진다.
- Feature의 성공과 실패 동작을 Acceptance Criteria와 함께 검토할 수 있다.

### Negative

- Section 7 Feature 하나를 작성할 때 확인할 항목이 늘어난다.
- 기존 ALPS 문서는 Feature Demo를 추가해야 새 계약을 충족한다.

### Risks

- Feature Demo가 Section 3을 그대로 복제할 수 있다. 작성 가이드는 전체 여정이 아니라 해당 Feature의 역할과 관찰 결과만 기록하게 해야 한다.
- 데모 준비 절차가 코드와 배포 상세로 내려갈 수 있다. 템플릿은 제품 행동 수준의 사전 조건만 허용해야 한다.

## Related

- 없음
