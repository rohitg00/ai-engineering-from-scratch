# Long-Running Background Agents: Durable Execution

> Production long-horizon agents do not run in `while True`. Every LLM call becomes an activity with checkpoint, retry, and replay. Temporal's OpenAI Agents SDK integration went GA March 2026. Claude Code Routines (Anthropic) runs scheduled Claude Code invocations without a persistent local process. Sessions pause on human-input, survive deploys, and resume from the latest checkpoint keyed by `thread_id`. Behind the new ergonomics sits an old pattern — workflow orchestration — with one new input: LLM calls as non-deterministic activities that must be deterministically replayed on recovery.

**Type:** Learn
**Languages:** Python (stdlib, minimal durable-execution state machine)
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 01 (Long-horizon agents)
**Time:** ~60 minutes

## The Problem

Consider an agent that runs for four hours. It calls three tools, prompts the user twice, and makes forty LLM calls. Halfway through, the host it is running on reboots. What happens?

- In a naive `while True` loop: everything is lost. The run restarts from scratch. The three tool calls (with real side effects) execute again. The user is prompted again for things they already approved. Forty LLM calls are re-billed.
- With durable execution: the run resumes from the most recent checkpoint. Already-completed activities are not re-executed; their results are replayed from the durable log. The user does not re-approve things they already approved. The LLM calls already made are not re-billed.

This is the same pattern workflow engines have shipped for a decade (Temporal, Cadence, Uber's Cherami). What's new is that LLM calls are now a kind of activity — non-deterministic, expensive, with side effects — and they fit this pattern cleanly.

The running theme of the lesson: long-horizon reliability decays (METR observes a "35-minute degradation" — success rate drops roughly quadratically with horizon). Durable execution enables runs that are longer than the reliability profile supports, which is a new way to fail safely if the design is right and unsafely if the design is wrong.

## The Concept

### Activities, workflows, and replay

- **Workflow**: deterministic orchestration code. Defines the sequence of activities, the branches, the waits. Must be deterministic so it can be replayed from the event log without surprising divergence.
- **Activity**: a non-deterministic, potentially failing unit of work. LLM call, tool call, file write, HTTP request. Each activity is logged with its inputs and (once complete) its outputs.
- **Event log**: the durable backing store. Every activity start, complete, fail, retry, and every workflow decision is recorded.
- **Replay**: on recovery, the workflow code re-runs from the start; every activity that already completed returns its logged result without re-executing. Only activities that had not completed are actually run.

This is the same shape as React re-rendering against a virtual DOM, or Git rebuilding a working tree from commits. Determinism in the orchestrator is what makes durability cheap.

### Why LLM calls fit the pattern

LLM calls are:
- Non-deterministic (temperature > 0; even temperature 0 drifts across model versions).
- Expensive (money and latency).
- Potentially failing (rate limits, timeouts).
- Side-effectful (if they invoke tools).

This is exactly the activity profile. Wrapping every LLM call as an activity gives you retry with exponential backoff, checkpointing across restarts, and a replayable trace for debugging.

### Checkpoints keyed by `thread_id`

LangGraph, Microsoft Agent Framework, Cloudflare Durable Objects, and Claude Code Routines all converged on the same API shape: a `thread_id` (or equivalent) identifies the session; each state transition persists to a backend (PostgreSQL default, SQLite for dev, Redis for cache); resume reads the latest checkpoint.

The backend choice matters:

- **PostgreSQL**: durable, queryable, survives deploys. Default for LangGraph.
- **SQLite**: local-dev only; loses data across hosts.
- **Redis**: fast but ephemeral unless AOF/snapshot configured.
- **Cloudflare Durable Objects**: transparently distributed; scoped by a unique key; survives for hours to weeks.

### Human-input as a first-class state

Propose-then-commit (Lesson 15) requires a durable "waiting on human" state. The workflow pauses, the external queue holds the pending request, and an approval resumes from exactly that point. Without durability this is best-effort; with it, an overnight approval arrives and the workflow picks up in the morning.

### The 35-minute degradation

METR observed that every agent class measured shows reliability decay beyond ~35 minutes of continuous operation. Doubling the task duration roughly quadruples the failure rate. Durable execution does not fix this; it lets you run longer than the reliability profile supports. The safe pattern is to combine durability with checkpoints that require fresh HITL on re-entry, and with budget kill switches (Lesson 13) that cap total compute regardless of wall-clock time.

### When durable execution is the wrong answer

- Runs shorter than a few minutes with no human input. Overhead > benefit.
- Strictly read-only information retrieval.
- Tasks where correctness requires end-to-end within one context window (some reasoning tasks; some one-shot generation).

## Use It

`code/main.py` implements a minimal durable-execution engine in stdlib Python. It supports:

- `@activity` decorator that logs inputs and outputs to a JSON event log.
- A workflow function that sequences activities.
- A `run_or_replay(workflow, event_log)` function that replays completed activities without re-executing them.

The driver simulates a three-activity workflow, crashes halfway through, and shows (a) a naive retry re-executing everything versus (b) a replay running only the missing activity.

## Ship It

`outputs/skill-durable-execution-review.md` reviews a proposed long-running agent deployment for correct durable-execution shape: activities, determinism, checkpoint backend, human-input state, and HITL-on-resume policy.

## Exercises

1. Run `code/main.py`. Observe the difference in activity-execution count between naive retry and replay. Change the crash point and show the replay count changes accordingly.

2. Convert the toy engine to use `thread_id` explicitly. Simulate two concurrent sessions sharing the engine and confirm their event logs do not collide.

3. Take one activity in the toy engine. Introduce a non-determinism (a wall-clock timestamp inside a workflow decision). Demonstrate the divergence on replay. Explain how real engines handle this (side-effect registration, `Workflow.now()` APIs).

4. Read the LangChain "Runtime behind production deep agents" post. List every state that the runtime persists and name which failure mode each covers.

5. Design a checkpoint policy for a 6-hour autonomous coding task. Where do you checkpoint? What does resume-on-crash look like? What requires fresh HITL?

## Key Terms

| Term | What people say | What it actually means |
|---|---|---|
| Workflow | "Agent's script" | Deterministic orchestration code; replayable from event log |
| Activity | "A step" | Non-deterministic unit (LLM call, tool call); logged before and after |
| Event log | "The backing store" | Durable record of every state transition |
| Replay | "Resume" | Re-run workflow; completed activities return logged results without re-execution |
| Checkpoint | "Save point" | Persisted state keyed by thread_id; latest-wins on resume |
| thread_id | "Session key" | Identifier that scopes durable state |
| 35-minute degradation | "Reliability decay" | METR: success rate drops ~quadratically with horizon |
| Non-determinism | "Drift on replay" | Wall clock, random, LLM output; must be registered as side effect |

## Further Reading

- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) — budget, turns, and resume semantics.
- [Microsoft — Agent Framework: human-in-the-loop and checkpointing](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — RequestInfoEvent shape.
- [LangChain — The Runtime Behind Production Deep Agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) — concrete runtime requirements.
- [OpenAI Agents SDK + Temporal integration (Trigger.dev announcement)](https://trigger.dev) — activity shape for LLM calls.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — the 35-minute degradation reference.
