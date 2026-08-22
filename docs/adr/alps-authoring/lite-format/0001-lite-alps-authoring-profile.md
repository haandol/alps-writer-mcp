# ADR 0001: Lite ALPS 작성 프로필을 제공

Date: 2026-08-20

## Status

Accepted (2026-08-22)

## Context

기획자와 PM은 기술 구조와 구현 계약을 결정하기 전에 최소 범위의 목업이나 PoC를 빠르게
만들고 핵심 제품 가설을 검증하려 한다. 기존 Full ALPS는 구현과 ADR handoff까지 준비하므로
아키텍처, 수직 슬라이스, NFR과 측정 계획을 포함한다.

Lite 문서가 제작 범위부터 시작하면 해결책이 문제와 비즈니스 의미보다 먼저 고정된다.
팀이나 조직이 왜 이 PoC를 해야 하는지 설명할 수 없고, 데모도 기능 투어나 화면 확인에
머물 수 있다.

Lite 문서는 문제와 비즈니스 임팩트를 먼저 확정하고, 그 이유에 맞는 해결 방식을 정해야
한다. 명시적인 비범위는 검증 시나리오보다 먼저 고정해 데모가 무엇을 증명하지 않는지도
분명히 해야 한다. 마지막 Demo Scenario는 승인된 문제, 해결 방식과 비범위를 실제로
검증하는 인수 테스트여야 한다. 각 방법론의 개념을 별도 질문과 문서 항목으로 늘리면 PoC를
만들기 전에 다시 무거운 PRD가 되므로, 필요한 판단은 소수의 통합 입력으로 받아야 한다.

## Decision Drivers

- 기술 지식이 없는 기획자와 PM이 최소 질문과 입력으로 PoC를 시작할 수 있어야 한다.
- 문제와 고객·비즈니스 가치가 해결 방식보다 먼저 제품 판단을 이끌어야 한다.
- 기본 한 개의 핵심 흐름만으로 최소 PoC의 사용자 경험을 재현할 수 있어야 한다.
- Lite와 Full ALPS가 같은 제품 문서 용어를 사용하고, Demo Scenario는 핵심 흐름의 동작과
  전체 통과 결과를 사람이 실행 가능한 형태로 제공해야 한다.
- Lite ALPS는 Full ALPS와 무관하게 독립적으로 유효해야 한다.

## Decision

ALPS Writer는 기존 Full ALPS와 함께 **4-Section Lite ALPS 작성 프로필**을 제공한다. Lite
ALPS는 AI 주도 질문, 명시적 승인, 저장, 재개, 상태 조회와 Markdown 내보내기를 유지하면서
PoC의 이유, 해결 방식, 비범위와 인수 테스트에 필요한 제품 동작만 기록한다.

Lite ALPS의 Section은 다음 네 개다.

1. **Overview** — Target User와 Core Problem을 한 맥락으로 정의하고, 고객·비즈니스 가치와
   가장 중요한 PoC 가설을 짧게 기록
2. **Solution and User Flow** — 최소 Solution Strategy와 기본 한 개의 Core User Flow를
   기록
3. **Out of Scope** — 사용자가 명시한 비범위와 이번 PoC가 증명하지 않는 주장만 한 목록으로
   기록
4. **Demo Scenario** — 최소 흐름을 실행하는 단일 Demo Scenario와 전체 통과 결과를 기록

작성 순서는 `1 → 2 → 3 → 4`다. Section 3은 선택 사항이다. 사용자가 명시적인 제외 범위를
제공하지 않으면 저장하지 않아도 Lite ALPS 완료를 막지 않는다. Section 4는 필수이며
데모와 인수 테스트가 같은 시나리오를 사용한다.

