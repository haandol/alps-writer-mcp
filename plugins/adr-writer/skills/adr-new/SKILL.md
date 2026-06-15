---
name: adr-new
description: Author a new ADR directly (no ALPS PRD required). Drafts a Proposed ADR, seeds docs/adr/.mapping.json, and updates the README index. Use when the user invokes /adr-new or asks to write an ADR for a fresh decision (refactor, infra choice, new feature direction). Keywords - "/adr-new", "ADR 새로 작성", "ADR 만들어줘", "draft an ADR", "write a new ADR".
argument-hint: "<category> [title?]"
---

# adr-new

ADR 을 직접 작성합니다. ALPS PRD 가 없어도 사용 가능합니다 — 이 plugin 의 정식 ADR 작성 경로이고, `/feature-to-adr` 는 "ALPS Section 7 feature 가 이미 있을 때 자동 변환해주는 helper" 입니다.

> 사용 시점: 새 기능/리팩토링/인프라 결정 등 코드를 바꾸기 전에 의사결정을 남겨야 할 때. 작성한 ADR 은 곧바로 `/adr-impl` 로 이어 구현할 수 있습니다.

## 절차

### 1. 인자 해석

- **`<category>`** (필수) — kebab-case 카테고리 키. 다음 세 형태를 모두 받는다 (`structure.md` "디렉토리 구조" 참조):
  - **단일 세그먼트 context/평면 키** (`identity`, `auth`, `f1`) — 단일-피쳐 context(평면) 또는 context 직속 cross-cutting 결정. 워크숍/번호 기반이면 `f1`, `f-auth-01` 등 ALPS Feature ID 도 그대로 사용.
  - **2-세그먼트 `<context>/<feature>` 키** (`identity/login`, `ordering/checkout`) — bounded context 안의 한 피쳐(vertical slice). context 가 피쳐를 여럿 품을 때 쓴다.

  카테고리 결정 규칙(최상위=bounded context, sub-folder=피쳐, 금지 카테고리, cross-cutting/subdomain 조건)은 `structure.md` "디렉토리 구조" / "흔한 context · subdomain 예시 — 안티패턴 카테고리" 참조. 사용자가 안티패턴 카테고리(`frontend`, `backend`, `api`, `db` 등 — context 폴더든 피쳐 sub-folder 든)를 입력하면 한 번 되묻는다 — "이 결정이 한 피쳐(예: `identity/login`, `ordering/checkout`)에 속하나요? 두 개 이상이 공유하면 system-wide cross-cutting context(`infra`, `data`, `integration`, `security`, `platform`)를 권합니다."

- **`[title]`** (선택) — 명령 인자로 제목을 받으면 그 제목으로 시작. 없으면 사용자에게 한 번 물어본다 ("어떤 결정을 ADR 로 남길까요? 제목 한 줄").

매핑 상태 점검:

- `docs/adr/` 가 없으면 디렉토리를 만든다.
- `docs/adr/README.md` (와 `authoring-rules.md`, `structure.md`) 가 없으면 `${CLAUDE_PLUGIN_ROOT}/templates/adr/` 의 동일 파일 3종을 함께 복사한다.
- `docs/adr/.mapping.json` 이 없으면 빈 골격(`{ "categories": {} }`) 으로 만든다 — `alpsDocument` 필드는 ALPS PRD 가 있을 때만 채운다.

카테고리 비대화 점검 — 카테고리가 정해지면 `structure.md` "context 가 비대해질 때 — 피쳐 sub-folder 로 분할" 의 점검·제안 절차를 따른다. 대상 폴더(피쳐 sub-folder 또는 context 직속)의 ADR 이 15 개 이상이면 피쳐 sub-folder 분할을 한 번 제안하고, 사용자가 받아들이면 이번 ADR 부터 sub-folder(`docs/adr/<context>/<feature>/`) 안에 작성한다 — 평면 키 `pricing` 이 `pricing/<feature>` 로 자라는 정상 경로다. 거절하거나 15 미만이면 평면 구조 그대로 진행 — 다시 묻지 않는다.

### 2. 결정의 동기 청취

ALPS 가 없는 상태에서 ADR 을 잘 쓰려면 다음 정보가 필요하다. 한 번에 하나씩 짧게 물어본다:

