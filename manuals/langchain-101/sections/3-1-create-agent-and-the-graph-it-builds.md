# create_agent and the graph it builds

> `create_agent` compiles a LangGraph graph with a `model` node, a `tools` node when tools exist, and one node for each middleware hook, with a recursion limit of 9999.

You pass a model, two tools, and a prompt to `create_agent`, and you get back an object with `invoke` and `stream`. It looks like a chat helper. It is a compiled LangGraph graph, and every error, stream chunk, and checkpoint of the agent names one of its nodes.

When you finish this section, you can say which node each argument of `create_agent` adds, and when the loop between them stops. You can also read the defaults on the compiled graph and say what the agent layer costs.

## What create_agent takes

**create_agent:** the function in `langchain.agents` that turns a model, tools, a prompt, and middleware into a `CompiledStateGraph`.

The signature at the pin has two positional parameters and thirteen keyword parameters {{code libs/langchain_v1/langchain/agents/factory.py}}. This table lists what each one changes in the graph:

| Parameter | Default | What it changes |
|---|---|---|
| `model` | required | A string goes through `init_chat_model`. The model is called from the `model` node. |
| `tools` | `None` | Functions and `BaseTool` objects run in the `tools` node. A `dict` is a provider tool, which is bound to the model and never run by the graph. |
| `system_prompt` | `None` | A string becomes a `SystemMessage`. It goes in front of the messages on each model call and stays out of the state. |
| `middleware` | `()` | Each hook of each middleware becomes a node or a wrapper. Middleware can also add tools and state keys. |
| `response_format` | `None` | A schema adds a structured output tool or a provider format. [Section 3.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) explains both. |
| `state_schema`, `context_schema` | `None` | The state type and the type of `context` for each run. |
| `checkpointer`, `store` | `None` | Saved state per thread, and long-term memory. Part 4 covers both. |
| `interrupt_before`, `interrupt_after` | `None` | Static pauses before or after named nodes. |
| `name`, `debug`, `cache`, `transformers` | `None`, `False`, `None`, `None` | A graph name, debug output, a node cache, and stream transformers. |