Section 1은 페르소나 목록보다 **하나의 구체적인 가정 문제 사례**에서 시작한다. 해당 사례가
대화와 참조 자료에서 회수되지 않으면 작성자는 “누가, 어떤 상황에서, 무엇을 하려다가 어떤
문제를 겪고 있다고 가정하는가”를 묻는다. 실제로 발생했거나 최근에 겪은 경험일 필요는 없다.
작성자는 이 사례에서 Primary Persona를 추출한다. 사용자가 여러 후보 페르소나를 명시적으로
제시한 경우에만 후보를 짧게 정리하고, 이 사례의 주체가 될 한 명을 선택하도록 질문한다.
이후 모든 필수 Section은 같은 Primary Persona를 유지한다. Section 1은 사례의 상황, 시도한
행동, 문제와 현재 결과를 한 문맥으로 기록하고, 고객이 얻게 될 가치와 팀·조직의 의미를
하나의 짧은 가치 설명으로 묶는다. 가장 위험하거나 중요한 가설도 한 문장으로만 기록한다.

Section 2는 해결 원칙과 최소 사용자 가시 범위를 하나의 Solution Strategy로 기록한다.
기본은 한 개의 Core User Flow다. 핵심 가설을 실행하는 데 반드시 필요한 경우에만 흐름을
추가한다. Core User Flow는 시작 맥락, 순차 사용자 행동, 보이는 제품 반응과 완료 결과를
담는다.

Section 3은 사용자가 명시한 제외 범위만 기록한다. Section 4는 Sections 1과 2를 가장 짧은
연결 시나리오로 검증한다. 명시적인 Section 3이 있으면 Demo Scenario는 그 경계를 넘지
않아야 한다. 시나리오는 필요한 시작 조건, 행동과 예상 결과를 함께 기록해 사람이 그대로
실행하고 합격 여부를 판단할 수 있어야 한다. Full ALPS와 마찬가지로 Section 4는
`Demo Scenario`라는 단일 subsection만 사용한다.

Lite ALPS는 PoC 자체의 입력이다. Full ALPS는 별도 목표와 별도 작성 흐름을 가진 독립
문서다. Lite 작성·재개·상태 관리·완료 판단은 Full ALPS를 읽거나 갱신하지 않는다. Full
ALPS 작성·관리도 Lite 문서를 참조하거나 상태를 공유하지 않는다. Lite 완료는 구현 준비나
ADR 소유권 handoff 완료를 의미하지 않는다.

### Requirement contract

#### Required guarantees

- `lite-alps-init`은 현재 4-Section Lite ALPS 작성과 재개를 지원한다.
- Lite ALPS 파일명은 `lite`, `alps`, `xml` 세 suffix segment를 점으로 연결한다.
- Lite ALPS 문서는 정확히 `Overview`, `Solution and User Flow`, `Out of Scope`,
  `Demo Scenario` 네 Section을 이 순서로 가진다.
- Lite ALPS 작성은 공통 inference-first 규칙으로 추론 가능한 경우 질문 없이 승인 초안을
  제시한다. 질문이 필요하면 한 번에 1개를 사용하고 서로 분리할 수 없는 경우에만 최대 2개의
  집중 질문을 함께 사용한다.
- Section 1의 문제 맥락을 회수할 수 없으면 하나의 구체적인 가정 사례를 질문한다. 질문은
  누가, 어떤 상황에서, 무엇을 하려다가 어떤 문제를 겪고 있다고 가정하는지를 함께 확인한다.
- 구체적인 사례는 실제로 발생했거나 최근에 겪은 경험일 필요가 없다.
- 하나의 Primary Persona를 사례에서 회수할 수 있으면 별도의 페르소나 후보 수집이나 선택
  질문 없이 승인 초안을 제시한다.
- 사용자가 여러 후보 페르소나를 명시적으로 제시하면 해당 사례의 주체가 될 Primary Persona
  한 명을 확정한 뒤 Section 1을 완료한다.
- Section 1은 Primary Persona, 구체적인 상황, 시도한 행동, 가정한 문제와 현재 결과를
  하나의 Target User and Core Problem으로 기록한다.
- Section 1은 고객이 얻게 될 가치, 팀·조직의 의미와 가장 중요한 PoC 가설을 하나의 Value
  and Core Hypothesis로 기록한다.
- Section 2는 해결 원칙과 최소 사용자 가시 범위를 하나의 Solution Strategy로 기록한다.
- Section 2는 기본 한 개의 Core User Flow를 포함한다. 핵심 가설을 실행하는 데 반드시
  필요한 경우에만 추가 흐름을 포함한다.
