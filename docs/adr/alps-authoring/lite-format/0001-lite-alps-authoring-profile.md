# ADR 0001: Lite ALPS 작성 프로필을 제공

Date: 2026-08-20

## Status

Accepted (2026-08-20)

## Context

기획자와 PM은 기술 구조를 결정하기 전에 제품 의도와 사용자 흐름을 정리하고 목업이나
PoC로 검증하려 한다. 기존 ALPS는 구현과 ADR handoff까지 준비하기 위해 아키텍처, 기능별
수직 슬라이스, NFR과 측정 계획을 포함하므로 이 단계에는 작성 부담이 크다.

자유 형식의 짧은 PRD는 작성은 빠르지만 사용자 행동, 핵심 규칙과 관찰 가능한 완료 결과를
일관되게 남기지 못한다. 반대로 모든 제외 범위와 edge case를 필수로 요구하면 목업과 PoC가
검증할 ideal path보다 구현 준비에 가까운 상세 작성에 시간을 쓴다. Lite 문서는 ALPS의 AI
주도 작성, 명시적 승인과 재현 가능한 제품 요구사항 원칙을 유지하면서 대표 흐름에
집중해야 한다.

## Decision Drivers

- 기술 지식이 없는 기획자와 PM이 사용하는 제품 기획 용어로 작성해야 한다.
- 완성된 문서만 읽고 핵심 목업과 PoC의 ideal path와 성공 조건을 재현할 수 있어야 한다.
- 구현 기술과 아키텍처를 요구하지 않으면서 제품 동작을 바꾸는 값과 규칙은 보존해야 한다.
- 제외 범위와 edge case 작성이 대표 흐름 검증을 지연시키지 않아야 한다.
- 기존 ALPS 문서와 작성 흐름은 변경 없이 계속 동작해야 한다.

## Decision

ALPS Writer는 기존 ALPS와 함께 **Lite ALPS 작성 프로필**을 제공한다. Lite ALPS는 같은
AI 주도 질문, 승인, 저장, 재개, 상태 조회와 Markdown 내보내기 흐름을 사용하며 목업과
PoC 검증에 필요한 제품 의도와 관찰 가능한 동작만 작성한다.

Lite ALPS의 문서 순서는 다음과 같다.

1. Product Overview
2. MVP Goals and Scope
3. Primary User Scenario
4. Key Features and Behavior
5. Key Screens
6. Shared Product Principles
7. PoC Validation Plan
8. Open Questions

작성 순서는 기능과 공통 원칙에서 화면을 도출할 수 있도록
`1 → 2 → 3 → 4 → 6 → 5 → 7 → 8`을 사용한다.

Section 2는 MVP에 포함되는 기능을 `F1`, `F2` 형식으로 식별한다. Section 4는 각 기능의
사용자 목적, 시작 조건, 사용자 행동과 제품 반응, 필수 정보와 적용 기준, 관찰 가능한 완료
결과를 구체화한다. 목업과 PoC에 필요한 상태와 예외만 추가한다. Section 5의 화면은
Section 3의 시나리오와 Section 4의 기능에서 도출하고 같은 기능 식별자를 사용한다.

Lite ALPS는 목업과 PoC 작성 입력이다. 구현 준비가 완료된 Full ALPS로 간주하지 않으며
자동으로 ADR 소유권 handoff를 시작하지 않는다. PoC 검증에 필요하지 않은 edge case는
Open Questions에 후속 항목으로 남기거나 이후 Full ALPS와 ADR 단계에서 구체화한다.

### Requirement contract

#### Required guarantees

- `lite-alps-init`은 새 Lite ALPS 작성과 기존 Lite ALPS 재개를 모두 지원한다.
- Lite ALPS 파일명은 `lite`, `alps`, `xml` 세 suffix segment를 점으로 연결한다.
- Lite ALPS 문서는 정확히 8개 Section을 위 순서와 제목으로 가진다.
- Lite ALPS 작성은 한 번에 1개, 최대 2개의 집중 질문을 사용한다.
- 사용자가 작성 모드를 지정하지 않으면 Section별 atomic 승인을 사용한다.
- 사용자가 batch 작성을 명시적으로 요청하거나 여러 Section을 포함한 완전한 구조화 입력을
  제공한 경우에만 batch 승인을 사용할 수 있다.
