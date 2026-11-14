# LangChain 101 capture kit

Every listing in LangChain 101 is cut from a file in `out/`. The kit drives LangChain, LangGraph, Deep Agents, `langchain.mcp`, and the LangSmith SDK in one Python process. A scripted fake chat model takes the place of a provider. The kit needs no network and no API keys.

```bash
python3 capture/run.py          # writes capture/out/
python3 capture/run.py --check  # captures again into a temporary folder and compares byte for byte
```

Run both from the manual directory. `--check` prints `ok: N files match`, or a unified diff of each file that changed and `drift: ...`, and then exits with status 1.

## Install

The kit needs Python 3.13 and the exact versions in `requirements.txt`.

```bash
python3.13 -m venv capture/.venv
capture/.venv/bin/pip install -r capture/requirements.txt
```

When the interpreter that runs `run.py` does not have the pinned packages, `run.py` runs itself again with `capture/.venv/bin/python`, or with the interpreter in `LANGCHAIN101_PYTHON`. When it finds neither, `--check` prints `skipped:` with the reason and exits 0, and a plain run exits 1. `capture/.venv/` is ignored by git.

You can also run the kit one scenario at a time: `python3 capture/run.py mw-hitl stream-v2` writes only the files whose names start with those words, and leaves the rest of `out/` as it is.

## The pin

| Package | Version |
|---|---|
| langchain | 1.5.0 |
| langchain-core | 1.8.0 |
| langgraph | 1.2.22 |
| langgraph-checkpoint | 4.3.2 |
| langgraph-prebuilt | 1.1.2 |
| langgraph-checkpoint-sqlite | 3.1.3 |
| deepagents | 0.7.38 |
| langsmith | 0.14.17 |
| fastmcp | 4.2.0 (resolved by `langchain[mcp]`, which asks for `fastmcp>=4.0.11`) |
| mcp | 2.3.0 |
| langchain-text-splitters | 1.1.3 |
| langchain-openai, langchain-anthropic, langchain-ollama | 1.8.0, 1.7.10, 1.1.0 (only to build models offline in `01`) |
| pydantic | 2.14.3 |
| numpy | 2.5.4 (needed by `DeterministicFakeEmbedding` and `InMemoryVectorStore`) |

`requirements.txt` also pins the transitive packages whose code shows up in the output: `langchain-protocol` (the v3 event shapes), `langgraph-sdk`, `fastmcp-slim`, `mcp-types`, `openai`, `anthropic`, `ollama`, `aiosqlite`, and `uuid-utils`. `00-versions.txt` records what was installed.

## How the output stays deterministic

- The scenarios run one at a time, in a fixed order, in one process. `run.py` runs itself again with `PYTHONHASHSEED=0` and `TZ=UTC`.
- `run.py` removes every `LANGSMITH_*`, `LANGCHAIN_*`, `LANGGRAPH_*`, `OPENAI_*`, `ANTHROPIC_*` and `LC_*` variable, then sets `LANGSMITH_TRACING=false`. Tracing that is on would dump the model, and LangGraph reads `LANGGRAPH_DEFAULT_RECURSION_LIMIT`.
- `run.py` replaces `socket.getaddrinfo`, so every host except `localhost` fails to resolve. A capture that tried to reach a host would end with `network attempts blocked: <host>`. No file has that line.
- The fake model returns a fixed script. Tool call ids such as `call_1` are part of the script.
- Retry middleware runs with `initial_delay=0.0` and `jitter=False`. `RetryPolicy` runs with `initial_interval=0.0` and `jitter=False`.
- The two parallel tool calls in `11`, `15`, `16` and `20` write their results in the same order on every run. `16` sorts its interrupts by `tool_call_id` before it writes them.
- Each file is masked as it is written. The masks are below.

### Masks

Each mask replaces a value that changes on every run. A numbered mask counts up in the order of first appearance in one file, so the same id keeps the same token inside the file. `25-stream-events-v3.txt` and its `.events.json` share one count.

