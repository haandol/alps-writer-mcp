---
description: Roll up multiple ADRs in the same category into a single "current state" ADR.
argument-hint: "<category>"
---

같은 카테고리에서 누적 진화한 ADR 체인(0001→0002→0003→...)을 가장 번호가 낮은 한 파일로 통합합니다.

전체 절차는 `${CLAUDE_PLUGIN_ROOT}/skills/adr-rollup/SKILL.md`를 따른다.

핵심 원칙:

- **Seamless merge**: 결과물에 "rollup" 흔적을 남기지 않는다. 파일명·제목·인덱스 어디에도 `(Roll-up)` 같은 접미사 금지.
- 가장 낮은 번호 ADR을 유지하고 그 파일 내용을 통합본으로 덮어쓴다. 나머지는 **삭제**한다.
- Evolution History 섹션을 만들지 않는다. Git 히스토리가 source of truth.
- 다른 ADR에서 삭제된 ADR을 참조하는 Related 링크를 통합 ADR로 변경한다.
- 통합 후 `docs/adr/.mapping.json`의 `adrs` 목록을 갱신한다.
- 사용자 승인 전까지 파일을 저장하지 않는다.
