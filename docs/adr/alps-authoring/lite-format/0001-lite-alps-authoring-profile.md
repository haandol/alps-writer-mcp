# ADR 0001: Lite ALPS 작성 프로필을 제공

Date: 2026-08-20

## Status

Accepted (2026-08-22)

## Context

기획자와 PM은 기술 구조와 구현 계약을 결정하기 전에 최소 범위의 목업이나 PoC를 빠르게
만들고 핵심 제품 의도를 눈으로 확인하려 한다. 기존 Full ALPS는 구현과 ADR handoff까지
준비하므로 아키텍처, 수직 슬라이스, NFR과 측정 계획을 포함한다.

Lite ALPS도 제품 개요, 범위, 시나리오, 기능, 화면, 공통 원칙, 검증과 미해결 사항을 각각
분리하면 Full ALPS의 축약판이 된다. 사용자는 PoC를 만들기 전에 구현 준비 수준의 정보를
작성하게 되고, 문서의 목적보다 형식 유지에 더 많은 시간을 쓴다.

Lite 문서는 한 Primary Persona가 사용할 최소 PoC와 그 PoC로 실행할 데모만 결정해야 한다.
여러 핵심 ideal use case는 허용하지만 각 use case는 제품 의도, 순차 사용자 행동, 보이는
제품 반응과 완료 결과만 담는다. 명시적인 제외 범위가 없으면 “무엇을 안 할 것인가”를
작성하지 않아도 된다. Lite ALPS는 Full ALPS와 목표, 작성 과정과 관리 수명주기가 완전히
분리된 독립 PoC 문서다.

## Decision Drivers

- 기술 지식이 없는 기획자와 PM이 최소 질문으로 PoC 제작 범위를 정할 수 있어야 한다.
- 완성된 문서만 읽고 무엇을 만들고 어떤 데모를 실행할지 재현할 수 있어야 한다.
- 한 Primary Persona와 핵심 ideal use case에 집중해 부차 흐름이 PoC 범위를 넓히지 않아야
  한다.
- 미결정 사항을 확정 요구사항이나 제외 범위로 강제하지 않아야 한다.
- Full ALPS의 작성·재개·관리 상태와 무관하게 독립적으로 유효하면서 기존 Full ALPS와
  기존 8-Section Lite 문서는 계속 동작해야 한다.

## Decision

ALPS Writer는 기존 Full ALPS와 함께 **4-Section Lite ALPS 작성 프로필**을 제공한다. Lite
ALPS는 AI 주도 질문, 명시적 승인, 저장, 재개, 상태 조회와 Markdown 내보내기를 유지하면서
PoC 제작 범위와 데모에 필요한 제품 동작만 기록한다.

Lite ALPS의 Section은 다음 네 개다.

1. **What to Build** — Primary Persona, 문제, PoC 의도, 최소 제작 범위와 성공 조건
2. **How It Works** — 핵심 ideal use case별 의도, 시작 상황, 사용자 행동, 보이는 제품
   반응과 완료 결과
3. **What to Demo** — 데모 의도, 순차 데모 흐름, 관찰할 성공 증거와 선택적 피드백 질문
4. **What Not to Do** — 명시적으로 제외한 사용자, use case, 기능, 화면, edge case와 PoC가
   증명하지 않는 항목

작성 순서는 `1 → 2 → 3 → 4`다. Section 4는 선택 사항이다. 사용자가 명시적인 제외 범위를
제공하지 않으면 질문하거나 저장하지 않아도 Lite ALPS 완료를 막지 않는다.

여러 페르소나가 제시되면 작성자는 첫 단계에서 가장 중요한 한 명을 사용자가 선택하도록
질문한다. 이후 모든 필수 Section은 같은 Primary Persona를 유지한다. Section 2는 그
페르소나의 핵심 ideal use case를 하나 이상 기록한다. 각 use case는 기능 목록이나 제품
반응만 나열하지 않고 의도에 맞는 사용자의 순차 행동을 중심으로 작성한다. Section 3은
Section 2의 use case를 실제로 보여주는 가장 짧은 연결 데모를 작성한다.

