---
description: Convert ALPS Section 7 features into ADR drafts under docs/adr/<category>/ and update the ALPS↔ADR mapping.
argument-hint: "[category-or-feature-id?]"
---

ALPS Section 7의 feature를 ADR로 변환합니다. 인자가 주어지면 해당 카테고리/feature만, 없으면 전체 feature를 대상으로 합니다.

## 절차

1. **ALPS 로드**
   - `mcp__alps-writer__load_alps_document`로 현재 문서를 로드한다.
   - `mcp__alps-writer__read_alps_section(7)`로 feature 목록을 읽는다.

2. **카테고리 결정**
   - 각 feature를 kebab-case 카테고리 id로 매핑한다 (예: "User Authentication" → `auth`).
   - `docs/adr/<category>/` 디렉토리가 없으면 생성한다.
   - `docs/adr/README.md`가 없으면 `${CLAUDE_PLUGIN_ROOT}/templates/adr/README.md`를 복사한다.

3. **ADR 초안 작성** — `${CLAUDE_PLUGIN_ROOT}/skills/adr-manage/SKILL.md`의 작성 규칙을 엄격히 따른다.
   - 카테고리 내 다음 번호를 부여한다 (`NNNN-kebab-title.md`).
   - Status는 기본 `Proposed`. 사용자가 합의하면 `Accepted`로 변경.
   - Context는 ALPS의 비즈니스 동기를 풀어 쓰고, Decision은 vertical slice (UI → API → 데이터 흐름)를 한 단락으로 요약한다.
   - **금지**: 파일 경로(폴더 단위까지만), 코드 스니펫, 구현 상수, JSON 응답 예시, 마이그레이션 명령어.

4. **매핑 갱신** — `docs/adr/.mapping.json` (없으면 생성, 스키마: `${CLAUDE_PLUGIN_ROOT}/templates/adr/mapping.schema.json`)

   ```json
   {
     "alpsDocument": "<현재 .alps.xml 경로>",
     "categories": {
       "<category>": {
         "feature": "<feature 이름>",
         "alpsFeatureId": "<있으면 채운다>",
         "codePaths": ["<사용자에게 확인>"],
         "adrs": ["docs/adr/<category>/NNNN-...md"],
         "lastSyncedAt": "<ISO timestamp>"
       }
     }
   }
   ```

   - `codePaths`는 사용자에게 직접 묻는다. 추측하지 말 것 (hook이 이 값을 신뢰함).

5. **README 인덱스 갱신** — `docs/adr/README.md`의 "카테고리별 ADR 목록"에 한 줄 요약을 추가한다.

6. **사용자 확인**: 작성된 ADR과 매핑을 보여주고 승인받기 전까지 코드 수정을 시작하지 않는다.
