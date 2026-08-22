# Decision Log: alps-authoring/lite-format

This document is the **major decision-change history** of the alps-authoring/lite-format category.
Each ADR body describes only the current state, while the timeline of "what changed and why"
accumulates here, newest first. Git preserves the individual diffs.

## 2026-08-22 — Reduce Lite ALPS to four PoC-focused sections

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: architecture and requirement rule change
- **What**: Eight implementation-preparation-oriented sections → three required sections for build,
  behavior, and demo plus one optional explicit-exclusion section; legacy eight-section documents
  remain editable without automatic conversion.
- **Why**: Lite ALPS should minimize authoring before a PoC and remain completely separate from the
  goal, authoring process, and management lifecycle of Full ALPS.

## 2026-08-22 — Anchor Lite authoring in one persona's core ideal use cases

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: requirement rule change
- **What**: One representative ideal path → one confirmed Primary Persona with one or more core
  ideal use cases, each carrying an explicit intent, sequential user actions, and an observable
  completion result.
- **Why**: Lite PRD conversations need one stable user perspective while still covering the few
  ideal use cases that reveal the product's core intent.

## 2026-08-20 — Make edge-oriented Lite ALPS inputs optional

- **Current ADR**: [lite-alps-authoring-profile](./0001-lite-alps-authoring-profile.md)
- **Change type**: requirement rule change
- **What**: Mandatory exclusion, interruption, exception, screen-state, and recovery inputs →
  optional inputs included only when they affect the mockup or PoC.
- **Why**: Lite ALPS should prioritize the representative ideal path and leave nonessential edge
  cases for later product and implementation work.

<!-- adr-writer:rules-version 0.8.0 — seeded by /adr-new. `adr-structure-lint` warns when this trails the installed plugin; refresh with /adr-new (it re-seeds a stale doc set). Keep this line on re-seed. -->
