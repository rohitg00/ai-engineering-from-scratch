# LangChain 101 capture kit

Every listing in LangChain 101 is cut from a file in `out/`. The kit drives LangChain, LangGraph, Deep Agents, `langchain.mcp`, and the LangSmith SDK in one Python process. Where a scenario needs a model, the model is real: `ChatOllama` on `qwen3:4b-instruct-2507-q4_K_M`, and `OllamaEmbeddings` on `nomic-embed-text` for embeddings. No scenario uses a fake or scripted chat model, or a fake embedding.

The scenarios come in two kinds.

- **Model-free captures** call no model: versions, messages, tool schemas, graph structure, durability, interrupts on a plain graph, reducers, the functional API, subgraphs, error handlers, and the recursion limit. They are deterministic, and `--check` runs them again and compares byte for byte.
- **Recorded captures** call a model: the chat model, the embedding model, or both. Each file has a `Recorded on ...` line under its title with the date, the machine, the Ollama version, the models that answered, and the `ChatOllama` settings when a chat model answered. A file where the embedding model answered says `OllamaEmbeddings settings: none beyond the model name.` A model can answer in a different way on a new run, so `--check` does not run them again. It checks the structure that must hold in each stored file instead, and prints one `skipped:` line.

```bash
python3 capture/run.py                # writes every file in capture/out/; needs Ollama
python3 capture/run.py --model-free   # writes only the model-free files; needs no network
python3 capture/run.py --check        # model-free: byte for byte; recorded: structure only, then one skipped: line
python3 capture/run.py --check --live # also records the model scenarios again into a temporary folder and checks their structure
```

Run them from the manual directory. `--check` prints `ok: N model-free files match`, `ok: M recorded files have their model line and expected structure`, and `skipped: running the M recorded scenarios again needs Ollama with qwen3:4b-instruct-2507-q4_K_M and nomic-embed-text; run.py --check --live does it`. On drift it prints a diff or the missing structure, then `drift: ...`, and exits with status 1.

The structure check of a recorded file needs the `Recorded on ...` line, no `SCENARIO FAILED` and no `network attempts blocked`, and every string that `expect.py` lists for that scenario. Those strings are the facts the manual relies on: message types, tool names, error classes, and counts that the model made. They are not the model's wording.

## Install

The kit needs Python 3.13 and the exact versions in `requirements.txt`.

```bash
python3.13 -m venv capture/.venv
capture/.venv/bin/pip install -r capture/requirements.txt
```

When the interpreter that runs `run.py` does not have the pinned packages, `run.py` runs itself again with `capture/.venv/bin/python`, or with the interpreter in `LANGCHAIN101_PYTHON`. When it finds neither, `--check` prints `skipped:` with the reason and exits 0, and a plain run exits 1. `capture/.venv/` is ignored by git.

You can also run the kit one scenario at a time: `python3 capture/run.py mw-hitl stream-v2` writes only the files whose names start with those words, and leaves the rest of `out/` as it is. A plain run never deletes a file in `out/`.

## The model

The recorded captures need Ollama with `qwen3:4b-instruct-2507-q4_K_M` and `nomic-embed-text` pulled. `LC101_OLLAMA_URL` sets the server, and the default is `http://127.0.0.1:11434`. `LC101_MACHINE` sets the machine name that goes into the `Recorded on ...` line.

`common.llm()` builds every chat model of the kit:

| Setting | Value | Why |
|---|---|---|
| `model` | `qwen3:4b-instruct-2507-q4_K_M` | a small instruct model that calls tools, and has no thinking output |
| `temperature` | `0` | the same prompt gives the same reply on one machine, most of the time |
| `seed` | `42` | fixes the sampler where temperature 0 still leaves a choice |
| `num_ctx` | `16384` | the Deep Agents system prompt and its tools need more than the default |
| `num_predict` | `512` | a cap on each reply, so a model that repeats itself stops |