- 각 Core User Flow는 시작 맥락, 순차 사용자 행동, 보이는 제품 반응과 관찰 가능한 완료
  결과를 포함한다.
- Section 3은 선택 Section이다. 명시적인 제외 범위가 없으면 비어 있어도 문서 완료와
  내보내기를 막지 않는다.
- Section 3은 사용자가 확인한 비범위와 PoC가 증명하지 않는 주장만 하나의 Explicit
  Exclusions 목록으로 포함한다.
- Section 4는 필수이며 `4.1 Demo Scenario` 한 subsection만 포함한다.
- Section 4의 Demo Scenario는 Section 1의 문제와 기대 결과, Section 2의 해결 접근과 Core
  User Flow를 검증한다.
- Section 4의 Demo Scenario는 필요한 시작 조건, 순차 행동, 각 행동 뒤의 보이는 예상
  결과와 전체 시나리오의 관찰 가능한 합격 결과를 포함한다.
- Section 3에 제외 범위가 있으면 Section 4는 그 범위를 검증 대상으로 포함하거나 암묵적으로
  약속하지 않는다.
- 사용자가 작성 모드를 지정하지 않으면 Section별 atomic 승인을 사용한다.
- 사용자가 batch 작성을 명시적으로 요청하거나 여러 Section을 포함한 완전한 구조화 입력을
  제공한 경우에만 batch 승인을 사용할 수 있다.
- 모든 저장은 현재 작성 단위의 제품 의도, 범위, 필수 정보, 적용되는 값과 규칙, 완료 결과를
  포함한 plain-text approval digest의 명시적 승인 뒤에 수행한다.
- 4-Section 문서를 재개하면 `1 → 2 → 3 → 4` 순서상 첫 미완료 필수 Section에서 계속한다.
  Section 3에 명시적 제외 범위가 없으면 건너뛴다.
- Lite ALPS는 현재 상태를 Markdown으로 내보낼 수 있다.
- 작성 내용과 사용자 대화는 사용자가 사용한 언어를 따른다.
- Lite ALPS 작성, 재개, 상태 조회와 내보내기는 Full ALPS 문서나 작성 상태를 읽거나
  갱신하지 않는다.
- Full ALPS 작성과 관리도 Lite ALPS 문서나 작성 상태를 읽거나 갱신하지 않는다.
- 기존 Full ALPS 문서는 9개 Section의 기존 형식과 작성·검증 규칙을 유지한다.
- 문서 로더는 Full ALPS와 현재 4-Section Lite ALPS를 구분하고 현재 문서에 맞는 제목,
  템플릿, 가이드와 저장 검증을 사용한다.

#### Prohibitions

- Lite ALPS 템플릿과 가이드는 기술 스택, C4, API, 데이터베이스, 배포, 라이브러리,
  코드 구조 또는 구현 계층 입력을 요구하지 않는다.
- Section 1을 시작하기 위해 사용자에게 페르소나 후보 목록을 만들거나 실제·최근 경험을
  제시하도록 요구하지 않는다.
- 여러 페르소나를 복합 Primary Persona로 합치거나 둘 이상의 Primary Persona를 같은
  우선순위로 작성하지 않는다.
- 여러 페르소나 중 하나를 사용자 확인 없이 임의로 Primary Persona로 확정하지 않는다.
- 핵심 ideal use case를 기능 목록이나 제품 반응만으로 작성하지 않는다.
- 다른 페르소나의 흐름, 부차적인 대안 흐름 또는 edge case를 핵심 ideal use case와 같은
  우선순위로 확장하지 않는다.
- Feature ID, 상세 상태표, 공통 원칙 목록 또는 구현 준비 정보를 Lite 완성 조건으로
  요구하지 않는다.
- Golden Circle, Lean Startup 또는 Working Backwards의 각 개념을 별도 필수 subsection,
  질문 목록, PR/FAQ 또는 분석 문서로 확장하지 않는다.
- 기존 대안, 별도 고객 약속문, 상세 비즈니스 지표, 가설 목록, FAQ, 실험 매트릭스 또는
  별도 학습 계획을 Lite 완성 조건으로 요구하지 않는다.
