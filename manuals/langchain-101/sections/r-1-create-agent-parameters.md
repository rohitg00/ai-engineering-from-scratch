# create_agent parameters

> `create_agent` in `langchain` 1.5.0 takes a model, tools, and 13 keyword parameters, and returns a compiled LangGraph graph with a recursion limit of 9999.

The tables give each parameter, its type and default at the pin, and what the code does with it. Each row names the line of `libs/langchain_v1/langchain/agents/factory.py` at `langchain==1.5.0` in its citation. [Section 3.1](#s-create-agent-and-the-graph-it-builds) explains the graph, and the last column links the section that runs each parameter.

## The signature

Import it with `from langchain.agents import create_agent`. The function starts at line 895, after three typed overloads at lines 827, 849, and 873 {{code libs/langchain_v1/langchain/agents/factory.py:827-914}}. The first two parameters are positional. The others are keyword only.

| Parameter | Type | Default | What the code does | Section |
|---|---|---|---|---|
| `model` | `str` or `BaseChatModel` | required | A string goes through `init_chat_model` once, when the agent is built {{code libs/langchain_v1/langchain/agents/factory.py:1050-1051}}. | [2.2](#s-init-chat-model-and-model-profiles) |
| `tools` | a sequence of `BaseTool`, callables, and dicts | `None` | A dict is a provider tool. It is bound to the model and never runs in the `tools` node {{code libs/langchain_v1/langchain/agents/factory.py:1135-1139}}. | [2.4](#s-tools-toolruntime-and-tool-errors) |
| `system_prompt` | `str` or `SystemMessage` | `None` | A string becomes a `SystemMessage` {{code libs/langchain_v1/langchain/agents/factory.py:1054-1059}}. It goes first in every model request and is not stored in the state {{code libs/langchain_v1/langchain/agents/factory.py:1504-1505}}. | [2.5](#s-the-system-prompt) |
| `middleware` | a sequence of `AgentMiddleware` | `()` | Two instances with one `name` raise `AssertionError` {{code libs/langchain_v1/langchain/agents/factory.py:1163-1165}}. Their tools join your tools {{code libs/langchain_v1/langchain/agents/factory.py:1092}}. | [3.3](#s-middleware-hooks-and-their-order) |
| `response_format` | `ToolStrategy`, `ProviderStrategy`, `AutoStrategy`, a type, or a dict | `None` | A plain schema becomes `AutoStrategy`, which picks a strategy on each model call {{code libs/langchain_v1/langchain/agents/factory.py:1412-1422}}. | [3.2](#s-structured-output-autostrategy-providerstrategy-toolstrategy) |
| `state_schema` | a subclass of `AgentState` | `None` | Middleware schemas merge first and this schema merges last, so its fields win {{code libs/langchain_v1/langchain/agents/factory.py:1229-1235}}. | [3.1](#s-create-agent-and-the-graph-it-builds) |
| `context_schema` | a type | `None` | Types the `context` argument of a run. Without it, a `context` dict gives a pydantic warning in our runs. | [4.4](#s-stores-and-long-term-memory) |
| `checkpointer` | a `Checkpointer` | `None` | Passed to `compile`. Without one, a run keeps no state between calls {{code libs/langchain_v1/langchain/agents/factory.py:1909-1916}}. | [4.2](#s-checkpointers-and-threads) |
| `store` | a `BaseStore` | `None` | Passed to `compile`, and given to tools as `runtime.store`. | [4.4](#s-stores-and-long-term-memory) |
| `interrupt_before` | a list of node names | `None` | Static breakpoints before the named nodes, passed to `compile`. | [5.4](#s-interrupt-and-resume) |
| `interrupt_after` | a list of node names | `None` | Static breakpoints after the named nodes, passed to `compile`. | [5.4](#s-interrupt-and-resume) |
| `debug` | `bool` | `False` | Passed to `compile`. | [3.1](#s-create-agent-and-the-graph-it-builds) |
| `name` | `str` | `None` | Sets the graph name, the `name` of each model reply, and `lc_agent_name` in the run metadata {{code libs/langchain_v1/langchain/agents/factory.py:1508-1509}} {{code libs/langchain_v1/langchain/agents/factory.py:1904-1905}}. | [5.7](#s-subgraphs-and-multi-agent-patterns) |
| `cache` | a LangGraph `BaseCache` | `None` | A node cache, passed to `compile`. It is not the model cache of `set_llm_cache`. | [3.5](#s-retries-backup-models-rate-limits-and-caching) |
| `transformers` | a sequence of stream transformer factories | `None` | Added after `ToolCallTransformer`, `SubagentTransformer`, and the transformers of each middleware {{code libs/langchain_v1/langchain/agents/factory.py:1917-1924}}. | [4.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) |

The docstring says that `response_format` takes a `ToolStrategy`, a `ProviderStrategy`, or a Pydantic class. The signature also takes `AutoStrategy`, a dataclass, a `TypedDict`, and a JSON schema dict, and capture `07-structured-output.txt` runs each one {{code libs/langchain_v1/langchain/agents/factory.py:901}}.

## The graph it returns

The return type is `CompiledStateGraph`. The code compiles the graph and then applies one run config to it {{code libs/langchain_v1/langchain/agents/factory.py:1902-1925}}.

| Property | Value at the pin | Where it comes from |
|---|---|---|
| model node | `model` | `graph.add_node("model", ...)` {{code libs/langchain_v1/langchain/agents/factory.py:1614}} |
| tool node | `tools`, a `ToolNode`, present only with client tools or a `wrap_tool_call` middleware | {{code libs/langchain_v1/langchain/agents/factory.py:1142-1151}} |
| middleware nodes | `<name>.before_agent`, `<name>.before_model`, `<name>.after_model`, `<name>.after_agent` | capture `09-middleware-order.txt` |
| `recursion_limit` | 9999 | {{code libs/langchain_v1/langchain/agents/factory.py:1902}} |
| run metadata | `{"ls_integration": "langchain_create_agent"}` | {{code libs/langchain_v1/langchain/agents/factory.py:1903}} |
| default `stream_mode` | `updates` | `StateGraph.compile` {{code libs/langgraph/langgraph/graph/state.py:1357}} |
| parallel tool calls | one `Send("tools", [tool_call])` for each pending call, in one step | {{code libs/langchain_v1/langchain/agents/factory.py:2031-2032}} |
| loop exit | no tool calls, or a new `structured_response` | {{code libs/langchain_v1/langchain/agents/factory.py:2015-2036}} |

The `tools` node uses the default error handler of `ToolNode`. It returns a message for bad arguments and raises every other exception {{code libs/prebuilt/langgraph/prebuilt/tool_node.py:391-399}}. [Section 2.4](#s-tools-toolruntime-and-tool-errors) shows both cases.

## The state

`AgentState` is a `TypedDict` with three keys {{code libs/langchain_v1/langchain/agents/middleware/types.py:351-372}}.

| Key | Type | Notes |
|---|---|---|
| `messages` | a list of messages with the `add_messages` reducer | required |
| `jump_to` | `"tools"`, `"model"`, or `"end"` | private and ephemeral. A node hook sets it to route the run {{code libs/langchain_v1/langchain/agents/middleware/types.py:70}} |
| `structured_response` | your schema | left out of the input schema |

`InputAgentState` holds only `messages`. `OutputAgentState` holds `messages` and `structured_response`.

## Arguments of a run

The run methods belong to the compiled graph from `langgraph` 1.2.22. `invoke` and `stream` take the same keywords, and `stream` also takes `subgraphs` {{code libs/langgraph/langgraph/pregel/main.py:2767-2783}} {{code libs/langgraph/langgraph/pregel/main.py:3948-3962}}.

| Argument | Default | Notes | Section |
|---|---|---|---|
| `input` | required | A dict with `messages`, `None` to go on from a checkpoint, or a `Command` to resume. | [5.4](#s-interrupt-and-resume) |
| `config` | `None` | Holds `recursion_limit`, `max_concurrency`, `callbacks`, and `configurable`, with `thread_id` inside `configurable`. | [4.2](#s-checkpointers-and-threads) |
| `context` | `None` | Static data for the run, read as `runtime.context`. | [4.4](#s-stores-and-long-term-memory) |
| `stream_mode` | `values` for `invoke`, the graph default for `stream` | [The stream reference](#s-ref-stream-modes-and-event-types) lists each mode. | [4.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) |
| `durability` | `async` | `sync`, `async`, or `exit` {{code libs/langgraph/langgraph/pregel/main.py:2715}}. | [4.3](#s-durability-modes-and-a-crash-between-two-steps) |
| `interrupt_before`, `interrupt_after` | `None` | Breakpoints for this run only. | [5.4](#s-interrupt-and-resume) |
| `subgraphs` | `False` | `stream` only. Each chunk then carries the namespace of its subgraph. | [5.7](#s-subgraphs-and-multi-agent-patterns) |
| `version` | `v1` | `v2` yields `StreamPart` dicts, and `invoke` returns a `GraphOutput`. | [4.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) |

Sources: libs/langchain_v1/langchain/agents/factory.py, libs/langchain_v1/langchain/agents/middleware/types.py, and libs/langchain_v1/langchain/agents/structured_output.py at langchain==1.5.0; libs/langgraph/langgraph/pregel/main.py, libs/langgraph/langgraph/graph/state.py, and libs/prebuilt/langgraph/prebuilt/tool_node.py at langgraph 1.2.22; capture/out/05-agent-graph.txt, capture/out/06-agent-run.txt, capture/out/07-structured-output.txt, capture/out/09-middleware-order.txt.
