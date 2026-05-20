---
description: Convert ALPS Section 7 feature(s) into Proposed ADR drafts and seed docs/adr/.mapping.json.
argument-hint: "[category-or-feature-id?]"
---

ALPS Section 7의 feature를 ADR 초안으로 변환합니다. 인자가 있으면 **해당 feature 한 개만** 처리하고, 인자가 없으면 **Section 7 전체 feature를 순차적으로 모두** ADR로 변환합니다.

## 절차

### 1. ALPS 로드 및 처리 대상 결정

- `mcp__alps-writer__load_alps_document`로 현재 문서를 로드.
- `mcp__alps-writer__read_alps_section(7)`로 feature 목록 추출.
- ALPS 문서가 없으면 사용자에게 알리고 `mcp__alps-writer__init_alps_document` 또는 `/alps-init`을 권유한 뒤 중단.

처리 대상 결정:

- **인자가 있는 경우**: 해당 카테고리/피쳐 ID에 매칭되는 feature 1개만 큐에 넣는다.
- **인자가 없는 경우**: Section 7 의 **모든 feature** 를 ALPS 에 등장한 순서대로 큐에 넣는다. 단 `docs/adr/.mapping.json` 에 이미 ADR 이 매핑된 feature 는 큐에서 제외한다 (재실행 시 중복 방지).
- 큐가 비어 있으면 "변환할 신규 feature 가 없습니다" 메시지를 띄우고 종료.
- 큐에 2개 이상이 들어 있으면 사용자에게 처리 순서를 한 번 보여주고 "이 순서로 모든 피쳐를 ADR 로 변환하겠습니다. 진행할까요?" 한 번만 확인. 이후 각 피쳐는 8단계 승인 시점에서만 멈춘다.

> 아래 2~8단계는 큐의 각 feature 에 대해 **순차적으로 한 번씩 반복**한다. 한 피쳐의 8단계 승인이 완료된 뒤에야 다음 피쳐의 2단계로 넘어간다.

### 2. 카테고리 결정

카테고리 키 결정 규칙은 **ALPS Section 7 의 feature 에 명시적 ID 가 있는지** 로 갈린다.

- **명시적 Feature ID 가 있는 경우 (워크숍·번호 기반 PRD 등 — 예: `F1`, `F-AUTH-01`)** — 그 ID 를 소문자 kebab-case 로 변환한 값을 카테고리 키로 **고정 사용** 한다 (`F1` → `f1`, `F-AUTH-01` → `f-auth-01`). 사용자가 `/adr-impl f1` 처럼 ALPS feature ID 그대로 호출할 수 있어야 하므로 의미 기반 이름(`auth` 등)으로 대체하지 않는다.
- **명시적 ID 가 없는 일반 PRD** — feature 이름을 kebab-case 로 변환해 의미 있는 카테고리 id 를 만든다 (예: "User Authentication" → `auth`, "Email Sign Up" → `email-signup`).

이어서:

- `docs/adr/<category>/` 디렉토리를 생성한다 (플랫 구조면 `docs/adr/`만 사용).
- `docs/adr/README.md`가 없으면 `${CLAUDE_PLUGIN_ROOT}/templates/adr/README.md`를 복사한다.

### 3. ADR 초안 작성

`${CLAUDE_PLUGIN_ROOT}/skills/adr-manage/SKILL.md` 작성 규칙을 엄격히 따른다.

- 카테고리 내 다음 번호 부여. 파일명: `NNNN-kebab-title.md` (워크숍은 `NNNN-fN-kebab-title.md`).
- Status는 항상 `Proposed`로 저장한다 — `Proposed`는 "ADR이 제안되었으나 미구현"을 의미한다. 구현이 끝나면 `/adr-impl`이 `Accepted`로 자동 전환하므로 이 단계에서는 사용자에게 승격 여부를 묻지 않는다.
- Context: ALPS의 비즈니스 동기·user story·acceptance criteria의 핵심을 1-3문단.
- Decision: vertical slice (UI → API → 데이터 흐름)를 한 단락 또는 mermaid sequenceDiagram으로.
- 대안 검토: 검토했으나 채택하지 않은 접근과 그 이유.
- Consequences: 긍정/부정/Risk.
- **금지**: 파일 경로(폴더 단위까지만), 코드 스니펫, 구현 상수, 전체 JSON 응답 예시, 마이그레이션 명령어.

### 4. codePaths 추천 + 확인

`docs/adr/.mapping.json`의 `codePaths`는 PreToolUse hook이 신뢰하는 값이라 정확해야 한다. 비기술 사용자에게 빈 입력을 받지 말고 **추천 후 확인** 패턴으로 진행한다.