| Pattern | Replaced with | What it is |
|---|---|---|
| UUID (`8-4-4-4-12` hex) | `<uuid-N>` | message ids (`lc_run--<uuid-N>-0` from the model, a bare UUID from `add_messages`), MCP content block ids (`lc_<uuid-N>`), checkpoint ids, run ids, trace ids, task ids inside checkpoint namespaces such as `model:<uuid-N>` |
| 32 hex characters with at least one letter | `<hex-N>` | interrupt ids |
| `<32 digits>.0.<digits>` | `<32 digits>.<random>` | channel versions in a checkpoint. `InMemorySaver` adds a random float to each version |
| ISO 8601 time | `<time>` | `created_at` and `updated_at` of store items, Deep Agents file times. One token for every time, because two stamps can fall in the same microsecond or not |
| `YYYYMMDDTHHMMSS...Z` | `<dotted-time>` | the time part of a LangSmith `dotted_order` |
| a number above 1e9 under the key `timestamp`, `created_at`, `updated_at`, `start_time`, `end_time`, `ts` or `time` | `<epoch-ms>` | v3 stream event times |
| the temporary directory | `<tmp>`, and `<tmp>/m101` for a folder the kit made | the SQLite file, the shell and file-search workspace |
| `.../site-packages/` | `<site-packages>/` | paths in a stack frame |
| `0x` and 6 or more hex digits | `0x<addr>` | object addresses in a `repr` |
| `elapsed: 0.052s` | `elapsed: <seconds>` | the measured time in a `NodeTimeoutError` message |

The kit does not record `ResourceWarning`. `ShellToolMiddleware` leaves two pipes open after the run, and the warning comes when the garbage collector runs, which is not at a fixed point.

## The fake models

`fake.py` holds the two fakes.

`ScriptedChatModel` is a `BaseChatModel`. It is adapted from `GenericFakeChatModel` in the Deep Agents test suite (`libs/deepagents/tests/unit_tests/chat_model.py` at deepagents commit `c858b3641b13fb3f40fe3a12515517b81fb8a744`, MIT license, copyright LangChain, Inc.; the license is in `LICENSE-deepagents`). Its changes from that fake:

- `bind_tools` returns the model itself and records the tool names, `tool_choice`, and the keyword names it got. The log shows what `create_agent` bound on each call.
- A script item can be an `AIMessage`, a string, an exception to raise, or a function of the input messages.
- The log is per instance. In the Deep Agents fake, `call_history` is a class attribute that all instances share.
- `_stream` keeps the Deep Agents behaviour: content splits on `stream_delimiter`, and the tool calls ride on the last chunk, or on one chunk when the content is empty. It also passes `usage_metadata` on the last chunk.
- The script is excluded from pydantic serialization, as in the Deep Agents fake, so a model dump cannot use up the script.

The stock fakes in `langchain_core` do not bind tools, and they drop tool calls under `stream_mode="messages"`. `27-stream-stock-fakes.txt` records both failures.

`ScriptedDecisionModel` is a `BaseDecisionModel` from `langchain_core.decisions`. It answers each question with a function and records the questions. `ModelRouterMiddleware` and `AutoModeMiddleware` use it in `20`.

## Processes and servers

| What | Where | What it shows |
|---|---|---|
| the capture process | in process | everything below |
| FastMCP server `calc` | in process, passed to `MCPAdapter` as a `FastMCP` object, no port | MCP tools, a tool error, a resource |
| SQLite | a file in a temporary folder | `SqliteSaver` across a restart |
| `/bin/sh` | a child process started by `ShellToolMiddleware`, in a temporary folder | the shell tool |
| a LangSmith client | in process, with an HTTP session that answers 200 and records each request | what `tracing_context(enabled="local")` sends |

The kit binds no ports.

## The output files

