# Decision Log: adr-authoring/current-state

This document is the **major decision-change history** of the adr-authoring/current-state
category. Each ADR body describes only the current state, while the timeline of "what
changed and why" accumulates here, newest first. Git preserves the individual diffs.

## 2026-08-15 — 기존 결정 소유자 확인을 새 ADR 생성보다 우선

- **Current ADR**: [record only the final decision state](./0001-record-only-the-final-decision-state.md)
- **Change type**: architecture
- **What**: 최종 상태 서술 규칙에 decision-identity 재사용 게이트를 추가했다. 같은 결정의 대안 교체와 원복은 기존 ADR을 갱신하고, 독립된 현재 상태가 공존하는 분기만 새 ADR을 만든다.
- **Why**: 제공자 같은 채택 대안이 바뀔 때마다 새 ADR이 생겨 결정 수보다 변경 횟수가 문서 수를 지배했다.

<!-- adr-writer:rules-version 0.6.3 — seeded by /adr-new. `adr-structure-lint` warns when this trails the installed plugin; refresh with /adr-new (it re-seeds a stale doc set). Keep this line on re-seed. -->
