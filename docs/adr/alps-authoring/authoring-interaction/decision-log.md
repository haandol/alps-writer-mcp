# Decision Log: alps-authoring/authoring-interaction

This document is the **major decision-change history** of the
alps-authoring/authoring-interaction category. Each ADR body describes only the current
state, while the timeline of "what changed and why" accumulates here, newest first. Git
preserves the individual diffs.

## 2026-08-22 — 질문 우선 작성에서 inference-first 작성으로 전환

- **Current ADR**: [support-atomic-and-batch-approval](./0001-support-atomic-and-batch-approval.md)
- **Change type**: requirement rule change
- **What**: 모든 누락 입력을 사용자에게 질문하는 방식 → 사용자 입력, 기존 Section, 논리적
  귀결과 일반적인 도메인 기본값으로 제품 상수를 먼저 추론하고 중요한 불확실성만 질문하는
  방식.
- **Why**: 사용자는 AI가 회수할 수 있는 정보를 반복해서 답하기보다 제품 계약과 관찰 결과를
  실제로 바꾸는 결정에 집중해야 한다.

## 2026-08-18 — 승인 화면을 계약 중심 plain-text digest로 전환

- **Current ADR**: [support-atomic-and-batch-approval](./0001-support-atomic-and-batch-approval.md)
- **Change type**: requirement rule change
- **What**: 전체 section 원문을 Markdown으로 표시하는 승인 방식 → 계약 정보를 빠짐없이 담은 간결한 plain-text digest를 승인 단위별로 표시하는 방식. Section 7은 각 Feature `7.x`를 독립 승인하고 개별 저장한다.
- **Why**: 렌더링을 보장할 수 없는 대화 환경에서 전체 원문은 읽기 비용이 높고 중요한 요구사항 계약을 찾기 어렵다.

<!-- adr-writer:rules-version 0.7.1 — seeded by /adr-new. `adr-structure-lint` warns when this trails the installed plugin; refresh with /adr-new (it re-seeds a stale doc set). Keep this line on re-seed. -->
