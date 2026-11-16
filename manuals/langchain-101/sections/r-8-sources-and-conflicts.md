# Sources and conflicts

> The manual ranks the code at the tags above the documentation, uses its own recorded runs for every listing and measured number, and records 32 conflicts between its sources.

The ranks are the same as in [How to read this manual](#s-front). When two sources disagree, the higher one wins, and the section says so. We read every source and checked every fact on 2026-11-14. [How this manual was made](#s-ref-how-this-manual-was-made) describes the machines and the method.

## The ranked sources

| Rank | Source | What the manual takes from it |
|---|---|---|
| 1 | the source code of each package at its release tag | every class, parameter, default, and error text, and the reference tables |
| 2 | the LangChain documentation, built from one commit of its repository | the documented behaviour, in our own words, checked against the code and our runs |
| 3 | the changelog and the release notes of each package | when a change came, and which package version holds it |
| 4 | the capture kit, with Qwen3 4B on Ollama where a scenario needs a model | every listing |
| 5 | the lab recordings on two machines, the account run against the hosted LangSmith API, the task-suite bench, and the production service of Part 9. Their Claude rows ran through the Anthropic API | every number in a paragraph that starts with "We measured" |

GitHub issues, pull requests, and security advisories are evidence for a behaviour at the pin. The text names each one by its number, and it never presents an issue as our result. The product pages of the project have no open license. [Section 1.1](#s-langchain-langgraph-langsmith-and-deep-agents) states their claims in our words and sets each one beside a run.

## Rank 1: the code

| Package | Version | Commit | Used in |
|---|---|---|---|
| `langchain` | 1.5.0, released 2026-11-11 | `c2f4036e` | every part |
| `langchain-core` | 1.8.0 | `a4b4a7b9`, the same core tree as `c2f4036e` | every part |
| `langgraph`, with `langgraph-checkpoint` 4.3.2 and `langgraph-prebuilt` 1.1.2 | 1.2.22 | `08a20169` | Part 2, Parts 4 to 6, Part 8 |
| `langgraph-checkpoint-sqlite` | 3.1.3 | `5bd231cb` by the release record. We read its code at `08a20169`, which holds 3.1.3 | Part 2, Part 5 |
| `langgraph-checkpoint-postgres` | 3.2.1, from the lab environment | the `langgraph` repository at `08a20169` | Part 5, Part 9 |
| `deepagents` | 0.7.38 | `c858b364` | [7.4](#s-deep-agents-0-7), [7.5](#s-a-deep-agent-with-a-subagent-and-files) |
| `langsmith` | 0.14.17 | `15dd2a78` | [7.6](#s-langsmith-tracing), [7.7](#s-evaluation-with-langsmith) |
| `langgraph-api`, `langgraph-cli` | 0.18.0, 0.4.43 | the published packages | [8.1](#s-agent-server-langgraph-dev-up-and-deploy) |
| `langchain-openai`, `langchain-anthropic`, `langchain-ollama` | 1.8.0, 1.7.10, 1.1.0 | their own tags | Part 3, [1.2](#s-do-you-need-langchain), [4.3](#s-structured-output-which-strategy-on-which-provider) |
| `fastmcp`, `mcp` | 4.2.0, 2.3.0 | the published packages | [7.3](#s-mcp-with-langchain-mcp) |
| `fastapi`, `starlette`, `uvicorn`, `psycopg`, `opentelemetry-sdk` | 0.162.7, 1.10.0, 0.54.0, 3.3.9, 1.45.2 | the published packages, from the lockfile of the service | Part 9 |
| `agent-chat-ui` | no release and no tag, pinned to `main` | `0d21f7ff`, committed 2026-11-03, with `@langchain/langgraph-sdk` 1.12.8 | [8.2](#s-agent-chat-ui-in-front-of-langgraph-dev) |
| `wcmatch` | 12.0.1, from the lab environment | the published package | [8.4](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses) |
| `langchain-mcp-adapters` | 0.3.2, archived | its last tag | [7.3](#s-mcp-with-langchain-mcp), [8.5](#s-migration-from-0-x-and-stale-advice) |

## Rank 2: the documentation

The site serves its main branch, and no tag of the docs matches a package release. We read every page at docs commit `04d4d4a` of 2026-11-13. The sections cite each page by its path, and these groups of pages are the ones they use most:

| Pages | Used in |
|---|---|
| the agents, models, messages, tools, and install pages of LangChain | Part 1, Part 3, Part 4 |
| structured output, the built-in middleware, custom middleware, guardrails, and human in the loop | Part 4, Part 6 |
| streaming and event streaming of LangChain and LangGraph | Part 2, Part 5 |
| checkpointers, persistence, stores, short-term and long-term memory, and fault tolerance | Part 2, Part 5, Part 6 |
| the graph API, `Send` and `Command`, the functional API, interrupts, time travel, subgraphs, and Pregel | Part 2, Part 6 |
| the MCP pages, the Deep Agents overview, and the retrieval pages | Part 7 |
| tracing, the observability quickstart, evaluation, pytest, and usage and billing of LangSmith | Part 7 |
| Agent Server, its scale guide, the CLI, double texting, the environment variables, and the standalone server | Part 1, Part 8 |
| the release policy, the changelog, the v1 release notes, and the migration guides | Part 3, Part 8 |

## Rank 3: releases

The changelog page and the GitHub release of each package give the version of each change. [Section 8.5](#s-migration-from-0-x-and-stale-advice) uses them to date each change since 0.x.

The LangChain, LangGraph, and Python marks in the figures belong to their owners, and we use them only to identify the projects.

## Ranks 4 and 5: the kit and the lab

The capture kit writes 56 files: 19 model-free, 36 recorded, and 1 sidecar. The lab holds 51 experiment folders, 48 summary files, and the bench with its own summary. The production service of Part 9 keeps its code, its raw runs, and ten summaries in one folder. The bench and the service priced each Claude call at the list prices of the Anthropic pricing page, read on 2026-11-14. [How this manual was made](#s-ref-how-this-manual-was-made) lists each experiment with its machine and its count.

## Issues and advisories

| Issue | What it reports | Used in |
|---|---|---|
| langgraph #9267 | `durability="sync"` without a checkpointer raises `AttributeError` | [5.3](#s-durability-modes-and-a-crash-between-two-steps), [8.6](#s-symptom-cause-fix) |
| langgraph #8039 | `sync` does not fix the order of `put_writes` and `put` | [5.3](#s-durability-modes-and-a-crash-between-two-steps) |
| langgraph #9185, #9240 | a node that raised runs again on a resume, and a request to document that durability is not exactly once | [5.3](#s-durability-modes-and-a-crash-between-two-steps) |
| langgraph #8757 | `SqliteStore` keeps vector rows after a delete | [5.4](#s-stores-and-long-term-memory), [8.4](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses) |
| langgraph #7714 | a measured token cost of checkpoints, closed because checkpoints are not sent to the model | [5.5](#s-context-engineering-and-summarization) |
| langchain #38352 | orphan tool messages after a summary, which our runs did not reproduce | [5.5](#s-context-engineering-and-summarization) |
| langgraph #8388, #8184, #8826, #8938 | values that the serializer does not rebuild, and plaintext rows under encryption | [5.6](#s-serialization-of-state-and-what-does-not-round-trip) |
| langchain #38484, #38533 | a v3 consumer gets the final answer in one burst, and a closed pull request that changed `create_agent` and not the projection code | [5.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode), [2.5](#s-where-each-stream-mode-comes-from) |
| langgraph #9712 | after `InvalidUpdateError`, a saved thread raises on every read until a reducer is deployed, which we reported | [6.1](#s-stategraph-state-and-reducers), [2.2](#s-channels-and-colliding-writes), [8.6](#s-symptom-cause-fix) |
| langchain #40492 | a middleware jump can skip a batched review | [4.5](#s-middleware-hooks-and-their-order), [6.5](#s-human-in-the-loop-batched-and-per-call), [8.4](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses) |
| langchain #33787, langgraph #9106 | an edit that ran the old call, and a resume that ran a finished branch, which did not reproduce | [6.5](#s-human-in-the-loop-batched-and-per-call) |
| langchain #40531, langgraph #7988 | tool calls with no id, and two tools with one name | [3.4](#s-tools-toolruntime-and-tool-errors) |
| langchain #40688 | a tool retry runs a tool that is not idempotent again | [4.7](#s-retries-backup-models-rate-limits-and-caching) |
| langgraph #8517 | `ToolNode` under `ainvoke` ignores `max_concurrency` | [4.1](#s-create-agent-and-the-graph-it-builds) |
| langchain #40471 | an MCP error result loses its `structuredContent` | [7.3](#s-mcp-with-langchain-mcp) |
| langchain #41870 | `tracing_context(enabled="local")` sends the runs of LangChain code, which we reported | [7.6](#s-langsmith-tracing), [7.7](#s-evaluation-with-langsmith) |
| langsmith-python #106 | `evaluate(upload_results=False)` prints `%s` and gives three names to one call, which we reported | [7.7](#s-evaluation-with-langsmith) |
| langsmith-python #107 | with tracking on, every `log_*` call of the pytest plugin raises unless `LANGSMITH_TRACING=true`, which we reported | [7.7](#s-evaluation-with-langsmith) |

[Section 8.4](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses) gives the table of security advisories, with the range of each one and our result at the pin.

## The conflict register

Each row is one disagreement between two sources. The choice is what this manual tells you to do, and the last column says what the project had done by 2026-11-14.

| Id | The sources say | The manual follows | Sections | Upstream |
|---|---|---|---|---|
| D2 | The docstring of `GenericFakeChatModel` says that it does not stream, and the unit testing page says that it does. The code streams text and drops tool calls. | the code: test streaming against a real model, or a fake that streams tool calls | [8.6](#s-symptom-cause-fix) | no issue found |
| D3 | The example in the `ToolRuntime` docstring calls `stream_writer.write`. The type is a plain callable. | the code: call `runtime.stream_writer(value)` | [3.4](#s-tools-toolruntime-and-tool-errors) | not checked |
| D4 | `StreamMode` and the streaming page list seven modes. The loop also accepts `tools`. | the code and the capture: `tools` is a mode | [5.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode), [R.3](#s-ref-stream-modes-and-event-types) | not checked |
| D6 | `durability="sync"` is a documented mode. Without a checkpointer it raises `AttributeError`. | the run: use `sync` only with a checkpointer | [5.3](#s-durability-modes-and-a-crash-between-two-steps) | issue #9267 open at the pin. Fix PR #9268 closed without a merge |
| D8 | The docstring of `create_deep_agent` names `execute` and not `delete`. The default backend binds `delete` and no `execute`. | the capture: `delete` is a default tool | [7.4](#s-deep-agents-0-7) | not checked |
| D101 | The install page and the release policy say Python 3.10, and the policy changes the floor only in a major release. `langchain` 1.5.0 needs 3.11. | the package metadata: Python 3.11 or later | [3.1](#s-install-and-the-package-map), [8.5](#s-migration-from-0-x-and-stale-advice) | open at docs `04d4d4a` |
| D102 | A batched example edits a call to a new tool name. The per-call text and the 1.4.6 changelog say that an edit keeps the tool. | the lab: batched mode allows the switch, and per-call mode refuses it | [6.5](#s-human-in-the-loop-batched-and-per-call) | open |
| D104 | The agents page calls `messages` append only. The memory page removes messages with `RemoveMessage`. | the code of `add_messages`: append, replace by id, and remove | [6.1](#s-stategraph-state-and-reducers) | open |
| D105 | The graph API page gives 10,007, and 10,000 for older versions. The server docs give 10011. Old advice gives 25. | the code and the runs: 10007 for a graph, 9999 for `create_agent`, 10007 under `langgraph dev` | [6.8](#s-error-handlers-node-timeouts-and-the-recursion-limit), [8.1](#s-agent-server-langgraph-dev-up-and-deploy), [R.5](#s-ref-environment-variables) | open |
| D106 | The stores page links `InMemoryStore` to a class in `langchain_core.stores`. Its code imports `langgraph.store.memory`. | the code: import from `langgraph.store.memory` | [5.4](#s-stores-and-long-term-memory), [R.4](#s-ref-checkpointer-and-store-api) | open |
| D107 | Both v1 release pages link `create_react_agent` to the function of the same name in `langchain-classic`. | the code: two functions share the name | [8.5](#s-migration-from-0-x-and-stale-advice) | open |
| D108 | A LangSmith FAQ table calls checkpointers community code and streaming basic. | the current pages and the code | [8.5](#s-migration-from-0-x-and-stale-advice) | open |
| D109 | The Deep Agents overview names planning as a default. The 0.7.0 changelog makes it opt in. | the changelog and the capture: add `TodoListMiddleware` | [7.4](#s-deep-agents-0-7), [8.5](#s-migration-from-0-x-and-stale-advice) | open |
| D111 | The product page says that tracing never affects your application. The tracing docs say that `LANGCHAIN_CALLBACKS_BACKGROUND=false` makes callbacks wait. No code at the pin reads that variable. | the lab and the code: about 6 ms per agent run on Qwen3 4B against the hosted API, and no effect from the variable at the pin | [7.6](#s-langsmith-tracing) | open at docs `04d4d4a` |
| D113 | The prompt hub page teaches the hub through `langchain_classic`. | the LangSmith client methods that the same page recommends | [7.7](#s-evaluation-with-langsmith), [8.5](#s-migration-from-0-x-and-stale-advice) | open |
| D114 | A tracing page leads with an LCEL chain. | trace a `create_agent` agent | [8.5](#s-migration-from-0-x-and-stale-advice) | open |
| D116 | The local server page prints the old name LangGraph Studio. | the current names: LangSmith Studio and Agent Server | [8.5](#s-migration-from-0-x-and-stale-advice) | open |
| D117 | The v1 release page has a frozen list of providers with content blocks, and no `langchain.mcp`. | the changelog and the current pages | [8.5](#s-migration-from-0-x-and-stale-advice) | open |
| D118 | The checkpointers page says that a thread must be created before a run. That rule belongs to Agent Server. | the code: the first checkpoint creates the thread | [5.2](#s-checkpointers-and-threads) | open |
| D119 | The checkpointers page does not name the default durability. The Agent Server pages say `async`. | the code: `async` | [5.3](#s-durability-modes-and-a-crash-between-two-steps) | open |
| D121 | The structured output page says that an agent uses tool calling when the model has no structured output, for `ProviderStrategy` too. | the code: an explicit strategy stays as it is | [4.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) | open |
| D123 | The help text of `langgraph dev` gives 10 jobs per worker. The code uses 1. The docs give 1 for Python and 10 for JS. | the code and the run: 1 | [8.1](#s-agent-server-langgraph-dev-up-and-deploy) | open |
| D124 | The streaming page says that `tasks` mode needs a checkpointer. The kit got chunks from `tasks` and `debug` without one. | the capture | [5.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) | not checked |
| D130 | The built-in middleware page lists 22 classes. `langchain` has 19, and three come from `deepagents`. | the code: 19 in `langchain` | [4.6](#s-the-built-in-middleware) | open |
| D131 | The backends page says that `virtual_mode` defaults to `False`. The code sets it to `True`. | the code and the run: a backend built with no `virtual_mode` gave the same 28 results as `virtual_mode=True` | [8.4](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses) | not checked |
| D132 | The permissions page says that an allow rule on `/workspace/**`, placed first, matches `.env`, so a later deny never fires. | the run: `/workspace/**` does not match a dot name, so both orders denied `/workspace/.env` and both let `/.env` through | [8.4](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses) | not checked |
| D133 | The permissions examples "Deny all access", "Read-only", and "Isolate to a workspace directory" use `/**`. | the run: `/**` skips dot names, so `.env`, `.git`, and `.bashrc` stay readable or writable, and the isolate list also denies `ls` of `/workspace` | [8.4](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses) | not checked |
| D134 | The backends page names a legacy default that reads `assistant_id`, and says a namespace is required from v0.5.0. | the code and the run: at 0.7.38 the namespace is required, and `StoreBackend(store=s)` raised `TypeError` | [5.4](#s-stores-and-long-term-memory) | not checked |
| D135 | The composite backend examples pass `namespace=lambda _rt: ("memories",)`. | the run: that factory is one namespace for every user, so build it from the user id | [5.4](#s-stores-and-long-term-memory), [8.4](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses) | not checked |
| D136 | The backends page allows a period in a namespace label and suggests the user identity as a label. The store refuses a period with `InvalidNamespaceError`. | the run: an email address as a label fails on write, so map it to a label without a period | [5.4](#s-stores-and-long-term-memory) | not checked |
| D137 | The models page of Deep Agents shows an overall score of 0.18 for `openai:gpt-5.4` and 0.26 for `anthropic:claude-opus-4-6`. | the page itself: each overall score equals the tool use score of its row, while the file operations, retrieval, and summarization cells are 0.92 to 1.00, and each row mixes cells from 3 CI runs | [1.2](#s-do-you-need-langchain) | no upstream item |
| D209 | Users report errors, with no switch to tool calling, from an explicit `ProviderStrategy` on Bedrock and Ollama. The docs say that it switches. | the code and the lab: no switch | [4.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) | issue langchain #35119 |
| D211 | A web page says that LangGraph streaming adds 100 to 300 ms to the first token, with no method. | the lab: under 3.5 ms at the median on Qwen3 4B | [5.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) | no upstream item |

The ids are not continuous. The research kept one range of ids for each kind of source. D1 to D17 are the code, and D101 to D137 are the docs. D201 to D211 are posts and issues. This register holds every id that a section cites.

Sources: front.md; manual.json (pin, sources); the Sources line and the citations of every file under sections/; capture/README.md, capture/lab/README.md.
