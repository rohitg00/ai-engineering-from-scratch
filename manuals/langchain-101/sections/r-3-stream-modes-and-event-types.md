# Stream modes and event types

> A LangGraph run streams in eight modes, in two chunk versions, and through one beta event protocol, and each one has a fixed shape at `langgraph` 1.2.22.

Every row of this page comes from the code of `langgraph` 1.2.22 or from a capture of the same agent run. That run makes two model calls and one tool call. [Section 4.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) explains when to use each mode.

## The modes of stream

The type `StreamMode` lists seven modes {{code libs/langgraph/langgraph/types.py:132-134}}. The loop also accepts `tools`, which the type leaves out {{code libs/langgraph/langgraph/pregel/main.py:2949-2950}}. The register of [the sources page](#s-ref-sources-and-conflicts) records that gap as D4.

| Mode | One chunk in v1 | Chunks in our run | Capture |
|---|---|---|---|
| `values` | the whole state after each step | 4 | `21-stream-updates-values.txt` |
| `updates` | a dict from the node name to the update that the node returned | 3 | `21-stream-updates-values.txt` |
| `messages` | a tuple of a message chunk and a metadata dict | 9 | `22-stream-messages.txt` |
| `custom` | the value that a node or tool passed to `stream_writer` | 0, because no tool wrote one | `23-stream-tasks-custom-debug.txt` |
| `tasks` | a task start with `id`, `name`, `input`, and `triggers`, or a task result with `error` and `result` | 6 | `23-stream-tasks-custom-debug.txt` |
| `debug` | a dict with `step`, `timestamp`, a `type` of `checkpoint`, `task`, or `task_result`, and a `payload` | 6, with no checkpointer | `23-stream-tasks-custom-debug.txt` |
| `checkpoints` | a checkpoint in the shape of `get_state` | not in the kit | none |
| `tools` | a tool event, as the table below shows | 4, on the `slow_sum` agent | `26-stream-tools-mode.txt` |

A `create_agent` graph streams `updates` when you pass no mode {{code libs/langgraph/langgraph/graph/state.py:1357}}. A plain `Pregel` object streams `values` {{code libs/langgraph/langgraph/pregel/main.py:715}}. Inside another graph, a graph with no mode streams `values` too {{code libs/langgraph/langgraph/pregel/main.py:2850-2857}}.

The metadata of a `messages` chunk holds `langgraph_node`, `langgraph_step`, `langgraph_triggers`, `ls_provider`, and `ls_model_type`, among other keys. Read `langgraph_node` to tell the model of an agent from a model inside a tool.

## The shape of a chunk in v1

| Call | What `stream` yields |
|---|---|
| one mode | the chunk |
| a list of modes | a tuple `(mode, chunk)` |
| one mode with `subgraphs=True` | a tuple `(namespace, chunk)` |
| a list of modes with `subgraphs=True` | a tuple `(namespace, mode, chunk)` |

## StreamPart in v2

With `version="v2"`, every chunk is a `TypedDict` with the keys `type`, `ns`, and `data`, whatever modes you ask for. The `v2` value came in `langgraph` 1.1.0.

| Type | `type` value | Line in `types.py` |
|---|---|---|
| `ValuesStreamPart` | `values` | 274 |
| `UpdatesStreamPart` | `updates` | 286 |
| `MessagesStreamPart` | `messages` | 298 |
| `CustomStreamPart` | `custom` | 311 |
| `CheckpointStreamPart` | `checkpoints` | 322 |
| `TasksStreamPart` | `tasks` | 330 |
| `DebugStreamPart` | `debug` | 345 |

{{code libs/langgraph/langgraph/types.py:274-379}}

`invoke(..., version="v2")` returns a `GraphOutput` with `value` and `interrupts` {{code libs/langgraph/langgraph/types.py:381-421}}. Access to it as a dict still works, and it warns `LangGraphDeprecatedSinceV11`, as capture `24-stream-v2.txt` shows.

## Tool events

The `tools` mode yields one dict for each tool event. Its `event` key names the kind:

| `event` | Other keys | In our run |
|---|---|---|
| `tool-started` | `tool_call_id`, `tool_name`, `input` | 1 |
| `tool-output-delta` | `tool_call_id`, `delta` | 2, from `runtime.emit_output_delta` |
| `tool-finished` | `tool_call_id`, `output`, the `ToolMessage` | 1 |
| `tool-error` | defined by the protocol | 0 |

{{code libs/prebuilt/langgraph/prebuilt/tool_node.py:1766}} {{code langchain_protocol/protocol.py:518-534}}

## stream_events v3

`stream_events` defaults to `version="v2"`, and you must name `v3` {{code libs/langgraph/langgraph/pregel/main.py:3751-3758}}. Version v3 is beta, and it warns `LangChainBetaWarning: The v3 streaming protocol on Pregel is experimental.` {{code libs/langgraph/langgraph/pregel/main.py:3617}}. It returns a `GraphRunStream`, whose public members in capture `25-stream-events-v3.txt` are `abort`, `extensions`, `interleave`, `interrupted`, `interrupts`, `lifecycle`, `messages`, `output`, `subagents`, `subgraphs`, `tool_calls`, and `values`.

| Rule | Where |
|---|---|
| `stream_mode` and `subgraphs` raise `TypeError` under v3. | {{code libs/langgraph/langgraph/pregel/main.py:395-400}} |
| A sync `stream_events` with v1 or v2 raises `NotImplementedError`. Use `astream_events` for those versions. | {{code libs/core/langchain_core/runnables/base.py:1818}} |
| The kit pins the event shapes with `langchain-protocol` 0.0.21. | `capture/requirements.txt` |

Each raw event is a frame with `type` `event`, a `method`, `params` with `namespace`, `timestamp`, and `data`, and a `seq` number. Our run gave 21 frames: 4 `values`, 15 `messages`, and 2 `tools`.

| `method` | What `data` holds | Line in `protocol.py` |
|---|---|---|
| `lifecycle` | the status of a graph or a subagent: `started`, `running`, `completed`, `failed`, or `interrupted` | 269, 462 |
| `messages` | a message event and its metadata | 273 |
| `tools` | a tool event | 277 |
| `input.requested`, `input.answered` | an interrupt and its answer | 281, 285 |
| `values`, `updates`, `checkpoints`, `custom`, `tasks` | the data of the v1 mode of the same name | 289 to 305 |

{{code langchain_protocol/protocol.py:269-306}}

A `messages` frame carries one of these events for one model message:

| Event | Keys | In our run |
|---|---|---|
| `message-start` | `role`, `id` | 2 |
| `content-block-start` | `index`, `content` | 2 |
| `content-block-delta` | `index`, `delta`, such as `{"type": "text-delta", "text": "The"}` | 7 |
| `content-block-finish` | `index`, `content`, the whole block | 2 |
| `message-finish` | none in our run | 2 |
| `error` | defined by the protocol | 0 |

{{code langchain_protocol/protocol.py:470-495}}

A provider that streams the arguments of a tool call sends `tool-call-delta` deltas {{code langchain_protocol/protocol.py:177}}. The kit fake sends each call whole on its last chunk, so our run has no `tool-call-delta`. The capture kit README says how the fake differs from `ChatOpenAI` here.

Sources: libs/langgraph/langgraph/types.py, libs/langgraph/langgraph/pregel/main.py, and libs/langgraph/langgraph/graph/state.py at langgraph 1.2.22; libs/prebuilt/langgraph/prebuilt/tool_node.py at langgraph-prebuilt 1.1.2; libs/core/langchain_core/runnables/base.py at langchain-core 1.8.0; langchain_protocol/protocol.py at langchain-protocol 0.0.21; capture/requirements.txt, capture/README.md, capture/out/21-stream-updates-values.txt, capture/out/22-stream-messages.txt, capture/out/23-stream-tasks-custom-debug.txt, capture/out/24-stream-v2.txt, capture/out/25-stream-events-v3.txt, capture/out/25-stream-events-v3.events.json, capture/out/26-stream-tools-mode.txt.
