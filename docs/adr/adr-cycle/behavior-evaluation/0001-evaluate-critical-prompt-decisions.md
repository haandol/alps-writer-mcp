# ADR 0001: 중요한 prompt 분류를 행동 시나리오로 검증

Date: 2026-08-15

## Status

Accepted (2026-08-18)

## Context

정적 테스트는 prompt에 특정 문구가 존재하는지 확인하지만 실제 model이 상충하는 지시 사이에서 어떤 행동을 선택하는지는 확인하지 못한다. Admission, dependency, 요구사항 보존과 review routing은 한 번의 오분류가 잘못된 ADR이나 완료 상태를 만들 수 있다.

모든 prompt를 live model로 검사하면 비용과 비결정성이 커지므로 안전 분류에 집중한 행동 회귀가 필요하다.

## Decision Drivers

- 안전 분류는 문구 존재가 아니라 실제 행동으로 검증해야 한다.
- prompt 수정이 한 시나리오를 고치면서 반대 행동을 깨뜨리는지 확인해야 한다.
- live model 평가는 CI를 불안정하게 만들면 안 된다.
- 재현 가능한 defect는 반복 실행의 hit rate로 측정해야 한다.

## Decision

영속 상태나 계약 소유권을 바꾸는 prompt 분류에는 정적 테스트와 별도의 행동 시나리오를 둔다.

대상에는 ADR admission, 완전한 PRD 계약 소유권 이전, 반복 import의 semantic no-op, 삭제 계약의 자동 제거 금지, 선행 ADR 차단, 요구사항 값·집합 보존, ALPS 승인 모드와 NFR 보존, implementation-review routing과 계약·안전에 영향을 주는 숨은 미검증 전제 탐지가 포함된다.

요구사항 gap 처리 시나리오는 저장소·도메인 기본값으로 자동 해소할 항목과 여러 제품 선택지가 남아 Decision request가 필요한 항목을 함께 제공해 과소·과잉 escalation을 동시에 검증한다.

변경되지 않은 승인 ADR의 구현 계획은 독립 시나리오로 검증한다. Scorer는 계획이 비차단 진행 상황으로 충분히 공유되고 즉시 진행되는지, 구조화 결과와 사용자에게 보이는 본문 모두에서 routine approval을 요구하지 않는지, 기존 `Accepted` Status를 `Proposed`로 내리지 않는지 확인한다.

행동 시나리오는 실제 skill·agent·hook text를 사용하고 서로 반대되는 기대를 pair로 검증한다. Live model 평가는 CI에 넣지 않고 릴리스 또는 defect 재현 시 여러 번 실행해 hit rate를 기록한다.

### Requirement contract

- 영속 상태나 요구사항 계약을 결정하는 새 prompt 분류에는 최소 하나의 행동 시나리오가 있어야 한다.
- 과도 생성과 누락 위험이 모두 있는 분류는 반대 방향 시나리오를 함께 둔다.
- 시나리오는 재구성한 요약이 아니라 shipping prompt text를 사용한다.
- scorer는 문구 일치보다 생성된 artifact와 행동 결과를 우선 평가한다.
- 계약·안전에 영향을 주는 외부 전제가 fixture에 숨어 있으면 scorer는 reviewer가 전제, 실패 영향과 부족한 검증을 드러내고 `PASS`를 거부하는지 확인한다.
- gap-resolution scorer는 자동 해소 항목의 근거와 비차단 진행, 제품 판단 항목의 추천안·대안·영향·ADR 문구를 모두 확인한다.
- 변경되지 않은 승인 ADR의 planning scorer는 완전한 progress update와 즉시 진행을 확인하고 visible report의 routine plan approval 요청과 `Accepted → Proposed` 오판을 거부한다.
- live model eval 실패는 CI 실패로 취급하지 않지만 릴리스 판단 자료에 포함한다.
- 정적 테스트는 scenario shape, scorer의 양·음성 구분과 fixture 유효성을 검증한다.

### Alternatives

1. **정적 prompt 문구 테스트만 유지**
   - 장점: 빠르고 결정적이다.
   - 단점: model이 지시를 실제로 따르는지 알 수 없다.

2. **모든 prompt 행동 eval을 CI에서 실행**
   - 장점: 모든 변경에 즉시 행동 신호가 생긴다.
   - 단점: 비용과 비결정성 때문에 publication gate가 불안정해진다.

3. **안전 분류 중심의 비차단 행동 회귀**
   - 장점: 중요한 오분류를 재현하면서 CI 안정성을 유지한다.
   - 단점: 릴리스 과정에서 별도 실행과 해석이 필요하다.

## Consequences

### Positive

- prompt가 말하는 규칙과 model이 실행하는 행동의 차이를 측정한다.
- 반대 방향 회귀를 함께 탐지한다.
- 보고된 defect를 반복 가능한 fixture로 남긴다.

### Negative

- live model 실행 비용과 시간이 추가된다.
- 통과는 행동의 수학적 보장이 아니다.

### Risks

- scorer가 약하면 잘못된 응답을 통과시킬 수 있다. scorer 자체를 stub 응답으로 양방향 검증한다.

## Related

- 없음
