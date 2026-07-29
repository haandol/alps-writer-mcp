---
name: adr-new
description: Author a new ADR directly (no ALPS PRD required). Drafts a Proposed ADR and records it in the docs/adr/.mapping.json index (path + Status + Key Decision summary). Use when the user invokes /adr-new or asks to write an ADR for a fresh decision (refactor, infra choice, new feature direction). Keywords - "/adr-new", "ADR 새로 작성", "ADR 만들어줘", "draft an ADR", "write a new ADR".
argument-hint: "<category> [title?]"
---

# adr-new

ADR 을 직접 작성합니다. ALPS PRD 가 없어도 사용 가능합니다 — 이 plugin 의 정식 ADR 작성 경로이고, `/feature-to-adr` 는 "ALPS Section 7 feature 가 이미 있을 때 자동 변환해주는 helper" 입니다.

> 사용 시점: 새 기능·인프라 선택·아키텍처 방향 등 코드를 바꾸기 전에 의사결정을 남겨야 할 때. 작성한 ADR 은 곧바로 `/adr-impl` 로 이어 구현할 수 있습니다.
>
> **리팩토링은 대상이 아닙니다** — 동작을 바꾸지 않는 구조 변경은 코딩 에이전트의 플래닝 기능에 맡기고 ADR 을 만들지 않습니다 (`README.md` "ADR이 아닌 것"). 사용자가 리팩터링을 ADR 로 남기려 하면 한 번 되묻습니다 — "이 변경이 동작이나 결정(채택 대안·상태 전이·키 디자인)을 바꾸나요? 순수 구조 정리라면 ADR 없이 플래닝으로 진행하는 편이 낫습니다." 결정이 바뀌는 경우면 그건 리팩터링이 아니므로 그대로 진행합니다.

## 절차

### 1. 인자 해석

- **`<category>`** (필수) — kebab-case 카테고리 키. 다음 세 형태를 모두 받는다 (`structure.md` "디렉토리 구조" 참조):
  - **단일 세그먼트 context/평면 키** (`identity`, `auth`) — 단일-피쳐 context(평면) 또는 context 직속 cross-cutting 결정. 키는 기능 이름에서 파생한다. feature 이름이 없어 의미 있는 kebab 을 못 뽑는 워크숍/번호 기반 PRD 에서만 `f1`, `f-auth-01` 같은 ALPS Feature ID 를 fallback 키로 쓴다 — 이때도 ID 를 별도 필드로 보존하지 않고, 그저 이번 카테고리 키를 파생하는 데만 쓴다.
  - **2-세그먼트 `<context>/<feature>` 키** (`identity/login`, `ordering/checkout`) — bounded context 안의 한 피쳐(vertical slice). context 가 피쳐를 여럿 품을 때 쓴다.

  카테고리 결정 규칙(최상위=bounded context, sub-folder=피쳐, 금지 카테고리, cross-cutting/subdomain 조건)은 `structure.md` "디렉토리 구조" / "안티패턴 카테고리" 참조. 사용자가 안티패턴 카테고리(`frontend`, `backend`, `api`, `db` 등 — context 폴더든 피쳐 sub-folder 든)를 입력하면 한 번 되묻는다 — "이 결정이 한 피쳐(예: `identity/login`, `ordering/checkout`)에 속하나요? 두 개 이상이 공유하면 system-wide cross-cutting context(`infra`, `data`, `integration`, `security`, `platform`)를 권합니다."

- **`[title]`** (선택) — 명령 인자로 제목을 받으면 그 제목으로 시작. 없으면 사용자에게 한 번 물어본다 ("어떤 결정을 ADR 로 남길까요? 제목 한 줄").

매핑 상태 점검:

