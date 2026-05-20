---
name: alps-init
description: Bootstrap an ALPS (PRD) document via the alps-writer MCP server. Use when the user invokes /alps-init or asks to start a new ALPS/PRD document or resume an existing .alps.xml. Keywords - "/alps-init", "ALPS 시작", "PRD 작성 시작", "start a new PRD".
disable-model-invocation: true
---

# alps-init

ALPS (PRD) 작성을 시작합니다.

1. 사용자에게 신규 문서를 만들지, 기존 `.alps.xml` 을 이어 작성할지 확인.
2. `mcp__alps-writer__init_alps_document` 또는 `mcp__alps-writer__load_alps_document` 호출.
3. `mcp__alps-writer__get_alps_overview` 를 호출하여 9 개 섹션 작성 가이드를 받아온다.
4. Section 1 부터 차례로:
   - `get_alps_section_guide(N)` → `get_alps_section(N)` → 사용자에게 1-2 개 질문 → 확인 후 `save_alps_section(N, ...)`
5. Section 7 작성이 끝나면 사용자에게 `/feature-to-adr` 로 일괄 ADR 변환을 시작할지 묻는다 (helper 경로). 한 결정만 직접 작성하고 싶다면 `/adr-new <category>` 도 안내한다.

**규칙**: 절대 여러 섹션을 한 번에 생성하지 않는다. 사용자 확인 없이 저장하지 않는다.
