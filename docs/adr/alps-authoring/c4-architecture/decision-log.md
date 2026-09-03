# Decision Log: alps-authoring/c4-architecture

이 문서는 alps-authoring/c4-architecture category의 **주요 결정 변경 이력**이다.
ADR 본문은 현재 상태만 설명하고, 이 로그는 주요 전환을 최신순으로 보존한다.
개별 diff는 Git이 보존한다.

## 2026-09-02 — 기술 목록을 지속적인 아키텍처 제약으로 교체

- **Current ADR**: [PRD 아키텍처 경계](./0001-context-and-container-only-prd-architecture.md)
- **Change type**: requirement rule change
- **What**: Full ALPS Section 4.2를 Technology Stack 목록에서 재구현 후에도 유지해야 할 Architecture Constraints로 변경했다.
- **Why**: 프레임워크, SDK와 내부 도구는 코드와 dependency metadata에서 복구할 수 있다. 이를 PRD에 저장하면 추상화 경계를 침범하고 drift를 만든다.

<!-- adr-writer:rules-version 0.8.9 — seeded by /adr-new. `adr-structure-lint` warns when this trails the installed plugin; refresh with /adr-new (it re-seeds a stale doc set). Keep this line on re-seed. -->