- `docs/adr/` 가 없으면 디렉토리를 만든다.
- `docs/adr/README.md` (와 `authoring-rules.md`, `structure.md`, `decision-log.template.md`) 가 없으면 `${CLAUDE_PLUGIN_ROOT}/templates/adr/` 의 동일 파일 4종을 함께 복사한다. `decision-log.template.md` 는 **읽기용 시드**다 — 카테고리에 첫 major 결정 변경이 생길 때 `docs/adr/<category>/decision-log.md` 로 복사해 쓰며, 지금 카테고리 폴더에 미리 만들어 두지 않는다 (로그는 남길 전환이 생긴 뒤에만 존재한다).
- `docs/adr/.mapping.json` 이 없으면 빈 골격(`{ "categories": {} }`) 으로 만든다.

카테고리 비대화 점검 — 카테고리가 정해지면 `structure.md` "context 가 비대해질 때 — 피쳐 sub-folder 로 분할" 의 점검·제안 절차를 따른다. 대상 폴더(피쳐 sub-folder 또는 context 직속)의 ADR 이 15 개 이상이면 피쳐 sub-folder 분할을 한 번 제안하고, 사용자가 받아들이면 이번 ADR 부터 sub-folder(`docs/adr/<context>/<feature>/`) 안에 작성한다 — 평면 키 `pricing` 이 `pricing/<feature>` 로 자라는 정상 경로다. 거절하거나 15 미만이면 평면 구조 그대로 진행 — 다시 묻지 않는다.

### 2. 결정의 동기 청취

ALPS 가 없는 상태에서 ADR 을 잘 쓰려면 다음 정보가 필요하다. 한 번에 하나씩 짧게 물어본다:

1. **어떤 문제/요구가 이 결정을 부르고 있나?** (Context)
2. **이 결정을 변별하는 압력·제약·요구사항은 무엇인가?** (Decision Drivers — 3-5개. "확장성", "유지보수성" 같은 일반 품질 속성이 아니라 옵션 사이의 선택을 실제로 가르는 사실/제약. 작성 규칙은 `authoring-rules.md` "Decision Drivers" 참조). 사용자가 단답이면 "성능·보안·비용·복잡도·팀 역량·일정 중 어떤 것이 이 결정을 좁히고 있나요?" 로 한 번 더 유도
3. **어떤 선택을 하려고 하는가? 핵심 한 줄.** (Decision)
   - **결과물이 지켜야 하는 값·계약도 함께 받는다** (요구사항 계약 — `authoring-rules.md` "구체적인 숫자"). 사용자가 먼저 말하지 않아도 **반드시 한 번 묻는다**: "이 기능에서 개발자가 임의로 정하면 안 되는 값이나 규칙이 있나요? 예를 들어 최대 횟수·턴 수, 사용량 한도, 보존 기간, 크기 상한, 응답 목표 시간, 권한 규칙 같은 것." 받은 값은 **숫자와 근거(정책·계약·규정)를 그대로** ADR 에 옮긴다. 판정 질문은 "개발자가 이 값을 바꾸면 요구사항 위반인가?" — YES 면 요구사항 값이라 반드시 적고, NO 면 구현 튜닝값이라 적지 않는다. 사용자가 "적당히 알아서" 라고 답한 항목은 튜닝값으로 분류해 ADR 에서 뺀다 — **임의로 숫자를 만들어 요구사항처럼 적지 않는다.**

