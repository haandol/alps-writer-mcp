# ADR 0001: Full 작성 방식을 따르는 Lite ALPS 템플릿을 제공

Date: 2026-08-20

## Status

Accepted (2026-08-23)

## Context

기획자와 PM은 구현 준비 수준의 전체 PRD보다 적은 입력으로 목업이나 PoC를 시작하려 한다.
기존 Full ALPS는 제품 의도부터 아키텍처, 요구사항, Feature 명세와 측정까지 9개 Section을
작성한다. Lite ALPS는 이 중 첫 PoC를 설명하고 시연하는 데 필요한 제품 수준 정보만 남겨야
한다.

Lite가 가벼운 문서라는 이유로 별도의 작성 철학과 인터뷰 방법을 만들 필요는 없다. Lite 도입
전 Full ALPS는 AI가 Section별로 한 번에 1개, 최대 2개의 집중 질문을 하고 사용자가 답하면서
부족한 맥락을 채운 뒤 승인하는 흐름을 사용했다. Lite는 이 익숙한 흐름에서 Section과 질문
항목만 줄여야 한다.

질문 없는 완성 초안, 특정 페르소나 선택 절차, 방법론별 출력 형식과 세밀한 금지 문구를
Lite에 별도로 강제하면 템플릿 축약이 아니라 새로운 작성 제품이 된다. 그 규칙을 공통화하면
기존 Full 작성 방식까지 바뀐다.

Lite 문서의 파일, 상태, 완료 판단은 Full과 독립적으로 관리해야 한다. 이 독립성은 문서
수명주기와 구현 준비 수준의 차이를 뜻하며, 대화 작성 방식을 별도로 설계한다는 뜻이 아니다.

## Decision Drivers

- Lite는 Lite 도입 직전 Full ALPS의 대화형 작성 경험을 유지하고, 기존 Full의 스킬, 가이드,
  질문 순서, wizard와 예시는 변경하지 않아야 한다.
- Lite는 첫 PoC에 필요한 제품 맥락만 적은 Section으로 완료할 수 있어야 한다.
- AI와 대화하면서 부족한 컨텍스트를 점진적으로 채울 수 있어야 한다.
- Lite의 질문과 평가는 의미상 필요한 정보와 승인만 확인하고 자연어 표현을 과도하게
  제한하지 않아야 한다.
- Lite 문서 상태와 완료 판단은 Full 문서와 독립적이어야 한다.

## Decision

ALPS Writer는 기존 Full ALPS와 함께 **4-Section Lite ALPS 템플릿 프로필**을 제공한다.
Lite는 Full의 작성 흐름을 재사용하고 다음 항목만 줄인다.

1. Section 수와 authoring order
2. 각 Section에서 묻는 제품 정보의 범위
3. 구현 준비에 필요한 아키텍처, NFR, 상세 Feature 명세와 측정 정보

Lite 작성자는 Full과 같이 Section 목적을 짧게 설명하고, 현재 Section에서 부족한 맥락을
한 번에 한 개의 집중 질문으로 묻는다. 밀접하게 연결돼 분리할 수 없을 때만 최대 두 개를
함께 묻는다. 사용자의 답을 현재 초안에 반영하고, Section이 완성되면 plain-text approval
digest를 제시한 뒤 명시적 승인 후 저장한다.

이미 대화나 참조 자료에 있는 정보는 질문에 반영하거나 확인 가능한 후보로 제시할 수 있다.
그러나 Lite는 질문을 하지 않는 것을 목표로 삼거나, AI가 먼저 완성한 전체 Section을
사용자가 교정하는 방식을 기본으로 삼지 않는다. AI 제안은 사용자의 후속 설명으로 자유롭게
수정할 수 있고 별도 추론 출처 레이블을 사용하지 않는다.

Lite ALPS의 Section은 다음 네 개다.

1. **Overview**
   - `Target User and Core Problem`
   - `Value and Core Hypothesis`
2. **Solution and User Flow**
   - `Solution Strategy`
   - `Core User Flow`
3. **Out of Scope**
   - 선택 사항인 `Explicit Exclusions`
