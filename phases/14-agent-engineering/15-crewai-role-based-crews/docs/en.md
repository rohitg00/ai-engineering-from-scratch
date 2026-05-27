# CrewAI: Role-Based Crews and Flows

> CrewAI is the 2026 role-based multi-agent framework. Four primitives: Agent, Task, Crew, Process. Two top-level shapes: Crews (autonomous, role-based collaboration) and Flows (event-driven, deterministic). The docs are blunt: "for any production-ready application, start with a Flow."

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 14 (Actor Model)
**Time:** ~75 minutes

## Learning Objectives

- Name CrewAI's four primitives (Agent, Task, Crew, Process) and what each owns.
- Distinguish Sequential, Hierarchical, and the planned Consensus process; pick one per workload.
- Distinguish Crews (autonomous role-based) from Flows (event-driven deterministic), and explain the docs' production recommendation.
- Wire tools with the `@tool` decorator and `BaseTool` subclass; reason about structured outputs vs free text.
- Name the four CrewAI memory types and when each pays off.
- Implement a stdlib three-agent crew (researcher, writer, editor) that produces a brief.
- Spot the three CrewAI failure modes: prompt-bloat, manager-LLM tax, brittle handoffs.

## The Problem

Teams adopting multi-agent frameworks hit the same wall. "Autonomous collaboration" sounds great in a demo. Then a customer files a bug and you need deterministic replay. Or finance asks how much an LLM-routed crew costs per run. Or on-call needs to know which agent stalled at 3 AM.

Free-form LLM-routed crews answer none of those cleanly. Pure DAGs answer them all but lose the exploratory shape a brainstorming agent needs.

CrewAI's split is honest about the trade. Crews for collaborative, role-based, exploratory work. Flows for event-driven, code-owned, auditable production. Same framework, two shapes, pick per surface.

## The Concept

### Four primitives

CrewAI's surface is small. Memorize this and the rest is config.

- **Agent.** `role + goal + backstory + tools + (optional) llm`. The backstory is load-bearing. It shapes tone, judgment, when the agent stops. Tools are functions the agent can call (more below).
- **Task.** `description + expected_output + agent + (optional) context + (optional) output_pydantic`. A reusable unit of work. `expected_output` is the contract. `context` lists upstream tasks whose outputs are passed in. `output_pydantic` forces a structured shape.
- **Crew.** Container. Owns the list of `agents`, the list of `tasks`, the `process`, and optional `memory` + `verbose` + `manager_llm` settings.
- **Process.** Execution strategy. Sequential, Hierarchical, Consensus (planned). Picks the shape of the run.

Agents do not see each other directly. Tasks reference agents. The Crew sequences tasks. The Process decides who picks the next task. That is the whole mental model.

