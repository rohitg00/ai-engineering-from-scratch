# The Multi-Agent Primitive Model

> Every multi-agent framework shipping in 2026 — AutoGen, LangGraph, CrewAI, OpenAI Agents SDK, Microsoft Agent Framework — is a point in a four-dimensional design space. Four primitives, nothing more: the agent, the handoff, the shared state, the orchestrator. This lesson builds them from zero, runs a toy system on all four, then maps every major framework onto the same axes so you can read any new release in one paragraph.

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 (Agent Engineering), Phase 16 · 01 (Why Multi-Agent)
**Time:** ~60 minutes

## Problem

Every six months a new multi-agent framework ships. AutoGen in 2023. CrewAI in 2024. LangGraph and OpenAI Swarm in 2024. Google ADK in April 2025. Microsoft Agent Framework RC in February 2026. Each press release claims to be "the right abstraction."

If you try to learn them one at a time you will burn out. The APIs look different. The docs disagree about what an "agent" is. One framework calls its shared memory a "blackboard," another calls it a "message pool," a third calls it a "StateGraph." You start suspecting the field is just churning.

It is not. Underneath the marketing, the four primitives are stable. Learn them once, read every new framework in one paragraph.

## Concept

### The four primitives

1. **Agent** — a system prompt plus a tool list. Stateless; every run starts from its system prompt and the current message history.
2. **Handoff** — a structured transfer of control from one agent to another. Mechanically, a tool call that returns a new agent or a graph edge that follows a condition.
3. **Shared state** — any data structure that more than one agent can read (sometimes write). Message pool, blackboard, key-value store, vector memory.
4. **Orchestrator** — whoever decides who speaks next. Options: an explicit graph (deterministic), an LLM speaker-selector (soft), the last speaker's handoff call (OpenAI Swarm), or a scheduler over a queue (swarm architecture).

That is the entire design space. Every framework picks defaults for each axis; the rest is surface syntax.

### How every 2026 framework maps to it

| Framework | Agent | Handoff | Shared state | Orchestrator |
|-----------|-------|---------|--------------|--------------|
| OpenAI Swarm / Agents SDK | `Agent(instructions, tools)` | tool returns Agent | caller's problem | the LLM's next handoff call |
| AutoGen v0.4 / AG2 | `ConversableAgent` | speaker-selector on GroupChat | message pool | selector function (LLM or round-robin) |
| CrewAI | `Agent(role, goal, backstory)` | `Process.Sequential / Hierarchical` | Task outputs chained | manager LLM or static order |
| LangGraph | node function | graph edge + condition | `StateGraph` reducer | the graph, deterministic |
| Microsoft Agent Framework | agent + orchestration patterns | pattern-specific | thread / context | pattern-specific |
| Google ADK | agent + A2A card | A2A task | A2A artifacts | host decides |

Surface differences look huge. Underneath: same four knobs.

### Why this matters

Once you see the primitives, framework comparison becomes a short checklist:

- Does the orchestrator trust the LLM to route (Swarm) or does it pin routing in code (LangGraph)?
- Is shared state full-history (GroupChat) or projected (StateGraph reducer)?
- Can agents modify each other's prompts (CrewAI manager) or only hand off (Swarm)?

Those three questions answer 80% of which framework fits a given problem. You stop shopping for "the best multi-agent framework" and start designing for the axis you actually care about.

### The stateless insight

Every primitive except shared state is stateless. Agent is a function of (prompt, tools). Handoff is a function call. Orchestrator is a scheduler. **The only stateful thing in the system is shared state.** That is where all the interesting bugs live: memory poisoning (Lesson 15), message ordering, versioning, write contention.

Frameworks that hide shared state (Swarm) push the problem to the caller. Frameworks that centralize it (LangGraph checkpoint, AutoGen pool) make it inspectable but shift coordination cost onto the shared-state implementation.

### Anatomy of a single primitive

#### Agent

```
Agent = (system_prompt, tools, model, optional_name)
```

No memory. No state. Two agents with the same system prompt and tools are interchangeable. Everything that looks like per-agent state is actually in shared state or the handoff protocol.

#### Handoff

```
Handoff = (from_agent, to_agent, reason, payload)
```

Three implementations dominate:

- **Function return** — the tool returns the next agent. This is the OpenAI Swarm pattern. Agents carry routing in their tool schemas.
- **Graph edge** — LangGraph. Edges are declarative. The LLM produces a value; a condition selects the next node.
- **Speaker selection** — AutoGen GroupChat. A selector function (sometimes itself an LLM call) reads the pool and picks who speaks next.

#### Shared state

```
SharedState = { messages: [], artifacts: {}, context: {} }
```

At minimum, a list of messages. Often more: structured artifacts (CrewAI Task outputs), typed context (LangGraph reducers), external memory (MCP, vector DB).

