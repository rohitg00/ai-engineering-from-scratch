# Handoffs and Routines — Stateless Orchestration

> OpenAI's Swarm (October 2024) distilled multi-agent orchestration to two primitives: **routines** (instructions + tools as a system prompt) and **handoffs** (a tool that returns another Agent). No state machine, no branching DSL — the LLM routes by calling the right handoff tool. The OpenAI Agents SDK (March 2025) is the production successor. Swarm itself remains the cleanest conceptual reference — its entire source fits in a few hundred lines. The pattern is viral because the API surface is roughly "agent = prompt + tools; handoff = function returning agent." Limitation: stateless, so memory is the caller's problem.

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## Problem

Every multi-agent framework wants you to learn its DSL: LangGraph nodes and edges, CrewAI crews and tasks, AutoGen GroupChat and managers. The DSLs are real abstractions, but they make the thing feel heavier than it needs to be.

Swarm pushes in the opposite direction: use the tool-calling capability the model already has. Handoffs become tool calls. The orchestrator is whichever agent currently holds the conversation. The state machine is implicit in the agents' system prompts.

## Concept

### Two primitives

**Routine.** A system prompt that defines an agent's role and available tools. Think of it like a scoped set of instructions: "you are a triage agent; if the user asks about refunds, hand off to the refund agent."

**Handoff.** A tool the agent can call that returns a new Agent object. The Swarm runtime detects the Agent return value and switches the active agent for the next turn.

That is the entire abstraction.

```
def transfer_to_refunds():
    return refund_agent  # Swarm sees Agent return → switch active agent

triage_agent = Agent(
    name="triage",
    instructions="Route the user to the right specialist.",
    functions=[transfer_to_refunds, transfer_to_sales, transfer_to_support],
)
```

The triage agent's system prompt makes it choose the right handoff based on the user message. The LLM's tool-calling does the routing.

### Why it is viral

- **Small API.** Two concepts to learn.
- **Uses what the model already does.** Tool calling is already production-grade across providers.
- **No state-machine burden.** You do not describe the graph; the agents' prompts describe who they hand off to.

### The stateless trade

Swarm is explicitly stateless between runs. The framework keeps a message history during a run, but it does not persist anything. Memory, continuity, long-running tasks — all the caller's problem.

In production (OpenAI Agents SDK, March 2025) this was one of the main things that changed: the SDK adds built-in session management, guardrails, and tracing while keeping the handoff primitive.

### When Swarm/handoffs fit

- **Triage patterns.** Front-line agent routes user to a specialist.
- **Skill-based handoffs.** "If the task needs code, call the coder; if it needs research, call the researcher."
- **Short, bounded conversations.** Customer support, FAQ-to-ticket, simple workflows.

### When Swarm struggles

- **Long sessions with shared memory.** Handoffs reset the conversation state to the new agent's prompt plus history. No persistent state across agents without caller-managed memory.
- **Parallel execution.** Handoff is one-at-a-time — the active agent switches. Parallelism requires the caller orchestrating multiple Swarm runs.
- **Audit and replay.** Stateless runs are hard to replay exactly; the LLM's handoff choice is not deterministic.

### OpenAI Agents SDK (March 2025)

The production successor adds:

- **Session state.** Persistent thread across runs.
- **Guardrails.** Input/output validation hooks.
- **Tracing.** Every tool call and handoff is logged.
- **Handoff filters.** Control what context transfers on handoff.

The handoff primitive survives; production ergonomics get added around it.

### Swarm vs GroupChat

Both use LLM-driven routing, but they differ on **who picks next**:

- GroupChat: a selector (function or LLM) picks the next speaker from outside.
- Swarm: the current agent picks its successor by calling a handoff tool.

Swarm is "agent decides what's next"; GroupChat is "manager decides what's next." Swarm's decision lives in the active agent's tool call; GroupChat's lives in the `GroupChatManager`.

## Build It

`code/main.py` implements Swarm from scratch: an Agent dataclass, a handoff mechanism (tool returns Agent), and a run loop that detects agent switches.

Demo: a triage agent routes to refund, sales, or support specialists. Each specialist has its own tools. The run loop prints each handoff.

Run:

```
python3 code/main.py
```

## Use It

`outputs/skill-handoff-designer.md` designs a handoff topology for a given task: which agents exist, which handoffs they can call, what context transfers.

## Ship It

Checklist:

- **Handoff logging.** Every handoff writes a trace event with from-agent, to-agent, context snapshot.
- **Context transfer rules.** Decide what moves on handoff: full history (expensive), last N messages, or a summary.
- **Guardrail on handoff.** A handoff to a specialist with different tool permissions must be authenticated — otherwise prompt injection can force unwanted handoffs.
- **Loop detection.** Two agents handing back and forth is a common failure; detect with a simple last-K ring check.
- **Fallback agent.** If a handoff target does not exist, fall back to a safe default.

## Exercises

1. Run `code/main.py`, triage to the refund agent. Confirm the second turn's active agent is refund.
2. Add a loop-detection rule: if the same two agents have handed off 3 times in a row, force an exit. Design the fallback.
3. Read the OpenAI Agents SDK docs on handoff filters. Implement a "summarize-on-handoff" version: the outgoing agent compresses context to a bullet summary before the incoming agent takes over.
4. Compare the Swarm handoff to a GroupChatManager selector. Which pattern makes prompt injection worse, and why?
5. Read the Swarm cookbook (https://developers.openai.com/cookbook/examples/orchestrating_agents). Identify one explicit design decision Swarm makes that OpenAI Agents SDK changed or kept.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Routine | "The agent prompt" | System prompt + tool list. Defines role and available handoffs. |
| Handoff | "Transfer to another agent" | A tool the active agent can call that returns a new Agent. The runtime switches active agent. |
| Stateless | "No memory between runs" | Swarm does not persist anything; memory is the caller's responsibility. |
| Active agent | "Who's speaking now" | The agent currently holding the conversation. Handoff changes this. |
| Context transfer | "What moves on handoff" | Policy for what history the incoming agent sees: full, last N, or summarized. |
| Handoff loop | "Agents ping-pong" | Failure mode where two agents keep handing back to each other. |
| OpenAI Agents SDK | "Production Swarm" | March 2025 successor; adds sessions, guardrails, tracing on top of the handoff primitive. |
| Handoff filter | "Gate on transfer" | SDK feature to inspect and modify context at the handoff boundary. |

## Further Reading

- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) — the reference articulation
- [OpenAI Swarm repo](https://github.com/openai/swarm) — original implementation, kept as conceptual reference
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) — production successor with sessions and tracing
- [Anthropic handoff-in-Claude notes](https://docs.anthropic.com/en/docs/claude-code) — how Claude Code subagents use a handoff-like pattern via `Task`