`20-mw-decisions.txt` also builds `qwen3:8b` as the `deep` route of `ModelRouterMiddleware`. It is a choice the router can pick, and in the recording the router picked `fast`, so `qwen3:8b` got no call. No scenario needs reasoning output, so no other scenario builds `qwen3:8b`.

The model is real, so the prompts of the kit ask for the behaviour that a scenario shows, such as two tool calls in one reply or a value given as a word. The model does not always do what the prompt asks, and the file records what it did. Each section of the manual describes the recorded run, not the request.

The failures are real too:

- A tool that fails is a Python function that raises, such as `flaky_disk` and `flaky_fetch`.
- A model that fails is `ChatOllama` pointed at `http://127.0.0.1:9`, where nothing listens, so the connection is refused.
- A model that fails and then works is `ChatOllama` pointed at `FlakyEndpoint` in `common.py`. It is a TCP relay on `127.0.0.1` that closes the first connections it accepts and forwards the rest to Ollama.
- A decision model for `ModelRouterMiddleware` and `AutoModeMiddleware` is `OllamaDecisionModel` in `common.py`. LangChain ships decision models for OpenAI and Google only. The kit's model sends each question and the state to `ChatOllama` in JSON mode and turns the JSON reply into the typed answer.

Every scenario that calls the chat model records what the model received through a callback handler, `common.Recorder`. It lists the messages of each call, cut to 80 characters, and the tools bound to the call.

`common.embeddings()` builds the embedding model of the kit: `OllamaEmbeddings(model="nomic-embed-text")` from `langchain-ollama`, on the same Ollama server, with no other option set. The tag on the x86 server guest is `nomic-embed-text:latest`, id `0a109f422b47`, the same as on the Mac. A vector has 768 numbers. `33-store.txt` uses it as the index of `InMemoryStore`, `39-retrieval.txt` as the embedding of `InMemoryVectorStore`, and `47-retrieval-agent.txt` behind the retriever that Qwen3 4B calls. These three files are recorded files, because an embedding model is a model: the scores and the order of the hits come from it.

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
| langchain-ollama | 1.1.0 (`ChatOllama`, the model of every recorded capture) |
| langchain-openai, langchain-anthropic | 1.8.0, 1.7.10 (only to build models offline in `01`) |
| pydantic | 2.14.3 |
| numpy | 2.5.4 (needed by `InMemoryVectorStore`, which scores with cosine similarity in NumPy) |

`requirements.txt` also pins the transitive packages whose code shows up in the output: `langchain-protocol` (the v3 event shapes), `langgraph-sdk`, `fastmcp-slim`, `mcp-types`, `openai`, `anthropic`, `ollama`, `aiosqlite`, and `uuid-utils`. `00-versions.txt` records what was installed.

## How the output is kept stable

- The scenarios run one at a time, in a fixed order, in one process. `run.py` runs itself again with `PYTHONHASHSEED=0` and `TZ=UTC`.
- `run.py` removes every `LANGSMITH_*`, `LANGCHAIN_*`, `LANGGRAPH_*`, `OPENAI_*`, `ANTHROPIC_*` and `LC_*` variable, then sets `LANGSMITH_TRACING=false`. Tracing that is on would send the runs out, and LangGraph reads `LANGGRAPH_DEFAULT_RECURSION_LIMIT`.
- `run.py` replaces `socket.getaddrinfo`, so every host except `localhost` and `127.0.0.1` fails to resolve. Ollama is on `127.0.0.1`. A capture that tried to reach another host would end with `network attempts blocked: <host>`. No file has that line, and the check fails on it.
- Retry middleware runs with `initial_delay=0.0` and `jitter=False`. `RetryPolicy` runs with `initial_interval=0.0` and `jitter=False`.
- `16` sorts its interrupts by the first argument of each call before it writes them.
- Each file is masked as it is written. The masks are below.

### Masks

Each mask replaces a value that changes on every run. A numbered mask counts up in the order of first appearance in one file, so the same id keeps the same token inside the file. `25-stream-events-v3.txt` and its `.events.json` share one count.

