---
name: adr-impl-review
description: Review code that was just implemented from an ADR — verify the ADR's business + technical decisions were actually honored in the code, that the code and structure follow best-practice patterns (project conventions first), and surface refactoring opportunities. Report-only (never edits code or the ADR); delegates to a reviewer subagent, using the named adr-impl-reviewer when available and a generic read-only subagent otherwise. Use right after /adr-impl, or when the user invokes /adr-impl-review or asks whether a freshly implemented feature matches its ADR. Keywords - "/adr-impl-review", "ADR 구현 검토", "구현이 ADR 대로 됐는지", "결정 충실도 리뷰", "post-implementation review".
argument-hint: "[adr-path-or-category]"
disable-model-invocation: true
---

# adr-impl-review

`/adr-impl` 로 구현이 끝난 코드가 **그것을 낳은 ADR 의 결정을 실제로 지켰는지**를 검토한다. 세 가지를 본다:

1. **비즈니스·기술 요구 충족** — ADR 이 정한 회색지대 결정(도메인 규칙·상태 전이·fallback·키 디자인)과 기술 구조(API·DB 키·연동)가 코드에 그대로 나타나는가.
2. **베스트 프랙티스 패턴** — 코드와 구조가 프로젝트 규약(1차)·언어/프레임워크 일반 패턴(2차)을 따르는가.
3. **리팩토링 기회** — 결정을 바꾸지 않고 개선할 곳.

이 명령은 **보고만 한다** — 코드도 ADR 도 고치지 않는다. 실제 검토는 격리 컨텍스트의 `adr-impl-reviewer` subagent 에 위임하고, 메인 세션은 짧은 punch list 만 받아 사용자에게 요약한다.

> **사이클에서의 위치**: `/adr-impl` (구현 + Status 승격) → **`/adr-impl-review` (결정 충실도 검토)** → 필요 시 `/adr-sync` (구현 사실 drift 정정). `/adr-sync` 는 코드를 권위로 보고 ADR 을 고치지만, 이 명령은 구현 직후라 **ADR 을 스펙**으로 삼아 코드가 그것을 따랐는지 본다 — 방향이 반대다.

## 다른 검토 도구와의 경계

혼동하기 쉬우므로 분명히 한다:

- **`adr-reviewer`** (subagent, `/adr-new` 가 호출) — ADR **문서 품질**을 구현 **전에** 본다 (작성 규칙 R1–R16). 이 명령은 그것을 재검토하지 않는다. 단 R17(코드→ADR 역참조)은 문서가 아니라 코드를 보는 룰이라, 코드가 막 생긴 이 시점의 subagent D6 이 점검한다.
- **`/adr-sync`** — 코드를 권위로, ADR 의 **구현 사실 drift** 를 정정한다 (ADR 을 고침). 이 명령이 `[Impl-fact mismatch]` 를 찾으면 sync 로 라우팅한다.
- **`/code-review`** (built-in) — ADR 과 무관한 diff 전역 버그 사냥. 이 명령은 **이 ADR 이 다스리는 코드 범위**에 한정한다.
- **`/adr-impl-review`** (이 명령) — ADR 을 스펙으로, **코드가 결정을 지켰는지** 구현 **후에** 본다. 코드 개선을 지시하되 직접 고치지 않는다.

## 절차

### 1. 대상 ADR 식별

인자 해석은 `/adr-impl` 1단계와 같은 규칙을 따른다 (파일 경로 / 카테고리 키 / 비어 있음):

- **파일 경로** → 그 ADR 한 개. 경로가 디스크에 없으면 rollup 의 renumber 로 옮겨졌을 수 있으니 `/adr-impl` 1단계의 "경로가 디스크에 없으면" 절차(카테고리 kebab-title 매칭 → `git log --diff-filter=R`)로 한 번 찾는다.
- **카테고리 키** (`ordering/checkout`, `auth`) → `.mapping.json` 의 카테고리 키를 대조해 매칭. context prefix 없이 피쳐명만 줘서 모호하면 어느 context 인지 한 번 되묻는다.
- **비어 있거나 모호하면** — 검토 대상은 보통 방금 구현한 것이므로, **`Accepted` 상태(구현 완료) ADR 목록**을 보여주고 어느 것을 검토할지 묻는다 (`/adr-impl` 의 "Proposed 목록 출력" 절차와 대칭 — 여기선 `Accepted` 를 추린다). 재귀 glob(`find docs/adr -name '[0-9][0-9][0-9][0-9]-*.md'`)으로 평면 키와 2-세그먼트 sub-folder ADR 을 **모두** 포함한다.

