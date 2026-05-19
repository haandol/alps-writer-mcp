---
description: Convert an ALPS Section 7 feature into a Proposed ADR draft and seed docs/adr/.mapping.json. Used as the entry step of /adr-cycle.
argument-hint: "[category-or-feature-id?]"
---

ALPS Section 7의 feature를 ADR 초안으로 변환합니다. 인자가 있으면 해당 feature만, 없으면 ALPS Section 7 전체에서 다음에 다룰 후보를 사용자에게 한 번 확인한 뒤 진행합니다.

## 절차

### 1. ALPS 로드

- `mcp__alps-writer__load_alps_document`로 현재 문서를 로드.
- `mcp__alps-writer__read_alps_section(7)`로 feature 목록 추출.
- ALPS 문서가 없으면 사용자에게 알리고 `mcp__alps-writer__init_alps_document` 또는 `/alps-init`을 권유한 뒤 중단.

### 2. 카테고리 결정

- 각 feature를 kebab-case 카테고리 id로 매핑 (예: "User Authentication" → `auth`, "Email Sign Up" → `email-signup` 또는 워크숍 컨벤션이면 `f1`).
- 워크숍 등 플랫 구조 프로젝트는 `f1`, `f2` 같은 Feature ID 자체를 카테고리 키로 써도 된다.
- `docs/adr/<category>/` 디렉토리를 생성한다 (플랫 구조면 `docs/adr/`만 사용).
- `docs/adr/README.md`가 없으면 `${CLAUDE_PLUGIN_ROOT}/templates/adr/README.md`를 복사한다.

### 3. ADR 초안 작성

`${CLAUDE_PLUGIN_ROOT}/skills/adr-manage/SKILL.md` 작성 규칙을 엄격히 따른다.

- 카테고리 내 다음 번호 부여. 파일명: `NNNN-kebab-title.md` (워크숍은 `NNNN-fN-kebab-title.md`).
- Status는 기본 `Proposed`. 사용자 합의 후 `Accepted`로 전환.
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

### 7. 사용자 확인

작성된 ADR과 매핑을 보여주고 다음 형식으로 승인 요청:

```
## ADR <NNNN>: <제목>

**Decision (요약)**: <2-3문장>
**영향 범위 (codePaths)**: <글롭 목록>
**선행 조건**: <의존 ADR 또는 없음>

이대로 `Proposed`로 저장하고 구현(/adr-impl)으로 넘어갈까요?
```

승인 전까지 코드 수정을 시작하지 않는다. 사용자가 수정을 요청하면 ADR을 갱신한 뒤 다시 확인.

### 8. opt-out 처리

사용자가 "ADR 없이 바로 구현해줘", "임시로 빨리", "hotfix" 등을 명시하면:

- 리스크(검토 부담↓·드리프트↑)를 한 줄로 안내한다.
- 그래도 진행을 원하면 최소 ADR(Status: `Proposed`, Decision 1문단, codePaths만)이라도 작성한 뒤 코드로 넘어가자고 권유한다.
- 사용자가 끝까지 거부하면 따른다. 단 다음 `/adr-sync` 시점에 ADR을 채울 deferred 항목으로 기록한다.
