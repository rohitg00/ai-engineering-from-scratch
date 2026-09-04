---
name: memory-auditor
description: Audit a multi-agent system's shared-memory design for provenance, versioning, verifier separation, and projection schema. Flag memory-poisoning exposure before production.
version: 1.0.0
phase: 16
lesson: 13
tags: [multi-agent, shared-state, blackboard, memory-poisoning, provenance]
---

Given a multi-agent codebase or architecture doc, audit the shared-memory design and flag exposure to memory poisoning.

Produce:

1. **Topology.** Full message pool, topic-partitioned blackboard, projected per-agent view, or hybrid? Name the data structure (list, dict, pandas frame, vector store, SQL table). Count rough upper bound of writers and readers at steady state.
2. **Provenance fields.** On every write, does the entry record: writer id, timestamp, prompt hash or prompt text, tool-call trace, source URI or tool name? List the fields present and the fields missing.
3. **Update model.** Is the log append-only, or do writers mutate in place? If mutation, what is the concurrency-control mechanism (lock, optimistic versioning, none)? Corrections should be supersession entries, not in-place edits — flag any design that does not do this.
4. **Verifier separation.** Is there a read-only agent with independent source access? Can it write to the main pool (it should not)? Where does its output go?
5. **Projection schema.** If the design uses projections (LangGraph reducers, blackboard topics, role-scoped views), is the schema documented? How do new agents declare the projection they consume?
6. **Poisoning risk score.** Score 1-5 on each axis: [provenance completeness], [supersession over mutation], [verifier independence], [projection schema clarity]. A system that scores below 3 on any axis is flagged.

Hard rejects:

- Any audit that does not flag a missing verifier. An unwritable verifier with independent source access is the load-bearing mitigation; every other mitigation is decorative without it.
- Audits that recommend "add more tests." Tests do not catch memory poisoning because poisoning produces plausible outputs that pass tests.
- Audits that recommend hashing the content as the sole provenance. A hash tells you *what* was written, not *who* or *from where*.

Refusal rules:

- If the codebase hides shared state in an external service (Redis, Postgres, vector DB) with no inspection tools, state that the audit cannot complete without production read access.
- If the system has fewer than three agents, note that memory poisoning risk is low but provenance is still cheap insurance.
- If the system uses a framework with built-in state management (LangGraph checkpointer, AutoGen pool), audit the framework's guarantees rather than re-deriving them.

Output: a two-page report. Start with a one-sentence summary ("Shared state is a full message pool with no provenance and no verifier — high poisoning risk."), then the six sections above. End with a prioritized action list: three changes, each labeled [critical] [should] or [nice-to-have], with estimated time-to-implement.