Lite ALPS는 PoC 자체의 입력이다. Full ALPS는 별도 목표와 별도 작성 흐름을 가진 독립
문서다. Lite 작성·재개·상태 관리·완료 판단은 Full ALPS를 읽거나 갱신하지 않는다. Full
ALPS 작성·관리도 Lite 문서를 참조하거나 상태를 공유하지 않는다. Lite 완료는 구현 준비나
ADR 소유권 handoff 완료를 의미하지 않는다.

기존 8-Section Lite ALPS 문서는 legacy 프로필로 자동 감지한다. Legacy 문서는 기존 Section,
가이드, 저장 검증과 내보내기 동작을 유지한다. 새 문서는 항상 4-Section 프로필로 생성하며
legacy 문서를 자동 변환하거나 덮어쓰지 않는다.

### Requirement contract

#### Required guarantees

- `lite-alps-init`은 새 4-Section Lite ALPS 작성과 기존 Lite ALPS 재개를 모두 지원한다.
- Lite ALPS 파일명은 `lite`, `alps`, `xml` 세 suffix segment를 점으로 연결한다.
- 새 Lite ALPS 문서는 정확히 `What to Build`, `How It Works`, `What to Demo`,
  `What Not to Do` 네 Section을 이 순서로 가진다.
- Lite ALPS 작성은 한 번에 1개, 최대 2개의 집중 질문을 사용한다.
- 여러 페르소나가 제시되면 사용자가 Primary Persona 한 명을 확정한 뒤 Section 1을
  완료한다.
- Section 1은 Primary Persona, 문제, PoC 의도, 최소 제작 범위와 관찰 가능한 성공 조건을
  포함한다.
- Section 2는 Primary Persona의 핵심 ideal use case를 하나 이상 포함한다.
- Section 2의 각 use case는 제품 의도, 시작 상황, 순차 사용자 행동, 보이는 제품 반응과
  관찰 가능한 완료 결과를 포함한다.
- Section 3은 Section 2와 같은 Primary Persona와 use case 의도를 사용한 데모 의도,
  순차 흐름과 성공 증거를 포함한다.
- Section 3의 피드백 질문은 선택 항목이다. PoC에서 직접 확인할 질문만 작성한다.
- Section 4는 선택 Section이다. 명시적인 제외 범위가 없으면 비어 있어도 문서 완료와
  내보내기를 막지 않는다.
- Section 4는 사용자가 확인한 제외 사용자, use case, 기능, 화면, edge case 또는 PoC가
  증명하지 않는 항목만 포함한다.
- 사용자가 작성 모드를 지정하지 않으면 Section별 atomic 승인을 사용한다.
- 사용자가 batch 작성을 명시적으로 요청하거나 여러 Section을 포함한 완전한 구조화 입력을
  제공한 경우에만 batch 승인을 사용할 수 있다.
- 모든 저장은 현재 작성 단위의 제품 의도, 범위, 필수 정보, 적용되는 값과 규칙, 완료 결과를
  포함한 plain-text approval digest의 명시적 승인 뒤에 수행한다.
- 4-Section 문서를 재개하면 `1 → 2 → 3 → 4` 순서상 첫 미완료 필수 Section에서 계속한다.
  Section 4에 명시적 제외 범위가 없으면 건너뛴다.
- 기존 8-Section Lite 문서는 legacy 형식으로 자동 감지하고 기존 Section, 가이드, 저장
  검증과 내보내기를 사용한다.
- Lite ALPS는 현재 상태를 Markdown으로 내보낼 수 있다.
- 작성 내용과 사용자 대화는 사용자가 사용한 언어를 따른다.
- Lite ALPS 작성, 재개, 상태 조회와 내보내기는 Full ALPS 문서나 작성 상태를 읽거나
  갱신하지 않는다.
