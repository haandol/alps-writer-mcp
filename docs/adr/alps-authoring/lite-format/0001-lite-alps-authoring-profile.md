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

Lite는 사용자가 반드시 확인하려는 제품 행동과 그 행동을 보여주는 데모를 분리해야 한다.
일반적인 사용자 흐름을 먼저 작성하고 다시 데모 절차를 만들면 무엇이 필수 통과 조건인지
불분명하고 같은 행동을 두 번 작성하게 된다. 필수 인수 테스트가 제품 계약을 소유하고
Demo Scenario는 그 테스트를 모두 실행하는 파생 결과여야 한다. 자동 생성된 데모도 저장
전에는 사용자가 전체 내용과 테스트 커버리지를 검토하고 승인해야 한다.

실행 가능한 인수 데모는 승인된 제품 동작을 확인할 뿐 사용자 가치나 시장 타당성을
증명하지 않는다. 작성하지 않은 선택 Section도 최종 Markdown을 미완성 문서처럼 보여서는
안 된다.

## Decision Drivers

- Lite는 Lite 도입 직전 Full ALPS의 대화형 작성 경험을 유지하고, 기존 Full의 스킬, 가이드,
  질문 순서, wizard와 예시는 변경하지 않아야 한다.
- Lite는 첫 PoC에 필요한 제품 맥락만 적은 Section으로 완료할 수 있어야 한다.
- 필수 인수 테스트는 PoC가 반드시 보여줄 제품 행동과 관찰 가능한 통과 조건을 빠짐없이
  기록해야 한다.
- Demo Scenario는 승인된 필수 인수 테스트에서 자동으로 파생되고 각 테스트의 커버리지를
  보여줘야 한다.
- 실행 가능한 데모의 통과 결과를 사용자 가치나 시장 가설의 검증으로 과장하지 않아야 한다.

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
   - `Value and Key Assumption`
2. **Solution and Acceptance Tests**
   - `Solution Strategy`
   - `Required Acceptance Tests`
3. **Out of Scope**
   - 선택 사항인 `Explicit Exclusions`
4. **Demo Scenario**
   - 필수인 `4.1 Demo Scenario`

작성 순서는 `1 → 2 → 3 → 4`다. Section 3은 사용자가 제외 범위를 밝힌 경우에만 작성한다.
명시적 제외가 없고 범위가 모호하지 않으면 별도 질문 없이 Section 3을 건너뛴다.

Required Acceptance Tests는 PoC에서 반드시 확인해야 하는 제품 행동을 기록한다. 각 테스트는
구분 가능한 이름, 시작 조건, 사용자 행동과 관찰 가능한 통과 조건을 포함한다. 테스트는
사용자가 보거나 판단할 수 있는 결과를 사용하고 구현 계층, 내부 상태 또는 주관적인 인상으로
통과를 정의하지 않는다. 템플릿은 이 구조를 그대로 보여주는 완성된 예제를 제공한다.

Section 4 작성자는 승인된 Required Acceptance Tests를 읽고 모든 테스트를 한 번 이상
커버하는 가장 짧은 Demo Scenario를 자동 생성한다. 테스트에 실행 가능한 시작 조건, 행동과
통과 결과가 충분하면 별도 질문 없이 시나리오를 작성한다. 구체적인 입력이나 시작 상태가
없어 실행할 수 없을 때만 한 번에 한 개의 집중 질문으로 보완한다.

작성자는 생성된 Demo Scenario 전체와 각 단계가 커버하는 필수 인수 테스트를 승인 전에
보여준다. 하나의 자연스러운 흐름으로 연결할 수 있으면 공통 단계를 재사용한다. 연결하려면
승인되지 않은 제품 행동을 발명해야 하는 테스트는 같은 Demo Scenario 안의 별도 실행
블록으로 둔다. 전체 데모는 모든 Required Acceptance Test의 통과 조건이 관찰될 때만
통과한다. 데모 통과는 승인된 제품 동작의 인수 결과이며 Key Assumption의 사용자 가치나
시장 타당성을 검증했다는 뜻은 아니다.

Lite Markdown 내보내기는 작성되지 않은 선택 Section을 생략한다. 문서 상태와 원본 Lite
문서는 선택 Section을 포함한 4-Section 구조를 유지한다.

Lite와 Full은 같은 approval digest, atomic/batch 승인과 저장 방식을 사용한다. Lite에
Section 7 동적 Feature 승인, 아키텍처 wizard, NFR wizard 또는 ADR handoff 준비를 추가하지
않는다.

Lite ALPS는 별도 파일 suffix와 프로필을 사용한다. Lite 작성, 재개, 상태 조회와 내보내기는
Full 문서나 Full 작성 상태를 읽거나 갱신하지 않는다. Full 작성도 Lite 문서 상태를
참조하지 않는다.