Two topologies: **full pool** (every agent sees every message) and **projected** (agents see a role-scoped view). Full pools are simple and scale badly. Projected pools scale but require upfront schema design.

#### Orchestrator

```
Orchestrator = ({state, last_speaker}) -> next_agent
```

Four flavors:

- **Static** — the graph is fixed at build time (LangGraph deterministic, CrewAI Sequential).
- **LLM-selected** — an LLM reads the pool and picks the next speaker (AutoGen, CrewAI Hierarchical).
- **Handoff-driven** — the current agent decides by calling a handoff tool (Swarm).
- **Queue-driven** — workers pull from a shared queue; no explicit next-speaker (swarm architectures, Matrix).

### What changes between frameworks

Once the primitives are fixed, the remaining design decisions are:

- **Memory strategy** — ephemeral vs durable checkpointing (LangGraph checkpointer).
- **Safety boundary** — who can approve a handoff (human-in-the-loop).
- **Cost accounting** — per-agent token budgets.
- **Observability** — tracing handoffs, persisting state for replay.

All implementable on top of the primitives. None of them are new primitives.

## Build It

`code/main.py` implements the four primitives in ~150 lines of stdlib Python. No real LLM — each agent is a scripted policy so the focus stays on the coordination structure.

The file exports:

- `Agent` — a dataclass of name, system prompt, tools, policy function.
- `Handoff` — a function that returns a new agent.
- `SharedState` — a thread-safe message pool.
- `Orchestrator` — three variants: `StaticOrchestrator`, `HandoffOrchestrator`, `LLMSelectorOrchestrator` (simulated).

The demo runs the same three-agent pipeline (research → write → review) through all three orchestrator types and prints the message pool at the end. You can see that the outputs differ only in *who picks next*; the agents and shared state are identical across runs.

Run it:

```
python3 code/main.py
```

Expected output: three orchestrator runs, one per pattern. Each prints the final message pool. The handoff-driven run reaches fewer agents if the researcher decides it is done early — that is the LLM-routing tradeoff in miniature.

## Use It

`outputs/skill-primitive-mapper.md` is a skill that reads any multi-agent codebase or framework doc and returns the four-primitive mapping. Run it on a new framework release to get a one-paragraph understanding before reading docs in depth.

## Ship It

Before adopting a new framework, write the primitive mapping for it. If you cannot, the docs are incomplete or the framework is inventing a fifth primitive (rare — check for a shared-state flavor you have not seen).

Pin the mapping in your architecture doc. When a new team member joins, send them the mapping before the API docs. When framework versions change, diff the mapping, not the changelog.

## Exercises

1. Run `code/main.py` three times with different agent policies. Observe how the orchestrator choice changes which agents run.
2. Implement a fourth orchestrator type: a queue-driven one where agents poll shared state for work. What deadlock can happen, and how do you detect it?
3. Take the LangGraph quickstart (https://docs.langchain.com/oss/python/langgraph/workflows-agents) and rewrite it as the four primitives. Which of LangGraph's abstractions map 1:1 and which are convenience wrappers?
4. Read the OpenAI Swarm cookbook (https://developers.openai.com/cookbook/examples/orchestrating_agents). Identify which of the four primitives Swarm makes most ergonomic, and which one it pushes to the caller.
5. Find one framework in this table that hides shared state entirely. Explain what breaks when agents need to coordinate across handoffs without re-reading history.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | "An LLM with tools" | A `(system_prompt, tools, model)` triple. Stateless. |
| Handoff | "Transfer of control" | A structured call that names the next agent and optional payload. Three implementations: function return, graph edge, speaker selection. |
| Shared state | "Memory" / "context" | The only stateful part of a multi-agent system. Message pool or blackboard. |
| Orchestrator | "Coordinator" | Whoever decides who runs next. Static graph, LLM selector, handoff-driven, or queue-driven. |
| Primitive | "Abstraction" | One of the four axes every framework parameterizes. Not a framework feature. |
| Message pool | "Shared chat history" | Full-history shared state. Easy to reason about, scales badly. |
| Projected state | "Scoped view" | Role-specific view into shared state. Scales, requires schema design. |
| Speaker selection | "Who talks next" | Orchestrator pattern where a function (often an LLM) picks the next agent from a group. |

## Further Reading

- [OpenAI cookbook: Orchestrating Agents — Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) — the clearest articulation of handoff-driven orchestration
- [AutoGen stable docs](https://microsoft.github.io/autogen/stable/) — GroupChat + speaker selection is the reference for LLM-selected orchestration
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — graph-edge orchestration and reducer-based shared state
- [CrewAI introduction](https://docs.crewai.com/en/introduction) — role-goal-backstory agents, Sequential / Hierarchical processes
- [AG2 (community AutoGen continuation)](https://github.com/ag2ai/ag2) — the live AutoGen v0.2 line after Microsoft moved v0.4 into maintenance
