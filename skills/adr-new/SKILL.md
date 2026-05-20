---
name: adr-new
description: Author a new ADR directly (no ALPS PRD required). Drafts a Proposed ADR, seeds docs/adr/.mapping.json, and updates the README index. Use when the user invokes /adr-new or asks to write an ADR for a fresh decision (refactor, infra choice, new feature direction). Keywords - "/adr-new", "ADR 새로 작성", "ADR 만들어줘", "draft an ADR", "write a new ADR".
argument-hint: "<category> [title?]"
disable-model-invocation: true
---

# adr-new

ADR 을 직접 작성합니다. ALPS PRD 가 없어도 사용 가능합니다 — 이 plugin 의 정식 ADR 작성 경로이고, `/feature-to-adr` 는 "ALPS Section 7 feature 가 이미 있을 때 자동 변환해주는 helper" 입니다.

> 사용 시점: 새 기능/리팩토링/인프라 결정 등 코드를 바꾸기 전에 의사결정을 남겨야 할 때. 작성한 ADR 은 곧바로 `/adr-impl` 로 이어 구현할 수 있습니다.

## 절차

### 1. 인자 해석

- **`<category>`** (필수) — kebab-case 카테고리 키 (예: `auth`, `billing`, `cart`). 워크숍/번호 기반이라면 `f1`, `f-auth-01` 등 ALPS Feature ID 도 그대로 카테고리 키로 사용 가능.
- **`[title]`** (선택) — 명령 인자로 제목을 받으면 그 제목으로 시작. 없으면 사용자에게 한 번 물어본다 ("어떤 결정을 ADR 로 남길까요? 제목 한 줄").

매핑 상태 점검:

- `docs/adr/` 가 없으면 디렉토리를 만든다.
- `docs/adr/README.md` 가 없으면 `${CLAUDE_PLUGIN_ROOT}/templates/adr/README.md` 를 복사한다.
- `docs/adr/.mapping.json` 이 없으면 빈 골격(`{ "categories": {} }`) 으로 만든다 — `alpsDocument` 필드는 ALPS PRD 가 있을 때만 채운다.

### 2. 결정의 동기 청취

ALPS 가 없는 상태에서 ADR 을 잘 쓰려면 다음 정보가 필요하다. 한 번에 하나씩 짧게 물어본다:

1. **어떤 문제/요구가 이 결정을 부르고 있나?** (Context)
2. **어떤 선택을 하려고 하는가? 핵심 한 줄.** (Decision)
3. **검토했지만 채택하지 않은 다른 안이 있는가?** (대안 — 없으면 "고려한 대안 없음" 으로 둔다)
4. **이 결정이 코드의 어느 영역을 바꾸는가?** (codePaths 입력 — 4 단계에서 더 다듬는다)

사용자가 한 번에 모두 답하면 그대로 받고, 단답이면 1-2 라운드로 끊어 묻는다. 답을 모르겠다고 하면 추측해 채우지 말고 "이 부분은 비워둔 채 Proposed 로 저장하고, /adr-impl 단계에서 보강할까요?" 로 합의.

### 3. ADR 초안 작성

`${CLAUDE_PLUGIN_ROOT}/skills/adr-manage/SKILL.md` 작성 규칙을 엄격히 따른다.

- 카테고리 디렉토리: `docs/adr/<category>/` (없으면 생성, 플랫 구조 프로젝트면 `docs/adr/` 만 사용).
- 카테고리 내 다음 번호 부여. 파일명: `NNNN-kebab-title.md` (워크숍 등에서 ALPS Feature ID 추적이 필요하면 `NNNN-fN-kebab-title.md`).
- Status 는 항상 `Proposed` (= "결정은 합의됐지만 아직 미구현"). `/adr-impl` 이 구현·테스트 후 `Accepted` 로 자동 전환하므로 이 단계에서 사용자에게 승격 여부를 묻지 않는다.
- 본문 구조: Status / Context / Decision / 대안 검토 / Consequences / Related.
- Decision 은 한 단락 또는 Mermaid 다이어그램 (sequenceDiagram / stateDiagram-v2 / flowchart) 으로 표현 — 비동기·상태 전이가 핵심이면 다이어그램 우선.
- **금지**: 파일 경로 (폴더 단위까지만), 코드 스니펫, 구현 상수, 전체 JSON 응답 예시, 마이그레이션 명령어. 다이어그램 안에서도 동일.

### 4. codePaths 추천 + 확인

`docs/adr/.mapping.json` 의 `codePaths` 는 PreToolUse hook 이 신뢰하는 값이라 정확해야 한다. 비어 있는 채로 저장하지 말고 **추천 후 확인** 으로 진행한다.

