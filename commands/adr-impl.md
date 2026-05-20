---
description: Implement an ADR — read the ADR, write code, run tests, then auto-promote ADR Status from Proposed to Accepted. Enforces ADR-first development cycle.
argument-hint: "<adr-path-or-category>"
---

지정한 ADR을 코드로 구현하고, 구현·테스트가 통과하면 ADR Status를 자동으로 `Accepted`로 갱신합니다. **ADR이 없거나 stale이면 먼저 `/feature-to-adr` 또는 `/adr-sync`를 수행한 뒤 진행한다.**

> Status 의미: `Proposed`는 "ADR이 제안되었으나 미구현", `Accepted`는 "구현 완료". 이 명령은 마지막에 Status 전환까지 책임진다.

## 절차

1. **대상 ADR 식별**
   - 인자가 파일 경로면 그 ADR을, 카테고리면 `docs/adr/.mapping.json`에서 해당 카테고리의 ADR 목록을 모두 읽는다.
   - 인자가 ALPS Feature ID 형태(예: `f1`, `F1`, `f-auth-01`)면 매핑의 카테고리 키 또는 entry 의 `alpsFeatureId` 와 대조해 매칭. `/feature-to-adr` 가 ALPS Feature ID 를 카테고리 키로 그대로 사용하므로 워크숍처럼 번호 기반 PRD 라면 1:1 로 맞다. 매칭이 모호하면 매핑 항목을 한 번 보여주고 사용자에게 확인.
   - 현재 Status가 `Proposed`인지 확인한다 (이 명령은 `Proposed → Accepted` 전환을 자동 처리한다). 이미 `Accepted`인 ADR은 부분 변경/보강 의도인지 확인하고 진행.

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
   - 테스트가 실패하면 5단계로 넘어가지 않는다 — 구현 버그면 3단계로, ADR이 잘못된 결정이면 ADR을 먼저 수정하고 다시 3단계로.

5. **Status 자동 전환 (`Proposed → Accepted`)**
   - 4단계 테스트가 통과한 직후, **사용자 확인 없이** 대상 ADR 본문의 Status 줄을 다음 형식으로 수정한다:

     ```
     ## Status

     Accepted (YYYY-MM-DD)
     ```

   - 동시에 `docs/adr/README.md`의 카테고리별 ADR 목록 한 줄 요약에서 `Proposed` → `Accepted`로 갱신한다.
   - 한 카테고리 안에 여러 ADR이 함께 구현된 경우 각 ADR을 모두 갱신한다.
   - 이 단계는 자동이지만 변경 사항을 사용자에게 한 줄로 알린다 ("ADR auth/0003 Status를 Accepted로 갱신했습니다").

6. **마무리**
   - 변경된 코드와 ADR이 정합한지 한 번 더 확인 (`/adr-sync <category>`).
   - 매핑 파일의 `lastSyncedAt` 갱신.

**금지**:

- ADR 없이 새 기능을 구현하지 않는다.
- 구현 중 발견한 결정 변경은 코드 수정 전에 ADR에 반영한다.
- 테스트가 통과하지 않은 ADR을 `Accepted`로 올리지 않는다 — Status는 코드 동작의 사실이지 의도 표명이 아니다.