1. **어떤 문제/요구가 이 결정을 부르고 있나?** (Context)
2. **이 결정을 변별하는 압력·제약·요구사항은 무엇인가?** (Decision Drivers — 3-5개. "확장성", "유지보수성" 같은 일반 품질 속성이 아니라 옵션 사이의 선택을 실제로 가르는 사실/제약. 작성 규칙은 `authoring-rules.md` "Decision Drivers" 참조). 사용자가 단답이면 "성능·보안·비용·복잡도·팀 역량·일정 중 어떤 것이 이 결정을 좁히고 있나요?" 로 한 번 더 유도
3. **어떤 선택을 하려고 하는가? 핵심 한 줄.** (Decision)
4. **검토했지만 채택하지 않은 다른 안이 있는가? 최소 2개의 현실적 대안을 받는다** (대안 검토 — `authoring-rules.md` "대안 검토 — 최소 2개 이상" 참조. 사용자가 "그냥 이거 한 가지밖에 생각 안 했다" 면 한 번 되묻는다 — "이전에 한 번이라도 검토 테이블에 올랐던 다른 접근이 있나요? 가령 직접 구현 / 외부 서비스 / 다른 라이브러리. 진짜로 외길이라면 ADR 보다는 docstring·README 영역일 수 있어요." 그래도 없다면 BLOCK 으로 자동 검토에서 잡힌다 — 임의로 strawman 을 만들지 않는다)
5. **이 결정보다 먼저 구현돼 있어야 하는 다른 카테고리(선행 조건)가 있는가?** (선행 의존 — 예: "결제는 장바구니가 먼저 동작해야 한다"). 있으면 그 **선행 카테고리 키**를 받는다 (없으면 "없음"). 이 답은 4단계에서 `.mapping.json` 의 `dependsOn` 으로 저장되고 `/adr-impl` 의 선행 게이트가 읽는다 — 7단계 확인 화면의 "선행 조건" 줄도 여기서 나온다. ALPS PRD 가 함께 있는 프로젝트라면 의존성은 `/feature-to-adr` 가 Section 6.3 에서 옮겨오므로 여기서 다시 묻지 않아도 된다.
6. **(선택) 이 결정이 속한 bounded context 와 그 DDD subdomain 분류는?** — 카테고리가 2-세그먼트(`identity/login`)거나 사용자가 도메인 분류를 신경 쓰는 경우에만 가볍게 묻는다 ("이 context 가 제품 경쟁력의 핵심(core)인가요, 떠받치는 보조(supporting)인가요, 기성품으로 대체 가능한 일반(generic)인가요?"). 답하면 4단계에서 context entry 의 `subdomainType` 으로 저장한다. **모르거나 평면 단일-피쳐면 묻지 않고 생략** — advisory 메타데이터이므로 강제하지 않는다.

사용자가 한 번에 모두 답하면 그대로 받고, 단답이면 1-2 라운드로 끊어 묻는다. 답을 모르겠다고 하면 추측해 채우지 말고 "이 부분은 비워둔 채 Proposed 로 저장하고, /adr-impl 단계에서 보강할까요?" 로 합의.

### 3. ADR 초안 작성

`docs/adr/` 의 `README.md`·`authoring-rules.md`·`structure.md`(없으면 `${CLAUDE_PLUGIN_ROOT}/templates/adr/` 동일 파일) 를 엄격히 따른다.

- 카테고리 디렉토리: `docs/adr/<category>/` (없으면 생성, 플랫 구조 프로젝트면 `docs/adr/` 만 사용)
- 카테고리 내 다음 번호 부여. 파일명: `NNNN-kebab-title.md` (워크숍 등에서 ALPS Feature ID 추적이 필요하면 `NNNN-fN-kebab-title.md`)
- **본문 최상단 `Date:` 는 ADR 작성일(`YYYY-MM-DD`)로 채운다** — 작성 시점 기록이며, Status 전환 날짜(`Accepted (YYYY-MM-DD)`)와는 별개다. `Proposed` Status 줄에는 날짜를 붙이지 않는다.
- **Status 는 항상 `Proposed` 로 시작** (`/adr-impl` 이 구현·테스트 후 `Accepted` 로 자동 전환). 사용자에게 승격 여부를 묻지 않는다 — 자동 전환 정책은 `README.md` "자동 전환 규칙" 참조
- 본문 구조: Status / Context / Decision Drivers / Decision / 대안 검토 / Consequences / Related
- **회색지대만 적는다** — 코드 직독으로 알 수 있는 것(함수 책임, 모듈 의존, 필드 타입, 에러 메시지·로그·환경 변수 이름, 의사코드)은 본문에 넣지 않는다. 채택 근거, 비즈니스 규칙의 시스템 번역, 도메인 규칙·상태 전이, 외부 의존 fallback 같은 "코드만 봐서는 안 보이는 결정의 동기" 가 본문의 중심이 되어야 한다 — 상세는 `README.md` "ADR이 다루는 영역 — 비즈니스와 코드 사이의 회색지대" 참조
- **Decision은 vertical slice로 묘사** — 한 단락 또는 sequenceDiagram으로 사용자 동작 → API → 데이터 변형까지 끊김 없이 잇는다. 한 피쳐(leaf — 피쳐 sub-folder 또는 단일-피쳐 context)에서 UI/API/Data 결정을 모두 다루는 것이 정상이며, 레이어별 ADR로 쪼개지 않는다. 비동기·상태 전이가 핵심이면 stateDiagram-v2 / flowchart 사용
- 금지/유지 항목 상세는 `authoring-rules.md` 참조 (다이어그램 내부도 동일하게 적용)

### 4. 매핑 갱신

`docs/adr/.mapping.json` (스키마: `${CLAUDE_PLUGIN_ROOT}/templates/adr/mapping.schema.json`). 매핑은 ALPS feature ↔ ADR 관계만 저장한다 — **ADR ↔ 코드 경로는 저장하지 않는다** (코드는 ADR 을 읽고 그때그때 찾는다).