추천 절차:

1. 사용자가 2 단계 4 번에서 답한 영역 + ADR Decision 의 키워드(페이지·컴포넌트·서비스명) 를 추출.
2. `Glob`/`Bash ls` 로 프로젝트 디렉토리 구조를 한 번 본다 — `packages/`, `apps/`, `services/`, `src/` 등 source 진입점 확인.
3. 두 정보를 결합해 글롭 후보 2-4 개를 만든다. 예:
   - "결제 흐름" + Express 프로젝트 → `services/payment/**`, `apps/api/src/routes/payment*`
   - "장바구니 합산" + Nuxt 프로젝트 → `packages/web/app/composables/useCart*`, `packages/web/app/pages/cart/**`
4. 후보를 보여주고 "이대로 사용/추가/제거하시겠어요?" 한 번 확인.
5. 사용자가 자연어로 답하면 글롭으로 변환해 저장.

추측 금지:

- 한 번도 코드 베이스를 보지 않은 채 글롭을 만들지 않는다.
- 사용자가 "잘 모르겠다" 면 가장 보수적인 글롭(상위 디렉토리 `**`) 을 두고, 이후 `/adr-sync` 에서 좁히자고 안내.

### 5. 매핑 갱신

`docs/adr/.mapping.json` (스키마: `${CLAUDE_PLUGIN_ROOT}/templates/adr/mapping.schema.json`)

```json
{
  "categories": {
    "<category>": {
      "feature": "<ADR 제목 또는 카테고리를 대표하는 한 줄>",
      "codePaths": ["<4단계에서 확인된 글롭들>"],
      "adrs": ["docs/adr/<category>/NNNN-...md"],
      "tableDocs": ["<DB 변경이 있고 docs/tables/ 또는 schema.prisma 등을 갱신했다면>"],
      "lastSyncedAt": "<ISO timestamp>"
    }
  }
}
```

- 같은 카테고리에 이미 entry 가 있으면 `adrs` 배열에 새 ADR 경로를 push 하고 `codePaths` 는 합집합으로 갱신.
- ALPS PRD 가 함께 있는 프로젝트라면 `alpsDocument`, `alpsFeatureId` 도 채운다 — 없으면 둘 다 생략한다 (필수 필드 아님).

### 6. README 인덱스 갱신

`docs/adr/README.md` 의 "카테고리별 ADR 목록" 에 한 줄 요약을 추가한다 — 이 한 줄이 다음 `/adr-sync --quick` 의 진입점이므로 본문 변경 시 함께 갱신해야 한다.

### 7. 자동 검토 (adr-reviewer 위임)

저장 직전 `adr-reviewer` subagent 를 호출해 격리된 컨텍스트에서 룰 검증을 받는다.

- 입력: 작성된 ADR 파일 경로, 매핑 entry 변경 전/후, (있다면) ALPS Section 7 발췌
- 출력: `PASS` / `FIX_REQUIRED` / `BLOCK` punch list

`PASS` 가 아니면 결과를 사용자에게 요약해 보여주고, `FIX_REQUIRED` 항목은 본 세션에서 직접 패치한다. `BLOCK` 이면 ADR 분리 또는 보조 문서 동시 작업이 필요하므로 8 단계로 가지 말고 3 단계로 돌아간다.

### 8. 사용자 확인

검토를 통과한 ADR 과 매핑을 다음 형식으로 보여주고 승인 요청:

```
## ADR <NNNN>: <제목>

**Decision (요약)**: <2-3문장>
**영향 범위 (codePaths)**: <글롭 목록>
**선행 조건**: <의존 ADR 또는 없음>

이대로 `Proposed`(미구현)로 저장하고 구현(/adr-impl)으로 넘어갈까요? 구현·테스트가 끝나면 `/adr-impl`이 자동으로 `Accepted`로 전환합니다.
```

승인 전까지 코드 수정을 시작하지 않는다. 사용자가 수정을 요청하면 ADR 을 갱신한 뒤 다시 확인.

### 9. 다음 단계 안내

저장 완료 후 한 줄로 다음 단계를 제시한다:

- "`/adr-impl <category>` 로 바로 구현을 이어가시겠어요?" — 일반적인 흐름.
- "이 결정에 더 묶어서 작성할 ADR 이 있다면 같은 카테고리에 한 번 더 `/adr-new <category>` 를 호출하세요."

> **참고**: ALPS Section 7 feature 가 이미 작성돼 있고 그것을 일괄 ADR 로 변환하고 싶다면 `/feature-to-adr` 를 사용하세요. `/adr-new` 는 단일 결정을 그때그때 직접 작성하는 경로입니다.
