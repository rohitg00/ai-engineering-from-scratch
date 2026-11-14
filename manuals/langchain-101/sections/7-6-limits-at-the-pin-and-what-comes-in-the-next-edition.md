# Limits at the pin, and what comes in the next edition

> This edition tested the stack offline and on two machines, without a LangSmith account or a license, so the items below have no recorded run yet.

You read a section and find that a case you care about was not run. This section collects every such case in one place, grouped by what each one needs, with a link back to the section that raised it.

When you finish this section, you can tell which claims of this manual rest on a recorded run. You can also plan your own test of an open case.

Two items have one trial in Part 8, and their lines say so. Until the next edition, this manual gives no measured result for the other items.

## Why these runs are missing

Three limits decided what this edition could run. The full Agent Server with Postgres and Redis does not start without a LangSmith API key or a license key, as [section 7.1](#s-agent-server-langgraph-dev-up-and-deploy) shows. We used no LangSmith account, so nothing that stores data in LangSmith ran. Our models were a scripted fake and Qwen3 on Ollama, so no hosted provider ran.

Each list below names the case and the section where the text stops. Most of the graph cases need no account and only a new scenario in the capture kit.

## Agent Server with Postgres and Redis

These need `langgraph up` with a key, or a deployment.

- Exactly once in the Postgres task queue, with a worker killed in the middle of a run. [Section 1.1](#s-langchain-langgraph-langsmith-and-deep-agents)
- Recovery from a short Redis outage and a short Postgres outage. [Section 1.1](#s-langchain-langgraph-langsmith-and-deep-agents)
- A run on an interrupted worker, and the checkpoint it resumes from. [Section 1.1](#s-langchain-langgraph-langsmith-and-deep-agents)
- What Redis holds during a run, and for how long. [Section 1.1](#s-langchain-langgraph-langsmith-and-deep-agents)
- Agent Server under a crash at the points of the library crash matrix. [Section 4.3](#s-durability-modes-and-a-crash-between-two-steps)
- The time floor of one run, jobs per worker, and the recursion limit under `langgraph up`. [Section 7.1](#s-agent-server-langgraph-dev-up-and-deploy)
- The store permissions of custom auth, and cross-user reads through the server. [Section 4.4](#s-stores-and-long-term-memory) and [section 7.3](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses)
- `langgraph deploy`, its serverless and dedicated types, and a cold start. [Section 7.1](#s-agent-server-langgraph-dev-up-and-deploy)

## LangSmith with an account

- Trace retention, rate limits, the limit of runs per trace, and the speed of the hosted store. [Section 6.4](#s-langsmith-tracing)
- A dataset given to `evaluate` by name, with its versions and splits. [Section 6.5](#s-evaluation-with-langsmith)
- An experiment with `upload_results=True`, and its retention. [Section 6.5](#s-evaluation-with-langsmith)
- A comparison of two experiments. [Section 6.5](#s-evaluation-with-langsmith)
- Online evaluators on production traces, and annotation queues. [Section 6.5](#s-evaluation-with-langsmith)
- The pytest plugin with tracking on, and its `--langsmith-output` table. [Section 6.5](#s-evaluation-with-langsmith)

## Hosted providers and real models

- `ProviderToolSearchMiddleware` with a real deferral on Anthropic or OpenAI. [Section 3.4](#s-the-built-in-middleware)
- `ModelFallbackMiddleware` on a 400 from a bad request. [Section 3.5](#s-retries-backup-models-rate-limits-and-caching)
- `set_llm_cache`, the node cache of `create_agent`, and the rate limiter against a model. [Section 3.5](#s-retries-backup-models-rate-limits-and-caching)
- `SummarizationMiddleware` with a real model over a long thread. [Section 8.3](#s-an-assistant-with-memory-and-approvals-that-survives-a-restart) has one real summary from Qwen3 4B at 10 messages. [Section 4.5](#s-context-engineering-and-summarization)

## Middleware

- `PIIMiddleware` on a stream with `apply_to_output=True`, and its hold-back of 128 characters. [Section 3.6](#s-guardrails-pii-and-the-decision-middleware-beta)
- The cost of async hooks, of `after_agent` and `dynamic_prompt`, and of built-ins when they act, such as a retry or a summary. [Section 7.2](#s-cost-the-framework-against-a-plain-sdk-loop)
- One invalid answer among several approvals sent together, which the docs warn can run a tool twice. [Section 5.5](#s-human-in-the-loop-batched-and-per-call)
- Approvals on `PostgresSaver` across a restart. [Section 5.5](#s-human-in-the-loop-batched-and-per-call)

## Persistence

- An agent tool with a `tool_call_id` key at all five kill points of the crash matrix. [Section 8.3](#s-an-assistant-with-memory-and-approvals-that-survives-a-restart) has one trial with a kill after the tool ran, in each of two modes. [Section 4.3](#s-durability-modes-and-a-crash-between-two-steps)
- `AsyncSqliteSaver` and `AsyncPostgresSaver` under a crash, and the write cost of `AsyncSqliteSaver`. [Section 4.3](#s-durability-modes-and-a-crash-between-two-steps)
- The `checkpoints` stream mode. [Section 4.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode)
- `PostgresStore` with an index on pgvector, and `AsyncPostgresStore`. [Section 4.4](#s-stores-and-long-term-memory)
- The serializer through `PostgresSaver`, `EncryptedSerializer`, and the plaintext rows of issue #8938. [Section 4.6](#s-serialization-of-state-and-what-does-not-round-trip)

## Graph features with no capture yet

These need only a new scenario in the capture kit.

- `Overwrite` to skip a reducer. [Section 5.1](#s-stategraph-state-and-reducers)
- `Command(graph=Command.PARENT)` from a node inside a subgraph. [Section 5.2](#s-edges-send-and-command)
- `retry_policy`, `cache_policy`, and `timeout` on a `@task`. [Section 5.3](#s-the-functional-api-entrypoint-and-task)
- The `RuntimeError` of `Command(resume=...)` with no checkpointer. [Section 5.4](#s-interrupt-and-resume)
- Time travel to a point inside a subgraph. [Section 5.6](#s-time-travel-replay-update-state-and-forks)
- A subgraph called inside a node, a subgraph schema without the shared key, and a subgraph with `add_messages`. [Section 5.7](#s-subgraphs-and-multi-agent-patterns)
- A subgraph compiled with `checkpointer=True` and with `checkpointer=False`. [Section 5.7](#s-subgraphs-and-multi-agent-patterns)
- The four multi-agent patterns other than subagents. [Section 5.7](#s-subgraphs-and-multi-agent-patterns)
- The refusal of a `timeout` on a sync node. [Section 5.8](#s-error-handlers-node-timeouts-and-the-recursion-limit)

## Streaming and parallel tool calls

- A task for each v3 projection, as a fix for the batching of issue langchain#38484. [Section 4.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode)
- The timing of inner agent tokens, which the lab saw in raw v3 events but did not measure. [Section 4.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode)
- One tool call argument of 2,000 tokens through `ChatOllama`, and tool call streaming from Ollama, which sends each call whole. [Section 4.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode)
- Parallel tool calls from Qwen3 8B, and the timing of parallel calls in `messages` mode. [Section 3.1](#s-create-agent-and-the-graph-it-builds)
- A thread pool larger than the default, which the run config cannot set. [Section 3.1](#s-create-agent-and-the-graph-it-builds)

## What holds without these runs

The items above add to the manual. They do not change a recorded result. Every number in Parts 1 to 8 comes from a run on the Mac or the x86 server guest. Every listing comes from the capture kit at the pin. When you depend on one of the open items, run it on your own stack before you rely on the docs.

```takeaways
- Check this list before you rely on a claim that no section measured.
- Run the open case on your own stack when your design depends on it.
- Treat the Agent Server claims on exactly once and outages as untested until you test them.
```

Sources: sections 1.1, 3.1, 3.4, 3.5, 3.6, 4.1, 4.3, 4.4, 4.5, 4.6, 5.1 to 5.8, 6.4, 6.5, 7.1, 7.2, and 7.3 of this manual; capture/lab/T15-agent-server-x86/10-up-license-excerpt.txt; capture/lab/README.md.
