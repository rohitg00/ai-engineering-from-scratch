# Environment variables

> This page lists the 23 environment variables that the stack or its docs name at the pin, with the file and line that reads each one.

Set each variable before the process starts. `LANGGRAPH_DEFAULT_RECURSION_LIMIT`, the delta setting, and `LANGGRAPH_STRICT_MSGPACK` are read when their module is imported. The LangSmith SDK caches each value after its first read {{code src/langsmith/utils.py:394}}. It reads each name with the prefix `LANGSMITH_` first and then `LANGCHAIN_` {{code src/langsmith/utils.py:377-381}}. The tracing switch is the exception: a `TRACING_V2` variable of either prefix wins over `LANGSMITH_TRACING`. A row that only the documentation backs says so.

## LangGraph

| Variable | Default | What it does | Read at | Section |
|---|---|---|---|---|
| `LANGGRAPH_DEFAULT_RECURSION_LIMIT` | `10007` | the recursion limit of a run with no `recursion_limit` in its config | {{code libs/langgraph/langgraph/_internal/_config.py:42-43}} | [6.8](#s-error-handlers-node-timeouts-and-the-recursion-limit) |
| `LANGGRAPH_DELTA_MAX_SUPERSTEPS_SINCE_SNAPSHOT` | `5000` | the most steps that a `DeltaChannel` goes without a full snapshot | {{code libs/langgraph/langgraph/_internal/_config.py:45-46}} | [5.5](#s-context-engineering-and-summarization) |
| `LANGGRAPH_STRICT_MSGPACK` | `false` | `1`, `true`, or `yes` blocks every msgpack type that is not on the allow list | {{code libs/checkpoint/langgraph/checkpoint/serde/_msgpack.py:12-16}} | [5.6](#s-serialization-of-state-and-what-does-not-round-trip), [8.4](#s-security-deserialization-store-isolation-approvals-and-mcp-subprocesses) |
| `LANGGRAPH_AES_KEY` | none | the key of `EncryptedSerializer`, 16, 24, or 32 bytes. Without it and without a `key` argument, the class raises `ValueError` | {{code libs/checkpoint/langgraph/checkpoint/serde/encrypted.py:54-59}} | [R.4](#s-ref-checkpointer-and-store-api) |

The recursion limit of a `create_agent` graph is 9999, which its own config sets, so the variable does not change it. [Section 6.8](#s-error-handlers-node-timeouts-and-the-recursion-limit) measured the variable: at 25, a plain loop stopped at 25. That it leaves an agent at 9999 comes from the code, not a run.

## LangChain

| Variable | Default | What it does | Read at | Section |
|---|---|---|---|---|
| `LC_OUTPUT_VERSION` | none | the default `output_version` of a chat model, `v0` or `v1` | {{code libs/core/langchain_core/language_models/chat_models.py:396-397}} | [3.3](#s-messages-and-content-blocks) |
| `LANGSMITH_GATEWAY` | none | `true`, or a URL, routes provider integrations such as `ChatOpenAI` and `ChatAnthropic` through the LangSmith model gateway. The `langsmith` provider of `init_chat_model` uses the gateway without it {{code libs/langchain_v1/langchain/chat_models/base.py:24-37}} | {{code libs/core/langchain_core/utils/_gateway.py:35}} {{code libs/core/langchain_core/utils/_gateway.py:95}} | [3.2](#s-init-chat-model-and-model-profiles) |
| `LANGSMITH_GATEWAY_API_KEY` | none | the key for that gateway. Without it, the code reads `LANGSMITH_API_KEY` | {{code libs/core/langchain_core/utils/_gateway.py:36-37}} {{code libs/core/langchain_core/utils/_gateway.py:165}} | [3.2](#s-init-chat-model-and-model-profiles) |

## LangSmith tracing and tests

| Variable | Default | What it does | Read at | Section |
|---|---|---|---|---|
| `LANGSMITH_TRACING_V2`, `LANGCHAIN_TRACING_V2` | none | tracing on, when the value is exactly `true` | {{code src/langsmith/utils.py:138-140}} | [7.6](#s-langsmith-tracing) |
| `LANGSMITH_TRACING`, `LANGCHAIN_TRACING` | none | the same switch, read when neither `TRACING_V2` variable is set | {{code src/langsmith/utils.py:138-140}} | [7.6](#s-langsmith-tracing) |
| `LANGSMITH_API_KEY` | none | the key of the LangSmith client | {{code src/langsmith/utils.py:803-805}} | [7.6](#s-langsmith-tracing) |
| `LANGSMITH_ENDPOINT` | the LangSmith cloud API | where the client sends runs. A server on your own network keeps the runs with you | {{code src/langsmith/utils.py:789-797}} | [7.6](#s-langsmith-tracing) |
| `LANGSMITH_PROJECT` | `default` | the project of traced runs. The server creates it on the first run. The pytest plugin uses it as the experiment prefix only when `LANGSMITH_EXPERIMENT` is unset | {{code src/langsmith/utils.py:420-436}} {{code src/langsmith/testing/_internal.py:428-431}} | [7.6](#s-langsmith-tracing), [7.7](#s-evaluation-with-langsmith) |
| `LANGSMITH_TEST_SUITE` | the repository name and the module of the test | the name of the dataset that the pytest plugin creates | {{code src/langsmith/testing/_internal.py:437-448}} | [7.7](#s-evaluation-with-langsmith) |
| `LANGSMITH_EXPERIMENT` | none | the prefix of each experiment name of the pytest plugin, followed by a colon and 8 random hex characters | {{code src/langsmith/testing/_internal.py:428-432}} | [7.7](#s-evaluation-with-langsmith) |
| `LANGSMITH_TEST_TRACKING` | none, which keeps the record on | `false` runs tests marked for LangSmith without a record. It does not turn off `LANGSMITH_TRACING`, which still sends the runs inside a test. With the record on, each `log_*` call raises unless `LANGSMITH_TRACING` is `true` | {{code src/langsmith/utils.py:143-145}} | [7.7](#s-evaluation-with-langsmith) |
| `LANGSMITH_TEST_CACHE` | none | a folder where the test plugin caches its API calls | {{code src/langsmith/utils.py:513}} | [7.7](#s-evaluation-with-langsmith) |
| `LANGCHAIN_CALLBACKS_BACKGROUND` | none | the docs say that `false` makes callbacks wait. We found no read of it in `langchain-core` 1.8.0 or `langsmith` 0.14.17. `langgraph-cli` lists it as a reserved name for its deploy command, and `langgraph-api` sets it to `true` for its JS worker | docs only, and {{code libs/cli/langgraph_cli/deploy.py:76}} (line 76 in the repo tree, line 71 in the 0.4.43 wheel) {{code langgraph_api/js/remote.py:119}} | [7.6](#s-langsmith-tracing) |

Tracing has three switches that win over these variables. A `tracing_context`, then an active run tree, then a global setting come first {{code src/langsmith/utils.py:119-140}}. [Section 7.6](#s-langsmith-tracing) lists the order.

## Agent Server and its CLI

| Variable | Default | What it does | Read at | Section |
|---|---|---|---|---|
| `N_JOBS_PER_WORKER` | 10 in the docs, 1 under `langgraph dev` | the runs that one queue worker executes at the same time | the docs, and the default of `langgraph dev` {{code langgraph_api/cli.py:273}} | [8.1](#s-agent-server-langgraph-dev-up-and-deploy) |
| `LANGGRAPH_CLOUD_LICENSE_KEY` | none | the license of a server from `langgraph up` for production | capture `T15-agent-server-x86/08-up-start-excerpt.txt` | [8.1](#s-agent-server-langgraph-dev-up-and-deploy) |
| `LANGSMITH_API_KEY` | none | the other way to start `langgraph up`, for local development | capture `T15-agent-server-x86/10-up-license-excerpt.txt` | [8.1](#s-agent-server-langgraph-dev-up-and-deploy) |
| `DISABLE_TRUSTSTORE` | none | `true` stops `langgraph-api` from putting `truststore` into the SSL layer, so the server checks certificates without the trust store of the operating system | {{code langgraph_api/server.py:11-17}} | [8.1](#s-agent-server-langgraph-dev-up-and-deploy) |
| `LANGGRAPH_HOST_API_KEY` | none | the key of `langgraph deploy`, read before `LANGSMITH_API_KEY` and `LANGCHAIN_API_KEY` | {{code libs/cli/langgraph_cli/deploy.py:96-100}} (lines 96 to 100 in the repo tree, 91 to 95 in the 0.4.43 wheel) | [8.1](#s-agent-server-langgraph-dev-up-and-deploy) |

The docs give the server a recursion limit of 10011, and `langgraph-api` 0.18.0 sets that value {{code langgraph_api/utils/config.py:44}}. Our run under `langgraph dev` still stopped at 10007, as [section 8.1](#s-agent-server-langgraph-dev-up-and-deploy) shows. The register records the numbers as D105.

## The capture kit

`capture/run.py` sets a fixed environment before any scenario runs.

| Variable | What the kit does |
|---|---|
| every `LANGSMITH_`, `LANGCHAIN_`, `LANGGRAPH_`, `OPENAI_`, `ANTHROPIC_`, and `LC_` variable, and `OLLAMA_HOST` | removes it |
| `LANGSMITH_TRACING` | sets it to `false` |
| `TZ` | sets it to `UTC` |
| `PYTHONHASHSEED` | runs itself again with `0` |
| `LANGCHAIN101_PYTHON` | reads it as the interpreter with the pinned packages |

The kit removes the `LANGGRAPH_` variables because a recursion limit in the shell would change the captures.

Sources: libs/langgraph/langgraph/_internal/_config.py, libs/checkpoint/langgraph/checkpoint/serde/_msgpack.py, libs/checkpoint/langgraph/checkpoint/serde/encrypted.py, and libs/cli/langgraph_cli/deploy.py at langgraph 1.2.22; libs/core/langchain_core/language_models/chat_models.py and libs/core/langchain_core/utils/_gateway.py at langchain-core 1.8.0; libs/langchain_v1/langchain/chat_models/base.py at langchain==1.5.0; src/langsmith/utils.py and src/langsmith/testing/_internal.py at langsmith 0.14.17; langgraph_api/cli.py, langgraph_api/utils/config.py, langgraph_api/server.py, and langgraph_api/js/remote.py at langgraph-api 0.18.0; capture/run.py, capture/README.md; capture/lab/summary/pytest-plugin-x86.json, capture/lab/summary/langsmith-account-mac.json; capture/lab/T15-agent-server-x86/08-up-start-excerpt.txt, capture/lab/T15-agent-server-x86/10-up-license-excerpt.txt; docs.langchain.com at docs commit 04d4d4a (langsmith/trace-with-langchain, langsmith/agent-server-scale, langsmith/env-var-cloud).
