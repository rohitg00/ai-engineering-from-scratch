# Production Runtimes: Queue, Event, Cron

> Production agents run on six runtime shapes: request-response, streaming, durable execution, queue-based background, event-driven, and scheduled. Pick the shape before you pick the framework. Observability is load-bearing at every shape.

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 13 (LangGraph), Phase 14 · 22 (Voice)
**Time:** ~60 minutes

## Learning Objectives

- Name the six production runtime shapes and match each to a framework / product pattern.
- Explain why durable execution (LangGraph) matters for long-horizon tasks.
- Describe the event-driven runtime and when Claude Managed Agents fits.
- Explain the observability-as-load-bearing claim for multi-step agents.

## The Problem

Production agents fail in ways a Jupyter notebook doesn't surface: network timeouts at step 37, user hangs up mid-voice call, cron job dies on machine reboot, background worker runs out of memory. The runtime shape determines which failures are survivable.

## The Concept

### Request-response

- Synchronous HTTP. User waits for completion.
- Only viable for short tasks (<30s).
- Stacks: Agno (Python + FastAPI), Mastra (TypeScript + Express/Hono/Fastify/Koa).
- Observability: standard HTTP access logs + OTel spans.

### Streaming

- SSE or WebSocket for progressive output.
- LiveKit extends this to WebRTC for voice/video (Lesson 22).
- Stacks: any framework with streaming support + a frontend that handles SSE/WS.
- Observability: per-chunk timing, first-token latency, tail latency.

### Durable execution

- State checkpointed after every step; auto-resumes on failure.
- AutoGen v0.4 actor model isolates failures to one agent (Lesson 14).
- LangGraph's core differentiator (Lesson 13).
- Essential when step count is unknown and recovery cost is high.

### Queue-based / background

- Job enters a queue, workers pick up, results flow back via webhooks or pub/sub.
- Essential for long-horizon agents (dozens-to-hundreds of steps per task, per Anthropic's computer use announcement).
- Stacks: Celery (Python), BullMQ (Node), SQS + Lambda (AWS), custom.
- Observability: queue depth, per-job latency distribution, DLQ size.

### Event-driven

- Agents subscribe to triggers: new email, PR opened, cron fire.
- Claude Managed Agents covers this out of the box (Lesson 17).
- CrewAI Flows (Lesson 15) structures event-driven deterministic workflows.
- Observability: trigger source, event-to-start latency, agent latency.

### Scheduled

- Cron-shaped agents that run periodically.
- Combine with durable execution so a failing nightly run resumes next tick.
- Stacks: Kubernetes CronJob + a durable framework; hosted (Render cron, Vercel cron).

### 2026 deployment patterns

- **CrewAI Flows** for event-driven production.
- **Agno** stateless FastAPI for Python microservices.
- **Mastra** server adapters (Express, Hono, Fastify, Koa) for embedding.
- **Pipecat Cloud / LiveKit Cloud** for managed voice (Lesson 22).
- **Claude Managed Agents** for hosted long-running async.

### Observability is load-bearing

Without OpenTelemetry GenAI spans (Lesson 23) plus a Langfuse/Phoenix/Opik backend (Lesson 24), you cannot debug a multi-step agent that failed at step 40. This is not optional for production. It's the difference between "we debug fast" and "we replay from scratch with more logging."

### Where production runtimes fail

- **Wrong shape choice.** Picking request-response for a 5-minute task. Users hang up; workers pile up; retries compound.
- **No DLQ.** Queue workers without dead-letter. Failed jobs vanish.
- **Opaque background work.** Background agent runs without trace export. Failures are invisible until the user reports them.
- **Skipping durable state.** Any run > 30 seconds where you can't afford to restart needs durable execution.

## Build It

`code/main.py` is a stdlib multi-shape demo:

- Request-response endpoint (plain function).
- Streaming handler (generator).
- Queue-based worker with DLQ.
- Event trigger registry.
- Cron-shaped scheduler.

Run it:

```bash
python3 code/main.py
```

Output: five traces showing each shape's behavior on the same task. Same agent logic, different outer shells. Durable execution (the sixth shape) is intentionally covered in Lesson 13 with LangGraph checkpointing.

## Use It

- **Request-response** for chat-style UX.
- **Streaming** for progressive responses.
- **Durable** for long-horizon tasks.
- **Queue** for batch / async / long-running.
- **Event** for agent reactivity.
- **Cron** for housekeeping (memory consolidation, evals, cost reports).

## Ship It

`outputs/skill-runtime-shape.md` picks a runtime shape for a task and wires the observability requirements.

## Exercises

1. Port your Lesson 01 ReAct loop to all six shapes in your stack. Which shape fits which product surface?
2. Add a DLQ to the queue-based demo. Simulate 10% job failure; surface DLQ size.
3. Write a cron-triggered eval agent that runs nightly against your top 20 traces from the day.
4. Implement streaming with backpressure: if the client is slow, pause the agent. How does this interact with a turn budget?
5. Read Claude Managed Agents docs. When would you move a self-hosted long-horizon agent to managed?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Request-response | "Synchronous" | User waits; short tasks only |
| Streaming | "SSE / WS" | Progressive output; better UX; latency observable per chunk |
| Durable execution | "Resume from failure" | Checkpointed state; restart at last step |
| Queue-based | "Background jobs" | Producer / worker pool / DLQ |
| Event-driven | "Trigger-based" | Agent reacts to external events |
| DLQ | "Dead-letter queue" | Parking lot for failed jobs |
| Claude Managed Agents | "Hosted harness" | Anthropic-hosted long-running async with caching + compaction |

## Further Reading

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — durable execution details
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) — hosted long-running async
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) — "dozens-to-hundreds of steps per task"
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) — actor-model fault isolation