> **Status 참고**: 검토 대상이 `Proposed`(미구현) 여도 막지 않는다 — 부분 구현을 중간 점검하려는 경우일 수 있다. 다만 "이 ADR 은 아직 `Proposed`(미구현) 입니다. 부분 구현을 검토할까요?" 로 한 번 확인한다. 이 명령은 Status 를 바꾸지 않는다 (승격은 `/adr-impl` 만의 일).

여러 ADR 을 한 번에 검토하도록 골랐으면(`1,2` / `ordering/checkout, cart`), 각각을 아래 2~4단계로 **독립 검토**한다 — 구현은 의존 순서가 중요하지만 검토는 순서 무관이라 위상 정렬은 하지 않는다.

### 2. 컨텍스트 준비 (subagent 에 넘길 재료)

subagent 가 자체적으로 코드를 좁힐 수 있지만, 메인 세션이 미리 좁혀 넘기면 토큰이 절약된다:

- **관련 코드 범위** — `structure.md` "관련 코드 찾기" 3단계(ADR Decision/Mermaid/제목의 도메인 키워드 추출 → `Glob`/`Grep` → ADR 과 대조)로 이 ADR 이 다스리는 코드 폴더/파일을 좁힌다. **추측하지 말고** 실제로 `Glob`/`Grep` 해 확인한다.
- **프로젝트 규약 문서** — `AGENTS.md`·`CONTRIBUTING.md`·`CLAUDE.md` 중 있는 것의 경로. 베스트 프랙티스 판정의 1차 기준이다.
- **(선택) 결정론적 하네스 결과** — 구현 직후 `/adr-impl` 7단계에서 이미 돌렸다면 그 요약을 넘긴다. 안 돌렸고 빠르게 형식 정합만 확보하고 싶으면 여기서 한 번 돌려 요약을 첨부한다:

  ```bash
  node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-structure-lint.mjs <카테고리 키>
  ```

  이건 형식·인덱스 정합(Status enum, status↔본문, 역참조)만 본다 — 결정 충실도는 subagent 가 본다. 필수는 아니다.

### 3. adr-impl-reviewer 위임

reviewer subagent 를 다음 순서로 실행한다:

1. 현재 클라이언트가 `adr-impl-reviewer` named subagent 를 발견할 수 있으면 그것을 호출한다.
2. named subagent 가 없으면 `${CLAUDE_PLUGIN_ROOT}/agents/adr-impl-reviewer.md` 를 읽고, 그 전문을 reviewer 지침으로 전달한 **일반 read-only subagent** 하나를 실행한다. Codex 플러그인은 `agents/*.md`를 컴포넌트로 등록하지 않으므로 이 fallback이 기본 경로다.
3. subagent 기능 자체를 사용할 수 없는 클라이언트에서만 메인 세션이 같은 reviewer 지침을 직접 수행하고, 격리 검토를 사용할 수 없었다고 결과에 한 줄 밝힌다.

reviewer 에 다음을 prompt 로 넘긴다:

- 검토 대상 ADR 파일 경로
- 2단계에서 좁힌 코드 범위 (폴더/파일 목록)
- 프로젝트 규약 문서 경로
- (있으면) 하네스 결과 요약

subagent 는 read-only 로 **결정 원장**(ADR 의 회색지대 결정을 열거해 하나씩 `구현됨/누락/미확인` 으로 정산 — 이게 검출력의 핵심이다)을 채우며 D1(비즈니스)·D2(기술 구조·선행 계약)·D3(베스트 프랙티스·견고성)·D4(리팩토링)·D5(테스트)·D6(코드→ADR 역참조 R17) 를 검토하고 `PASS` / `FIX_REQUIRED` / `BLOCK` punch list 를 반환한다. 격리 컨텍스트라 긴 코드 읽기가 메인 세션을 오염시키지 않는다.