4. **검토했지만 채택하지 않은 다른 안이 있는가? 최소 2개의 현실적 대안을 받는다** (대안 검토 — `authoring-rules.md` "대안 검토 — 최소 2개 이상" 참조. 사용자가 "그냥 이거 한 가지밖에 생각 안 했다" 면 한 번 되묻는다 — "이전에 한 번이라도 검토 테이블에 올랐던 다른 접근이 있나요? 가령 직접 구현 / 외부 서비스 / 다른 라이브러리. 진짜로 외길이라면 ADR 보다는 docstring·README 영역일 수 있어요." 그래도 없다면 BLOCK 으로 자동 검토에서 잡힌다 — 임의로 strawman 을 만들지 않는다)
5. **이 결정보다 먼저 구현돼 있어야 하는 다른 카테고리(선행 조건)가 있는가?** (선행 의존 — 예: "결제는 장바구니가 먼저 동작해야 한다"). 있으면 그 **선행 카테고리 키**를 받는다 (없으면 "없음"). 이 답은 4단계에서 `.mapping.json` 의 `dependsOn` 으로 저장되고 `/adr-impl` 의 선행 게이트가 읽는다 — 7단계 확인 화면의 "선행 조건" 줄도 여기서 나온다. ALPS PRD 가 함께 있는 프로젝트라면 의존성은 `/feature-to-adr` 가 Section 6.3 에서 옮겨오므로 여기서 다시 묻지 않아도 된다.
6. **(선택) 이 결정이 속한 bounded context 와 그 DDD subdomain 분류는?** — 카테고리가 2-세그먼트(`identity/login`)거나 사용자가 도메인 분류를 신경 쓰는 경우에만 가볍게 묻는다 ("이 context 가 제품 경쟁력의 핵심(core)인가요, 떠받치는 보조(supporting)인가요, 기성품으로 대체 가능한 일반(generic)인가요?"). 답하면 4단계에서 context entry 의 `subdomainType` 으로 저장한다. **모르거나 평면 단일-피쳐면 묻지 않고 생략** — advisory 메타데이터이므로 강제하지 않는다.

사용자가 한 번에 모두 답하면 그대로 받고, 단답이면 1-2 라운드로 끊어 묻는다. 답을 모르겠다고 하면 추측해 채우지 말고 "이 부분은 비워둔 채 Proposed 로 저장하고, /adr-impl 단계에서 보강할까요?" 로 합의.

### 3. ADR 초안 작성

`docs/adr/` 의 `README.md`·`authoring-rules.md`·`structure.md`(없으면 `${CLAUDE_PLUGIN_ROOT}/templates/adr/` 동일 파일) 를 엄격히 따른다.

- 카테고리 디렉토리: `docs/adr/<category>/` (없으면 생성, 플랫 구조 프로젝트면 `docs/adr/` 만 사용)
- 카테고리 내 다음 번호 부여. 파일명: `NNNN-kebab-title.md` — 언제나 canonical 형태로 둔다. **ALPS Feature ID 는 파일명에 넣지 않는다** (`0001-f1-...` 처럼 붙이지 않는다) — Feature ID 는 어디에도 저장하지 않으며, `/adr-impl` 은 카테고리 키로 대상을 매칭한다.
- **본문 최상단 `Date:` 는 ADR 작성일(`YYYY-MM-DD`)로 채운다** — 작성 시점 기록이며, Status 전환 날짜(`Accepted (YYYY-MM-DD)`)와는 별개다. `Proposed` Status 줄에는 날짜를 붙이지 않는다.
- **Status 는 항상 `Proposed` 로 시작** (`/adr-impl` 이 구현·테스트 후 `Accepted` 로 자동 전환). 사용자에게 승격 여부를 묻지 않는다 — 자동 전환 정책은 `README.md` "자동 전환 규칙" 참조
- 본문 구조: Status / Context / Decision Drivers / Decision / 대안 검토 / Consequences / (선택) Implementation Notes / Related. **필수 섹션은 Status·Context·Decision·Consequences** 네 개이며, `adr-structure-lint` 가 이 넷의 존재를 하드 체크한다. Decision Drivers·대안 검토는 강력 권장(누락 시 경고), Implementation Notes 는 아키텍처 수준 구현 고려사항이 있을 때만 두는 선택 섹션이다 (README `## ADR 템플릿` 과 동일).
- **회색지대만 적는다** — 코드 직독으로 알 수 있고 요구사항도 아닌 것(함수 책임, 모듈 의존, 필드 타입, 에러 메시지 문구·로그·환경 변수 이름, 의사코드, 구현 튜닝값)은 본문에 넣지 않는다. 채택 근거, 비즈니스 규칙의 시스템 번역, 도메인 규칙·상태 전이, 외부 의존 fallback 같은 "코드만 봐서는 안 보이는 결정의 동기" 가 본문의 중심이 되어야 한다 — 상세는 `README.md` "ADR이 다루는 영역 — 비즈니스와 코드 사이의 회색지대" 참조
- **요구사항 값은 값 그대로 적는다** — 2단계에서 받은 한도·주기·상한·목표치를 `Decision` 의 요구사항 계약(README 템플릿의 `### 요구사항 계약`)에 숫자와 근거로 남긴다. "제한된다", "적절한 시간 내" 로 뭉개지 않고, 동시에 상수 이름·환경 변수 이름으로 적지도 않는다 (`MAX_TURNS = 20` ✗ / "채팅 한 세션은 최대 20턴 — 요금제 정책" ✓). 상세 판정은 `authoring-rules.md` "구체적인 숫자" 참조
- **재생성 테스트를 스스로 한 번 통과시킨다** — 초안을 다 쓴 뒤 "이 코드가 전부 지워지고 이 ADR 만 남으면, 이것만 읽고 요구사항을 지키는 코드를 다시 만들 수 있는가" 를 묻는다. 구현 방법이 달라지는 건 정상이지만, 지켜야 하는 계약(요구사항 값·권한 규칙·필수 검증·상태 전이·실패 시 보장 동작)이 빠졌으면 그 자리에서 사용자에게 되묻고 채운다 — 6단계 reviewer 의 R19 가 같은 것을 다시 본다
- **Decision은 vertical slice로 묘사** — 한 단락 또는 sequenceDiagram으로 사용자 동작 → API → 데이터 변형까지 끊김 없이 잇는다. 한 피쳐(leaf — 피쳐 sub-folder 또는 단일-피쳐 context)에서 UI/API/Data 결정을 모두 다루는 것이 정상이며, 레이어별 ADR로 쪼개지 않는다. 비동기·상태 전이가 핵심이면 stateDiagram-v2 / flowchart 사용
- 금지/유지 항목 상세는 `authoring-rules.md` 참조 (다이어그램 내부도 동일하게 적용)

