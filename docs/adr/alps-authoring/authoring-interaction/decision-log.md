# Decision Log: alps-authoring/authoring-interaction

This document is the **major decision-change history** of the
alps-authoring/authoring-interaction category. Each ADR body describes only the current
state, while the timeline of "what changed and why" accumulates here, newest first. Git
preserves the individual diffs.

## 2026-08-18 — 승인 화면을 계약 중심 plain-text digest로 전환

- **Current ADR**: [support-atomic-and-batch-approval](./0001-support-atomic-and-batch-approval.md)
- **Change type**: requirement rule change
- **What**: 전체 section 원문을 Markdown으로 표시하는 승인 방식 → 계약 정보를 빠짐없이 담은 간결한 plain-text digest를 승인 단위별로 표시하는 방식. Section 7은 각 Feature `7.x`를 독립 승인하고 개별 저장한다.
- **Why**: 렌더링을 보장할 수 없는 대화 환경에서 전체 원문은 읽기 비용이 높고 중요한 요구사항 계약을 찾기 어렵다.

<!-- adr-writer:rules-version 0.7.1 — seeded by /adr-new. `adr-structure-lint` warns when this trails the installed plugin; refresh with /adr-new (it re-seeds a stale doc set). Keep this line on re-seed. -->