추천 절차:

1. ALPS Section 7의 user flow / technical description에서 등장하는 페이지·컴포넌트 단어를 추출 (예: "로그인", "이메일 입력", "프로필").
2. 프로젝트의 디렉토리 구조를 살핀다 — `packages/web/app/pages/`, `apps/web/src/components/`, `services/<domain>/` 등 source 진입점을 파악.
3. 두 정보를 결합해 글롭 후보 2-4개를 만든다. 예:
   - "이메일 가입" + Nuxt 프로젝트 → `packages/web/app/pages/sign*/**`, `packages/web/app/composables/useAuth*`
   - "결제 API" + Express 프로젝트 → `services/payment/**`, `apps/api/src/routes/payment*`
4. 후보를 사용자에게 보여주고 "이대로 사용/추가/제거하시겠어요?" 한 번 확인.
5. 사용자가 자연어로 답하면 글롭으로 변환해 매핑에 저장.

추측 금지 항목:

- 코드 베이스를 한 번도 보지 않은 채 글롭을 만들지 않는다 (`Glob`/`Bash ls`로 실제 디렉토리를 확인).
- 사용자가 "잘 모르겠다"고 하면 가장 보수적인 글롭(상위 디렉토리 `**`)을 두고, 첫 사이클 끝에 `/adr-sync`에서 좁히도록 안내.

### 5. 매핑 갱신

`docs/adr/.mapping.json` (없으면 생성, 스키마: `${CLAUDE_PLUGIN_ROOT}/templates/adr/mapping.schema.json`)

```json
{
  "alpsDocument": "<현재 .alps.xml 경로>",
  "categories": {
    "<category>": {
      "feature": "<feature 이름>",
      "alpsFeatureId": "<있으면>",
      "codePaths": ["<4단계에서 확인된 글롭들>"],
      "adrs": ["docs/adr/<category>/NNNN-...md"],
      "tableDocs": ["<DB 변경이 있고 docs/tables 또는 schema.prisma 등을 갱신했다면>"],
      "lastSyncedAt": "<ISO timestamp>"
    }
  }
}
```

### 6. README 인덱스 갱신

`docs/adr/README.md`의 "카테고리별 ADR 목록"에 한 줄 요약을 추가한다.

### 7. 자동 검토 (adr-reviewer 위임)

저장 직전, `adr-reviewer` subagent 를 호출하여 격리된 컨텍스트에서 룰 검증을 받는다.

- 입력: 작성된 ADR 파일 경로, 매핑 entry 변경 전/후, ALPS Section 7 발췌
- 출력: `PASS` / `FIX_REQUIRED` / `BLOCK` punch list

`PASS` 가 아니면 결과를 사용자에게 요약해 보여주고, `FIX_REQUIRED` 항목은 본 세션에서 직접 패치한다. `BLOCK` 이면 ADR 분리 또는 보조 문서 동시 작업이 필요하므로 8단계로 가지 말고 3단계로 돌아간다.

### 8. 사용자 확인

검토를 통과한 ADR과 매핑을 보여주고 다음 형식으로 승인 요청:

```
## ADR <NNNN>: <제목>

**Decision (요약)**: <2-3문장>
**영향 범위 (codePaths)**: <글롭 목록>
**선행 조건**: <의존 ADR 또는 없음>

이대로 `Proposed`(미구현)로 저장하고 구현(/adr-impl)으로 넘어갈까요? 구현·테스트가 끝나면 `/adr-impl`이 자동으로 `Accepted`로 전환합니다.
```

승인 전까지 코드 수정을 시작하지 않는다. 사용자가 수정을 요청하면 ADR을 갱신한 뒤 다시 확인.

큐에 다음 feature 가 남아 있으면, 승인 직후 "다음 피쳐(`<이름>`)로 계속 진행합니다" 한 줄을 출력하고 2단계로 돌아간다. 큐가 비면 전체 변환 결과 요약(생성된 ADR 목록)을 보여주고 종료.

### 9. opt-out 처리

사용자가 "ADR 없이 바로 구현해줘", "임시로 빨리", "hotfix" 등을 명시하면:

- 리스크(검토 부담↓·드리프트↑)를 한 줄로 안내한다.
- 그래도 진행을 원하면 최소 ADR(Status: `Proposed`, Decision 1문단, codePaths만)이라도 작성한 뒤 코드로 넘어가자고 권유한다.
- 사용자가 끝까지 거부하면 따른다. 단 다음 `/adr-sync` 시점에 ADR을 채울 deferred 항목으로 기록한다.
