# Sources and conflicts

> The manual ranks the code at the tags above the documentation, uses its own recorded runs for every listing and number, and records 29 conflicts between its sources.

The ranks are the same as in [How to read this manual](#s-front). When two sources disagree, the higher one wins, and the section says so. We read every source and checked every fact on 2026-11-14. [How this manual was made](#s-ref-how-this-manual-was-made) describes the machines and the method.

## The ranked sources

| Rank | Source | What the manual takes from it |
|---|---|---|
| 1 | the source code of each package at its release tag | every class, parameter, default, and error text, and the reference tables |
| 2 | the LangChain documentation, built from one commit of its repository | the documented behaviour, in our own words, checked against the code and our runs |
| 3 | the changelog and the release notes of each package | when a change came, and which package version holds it |
| 4 | LangChain Academy, the courses that LangChain publishes, and their open repositories | the order in which LangChain teaches the stack, and the starting points of Part 8 |
| 5 | the capture kit, with a scripted fake model, offline | every listing |
| 6 | the lab recordings on two machines | every number in a paragraph that starts with "We measured" |

GitHub issues, pull requests, and security advisories are evidence for a behaviour at the pin. The text names each one by its number, and it never presents an issue as our result. The product pages of the project have no open license. [Section 1.1](#s-langchain-langgraph-langsmith-and-deep-agents) states their claims in our words and sets each one beside a run.

## Rank 1: the code

| Package | Version | Commit | Used in |
|---|---|---|---|
| `langchain` | 1.5.0, released 2026-11-11 | `c2f4036e` | every part |
| `langchain-core` | 1.8.0 | `a4b4a7b9`, the same core tree as `c2f4036e` | every part |
| `langgraph`, with `langgraph-checkpoint` 4.3.2 and `langgraph-prebuilt` 1.1.2 | 1.2.22 | `08a20169` | Parts 3 to 5, Part 7 |
| `langgraph-checkpoint-sqlite` | 3.1.3 | `5bd231cb` | Part 4, Part 8 |
| `langgraph-checkpoint-postgres` | 3.2.1, from the lab environment | the `langgraph` repository at `08a20169` | Part 4 |
| `deepagents` | 0.7.38 | `c858b364` | [6.3](#s-deep-agents-0-7), [8.4](#s-a-deep-agent-with-a-subagent-and-files) |
| `langsmith` | 0.14.17 | `15dd2a78` | [6.4](#s-langsmith-tracing), [6.5](#s-evaluation-with-langsmith) |
| `langgraph-api`, `langgraph-cli` | 0.18.0, 0.4.43 | the published packages | [7.1](#s-agent-server-langgraph-dev-up-and-deploy) |
| `langchain-openai`, `langchain-anthropic`, `langchain-ollama` | 1.8.0, 1.7.10, 1.1.0 | their own tags | Part 2 |
| `fastmcp`, `mcp` | 4.2.0, 2.3.0 | the published packages | [6.2](#s-mcp-with-langchain-mcp) |
| `langchain-mcp-adapters` | 0.3.2, archived | its last tag | [6.2](#s-mcp-with-langchain-mcp), [7.4](#s-migration-from-0-x-and-stale-advice) |

## Rank 2: the documentation

The site serves its main branch, and no tag of the docs matches a package release. We read every page at docs commit `04d4d4a` of 2026-11-13. The sections cite each page by its path, and these groups of pages are the ones they use most:

| Pages | Used in |
|---|---|
| the agents, models, messages, tools, and install pages of LangChain | Part 1, Part 2, Part 3 |
| structured output, the built-in middleware, custom middleware, guardrails, and human in the loop | Part 3, Part 5 |
| streaming and event streaming of LangChain and LangGraph | Part 4 |
| checkpointers, persistence, stores, short-term and long-term memory, and fault tolerance | Part 4, Part 5 |
| the graph API, `Send` and `Command`, the functional API, interrupts, time travel, subgraphs, and Pregel | Part 5 |
| the MCP pages, the Deep Agents overview, and the retrieval pages | Part 6 |
| tracing, the observability quickstart, evaluation, pytest, and usage and billing of LangSmith | Part 6 |
| Agent Server, its scale guide, the CLI, double texting, the environment variables, and the standalone server | Part 1, Part 7 |
| the release policy, the changelog, the v1 release notes, and the migration guides | Part 2, Part 7 |

## Rank 3: releases

The changelog page and the GitHub release of each package give the version of each change. [Section 7.4](#s-migration-from-0-x-and-stale-advice) uses them to date each change since 0.x.

## Rank 4: LangChain Academy

We read four MIT repositories of the courses: `lca-lc-foundations`, `lca-langchainV1-essentials`, `lca-langgraph-essentials`, and `langchain-academy`. Their order of topics matches Parts 2 to 4. Some of their code is older than the pin, and four rows of the register below record it.

## Ranks 5 and 6: the kit and the lab

The capture kit writes 44 files, and the lab holds 23 experiment folders and 24 summary files. [How this manual was made](#s-ref-how-this-manual-was-made) lists each experiment with its machine and its count.

## Issues and advisories

| Issue | What it reports | Used in |
|---|---|---|
| langgraph #9267 | `durability="sync"` without a checkpointer raises `AttributeError` | [4.3](#s-durability-modes-and-a-crash-between-two-steps), [7.5](#s-symptom-cause-fix) |
| langgraph #8039 | `sync` does not fix the order of `put_writes` and `put` | [4.3](#s-durability-modes-and-a-crash-between-two-steps) |
| langgraph #9185, #9240 | a node that raised runs again on a resume, and a request to document that durability is not exactly once | [4.3](#s-durability-modes-and-a-crash-between-two-steps) |
| langgraph #8757 | `SqliteStore` keeps vector rows after a delete | [4.4](#s-stores-and-long-term-memory), [7.3](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses) |
| langgraph #7714 | a measured token cost of checkpoints, closed because checkpoints are not sent to the model | [4.5](#s-context-engineering-and-summarization) |
| langchain #38352 | orphan tool messages after a summary, which our runs did not reproduce | [4.5](#s-context-engineering-and-summarization) |
| langgraph #8388, #8184, #8826, #8938 | values that the serializer does not rebuild, and plaintext rows under encryption | [4.6](#s-serialization-of-state-and-what-does-not-round-trip) |
| langchain #38484 | a v3 consumer gets the final answer in one burst | [4.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) |
| langchain #40492 | a middleware jump can skip a batched review | [3.3](#s-middleware-hooks-and-their-order), [5.5](#s-human-in-the-loop-batched-and-per-call), [7.3](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses) |
| langchain #33787, langgraph #9106 | an edit that ran the old call, and a resume that ran a finished branch, which did not reproduce | [5.5](#s-human-in-the-loop-batched-and-per-call) |
| langchain #40531, langgraph #7988 | tool calls with no id, and two tools with one name | [2.4](#s-tools-toolruntime-and-tool-errors) |
| langchain #40688 | a tool retry runs a tool that is not idempotent again | [3.5](#s-retries-backup-models-rate-limits-and-caching) |
| langgraph #8517 | `ToolNode` under `ainvoke` ignores `max_concurrency` | [3.1](#s-create-agent-and-the-graph-it-builds) |

[Section 7.3](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses) gives the table of security advisories, with the range of each one and our result at the pin.

## The conflict register

Each row is one disagreement between two sources. The choice is what this manual tells you to do, and the last column says what the project had done by 2026-11-14.

| Id | The sources say | The manual follows | Sections | Upstream |
|---|---|---|---|---|
| D2 | The docstring of `GenericFakeChatModel` says that it does not stream, and the unit testing page says that it does. The code streams text and drops tool calls. | the code and the capture: use a fake that streams tool calls | [4.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) | no issue found |
| D3 | The example in the `ToolRuntime` docstring calls `stream_writer.write`. The type is a plain callable. | the code: call `runtime.stream_writer(value)` | [2.4](#s-tools-toolruntime-and-tool-errors) | not checked |
| D4 | `StreamMode` and the streaming page list seven modes. The loop also accepts `tools`. | the code and the capture: `tools` is a mode | [4.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode), [R.3](#s-ref-stream-modes-and-event-types) | not checked |
| D6 | `durability="sync"` is a documented mode. Without a checkpointer it raises `AttributeError`. | the run: use `sync` only with a checkpointer | [4.3](#s-durability-modes-and-a-crash-between-two-steps) | issue #9267 open at the pin. Fix PR #9268 closed without a merge |
| D8 | The docstring of `create_deep_agent` names `execute` and not `delete`. The default backend binds `delete` and no `execute`. | the capture: `delete` is a default tool | [6.3](#s-deep-agents-0-7) | not checked |
| D101 | The install page and the release policy say Python 3.10, and the policy changes the floor only in a major release. `langchain` 1.5.0 needs 3.11. | the package metadata: Python 3.11 or later | [2.1](#s-install-and-the-package-map), [7.4](#s-migration-from-0-x-and-stale-advice) | open at docs `04d4d4a` |
| D102 | A batched example edits a call to a new tool name. The per-call text and the 1.4.6 changelog say that an edit keeps the tool. | the lab: batched mode allows the switch, and per-call mode refuses it | [5.5](#s-human-in-the-loop-batched-and-per-call) | open |
| D104 | The agents page calls `messages` append only. The memory page removes messages with `RemoveMessage`. | the code of `add_messages`: append, replace by id, and remove | [5.1](#s-stategraph-state-and-reducers) | open |
| D105 | The graph API page gives 10,007, and 10,000 for older versions. The server docs give 10011. Old advice gives 25. | the code and the runs: 10007 for a graph, 9999 for `create_agent`, 10007 under `langgraph dev` | [5.8](#s-error-handlers-node-timeouts-and-the-recursion-limit), [7.1](#s-agent-server-langgraph-dev-up-and-deploy), [R.5](#s-ref-environment-variables) | open |
| D106 | The stores page links `InMemoryStore` to a class in `langchain_core.stores`. Its code imports `langgraph.store.memory`. | the code: import from `langgraph.store.memory` | [4.4](#s-stores-and-long-term-memory), [R.4](#s-ref-checkpointer-and-store-api) | open |
| D107 | Both v1 release pages link `create_react_agent` to the function of the same name in `langchain-classic`. | the code: two functions share the name | [7.4](#s-migration-from-0-x-and-stale-advice) | open |
| D108 | A LangSmith FAQ table calls checkpointers community code and streaming basic. | the current pages and the code | [7.4](#s-migration-from-0-x-and-stale-advice) | open |
| D109 | The Deep Agents overview names planning as a default. The 0.7.0 changelog makes it opt in. | the changelog and the capture: add `TodoListMiddleware` | [6.3](#s-deep-agents-0-7), [7.4](#s-migration-from-0-x-and-stale-advice) | open |
| D113 | The prompt hub page teaches the hub through `langchain_classic`. | the LangSmith client methods that the same page recommends | [7.4](#s-migration-from-0-x-and-stale-advice) | open |
| D114 | A tracing page leads with an LCEL chain. | trace a `create_agent` agent | [7.4](#s-migration-from-0-x-and-stale-advice) | open |
| D116 | The local server page prints the old name LangGraph Studio. | the current names: LangSmith Studio and Agent Server | [7.4](#s-migration-from-0-x-and-stale-advice) | open |
| D117 | The v1 release page has a frozen list of providers with content blocks, and no `langchain.mcp`. | the changelog and the current pages | [7.4](#s-migration-from-0-x-and-stale-advice) | open |
| D118 | The checkpointers page says that a thread must be created before a run. That rule belongs to Agent Server. | the code: the first checkpoint creates the thread | [4.2](#s-checkpointers-and-threads) | open |
| D119 | The checkpointers page does not name the default durability. The Agent Server pages say `async`. | the code: `async` | [4.3](#s-durability-modes-and-a-crash-between-two-steps) | open |
| D121 | The structured output page says that an agent uses tool calling when the model has no structured output, for `ProviderStrategy` too. | the code: an explicit strategy stays as it is | [3.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) | open |
| D123 | The help text of `langgraph dev` gives 10 jobs per worker. The code uses 1. The docs give 1 for Python and 10 for JS. | the code and the run: 1 | [7.1](#s-agent-server-langgraph-dev-up-and-deploy) | open |
| D124 | The streaming page says that `tasks` mode needs a checkpointer. The kit got chunks from `tasks` and `debug` without one. | the capture | [4.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) | not checked |
| D130 | The built-in middleware page lists 22 classes. `langchain` has 19, and three come from `deepagents`. | the code: 19 in `langchain` | [3.4](#s-the-built-in-middleware) | open |
| D209 | Users report errors, with no switch to tool calling, from an explicit `ProviderStrategy` on Bedrock and Ollama. The docs say that it switches. | the code and the lab: no switch | [3.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) | issue langchain #35119 |
| D211 | A web page says that LangGraph streaming adds 100 to 300 ms to the first token, with no method. | the lab: under 2 ms at the median | [4.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) | no upstream item |
| D302 | Some Academy lessons teach `NodeInterrupt`, which is deprecated at the pin. | the code: `interrupt` | [5.4](#s-interrupt-and-resume) | Academy not updated |
| D303 | Some Academy files import `Send` from `langgraph.constants`, which warns at the pin. | the code: import from `langgraph.types` | [5.2](#s-edges-send-and-command) | Academy not updated |
| D305 | Every Academy MCP lesson imports `MultiServerMCPClient` from the archived adapter. | the code: `langchain.mcp`, in beta | [6.2](#s-mcp-with-langchain-mcp) | Academy not updated |
| D306 | An Academy notebook at `deepagents` 0.5.3 teaches `write_todos` as a default tool. | the code at 0.7.38: no todo list by default | [6.3](#s-deep-agents-0-7) | Academy not updated |

The ids are not continuous. The research kept one range of ids for each kind of source. D1 to D17 are the code, and D101 to D130 are the docs. D201 to D211 are posts and issues, and D301 to D313 are the Academy. This register holds every id that a section cites.

Sources: front.md; manual.json (pin, sources); the Sources line and the citations of every file under sections/; capture/README.md, capture/lab/README.md.
