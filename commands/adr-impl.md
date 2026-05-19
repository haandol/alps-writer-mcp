---
description: Implement an ADR — read the ADR, write code, run tests. Enforces ADR-first development cycle.
argument-hint: "<adr-path-or-category>"
---

지정한 ADR을 코드로 구현합니다. **ADR이 없거나 stale이면 먼저 `/feature-to-adr` 또는 `/adr-sync`를 수행한 뒤 진행한다.**

## 절차

1. **대상 ADR 식별**
   - 인자가 파일 경로면 그 ADR을, 카테고리면 `docs/adr/.mapping.json`에서 해당 카테고리의 ADR 목록을 모두 읽는다.
   - Status가 `Proposed`이면 사용자에게 `Accepted`로 승격할지 확인.

2. **계획 수립**
   - ADR의 Decision/Mermaid 다이어그램에서 vertical slice를 추출한다 (UI → API → 데이터).
   - `codePaths`에 해당하는 기존 코드를 읽고 차이를 식별한다.
   - 변경 계획을 사용자에게 제시하고 승인받는다.

3. **구현**
   - 작은 단위로 Edit/Write. PreToolUse hook이 ADR 정합성을 자동 검증한다 (`ALPS_ADR_ENFORCE=block`이면 stale 시 차단).
   - ADR에 명시된 행동 규칙·상태 전이·연동 방식을 그대로 따른다. ADR과 다르게 구현하려면 먼저 ADR을 수정한다.

4. **테스트**
   - 프로젝트의 테스트 명령(`AGENTS.md` 또는 `package.json` 참조)을 실행한다.
   - 테스트가 없으면 사용자에게 어떤 검증 절차를 원하는지 묻는다.

5. **마무리**
   - 변경된 코드와 ADR이 정합한지 한 번 더 확인 (`/adr-sync <category>`).
   - 매핑 파일의 `lastSyncedAt` 갱신.

**금지**: ADR 없이 새 기능을 구현하지 않는다. 구현 중 발견한 결정 변경은 코드 수정 전에 ADR에 반영한다.