Lite 행동 평가는 다음과 같은 계약 결과만 확인한다.

- 필요한 제품 맥락을 대화로 수집하는가
- 명시적으로 제공된 범위와 제외 항목을 보존하는가
- Required Acceptance Tests가 반드시 확인할 제품 행동과 통과 조건을 독립적으로 보여주는가
- Demo Scenario가 모든 필수 인수 테스트에서 자동으로 파생되고 커버리지를 보여주는가
- 생성된 Demo Scenario 전체를 승인 전에 확인할 수 있는가
- 작성되지 않은 선택 Section이 질문과 Markdown 출력에 불필요한 부담을 만들지 않는가
- 승인 전에 저장하지 않는가
- Full 상태와 독립적으로 완료되는가

특정 사용자 노출 문장, 질문 문구, 장식 형식, 추론 레이블, 문장 순서와 불필요한 금지 표현은
통과 조건으로 고정하지 않는다.

### Requirement contract

#### Required guarantees

- `lite-alps-init`은 현재 4-Section Lite ALPS 작성과 재개를 지원한다.
- Lite ALPS 파일명은 `lite`, `alps`, `xml` 세 suffix segment를 점으로 연결한다.
- Lite ALPS 문서는 정확히 `Overview`, `Solution and Acceptance Tests`, `Out of Scope`,
  `Demo Scenario` 네 Section을 이 순서로 가진다.
- Lite 작성 흐름은 Lite 도입 직전 Full ALPS와 같이 Section 목적 설명, 한 번에 1개 또는
  최대 2개의 집중 질문, 답변 통합, approval digest, 명시적 승인과 저장 순서를 사용한다.
- Lite를 지원하기 위해 Full ALPS의 스킬, 9개 Section 가이드, overview와 Full Section
  템플릿 작성 규칙을 변경하지 않는다.
- Section 1은 `Target User and Core Problem`, `Value and Key Assumption` 두 subsection만
  포함한다.
- Section 1 질문은 대상 사용자, 핵심 문제, 기대 가치와 PoC 방향을 좌우하는 핵심 가정에
  부족한 맥락을
  채운다.
- Section 2는 `Solution Strategy`, `Required Acceptance Tests` 두 subsection만 포함한다.
- Section 2 질문은 최소 해결 방향과 PoC에서 반드시 확인할 제품 행동에 부족한 맥락을
  채운다.
- 각 Required Acceptance Test는 구분 가능한 이름, 시작 조건, 사용자 행동과 관찰 가능한
  통과 조건을 포함한다.
- Required Acceptance Tests는 구현 계층, 내부 상태 또는 주관적인 인상으로 통과를 정의하지
  않는다.
- Required Acceptance Tests 템플릿은 여러 필수 테스트가 각 필드를 채운 완성된 예제를
  포함한다.
- Section 3은 선택 Section이다. 명시적인 제외 범위가 없으면 비어 있어도 문서 완료와
  내보내기를 막지 않는다.
- Section 3은 사용자가 확인한 비범위만 하나의 `Explicit Exclusions` 목록으로 포함한다.
- 명시적 제외가 없고 승인된 범위가 모호하지 않으면 Section 3을 위한 별도 질문과 저장을
  생략한다.
- Section 4는 필수이며 `4.1 Demo Scenario` 한 subsection만 포함한다.
- Section 4 작성자는 승인된 모든 Required Acceptance Test를 한 번 이상 커버하는 Demo
  Scenario를 자동 생성한다.
- 각 Demo Scenario 단계나 실행 블록은 자신이 커버하는 Required Acceptance Test를
  표시한다.
- 모든 테스트를 하나의 흐름으로 연결하려면 승인되지 않은 제품 행동이 필요한 경우, 같은
  Demo Scenario 안에 별도 실행 블록을 사용한다.
- Required Acceptance Tests에 실행 가능한 정보가 충분하면 Section 4 작성자는 별도 질문
  없이 데모를 생성한다. 구체적인 시작 상태나 입력이 없을 때만 집중 질문으로 보완한다.
- Section 4 작성자는 생성한 Demo Scenario 전체와 테스트 커버리지를 승인 전에 보여준다.
- 전체 Demo Scenario는 모든 Required Acceptance Test의 통과 조건이 관찰될 때만 통과한다.
- Demo Scenario의 통과 결과는 제품 동작의 인수 결과이며 Key Assumption의 사용자 가치나
  시장 타당성 검증 결과로 표시하지 않는다.