- Full ALPS 작성과 관리도 Lite ALPS 문서나 작성 상태를 읽거나 갱신하지 않는다.
- 기존 Full ALPS 문서는 9개 Section의 기존 형식과 작성·검증 규칙을 유지한다.
- 문서 로더는 Full ALPS, 4-Section Lite ALPS와 legacy 8-Section Lite ALPS를 구분하고
  현재 문서에 맞는 제목, 템플릿, 가이드와 저장 검증을 사용한다.

#### Prohibitions

- Lite ALPS 템플릿과 가이드는 기술 스택, C4, API, 데이터베이스, 배포, 라이브러리,
  코드 구조 또는 구현 계층 입력을 요구하지 않는다.
- 여러 페르소나를 복합 Primary Persona로 합치거나 둘 이상의 Primary Persona를 같은
  우선순위로 작성하지 않는다.
- 여러 페르소나 중 하나를 사용자 확인 없이 임의로 Primary Persona로 확정하지 않는다.
- 핵심 ideal use case를 기능 목록이나 제품 반응만으로 작성하지 않는다.
- 다른 페르소나의 흐름, 부차적인 대안 흐름 또는 edge case를 핵심 ideal use case와 같은
  우선순위로 확장하지 않는다.
- Feature ID, 상세 상태표, 공통 원칙 목록 또는 구현 준비 정보를 Lite 완성 조건으로
  요구하지 않는다.
- 사용자 확인 없이 수치, 권한, 범위, 상태, 제한과 성공 기준을 확정하지 않는다.
- 명시적 입력이 없는 제외 범위, 실패 상태, edge case 또는 “PoC가 증명하지 않는 것”을
  Section 4를 채우기 위해 발명하지 않는다.
- 미결정 사항을 자동으로 제외 범위나 확정 요구사항으로 분류하지 않는다.
- Lite ALPS 완료를 Full ALPS 완료, 구현 준비 또는 ADR handoff 완료로 표시하지 않는다.
- Full ALPS 작성을 Lite의 다음 단계, 변환 대상, 입력 재사용 또는 완료 조건으로 안내하지
  않는다.
- Lite 문서와 Full ALPS 사이에 Section, Feature, 승인 상태 또는 완료 상태를 동기화하지
  않는다.
- 새 4-Section 형식이 기존 Full ALPS나 legacy Lite 문서의 내용을 자동 변환하거나
  덮어쓰지 않는다.

#### Failure guarantees

- Lite 문서 초기화, 로드, 저장 또는 내보내기 실패는 기존 문서를 덮어쓰거나 현재 선택된
  문서를 다른 유형으로 변경하지 않는다.
- 잘못된 Section, subsection 식별자 또는 제목은 문서 내용을 변경하지 않고 거부한다.
- 현재 문서를 다른 프로필의 템플릿으로 저장하려는 요청은 문서 내용을 변경하지 않고
  거부한다.
- legacy Lite 문서 감지 또는 편집 실패는 원본을 4-Section 형식으로 자동 변환하지 않는다.

#### Observable evidence