> **Validated against** CrewAI 0.86 (2026-05). Newer versions may rename or merge process types; check the [CrewAI Processes docs](https://docs.crewai.com/concepts/processes) before relying on a specific shape.

### Sequential vs Hierarchical vs Consensus

- **Sequential.** Tasks run in declaration order. Output of task N is available as `context` to task N+1. Lowest cost. Most predictable. Use when the order is fixed.
- **Hierarchical.** A manager Agent (separate LLM call) routes between specialists. CrewAI spawns the manager either from your `manager_llm` config or a default. The manager picks the next task each round and can refuse or re-route. Use when you have four or more specialists and order genuinely depends on prior output.
- **Consensus.** Planned, not currently implemented in the public API. The docs reserve the name for a future voting-based process. Do not rely on it today.

Hierarchical adds a per-round LLM call (the manager) on top of every specialist call. Token cost can triple on a five-step run. Pay for it only when you need the routing.

### Crews vs Flows

This is the framing the docs lead with in 2026.

- **Crew.** LLM-driven autonomy. The framework picks the shape at runtime. Good for: research, brainstorming, first drafts, anywhere the path is part of the answer. Hard to replay. Hard to test. Cheap to prototype.
- **Flow.** Event-driven graph you own. `@start` marks the entry. `@listen(topic)` marks a step that fires when another step emits that topic. Each step is plain Python (can call a Crew internally). Good for: production. Observable. Testable. Deterministic.

The docs' 2026 production recommendation: start with a Flow. Fold Crews in as `Crew.kickoff()` calls from inside Flow steps when autonomy earns its cost. The Flow gives you the audit trail, the Crew gives you the exploration. Compose, do not pick.

### Tool integration

Three ways to give an Agent a tool. Pick the simplest one that fits.

1. **`@tool` decorator.** Pure functions become tools. Signature is the schema; docstring is the description the LLM sees. Best for one-off helpers.

   ```python
   from crewai.tools import tool

   @tool("Search the web")
   def search(query: str) -> str:
       """Return top results for the query."""
       return run_search(query)
   ```

2. **`BaseTool` subclass.** Class-based tool with explicit args schema, async support, retries. Use when the tool has state (a client, a cache) or needs structured args.

   ```python
   from crewai.tools import BaseTool
   from pydantic import BaseModel

   class SearchArgs(BaseModel):
       query: str
       limit: int = 10

   class SearchTool(BaseTool):
       name = "web_search"
       description = "Search the web and return top results."
       args_schema = SearchArgs

       def _run(self, query: str, limit: int = 10) -> str:
           return self.client.search(query, limit=limit)
   ```

3. **Built-in toolkits.** CrewAI ships first-party adapters: `SerperDevTool`, `FileReadTool`, `DirectoryReadTool`, `CodeInterpreterTool`, `RagTool`, `WebsiteSearchTool`. Wired with one import.

Structured outputs use Pydantic. Pass `output_pydantic=MyModel` on the Task. CrewAI validates the LLM response against the model and either coerces or retries. Pair this with a tight `expected_output` string. Free-text outputs are fine for drafts; structured outputs are what downstream Flows can consume.

### Memory hooks

CrewAI ships four memory types out of the box. They compose: a Crew can enable all four at once.

> **Validated against** CrewAI 0.86 (2026-05). Recent releases route everything through a unified `Memory` system that wraps these four stores. The conceptual model below still holds, but the public class surface may collapse to a single `Memory` entry-point in newer versions; check [CrewAI memory docs](https://docs.crewai.com/concepts/memory) for the current API.

- **Short-term.** Conversation buffer within a single run. Wiped at the end.
- **Long-term.** Persisted across runs. Stored in a vector DB (Chroma by default, swappable). Retrieved by similarity to the current task.
- **Entity.** Per-entity facts. "Customer X is on the enterprise plan." Keyed by entity, not by similarity. Survives across runs.
- **Contextual.** Assembly-time retrieval. Pulls relevant memory at the moment the Agent needs it, not preloaded.

Enable on the Crew with `memory=True` or per-type config. Backed by an embeddings provider you configure (defaults to OpenAI, swappable to local). Memory is one of the places CrewAI earns its keep against thinner frameworks; pure LangGraph requires you to wire each of these yourself.

### When CrewAI fits

- Three to six agents with named roles and a collaborative workflow. Drafting, reviewing, planning, brainstorming.
- Routing where the LLM's judgment about the next step is part of the value (Hierarchical).
- Anywhere the team is happier reading `role + goal + backstory` than reading a graph definition.

### When CrewAI does not fit

- Deterministic DAGs with strict ordering. Use LangGraph (Lesson 13). The graph shape is the right abstraction; CrewAI's role framing is friction.
- Sub-second latency budgets. Hierarchical adds round trips. Even Sequential serializes prompts that include backstories and prior outputs.
- Single-agent loops. Skip the framework; an agent loop (Lesson 1) plus a tool registry is shorter.

Lesson 17 (Agent Framework Tradeoffs) lays this out in a matrix. The short version: CrewAI sits in the "collaborative role-based" corner.

### Dependency shape

Independent of LangChain. Python 3.10 to 3.13. Uses `uv`. Star count: see [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) (snapshot as of 2026-05). AWS Bedrock integration is documented; vendor benchmarks report a substantial speedup vs LangGraph on QA workloads, but the methodology (dataset, hardware, evaluation metric) is not published, so treat framework-vendor numbers as directional only.

### Where this pattern goes wrong

- **Prompt-bloat from backstories.** A 2000-word backstory per agent and a five-agent crew burns the context budget before the first tool call. Keep backstories under 200 words. Reuse phrases across agents; do not repeat house style five times.
- **Manager-LLM token tax.** Hierarchical process adds a manager LLM call before every specialist call. On a five-task crew that is six LLM calls instead of five, and the manager call carries the full task list plus prior outputs. Switch to Sequential unless routing depends on output.
- **Brittle handoffs.** Task N's `expected_output` is "an outline". Task N+1 reads it as `context` and tries to parse three sections. The LLM produced four. The downstream Agent ad-libs. Fix with `output_pydantic` on Task N so Task N+1 reads a typed object, not free text.
- **Crew-as-prod.** Free-form Crew shipped to production without a Flow wrapper. Output variability is high; replay is impossible; on-call cannot diff a bad run against a good one. Wrap with a Flow.

## Build It

`code/main.py` implements stdlib versions of both shapes plus a three-agent crew.

Shape:

- `Agent`, `Task` dataclasses matching CrewAI's surface.
- `SequentialCrew.kickoff(inputs)` runs tasks in declaration order, threading outputs as `context`.
- `HierarchicalCrew.kickoff(topic)` adds a manager Agent picking the next specialist each round, stops at "done".
- `Flow` with `@start` and `@listen(topic)` decorators, a tiny event loop, and a trace.
- `tool(name)` decorator mirroring CrewAI's `@tool` shape.
- `Memory` with `short_term`, `long_term`, `entity` stores; mocked similarity uses numpy.
- Mock LLM responses are hardcoded strings keyed off role plus input prefix. No network. Deterministic.

Concrete demo: researcher, writer, editor crew producing a brief on "agent engineering 2026". Researcher pulls (mocked) sources. Writer drafts. Editor tightens. Same crew runs through a Flow to show the deterministic shape.

Run it:

```bash
python3 code/main.py
```

Trace covers: sequential crew threading outputs through `context`, hierarchical crew with manager picks (researcher, writer, editor, then "done"), flow running the same three steps with explicit topics (`researched`, `drafted`, `edited`), tool calls routed through `@tool`, and long-term memory surviving across two kickoffs.

The Crew trace is fluid; the manager could in principle re-order. The Flow trace is fixed. That choice is the lesson.

## Use It

- **CrewAI Flow** for production. Even when the Flow is one step that calls `Crew.kickoff()`. The Flow gives the audit boundary.
- **CrewAI Crew (Sequential)** for clear-ordering collaborative work, especially first drafts and review loops.
- **CrewAI Crew (Hierarchical)** when routing depends on output and you have four or more specialists.
- **LangGraph** (Lesson 13) for explicit state machines, durable resume, strict ordering.
- **AutoGen v0.4** (Lesson 14) for actor-model concurrency and fault isolation.
- **OpenAI Agents SDK** (Lesson 16) for OpenAI-first products with handoffs and guardrails.
- **Claude Agent SDK** (Lesson 17) for Claude-first products with subagents and session store.

## Ship It

`outputs/skill-crew-or-flow.md` picks Crew vs Flow for a task and scaffolds the minimal implementation. Hard rejects on Crew-without-backstory, Flow-without-explicit-topics, Hierarchical with under three specialists.

## Pitfalls

- **Backstory as flavor.** It shapes outputs. Test three variants per agent; variance is real. Pick one, freeze it.
- **Skipping `expected_output`.** Without a contract per task, downstream tasks pick up whatever the LLM produced. Crew runs; audit fails.
- **Memory always-on.** Long-term writes every run. Vector DB grows. Retrieval gets noisy. Scope writes to tasks where the fact is persistent.
- **Manager prompt drift.** Hierarchical's manager prompt is implicit. If routing gets weird, dump it in verbose mode and read.
- **Tool side effects in Crews.** A Crew can call a tool more times than expected. POST, DELETE, payment belong in a Flow step, never a Crew tool.

## Exercises

1. Convert the Sequential crew to a Flow. Count the touchpoints where variability drops. Note where readability dropped.
2. Add entity memory to the crew: facts about a customer persist across kickoffs. Verify retrieval pulls the right entity.
3. Implement a Hierarchical process where the manager refuses to route to the editor until the writer's output has at least three paragraphs. Trace the retry.
4. Wire a `BaseTool` subclass for a (mocked) web search. Compare the trace shape vs the `@tool` decorator version.
5. Add `output_pydantic=Brief` to the editor task, where `Brief` has `title`, `summary`, `sections`. Make the writer task output malformed JSON once; verify CrewAI's retry behavior in the trace.
6. Read CrewAI's docs intro. Port the toy to the real `crewai` API. Which guarantees did the stdlib version skip?
7. Wire AgentOps or Langfuse (Lesson 24) to a real run. Which traces did you miss in the stdlib version?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | "Persona" | Role + goal + backstory + tools |
| Task | "Unit of work" | Description + expected output + assignee + optional structured output |
| Crew | "Agent team" | Container for Agents + Tasks + Process |
| Process | "Execution strategy" | Sequential / Hierarchical / Consensus (planned) |
| Flow | "Deterministic workflow" | Event-driven, code-owned, testable |
| Backstory | "Persona prompt" | Tone and judgment shaper for the Agent |
| `@tool` | "Function tool" | Decorator that turns a function into a tool the Agent can call |
| `BaseTool` | "Class tool" | Class-based tool with args schema, retries, async support |
| Entity memory | "Per-entity facts" | Memory scoped to a customer / account / issue |
| Long-term memory | "Cross-run memory" | Vector-backed memory that survives between kickoffs |
| Contextual memory | "Just-in-time retrieval" | Memory pulled at the moment the Agent needs it |
| Manager LLM | "Router agent" | Extra LLM in Hierarchical process that picks the next task |
| `expected_output` | "Task contract" | String that tells the Agent (and audit) what shape to return |

## Further Reading

- [CrewAI docs introduction](https://docs.crewai.com/en/introduction): concepts and the recommended production path
- [CrewAI Flows guide](https://docs.crewai.com/en/concepts/flows): event-driven shape, `@start`, `@listen`
- [CrewAI tools reference](https://docs.crewai.com/en/concepts/tools): `@tool`, `BaseTool`, built-in toolkits
- [CrewAI memory](https://docs.crewai.com/en/concepts/memory): short-term, long-term, entity, contextual
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents): when multi-agent helps and when it does not
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview): the state-machine alternative
