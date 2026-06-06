# OpenAI Agents SDK: Handoffs, Guardrails, Tracing

> OpenAI Agents SDK is the lightweight multi-agent framework built on the Responses API. Five primitives: Agent, Handoff, Guardrail, Session, Tracing. Handoffs are tools named `transfer_to_<agent>`. Guardrails trip on input or output. Tracing is on by default.

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**Time:** ~75 minutes

## Learning Objectives

- Name the five primitives of the OpenAI Agents SDK.
- Explain handoffs: why they are modeled as tools, what name shape the model sees, and how context transfers.
- Distinguish input guardrails, output guardrails, and tool guardrails; explain `run_in_parallel` vs blocking mode.
- Implement a stdlib runtime with handoffs + guardrails + span-style tracing.

## The Problem

Agents that cannot delegate cleanly end up stuffing everything into one prompt. Agents without guardrails ship PII, policy-violating output, or loop forever. OpenAI's SDK codifies the three primitives that make multi-agent work tractable.

## The Concept

### Five primitives

1. **Agent.** LLM + instructions + tools + handoffs.
2. **Handoff.** Delegation to another agent. Represented to the model as a tool named `transfer_to_<agent_name>`.
3. **Guardrail.** Validation on input (first agent only), output (last agent only), or tool invocation (per function tool).
4. **Session.** Automatic conversation history across turns.
5. **Tracing.** Built-in spans for LLM generations, tool calls, handoffs, guardrails.

### Handoffs as tools

The model sees `transfer_to_billing_agent` in its tool list. Calling it signals the runtime to:

1. Copy the conversation context (or collapse it via `nest_handoff_history` beta).
2. Initialize the target agent with its instructions.
3. Continue the run with the target agent.

This is the supervisor pattern (Lesson 13 / Lesson 28) productized.

### Guardrails

Three flavors:

- **Input guardrails.** Run on the first agent's input. Reject unsafe or out-of-scope requests before any LLM call.
- **Output guardrails.** Run on the last agent's output. Catch PII leaks, policy violations, malformed responses.
- **Tool guardrails.** Run per-function-tool. Validate arguments, check permissions, audit execution.

Mode:

- **Parallel** (default). Guardrail LLM runs alongside the main LLM. Lower tail latency. If tripped, the main LLM's work is discarded (token waste).
- **Blocking** (`run_in_parallel=False`). Guardrail LLM runs first. If tripped, no tokens wasted on the main call.

Tripwires raise `InputGuardrailTripwireTriggered` / `OutputGuardrailTripwireTriggered`.

### Tracing

On by default. Every LLM generation, tool call, handoff, and guardrail emits a span. `OPENAI_AGENTS_DISABLE_TRACING=1` opts out. `add_trace_processor(processor)` fans spans to your own backend alongside OpenAI's.

### Sessions

`Session` stores conversation history in a backend (SQLite, Redis, custom). `Runner.run(agent, input, session=session)` auto-loads and appends.

### Where this pattern goes wrong

- **Handoff drift.** Agent A hands off to Agent B which hands back to Agent A. Add a hop counter.
- **Guardrail bypass.** Tool guardrails only fire on function tools; built-in tools (file reader, web fetch) need separate policy.
- **Over-tracing.** Sensitive content in spans. Pair with OTel GenAI content-capture rules (Lesson 23) — store externally, reference by ID.

## Build It

`code/main.py` implements the SDK shape in stdlib:

- `Agent`, `FunctionTool`, `Handoff` (as a function tool with transfer semantics).
- `Runner` with input/output/tool guardrails, handoff dispatch, and hop counter.
- A simple span emitter to show the trace shape.
- A triage agent that hands off to billing or support based on the user's query; guardrail trips on one input.

Run it:

```
python3 code/main.py
```

The trace shows two successful handoffs, one input guardrail trip, and a span tree mirroring what the real SDK emits.

## Use It

- **OpenAI Agents SDK** for OpenAI-first products.
- **Claude Agent SDK** (Lesson 17) for Claude-first products.
- **LangGraph** (Lesson 13) when you want explicit state and durable resume.
- **Custom** when you need exact control (voice, multi-provider, federated deployments).

## Ship It

`outputs/skill-agents-sdk-scaffold.md` scaffolds an Agents SDK app with a triage agent, handoffs, input/output/tool guardrails, session store, and a trace processor.

## Exercises

1. Add a handoff hop counter: refuse after N transfers. Trace the behavior.
2. Implement `nest_handoff_history` as an option — collapse prior messages into one summary before transferring.
3. Write a blocking output guardrail. Compare latency on prompts that would trip it vs ones that pass.
4. Wire `add_trace_processor` to a JSON logger. What shape does it emit per span?
5. Read the SDK docs. Port your stdlib toy to `openai-agents-python`. What did you model wrong?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | "LLM + instructions" | Agent type in the SDK; owns tools and handoffs |
| Handoff | "Transfer" | Tool the model calls to delegate to another agent |
| Guardrail | "Policy check" | Validation on input / output / tool invocation |
| Tripwire | "Guardrail trip" | Exception raised when guardrail rejects |
| Session | "History store" | Conversation memory persisted between runs |
| Tracing | "Spans" | Built-in observability over LLM + tool + handoff + guardrail |
| Blocking guardrail | "Sequential check" | Guardrail runs first; no token waste on trip |
| Parallel guardrail | "Concurrent check" | Guardrail runs alongside; lower latency, wastes tokens on trip |

## Further Reading

- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) — primitives, handoffs, guardrails, tracing
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) — Claude-flavored counterpart
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — when to reach for handoffs at all
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — the standard Agents SDK spans map to
