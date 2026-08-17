# Decision Log: adr-authoring/decision-presentation

This document is the **major decision-change history** of the adr-authoring/decision-presentation
category. Each ADR body describes only the current state, while the timeline of "what
changed and why" accumulates here, newest first. Git preserves the individual diffs.

## 2026-08-17 — 결정 전제와 구현 재량을 분리해 노출

- **Current ADR**: [present decision digest and semantic diff](./0001-present-decision-digest-and-semantic-diff.md)
- **Change type**: architecture
- **What**: Decision Digest에 근거와 실패 영향을 가진 Decision premises를 추가하고, 코드 수준 구현 재량은 ADR이 아니라 구현 리뷰의 일시적 선택 원장에 남긴다.
- **Why**: AI가 사용자가 명시하지 않은 전제와 기본값을 선택할 때 결론만 보여주면 사용자가 결정의 타당성과 재검토 조건을 판단하기 어렵다.

<!-- adr-writer:rules-version 0.6.7 — seeded by /adr-new. `adr-structure-lint` warns when this trails the installed plugin; refresh with /adr-new (it re-seeds a stale doc set). Keep this line on re-seed. -->