[Section 2.2](#s-init-chat-model-and-model-profiles) shows how a model string resolves. [Section 2.5](#s-the-system-prompt) shows why the prompt stays out of the state.

## The nodes

The kit builds the agent of [section 1.2](#s-one-create-agent-run) with one tool and no middleware. The compiled graph has four nodes:

```listing
title: the nodes of an agent with one tool
source: capture/out/05-agent-graph.txt
lang: json
---
[
  "__start__",
  "model",
  "tools",
  "__end__"
]
```

The `tools` node exists only when the agent has a tool to run, or a middleware with a `wrap_tool_call` hook {{code libs/langchain_v1/langchain/agents/factory.py}}. With no tools, the same call builds three nodes:

```listing
title: the nodes of an agent with no tools
source: capture/out/05-agent-graph.txt
lang: json
---
[
  "__start__",
  "model",
  "__end__"
]
```

Middleware adds nodes. Each `before_agent`, `before_model`, `after_model`, and `after_agent` hook becomes a node named after the middleware and the hook. The kit adds three middlewares named `A`, `B`, and `C`, each with every hook:

```listing
title: the nodes with three middlewares
source: capture/out/09-middleware-order.txt
lang: json
note: The B and C nodes are cut. They follow the same pattern.
---
[
  "__start__",
  "model",
  "tools",
  "A.before_agent",
  "A.before_model",
  "A.after_model",
  "A.after_agent",
…
  "__end__"
]
```

The `wrap_model_call` and `wrap_tool_call` hooks add no node. They run inside the `model` node and the `tools` node. [Section 3.3](#s-middleware-hooks-and-their-order) gives the order of all six hooks. [Figure](#fig-3-1) maps each argument to the part of the graph it builds.

```figure
id: fig-3-1
kind: structure
title: what each argument of create_agent builds
claim: Tools build the tools node, middleware builds hook nodes and wrappers, and the prompt and response format change each model call without a node of their own.
caption: Read the three graphs from the top. Each one adds one argument to create_agent. A solid edge has one next node, and a dashed amber edge chooses the next node at run time. From capture/out/05-agent-graph.txt and capture/out/09-middleware-order.txt.
```

## The state

**AgentState:** the state type of every agent, with the keys `messages`, `jump_to`, and `structured_response`.

`messages` uses the `add_messages` reducer, so each node appends or replaces messages by id. `jump_to` is private and lasts for one step. A middleware sets it to move the run to `model`, `tools`, or the end. `structured_response` is in the output and never in the input {{code libs/langchain_v1/langchain/agents/middleware/types.py}}. Middleware can add keys of its own, and the `state_schema` you pass wins a conflict.

## The loop and when it stops

The edges after `model` are conditional:

```listing
title: the edges of the agent graph
source: capture/out/05-agent-graph.txt
lang: json
---
[
  "__start__ -> model",
  "model -> __end__ (conditional)",
  "model -> tools (conditional)",
  "tools -> model (conditional)"
]
```

The edge function reads the state after each model call, in this order {{code libs/langchain_v1/langchain/agents/factory.py:1991-2042}}:

1. A `jump_to` value set by a middleware wins.
2. No AI message in the state ends the run.
3. An AI message with no tool calls ends the run.
4. Tool calls that have no result yet go to `tools`, each as its own `Send`, so parallel calls run as parallel tasks.
5. A new `structured_response` ends the run.
6. Otherwise the run goes back to `model`.

A structured output tool call is not sent to `tools`. The `model` node handles it, as [section 3.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) shows. An agent with no tools and a `ToolStrategy` or `AutoStrategy` has a `model` to `model` edge in place of the `tools` node. That edge checks `jump_to`, then a new `structured_response`, and otherwise loops {{code libs/langchain_v1/langchain/agents/factory.py:2045-2068}}. With no tools and a `ProviderStrategy`, the `model` node goes straight to the end {{code libs/langchain_v1/langchain/agents/factory.py:1790-1803}}.

## Parallel tool calls and max_concurrency

**max_concurrency:** the key of the run config that caps how many tasks of one step run at the same time.

**We measured** parallel tool calls on the Mac, an Apple M1 Max with 10 cores and 64 GiB. A fake model asked for 1 to 16 calls of one tool that sleeps 200 ms, sync or async. We ran `create_agent`, and a plain `StateGraph` with one `ToolNode`, under `invoke` and `ainvoke`. `max_concurrency` was unset, 1, 2, 4, or 8. Each of the 200 cells ran 5 times, with a load average of 3.6 to 5.2.

| Harness and call | 16 calls, cap 1 | 16 calls, cap 8 | 16 calls, no cap |
|---|---|---|---|
| `create_agent`, `invoke`, sync tool | 3,382.0 ms, 1 at a time | 432.9 ms, 8 at a time | 426.6 ms, 14 at a time |
| `create_agent`, `ainvoke`, async tool | 3,277.5 ms, 1 at a time | 423.5 ms, 8 at a time | 214.9 ms, 16 at a time |
| `create_agent`, `ainvoke`, sync tool | 3,393.0 ms, 1 at a time | 444.0 ms, 8 at a time | 431.5 ms, 14 at a time |
| `ToolNode`, `invoke`, sync tool | 3,350.1 ms, 1 at a time | 422.3 ms, 8 at a time | 419.3 ms, 14 at a time |
| `ToolNode`, `ainvoke`, async tool | 207.3 ms, 16 at a time | 208.1 ms, 16 at a time | 208.0 ms, 16 at a time |
| `ToolNode`, `ainvoke`, sync tool | 421.2 ms, 14 at a time | 428.2 ms, 14 at a time | 420.2 ms, 14 at a time |

Each cell gives the median wall time and the largest number of calls that ran at one time. Every successful run executed each call once and wrote one `ToolMessage` for it.

`create_agent` applied the cap in every mode, because each call is its own `Send` task. With no cap, sync tools ran in a thread pool of 14 on this machine, so 16 calls took two waves. That size is the Python default for 10 cores. The `max_concurrency` key also sets the size of that pool, so a value above 14 makes it larger {{code libs/core/langchain_core/runnables/config.py:659-675}}. Async tools under `ainvoke` had no default cap. A tool with only an async body raised `NotImplementedError` under `invoke` in 125 of 125 runs for each harness.

A plain `ToolNode` under `ainvoke` ignored the cap, for async tools and for sync tools. Issue langgraph#8517 reports the async case {{issue langgraph#8517}}. Our runs reproduce it and show that sync tools on the async path are affected too. Under `invoke`, `ToolNode` applied the cap. Set `max_concurrency` on the run when a tool calls a service with a rate limit, and use `create_agent` when you need the cap under `ainvoke`.

## The defaults on the compiled graph

`create_agent` sets a config on the graph before it returns it:

```listing
title: the config and the stream mode of every agent
source: capture/out/05-agent-graph.txt
lang: text
note: Cut to the config, the stream mode, and the type.
---
agent.config:
{
  "recursion_limit": 9999,
  "metadata": {
    "ls_integration": "langchain_create_agent"
  },
  "configurable": {}
}

agent.stream_mode = 'updates'
type langgraph.graph.state.CompiledStateGraph
```

The limit of 9999 steps applies to every run that does not pass its own `recursion_limit`. The default stream mode is `updates`, so a stream with no mode yields one chunk for each node that ran. [Section 1.2](#s-one-create-agent-run) runs an agent into the limit and shows the chunks. A `name` also adds `lc_agent_name` to the metadata.

## What the agent layer costs

**We measured** one task on the Mac: two tools and three model calls, against a local stub server and against Qwen3 4B on Ollama. A plain `openai` loop and `create_agent` sent the same tool schemas and got the same answer in every run.

| Variant | Stub, median of 200 runs | Ollama, median of 24 runs |
|---|---|---|
| plain `openai` loop | 4.1 ms | 1450.99 ms |
| `ChatOpenAI.bind_tools` loop | 4.46 ms | not run |
| `create_agent` | 7.67 ms | 1550.32 ms |
| `create_agent` with `InMemorySaver` | 8.94 ms | not run |

Against the stub, the agent layer added about 1.2 ms for each model call. Against Ollama, the gap of about 99 ms between the medians was in the model time, on a shared machine, so read it as noise. [Section 7.2](#s-cost-the-framework-against-a-plain-sdk-loop) gives the full cost story, with tokens, request bytes, and import time.

```takeaways
- Expect a tools node only when the agent has a tool or a wrap_tool_call middleware.
- Read node names such as A.before_model to find the middleware hook that ran.
- Pass recursion_limit on each run, because the agent default is 9999 steps.
- Stream with no mode to get updates, the default of every agent.
- Budget about 1.2 ms of agent overhead for each model call, far below model time.
- Set max_concurrency on the run to cap parallel tool calls.
- Give each tool a sync body when the agent runs under invoke.
```

Sources: capture/out/05-agent-graph.txt, capture/out/09-middleware-order.txt; capture/lab/summary/parallel-tools-mac.json, capture/lab/T08-parallel-tools-mac/01-concurrency-runs.jsonl, capture/lab/T08-parallel-tools-mac/t08_run.py; issue langgraph#8517; capture/lab/summary/overhead-mac.json, capture/lab/T01-overhead-mac/02-stub-runs.jsonl, capture/lab/T01-overhead-mac/04-ollama-runs.jsonl, capture/lab/T01-overhead-mac/09-request-body-diff.txt; libs/langchain_v1/langchain/agents/factory.py and libs/langchain_v1/langchain/agents/middleware/types.py, libs/core/langchain_core/runnables/config.py at langchain==1.5.0; libs/langgraph/langgraph/graph/state.py at langgraph 1.2.22.