```json
{
  "categories": {
    "<category>": {
      "feature": "<ADR 제목 또는 카테고리를 대표하는 한 줄>",
      "subdomainType": "<core|supporting|generic — 2단계 6번을 물어 답이 있을 때만>",
      "adrs": ["docs/adr/<category>/NNNN-...md"],
      "dependsOn": ["<선행 카테고리 키>"],
      "tableDocs": ["<DB 변경이 있고 docs/tables/ 또는 schema.prisma 등을 갱신했다면>"]
    }
  }
}
```

- 같은 카테고리에 이미 entry 가 있으면 `adrs` 배열에 새 ADR 경로를 push 한다.
- **`dependsOn`** — 2단계 5번에서 사용자가 선행 조건으로 지목한 카테고리 키들을 배열로 기록한다. `/adr-impl` 의 선행 게이트가 읽는 바로 그 필드이며 같은 카테고리-키 id-space 다. 기존 카테고리 키만 참조하고 비순환(자기 자신 포함 금지)을 유지한다 (스키마: `mapping.schema.json` 의 `dependsOn`). 엣지가 다른 context 의 카테고리를 가리켜도 정상이다. 사용자가 5번에 "없음" 으로 답했다면 `dependsOn` 을 `[]` 로 기록한다 — 빈 배열은 "의존 없음을 명시적으로 점검 완료" 의 뜻이고, `/adr-impl` 이 안내 없이 진행한다. `dependsOn` 을 아예 생략하면 `/adr-impl` 이 "의존 미선언" 으로 보고 한 줄 경고를 띄우므로, 5번을 물어본 `/adr-new` 경로에서는 생략하지 않는다.
- **`subdomainType`** (선택) — 2단계 6번에서 답이 있을 때만 context 수준 entry 에 기록한다 (피쳐 sub-folder entry 는 부모 context 분류를 상속하므로 보통 생략). 평면·미상이면 생략 — advisory 메타데이터라 비워도 매핑은 유효하다.
- ALPS PRD 가 함께 있는 프로젝트라면 `alpsDocument`, `alpsFeatureId` 도 채운다 — 없으면 둘 다 생략한다 (필수 필드 아님). ALPS 가 있는 경우 `dependsOn` 은 보통 `/feature-to-adr` 가 Section 6.3 에서 채우므로, `/adr-new` 단독 호출에서 사용자가 선행을 지목하지 않았다면 비워둔다.

### 5. README 인덱스 갱신

`docs/adr/README.md` 의 "카테고리별 ADR 목록" 에 한 줄 요약을 추가한다 — 이 한 줄이 다음 `/adr-sync --quick` 의 진입점이므로 본문 변경 시 함께 갱신해야 한다.

### 6. 자동 검토 (adr-reviewer 위임)

저장 직전 `adr-reviewer` subagent 를 호출해 격리된 컨텍스트에서 룰 검증을 받는다.

- 입력: 작성된 ADR 파일 경로, 매핑 entry 변경 전/후, (있다면) ALPS Section 7 발췌
- 출력: `PASS` / `FIX_REQUIRED` / `BLOCK` punch list

`PASS` 가 아니면 결과를 사용자에게 요약해 보여주고, `FIX_REQUIRED` 항목은 본 세션에서 직접 패치한다. `BLOCK` 이면 ADR 분리 또는 보조 문서 동시 작업이 필요하므로 7 단계로 가지 말고 3 단계로 돌아간다.

### 7. 사용자 확인

검토를 통과한 ADR 과 매핑을 다음 형식으로 보여주고 승인 요청:

```
## ADR <NNNN>: <제목>

**카테고리**: <category 키 — 예: identity/login (context: identity, subdomain: core)>
**Decision (요약)**: <2-3문장>
**Decision Drivers**: <3-5개 한 줄씩>
**검토 대안**: <옵션 N개 — 채택안 + 미채택안들>
**선행 조건**: <의존 ADR 또는 없음>

이대로 `Proposed`(미구현)로 저장하고 구현(/adr-impl)으로 넘어갈까요? 구현·테스트가 끝나면 `/adr-impl`이 자동으로 `Accepted`로 전환합니다.
```

> context/subdomain 정보는 2단계 6번을 물어 답이 있을 때만 카테고리 줄에 함께 보여준다 — 평면·미상이면 카테고리 키만 적는다.

승인 전까지 코드 수정을 시작하지 않는다. 사용자가 수정을 요청하면 ADR 을 갱신한 뒤 다시 확인.

### 8. 다음 단계 안내

저장 완료 후 한 줄로 다음 단계를 제시한다:

- "`/adr-impl <category>` 로 바로 구현을 이어가시겠어요?" — 일반적인 흐름.
- "이 결정에 더 묶어서 작성할 ADR 이 있다면 같은 카테고리에 한 번 더 `/adr-new <category>` 를 호출하세요."

> **참고**: ALPS Section 7 feature 가 이미 작성돼 있고 그것을 일괄 ADR 로 변환하고 싶다면 `/feature-to-adr` 를 사용하세요. `/adr-new` 는 단일 결정을 그때그때 직접 작성하는 경로입니다.
