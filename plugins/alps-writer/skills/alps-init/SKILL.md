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
4. Section 1 부터 **한 섹션씩** 차례로:
   - `get_alps_section_guide(N)` → `get_alps_section(N)` → 사용자에게 1-2 개 질문 → 완성본을 보여주고 확인 → 확인 후 `save_alps_section(N, ...)` → 확인된 뒤에만 다음 섹션으로 이동
   - 섹션을 임의로 건너뛰지 않는다. 사소해 보여도 사용자가 보고 승인해야 다음으로 넘어간다.
5. **Section 7 (Feature-Level Specification)** 은 특히 주의한다. 각 Feature 서브섹션(7.1, 7.2, …)을 **하나씩 개별로** 확인·저장한다. 작아 보이거나 앞 Feature 와 비슷해 보여도 묶어서 넘기지 말고 7.x 마다 따로 확인 단계를 거친다.
6. Section 7 작성이 끝나면 사용자에게 `/feature-to-adr` 로 일괄 ADR 변환을 시작할지 묻는다 (helper 경로 — adr-writer 플러그인 필요). 한 결정만 직접 작성하고 싶다면 adr-writer 의 `/adr-new <category>` 도 안내한다. 두 경로 모두 adr-writer 플러그인 설치가 전제이며, 미설치 시 현재 클라이언트에 맞게 Codex 는 `codex plugin add adr-writer@alps-writer`, Claude Code 는 `/plugin install adr-writer@alps-writer` 를 안내한다.

**규칙**: 절대 여러 섹션을 한 번에 생성하지 않는다. 사용자 확인은 섹션 단위로 받으며, 어떤 섹션도 사용자 승인 없이 건너뛰지 않는다. Section 7 은 모든 Feature 서브섹션(7.x)을 개별로 확인한다. 사용자 확인 없이 저장하지 않는다.
