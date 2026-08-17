# Decision log — adr-cycle/implementation-review

Newest first. Record only major decision changes.

- **2026-08-17 — current ADR: [risk-proportional implementation review](./0001-validated-low-risk-refactoring.md)** — ADR의 각 계약 행을 달성 상태와 증거로 연결한 Evidence Package를 기본 화면으로 삼고, 중요한 구현 재량에는 ADR 의도 적합성을 함께 설명하도록 변경했다.
- **2026-08-17 — current ADR: [risk-proportional implementation review](./0001-validated-low-risk-refactoring.md)** — 계약 대조와 테스트 증거는 유지하되 상세 repair guide와 다이어그램을 조건부로 전환하고, 구현 선택은 sufficiency 검토에서 한 번만 추출해 읽기 전용으로 표시하도록 변경했다.
- **2026-08-17 — current ADR: [risk-proportional implementation review](./0001-validated-low-risk-refactoring.md)** — full 리포트를 주니어가 읽는 설명·근거 기반 다이어그램·Implementation Choice Ledger의 세 단계로 구성하고, HTML에서 AI가 선택한 구현 기본값을 판정·내보낼 수 있게 변경했다.
- **2026-08-16 — current ADR: [risk-proportional implementation review](./0001-validated-low-risk-refactoring.md)** — 다중 agent orchestration을 지원하지 않는 Bedrock 세션은 하위 agent dispatch를 피하고 메인 세션 fallback을 사용하며, 독립 reviewer가 없는 리팩토링은 제안으로만 남기도록 변경했다.
- **2026-08-15 — current ADR: [risk-proportional implementation review](./0001-validated-low-risk-refactoring.md)** — full 리뷰의 사람 의도 확인을 구현 전 ADR 승인으로 이동하고, 구현 후에는 증거 기반 결함을 자동 수정·재검증한 뒤 추가 승인 없이 완료하도록 변경했다.
- **2026-08-15 — current ADR: [risk-proportional implementation review](./0001-validated-low-risk-refactoring.md)** — 모든 구현에 동일한 전체 검토를 적용하던 정책을 보호 표면 기준의 standard/full 검토로 변경했다.