4. **Demo Scenario**
   - 필수인 `4.1 Demo Scenario`

작성 순서는 `1 → 2 → 3 → 4`다. Section 3은 사용자가 제외 범위를 밝힌 경우에만 작성한다.
Section 4는 승인된 Overview와 Solution and User Flow를 실행 가능한 하나의 시나리오로
보여주고 관찰 가능한 전체 통과 결과를 포함한다.

Lite와 Full은 같은 approval digest, atomic/batch 승인과 저장 방식을 사용한다. Lite에
Section 7 동적 Feature 승인, 아키텍처 wizard, NFR wizard 또는 ADR handoff 준비를 추가하지
않는다.

Lite ALPS는 별도 파일 suffix와 프로필을 사용한다. Lite 작성, 재개, 상태 조회와 내보내기는
Full 문서나 Full 작성 상태를 읽거나 갱신하지 않는다. Full 작성도 Lite 문서 상태를
참조하지 않는다.

Lite 행동 평가는 다음과 같은 계약 결과만 확인한다.

- 필요한 제품 맥락을 대화로 수집하는가
- 명시적으로 제공된 범위와 제외 항목을 보존하는가
- Core User Flow와 Demo Scenario가 관찰 가능한가
- 승인 전에 저장하지 않는가
- Full 상태와 독립적으로 완료되는가

특정 사용자 노출 문장, 질문 문구, 장식 형식, 추론 레이블, 문장 순서와 불필요한 금지 표현은
통과 조건으로 고정하지 않는다.

### Requirement contract

#### Required guarantees

- `lite-alps-init`은 현재 4-Section Lite ALPS 작성과 재개를 지원한다.
- Lite ALPS 파일명은 `lite`, `alps`, `xml` 세 suffix segment를 점으로 연결한다.
- Lite ALPS 문서는 정확히 `Overview`, `Solution and User Flow`, `Out of Scope`,
  `Demo Scenario` 네 Section을 이 순서로 가진다.
- Lite 작성 흐름은 Lite 도입 직전 Full ALPS와 같이 Section 목적 설명, 한 번에 1개 또는
  최대 2개의 집중 질문, 답변 통합, approval digest, 명시적 승인과 저장 순서를 사용한다.
- Lite를 지원하기 위해 Full ALPS의 스킬, 9개 Section 가이드, overview와 Full Section
  템플릿 작성 규칙을 변경하지 않는다.
- Section 1은 `Target User and Core Problem`, `Value and Core Hypothesis` 두 subsection만
  포함한다.
- Section 1 질문은 대상 사용자, 핵심 문제, 기대 가치와 검증할 핵심 가설에 부족한 맥락을
  채운다.
- Section 2는 `Solution Strategy`, `Core User Flow` 두 subsection만 포함한다.
- Section 2 질문은 최소 해결 방향, 시작 맥락, 순차 사용자 행동, 보이는 제품 반응과 완료
  결과에 부족한 맥락을 채운다.
- Section 3은 선택 Section이다. 명시적인 제외 범위가 없으면 비어 있어도 문서 완료와
  내보내기를 막지 않는다.
- Section 3은 사용자가 확인한 비범위만 하나의 `Explicit Exclusions` 목록으로 포함한다.
- Section 4는 필수이며 `4.1 Demo Scenario` 한 subsection만 포함한다.
- Section 4의 Demo Scenario는 필요한 시작 조건, 순차 행동, 각 행동 뒤의 보이는 예상
  결과와 전체 시나리오의 관찰 가능한 합격 결과를 포함한다.
- 사용자가 작성 모드를 지정하지 않으면 Section별 atomic 승인을 사용한다.
- 사용자가 batch 작성을 명시적으로 요청하거나 여러 Section을 포함한 완전한 구조화 입력을
  제공한 경우에만 batch 승인을 사용할 수 있다.
- 모든 저장은 현재 작성 단위의 제품 의도, 범위, 필수 정보, 적용되는 값과 규칙, 완료 결과를
  포함한 plain-text approval digest의 명시적 승인 뒤에 수행한다.
