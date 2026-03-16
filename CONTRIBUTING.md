# Contributing Guide

This document defines the rules to follow when contributing to the PRD Writer MCP Server project.

## Table of Contents

- [Commit Message Convention](#commit-message-convention)
- [Branch Strategy](#branch-strategy)
- [Code Style](#code-style)
- [Pull Request](#pull-request)

---

## Commit Message Convention

We follow the [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) specification.

### Format

```
<type>(<scope>): <subject>

[body]

[footer(s)]
```

### Type (required)

| Type       | Purpose                                     | SemVer Impact |
| ---------- | ------------------------------------------- | ------------- |
| `feat`     | New feature                                 | MINOR         |
| `fix`      | Bug fix                                     | PATCH         |
| `refactor` | Code refactoring without behavior change    | -             |
| `docs`     | Documentation changes                       | -             |
| `test`     | Adding or updating tests                    | -             |
| `chore`    | Build config, dependency updates, etc.      | -             |
| `style`    | Code formatting (no logic change)           | -             |
| `perf`     | Performance improvement                     | -             |
| `ci`       | CI/CD configuration changes                 | -             |
| `build`    | Build system or external dependency changes | -             |

### Scope (optional)

| Scope       | Target                                  |
| ----------- | --------------------------------------- |
| `server`    | MCP server entry point (`src/index.ts`) |
| `templates` | Template tools (`src/tools/templates/`) |
| `documents` | Document tools (`src/tools/documents/`) |
| `guides`    | Section guides (`src/guides/`)          |
| `deps`      | Dependencies (`package.json`)           |

### Subject (required)

- Start with lowercase
- Use imperative mood: "add", "fix", "change" (O) / "added", "fixes", "changed" (X)
- No period at the end
- 50 characters recommended (72 max)

### Body (optional)

- Explain **why** the change was made when the subject is not sufficient
- Separate from subject with a blank line
- Wrap at 72 characters per line

### Footer (optional)

- `BREAKING CHANGE: <description>` — Breaking change (SemVer MAJOR)
- `Refs: #<issue>` — Related issue reference

### Good Examples

```
feat(templates): add section dependency validation
```

```
fix(documents): handle missing subsection on read
```

```
docs: update README with Kiro configuration guide
```

```
chore(deps): bump @modelcontextprotocol/sdk to 1.13.0
```

### Bad Examples

```
# No type
Update document service

# Past tense
feat: Added export feature

# Too vague
update stuff

# Multiple changes in one commit
feat(documents): add export and fix parsing and update README
```

### Atomic Commits

Each commit should contain exactly one logical change:

- Don't mix feature additions with bug fixes
- Don't mix refactoring with behavior changes
- Split large changes into multiple commits

---

## Branch Strategy

### Branch Naming

```
<type>/<short-description>
```

| Prefix      | Purpose       | Example                     |
| ----------- | ------------- | --------------------------- |
| `feat/`     | New feature   | `feat/section-validation`   |
| `fix/`      | Bug fix       | `fix/xml-parsing-edge-case` |
| `refactor/` | Refactoring   | `refactor/document-service` |
| `docs/`     | Documentation | `docs/contributing-guide`   |
| `chore/`    | Maintenance   | `chore/update-dependencies` |

### Workflow

1. Create a new branch from `main`
2. Make changes and commit (following the convention above)
3. Create a Pull Request
4. Merge to `main` after review

```bash
git checkout main
git pull origin main
git checkout -b feat/my-feature
# ... work ...
git add <files>
git commit -m "feat(scope): add my feature"
git push -u origin feat/my-feature
```

---

## Code Style

### Linting & Formatting

This project uses **ESLint** for linting and **Prettier** for code formatting.

```bash
pnpm lint            # Run ESLint on src/
pnpm lint:fix        # Run ESLint with auto-fix
pnpm format          # Format all files with Prettier
pnpm format:check    # Check formatting without writing
```

- Run `pnpm lint` and `pnpm format:check` before committing to ensure code quality
- ESLint config: `eslint.config.mjs` (flat config with typescript-eslint)
- Prettier config: `.prettierrc`

### Prettier Rules

| Rule            | Value   |
| --------------- | ------- |
| `semi`          | `true`  |
| `singleQuote`   | `false` |
| `trailingComma` | `"all"` |
| `tabWidth`      | `2`     |
| `printWidth`    | `100`   |

### TypeScript

- TypeScript 5.9+ with strict mode
- ES modules (`"type": "module"`)
- Follow existing patterns in the codebase

### Project Structure

```
src/
├── index.ts              # MCP server entry point + tool registration
├── constants.ts          # Section titles, references, paths
├── tools/
│   ├── templates/        # Template tools (controller + service)
│   └── documents/        # Document tools (controller + service)
├── guides/               # Section conversation guides (01-09.md)
└── templates/            # PRD templates (overview.md + chapters/*.xml)
```

### Key Patterns

- **Controller/Service separation**: Controllers define the MCP tool interface, services contain business logic
- **Constants centralized**: All section metadata in `constants.ts`
- **Static assets**: Templates and guides are read from filesystem at runtime

---

## Pull Request

### PR Title

Use the same Conventional Commits format as commit messages:

```
feat(documents): add batch export support
```

### PR Body

```markdown
## Summary

Summarize changes in 1-3 bullet points.

## Motivation

Explain why this change is needed.

## Changes

- Detailed list of changes

## Test Plan

- [ ] Existing functionality verified
- [ ] New scenarios tested manually
```

### Merge Rules

- Use squash merge by default
- Merge commit message must follow Conventional Commits format
- Do not push directly to `main`