- Section 1을 제작 기능이나 화면 목록으로 대체하지 않는다.
- 팀·조직의 비즈니스 임팩트를 Primary Persona의 불편을 반복하는 문장으로 대체하지 않는다.
- 사용자 확인 없이 수치, 권한, 범위, 상태, 제한과 성공 기준을 확정하지 않는다.
- 명시적 입력이 없는 제외 범위, 실패 상태, edge case 또는 “PoC가 증명하지 않는 것”을
  Section 3을 채우기 위해 발명하지 않는다.
- 미결정 사항을 자동으로 제외 범위나 확정 요구사항으로 분류하지 않는다.
- Demo Scenario를 기능 목록, 화면 투어 또는 결과 없는 행동 목록으로 작성하지 않는다.
- Demo Scenario의 통과 조건에 Section 1과 2에서 승인하지 않은 제품 약속을 추가하지 않는다.
- Demo Scenario와 별도의 Learning Check subsection이나 학습 판단 절차를 요구하지 않는다.
- Lite ALPS 완료를 Full ALPS 완료, 구현 준비 또는 ADR handoff 완료로 표시하지 않는다.
- Full ALPS 작성을 Lite의 다음 단계, 변환 대상, 입력 재사용 또는 완료 조건으로 안내하지
  않는다.
- Lite 문서와 Full ALPS 사이에 Section, Feature, 승인 상태 또는 완료 상태를 동기화하지
  않는다.

#### Failure guarantees

- Lite 문서 초기화, 로드, 저장 또는 내보내기 실패는 기존 문서를 덮어쓰거나 현재 선택된
  문서를 다른 유형으로 변경하지 않는다.
- 잘못된 Section, subsection 식별자 또는 제목은 문서 내용을 변경하지 않고 거부한다.
- 현재 문서를 다른 프로필의 템플릿으로 저장하려는 요청은 문서 내용을 변경하지 않고
  거부한다.
- 현재 4-Section 형식과 다른 Lite 문서는 원본을 변경하지 않고 거부한다.

#### Observable evidence

| Obligation                            | Observable evidence                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Lite 문서는 4개 Section을 가진다.     | 상태와 내보내기에 네 Section만 지정된 순서로 나타난다.                                                             |
| Overview 입력을 두 항목으로 제한한다. | Section 1은 Target User and Core Problem과 Value and Core Hypothesis만 요구한다.                                   |
| 구체적인 가정 사례에서 시작한다.      | 문제 맥락이 없으면 실제·최근 경험 대신 누가 어떤 상황에서 무엇을 하려다 어떤 문제를 겪고 있다고 가정하는지 묻는다. |
| 한 Primary Persona를 확정한다.        | 한 사례에서는 페르소나를 추출하고, 여러 후보가 명시된 경우에만 한 명을 선택하기 전 Section 1을 저장하지 않는다.    |
| Solution 입력을 두 항목으로 제한한다. | Section 2는 Solution Strategy와 기본 한 개의 Core User Flow만으로 완료할 수 있다.                                  |
| Section 3은 선택 사항이다.            | 명시적 제외 범위가 없어 Section 3이 비어 있어도 필수 Section 완료 후 내보낼 수 있다.                               |
| 제외 범위를 발명하지 않는다.          | Section 3에는 사용자가 명시적으로 확인한 제외 항목만 한 목록으로 나타난다.                                         |
| Demo 구조가 Full과 대응한다.          | Section 4에는 `4.1 Demo Scenario` 한 subsection만 나타난다.                                                        |
| Demo Scenario가 인수 테스트가 된다.   | Demo Scenario만 읽고 흐름을 실행하고 전체 합격 여부를 판단할 수 있다.                                              |
| Full ALPS와 독립적으로 관리한다.      | Lite 작성·재개·상태·완료 결과가 Full ALPS 문서나 상태를 읽거나 변경하지 않는다.                                    |
| 현재 형식만 허용한다.                 | 다른 Section 수·제목·순서를 가진 Lite 문서를 변경 없이 거부한다.                                                   |
| 기술 입력을 요구하지 않는다.          | 현재 Lite 템플릿, 가이드와 스킬에 기술 선택 단계가 없다.                                                           |
| 실패 시 원본을 보존한다.              | 유효하지 않은 저장이나 프로필 불일치 뒤에도 파일 내용이 요청 전과 같다.                                            |

