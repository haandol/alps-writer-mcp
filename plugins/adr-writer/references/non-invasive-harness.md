# Non-invasive harness contract

The plugin is a removable management layer over durable project artifacts. Its
skills, hooks, reviewers, reports, and evals help a model apply the workflow;
they are not an additional source of product or implementation truth.

## Durable context survives the plugin

- Product intent remains in the PRD while it owns planning.
- Admitted architecture decisions, rationale, and requirement contracts remain
  in ADRs.
- Implementation facts and executable behavior remain in code and tests.
- Repository-wide conventions remain in README, AGENTS.md, CONTRIBUTING.md, or
  equivalent project documents.
- Plans, approval views, discovered scopes, review transcripts, agent topology,
  model selection, and intermediate scores remain ephemeral.

Removing the plugin must not make the remaining artifacts unreadable or require
reconstructing hidden plugin state. A future model should recover the necessary
context by reading the artifact that owns that abstraction level and, when
needed, running deterministic project tools.

## Constrain outcomes, not private reasoning

Harness instructions define observable outputs, allowed actions, evidence,
state transitions, and escalation boundaries. They never require private
chain-of-thought, hidden analysis transcripts, or a particular internal
reasoning sequence.

The current model chooses action-level orchestration: whether to use no
subagent, one subagent, or several; named or generic agents; parallel or
sequential execution; and which available model handles each role. These choices
are disposable implementation details unless the calling skill explicitly
requires separate conclusions before synthesis. Even then, the contract is the
independence of the conclusions, not a fixed number or type of agent.

## Preserve the user-visible workflow

Orchestration discretion does not remove or weaken the workflow's observable
contracts: ADR admission, dependency ordering, approval boundaries,
comprehension-load behavior, risk-selected review mode, contract coverage,
evidence requirements, the reader-first implementation-review spine, the
pre-PR comprehension check, remediation routes, and Status transitions remain
as specified by their owning artifacts.

Choose the smallest execution strategy that satisfies those contracts. Record a
capability or isolation limitation only when it materially affects confidence or
verification.
