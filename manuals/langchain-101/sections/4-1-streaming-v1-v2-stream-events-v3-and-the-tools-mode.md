# Streaming: v1, v2, stream_events v3, and the tools mode

> One agent run can stream as v1 chunks whose shape follows your options, as v2 StreamPart dicts with one shape, or as v3 events, which are beta.

You stream an agent into a chat window with `stream_mode="messages"`, and the tokens arrive. Then you add `"updates"` to show tool progress, and your loop breaks, because each chunk is now a tuple. The run did not change. The stream API changed the shape of what it yields.

When you finish this section, you can choose a stream API and a stream mode, and predict each chunk of one run. You can also read the tool events of the `tools` mode, which the stream mode type leaves out.

## Stream modes in v1

**Stream mode:** the name that you pass as `stream_mode`, which decides what `stream` yields at each step of the graph.

**Chunk:** one item that `stream` yields. Its shape depends on the stream mode, the number of modes, and the stream version.

The kit streams the agent of [section 1.2](#s-one-create-agent-run) in each mode. In `updates` mode, each chunk is one node and the state keys that it wrote:

```listing
title: the first chunk in updates mode
source: capture/out/21-stream-updates-values.txt
lang: json
note: The tool call is cut to its name and id.
---
chunk 0:
{
  "model": {
    "messages": [
      {
        "type": "AIMessage",
        "content": "",
        "id": "lc_run--<uuid-1>-0",
        "tool_calls": [
          {
            "name": "add",
…
            "id": "call_1",
```

In `values` mode, each chunk is the whole state. The first chunk holds only the input, so the same run gives four chunks in `values` mode and three in `updates` mode.

In `messages` mode, each chunk is a pair: a message chunk and its metadata. The metadata names the node and the step. The tool call comes whole on one chunk, and the `ToolMessage` of the tools node comes as a chunk too:

```listing
title: the first two chunks in messages mode
source: capture/out/22-stream-messages.txt
lang: json
note: The tool call and the triggers are cut.
---
chunk 0:
{
  "message": {
    "type": "AIMessageChunk",
    "content": "",
    "id": "lc_run--<uuid-1>",
…
    "chunk_position": "last"
  },
  "metadata": {
    "langgraph_node": "model",
    "langgraph_step": 1,
…
chunk 1:
{
  "message": {
    "type": "ToolMessage",
    "content": "5",
…
  "metadata": {
    "langgraph_node": "tools",
    "langgraph_step": 2,
```

The final answer `The sum is 5.` then comes as seven text chunks. The fake splits its text at each space, and a real model splits it in its own way.

[Figure 4.1](#fig-4-1) puts the chunks of each mode on the three node runs of this one run.

```figure
id: fig-4-1
kind: timeline
title: the chunks of one agent run in each stream mode
claim: The same run yields 3 chunks in updates mode, 4 in values mode, 9 in messages mode, and 21 events from stream_events v3.
caption: Each row is one stream of the same agent run. Each mark is one chunk, placed on the node run that made it. The tools row is the slow_sum agent, which emits two deltas. From capture/out/21-stream-updates-values.txt, capture/out/22-stream-messages.txt, capture/out/23-stream-tasks-custom-debug.txt, capture/out/25-stream-events-v3.txt, and capture/out/26-stream-tools-mode.txt.
```

| Mode | One chunk is | Chunks for the add run |
|---|---|---|
| `updates` | `{node: what it wrote}` | 3 |
| `values` | the whole state after a step | 4 |
| `messages` | a message chunk and its metadata | 9 |
| `tasks` | the start or the result of one node run | 6 |
| `debug` | a task or a task result, with the step and a time | 6 |
| `custom` | a value that a node or tool writes with its stream writer | 0, because `add` writes nothing |
| `tools` | a tool event: started, an output delta, or finished | 4, from the `slow_sum` agent |

The streaming page of LangGraph says that `tasks` mode needs a checkpointer {{docs oss/python/langgraph/streaming}}. The kit ran `tasks` and `debug` with no checkpointer and got six chunks from each. Without a checkpointer, `debug` had only `task` and `task_result` chunks. This manual records the disagreement as conflict D124. The `checkpoints` mode is not in the kit, and it comes in the next edition, as section 7.6 will say.

## Several modes at once

Pass a list of modes, and each v1 chunk becomes a tuple of the mode and the data. Code written for one mode breaks when a second mode is added:

```listing
title: two modes in v1
source: capture/out/22-stream-messages.txt
lang: json
note: The kit printed the mode, the text, and the node of each tuple. Chunks 2 to 10 are cut.
---
chunk 0:
{
  "mode": "messages",
  "chunk": "",
  "node": "model"
}

chunk 1:
{
  "mode": "updates",
  "nodes": [
    "model"
  ]
}
…
chunk 11:
{
  "mode": "updates",
  "nodes": [
    "model"
  ]
}
```

The `messages` chunks of a model call come before the `updates` chunk of the same node. The node must end before LangGraph knows what it wrote.

## StreamPart in v2

**StreamPart:** the dict that `stream(..., version="v2")` yields, with three keys: `type`, `ns`, and `data`. `type` names the mode, and `ns` names the subgraph.

LangGraph 1.1 added `version="v2"` {{docs oss/python/langgraph/streaming}}. Every chunk then has the same three keys, with one mode or with several:

```listing
title: one StreamPart in v2
source: capture/out/24-stream-v2.txt
lang: json
note: The state update is cut. The kit added the keys list.
---
part 1:
{
  "type": "updates",
  "ns": [],
  "data": {
    "model": {
…
  "keys": [
    "data",
    "ns",
    "type"
  ]
}
```

`invoke(..., version="v2")` returns a `GraphOutput` with `value` and `interrupts`. The old dict access still works, and it warns:

```listing
title: dict access on GraphOutput
source: capture/out/24-stream-v2.txt
lang: text
---
result['messages'] has 4 messages

warning LangGraphDeprecatedSinceV11: Accessing GraphOutput via `result[key]` is deprecated. Use `result.value` to access the output value directly, or `result.interrupts` for interrupts. Deprecated in LangGraph V1.1 to be removed in V3.0.
```

Use v2 in new code. A loop that switches on `part["type"]` keeps working when you add a mode or a subgraph. [Figure 4.1b](#fig-4-1b) sets the three shapes side by side.

```figure
id: fig-4-1b
kind: comparison
title: the same tool result in v1, v2, and v3
claim: v1 changes its shape with the number of modes, v2 always yields type, ns, and data, and v3 adds a method and a sequence number.
caption: Each column is one stream API. Read the outer shape at the top, then the tool result that it carries. From capture/out/22-stream-messages.txt, capture/out/24-stream-v2.txt, and capture/out/25-stream-events-v3.events.json.
```

## stream_events v3

**GraphRunStream:** the object that `stream_events(..., version="v3")` returns. You iterate it for raw events, or read its typed views such as `messages`, `values`, and `output`.

The LangChain streaming page recommends event streaming for new applications {{docs oss/python/langchain/streaming}}. At the pin it is beta, and the call warns:

```listing
title: stream_events v3 and its members
source: capture/out/25-stream-events-v3.txt
lang: text
note: The list of members is cut to five.
---
warning LangChainBetaWarning: The v3 streaming protocol on Pregel is experimental.

public members of GraphRunStream:
[
  "abort",
…
  "messages",
  "output",
…
  "tool_calls",
  "values"
]

21 events
```

Each event has a `method`, a `params` object with a namespace and a time, and a sequence number `seq`. The tool call of the run is two events of the method `tools`:

```listing
title: one v3 event
source: capture/out/25-stream-events-v3.events.json
lang: json
---
  {
    "type": "event",
    "method": "tools",
    "params": {
      "namespace": [],
      "timestamp": "<epoch-ms>",
      "data": {
        "event": "tool-started",
        "tool_call_id": "call_1",
        "tool_name": "add",
        "input": {
          "a": 2,
          "b": 3
        }
      }
    },
    "seq": 7
  },
```

A model call is a group of `messages` events: `message-start`, `content-block-start`, one `content-block-delta` for each piece of text, `content-block-finish`, and `message-finish`. A `values` event follows each step. That is 21 events for the run, against 9 chunks in `messages` mode.

Three differences from v1 and v2 break code that you port:

- `stream_events(version="v3")` rejects `stream_mode` with a `TypeError`, because v3 builds its own set of modes.
- The sync `stream_events(version="v2")` raises `NotImplementedError`. Use `astream_events` for v1 and v2 events.
- The AI messages in `run.output` have their content as a list of standard blocks, with `output_version` `v1` in `response_metadata`. In v1 and v2 the same messages had string content.

```listing
title: the last message of run.output
source: capture/out/25-stream-events-v3.txt
lang: json
---
  {
    "type": "AIMessage",
    "content": [
      {
        "type": "text",
        "text": "The sum is 5.",
        "index": 0
      }
    ],
    "id": "lc_run--<uuid-4>",
    "response_metadata": {
      "output_version": "v1"
    }
  }
```

Read the text of such a message with `message.text`, which works for both forms, as [section 2.3](#s-messages-and-content-blocks) shows.

## The tools mode

**Tool event:** a chunk of the `tools` stream mode. It is `tool-started`, `tool-output-delta`, or `tool-finished`, and it carries the `tool_call_id`.

The type `StreamMode` lists seven modes, and the `stream` docstring lists the same seven {{code libs/langgraph/langgraph/types.py}}. The loop also accepts `tools` {{code libs/langgraph/langgraph/pregel/main.py}}. The LangGraph streaming page does not list it either {{docs oss/python/langgraph/streaming}}. This manual records the gap as conflict D4. A tool sends a delta with `runtime.emit_output_delta`:

```listing
title: a tool that reports progress
source: capture/s_stream.py
lang: python
---
@tool
def slow_sum(a: int, b: int, runtime: ToolRuntime) -> int:
    """Add two integers and report progress."""
    runtime.emit_output_delta({"partial": a})
    runtime.emit_output_delta({"partial": a + b})
    return a + b
```

```listing
title: the tools mode
source: capture/out/26-stream-tools-mode.txt
lang: json
note: The finished event is cut to its first lines.
---
chunk 0:
{
  "event": "tool-started",
  "tool_call_id": "call_1",
  "tool_name": "slow_sum",
  "input": {
    "a": 2,
    "b": 3
  }
}

chunk 1:
{
  "event": "tool-output-delta",
  "tool_call_id": "call_1",
  "delta": {
    "partial": 2
  }
}
…
chunk 3:
{
  "event": "tool-finished",
  "tool_call_id": "call_1",
```

In a stream without `tools` mode, `emit_output_delta` does nothing. The kit streamed the same agent in `updates` mode and got the three node chunks only. In v2, a tool event is a StreamPart with `type` `tools`.

## Fake models and streaming

The stock `GenericFakeChatModel` raises `NotImplementedError` when `create_agent` binds tools. A subclass that only adds `bind_tools` works with `invoke`, and fails in `messages` mode. With empty content and a tool call, the stream raised `ValueError: No generations found in stream.`. With text and a tool call, the text arrived, the tool call was lost, and the tool never ran. Test streaming with a fake whose stream sends tool calls, such as the `ScriptedChatModel` of the kit. This manual records the docstring and docs claims as conflict D2.

```takeaways
- Use version="v2" and switch on part["type"], so a new mode does not change the shape.
- Expect messages mode to yield the ToolMessage as well as the model tokens.
- Pass a checkpointer only when you need checkpoints, because tasks and debug work without one.
- Add "tools" to stream_mode to get tool progress from emit_output_delta.
- Treat stream_events v3 as beta, and read message.text for content in either form.
- Test streaming with a fake model that streams tool calls.
```

Sources: capture/s_stream.py, capture/out/21-stream-updates-values.txt, capture/out/22-stream-messages.txt, capture/out/23-stream-tasks-custom-debug.txt, capture/out/24-stream-v2.txt, capture/out/25-stream-events-v3.txt, capture/out/25-stream-events-v3.events.json, capture/out/26-stream-tools-mode.txt, capture/out/27-stream-stock-fakes.txt; libs/langgraph/langgraph/types.py, libs/langgraph/langgraph/pregel/main.py, and libs/langgraph/langgraph/pregel/_tools.py at langgraph 1.2.22; libs/core/langchain_core/language_models/fake_chat_models.py at langchain==1.5.0; docs.langchain.com at docs commit 04d4d4a (oss/python/langgraph/streaming, oss/python/langchain/streaming, oss/python/langgraph/event-streaming).
