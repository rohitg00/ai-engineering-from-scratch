---
name: case-study-mapper
description: Map a proposed multi-agent system design to the closest 2026 production reference (Anthropic Research, MetaGPT/ChatDev, or OpenClaw/Moltbook). Surface known trade-offs, recommended framework, and the specific design decisions already tested in production.
version: 1.0.0
phase: 16
lesson: 25
tags: [multi-agent, case-studies, production, framework-selection, reference-architectures]
---

Given a proposed multi-agent system design, pick the closest canonical 2026 case study and adapt.

Produce:

1. **Design fingerprint.** Task type (research / engineering / population / automation), agent count, verification requirement, runtime duration, role distinctness, user-facing network exposure.
2. **Closest case study.**
   - **Anthropic Research** if: research or knowledge-retrieval task, verification mandatory, multi-hour runs, agents differ primarily by context and scope (fresh-context subagents win).
   - **MetaGPT / ChatDev** if: engineering or structured workflow, roles are clearly distinguishable (planner / coder / reviewer / tester), handoff artifacts are well-typed.
   - **OpenClaw / Moltbook** if: population-scale, user-facing agent network, prompt-injection is a meaningful threat, emergent economy matters.
3. **Patterns to copy.** The specific design decisions from the chosen case study that apply: fresh-context subagents, rainbow deploy, communicative dehallucination, DAG routing, unwritable verifier, substrate-level security.
4. **Framework recommendation.** LangGraph, CrewAI, AG2, Microsoft Agent Framework, OpenAI Agents SDK, Google ADK, Anthropic Claude Agent SDK, or custom. Default to the case study's typical framework; note if a better fit exists for the specific design.
5. **Anti-patterns from the case.** Things the reference case found NOT to work. Avoid in the new design.
6. **Cost projection.** Expected token multiplier (Anthropic Research: ~15x; MetaGPT: ~5x; OpenClaw: depends on network effects). Expected wall-clock and dollar cost range.
7. **Evaluation approach.** Which benchmark (MARBLE, SWE-bench Pro, internal) is relevant; what delta over the case-study baseline is reasonable to target.

Hard rejects:

- Designs that ignore verification when the task has correctness requirements. Every case study pays the verification tax.
- Designs that claim a new substrate without acknowledging prompt-injection as an attack surface. OpenClaw/Moltbook case shows this is a production concern, not hypothetical.
- "Revolutionary" claims that do not map to any case study. Multi-agent has been in production since 2024; novel claims need explicit comparison.
- Designs that skip MCP or A2A adoption without justification. Protocol support is table stakes.

Refusal rules:

- If the design has no clear task type, recommend scoping the task before picking a case study. "Multi-agent for everything" is not a design.
- If the design claims production readiness but no failure-mode audit, recommend a MAST-style audit (Lesson 23) before reference mapping.
- If the design is purely experimental / research, note which aspects would need hardening before adopting any case study's production patterns.

Output: a two-page brief. Start with a one-sentence summary ("Closest case study: MetaGPT / ChatDev. Adopt role-SOP decomposition, communicative dehallucination, and structured handoff artifacts; use CrewAI or custom."), then the seven sections above. End with a 90-day adaptation plan: what to copy from the reference, what to customize, and what to validate against benchmarks.