### Alternatives

1. **제작 범위부터 시작한다**
   - 장점: 만들 항목을 빠르게 나열할 수 있다.
   - 단점: 문제와 비즈니스 임팩트가 해결책을 제약하지 못하고 기능 중심 PoC가 되기 쉽다.

2. **자유 형식 한 페이지 PoC 메모를 생성한다**
   - 장점: 가장 빠르게 작성할 수 있다.
   - 단점: 승인 경계, 안전한 재개, 구조 검증과 일관된 내보내기를 보장할 수 없다.

3. **Overview → Solution and User Flow → Demo Scenario → Out of Scope 순서를 사용한다**
   - 장점: 문제와 해결 뒤에 검증을 빠르게 정의한다.
   - 단점: 데모가 비범위를 먼저 확인하지 않아 검증 대상이 암묵적으로 확장될 수 있다.

4. **Overview → Solution and User Flow → Out of Scope → Demo Scenario 순서를 사용한다**
   - 장점: 문제와 비즈니스 임팩트가 해결을 이끌고, 명시적 비범위 안에서 실행 가능한 인수
     테스트를 작성한다.
   - 단점: 방법론별 항목을 모두 분리하면 Lite 문서가 다시 무거워질 수 있으므로 통합 입력
     규칙이 필요하다.

## Consequences

### Positive

- 사용자는 PoC의 문제와 비즈니스 의미를 해결책보다 먼저 설명한다.
- 팀과 조직은 왜 이 PoC를 해야 하는지 문서만으로 판단할 수 있다.
- Lite와 Full ALPS 사이에서 Overview, Solution Strategy, User Flow, Out of Scope와 Demo
  Scenario 용어를 일관되게 읽을 수 있다.
- 해결 방식과 명시적 비범위가 Demo Scenario의 검증 범위를 제약한다.
- Demo Scenario를 사람이 실행 가능한 인수 테스트로 재사용한다.
- Demo Scenario를 Full ALPS와 같은 단일 subsection 구조로 읽고 저장한다.
- Feature ID, 상세 상태와 공통 원칙을 미리 확정하지 않아도 PoC 문서를 완료할 수 있다.
- 사용자는 페르소나 분류 작업 대신 PoC가 해결할 하나의 구체적인 가정 문제 사례를 설명한다.
- 한 Primary Persona의 기본 핵심 흐름을 짧은 문서 안에서 재현할 수 있다.
- Lite ALPS는 Full ALPS의 작성·관리 수명주기와 무관하게 독립적으로 유효하다.
- 기존 Full ALPS는 기존 형식과 작성 규칙을 유지한다.

### Negative

- 현재 형식과 다른 Lite 문서는 재개할 수 없다.
- Lite 문서만으로 구현 준비 수준의 상태, 권한, NFR과 edge case를 복구할 수 없다.
- 여러 사용자 관점을 비교하려면 별도 PoC나 문서가 필요하다.
- 여러 가설이나 실험을 동시에 비교하려면 PoC를 반복하거나 별도 분석 문서가 필요하다.

### Risks

- 비즈니스 임팩트를 과장하면 근거 없는 조직 목표가 문서에 들어갈 수 있다.
- 통합 입력이 지나치게 짧으면 문제, 가치와 가설의 구분이 흐려질 수 있다.
- Solution Strategy가 추상적이면 Core User Flow와 Demo Scenario가 연결되지 않는다.
- optional Section 3을 관성적으로 채우면 다시 작성 부담이 커질 수 있다.
- 예상 결과가 관찰 불가능하면 Demo Scenario가 인수 테스트 역할을 하지 못한다.
- 별도 Learning Check가 없으므로 다음 반복의 학습 판단이 필요하면 Demo 결과 밖에서 다뤄야
  한다.
- “가벼운 문서”라는 이유로 PoC에 반드시 필요한 보안·권한 제약까지 생략할 수 있다.

## Related

- [ALPS 작성 승인 방식](../authoring-interaction/0001-support-atomic-and-batch-approval.md)
