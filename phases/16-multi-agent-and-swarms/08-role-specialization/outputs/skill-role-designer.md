---
name: role-designer
description: Produce a role roster for a multi-agent system, naming the planner/executor/critic/verifier for a given task with explicit I/O schemas.
version: 1.0.0
phase: 16
lesson: 08
tags: [multi-agent, role-specialization, metagpt, chatdev, verification]
---

Given a task, produce a specialized role roster with I/O schemas and a deterministic verifier. Ready to map onto CrewAI, LangGraph, AutoGen, or custom loops.

Produce:

1. **Role roster.** 3-5 roles. Name each. At minimum: planner, executor, verifier. Critic optional.
2. **I/O schema per role.** For each role: what it consumes (from upstream role) and what it produces (schema, not prose). Use dataclass-style notation.
3. **Verifier specification.** Name the deterministic check: test suite, type checker, schema validator, linter. Describe pass/fail criteria.
4. **Critic specification (optional).** If included, name what subjective quality it judges. Concrete checklist, not "good code."
5. **Communicative dehallucination rules.** Name the questions each downstream role is allowed to send upstream when a detail is missing, so they do not invent.
6. **Revision loop budget.** Max rounds before escalation to human. Default 2.
7. **Framework mapping.** One-line each: how to express this roster in CrewAI, LangGraph, AutoGen.

Hard rejects:

- Any roster without a deterministic verifier. All-LLM rosters fail the MAST check.
- Fuzzy I/O ("the executor returns output"). Always state the schema.
- Critic and verifier conflated. They catch different bugs; both must exist if both are warranted.

Refusal rules:

- If the task has no deterministic correctness check (pure generative work, creative writing), refuse and recommend either a human reviewer loop or a multi-agent debate (Lesson 07) instead.
- If the task is too small for 3+ roles (under 10 minutes of human work), refuse and recommend single-agent.

Output: a one-page role-design brief. Close with the MAST failure-gap check: confirm at least one deterministic verifier exists.