- 4-Section 문서를 재개하면 `1 → 2 → 3 → 4` 순서상 첫 미완료 필수 Section에서 계속한다.
  Section 3에 명시적 제외 범위가 없으면 건너뛴다.
- Lite ALPS는 현재 상태를 Markdown으로 내보낼 수 있다.
- 작성 내용과 사용자 대화는 사용자가 사용한 언어를 따른다.
- Lite 작성, 재개, 상태 조회와 내보내기는 Full ALPS 문서나 작성 상태를 읽거나 갱신하지
  않는다.
- Full ALPS 작성과 관리도 Lite ALPS 문서나 작성 상태를 읽거나 갱신하지 않는다.
- Lite 행동 평가는 계약상 필요한 제품 정보, 승인과 범위 준수를 검사하고, 계약이 아닌
  사용자 노출 문구나 정확한 질문 표현을 통과 조건으로 요구하지 않는다.

#### Prohibitions

- Lite ALPS 템플릿과 가이드는 기술 스택, C4, API, 데이터베이스, 배포, 라이브러리,
  코드 구조 또는 구현 계층 입력을 요구하지 않는다.
- Lite 작성에 질문 없는 완성 초안 우선 방식이나 별도의 추론 우선 작성 철학을 적용하지
  않는다.
- Lite Section 질문을 사용자가 답할 고정 인터뷰 전체 목록으로 한 번에 제시하지 않는다.
- Lite를 지원하기 위한 공통 규칙을 Full의 기존 스킬, 가이드, wizard와 예시에 역으로
  적용하지 않는다.
- 특정 페르소나 분류법, 최근 경험 증명, 방법론별 문서나 가설 목록을 Lite 완료 조건으로
  요구하지 않는다.
- Feature ID, 상세 상태표, 공통 원칙 목록 또는 구현 준비 정보를 Lite 완성 조건으로
  요구하지 않는다.
- 사용자 확인 없이 수치, 권한, 범위, 상태, 제한과 성공 기준을 확정하지 않는다.
- 명시적 입력이 없는 제외 범위, 실패 상태, edge case 또는 “PoC가 증명하지 않는 것”을
  Section 3을 채우기 위해 발명하지 않는다.
- Demo Scenario를 기능 목록, 화면 투어 또는 결과 없는 행동 목록으로 작성하지 않는다.
- Demo Scenario와 별도의 Learning Check subsection이나 학습 판단 절차를 요구하지 않는다.
- Lite ALPS 완료를 Full ALPS 완료, 구현 준비 또는 ADR handoff 완료로 표시하지 않는다.
- Full ALPS 작성을 Lite의 다음 단계나 자동 변환 대상으로 안내하지 않는다.
- Lite 문서와 Full ALPS 사이에 Section, Feature, 승인 상태 또는 완료 상태를 동기화하지
  않는다.
- Lite 행동 평가가 특정 자연어 문장, 장식, 추론 출처 레이블 또는 광범위한 금지 정규식에
  맞추도록 사용자 응답을 제한하지 않는다.

#### Failure guarantees

- Lite 문서 초기화, 로드, 저장 또는 내보내기 실패는 기존 문서를 덮어쓰거나 현재 선택된
  문서를 다른 유형으로 변경하지 않는다.
- 잘못된 Section, subsection 식별자 또는 제목은 문서 내용을 변경하지 않고 거부한다.
- 현재 문서를 다른 프로필의 템플릿으로 저장하려는 요청은 문서 내용을 변경하지 않고
  거부한다.
- 현재 4-Section 형식과 다른 Lite 문서는 원본을 변경하지 않고 거부한다.

#### Observable evidence

