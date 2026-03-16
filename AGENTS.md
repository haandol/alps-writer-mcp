# AGENTS.md

PRD Writer — MCP 서버 기반의 인터랙티브 PRD (Product Requirements Document) 작성 도구. `prd-mcp-server`로 npm 배포.

## Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Compile TypeScript + copy templates & guides to dist/
pnpm dev              # Run with tsx in watch mode (development)
pnpm start            # Run built version (node dist/index.js)
```

빌드 시 `tsc && cp -r src/templates dist/ && cp -r src/guides dist/`로 정적 자산(XML 템플릿, MD 가이드)을 `dist/`에 복사한다. 서버가 런타임에 `fs.readFileSync`로 읽기 때문에 필수.

테스트 프레임워크 미구성.

## Architecture

**MCP Server** (`src/index.ts`) — 진입점. `McpServer` 인스턴스 생성, Zod 스키마로 모든 도구 등록, `StdioServerTransport`로 연결. Tool handler는 controller에 위임하는 thin wrapper.

**Controller/Service 패턴** — 도메인별 controller(MCP 인터페이스)와 service(비즈니스 로직) 분리:

- `src/tools/templates/` — PRD 템플릿·대화 가이드 읽기 전용
- `src/tools/documents/` — 문서 CRUD (init, load, save, read, export) 상태 관리

**Constants** (`src/constants.ts`) — 섹션 메타데이터 중앙 관리: 타이틀(1-9), 의존성 그래프(`SECTION_REFERENCES`), `__dirname` 기반 파일시스템 경로.

**Static assets** (런타임 파일시스템 읽기):

- `src/templates/chapters/01-09.xml` — XML 섹션 템플릿
- `src/templates/overview.md` — PRD 개요
- `src/guides/01-09.md` — 섹션별 대화 가이드

**Document format** — `.prd.xml` 파일에 `<prd-document>`, `<section>`, `<subsection>` 태그로 저장. regex로 파싱 (XML 파서 라이브러리 미사용). 출력 디렉토리는 `PRD_OUTPUT_DIR` 환경변수로 제어.

**DocumentService state** — `workingDoc`이 현재 문서 경로를 메모리에 보유. `initDocument()` 또는 `loadDocument()` 호출 후에만 read/write 가능.

## Conventions

- TypeScript strict mode, ES modules (`"type": "module"`)
- Node.js >= 20
- pnpm as package manager
- Conventional Commits (상세: CONTRIBUTING.md)
- Scopes: `server`, `templates`, `documents`, `guides`, `deps`
- Branch naming: `<type>/<short-description>` (e.g., `feat/section-validation`)
