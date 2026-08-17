# ADR 0001: Section 7 Feature를 전체 데모에 연결

Date: 2026-08-17

## Status

Accepted (2026-08-17)

## Context

Section 3은 MVP의 전체 데모 여정을 설명하고 Section 7은 각 Feature를 수직 슬라이스로 상세화한다. 사용자는 각 Feature가 전체 데모에서 어떤 역할을 하는지 확인할 수 있어야 한다.

별도 Feature Demo에 사전 조건, 사용자 행동, 관찰 결과, 실패 시나리오와 성공 판정을 다시 기록하면 Section 7의 User Flow, 오류 처리와 Acceptance Criteria를 중복한다. 같은 제품 행동을 두 곳에 유지하면 작성 비용과 드리프트 위험이 함께 증가한다.

## Decision Drivers

- Builder는 각 Feature가 전체 MVP 데모에 기여하는 지점을 빠르게 확인할 수 있어야 한다.
- Section 7은 같은 사용자 행동을 여러 subsection에 반복하지 않아야 한다.
- 데모 연결은 제품 행동 수준을 유지하고 구현 계획이나 테스트 절차로 내려가지 않아야 한다.
- 상세한 데모 설명은 기존 User Flow, 오류 처리와 Acceptance Criteria에서 복구할 수 있어야 한다.

## Decision

Section 7의 각 Feature는 Acceptance Criteria에 **Demo checkpoint** 한 줄을 기록한다.

Demo checkpoint는 Section 3 전체 여정에서 해당 Feature가 담당하는 역할과 사용자가 관찰할 완료 결과를 한 문장으로 연결한다. 데모의 순서, 오류와 성공 조건은 기존 User Flow, edge case·error handling과 Acceptance Criteria를 사용한다. 별도 `7.x.7 Feature Demo` subsection은 만들지 않는다.

사용자가 상세 데모 절차를 요청하면 모델은 Section 3과 해당 Feature의 기존 subsection에서 일시적으로 조합해 보여준다. 파생된 절차는 ALPS 문서의 별도 권위로 저장하지 않는다.

### Requirement contract

#### 필수 보장

- Section 7 작성자는 Section 3과 Section 6을 먼저 읽는다.
- 모든 `7.x` Feature의 Acceptance Criteria는 전체 데모에서의 역할과 관찰 가능한 완료 결과를 연결하는 `Demo checkpoint` 한 줄을 포함한다.
- Demo checkpoint는 같은 Feature의 User Flow, 오류 처리와 Acceptance Criteria에 모순되지 않아야 한다.
- Atomic과 batch 작성 모두 기존 Feature 단위의 승인과 저장 경계를 유지한다.

#### 금지

- Section 7에 별도 `7.x.7 Feature Demo` subsection을 만들지 않는다.
- Demo checkpoint에 사전 조건, 전체 사용자 행동, 실패 시나리오와 성공 조건을 반복하지 않는다.
- Demo checkpoint에 구현 라이브러리, 코드 구조, 테스트 파일, 배포 절차, PR 또는 커밋 계획을 기록하지 않는다.

#### 실패 시 보장

- Demo checkpoint만으로 상세 절차가 부족하면 문서 구조를 늘리지 않고 기존 Section 3, User Flow, 오류 처리와 Acceptance Criteria를 사용해 요청 시 설명한다.

### Alternatives

1. **Section 3 전체 데모만 유지**
   - 장점: Section 7에 새 필드가 없다.
   - 단점: 개별 Feature가 전체 여정에 기여하는 지점을 빠르게 찾기 어렵다.

2. **각 Feature에 완전한 Feature Demo subsection 추가**
   - 장점: Feature 하나만 읽어도 완전한 데모 절차를 얻는다.
   - 단점: User Flow, 오류 처리와 Acceptance Criteria를 반복해 작성하고 함께 유지해야 한다.

3. **Acceptance Criteria에 Demo checkpoint 한 줄 추가**
   - 장점: 전체 데모와의 연결을 보존하면서 기존 Feature 명세를 반복하지 않는다.
   - 단점: 상세 데모 절차는 기존 subsection을 함께 읽거나 요청 시 파생해야 한다.

## Consequences

### Positive

- Builder는 각 Feature가 전체 데모에서 담당하는 역할을 한 줄로 확인할 수 있다.
- User Flow, 오류 처리와 Acceptance Criteria가 상세 제품 행동의 단일 소스로 유지된다.
- Section 7 작성과 검토 비용이 줄고 같은 행동의 문서 간 드리프트가 사라진다.

### Negative

- Feature만 단독으로 읽을 때 완전한 데모 실행 절차는 보이지 않는다.
- 상세 데모가 필요하면 Section 3과 기존 Feature subsection을 함께 읽어야 한다.

### Risks

- Demo checkpoint가 모호한 슬로건으로 퇴화할 수 있다. 역할과 관찰 가능한 완료 결과를 모두 한 문장에 포함한다.
- 상세 데모 요청이 새 영속 문서를 만들 수 있다. 설명은 기존 권위 문서에서 파생한 일시적 출력으로 유지한다.

## Related

- 없음
