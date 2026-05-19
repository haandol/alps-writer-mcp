---
description: Merge ADRs that capture the evolution history of the same logical decision into one current-state ADR. Does NOT consolidate "many ADRs in one category" — multiple ADRs per category is normal.
argument-hint: "<category-or-explicit-adr-list>"
---

같은 logical decision의 진화 history가 여러 ADR에 분산되어 있을 때, 그 묶음만 골라 하나의 현재 상태 ADR로 통합합니다. 같은 카테고리에 ADR이 많은 것 자체는 정상이고 통합 대상이 아닙니다.

전체 절차는 `${CLAUDE_PLUGIN_ROOT}/skills/adr-rollup/SKILL.md`를 따른다.

핵심 원칙:

- **묶음 단위 통합**: 카테고리 내의 ADR을 모두 합치는 게 아니라, 같은 logical decision을 다루는 ADR들만 묶어서 통합한다. 다른 결정의 ADR은 손대지 않는다.
- **Seamless merge**: 결과물에 "rollup" 흔적을 남기지 않는다. 파일명·제목·인덱스 어디에도 `(Roll-up)` 같은 접미사 금지.
- 가장 낮은 번호 ADR을 유지하고 그 파일 내용을 통합본으로 덮어쓴다. 같은 묶음의 다른 ADR은 **삭제**한다.
- Evolution History 섹션을 만들지 않는다. Git 히스토리가 source of truth.
- 다른 ADR에서 삭제된 ADR을 참조하는 Related 링크를 통합 ADR로 변경한다.
- 통합 후 `docs/adr/.mapping.json`의 `adrs` 배열을 갱신한다.
- 사용자 승인 전까지 파일을 저장하지 않는다.
- 묶을 만한 체인이 없으면 **"통합할 것 없음"**으로 종료한다 — 억지로 묶지 않는다.
