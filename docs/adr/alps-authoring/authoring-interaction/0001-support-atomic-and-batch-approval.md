# ADR 0001: ALPS 작성에 원자적 승인과 명시적 batch 승인을 함께 지원

Date: 2026-08-15

## Status

Accepted (2026-08-15)

## Context

질문에 답하며 PRD를 만드는 사용자는 한 section씩 확인하는 흐름이 안전하다. 반면 완성된 brief나 기존 문서를 제공한 사용자가 모든 section과 feature를 각각 다시 승인하면 이미 명확한 입력에도 반복 비용이 발생한다.

Batch 작성은 사용자가 요청한 경우에만 허용하고 section 단위 저장과 부분 수정 가능성은 유지해야 한다.

## Decision Drivers

- 기본 대화형 사용자는 작성 중 누락을 section별로 확인할 수 있어야 한다.
- 완성된 입력을 제공한 사용자는 반복 승인 없이 진행할 수 있어야 한다.
- Batch 승인에서도 각 section과 feature의 경계가 사라지면 안 된다.
- 사용자는 batch 안의 일부 항목만 수정하거나 거부할 수 있어야 한다.

## Decision

ALPS 작성은 **atomic mode**를 기본으로 하고 사용자가 명시적으로 batch를 요청하거나 완성된 구조화 입력을 제공하면 **batch approval mode**를 제공한다.

Atomic mode는 section 또는 feature 하나를 작성하고 확인한 뒤 저장한다. Batch mode는 여러 section이나 feature를 각각 독립된 단위로 작성해 한 번에 제시하고, 사용자가 전체 승인 또는 항목별 수정을 선택하게 한다. 승인이 끝난 뒤 저장은 각 단위별로 수행한다.

### Requirement contract

- 사용자가 모드를 지정하지 않으면 section별 atomic mode를 사용한다.
- 사용자가 batch 작성을 명시적으로 요청하거나 완성된 구조화 입력을 제공하면 batch approval을 제안할 수 있다.
- Batch 결과는 section과 feature별 제목, 요구사항과 미해결 질문을 분리해 보여준다.
- 사용자는 전체 승인, 특정 단위 수정 또는 batch 취소를 선택할 수 있다.
- 승인되지 않은 단위는 저장하지 않는다.
- 승인된 batch도 각 section과 feature를 개별 저장 단위로 기록한다.
- 완료되고 변경되지 않은 단위는 전체 재검토 요청이나 prerequisite 변경이 없으면 다시 승인받지 않는다.

### Alternatives

1. **항상 개별 승인**
   - 장점: 각 단위의 사용자 확인이 명확하다.
   - 단점: 완성된 입력에서도 반복 상호작용이 발생한다.

2. **항상 전체 문서를 한 번에 승인**
   - 장점: 상호작용 횟수가 가장 적다.
   - 단점: 누락과 부분 수정 지점을 찾기 어렵다.

3. **기본 atomic, 명시적 batch opt-in**
   - 장점: 안전한 기본값과 숙련 사용자 효율을 함께 제공한다.
   - 단점: 두 승인 모드를 prompt와 테스트에서 유지해야 한다.

## Consequences

### Positive

- 대화형 사용자는 기존의 안전한 흐름을 유지한다.
- 완성된 brief를 가진 사용자는 반복 확인을 줄인다.
- Batch에서도 저장과 수정 경계가 명확하다.

### Negative

- authoring skill이 사용자 의도에 따라 모드를 선택해야 한다.

### Risks

- 불완전한 입력을 batch로 오인할 수 있다. 불명확하면 atomic mode를 사용한다.

## Related

- 없음
