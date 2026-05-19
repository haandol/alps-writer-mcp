---
description: Verify ADRs still match the shipping codebase; fix drift and update the README index.
argument-hint: "[category?] [--quick]"
---

`docs/adr/` 의 ADR이 현재 코드와 일치하는지 검증하고 drift를 수정합니다.

전체 절차는 `${CLAUDE_PLUGIN_ROOT}/skills/adr-sync/SKILL.md`를 따른다.

요약:

1. `docs/adr/.mapping.json`에서 검증 대상 카테고리(들)을 결정한다. 인자가 있으면 해당 카테고리만.
2. 각 카테고리의 `codePaths`를 grep해서 ADR의 주장(Status, API, 엔티티, 상태값, GSI 키 등)이 코드와 일치하는지 확인한다.
3. 불일치 발견 시 코드를 source of truth로 보고 ADR을 수정한다.
4. `--quick`이면 README 한 줄 요약만 비교, 기본은 deep mode (ADR 본문 전부 읽기).
5. 수정 후 매핑의 `lastSyncedAt`을 갱신한다.
6. 결과를 `## ADR Sync Results` 형식으로 보고한다 (Fixed / Contradictions Resolved / In Sync / Suggestions).

**주의**: 새 구현 세부사항(파일 경로, 코드 스니펫, 상수)을 ADR에 추가하지 않는다. 폴더 단위 이하 참조 금지.
