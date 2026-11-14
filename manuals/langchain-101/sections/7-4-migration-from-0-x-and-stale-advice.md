# Migration from 0.x, and stale advice

> Most 0.x code moved to `langchain-classic` or changed its name, and old advice survives in tutorials, course notebooks, and some docs pages, so check each import against the pin.

You open a project from 2024. It imports `AgentExecutor` from `langchain.agents`, a loader from `langchain_community`, and `MultiServerMCPClient` from `langchain_mcp_adapters`. On `langchain` 1.5.0 the first import fails, the second warns that its package is sunset, and the third conflicts with `langchain[mcp]`.

When you finish this section, you can move 0.x code to the 1.x names, and tell a stale page or notebook from a current one.

## The support window

LangChain 0.3 is in maintenance until December 2026, according to the release policy {{docs oss/python/release-policy}}. The line still gets releases: `langchain` 0.3.30 and `langchain-core` 0.3.86 came on 2026-05-07, with the hardening of `loads` and `dumps` {{code langchain==0.3.30}}. So 0.3 code runs today, and its security fixes stop after 2026.

The same policy says that a minor upgrade inside 1.x breaks nothing. Two minor releases changed what an upgrader must do. `langchain` 1.5.0 raised the Python floor to 3.11, as [section 2.1](#s-install-and-the-package-map) shows. `langchain-core` 1.7.0 changed streamed tool call arguments from snapshots to slices {{code langchain-core==1.7.0}}. Pin the versions in a lockfile, and read the changelog of each minor before you raise it.

| Package line | Lowest Python |
|---|---|
| 0.3 | 3.9 |
| `langchain` 1.0 to 1.4, `langchain-core` 1.0 to 1.7 | 3.10 |
| `langchain` 1.5.0, `langchain-core` 1.8.0, and the provider packages at the pin | 3.11 |
| `langgraph` 1.2.22, its checkpointers, and `langsmith` 0.14.17 | 3.10 |

## Imports that moved

| 0.x import | At the pin | Section |
|---|---|---|
| `from langchain.chains import LLMChain` | `langchain_classic.chains`, deprecated since 0.1.17 with removal in 2.0.0 {{code libs/langchain/langchain_classic/chains/llm.py}} | [2.1](#s-install-and-the-package-map) |
| `from langchain.agents import AgentExecutor, initialize_agent` | `langchain_classic.agents`, and `initialize_agent` is deprecated. New agents use `langchain.agents.create_agent` | [3.1](#s-create-agent-and-the-graph-it-builds) |
| `from langchain import hub` | `langchain_classic.hub`, and its push and pull are deprecated for the LangSmith SDK {{code libs/langchain/langchain_classic/hub.py}} | [2.5](#s-the-system-prompt) |
| `langchain.retrievers.MultiQueryRetriever`, `RetrievalQA` | `langchain-classic`. `BaseRetriever` stays in `langchain_core.retrievers` | [6.1](#s-embeddings-splitters-vector-stores-and-retrievers) |
| `langchain_community.*` | sunset at 0.4.2, with an archived repository. Use the provider package where one exists | [2.1](#s-install-and-the-package-map) |
| `from langchain_mcp_adapters.client import MultiServerMCPClient` | `langchain.mcp.MCPAdapter`, in beta, installed with `langchain[mcp]` | [6.2](#s-mcp-with-langchain-mcp) |
| `from langgraph.prebuilt import create_react_agent` | `langchain.agents.create_agent`. The old function still imports and warns | [3.1](#s-create-agent-and-the-graph-it-builds) |
| `from langgraph.checkpoint.memory import MemorySaver` | `InMemorySaver`. `MemorySaver` remains as an alias {{code libs/checkpoint/langgraph/checkpoint/memory/__init__.py}} | [4.2](#s-checkpointers-and-threads) |
| `from langgraph.errors import NodeInterrupt` | `langgraph.types.interrupt`, and resume with `Command(resume=...)` | [5.4](#s-interrupt-and-resume) |
| `from langgraph.constants import Send` | `from langgraph.types import Send` | [5.2](#s-edges-send-and-command) |

The repository of the LangSmith SDK also moved, to `langchain-ai/langsmith-python`. The package name `langsmith` did not change.

## create_react_agent to create_agent

The migration guide of the v1 release lists each argument that changed {{docs oss/python/migrate/langchain-v1}}. We checked each row against the code at the pin.

| `create_react_agent` | `create_agent` |
|---|---|
| `prompt=` | `system_prompt=`, a string or a `SystemMessage` |
| a callable `prompt` | the `@dynamic_prompt` middleware |
| `pre_model_hook`, `post_model_hook` | `before_model` and `after_model` middleware |
| a Pydantic or dataclass state | a `TypedDict` that extends `AgentState`, through `state_schema` |
| a model chosen by a callable | `wrap_model_call` middleware with `request.override(model=...)` |
| a model with `bind_tools` already called | not accepted. Pass the plain model and the tools |
| `ToolNode(handle_tool_errors=...)` | `ToolErrorMiddleware(on_error)`, or `wrap_tool_call` middleware |
| `response_format` in an extra final node | structured output in the main loop, with `ToolStrategy`, `ProviderStrategy`, or `AutoStrategy` |
| the node name `agent` in a stream | `model` |
| static data in `config["configurable"]` | `context=` on `invoke`, typed by `context_schema` |
| the recursion limit of LangGraph | 9999 steps, set by `create_agent` {{code libs/langchain_v1/langchain/agents/factory.py}} |

[Section 3.1](#s-create-agent-and-the-graph-it-builds) shows the graph that `create_agent` builds, and [section 3.3](#s-middleware-hooks-and-their-order) shows the hooks that replace the old ones.

## LangGraph names that changed

Two deprecations show up in the kit as warnings. The first comes from a graph run with the old argument `checkpoint_during`:

```listing
title: checkpoint_during at the pin
source: capture/out/31-durability.txt
lang: text
---
warning LangGraphDeprecatedSinceV10: `checkpoint_during` is deprecated and will be removed. Please use `durability` instead. Deprecated in LangGraph V1.0 to be removed in V2.0.
```

The second comes from reading the output of `invoke(version="v2")` as a dict:

```listing
title: a dict read of GraphOutput
source: capture/out/24-stream-v2.txt
lang: text
---
warning LangGraphDeprecatedSinceV11: Accessing GraphOutput via `result[key]` is deprecated. Use `result.value` to access the output value directly, or `result.interrupts` for interrupts. Deprecated in LangGraph V1.1 to be removed in V3.0.
```

Three more changes have no warning, and old code reads them wrong:

- **The recursion limit.** Old advice names 25. At the pin, a `StateGraph` stops at 10007 steps and `create_agent` at 9999. [Section 5.8](#s-error-handlers-node-timeouts-and-the-recursion-limit) gives both.
- **`Interrupt`.** The fields `ns`, `when`, and `resumable` are gone, and `interrupt_id` gave way to `id` in 0.6.0 {{code libs/langgraph/langgraph/types.py}}.
- **Deep Agents 0.7.0.** `create_deep_agent` no longer adds `TodoListMiddleware`, so `write_todos` is not a default tool. [Section 6.3](#s-deep-agents-0-7) shows the default tool set.

## Stale pages in the docs

The docs site serves its main branch, so most pages describe the pin or a newer state. We searched the 184 pages we read for old names, such as `AgentExecutor`, `initialize_agent`, `create_react_agent`, `MultiServerMCPClient`, and `LangGraph Platform`. The first two and the old platform names had no hit. The others appeared only on migration and release pages, which is where they belong.

These pages still teach an older state at docs commit `04d4d4a`. Each one has an entry in the conflict register of this manual.

| Page | What is out of date | Conflict |
|---|---|---|
| `oss/python/langchain/install` and `oss/python/release-policy` | Python 3.10 as the floor | D101 |
| `oss/python/releases/langchain-v1` | the list of providers with content blocks, and the namespace table without `langchain.mcp` | D117 |
| both v1 release pages | a link for `create_react_agent` that goes to the function of the same name in `langchain-classic` | D107 |
| `langsmith/faq` | a table that calls checkpointers community code and streaming basic | D108 |
| `langsmith/manage-prompts-programmatically` | the hub through `langchain_classic` and a prompt piped into a model | D113 |
| `langsmith/trace-with-langchain` | an LCEL chain as the first example | D114 |
| `oss/python/deepagents/overview` | planning named as a default in its first paragraph | D109 |
| `oss/python/langgraph/local-server` | the old name LangGraph Studio | D116 |

## Stale code in LangChain Academy

LangChain Academy teaches the stack in courses with notebooks in public repositories {{academy}}. Most of the code is current. These old APIs still appear in the repositories we read on 2026-11-14:

| Old API | Where it still appears | Current replacement |
|---|---|---|
| `from langgraph.errors import NodeInterrupt` | `langchain-academy`, module 3, the dynamic breakpoints lesson | `interrupt()` from `langgraph.types`, then `Command(resume=...)` |
| `from langgraph.constants import Send` | `langchain-academy`, module 4, the studio files for map reduce and the research assistant | `from langgraph.types import Send` |
| `from langgraph.prebuilt import create_react_agent`, with `prompt=` | `ambient-agent-101`, the ambient agent notebook | `create_agent` from `langchain.agents`, with `system_prompt=` |
| `write_todos` as a default tool of a deep agent | `langgraph-101`, the deep agents notebooks, locked to `deepagents` 0.5.3 | `create_deep_agent(..., middleware=[TodoListMiddleware()])` |
| `MultiServerMCPClient` from `langchain_mcp_adapters` | the MCP lessons of `lca-lc-foundations`, `lca-langchainV1-essentials`, and `lca-deepagents` | `MCPAdapter` from `langchain.mcp` |
| `WikipediaLoader` from `langchain_community` | `langchain-academy`, module 4, parallelization and the research assistant | the same import works with a sunset warning. Prefer a maintained package |
| `from langchain_community.chat_models import ChatOllama`, as text in sample logs | `langchain-academy`, module 4, the subgraph notebook | `from langchain_ollama import ChatOllama`, or `init_chat_model("ollama:<model>")` |
| `langchain>=0.3.9`, `langgraph>=0.4.2` as floors | `ambient-agent-101`, its `pyproject.toml` | floors on the 1.x lines, from a lockfile |
| `deepagents==0.5.9`, and `deepagents>=0.6,<0.7` | `lca-deployment` and `lca-engine` | the pin of this manual, 0.7.38, with the tests run again |

The import of `ChatOllama` from `langchain_community.chat_models` fails at the pin with `ImportError`. Each of the other rows still runs, and most of them warn. Static `interrupt_before` on `compile` is not stale: the course uses it for breakpoints, and it is still supported. Teach `interrupt()` first, and keep `interrupt_before` for debugging.

```takeaways
- Pin every package in a lockfile before you move 0.x code.
- Import legacy chains from langchain_classic only while you replace them with create_agent.
- Rename prompt to system_prompt, and move hooks into middleware.
- Run with warnings shown, and fix each LangGraphDeprecatedSinceV10 and V11 warning.
- Check the version a notebook was locked to before you copy its code.
- Read the changelog of each minor release before you raise it.
```

Sources: capture/out/31-durability.txt, capture/out/24-stream-v2.txt; libs/langchain/langchain_classic/chains/llm.py, libs/langchain/langchain_classic/hub.py, libs/langchain/langchain_classic/agents/initialize.py, and libs/langchain_v1/langchain/agents/factory.py at langchain==1.5.0; libs/langgraph/langgraph/types.py, libs/langgraph/langgraph/errors.py, libs/prebuilt/langgraph/prebuilt/chat_agent_executor.py, and libs/checkpoint/langgraph/checkpoint/memory/__init__.py at langgraph 1.2.22; the GitHub releases langchain==0.3.30, langchain-core==1.7.0, langchain==1.5.0, and deepagents==0.7.0; docs.langchain.com at docs commit 04d4d4a (oss/python/migrate/langchain-v1, oss/python/migrate/langgraph-v1, oss/python/release-policy, oss/python/releases/changelog, and the pages in the stale table); LangChain Academy repositories langchain-academy, ambient-agent-101, langgraph-101, lca-lc-foundations, lca-langchainV1-essentials, lca-deepagents, lca-deployment, and lca-engine, read 2026-11-14.
