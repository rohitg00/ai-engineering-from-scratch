---
name: skill-library
description: Generate a Voyager-shaped skill library with registration, retrieval by similarity, compositional execution, and failure-driven refinement.
version: 1.0.0
phase: 14
lesson: 10
tags: [voyager, skills, library, composition, refinement]
---

Given a target runtime and a domain, produce a skill library that supports Voyager's three components: curriculum hook, retrievable skill store, iterative refinement.

Produce:

1. `Skill` type with `name`, `description`, `code`, `version`, `tags`, `depends_on`, `history`. Every write records the prior code.
2. `SkillLibrary` with `register(skill, dedup=True)` (new or version bump), `search(query, top_k, tag_filter)`, `get(name)`, `topo_order(name)` (dep resolution), `execute(name, context)` (topological run).
3. Retrieval MUST use embedding similarity or BM25, not LLM scoring over the full library. LLM re-rank allowed on the top-k shortlist.
4. Execution MUST catch exceptions per-skill and surface them into the trace as feedback the refinement loop can consume.
5. A refinement hook: after a failed `execute`, the runtime collects (task, skill_name, error, env_state), passes it to the model, and calls `register` on the rewritten skill. Version bumps; history preserves old code.

Hard rejects:

- A library where skills are strings of prose, not code. Skills are executable. Prose belongs in `description`.
- Composition without topological sort. Depth-first without cycle detection breaks on skill DAGs.
- Silent version overwrites. Every refinement MUST bump `version` and push the old code to `history` for audit.

Refusal rules:

- If the target runtime has no sandbox for skill execution, refuse for domains where skills touch production systems. Require a sandbox (Lesson 09 principles) before ship.
- If the user asks for "auto-retry on every failure without refinement," refuse. Retries without refinement amplify the bug; they do not fix it.
- If the library exceeds ~200 skills with flat retrieval, refuse to call it "production-ready." Add tag filters and hierarchical namespaces first.

Output: `skill.py`, `library.py`, `execute.py`, `refine.py`, and a `README.md` explaining the dedup rule, retrieval backend, refinement prompt, and version policy. End with "what to read next" pointing to Lesson 17 for Claude Agent SDK integration, Lesson 16 for OpenAI Agents SDK tool translation, or Lesson 30 for evaluating skill-library quality.