| Pattern | Replaced with | What it is |
|---|---|---|
| UUID (`8-4-4-4-12` hex) | `<uuid-N>` | message ids (`lc_run--<uuid-N>-0` from the model, a bare UUID from `add_messages`), tool call ids from `ChatOllama`, MCP content block ids (`lc_<uuid-N>`), checkpoint ids, run ids, trace ids, task ids inside checkpoint namespaces such as `model:<uuid-N>` |
| 32 hex characters with at least one letter | `<hex-N>` | interrupt ids |
| `<32 digits>.0.<digits>` | `<32 digits>.<random>` | channel versions in a checkpoint. `InMemorySaver` adds a random float to each version |
| ISO 8601 time | `<time>` | `created_at` of an Ollama reply, `created_at` and `updated_at` of store items, Deep Agents file times. One token for every time, because two stamps can fall in the same microsecond or not |
| an integer under a key that ends in `_duration` | `<ns>` | the timings Ollama puts in `response_metadata`, in nanoseconds |
| `YYYYMMDDTHHMMSS...Z` | `<dotted-time>` | the time part of a LangSmith `dotted_order` |
| a number above 1e9 under the key `timestamp`, `created_at`, `updated_at`, `start_time`, `end_time`, `ts` or `time` | `<epoch-ms>` | v3 stream event times |
| the temporary directory | `<tmp>`, and `<tmp>/m101` for a folder the kit made | the SQLite file, the shell and file-search workspace |
| `.../site-packages/` | `<site-packages>/` | paths in a stack frame |
| `0x` and 6 or more hex digits | `0x<addr>` | object addresses in a `repr` |
| `elapsed: 0.052s` | `elapsed: <seconds>` | the measured time in a `NodeTimeoutError` message |
| `/home/<name>` or `/Users/<name>` | `<home>` | the home folder of the machine that recorded |
| `127.0.0.1:<port>` other than `11434` and `9` | `127.0.0.1:<port>` | the random port of `FlakyEndpoint` |

The kit does not record `ResourceWarning`. `ShellToolMiddleware` leaves two pipes open after the run, and the warning comes when the garbage collector runs, which is not at a fixed point.

## Processes and servers

| What | Where | What it shows |
|---|---|---|
| the capture process | in process | everything below |
| Ollama | `127.0.0.1:11434`, on the machine that records | every model call |
| `FlakyEndpoint` | in process, a TCP relay on a random port of `127.0.0.1` | a model call that fails twice and then works, in `12` |
| FastMCP server `calc` | in process, passed to `MCPAdapter` as a `FastMCP` object, no port | MCP tools, a tool error, a resource |
| SQLite | a file in a temporary folder | `SqliteSaver` across a restart |
| `/bin/sh` | a child process started by `ShellToolMiddleware`, in a temporary folder | the shell tool |
| a LangSmith client | in process, with an HTTP session that answers 200 and records each request | what `tracing_context(enabled="local")` sends |

The kit binds one port, the port of `FlakyEndpoint`, and only while `12` runs.

## The output files