| Obligation                          | Observable evidence                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| Full 작성 방식을 보존한다.          | Full 스킬, 9개 가이드, overview와 Full 템플릿 작성 규칙이 Lite 도입 직전 기준과 동일하다. |
| Lite는 같은 대화 흐름을 사용한다.   | 각 Section은 목적 설명 뒤 1개, 최대 2개 질문으로 맥락을 보완하고 답변을 통합한다.         |
| Lite 문서는 4개 Section을 가진다.   | 상태와 내보내기에 네 Section만 지정된 순서로 나타난다.                                    |
| Overview 입력을 두 항목으로 둔다.   | Section 1은 Target User and Core Problem과 Value and Core Hypothesis만 요구한다.          |
| Solution 입력을 두 항목으로 둔다.   | Section 2는 Solution Strategy와 Core User Flow만 요구한다.                                |
| Section 3은 선택 사항이다.          | 명시적 제외 범위가 없어 Section 3이 비어 있어도 필수 Section 완료 후 내보낼 수 있다.      |
| 제외 범위를 발명하지 않는다.        | Section 3에는 사용자가 명시적으로 확인한 제외 항목만 나타난다.                            |
| Demo Scenario가 인수 테스트가 된다. | Demo Scenario만 읽고 흐름을 실행하고 전체 합격 여부를 판단할 수 있다.                     |
| Full과 독립적으로 관리한다.         | Lite 작성·재개·상태·완료 결과가 Full 문서나 상태를 읽거나 변경하지 않는다.                |
| 기술 입력을 요구하지 않는다.        | Lite 템플릿, 가이드와 스킬에 아키텍처와 구현 선택 단계가 없다.                            |
| 평가가 표현을 고정하지 않는다.      | 의미가 같은 유효 응답이 특정 문구나 장식 형식 차이만으로 실패하지 않는다.                 |
| 실패 시 원본을 보존한다.            | 유효하지 않은 저장이나 프로필 불일치 뒤에도 파일 내용이 요청 전과 같다.                   |

### Alternatives

1. **Full과 별도의 Lite 작성 방법론을 사용한다**
   - 장점: Lite만을 위한 세밀한 대화 최적화가 가능하다.
   - 단점: 템플릿 축약이 아니라 별도 제품이 되고 Full 작성 방식까지 공통 규칙에 맞춰 바뀔 수
     있다.

2. **자유 형식 한 페이지 PoC 메모를 생성한다**
   - 장점: 가장 빠르게 작성할 수 있다.
   - 단점: 승인 경계, 안전한 재개, 구조 검증과 일관된 내보내기를 보장할 수 없다.

3. **기존 Full 작성 방식과 4-Section Lite 템플릿을 사용한다**
   - 장점: 익숙한 AI 대화 경험을 유지하면서 PoC에 필요한 문서량만 줄인다.
   - 단점: Lite 전용 자동완성 최적화보다 사용자와의 대화 횟수가 늘어날 수 있다.

## Consequences

### Positive

- Full ALPS 사용자는 Lite 도입 전과 같은 작성 경험을 유지한다.
- Lite 사용자는 Full과 같은 방식으로 AI와 대화하며 부족한 맥락을 채운다.
- Lite는 구현 준비 문서가 아닌 간소화된 제품·PoC 문서로 남는다.
- 같은 승인, 저장, 재개 모델을 두 프로필에서 재사용한다.
- Lite 행동 평가가 자연어 문구보다 실제 제품 계약을 검증한다.
- Lite와 Full의 파일 및 상태 수명주기는 독립적으로 유지된다.

### Negative

- Lite도 사용자 답변을 기다리는 대화 단계가 필요하다.
- Lite만을 위한 강한 자동완성이나 방법론별 인터뷰 최적화는 제공하지 않는다.
- Full 기준 동작을 보존하는 검증이 필요하다.

### Risks

- Lite 질문을 지나치게 줄이면 필요한 제품 맥락이 빠질 수 있다. 네 Section의 필수 항목은
  대화로 확인한다.
- Full 기준을 문자 그대로 복제하면서 Lite에 불필요한 구현 질문까지 가져올 수 있다.
  Lite 가이드는 4-Section 제품 범위만 질문한다.
- 평가를 느슨하게 만들면서 승인 없는 저장이나 명시적 범위 위반까지 놓칠 수 있다. 계약과
  안전 결과 검사는 유지한다.
- optional Section 3을 관성적으로 채우면 작성 부담이 커질 수 있다.

## Related

- [ALPS 작성 승인 방식](../authoring-interaction/0001-support-atomic-and-batch-approval.md)