### 4. 리포트 제시 — HTML 리뷰 페이지로 보여주고 피드백을 파일로 받는다

punch list 를 채팅에 길게 나열하는 대신, 사용자가 **각 발견을 눈으로 훑고 항목별로 결정을 내릴 수 있는** 리뷰 페이지를 만든다. subagent 의 punch list 를 아래 findings JSON 으로 직렬화해 리포트 스크립트에 넘긴다:

```json
{
  "adr": "docs/adr/ordering/checkout/0001-checkout.md",
  "status": "Accepted (2026-07-10)",
  "verdict": "FIX_REQUIRED",
  "scope": ["src/checkout/handler.ts"],
  "conventions": "AGENTS.md",
  "findings": [
    {
      "category": "Spec violation",
      "summary": "…",
      "confidence": "high",
      "adrQuote": "<ADR 결정 1줄>",
      "code": "<파일:줄 + 실제 코드 조각>",
      "fix": "<한 줄>"
    },
    {
      "category": "Undecided behavior",
      "summary": "…",
      "confidence": "medium",
      "code": "<파일:줄 — ADR이 결정 안 한 무엇을 더 하는가>"
    },
    {
      "category": "Impl-fact mismatch",
      "summary": "…",
      "adrQuote": "…",
      "code": "…",
      "route": "/adr-sync ordering/checkout"
    },
    {
      "category": "Best practice",
      "summary": "…",
      "basis": "AGENTS.md §error-handling",
      "code": "…",
      "fix": "<한 줄>"
    },
    {
      "category": "Refactor",
      "summary": "…",
      "weight": "next-cycle",
      "impact": "low-effort/high-payoff"
    }
  ],
  "notes": "<선택>"
}
```

