# Decision log — delivery/development-flow

Newest first. Record only major decision changes.

- **2026-08-17 — current ADR: [safe proportional development gates](./0001-safe-proportional-development-gates.md)** — 인지부하 관리를 강제 checkpoint나 새 상태가 아닌 1~10 휴리스틱과 선택적 분할 제안으로 제한하고, ALPS·ADR 플러그인을 모델 개선에 따라 단순화할 수 있는 워크플로우로 명시했다.
- **2026-08-16 — current ADR: [safe proportional development gates](./0001-safe-proportional-development-gates.md)** — ADR admission 지시 주입을 매 사용자 메시지 실행에서 세션 시작·재개·초기화와 context compaction 복구 시점 실행으로 변경해 반복 훅 비용을 제거했다.
- **2026-08-15 — current ADR: [safe proportional development gates](./0001-safe-proportional-development-gates.md)** — ADR 의도 확인을 구현 전 기준선 게이트로 이동하고, 구현 후에는 증거 기반 발견을 자동 수정·재검증한 뒤 추가 승인 없이 완료하도록 변경했다.
- **2026-08-15 — current ADR: [safe proportional development gates](./0001-safe-proportional-development-gates.md)** — 개발 흐름의 복합 결정을 선행 상태와 위험 비례 완료 게이트로 좁히고 저장소 보호, prompt 행동 평가와 ALPS 작성 정책을 독립 결정으로 분리했다.
