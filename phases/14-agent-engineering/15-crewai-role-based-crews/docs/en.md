# CrewAI: Role-Based Crews and Flows

> CrewAI is the 2026 role-based multi-agent framework — Agents, Tasks, Crews, Processes as the four primitives. Production guidance from the docs: "for any production-ready application, start with a Flow."

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 14 (Actor Model)
**Time:** ~60 minutes

## Learning Objectives

- Name CrewAI's four primitives — Agent, Task, Crew, Process — and the role of each.
- Distinguish Crews (autonomous role-based collaboration) from Flows (event-driven deterministic workflows).
- Explain why the docs recommend starting with Flows for production and Crews for exploration.
- Implement a stdlib Crew runner plus a stdlib Flow runner; show when each shines.

## The Problem

Teams adopting multi-agent frameworks hit the same wall: "autonomous collaboration" sounds great, but when customers file a bug you need deterministic replay. CrewAI splits this explicitly — Crews for creative collaboration, Flows for event-driven, auditable, production-shaped workflows.

## The Concept

### Four primitives

- **Agent.** Role + goal + backstory + tools. The backstory is load-bearing — it shapes tone and judgment.
- **Task.** Description + expected_output + assigned agent. Reusable unit of work.
- **Crew.** Container that sequences Agents and Tasks. Owns the execution Process.
- **Process.** Sequential or Hierarchical (with a manager Agent) or Consensual.

### Crews vs Flows

- **Crew.** Autonomous, LLM-driven. Good for open-ended tasks: research, brainstorming, first drafts. The framework picks the shape at runtime.
- **Flow.** Event-driven, code-owned graph. Each step fires on a trigger (function decorator, event match). Good for production: observable, testable, deterministic.

CrewAI 2026 docs say: start production apps with Flows; fold Crews in as sub-steps when autonomy earns its cost.

### Memory system

CrewAI ships four memory types out of the box: short-term (within run), long-term (across runs), entity (per-entity facts), contextual (retrieval-time assembly). Integrations with vector stores are first-party.

### AWS Bedrock integration

CrewAI has documented AWS Bedrock integration with CloudWatch, AgentOps, and Langfuse observability hooks. AWS docs cite a 5.76x speedup vs LangGraph on QA tasks in their benchmarks — take framework-specific numbers as directional, not absolute.

### Dependency shape

Independent of LangChain. Python 3.10–3.13. Uses `uv` for dependency management. 30k+ GitHub stars early 2026.

### Where this pattern goes wrong

- **Crew-as-prod.** Using a free-form Crew in prod without a Flow wrapper. Output variability is high; debugging is painful.
- **Backstory bloat.** 2000-word backstories push out context budget. Keep them tight.
- **Process confusion.** Hierarchical process adds a manager Agent that routes; use only when you have 4+ specialists.

## Build It

`code/main.py` implements stdlib versions of both:

- `Agent`, `Task`, `Crew`, `SequentialCrew` (one task at a time), `HierarchicalCrew` (manager routes).
- `Flow` with `@start()` and `@listen()` decorators (plain-function stand-ins) that fire on named events.
- Same three-step task (research, outline, draft) implemented both ways.

Run it:

```
python3 code/main.py
```

The Crew trace is fluid and variable; the Flow trace is fixed and observable. That is the choice.

## Use It

- **CrewAI Flow** for production.
- **CrewAI Crew** for exploration, pairing, first drafts.
- **LangGraph** (Lesson 13) if you want a more explicit state machine.
- **AutoGen v0.4** (Lesson 14) if you want actor-model concurrency.

## Ship It

`outputs/skill-crew-or-flow.md` picks Crew vs Flow for a task and scaffolds the minimal implementation.

## Exercises

1. Convert a Crew-based demo to a Flow. Count the touchpoints where variability drops.
2. Add entity memory to the Crew: facts about a customer persist across tasks.
3. Implement a Hierarchical process: a manager Agent picks which specialist runs next based on the prior output.
4. Read CrewAI's docs intro. Port your toy to the real `crewai` API. What changes about testability?
5. Wire AgentOps or Langfuse to one of your runs. Which traces did you miss in the stdlib version?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | "Persona" | Role + goal + backstory + tools |
| Task | "Unit of work" | Description + expected output + assignee |
| Crew | "Agent team" | Container for Agents + Tasks + Process |
| Process | "Execution strategy" | Sequential / Hierarchical / Consensual |
| Flow | "Deterministic workflow" | Event-driven, code-owned, testable |
| Backstory | "Persona prompt" | Tone and judgment shaper for the Agent |
| Entity memory | "Per-entity facts" | Memory scoped to a customer/account/issue |

## Further Reading

- [CrewAI docs introduction](https://docs.crewai.com/en/introduction) — concepts and recommended production path
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — when multi-agent helps and when it doesn't
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — the state-machine alternative