- 사용자가 작성 모드를 지정하지 않으면 Section별 atomic 승인을 사용한다.
- 사용자가 batch 작성을 명시적으로 요청하거나 여러 Section을 포함한 완전한 구조화 입력을
  제공한 경우에만 batch 승인을 사용할 수 있다.
- 모든 저장은 현재 작성 단위의 제품 의도, 범위, 필수 정보, 적용되는 값과 규칙, 완료 결과를
  포함한 plain-text approval digest의 명시적 승인 뒤에 수행한다.
- 4-Section 문서를 재개하면 `1 → 2 → 3 → 4` 순서상 첫 미완료 필수 Section에서 계속한다.
  Section 3에 명시적 제외 범위가 없으면 건너뛴다.
- Lite ALPS는 현재 상태를 Markdown으로 내보낼 수 있다.
- Lite Markdown 내보내기는 작성되지 않은 선택 Section을 생략하고 작성된 선택 Section은
  원래 순서에 포함한다.
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
- Required Acceptance Tests를 구현 함수, 내부 상태, 기술 계층 또는 주관적인 품질 인상으로
  작성하지 않는다.
- 사용자 확인 없이 수치, 권한, 범위, 상태, 제한과 성공 기준을 확정하지 않는다.
- 명시적 입력이 없는 제외 범위, 실패 상태, edge case 또는 “PoC가 증명하지 않는 것”을
  Section 3을 채우기 위해 발명하지 않는다.
- 명시적 제외가 없고 승인된 범위가 모호하지 않은데 Section 3을 채우기 위한 질문을 추가하지
  않는다.
- Required Acceptance Tests가 실행 가능한데 사용자가 별도의 데모 흐름을 다시 작성하도록
  요구하지 않는다.
- Demo Scenario에서 승인된 Required Acceptance Test를 누락하거나 테스트에 없는 제품
  행동을 발명하지 않는다.
- Demo Scenario를 테스트 커버리지가 없는 기능 목록, 화면 투어 또는 결과 없는 행동 목록으로
  작성하지 않는다.
- Demo Scenario의 통과를 사용자 가치나 시장 타당성 검증으로 표시하지 않는다.
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

| Obligation                                 | Observable evidence                                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Full 작성 방식을 보존한다.                 | Full 스킬, 9개 가이드, overview와 Full 템플릿 작성 규칙이 Lite 도입 직전 기준과 동일하다.                |
| Lite는 같은 대화 흐름을 사용한다.          | 부족한 맥락만 질문하고 각 Section을 승인한 뒤 저장한다.                                                  |
| Lite 문서는 4개 Section을 가진다.          | 원본 문서와 상태에 네 Section이 지정된 순서로 나타난다.                                                  |
| Overview 입력을 두 항목으로 둔다.          | Section 1은 Target User and Core Problem과 Value and Key Assumption만 요구한다.                          |
| 필수 인수 테스트를 명시한다.               | Section 2는 Solution Strategy와 이름·시작 조건·행동·통과 조건을 가진 Required Acceptance Tests를 담는다. |
| 인수 테스트 예제를 제공한다.               | Section 2 템플릿만 읽어도 여러 필수 테스트를 같은 구조로 작성할 수 있다.                                 |
| Section 3은 선택 사항이다.                 | 명시적 제외 범위가 없어 Section 3이 비어 있어도 필수 Section 완료 후 내보낼 수 있다.                     |
| 빈 선택 Section을 생략한다.                | 작성되지 않은 Section 3은 Markdown에 제목이나 미완성 표시를 남기지 않는다.                               |
| 제외 범위를 발명하지 않는다.               | Section 3에는 사용자가 명시적으로 확인한 제외 항목만 나타난다.                                           |
| Demo Scenario를 자동 생성한다.             | 필수 테스트가 실행 가능하면 추가 데모 질문 없이 완전한 시나리오가 제시된다.                              |
| 모든 필수 테스트를 커버한다.               | Demo Scenario의 단계나 실행 블록에서 각 Required Acceptance Test의 통과 결과를 찾을 수 있다.             |
| 생성된 데모를 승인 전에 보여준다.          | 사용자는 저장 전에 전체 데모 절차와 테스트 커버리지를 검토할 수 있다.                                    |
| Demo Scenario가 전체 인수 결과를 제공한다. | 모든 필수 테스트의 통과 조건이 관찰되어야 전체 데모가 통과한다.                                          |
| 데모의 증명 범위를 제한한다.               | 데모 통과는 제품 동작의 인수 결과로 표시되고 사용자 가치나 시장 타당성 검증으로 표시되지 않는다.         |
| Full과 독립적으로 관리한다.                | Lite 작성·재개·상태·완료 결과가 Full 문서나 상태를 읽거나 변경하지 않는다.                               |
| 기술 입력을 요구하지 않는다.               | Lite 템플릿, 가이드와 스킬에 아키텍처와 구현 선택 단계가 없다.                                           |
| 평가가 표현을 고정하지 않는다.             | 의미가 같은 유효 응답이 특정 문구나 장식 형식 차이만으로 실패하지 않는다.                                |
| 실패 시 원본을 보존한다.                   | 유효하지 않은 저장이나 프로필 불일치 뒤에도 파일 내용이 요청 전과 같다.                                  |