### 4. 매핑 갱신

`docs/adr/.mapping.json` (스키마: `${CLAUDE_PLUGIN_ROOT}/templates/adr/mapping.schema.json`). 매핑은 **단일 ADR 인덱스**다 — 각 ADR 을 path·Status·요약 한 줄로 한 번씩 등재한다. **ADR ↔ 코드 경로는 저장하지 않고**(코드는 ADR 을 읽고 그때그때 찾는다), **PRD 참조도 저장하지 않는다**(adr-writer 는 standalone).

```json
{
  "categories": {
    "<category>": {
      "feature": "<ADR 제목 또는 카테고리를 대표하는 한 줄>",
      "subdomainType": "<core|supporting|generic — 2단계 6번을 물어 답이 있을 때만>",
      "adrs": [
        {
          "path": "docs/adr/<category>/NNNN-...md",
          "status": "Proposed",
          "summary": "<Key Decision 한 줄 요약>"
        }
      ],
      "dependsOn": ["<선행 카테고리 키>"],
      "tableDocs": ["<DB 변경이 있고 docs/tables/ 또는 schema.prisma 등을 갱신했다면>"]
    }
  }
}
```

- `adrs` 항목은 문자열이 아니라 `{ "path", "status", "summary" }` **객체**다. `path` 는 repo 기준 상대 경로, `status` 는 방금 쓴 ADR 본문 `## Status` 를 그대로 미러링하므로 새 ADR 은 언제나 `"Proposed"` 로 시작한다, `summary` 는 Decision 을 압축한 한 줄(Key Decision). 이 레코드가 곧 ADR 인덱스 항목이다 (자세한 인덱스 역할은 5단계).
- 같은 카테고리에 이미 entry 가 있으면 `adrs` 배열에 새 레코드 객체를 push 한다.
- **`dependsOn`** — 2단계 5번에서 사용자가 선행 조건으로 지목한 카테고리 키들을 배열로 기록한다. `/adr-impl` 의 선행 게이트가 읽는 바로 그 필드이며 같은 카테고리-키 id-space 다. 기존 카테고리 키만 참조하고 비순환(자기 자신 포함 금지)을 유지한다 (스키마: `mapping.schema.json` 의 `dependsOn`). 엣지가 다른 context 의 카테고리를 가리켜도 정상이다. 사용자가 5번에 "없음" 으로 답했다면 `dependsOn` 을 `[]` 로 기록한다 — 빈 배열은 "의존 없음을 명시적으로 점검 완료" 의 뜻이고, `/adr-impl` 이 안내 없이 진행한다. `dependsOn` 을 아예 생략하면 `/adr-impl` 이 "의존 미선언" 으로 보고 한 줄 경고를 띄우므로, 5번을 물어본 `/adr-new` 경로에서는 생략하지 않는다.
- **`subdomainType`** (선택) — 2단계 6번에서 답이 있을 때만 context 수준 entry 에 기록한다 (피쳐 sub-folder entry 는 부모 context 분류를 상속하므로 보통 생략). 평면·미상이면 생략 — advisory 메타데이터라 비워도 매핑은 유효하다.
- adr-writer 는 PRD 링크를 저장하지 않는다 — 이 ADR 이 ALPS import 에서 왔더라도 `feature` 는 그저 사람이 읽는 라벨일 뿐 PRD 역참조가 아니다. import 된 카테고리라면 `dependsOn` 은 보통 `/feature-to-adr` 가 Section 6.3 에서 채운다. 그래도 `/adr-new` 단독 호출에서 2단계 5번을 물었다면, 사용자가 선행을 지목하지 않았더라도 위 규칙대로 **`dependsOn` 을 `[]` 로 기록한다 — 키를 생략하지 않는다** (생략하면 `/adr-impl` 이 "의존 미선언" 경고를 띄운다). `[]` 와 키 생략을 같게 취급하지 않는 건 `/adr-impl` 선행 게이트의 "의존 없음(점검 완료)" vs "미선언(경고)" 분기와 직접 맞물린다.