- 모든 저장은 현재 작성 단위에 적용되는 요구사항 값, 권한, 상태, 제한, 범위, 실패 보장과
  성공 조건을 포함하는 plain-text approval digest의 명시적 승인 뒤에 수행한다.
- Out of Scope는 선택 항목이다. 사용자가 명시할 제외 대상이 없으면 비어 있어도 Section 2
  완료를 막지 않는다.
- Primary Scenario의 중단 상황은 선택 항목이다. PoC의 대표 흐름을 바꾸는 중단 상황만
  작성한다.
- Section 4의 Feature `4.x` 하나는 하나의 승인 및 저장 단위다.
- Section 4의 각 Feature는 Section 2에서 선언한 기능 식별자와 이름을 사용한다.
- Section 4의 각 Feature는 사용자 목적, 시작 조건, 사용자 행동과 제품 반응, 필수 정보와
  적용 기준, 관찰 가능한 완료 결과를 포함한다.
- Section 4의 상태와 예외는 선택 항목이다. PoC에서 보여주거나 검증할 상태와 예외만
  작성한다.
- Section 5의 화면은 Section 3과 Section 4에서 필요한 화면만 포함하고 관련 기능 식별자를
  표시한다.
- Section 5의 화면 상태는 선택 항목이다. PoC에서 표현할 상태만 작성한다.
- Section 6의 실패와 복구 원칙은 선택 항목이다. 여러 기능에 공통으로 적용되고 PoC에서
  확인할 원칙만 작성한다.
- Section 7은 Primary Scenario를 사용한 PoC 시연 흐름, 검증 항목과 성공 판정을 포함한다.
- Section 8은 가정, 미해결 사항과 후속 edge case를 확정된 제품 요구사항과 구분한다.
- 기존 Lite ALPS를 재개하면 작성 순서상 첫 미완료 승인 단위에서 계속한다.
- Lite ALPS는 현재 상태를 Markdown으로 내보낼 수 있다.
- 작성 내용과 사용자 대화는 사용자가 사용한 언어를 따른다.
- 기존 전체 ALPS 문서는 9개 구간의 기존 형식으로 해석하고 기존 작성·검증 규칙을 유지한다.
- 문서 로더는 기존 ALPS와 Lite ALPS를 구분하고 현재 문서에 맞는 Section 제목, 템플릿,
  가이드와 저장 검증을 사용한다.

#### Prohibitions

- Lite ALPS 템플릿과 가이드는 기술 스택, C4, API, 데이터베이스, 배포, 라이브러리,
  코드 구조 또는 구현 계층 입력을 요구하지 않는다.
- Section 4의 Feature를 UI, API와 Data 기술 계층으로 분해하지 않는다.
- 화면이 시나리오와 Feature에 없는 제품 범위를 새로 만들지 않는다.
- 사용자 확인 없이 수치, 권한, 범위, 상태, 제한과 성공 기준을 확정하지 않는다.
- 선택 항목을 채우기 위해 제외 범위, 중단 상황, 오류 상태 또는 복구 규칙을 발명하지 않는다.
- 사용자가 확정한 제한, 권한, 상태 또는 실패 보장을 후속 edge case로 분류해 생략하지 않는다.
- 가정과 미해결 사항을 확정된 제품 요구사항으로 저장하지 않는다.
- Lite ALPS 완료를 Full ALPS 완료 또는 ADR handoff 완료로 표시하지 않는다.
- Lite 문서 형식이 기존 ALPS의 Section, 템플릿, C4 검증 또는 Feature 저장 경계를
  변경하지 않는다.

#### Failure guarantees

- Lite 문서 초기화, 로드, 저장 또는 내보내기 실패는 기존 문서를 덮어쓰거나 현재 선택된
  문서를 다른 유형으로 변경하지 않는다.
- 잘못된 Section, subsection 식별자 또는 제목은 문서 내용을 변경하지 않고 거부한다.
- Lite 문서를 기존 ALPS 템플릿으로 저장하거나 기존 ALPS를 Lite 템플릿으로 저장하려는
  요청은 문서 내용을 변경하지 않고 거부한다.

#### Observable evidence