| File | Shows |
|---|---|
| `00-versions.txt` | Python minor version and the installed version of each pinned package |
| `01-init-chat-model.txt` | `init_chat_model` for OpenAI, Anthropic and Ollama, the model profiles, provider inference, the error for an unknown name, a configurable model, the fake model |
| `02-messages.txt` | message types, dict and tuple coercion, `content_blocks`, multimodal blocks, Anthropic-style reasoning parsed into standard blocks, chunk addition, tool call chunk merging, `trim_messages` |
| `03-tools.txt` | the schema of `@tool`, a `ToolRuntime` parameter hidden from the model, a `ToolRuntime` tool invoked outside an agent, `context` and the custom stream inside an agent |
| `04-tool-errors.txt` | a tool that raises (the run raises), bad arguments (an error `ToolMessage`), `ToolErrorMiddleware`, an unknown tool name |
| `05-agent-graph.txt` | `create_agent` nodes, edges, Mermaid, `recursion_limit` 9999, the default stream mode `updates` |
| `06-agent-run.txt` | one full run and what the model received on each call, with the system prompt |
| `07-structured-output.txt` | `AutoStrategy` choosing `ToolStrategy` or `ProviderStrategy` by profile, `ProviderStrategy`, `ToolStrategy` with a TypedDict, a dataclass, a raw JSON schema, and a union |
| `08-structured-errors.txt` | a validation error and its retry, two structured calls in one message, a custom retry message, `handle_errors=False`, `ProviderStrategy` with bad JSON and with plain text, a normal tool before the structured call |
| `09-middleware-order.txt` | three middlewares with every hook: graph nodes, edges, and the order of hooks for one tool round trip |
| `10-mw-summarization.txt` | `SummarizationMiddleware` with a message trigger, and with no trigger |
| `11-mw-call-limits.txt` | `ModelCallLimitMiddleware` run and thread limits, `ToolCallLimitMiddleware` with `continue`, `end`, and `error` |
| `12-mw-retries.txt` | `ToolRetryMiddleware` and `ModelRetryMiddleware`: success after failures, retries run out, `on_failure="error"`, a `retry_on` filter |
| `13-mw-fallback-refusal.txt` | `ModelFallbackMiddleware`, a chain where every model fails, a refusal block with and without `ModelRefusalMiddleware`, a refusal that falls back |
| `14-mw-pii.txt` | `PIIMiddleware` with `redact`, `mask`, `hash`, `block`, on output, and with a custom regex detector |
| `15-mw-hitl-batched.txt` | `HumanInTheLoopMiddleware` in batched mode: the interrupt, edit and reject, a wrong number of decisions, respond |
| `16-mw-hitl-per-call.txt` | per-call mode: one interrupt per call with its `response_schema`, a resume map by interrupt id, an answer the schema rejects |
| `17-mw-todo-context-editing.txt` | `TodoListMiddleware` and `state["todos"]`, `ContextEditingMiddleware` with `ClearToolUsesEdit` |
| `18-mw-selection-emulation.txt` | `LLMToolSelectorMiddleware`, `LLMToolEmulator`, `ProviderToolSearchMiddleware` (error on the fake, pass-through with nothing deferred), `dynamic_prompt` |
| `19-mw-shell-files.txt` | `FilesystemFileSearchMiddleware` without ripgrep, `ShellToolMiddleware` with `HostExecutionPolicy` |
| `20-mw-decisions.txt` | `ModelRouterMiddleware` (beta) and `AutoModeMiddleware` with a scripted decision model |
| `21-stream-updates-values.txt` | `stream_mode` `updates`, `values`, and the default |
| `22-stream-messages.txt` | `stream_mode="messages"` token chunks with metadata, and `["updates", "messages"]` tuples |
| `23-stream-tasks-custom-debug.txt` | `tasks`, `custom`, and `debug` (first four chunks of each) |
| `24-stream-v2.txt` | `version="v2"` `StreamPart` dicts, `invoke(version="v2")` and `GraphOutput`, the deprecation of `result[key]` |
| `25-stream-events-v3.txt` | `stream_events(version="v3")`: the beta warning, `GraphRunStream` members, the event sequence, the rejected `stream_mode`, sync `stream_events` v2 not implemented |
| `25-stream-events-v3.events.json` | every v3 event frame of that run |
| `26-stream-tools-mode.txt` | the `tools` stream mode, `emit_output_delta`, `tools` with `updates` in v2 |
| `27-stream-stock-fakes.txt` | the stock `GenericFakeChatModel` failing to bind tools, `No generations found in stream`, a tool call lost in `messages` mode, and the kit's fake on the same script |
| `28-checkpoint-memory.txt` | `InMemorySaver` across two turns, `get_state`, a raw checkpoint tuple, thread isolation, `delete_thread`, the missing `thread_id` error |
| `29-checkpoint-sqlite.txt` | `SqliteSaver` across two turns and a reopen of the file, the tables and rows |
| `30-state-history-forks.txt` | `get_state_history`, replay from a checkpoint (the tool runs again), an `update_state` fork, `update_state(as_node="tools")` |
| `31-durability.txt` | `sync`, `async`, `exit` with a checkpointer and the checkpoints each saves; every mode without a checkpointer, and the `sync` crash of issue #9267; `checkpoint_during` deprecated |
| `32-interrupt-resume.txt` | `interrupt()` and `Command(resume=...)`, the node running again from the top, two interrupts in one node, `response_schema`, an interrupt with no checkpointer, a resume of a finished thread |
| `33-store.txt` | `InMemoryStore` put, get, `list_namespaces`, prefix search, a filter, delete, an index with `DeterministicFakeEmbedding`, a tool that reads the store through `ToolRuntime` |
| `34-stategraph-reducers-send-command.txt` | `operator.add` reducers, `Send` fan-out, `Command(goto=...)`, a concurrent write without a reducer, `add_messages`, `MessagesState` |
| `35-functional-api.txt` | `@entrypoint` and `@task` with an interrupt inside a task, resume, `entrypoint.final` with `previous` |
| `36-subgraphs.txt` | a compiled subgraph as a node, `xray` Mermaid, `subgraphs=True` namespaces, an interrupt inside the subgraph, an agent as a subgraph |
| `37-error-handler-timeout.txt` | `RetryPolicy` then a node `error_handler`, `set_node_defaults(error_handler=...)`, a node `timeout`, a timeout caught by a handler |
| `38-recursion-limit.txt` | `recursion_limit=5`, the default limit (10007), an agent loop with `recursion_limit=6`, `RemainingSteps` |
| `39-retrieval.txt` | `RecursiveCharacterTextSplitter`, `DeterministicFakeEmbedding`, `InMemoryVectorStore` search, filter, retriever as a tool, delete, MMR |
| `40-mcp.txt` | `langchain.mcp` beta warning, `MCPAdapter.list_tools()` on an in-process FastMCP server, tool results and artifacts, an MCP tool error, a resource read through `adapter.client`, the bare-string target error |
| `41-deep-agent.txt` | `create_deep_agent` nodes, a run with `write_file`, `ls` and a `task` subagent, `files` in state, the tools bound on each call, both system prompts |
| `42-langsmith.txt` | `traceable` with tracing off, `tracing_context(enabled="local")` run trees through `on_end`, an error run, the requests a local trace sends when it wraps a `create_agent` run, `collect_runs` with `enabled=False`, and `evaluate(upload_results=False)` on a function, an agent, and an agent with tracing off |

