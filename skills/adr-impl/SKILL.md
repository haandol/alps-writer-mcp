---
name: adr-impl
description: Implement an ADR — read the ADR, write code, run tests, then auto-promote ADR Status from Proposed to Accepted. Enforces the ADR-first development cycle. Use when the user invokes /adr-impl or asks to implement an ADR / a Proposed feature whose decision is already recorded. Keywords - "/adr-impl", "ADR 구현", "implement ADR", "Proposed ADR 코드 반영".
argument-hint: "[adr-path-or-category]"
disable-model-invocation: true
---

# adr-impl

지정한 ADR을 코드로 구현하고, 구현·테스트가 통과하면 ADR Status를 자동으로 `Accepted`로 갱신합니다. **ADR이 없으면 먼저 ADR을 작성한 뒤 진행한다** — 일반 케이스는 `/adr-new <category>` 로 직접 작성, ALPS Section 7 feature 가 이미 있다면 `/feature-to-adr` 로 일괄 변환.

> Status 의미: `Proposed`는 "ADR이 제안되었으나 미구현", `Accepted`는 "구현 완료". 이 명령은 마지막에 Status 전환까지 책임진다.

## 절차

1. **대상 ADR 식별**

   인자별 분기:
   - **인자가 파일 경로** → 그 ADR 파일 한 개를 대상으로 한다.
   - **인자가 카테고리 또는 ALPS Feature ID** (예: `f1`, `F1`, `auth`, `f-auth-01`) → `docs/adr/.mapping.json` 의 카테고리 키 또는 entry 의 `alpsFeatureId` 와 대조해 매칭. `/adr-new` 와 `/feature-to-adr` 모두 카테고리 키를 그대로 사용하므로 워크숍처럼 번호 기반 PRD 라면 1:1 로 맞다.
   - **인자가 비어 있거나 매칭이 모호하거나 매핑/매핑 파일이 없을 때** — `Proposed` 상태(미구현)인 ADR 목록을 한 번에 보여주고 사용자에게 어떤 ADR 을 구현할지 묻는다 (아래 "Proposed 목록 출력" 절차).

   **Proposed 목록 출력 절차**:
   1. `docs/adr/.mapping.json` 이 있으면 모든 카테고리를 순회. 없으면 `docs/adr/*/*.md` 를 직접 grep 해서 ADR 파일 목록을 만든다.
   2. 각 ADR 파일의 `## Status` 섹션을 읽어 `Proposed` 만 추린다 (`Accepted`, `Deprecated`, `Superseded` 는 제외).
   3. 사용자에게 다음 형식으로 한 번 보여주고 선택을 받는다:

      ```
      아직 구현되지 않은 ADR 이 N개 있습니다. 어떤 ADR 을 구현할까요?

      1. f1 — 이메일 가입 (docs/adr/f1/0001-email-signup.md)
      2. f2 — 비밀번호 재설정 (docs/adr/f2/0001-password-reset.md)
      3. cart — 장바구니 합산 (docs/adr/cart/0003-cart-totals.md)

      번호 또는 카테고리/Feature ID 로 답해주세요. 한 번에 여러 개를 구현하려면 "1,2" 또는 "f1, f2" 처럼 답하세요.
      ```

   4. 사용자가 답하면 그 선택을 카테고리 인자로 받아 다시 1단계 시작 부분으로 돌아간다.
   5. **Proposed ADR 이 0 개** 면 _"모든 ADR 이 이미 구현되어 있습니다. 새 결정을 남기려면 `/adr-new <category>` 로 ADR 을 먼저 작성하세요. ALPS Section 7 feature 를 일괄 변환하려면 `/feature-to-adr` 를 사용해도 됩니다."_ 라고 안내하고 종료한다.
   6. **ADR 자체가 디스크에 한 개도 없으면** _"ADR 이 아직 없습니다. `/adr-new <category>` 로 직접 작성하거나, ALPS Section 7 feature 가 있다면 `/feature-to-adr` 로 변환한 뒤 다시 호출해주세요."_ 라고 안내하고 종료한다.

   대상 ADR 이 식별되면 현재 Status 를 확인한다 — 이 명령은 `Proposed → Accepted` 전환을 자동 처리한다. 이미 `Accepted` 인 ADR 을 다시 구현 대상으로 받은 경우 부분 변경/보강 의도인지 사용자에게 한 번 확인하고 진행.

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