### Alternatives

1. **Full과 별도의 Lite 작성 방법론을 사용한다**
   - 장점: Lite만을 위한 세밀한 대화 최적화가 가능하다.
   - 단점: 템플릿 축약이 아니라 별도 제품이 되고 Full 작성 방식까지 공통 규칙에 맞춰 바뀔 수
     있다.

2. **자유 형식 한 페이지 PoC 메모를 생성한다**
   - 장점: 가장 빠르게 작성할 수 있다.
   - 단점: 승인 경계, 안전한 재개, 구조 검증과 일관된 내보내기를 보장할 수 없다.

3. **일반적인 사용자 흐름과 Demo Scenario를 각각 작성한다**
   - 장점: 제품 여정과 구체적인 데모 절차를 별도로 읽을 수 있다.
   - 단점: 필수 통과 조건이 흐름 안에 묻히고 사용자가 비슷한 행동을 두 번 작성할 수 있다.

4. **Required Acceptance Tests에서 Demo Scenario를 자동 생성한다**
   - 장점: 필수 통과 조건이 먼저 권위를 갖고, 사용자는 같은 흐름을 다시 작성하지 않으며,
     데모 커버리지를 직접 확인할 수 있다.
   - 단점: 필수 테스트가 불완전하거나 서로 연결되지 않으면 데모가 여러 실행 블록으로
     나뉠 수 있다.

## Consequences

### Positive

- Full ALPS 사용자는 Lite 도입 전과 같은 작성 경험을 유지한다.
- Lite 사용자는 Full과 같은 방식으로 AI와 대화하며 부족한 맥락을 채운다.
- Lite는 구현 준비 문서가 아닌 간소화된 제품·PoC 문서로 남는다.
- Required Acceptance Tests가 PoC에서 반드시 보여줄 제품 행동을 명시한다.
- 사용자는 같은 사용자 흐름을 다시 작성하지 않고 자동 생성된 Demo Scenario를 검토한다.
- Demo Scenario는 각 필수 테스트의 커버리지를 보여준다.
- Key Assumption은 데모가 직접 증명하지 않는 제품 판단으로 남아 검증 범위가 과장되지
  않는다.
- 최종 Markdown은 작성하지 않은 선택 Section을 노출하지 않는다.
- 같은 승인, 저장, 재개 모델을 두 프로필에서 재사용한다.
- Lite 행동 평가가 자연어 문구보다 실제 제품 계약을 검증한다.
- Lite와 Full의 파일 및 상태 수명주기는 독립적으로 유지된다.

### Negative

- Lite도 사용자 답변을 기다리는 대화 단계가 필요하다.
- Lite만을 위한 강한 자동완성이나 방법론별 인터뷰 최적화는 제공하지 않는다.
- Full 기준 동작을 보존하는 검증이 필요하다.
- Required Acceptance Tests는 사용자가 관찰할 수 있는 통과 조건까지 명확히 작성해야 한다.

### Risks

- Lite 질문을 지나치게 줄이면 필요한 제품 맥락이 빠질 수 있다. 필수 Section의 입력은
  대화로 확인한다.
- Full 기준을 문자 그대로 복제하면서 Lite에 불필요한 구현 질문까지 가져올 수 있다.
  Lite 가이드는 4-Section 제품 범위만 질문한다.
- 평가를 느슨하게 만들면서 승인 없는 저장이나 명시적 범위 위반까지 놓칠 수 있다. 계약과
  안전 결과 검사는 유지한다.
- 필수 테스트가 모호하면 생성된 데모도 모호해진다. 시작 조건, 행동과 관찰 가능한 통과
  조건을 Section 2 승인 전에 확인한다.
- 연결되지 않는 테스트를 억지로 하나의 여정으로 만들면 승인되지 않은 행동이 추가될 수
  있다. 같은 Demo Scenario 안의 별도 실행 블록으로 보존한다.
- 자동 생성된 데모가 필수 테스트를 누락할 수 있다. 승인 화면에서 테스트별 커버리지를
  보여준다.
- optional Section 3을 관성적으로 질문하거나 출력하면 작성 부담과 미완성 인상을 만든다.

## Related

- [ALPS 작성 승인 방식](../authoring-interaction/0001-support-atomic-and-batch-approval.md)
