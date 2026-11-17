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
| `response_format` | `None` | A schema adds a structured output tool or a provider format. [Section 4.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) explains both. |
| `state_schema`, `context_schema` | `None` | The state type and the type of `context` for each run. |
| `checkpointer`, `store` | `None` | Saved state per thread, and long-term memory. Part 5 covers both. |
| `interrupt_before`, `interrupt_after` | `None` | Static pauses before or after named nodes. |
| `name`, `debug`, `cache`, `transformers` | `None`, `False`, `None`, `None` | A graph name, debug output, a node cache, and stream transformers. |

[Section 3.2](#s-init-chat-model-and-model-profiles) shows how a model string resolves. [Section 3.5](#s-the-system-prompt) shows why the prompt stays out of the state.

## The nodes

The kit builds the agent of [section 1.3](#s-one-create-agent-run) with one tool and no middleware. The compiled graph has four nodes:

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

The `wrap_model_call` and `wrap_tool_call` hooks add no node. They run inside the `model` node and the `tools` node. [Section 4.5](#s-middleware-hooks-and-their-order) gives the order of all six hooks. [Figure](#fig-4-1) maps each argument to the part of the graph it builds.

```figure
id: fig-4-1
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

A structured output tool call is not sent to `tools`. The `model` node handles it, as [section 4.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) shows. An agent with no tools and a `ToolStrategy` or `AutoStrategy` has a `model` to `model` edge in place of the `tools` node. That edge checks `jump_to`, then a new `structured_response`, and otherwise loops {{code libs/langchain_v1/langchain/agents/factory.py:2045-2068}}. With no tools and a `ProviderStrategy`, the `model` node goes straight to the end {{code libs/langchain_v1/langchain/agents/factory.py:1790-1803}}.

## Draw your graph

You built an agent and want to see its graph before you run it. The compiled graph can describe itself, with no model call and no run.

**get_graph():** the method of a compiled graph that returns a `Graph` object from `langchain_core`, with its nodes and its edges {{code libs/langgraph/langgraph/pregel/main.py}}.

```listing
title: the nodes that get_graph() returns
source: capture/out/48-draw-agent.txt
lang: json
note: Cut to the tools node. The other nodes have no metadata.
---
graph.nodes:
{
…
  "tools": {
    "name": "tools",
    "data": "ToolNode",
    "metadata": {
      "__tools": [
        "add"
      ]
    }
  },
…
}
```

Each node holds the object that runs it, such as the `ToolNode` of `tools`. Each edge has a `conditional` flag. The `tools` node keeps the names of its tools as metadata.

**draw_mermaid():** the method of `Graph` that returns the graph as Mermaid flowchart text. It needs no extra package and no network {{code libs/core/langchain_core/runnables/graph_mermaid.py}}.

```listing
title: draw_mermaid() of the agent with one tool
source: capture/out/48-draw-agent.txt
lang: text
---
graph TD;
	__start__([<p>__start__</p>]):::first
	model(model)
	tools(tools<hr/><small><em>__tools = add</em></small>)
	__end__([<p>__end__</p>]):::last
	__start__ --> model;
	model -.-> __end__;
	model -.-> tools;
	tools -.-> model;
	classDef default fill:#f2f0ff,line-height:1.2
	classDef first fill-opacity:0
	classDef last fill:#bfb6fc
```

A node line gives an id and a label. `:::first` marks `__start__`, and `:::last` marks `__end__`. An edge line with `-->` is a plain edge, and one with `-.->` is a conditional edge. [Figure](#fig-4-1b) matches each line to the drawing. Every graph figure in this manual is drawn from such a text, captured from the compiled graph.

```figure
id: fig-4-1b
kind: structure
title: from draw_mermaid lines to a drawing
claim: Each node line of draw_mermaid becomes one node, and each edge line becomes one arrow, solid for --> and dashed for -.->.
caption: Match the numbered node lines on the left to the numbered nodes on the right. Each edge line shows the arrow style it becomes. From capture/out/48-draw-agent.txt.
```

**xray:** the argument of `get_graph` that opens each subgraph node and draws its nodes inside a box. `True` opens every level, and an integer opens that many levels {{code libs/langgraph/langgraph/pregel/main.py}}.

A parent graph with one subgraph shows the difference. `get_graph()` gives the subgraph as one node, `inner`. `get_graph(xray=True)` gives its two nodes in its place:

```listing
title: the nodes of a parent graph with xray=True
source: capture/out/52-draw-subgraph.txt
lang: json
---
[
  "__start__",
  "prepare",
  "finish",
  "__end__",
  "inner:shout",
  "inner:ask_ok"
]
```

[Section 6.7](#s-subgraphs-and-multi-agent-patterns) draws the parent graph both ways. An agent from `create_agent` has no subgraph node, so `xray` changes nothing in its graph.

**draw_ascii():** the method of `Graph` that draws the graph as text. It needs the `grandalf` package, and `langchain-core` does not install it {{code libs/core/langchain_core/runnables/graph_ascii.py:205}}. The kit pin leaves it out, so the call raises:

```listing
title: draw_ascii() at the pin
source: capture/out/48-draw-agent.txt
lang: text
---
draw_ascii():

raised builtins.ImportError: Install grandalf to draw graphs: `pip install grandalf`.
```

Install `grandalf` in your own environment when you want a drawing in the terminal.

**draw_mermaid_png():** the method of `Graph` that turns the Mermaid text into a PNG image. Its default draw method is the API method:

```listing
title: the defaults of draw_mermaid_png() at the pin
source: capture/out/48-draw-agent.txt
lang: json
---
keyword defaults:
{
  "draw_method": "api",
  "base_url": null,
  "max_retries": 1,
  "output_file_path": null
}
```

The API method encodes the whole Mermaid text in base64. It puts the result in the URL of a GET request to a public rendering service {{code libs/core/langchain_core/runnables/graph_mermaid.py:463-501}}. So your node names, tool names, and node metadata leave your machine in that URL. Do not call the default on a graph whose names are private.

`base_url` sends the same request to a Mermaid server that you run {{code libs/core/langchain_core/runnables/graph_mermaid.py:463}}. The `PYPPETEER` method renders in a local headless browser, with the `pyppeteer` package. That page still loads the Mermaid script from a public content delivery network, so it needs the network too {{code libs/core/langchain_core/runnables/graph_mermaid.py:389-393}}. The kit calls neither method. It captures the Mermaid text, and the figures of this manual draw that text offline.

## Parallel tool calls and max_concurrency

**max_concurrency:** the key of the run config that caps how many tasks of one step run at the same time.

**We measured** parallel tool calls on the x86 server guest, 32 vCPU. Qwen3 4B was asked for 1 to 16 parallel calls and made 2, 2, 4, 8, 16. The ToolNode cells ran its real reply, 5 times each. `create_agent` called the model in every run, asked for 8, 3 times each. The tool ran a 200 ms `pg_sleep` on PostgreSQL.

| `ToolNode` and call | 16 calls, cap 1 | 16 calls, cap 8 | 16 calls, no cap |
|---|---|---|---|
| `invoke`, sync tool | 3,331.0 ms, 1 at a time | 460.0 ms, 8 at a time | 264.2 ms, 16 at a time |
| `ainvoke`, async tool | 233.7 ms, 16 at a time | 233.1 ms, 16 at a time | 233.7 ms, 16 at a time |
| `ainvoke`, sync tool | 267.1 ms, 16 at a time | 266.5 ms, 16 at a time | 269.2 ms, 16 at a time |

| `create_agent` and call | 8 calls, cap 1 | 8 calls, cap 4 | 8 calls, no cap |
|---|---|---|---|
| `invoke`, sync tool | 1,674.0 ms, 1 at a time | 437.2 ms, 4 at a time | 229.2 ms, 8 at a time |
| `ainvoke`, async tool | 1,668.7 ms, 1 at a time | 421.9 ms, 4 at a time | 210.5 ms, 8 at a time |
| `ainvoke`, sync tool | 1,669.7 ms, 1 at a time | 431.0 ms, 4 at a time | 231.2 ms, 8 at a time |

Each `ToolNode` cell gives the median wall time and the largest number of calls that ran at one time. Each `create_agent` cell gives the median time from the first tool start to the last tool end. A whole run took 12 to 14 s with the model. Every successful run executed each call once and wrote one `ToolMessage` for it.

`create_agent` applied the cap in every mode, because each call is its own `Send` task. With no cap, sync tools run in a thread pool. The Python default pool is min(32, cpu+4). That is 14 on the 10-core Mac and 32 on the guest, where 16 sync calls ran at once in 264 ms.

The `max_concurrency` key also sets the size of that pool, so a value above the default makes it larger {{code libs/core/langchain_core/runnables/config.py:659-675}}. Async tools under `ainvoke` had no default cap. A tool with only an async body raised `NotImplementedError` under `invoke` in 125 of 125 ToolNode rows and 9 of 9 agent runs.

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

The limit of 9999 steps applies to every run that does not pass its own `recursion_limit`. The default stream mode is `updates`, so a stream with no mode yields one chunk for each node that ran. [Section 1.3](#s-one-create-agent-run) runs an agent into the limit and shows the chunks. A `name` also adds `lc_agent_name` to the metadata.

## What the agent layer costs

**We measured** one task on the Mac: two tools and three model calls, against Qwen3 4B on Ollama, 40 shuffled runs each. A plain `openai` loop and `create_agent` sent the same tool schemas and got the same answer in every run. A proxy timed each model call, and the time outside the model is the rest of the run.

| Variant | Time outside the model, median | More than the plain loop, same round |
|---|---|---|
| plain `openai` loop | 25.1 ms | the baseline |
| `ChatOpenAI.bind_tools` loop | 29.3 ms | 6.6 ms |
| `create_agent` | 37.6 ms | 15.6 ms |
| `create_agent` with `InMemorySaver` | 37.6 ms | 12.2 ms |
| hand-built `StateGraph` | 36.7 ms | 11.5 ms |

The agent layer added about 5 ms for each model call. With `create_agent`, 2.3% of a 1.8 s run was outside the model. [Section 8.3](#s-cost-the-framework-against-a-plain-sdk-loop) gives the full cost story, with tokens, request bytes, and import time.

```takeaways
- Expect a tools node only when the agent has a tool or a wrap_tool_call middleware.
- Read node names such as A.before_model to find the middleware hook that ran.
- Pass recursion_limit on each run, because the agent default is 9999 steps.
- Stream with no mode to get updates, the default of every agent.
- Budget about 5 ms of agent overhead for each model call, far below model time.
- Set max_concurrency on the run to cap parallel tool calls of create_agent, and not of a plain ToolNode under ainvoke.
- Give each tool a sync body when the agent runs under invoke.
- Draw a graph from draw_mermaid, because draw_mermaid_png sends the graph text to a public service.
```

Sources: capture/out/05-agent-graph.txt, capture/out/09-middleware-order.txt, capture/out/48-draw-agent.txt, capture/out/52-draw-subgraph.txt, capture/s_draw.py; capture/lab/summary/parallel-tools-x86.json, capture/lab/T08-parallel-tools-x86/01-counts.jsonl, capture/lab/T08-parallel-tools-x86/04-toolnode.jsonl, capture/lab/T08-parallel-tools-x86/05-agent.jsonl, capture/lab/T08-parallel-tools-x86/t08_real.py; issue langgraph#8517; capture/lab/summary/overhead-mac-real.json, capture/lab/T01-overhead-mac-real/01-runs.jsonl, capture/lab/T01-overhead-mac-real/t01_real.py; libs/langchain_v1/langchain/agents/factory.py and libs/langchain_v1/langchain/agents/middleware/types.py, libs/core/langchain_core/runnables/config.py at langchain==1.5.0; libs/langgraph/langgraph/graph/state.py and libs/langgraph/langgraph/pregel/main.py at langgraph 1.2.22; libs/core/langchain_core/runnables/graph.py, libs/core/langchain_core/runnables/graph_mermaid.py, and libs/core/langchain_core/runnables/graph_ascii.py at langchain-core 1.8.0.