### 5. 인덱스 갱신

ADR 인덱스는 `docs/adr/.mapping.json` 이다 — README 는 더 이상 ADR 목록을 들고 있지 않다. 4단계에서 push 한 `adrs[]` 레코드(path + `status:"Proposed"` + summary)가 곧 인덱스 항목이며, 이 레코드의 `summary` 가 다음 `/adr-sync --quick` 의 진입점이고 UserPromptSubmit 훅이 매 턴 렌더링하는 인덱스 한 줄이다. 즉 별도 편집 없이 4단계에서 이미 인덱스가 갱신된 것이므로, 여기서는 (a) `summary` 한 줄이 Decision 을 정확히 압축하는지, (b) `status` 가 본문 `## Status`(=`Proposed`)와 일치하는지를 확정만 하면 된다 (4단계 참조). README 는 개념 인덱스(ADR 이 무엇인지·회색지대·의존 모델·템플릿) 로만 남으므로 여기서 건드리지 않는다.

### 6. 자동 검토 — 결정론적 하네스 먼저, 그 다음 adr-reviewer

저장 직전 두 단계로 검증한다. **먼저 결정론적 하네스**로 기계적 규칙을 걸러낸 뒤, **판단이 필요한 룰만 adr-reviewer** 에 넘긴다 — LLM 검토가 파일명·Status enum·섹션 존재 같은 뻔한 것에 토큰을 쓰지 않도록.

