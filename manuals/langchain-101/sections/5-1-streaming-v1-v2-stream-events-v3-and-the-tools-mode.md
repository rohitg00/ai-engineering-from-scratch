# Streaming: v1, v2, stream_events v3, and the tools mode

> One agent run can stream as v1 chunks whose shape follows your options, as v2 StreamPart dicts with one shape, or as v3 events, which are beta.

You stream an agent into a chat window with `stream_mode="messages"`, and the tokens arrive. Then you add `"updates"` to show tool progress, and your loop breaks, because each chunk is now a tuple. The run did not change. The stream API changed the shape of what it yields.

When you finish this section, you can choose a stream API and a stream mode, and predict each chunk of one run. You can also read the tool events of the `tools` mode, which the stream mode type leaves out.

## Stream modes in v1

**Stream mode:** the name that you pass as `stream_mode`, which decides what `stream` yields at each step of the graph.

**Chunk:** one item that `stream` yields. Its shape depends on the stream mode, the number of modes, and the stream version.

The kit streams the agent of [section 1.3](#s-one-create-agent-run) in each mode. In `updates` mode, each chunk is one node and the state keys that it wrote:

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
            "id": "<uuid-2>",
```

In `values` mode, each chunk is the whole state. The first chunk holds only the input, so the same run gives four chunks in `values` mode and three in `updates` mode.

In `messages` mode, each chunk is a pair: a message chunk and its metadata. The metadata names the node and the step. `ChatOllama` sent the tool call whole on one chunk, then an empty chunk marked `last`. The `ToolMessage` of the tools node comes as a chunk too:

```listing
title: the first three chunks in messages mode
source: capture/out/22-stream-messages.txt
lang: json
note: The tool call, the metadata of the reply, and the triggers are cut.
---
chunk 0:
{
  "message": {
    "type": "AIMessageChunk",
    "content": "",
    "id": "lc_run--<uuid-1>",
…
  "metadata": {
    "langgraph_node": "model",
    "langgraph_step": 1,
…
chunk 1:
{
  "message": {
    "type": "AIMessageChunk",
    "content": "",
    "id": "lc_run--<uuid-1>",
    "chunk_position": "last"
  },
…
chunk 2:
{
  "message": {
    "type": "ToolMessage",
    "content": "5",
…
  "metadata": {
    "langgraph_node": "tools",
    "langgraph_step": 2,
```

The final answer `2 + 3 = 5.` then came as eight text chunks, such as `2`, ` +`, and ` `. Two empty chunks followed, and the second was marked `last`. Ollama chose those pieces, so another model or another version splits the text in another way.

[Figure](#fig-5-1) puts the chunks of each mode on the three node runs of this one run.

```figure
id: fig-5-1
kind: timeline
title: the chunks of one agent run in each stream mode
claim: The same run yields 3 chunks in updates mode, 4 in values mode, 13 in messages mode, and 23 events from stream_events v3.
caption: Each row is one stream of the same agent run. Each mark is one chunk, placed on the node run that made it. Colour shows what a chunk carries: indigo a whole state, plum model output, green tool output, amber a task that starts (outlined) or ends. The tools row is the slow_sum agent, which emits two deltas. From capture/out/21-stream-updates-values.txt, capture/out/22-stream-messages.txt, capture/out/23-stream-tasks-custom-debug.txt, capture/out/25-stream-events-v3.txt, and capture/out/26-stream-tools-mode.txt.
```

| Mode | One chunk is | Chunks for the add run |
|---|---|---|
| `updates` | `{node: what it wrote}` | 3 |
| `values` | the whole state after a step | 4 |
| `messages` | a message chunk and its metadata | 13 |
| `tasks` | the start or the result of one node run | 6 |
| `debug` | a task or a task result, with the step and a time | 6 |
| `custom` | a value that a node or tool writes with its stream writer | 0, because `add` writes nothing |
| `tools` | a tool event: started, an output delta, or finished | 4, from the `slow_sum` agent |

The streaming page of LangGraph says that `tasks` mode needs a checkpointer {{docs oss/python/langgraph/streaming}}. The kit ran `tasks` and `debug` with no checkpointer and got six chunks from each. Without a checkpointer, the four `debug` chunks that the kit prints were `task` and `task_result` chunks. The kit does not print the last two. This manual records the disagreement as conflict D124. The `checkpoints` mode is not in the kit, and it comes in the next edition, as [section 8.8](#s-limits-at-the-pin-and-what-comes-in-the-next-edition) says.

## Several modes at once

Pass a list of modes, and each v1 chunk becomes a tuple of the mode and the data. Code written for one mode breaks when a second mode is added:

```listing
title: two modes in v1
source: capture/out/22-stream-messages.txt
lang: json
note: The kit printed the mode, the text, and the node of each tuple. Chunks 3 to 14 are cut.
---
chunk 0:
{
  "mode": "messages",
  "chunk": "",
  "node": "model"
}

chunk 1:
{
  "mode": "messages",
  "chunk": "",
  "node": "model"
}

chunk 2:
{
  "mode": "updates",
  "nodes": [
    "model"
  ]
}
…
chunk 15:
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
part 2:
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

Use v2 in new code. A loop that switches on `part["type"]` keeps working when you add a mode or a subgraph. [Figure](#fig-5-1b) sets the three shapes side by side.

```figure
id: fig-5-1b
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

23 events
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
        "tool_call_id": "<uuid-2>",
        "tool_name": "add",
        "input": {
          "a": 2,
          "b": 3
        }
      }
    },
    "seq": 8
  },
```

A model call is a group of `messages` events: `message-start`, `content-block-start`, the deltas, `content-block-finish`, and `message-finish`. The first call had one `content-block-delta` of type `tool-call-delta`, which carried the whole call. The second had eight of type `text-delta`, one for each piece of text. A `values` event follows each step. That is 23 events for the run, against 13 chunks in `messages` mode.

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
        "text": "2 + 3 = 5.",
        "index": 0
      }
    ],
    "id": "lc_run--<uuid-5>",
    "response_metadata": {
…
      "model_provider": "ollama",
      "output_version": "v1"
    },
```

Read the text of such a message with `message.text`, which works for both forms, as [section 3.3](#s-messages-and-content-blocks) shows.

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
  "tool_call_id": "<uuid-1>",
  "tool_name": "slow_sum",
  "input": {
    "a": 2,
    "b": 3
  }
}

chunk 1:
{
  "event": "tool-output-delta",
  "tool_call_id": "<uuid-1>",
  "delta": {
    "partial": 2
  }
}
…
chunk 3:
{
  "event": "tool-finished",
  "tool_call_id": "<uuid-1>",
```

In a stream without `tools` mode, `emit_output_delta` does nothing. The kit streamed the same agent in `updates` mode and got the three node chunks only. In v2, a tool event is a StreamPart with `type` `tools`.

## Delivery delay of each stream API

**Delivery delay:** the time from the moment the model server sends a token to the moment your loop sees it, on one clock.

**We measured** delivery delay on the Mac, an Apple M1 Max with 10 cores and 64 GiB, for nine ways to stream one agent. Qwen3 4B on Ollama streamed each reply through a proxy on 127.0.0.1 that stamped each line as it passed it on. Each API ran 24 times for a text reply of 80 tokens, about 32 ms apart. It also ran 24 times for one tool call followed by a one-sentence answer. Other work ran on the machine, with a load average of 1.4 to 6.2.

Eight of the nine APIs delivered the tokens one at a time, at the gaps that the server used. The median first-token delay of a text reply was 1.28 to 3.46 ms, and the worst p95 was 7.63 ms. The request reached the proxy 3.8 to 10.5 ms after the call. A claim on the web says that LangGraph streaming adds 100 to 300 ms to the first token. It does not hold here, and this manual records it as conflict D211.

The layers cost CPU time, and they add no delay that you can see. The CPU times below are indicative, not absolute costs, because other work ran on the machine. One run of 80 tokens used 63.4 ms of CPU in a plain `openai` loop and 80.3 ms in `ChatOpenAI.stream`. Through the agent it used 102.3 to 140.4 ms. A run with a tool call and a short answer used 20.1 ms in the plain loop and 41.0 to 49.0 ms through the agent.

A tool call delayed the final text only by the tool round trip. Ollama sent each tool call in one chunk, and the chunk reached the loop 1.9 to 9.4 ms after the send. On the second request, the first token reached the loop 1.74 to 3.69 ms after the send. The rose row of [figure](#fig-5-1c) is the exception.

```figure
id: fig-5-1c
kind: chart
title: first-token delivery delay of each run, by stream API
claim: Eight of the nine stream APIs deliver the first token about 2 ms after the send, and the loop that reads reasoning first waits 2,663 ms.
caption: Each row is one stream API, and each dot is one run of 80 tokens of Qwen3 4B, 24 per API, on a log scale. The tick is the median, also printed on the right. From capture/lab/summary/streaming-mac-real.json.
```

## Projections of one v3 message

**Projection:** a typed view of one v3 message, such as `message.text`, `message.reasoning`, or `message.tool_calls`, that yields its own deltas.

Issue langchain#38484 reports that a v3 consumer gets the final answer in one burst {{issue langchain#38484}}. Our runs reproduce it. The order in which the loop reads the projections sets it off, and the cause is in the projection code. The rose row of [figure](#fig-5-1c) reads `message.reasoning`, then `message.text`, as the issue does:

```listing
title: a loop that reads reasoning before text
source: capture/lab/T04-streaming-mac-real/t04_run.py
lang: python
---
    async def consume_messages(ms, label):
        async for message in ms:
            async for d in message.reasoning:
                pass
            async for d in message.text:
                rec.on_text(d, label)
```

Qwen3 4B Instruct sends no reasoning, and the reasoning loop still ends only when the message ends. Then the 80 text tokens arrive at once, 2,663 ms late at the median.

## Why the second projection waits

A v3 stream runs no background thread. The reader pulls it. When a projection such as `message.text` has no new delta in its list, its iterator runs the graph until the next event arrives {{code libs/core/langchain_core/language_models/chat_model_stream.py:247-269}} {{code libs/langgraph/langgraph/stream/run_stream.py:136-160}}. Each pulled event goes to every projection of its message. A text delta goes into the list of `message.text`, even while nobody reads that list.

A projection iterator stops only when its projection is marked done. All three projections of a message are marked done in one place, when the whole message finishes {{code libs/core/langchain_core/language_models/chat_model_stream.py:1092-1094}}. The end of the reasoning block closes that block, and it does not complete `message.reasoning` {{code libs/core/langchain_core/language_models/chat_model_stream.py:962-976}}.

So the reasoning loop cannot end before the last text token arrives. While it waits, it pulls every text delta into the list of `message.text`. When the message ends, the text loop finds all of them there at once. [Section 2.5](#s-where-each-stream-mode-comes-from) follows this path through the code.

**We measured** the cause on the x86 server guest with Qwen3 8B, reasoning on, through `create_agent`. Three sync v3 loops ran 5 times each, interleaved. Each reply had 211 reasoning deltas, then 60 text deltas. In 5 of 5 runs, the loop that read reasoning first got all 60 text deltas within 0.1 ms. The model had sent the whole reply over 8.64 to 8.89 s. 

This is one machine under load, so read it as an order. The Mac rows below give the lag as 4.0 to 8.5 s.

The loop over `message.text` alone got each delta with a median lag of 0.7 ms and a maximum of 4.9 ms. The loop over the raw events of each message had a median of 0.7 ms and a maximum of 0.9 ms.

**We measured** the same burst on the Mac with Qwen3 8B and reasoning on, five async v3 loops, 5 runs each. Each reply had 763 reasoning deltas and 62 text deltas. The loop in the order of the docs and the `asyncio.gather` loop of the issue got all 62 text deltas within 0.2 ms. That burst came 4.0 to 8.5 s after the first text delta was sent, in 10 of 10 runs. A loop over `message.text` only, and a loop over the raw events, saw each text delta at most 15.3 ms after its send. [Figure](#fig-5-1d) puts one run of Qwen3 4B on a time axis for two of the loops.

```figure
id: fig-5-1d
kind: timeline
title: when each token was sent and seen, in two async v3 loops
claim: A v3 loop that reads reasoning first sees all 80 tokens at once at 4,052 ms, and a text-only loop sees each as sent.
caption: The top pair is a loop over message.text only, and the bottom pair reads message.reasoning first. Olive ticks are sends by Qwen3 4B on Ollama, and the other ticks are the moments the loop saw a token. From capture/lab/summary/streaming-mac-real.json.
```

The order matters for the other projections too. In the tool phase, the docs loop reads `message.text` and then `message.tool_calls`. Ollama sends a call in one chunk, so with Qwen3 4B the docs loop saw the call 7.9 ms after the send at the median. Its async form saw it after 9.4 ms, and the plain loop after 1.9 ms.

**We measured** the order with a real reasoning model on the Mac: `ChatOllama` with Qwen3 4B and `reasoning=True`, 3 runs per order. With reasoning first, 484 reasoning deltas streamed live. Then all 103 text deltas arrived at one instant, 3,424 to 4,036 ms after the last reasoning delta. With text first, the text streamed, and the reasoning arrived in one burst at the end. Qwen3 8B did the same in 5 runs. With text first, its 763 reasoning deltas arrived within 2 ms at the end, 57 to 112 s late.

The reasoning examples of the LangChain streaming pages read `message.reasoning` first, and then `message.text` {{docs oss/python/langchain/streaming}} {{docs oss/python/langchain/event-streaming}}. With a reasoning model, those examples show the answer only after the whole message. The LangGraph page says to read the raw events when you need every delta in arrival order {{docs oss/python/langgraph/event-streaming}}. The raw loop of the lab does that, and it streamed every token in [figure](#fig-5-1c):

```listing
title: a loop over the raw v3 events
source: capture/lab/T04-streaming-mac-real/t04_run.py
lang: python
---
def run_v3_raw(ctx, model, scenario, tag, rec):
    run = ctx["agent"].stream_events(inp(scenario, tag), version="v3")
    for ev in run:
        if ev.get("method") != "messages":
            continue
        data = ev["params"]["data"]
        e = data[0] if isinstance(data, (list, tuple)) else data
        if e.get("event") != "content-block-delta":
            continue
        d = e.get("delta", {})
        if d.get("type") == "tool-call-delta":
            rec.on_tool(1, "raw")
        elif d.get("type") == "text-delta":
            rec.on_text(d.get("text", ""), "raw")
```

Its first tool call delta arrived 4.4 ms after the send, and its text 2.4 ms after the send.

## The consumer to write

Pick one of two shapes. When you show only the answer, read `message.text` alone. When you show the reasoning and the answer, iterate the raw events of each message and switch on the delta type. Each delta then reaches your UI in the order the model sent it. This is the loop of the x86 runs above:

```listing
title: a consumer that shows reasoning and text as they arrive
source: capture/lab/internals/05-streaming/run.py
lang: python
note: The branches of the other two loops are cut.
---
    stream = agent.stream_events({"messages": [{"role": "user", "content": PROMPT_38484}]}, version="v3")
    for message in stream.messages:
…
            for ev in message:
                if ev.get("event") == "content-block-delta":
                    delta = ev.get("delta", {})
                    kind = "reasoning" if delta.get("type") == "reasoning-delta" else "text"
                    got.append((now(), kind, delta.get("reasoning") or delta.get("text")))
```

Do not read two projections of one message one after the other. A projection that you read second always waits for the end of the message. The rule holds for `message.tool_calls` too, as the tool phase above showed. A task for each projection could also work, and [section 8.8](#s-limits-at-the-pin-and-what-comes-in-the-next-edition) lists it as not run.

A closed pull request for the issue, #38533, passed the run config to `model_.invoke` in `create_agent` {{code libs/langchain_v1/langchain/agents/factory.py:1509}}. That change does not touch the projection code. In the same agent, the text-only and raw loops already got every delta live. So do not wait for a fix in `create_agent`.

## How a real model streams a tool call

`ChatOllama` sends each tool call whole, with its id, on one chunk. Its `tool_call_chunks` entry has the full arguments as one string and the `index` `null`. An empty chunk marked `chunk_position="last"` ends the reply:

```listing
title: the chunk that carries the tool call
source: capture/out/27-stream-tool-call-chunks.txt
lang: json
note: The usage and the metadata are cut.
---
13 chunks, 1 with tool_call_chunks
…
      "tool_call_chunks": [
        {
          "name": "add",
          "args": "{\"a\": 2, \"b\": 3}",
          "id": "<uuid-2>",
          "index": null,
          "type": "tool_call_chunk"
        }
      ],
```

The kit also asked the model to write `Let me add.` before the call. Four text chunks came first, then the chunk with the call, then the empty `last` chunk. So the call never rides on the chunk marked `last`, and v3 got one `tool-call-delta` for it. A model or a fake that splits the arguments and ends on a flagged chunk loses the last piece under v3, as [section 3.4](#s-tools-toolruntime-and-tool-errors) shows.

```takeaways
- Use version="v2" and switch on part["type"], so a new mode does not change the shape.
- Expect messages mode to yield the ToolMessage as well as the model tokens.
- Pass a checkpointer only when you need checkpoints, because tasks and debug work without one.
- Add "tools" to stream_mode to get tool progress from emit_output_delta.
- Treat stream_events v3 as beta, and read message.text for content in either form.
- Test streaming against a real model, because a fake decides how a tool call is chunked.
- Read the raw v3 events, or one projection per message, when tokens must arrive live.
- Never read message.reasoning before message.text in one loop, because every projection ends with the message.
- Expect about 2 ms of delivery delay from eight of the nine stream APIs on one machine.
```

Sources: capture/s_stream.py, capture/out/21-stream-updates-values.txt, capture/out/22-stream-messages.txt, capture/out/23-stream-tasks-custom-debug.txt, capture/out/24-stream-v2.txt, capture/out/25-stream-events-v3.txt, capture/out/25-stream-events-v3.events.json, capture/out/26-stream-tools-mode.txt, capture/out/27-stream-tool-call-chunks.txt; libs/langgraph/langgraph/types.py, libs/langgraph/langgraph/pregel/main.py, and libs/langgraph/langgraph/pregel/_tools.py at langgraph 1.2.22; libs/partners/ollama/langchain_ollama/chat_models.py at langchain-ollama 1.1.0; capture/lab/summary/streaming-mac-real.json, capture/lab/T04-streaming-mac-real/real_text-per-run.jsonl, capture/lab/T04-streaming-mac-real/real_tool-per-run.jsonl, capture/lab/T04-streaming-mac-real/03-iso38484-qwen3-8b.jsonl, capture/lab/T04-streaming-mac-real/real_text-runs-excerpt.jsonl, capture/lab/T04-streaming-mac-real/real_text-server-excerpt.jsonl, capture/lab/T04-streaming-mac-real/t04_run.py, capture/lab/T04-streaming-mac-real/t04_stream_server.py, capture/lab/T04-streaming-mac-real/t04_iso_real.py; capture/lab/summary/streaming-mac.json, capture/lab/T04-streaming-mac/reasoning-ollama-runs.jsonl; capture/lab/internals/05-streaming/run.py, capture/lab/internals/05-streaming/trace.txt, capture/lab/internals/05-streaming/v3_38484.json; libs/core/langchain_core/messages/ai.py, libs/core/langchain_core/language_models/_compat_bridge.py, and libs/core/langchain_core/language_models/chat_model_stream.py at langchain-core 1.8.0; libs/langgraph/langgraph/stream/run_stream.py at langgraph 1.2.22; libs/langchain_v1/langchain/agents/factory.py at langchain==1.5.0; issue langchain#38484 and pull request #38533; docs.langchain.com at docs commit 04d4d4a (oss/python/langgraph/streaming, oss/python/langchain/streaming, oss/python/langchain/event-streaming, oss/python/langgraph/event-streaming).