## The lab recordings

`capture/lab/` holds raw recordings from runs with a real model or a real database, on the Mac and on an x86 server guest. `labsum.py` computes a summary of each data set into `capture/lab/summary/`, and the charts and the measured numbers of the manual read those summaries. A plain `run.py` writes them, and `run.py --check` computes them again and compares, then prints one `skipped:` line, because recording the runs again needs Ollama and Postgres. `capture/lab/README.md` lists each folder.

## What the kit cannot capture offline

- A real provider call: request bytes, provider usage numbers, provider streaming chunks, and provider tool call streaming. The lab recordings with Ollama cover these.
- `ProviderToolSearchMiddleware` with a real deferral. It needs an Anthropic or OpenAI model, so on the fake it raises `ValueError`.
- `ProviderStrategy` against a provider that enforces the schema. The fake returns the JSON text in its script.
- LangSmith tracing to a server, datasets, experiments that upload, and the prompt hub. The kit only builds run trees in memory, runs `evaluate` with `upload_results=False`, and records what a client would have sent.
- `langchain.mcp` over stdio and HTTP transports, elicitation, and OAuth. The kit uses the in-process transport only.
- `PostgresSaver` and `PostgresStore`. They need a running Postgres.
- Agent Server (`langgraph dev`, `up`, `deploy`).
- Timings of any kind. Nothing in `out/` is a measurement.

## How the kit differs from the reference behaviour

- The fake model is not a provider. It returns its script whatever the prompt says. Its profile is `None` unless a scenario sets one, so `AutoStrategy` picks `ToolStrategy` unless `07` gives it `{"structured_output": True}`.
- `bind_tools` returns the model itself, so a `RunnableBinding` with bound keyword arguments never appears.
- The LangSmith client in `42` uses a recording HTTP session. A real client sends the same requests to `api.smith.langchain.com`.
- The shell tool runs with `PATH=/usr/bin:/bin` and `LC_ALL=C`.