**(a) 결정론적 하네스 — `adr-structure-lint`**:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-structure-lint.mjs <이번에 작성한 ADR 의 카테고리 키>
```

이 하네스는 이번 ADR 이 사는 `docs/adr/` 를 파싱해 다음을 기계적으로 검증한다 (근거: `authoring-rules.md`·`README.md`·`structure.md`):

- Status enum·날짜 형식(R1 앞부분), 필수 섹션(Status/Context/Decision/Consequences) 존재, 파일명 canonical(`NNNN-kebab.md`, stale `fN-` 접두사 금지), 제목번호=파일명번호, 경로 깊이 ≤2 세그먼트
- 안티패턴 카테고리 세그먼트(R5 앞부분), Decision Drivers 3-5개(R13), 대안 ≥2개(R14), Related 링크 실재(R10), 값이 코드 상수 형태로 적혔는지(R18 형식 절반 — `value-as-constant` warning)
- `.mapping.json` 스키마·`dependsOn` 무결성(dangling/self-edge/순환 — R16), 매핑 ↔ 디스크 정합(R8) + 매핑 `adrs` 레코드(path/status/summary) 형식·status↔본문 정합
- 내부적으로 `adr-invariants.sh` 를 호출해 코드→ADR·ADR→PRD 역참조(R15/R17)도 함께 본다

`error` 가 있으면 저장(7단계)으로 가기 전에 본 세션에서 고친다 (대개 ADR 본문·매핑 편집으로 해결). `warning`(대안/드라이버 개수, 코드참조 의심 등)은 adr-reviewer 판단과 함께 다룬다.

**(b) adr-reviewer 위임 — 판단이 필요한 룰**: 하네스가 통과(또는 warning 만)하면 reviewer subagent 를 다음 순서로 실행한다.

1. 현재 클라이언트가 `adr-reviewer` named subagent 를 발견할 수 있으면 그것을 호출한다.
2. named subagent 가 없으면 `${CLAUDE_PLUGIN_ROOT}/agents/adr-reviewer.md` 를 읽고, 그 전문을 reviewer 지침으로 전달한 **일반 read-only subagent** 하나를 실행한다. Codex 플러그인은 `agents/*.md`를 컴포넌트로 등록하지 않으므로 이 fallback이 기본 경로다.
3. subagent 기능 자체를 사용할 수 없는 클라이언트에서만 메인 세션이 같은 reviewer 지침을 직접 수행하고, 격리 검토를 사용할 수 없었다고 결과에 한 줄 밝힌다.

reviewer 는 하네스가 못 잡는 **판단 룰에 집중**한다 — 요구사항 관문/코드 직독/리트머스 필터(R4), 회색지대 충실도(R12), 대안이 strawman 인지(R14 질), Decision Drivers 가 의견이 아닌 변별 사실인지(R13 질), 구현 세부 침투(R3), vertical slice 응집(R5 뒷부분), **요구사항 값 누락·튜닝값 침투(R18)**, **재생성 테스트(R19 — 코드가 지워져도 ADR 만으로 요구사항을 지키는 코드를 만들 수 있는가)**. 하네스는 맨숫자를 보지 않으므로 요구사항 값이 빠졌는지는 reviewer 만 잡는다.

- 입력: 작성된 ADR 파일 경로, 매핑 entry 변경 전/후, (있다면) ALPS Section 7 발췌, **하네스 결과 요약(통과/남은 warning)**
- 출력: `PASS` / `FIX_REQUIRED` / `BLOCK` punch list

`PASS` 가 아니면 결과를 사용자에게 요약해 보여주고, `FIX_REQUIRED` 항목은 본 세션에서 직접 패치한다. `BLOCK` 이면 ADR 분리 또는 보조 문서 동시 작업이 필요하므로 7 단계로 가지 말고 3 단계로 돌아간다.

### 7. 사용자 확인

검토를 통과한 ADR 과 매핑을 다음 형식으로 보여주고 승인 요청:

```
## ADR <NNNN>: <제목>

**카테고리**: <category 키 — 예: identity/login (context: identity, subdomain: core)>
**Decision (요약)**: <2-3문장>
**Decision Drivers**: <3-5개 한 줄씩>
**요구사항 계약**: <결과물이 지켜야 하는 값·규칙 — 값과 근거를 그대로. 없으면 "없음">
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