`category` 는 대괄호 없이 subagent 의 일곱 태그(`Spec violation` · `Decision changed in code` · `Undecided behavior` · `Impl-fact mismatch` · `Best practice` · `Refactor` · `Test gap`)를 그대로 쓴다. subagent 가 준 조각을 필드에 그대로 옮긴다 — `confidence`(증거 강도), `basis`(Best practice 의 규약 근거), `impact`(Refactor/Test gap 의 노력×효과), `code`(verbatim 인용) 를 빠뜨리지 않는다. 그런 다음 리포트를 생성한다:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-impl-review-report.mjs <findings.json> --out <경로>/adr-impl-review-report.html
```

이건 **서버 없는 단일 HTML 파일**을 쓴다 (플러그인의 무의존성 기조 — python 서버·브라우저 자동화 없음). 파일을 열면(`open <경로>/adr-impl-review-report.html`) 각 발견이 ADR 인용 ↔ 코드 ↔ 제안과 함께 카드로 뜨고, 항목마다 **반영 / 무시 / 보류** 라디오와 코멘트 박스가 있다. 카드는 교정 우선순위로 정렬돼(코드 must-fix → ADR 조치 → advisory, 미분류 태그는 최상단) 위에서부터 처리하면 된다. 사용자가 "판정 내보내기" 를 누르면 브라우저가 `feedback.json` 을 다운로드한다.

사용자에게: "리포트를 브라우저에서 열었습니다. 각 항목의 결정을 고르고 코멘트를 남긴 뒤 '판정 내보내기' 를 누르면 `feedback.json` 이 다운로드됩니다. 그 파일을 알려주시거나 워크스페이스에 두면 후속 조치로 넘어갑니다." 라고 안내한다. 채팅에는 verdict 와 발견 개수만 한 줄로 요약하고, 세부는 페이지에 맡긴다.

### 5. feedback.json 읽고 결정별 후속 조치

사용자가 저장한 `feedback.json` 을 읽어, 각 발견의 `decision` 대로 움직인다. `reviews[]` 항목은 **원본 finding 필드 전부**(`category`·`code`·`adrQuote`·`fix`·`route`·`basis`·`weight`·`impact`)에 사용자 판정(`decision`·`comment`)이 얹힌 자기-완결 형태다 — 그래서 컨텍스트가 compaction 되어 원본 findings.json 이 사라졌어도 이 파일만으로 라우팅·수정이 된다. 이 명령은 여전히 **고치지 않는다** — 사용자가 `fix` 로 승인한 것을 메인 세션이 별도로 수행한다.

- **`decision: "fix"`** — 사용자가 조치를 승인. `category` 로 무엇을 할지 가른다:
  - `Spec violation` / `Best practice` → 메인 세션이 코드를 고친다 (`fix`·`code` 참고). ADR 은 그대로 둔다 — ADR 이 스펙이다. Best practice 가 R17 역참조면 그 주석·상수를 지운다.
  - `Undecided behavior` → 코멘트를 참고해 분기한다: 의도된 동작이면 ADR 에 결정 추가(`/adr-new`·edit-in-place), 아니면 코드에서 제거.
  - `Impl-fact mismatch` → 코드가 아니라 ADR 을 고칠 일. `route` 필드(`/adr-sync <category>`)로 라우팅한다 (코드가 권위, ADR 정정).
  - `Decision changed in code` → `authoring-rules.md` "요구사항 변경으로 ADR을 고칠 때" 로 edit-in-place vs supersede 를 판정해 ADR 을 먼저 갱신할지, 코드를 되돌릴지 `adrQuote`·`code`·코멘트를 참고해 분기한다.
- **`decision: "skip"`** — 사용자가 무시하기로 함. 단 `Spec violation`(결정 위반)을 skip 했으면 남기지 않는 대신 **"결정한 동작을 코드가 안 지키는데 무시로 남겼습니다 — ADR 이 더는 사실이 아니면 `/adr-sync` 나 supersede 를 고려하세요" 한 줄을 확인**한다 (조용히 사라지면 ADR↔코드 drift 가 방치된다). 나머지 category 는 그대로 넘긴다.
- **`decision: "defer"`** — 다음 사이클로. advisory 로 기록만 한다.

한 줄 다음 단계 제안으로 마무리한다:

- `Impl-fact mismatch` 를 `fix`/`defer` 로 남겼으면 → "`/adr-sync <category>` 로 ADR 을 코드에 맞춰 정정하세요 — 이건 API 표·enum·필드명·키 패턴 등 ADR **본문** 사실이라 sync 를 **deep(기본)** 으로 돌립니다. `--quick`(매핑 summary 만 훑음)으로는 이 본문 drift 를 놓칠 수 있습니다."
- `Spec violation`/`Undecided behavior`/`Best practice` 를 고쳤으면 → "`/adr-impl-review` 를 다시 돌려 그 drift 가 닫혔는지 확인하세요 (수정 후 재검토로 루프를 닫는다)."
- verdict 가 `BLOCK` 이면 → "구조 조정(재카테고리화·supersede)이 먼저입니다 — 개별 항목 수정 전에 그것부터 사용자와 확정하세요."
- 모두 `PASS`(결정 원장 전부 `구현됨`) 면 → "구현이 ADR 결정을 충실히 따랐습니다. advisory 항목만 다음 사이클에 반영하세요."

## 금지

- 코드·ADR·매핑을 이 명령이 자동으로 고치지 않는다 — 검토는 보고, 수정은 사용자 승인 뒤 메인 세션이 별도로 수행한다.
- `[Spec violation]`(코드가 결정을 어김) 을 만났을 때 ADR 을 코드에 맞춰 조용히 고치지 않는다 — 구현 직후엔 ADR 이 스펙이다. 코드가 옳고 ADR 이 틀렸다고 판단되면 그건 `[Decision changed in code]` 분기로 사용자와 확정한 뒤 처리한다.
- ADR **문서** 품질(R1–R16)을 재검토하지 않는다 — `adr-reviewer`·`adr-structure-lint` 의 몫이다. R17(코드→ADR 역참조)만 예외로 subagent D6 이 본다 (코드를 보는 룰이므로).
- 이 ADR 이 다스리는 코드 범위를 넘어 전역 버그 사냥으로 번지지 않는다 — 그건 `/code-review`.
- 프로젝트 규약과 충돌하는 일반론을 베스트 프랙티스로 강요하지 않는다.