| File | Shows |
|---|---|
| `00-versions.txt` | Python minor version and the installed version of each pinned package |
| `01-init-chat-model.txt` | `init_chat_model` for OpenAI, Anthropic and Ollama, the model profiles, provider inference, the error for an unknown name, a configurable model, the settings of the kit's `ChatOllama` |
| `02-messages.txt` | message types, dict and tuple coercion, `content_blocks`, multimodal blocks, Anthropic-style reasoning parsed into standard blocks, chunk addition, tool call chunk merging, `trim_messages` |
| `03-tools.txt` | the schema of `@tool`, a `ToolRuntime` parameter hidden from the model, a `ToolRuntime` tool invoked outside an agent |
| `04-tool-errors.txt` | a tool that raises (the run raises), a request for bad arguments that the model fixed itself, a value outside the schema that the model refused, `ToolErrorMiddleware`, a prompt that names a missing tool, and a tool removed between two deploys (an error `ToolMessage`) |
| `05-agent-graph.txt` | `create_agent` nodes, edges, Mermaid, `recursion_limit` 9999, the default stream mode `updates` |
| `06-agent-run.txt` | one full run and what the model received on each call, with the system prompt |
| `07-structured-output.txt` | `AutoStrategy` choosing `ToolStrategy` or `ProviderStrategy` by profile, `ProviderStrategy` as an Ollama JSON schema format, `ToolStrategy` with a TypedDict and a dataclass (Ollama refused the third request with a 400), a raw JSON schema, a union, `ToolStrategy` and `ProviderStrategy` with the `add` tool bound |
| `08-structured-errors.txt` | prompts that ask for an invalid value (the model sent valid ones), two structured calls in one message and the retry, a custom retry message, `handle_errors=False`, `ProviderStrategy` with prompts for a word, a decimal, and plain text, a normal tool before the structured call |
| `09-middleware-order.txt` | three middlewares with every hook: graph nodes, edges, and the order of hooks for one tool round trip |
| `10-mw-summarization.txt` | `SummarizationMiddleware` with a message trigger, and with no trigger |
| `11-mw-call-limits.txt` | `ModelCallLimitMiddleware` run and thread limits, `ToolCallLimitMiddleware` with `continue`, `end`, and `error` |
| `12-mw-retries.txt` | `ToolRetryMiddleware` and `ModelRetryMiddleware`: success after failures (through `FlakyEndpoint` for the model), retries run out, `on_failure="error"`, a `retry_on` filter |
| `13-mw-fallback-refusal.txt` | `ModelFallbackMiddleware` with a primary on a dead port, a chain where every model fails, a refusal in text with and without `ModelRefusalMiddleware`, and with a fallback before it |
| `14-mw-pii.txt` | `PIIMiddleware` with `redact`, `mask`, `hash`, `block`, on output, and with a custom regex detector |
| `15-mw-hitl-batched.txt` | `HumanInTheLoopMiddleware` in batched mode: the interrupt, edit and reject, a wrong number of decisions, respond |
| `16-mw-hitl-per-call.txt` | per-call mode: one interrupt per call with its `response_schema`, a resume map by interrupt id, an answer the schema rejects |
| `17-mw-todo-context-editing.txt` | `TodoListMiddleware` and `state["todos"]`, `ContextEditingMiddleware` with `ClearToolUsesEdit` |
| `18-mw-selection-emulation.txt` | `LLMToolSelectorMiddleware`, `LLMToolEmulator`, `ProviderToolSearchMiddleware` (error on `ChatOllama`, pass-through with nothing deferred), `dynamic_prompt` |
| `19-mw-shell-files.txt` | `FilesystemFileSearchMiddleware` without ripgrep, `ShellToolMiddleware` with `HostExecutionPolicy` in two runs; the model sent every shell command and every `include` as an object, so those calls failed validation |
| `20-mw-decisions.txt` | `ModelRouterMiddleware` (beta) and `AutoModeMiddleware` with `OllamaDecisionModel`, the answer of the decision model for each call |
| `21-stream-updates-values.txt` | `stream_mode` `updates`, `values`, and the default |
| `22-stream-messages.txt` | `stream_mode="messages"` token chunks with metadata, and `["updates", "messages"]` tuples |
| `23-stream-tasks-custom-debug.txt` | `tasks`, `custom`, and `debug` (first four chunks of each) |
| `24-stream-v2.txt` | `version="v2"` `StreamPart` dicts, `invoke(version="v2")` and `GraphOutput`, the deprecation of `result[key]` |
| `25-stream-events-v3.txt` | `stream_events(version="v3")`: the beta warning, `GraphRunStream` members, the event sequence, the rejected `stream_mode`, sync `stream_events` v2 not implemented |
| `25-stream-events-v3.events.json` | every v3 event frame of that run |
| `26-stream-tools-mode.txt` | the `tools` stream mode, `emit_output_delta`, `tools` with `updates` in v2 |
| `27-stream-tool-call-chunks.txt` | how `ChatOllama` streams a tool call in `messages` mode, alone and after text |
| `28-checkpoint-memory.txt` | `InMemorySaver` across two turns, `get_state`, a raw checkpoint tuple, thread isolation, `delete_thread`, the missing `thread_id` error |
| `29-checkpoint-sqlite.txt` | `SqliteSaver` across two turns and a reopen of the file, the tables and rows |
| `30-state-history-forks.txt` | `get_state_history`, replay from a checkpoint (the tool runs again), an `update_state` fork, `update_state(as_node="tools")` |
| `31-durability.txt` | `sync`, `async`, `exit` with a checkpointer and the checkpoints each saves; every mode without a checkpointer, and the `sync` crash of issue #9267; `checkpoint_during` deprecated |
| `32-interrupt-resume.txt` | `interrupt()` and `Command(resume=...)`, the node running again from the top, two interrupts in one node, `response_schema`, an interrupt with no checkpointer, a resume of a finished thread |
| `33-store.txt` | `InMemoryStore` put, get, `list_namespaces`, prefix search, a filter, delete, an index with `nomic-embed-text` and two queries |
| `34-stategraph-reducers-send-command.txt` | `operator.add` reducers, `Send` fan-out, `Command(goto=...)`, a concurrent write without a reducer, `add_messages`, `MessagesState` |
| `35-functional-api.txt` | `@entrypoint` and `@task` with an interrupt inside a task, resume, `entrypoint.final` with `previous` |
| `36-subgraphs.txt` | a compiled subgraph as a node, `xray` Mermaid, `subgraphs=True` namespaces, an interrupt inside the subgraph |
| `37-error-handler-timeout.txt` | `RetryPolicy` then a node `error_handler`, `set_node_defaults(error_handler=...)`, a node `timeout`, a timeout caught by a handler |
| `38-recursion-limit.txt` | `recursion_limit=5`, the default limit (10007), `RemainingSteps` |
| `39-retrieval.txt` | `RecursiveCharacterTextSplitter`, `OllamaEmbeddings` with `nomic-embed-text`, `InMemoryVectorStore` search for three queries, filter, delete, MMR |
| `40-mcp.txt` | `langchain.mcp` beta warning, `MCPAdapter.list_tools()` on an in-process FastMCP server, tool results and artifacts, an MCP tool error, a resource read through `adapter.client`, the bare-string target error |
| `41-deep-agent.txt` | `create_deep_agent` nodes, a run with `add`, `write_file`, `ls` and a `task` subagent, `files` in state, the tools bound on each call, both system prompts |
| `42-langsmith.txt` | `traceable` with tracing off, `tracing_context(enabled="local")` run trees through `on_end`, an error run, the requests a local trace sends when it wraps a `create_agent` run, `collect_runs` with `enabled=False`, and `evaluate(upload_results=False)` on a function, an agent, and an agent with tracing off |
| `43-tool-runtime-agent.txt` | `context` and the custom stream of a `ToolRuntime` tool inside an agent |
| `44-store-agent.txt` | a tool that reads the store through `ToolRuntime`, for two users |
| `45-subgraph-agent.txt` | an agent as a subgraph node, with its namespaces |
| `46-recursion-agent.txt` | a model told to call a tool forever, with `recursion_limit=6` |
| `47-retrieval-agent.txt` | a retriever on `nomic-embed-text` wrapped as a tool, called by the model |
| `48-draw-agent.txt` | `get_graph()` of the `create_agent` graph with its node data and metadata, `draw_mermaid()`, `draw_ascii()` (ImportError: no `grandalf` at the pin), and the defaults of `draw_mermaid_png()`, which is not called |
| `49-draw-middleware.txt` | nodes, edges, Mermaid, and `draw_ascii()` of the agent with `middleware=[A, B, C]` |
| `50-draw-fanout.txt` | the same for the joke graph of `Send` and `Command` |
| `51-draw-functional.txt` | the same for an `@entrypoint` |
| `52-draw-subgraph.txt` | the same for the parent graph of `36`, with `get_graph()` and `get_graph(xray=True)` |
| `53-draw-deep-agent.txt` | the same for `create_deep_agent`, and its nodes with `xray=True` |
| `54-draw-service-agent.txt` | the same for `build_agent` of the production service in `lab/prodapp-mac/code`, with a stand-in for its OpenTelemetry module |

