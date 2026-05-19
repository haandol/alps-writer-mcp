# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Refer to AGENTS.md for project structure, tech stack, architecture, code style, and development commands.

- [AGENTS.md](./AGENTS.md) - Project overview, architecture, commands, conventions

## Diagram convention

When you need to draw a diagram in any file in this project (READMEs, ADRs, AGENTS notes, plugin docs, templates), always reach for **Mermaid** first (`flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `erDiagram`). Do not author ASCII / box-drawing diagrams (`─│┌┐└┘├┤┬┴┼` etc.) unless the user explicitly asks for one — they render poorly on GitHub and the web, and Mermaid is supported wherever this plugin's docs are read. The same rule applies to anything the plugin's templates, skills, or commands generate inside user projects.

**Exception**: directory trees (`tree`-style listings using `├── └──`) are an established convention and may stay as plain text inside fenced code blocks — they are not "diagrams" in the flow/relationship sense.
