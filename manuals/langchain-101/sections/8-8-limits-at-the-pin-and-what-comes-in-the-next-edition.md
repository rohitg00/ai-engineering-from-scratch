# Limits at the pin, and what comes in the next edition

> This edition tested the stack offline, on two machines, and on one free LangSmith account, without an Agent Server license, so the items below have no recorded run yet.

You read a section and find that a case you care about was not run. This section collects every such case in one place, grouped by what each one needs, with a link back to the section that raised it.

When you finish this section, you can tell which claims of this manual rest on a recorded run. You can also plan your own test of an open case.

One item has one trial in a worked example, and its line says so. Until the next edition, this manual gives no measured result for the other items.

## Why these runs are missing

Three limits decided what this edition could run. The full Agent Server with Postgres and Redis does not start without a LangSmith API key or a license key, as [section 8.1](#s-agent-server-langgraph-dev-up-and-deploy) shows.

Our LangSmith account was a new one on the free plan. It ran tracing, `evaluate`, the pytest plugin, and the prompt hub, and the lists below hold what it left out. Our local models were Qwen3 0.6B to 30B-A3B and gpt-oss 20B on Ollama. Claude Haiku 5.5 and Claude Sonnet 5.5 ran the task suite of [section 1.2](#s-do-you-need-langchain), under a fixed budget. Claude Haiku 5.5 also ran the 20 evals of [section 9.6](#s-evals-that-check-state). The other hosted cases below have no run yet.

Each list below names the case and the section where the text stops. Most of the graph cases need no account and only a new scenario in the capture kit.

## The production service

These need one more run of the service of [Part 9](#p-9), on the Mac.

- The explicit crash trials with Qwen3 14B: three kills of a worker with an amount and a reason in the request. Ollama did not load that model for 9.5 minutes while another job held the memory, so we stopped them. [Section 9.3](#s-approvals-and-the-idempotency-key)
- Whether a decision sent in the plain resume form survives a crash in `checkpoint_writes`, and a resume with no new decision. [Section 9.3](#s-approvals-and-the-idempotency-key)
- The cause of the drop in Ollama output with 4 or 8 requests at once. [Section 9.7](#s-workers-the-advisory-lock-and-cost)
- The CI workflow of the service on GitHub Actions, with a real model. [Section 9.6](#s-evals-that-check-state)

## Agent Server with Postgres and Redis

These need `langgraph up` with a key, or a deployment.

- Exactly once in the Postgres task queue, with a worker killed in the middle of a run. [Section 1.1](#s-langchain-langgraph-langsmith-and-deep-agents)
- Recovery from a short Redis outage and a short Postgres outage. [Section 1.1](#s-langchain-langgraph-langsmith-and-deep-agents)
- A run on an interrupted worker, and the checkpoint it resumes from. [Section 1.1](#s-langchain-langgraph-langsmith-and-deep-agents)
- What Redis holds during a run, and for how long. [Section 1.1](#s-langchain-langgraph-langsmith-and-deep-agents)
- Agent Server under a crash at the points of the library crash matrix. [Section 5.3](#s-durability-modes-and-a-crash-between-two-steps)
- The time floor of one run, jobs per worker, and the recursion limit under `langgraph up`. [Section 8.1](#s-agent-server-langgraph-dev-up-and-deploy)
- The store permissions of custom auth, and cross-user reads through the server. [Section 5.4](#s-stores-and-long-term-memory) and [section 8.4](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses)
- `langgraph deploy`, its serverless and dedicated types, and a cold start. [Section 8.1](#s-agent-server-langgraph-dev-up-and-deploy)
- `langgraph up` with the key of a free account, and the license check inside the server image, which Docker must run. [Section 8.1](#s-agent-server-langgraph-dev-up-and-deploy)

## LangSmith with an account

- Versions and splits of a dataset, given to `evaluate` by name. [Section 7.7](#s-evaluation-with-langsmith)
- A comparison of two experiments. [Section 7.7](#s-evaluation-with-langsmith)
- Online evaluators on production traces, and annotation queues. [Section 7.7](#s-evaluation-with-langsmith)
- A judge evaluator on wrong answers, because every answer in our run was right. [Section 7.7](#s-evaluation-with-langsmith)
- Traffic that reaches the limits the account reports: 100 runs per post, 1,000 runs per trace, and the retention tiers. [Section 7.6](#s-langsmith-tracing)

## LangSmith without an account

These need no account, only a new lab run.

- `evaluate` with a client that you pass, to see if the agent runs follow that client or the default one. [Section 7.7](#s-evaluation-with-langsmith)
- The pytest plugin with `LANGSMITH_TEST_CACHE` and `vcrpy`, with pytest 7 and 9, with `pytest-xdist`, and with async tests. [Section 7.7](#s-evaluation-with-langsmith)

## MCP

- OAuth, URL-mode elicitation, and several input requests in one round. [Section 7.3](#s-mcp-with-langchain-mcp)
- The two elicitation cases that raise `MCPError`, inside an agent run, and the elicitation cases over stdio. [Section 7.3](#s-mcp-with-langchain-mcp)

## Hosted providers and real models

- A harder task suite that separates Claude Haiku 5.5 from Claude Sonnet 5.5, because both passed every task they ran. [Section 1.2](#s-do-you-need-langchain)
- `ProviderToolSearchMiddleware` with a real deferral on Anthropic or OpenAI. [Section 4.6](#s-the-built-in-middleware)
- `ModelFallbackMiddleware` on a 400 from a bad request. [Section 4.7](#s-retries-backup-models-rate-limits-and-caching)
- `set_llm_cache`, the node cache of `create_agent`, and the rate limiter against a model. [Section 4.7](#s-retries-backup-models-rate-limits-and-caching)

## Middleware

- `PIIMiddleware` on a stream with `apply_to_output=True`, and its hold-back of 128 characters. [Section 4.8](#s-guardrails-pii-and-the-decision-middleware-beta)
- The cost of async hooks, of `after_agent` and `dynamic_prompt`, and of built-ins when they act, such as a retry or a summary. [Section 8.3](#s-cost-the-framework-against-a-plain-sdk-loop)
- One invalid answer among several approvals sent together, which the docs warn can run a tool twice. [Section 6.5](#s-human-in-the-loop-batched-and-per-call)

## Persistence

- `AsyncSqliteSaver` under a crash, and its write cost. [Section 5.3](#s-durability-modes-and-a-crash-between-two-steps)
- `AsyncPostgresSaver` under a crash at the kill points of the library matrix. [Section 9.3](#s-approvals-and-the-idempotency-key) killed a worker at one point only.
- The `checkpoints` stream mode. [Section 5.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode)
- `PostgresStore` and `AsyncPostgresStore` with an index on pgvector. [Section 5.4](#s-stores-and-long-term-memory) and [section 9.2](#s-postgres-checkpointer-store-and-owner-check) ran them without an index.
- The serializer through `PostgresSaver`, `EncryptedSerializer`, and the plaintext rows of issue #8938. [Section 5.6](#s-serialization-of-state-and-what-does-not-round-trip)

## Graph features with no capture yet

These need only a new scenario in the capture kit.

- `Overwrite` to skip a reducer. [Section 6.1](#s-stategraph-state-and-reducers)
- `Command(graph=Command.PARENT)` from a node inside a subgraph. [Section 6.2](#s-edges-send-and-command)
- `retry_policy`, `cache_policy`, and `timeout` on a `@task`. [Section 6.3](#s-the-functional-api-entrypoint-and-task)
- The `RuntimeError` of `Command(resume=...)` with no checkpointer. [Section 6.4](#s-interrupt-and-resume)
- Time travel to a point inside a subgraph. [Section 6.6](#s-time-travel-replay-update-state-and-forks)
- A subgraph called inside a node, a subgraph schema without the shared key, and a subgraph with `add_messages`. [Section 6.7](#s-subgraphs-and-multi-agent-patterns)
- A subgraph compiled with `checkpointer=True` and with `checkpointer=False`. [Section 6.7](#s-subgraphs-and-multi-agent-patterns)
- The refusal of a `timeout` on a sync node. [Section 6.8](#s-error-handlers-node-timeouts-and-the-recursion-limit)

## Streaming and parallel tool calls

- A task for each v3 projection, as a fix for the batching of issue langchain#38484. [Section 5.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode)
- The timing of inner agent tokens, which the lab saw in raw v3 events but did not measure. [Section 5.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode)
- One tool call argument of 2,000 tokens through `ChatOllama`, and tool call streaming from Ollama, which sends each call whole. [Section 5.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode)
- Parallel tool calls from Qwen3 8B, and the timing of parallel calls in `messages` mode. [Section 4.1](#s-create-agent-and-the-graph-it-builds)
- A run with a thread pool larger than the default. The code lets `max_concurrency` set the pool size, and our runs used 8 at most. [Section 4.1](#s-create-agent-and-the-graph-it-builds)

## Chat UI, file rules, and store namespaces

- Agent Chat UI with its default telemetry on, as a production build, and as the hosted copy. [Section 8.2](#s-agent-chat-ui-in-front-of-langgraph-dev) ran a dev build with telemetry off.
- Agent Chat UI against `langgraph up`, with a deployed graph, and with your own auth in front of its passthrough route. [Section 8.2](#s-agent-chat-ui-in-front-of-langgraph-dev)
- More than one trial of each approval answer and of a typed message over a pending approval. Approve, edit, and reject ran once each, and the typed message ran once in each mode. [Section 8.2](#s-agent-chat-ui-in-front-of-langgraph-dev)
- A rate for the file-rule attacks. Each of the 20 prompts ran once under each rule list, so the table counts prompts and not repeated trials. [Section 8.4](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses)
- File rules with `interrupt` mode, with a person who answers, and with a sandbox backend that has no `execute` route. [Section 8.4](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses)
- The namespace factory of `StoreBackend` on other models, and with prompts that do not name `/memories/`. One run with a vaguer prompt called no tool. [Section 5.4](#s-stores-and-long-term-memory)

## What holds without these runs

The items above add to the manual. They do not change a recorded result. Every measured number in Parts 1 to 9 comes from a run on the Mac or the x86 server guest. Defaults, limits, and versions come from the code or the docs, and the text cites them. Every listing comes from the capture kit at the pin. When you depend on one of the open items, run it on your own stack before you rely on the docs.

```takeaways
- Check this list before you rely on a claim that no section measured.
- Run the open case on your own stack when your design depends on it.
- Treat the Agent Server claims on exactly once and outages as untested until you test them.
```

Sources: sections 1.1, 3.1, 3.4, 3.5, 3.6, 4.1, 4.3, 4.4, 4.5, 4.6, 5.1 to 5.8, 6.2, 6.4, 6.5, 7.1, 7.2, 7.3, 7.6, 7.7, 8.1, 8.2, 8.4, and 9.1 to 9.7 of this manual; capture/lab/T15-agent-server-x86/10-up-license-excerpt.txt; capture/lab/T21-langsmith-account-mac/07-e5-up.txt; capture/lab/README.md.