| Obligation                        | Observable evidence                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Lite 문서는 8개 Section을 가진다. | 새 Lite 문서의 상태와 내보내기 결과에 지정된 8개 Section만 순서대로 나타난다.                          |
| 기존 ALPS는 호환성을 유지한다.    | 기존 ALPS 문서를 로드하면 9개 Section과 기존 C4·Feature 검증이 그대로 적용된다.                        |
| 승인 뒤에만 저장한다.             | 승인되지 않은 작성 내용은 문서 subsection으로 저장되지 않는다.                                         |
| Feature 저장 경계를 지킨다.       | 승인된 Feature 하나가 다른 Feature와 합쳐지지 않은 `4.x` 항목 하나로 나타난다.                         |
| 선택 항목은 완료를 막지 않는다.   | 제외 범위와 PoC에 불필요한 중단·상태·예외·복구 정보가 없어도 관련 Section과 Feature가 완료로 표시된다. |
| 화면은 기능에서 도출한다.         | 각 주요 화면이 하나 이상의 기존 기능 식별자를 참조하며 새 기능을 선언하지 않는다.                      |
| 기술 입력을 요구하지 않는다.      | Lite 템플릿, 가이드와 작성 스킬에 기술 스택, C4, API·Data 계층 작성 단계가 없다.                       |
| 확정 요구사항은 생략하지 않는다.  | 사용자가 확정한 제한·권한·상태·실패 보장이 Feature나 공통 원칙의 승인 내용에 남는다.                   |
| 가정과 확정 내용을 구분한다.      | Open Questions의 가정과 후속 edge case가 기능의 완료 조건이나 확정 원칙으로 표시되지 않는다.           |
| 재개할 수 있다.                   | 작성 중인 Lite 문서를 다시 로드하면 완료 상태가 유지되고 첫 미완료 단위를 안내한다.                    |
| 실패 시 원본을 보존한다.          | 유효하지 않은 저장이나 다른 프로필의 템플릿 사용 뒤에도 파일 내용이 요청 전과 같다.                    |
| 목업·PoC의 ideal path를 재현한다. | 내보낸 문서만으로 대표 시나리오, 주요 기능, 화면과 PoC 성공 판정을 확인할 수 있다.                     |

### Alternatives

1. **기존 전체 형식의 구간을 선택적으로 생략한다**
   - 장점: 별도 문서 형식과 도구가 필요 없다.
   - 단점: 완료 기준이 프로젝트마다 달라지고 기술 중심 Section이 계속 작성 흐름에 노출된다.

2. **작성 스킬만 추가하고 자유 형식 Markdown을 생성한다**
   - 장점: 서버 변경 없이 빠르게 제공할 수 있다.
   - 단점: subsection 검증, 부분 완료 상태, 안전한 재개와 일관된 내보내기를 보장할 수 없다.

3. **기존 MCP에 별도 Lite ALPS 문서 프로필을 추가한다**
   - 장점: 승인과 문서 수명주기 원칙을 공유하면서 템플릿과 검증을 문서 목적에 맞게 분리한다.
   - 단점: 모든 문서 도구가 현재 프로필을 정확히 판별해야 한다.

## Consequences

### Positive

- 기획자와 PM은 기술 선택 없이 목업과 PoC에 필요한 제품 동작을 구조화한다.
- Lite 문서는 ideal path와 성공 조건을 우선하며 PoC에 필요한 범위, 상태, 권한과 실패 조건만
  명시적으로 보존한다.
- 기존 ALPS와 Lite ALPS가 같은 승인 및 문서 수명주기 원칙을 사용한다.
- Lite 문서에서 Full ALPS로 확장할 때 제품 의도와 기능 식별자를 재사용할 수 있다.

### Negative

- 템플릿, 가이드, subsection 검증과 상태 계산이 문서 프로필을 구분해야 한다.
- 일부 subsection이 비어 있어도 완료되는 규칙을 작성 도구와 상태 계산이 함께 이해해야 한다.
- Lite ALPS는 구현 준비 문서가 아니므로 구현 handoff 전에 Full ALPS 작성이나 별도 결정
  구체화가 필요하다.

### Risks

- Lite Feature가 지나치게 상세해지면 Full ALPS와 작성 부담이 비슷해질 수 있다.
- 화면 중심 작성이 기능 범위를 새로 만들 수 있다.
- 문서 프로필 판별 오류가 잘못된 템플릿으로 저장을 허용할 수 있다.
- “가벼운 문서”라는 표현 때문에 요구사항 값과 상태 규칙까지 생략할 수 있다.
- 후속 edge case가 Open Questions에 남지 않으면 이후 구현 단계에서 발견 비용이 커질 수 있다.

## Related

- [ALPS 작성 승인 방식](../authoring-interaction/0001-support-atomic-and-batch-approval.md)