Files `00` to `03`, `05`, `31`, `32`, `34` to `38`, and `48` to `54` are model-free. The others are recorded. `33` and `39` call only the embedding model. `43` to `47` hold the model part of a scenario whose other part stayed model-free, so they come after the main list. `48` to `54` build each graph of the manual and write its Mermaid text, and they come last. They build models but call none, and they never call `draw_mermaid_png()`, which reaches the network.

## The lab recordings

`capture/lab/` holds raw recordings from runs with a real model or a real database, on the Mac and on an x86 server guest. `labsum.py` computes a summary of each data set into `capture/lab/summary/`, and the charts and the measured numbers of the manual read those summaries. A plain `run.py` writes them, and `run.py --check` computes them again and compares, then prints one `skipped:` line, because recording the runs again needs Ollama and Postgres. `capture/lab/README.md` lists each folder. The folders `chat-ui-mac/`, `T22-sec-fs-permissions-mac/`, and `T23-sec-store-namespace-mac/` hold the runs of Agent Chat UI and of the Deep Agents file rules and store namespaces.

## What the kit does not capture

- A provider other than Ollama: request bytes and streaming chunks of OpenAI or Anthropic. The lab recordings cover some of them.
- `ProviderToolSearchMiddleware` with a real deferral. It needs an Anthropic or OpenAI model, so on `ChatOllama` it raises `ValueError`.
- `ModelRefusalMiddleware` raising. It acts on a `refusal` content block, and Ollama never sends one. Qwen3 4B refused in plain text, which passes through.
- A validation error from a real model. Asked for a decimal in an integer field, a word for a number, or a value outside a range, Qwen3 4B sent valid arguments or refused in text. The bad arguments in the kit come from the shell tool in `19`.
- LangSmith tracing to a server, datasets, experiments that upload, and the prompt hub. The kit sends traces to a client with a recording HTTP session, runs `evaluate` with `upload_results=False`, and records what a client would have sent.
- `langchain.mcp` over stdio and HTTP transports, elicitation, and OAuth. The kit uses the in-process transport only.
- `PostgresSaver` and `PostgresStore`. They need a running Postgres.
- Agent Server (`langgraph dev`, `up`, `deploy`).
- Timings of any kind. The kit masks the timings of each reply, and nothing in `out/` is a measurement.

## How the kit differs from the reference behaviour

- The model is a 4B model on CPU. A larger model, or a hosted one, makes other choices: it may call a tool that Qwen3 4B skipped, or skip one it called.
- Two recordings of one scenario can differ, even at temperature 0 with a seed. In one recording of `20`, the decision model also blocked `add`. The file in `out/` is one run, and the structure check holds for each run.
- `ChatOllama.bind_tools` drops `tool_choice`, so the `tool_choice="any"` of `ToolStrategy` has no effect on Ollama.
- The LangSmith client in `42` uses a recording HTTP session. A real client sends the same requests to `api.smith.langchain.com`.
- The shell tool runs with `PATH=/usr/bin:/bin` and `LC_ALL=C`.
- `ChatOllama` puts each tool call whole, with its id, on one chunk, and then sends an empty chunk with `chunk_position="last"`. So the v3 run in `25` has one `tool-call-delta` for the call. The v3 bridge drops a piece of a tool call that rides on a chunk marked last (lab T08, section 3.4). No recorded run lost one: the tool of `25` ran with `{"a": 2, "b": 3}`.