| Obligation                           | Observable evidence                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| 새 Lite 문서는 4개 Section을 가진다. | 새 문서의 상태와 내보내기에 네 Section만 지정된 순서로 나타난다.                     |
| Section 4는 선택 사항이다.           | 명시적 제외 범위가 없어 Section 4가 비어 있어도 필수 Section 완료 후 내보낼 수 있다. |
| 한 Primary Persona를 확정한다.       | 여러 페르소나가 제시되면 한 명을 선택하기 전 Section 1을 저장하지 않는다.            |
| 무엇을 만들지 재현한다.              | Section 1만 읽고 Primary Persona, 문제, 최소 제작 범위와 성공 조건을 확인할 수 있다. |
| 제품 동작을 재현한다.                | 각 use case에서 의도, 사용자 액션, 보이는 반응과 완료 결과를 확인할 수 있다.         |
| 데모를 재현한다.                     | Section 3만 읽고 데모 의도, 순서와 성공 증거를 실행할 수 있다.                       |
| 제외 범위를 발명하지 않는다.         | Section 4에는 사용자가 명시적으로 확인한 제외 항목만 나타난다.                       |
| Full ALPS와 독립적으로 관리한다.     | Lite 작성·재개·상태·완료 결과가 Full ALPS 문서나 상태를 읽거나 변경하지 않는다.      |
| legacy 문서를 유지한다.              | 기존 8-Section 문서를 로드하면 legacy 가이드와 저장 검증으로 편집·내보낼 수 있다.    |
| 기존 Full ALPS는 호환성을 유지한다.  | Full ALPS를 로드하면 기존 9개 Section과 C4·Feature 검증이 적용된다.                  |
| 기술 입력을 요구하지 않는다.         | 현재 Lite 템플릿, 가이드와 스킬에 기술 선택 단계가 없다.                             |
| 실패 시 원본을 보존한다.             | 유효하지 않은 저장이나 프로필 불일치 뒤에도 파일 내용이 요청 전과 같다.              |

### Alternatives

1. **기존 8-Section Lite 형식을 유지한다**
   - 장점: 문서와 도구 변경이 없다.
   - 단점: 기능, 화면, 공통 원칙과 검증을 분리해 Full ALPS의 축약판처럼 동작한다.

2. **자유 형식 한 페이지 PoC 메모를 생성한다**
   - 장점: 가장 빠르게 작성할 수 있다.
   - 단점: 승인 경계, 안전한 재개, 구조 검증과 일관된 내보내기를 보장할 수 없다.

3. **무엇을 만들고 어떻게 동작하며 무엇을 데모할지 기록하는 3-Section 형식을 사용한다**
   - 장점: 필수 내용만 남긴다.
   - 단점: 명시적인 제외 범위를 기록할 안정된 위치가 없다.

4. **optional 제외 범위를 포함한 4-Section 형식을 사용한다**
   - 장점: 필수 PoC 결정은 세 Section에 집중하고 필요한 경우에만 비범위를 명시한다.
   - 단점: 기존 8-Section 문서를 위한 legacy 감지와 별도 가이드 유지가 필요하다.

## Consequences

### Positive

- 사용자는 무엇을 만들고 어떤 동작을 보여주며 어떤 데모를 실행할지 빠르게 결정한다.
- Feature ID, 상세 상태와 공통 원칙을 미리 확정하지 않아도 PoC 문서를 완료할 수 있다.
- 한 Primary Persona의 여러 핵심 use case를 짧은 문서 안에서 재현할 수 있다.
- 제외 범위는 필요할 때만 기록하며 미결정 사항을 억지로 비범위로 만들지 않는다.
- Lite ALPS는 Full ALPS의 작성·관리 수명주기와 무관하게 독립적으로 유효하다.
- 기존 Full ALPS와 legacy Lite 문서를 계속 사용할 수 있다.

### Negative

- 4-Section 현재 프로필과 8-Section legacy 프로필의 템플릿과 가이드를 함께 유지해야 한다.
- Lite 문서만으로 구현 준비 수준의 상태, 권한, NFR과 edge case를 복구할 수 없다.
- 여러 사용자 관점을 비교하려면 별도 PoC나 문서가 필요하다.

### Risks

- 최소 제작 범위가 모호하면 Section 2와 Section 3에서 기능이 다시 확장될 수 있다.
- 성공 조건이 관찰 불가능하면 데모 완료 여부를 판단하기 어렵다.
- optional Section 4를 관성적으로 채우면 다시 작성 부담이 커질 수 있다.
- legacy 프로필 판별 오류가 잘못된 가이드나 저장 검증을 선택할 수 있다.
- “가벼운 문서”라는 이유로 PoC에 반드시 필요한 보안·권한 제약까지 생략할 수 있다.

## Related

- [ALPS 작성 승인 방식](../authoring-interaction/0001-support-atomic-and-batch-approval.md)
