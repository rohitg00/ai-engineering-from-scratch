# Stream modes at their source, and the v3 projection buffer

> Read one v3 projection per message, or the raw events, because a loop that reads reasoning first showed a reasoning model's answer 8.8 to 9.0 s late.

You switch a chat UI to a reasoning model and to `stream_events(version="v3")`. The thinking streams live for half a minute. Then the answer appears in one block, after a pause as long as the answer itself. Your server log shows the model sent the answer token by token. The tokens were in the process all along, in a buffer you did not know you had.

When you finish this section, you can name the function that produces each stream mode and the moment in the superstep when it does. You can also explain issue langchain#38484 from the code, and write a v3 consumer that shows every token when it arrives.

## One queue, seven modes, six producers

Every stream mode of `stream()` writes to one queue. The loop drains it between task completions, and the v2 format wraps each item as a `StreamPart` with `type`, `ns`, and `data` {{code libs/langgraph/langgraph/pregel/main.py:4436-4449}}. We recorded the call stack at the moment each item went onto the queue:

| Mode | Producer | When |
|---|---|---|
| `checkpoints`, `debug` | `_prepare_tasks_and_emit_checkpoint` {{code libs/langgraph/langgraph/pregel/_loop.py:806-809}} | at the start of the next superstep |
| `tasks` | `tick` {{code libs/langgraph/langgraph/pregel/_loop.py:697-699}} | when the tasks are planned, and again with each result |
| `updates` | `put_writes`, then `output_writes` {{code libs/langgraph/langgraph/pregel/_loop.py:563-565}} | as each task finishes |
| `values` | `after_tick` {{code libs/langgraph/langgraph/pregel/_loop.py:743-745}} | after the update phase |
| `messages` | `StreamMessagesHandler.on_llm_new_token` {{code libs/langgraph/langgraph/pregel/_messages.py:175-188}} | for each model token, by callback |
| `custom` | the `stream_writer` closure {{code libs/langgraph/langgraph/pregel/main.py:2954-2967}} | when your code calls the writer |

Two rows matter in practice. `updates` arrives per task, so a slow parallel task does not hold back the update of a fast one. `values` waits for the whole superstep. One `create_agent` run with every mode on, with Qwen3 4B on the x86 server guest, shows the order:

```listing
title: every mode of one agent run, by time
source: capture/lab/internals/05-streaming/trace.txt
lang: text
note: The end of the first model step, the tools step, and the start of the answer. The rest of the run is cut.
---
     1894.5 ms  messages    AIMessageChunk chunk text='' node=model step=1
     1894.6 ms  messages    AIMessageChunk chunk text='' node=model step=1
     1894.6 ms  updates     keys=['model']
     1894.6 ms  tasks       result model
     1894.6 ms  debug       type=task_result step=1
     1895.5 ms  values      2 messages
     1895.5 ms  checkpoints step=1 next=['tools']
     1895.5 ms  debug       type=checkpoint step=1
     1895.5 ms  tasks       start tools
     1895.5 ms  debug       type=task step=2
     1899.6 ms  custom      {'progress': 'looking up Paris'}
     1899.6 ms  messages    ToolMessage chunk text='Paris: sunny' node=tools step=2
…
     2658.7 ms  messages    AIMessageChunk chunk text='The' node=model step=3
     2726.1 ms  messages    AIMessageChunk chunk text=' weather' node=model step=3
```

The first model step took 1.89 s and streamed no text, because its reply was a tool call. The tools step took 4.5 ms. The answer then streamed one token about every 67 ms. These times come from one run on a loaded guest, so read the order of the modes and not the times. [Figure](#fig-2-5) places each mode on the phases of the run.

```figure
id: fig-2-5
kind: timeline
title: where each stream mode is produced in one agent run
claim: updates, messages, and custom are produced while tasks run, values after the update phase, and checkpoints only when the next superstep starts.
caption: The x axis is milliseconds from the start of one create_agent run, in three zoomed spans with breaks between them. Each row is one stream mode, and each tick is one item. The shaded band is the tools superstep, the labels above name the model steps, and the numbers follow the notes under the axis. From capture/lab/internals/05-streaming/trace.txt.
```

## The v3 stream is pulled by the reader

`stream_events(version="v3")` runs no background thread. It runs the graph only when the reader asks for more. A projection such as `message.text` keeps a list of deltas and a cursor. When the cursor reaches the end of the list, the iterator calls `_request_more`, which runs the graph until a new event arrives {{code libs/core/langchain_core/language_models/chat_model_stream.py:247-269}} {{code libs/langgraph/langgraph/stream/run_stream.py:136-160}}. The iterator stops when the projection is marked done.

Each pulled event goes to every projection of its message. A text delta goes to the list of `message.text`, even when nobody reads that list yet.

## The cause of langchain#38484

Issue langchain#38484 reports that a v3 consumer gets the final answer in one burst {{issue langchain#38484}}. [Section 5.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) reproduced it. The code shows why.

All three projections of a message are marked done in one place, when the whole message finishes {{code libs/core/langchain_core/language_models/chat_model_stream.py:1092-1094}}. The end of the reasoning block finalizes that block, and it does not complete `message.reasoning` {{code libs/core/langchain_core/language_models/chat_model_stream.py:962-976}}. So this loop cannot leave its first `for` until the last text token has arrived:

```listing
title: the three consumer loops of the capture
source: capture/lab/internals/05-streaming/run.py
lang: python
---
    for message in stream.messages:
        if pattern == "reasoning_then_text":
            for d in message.reasoning:
                got.append((now(), "reasoning", d))
            for d in message.text:
                got.append((now(), "text", d))
        elif pattern == "text_only":
            for d in message.text:
                got.append((now(), "text", d))
        elif pattern == "raw_events":
            for ev in message:
                if ev.get("event") == "content-block-delta":
                    delta = ev.get("delta", {})
                    kind = "reasoning" if delta.get("type") == "reasoning-delta" else "text"
                    got.append((now(), kind, delta.get("reasoning") or delta.get("text")))
```

While the reasoning loop waits, it pulls the text deltas into the list of `message.text`. When the message ends, the second loop finds all of them there.

**We measured** the three loops on the x86 server guest with Qwen3 8B, reasoning on, through `create_agent`, 5 runs per loop, the loops interleaved. The send time is when the Ollama HTTP stream gave LangChain the part. Each run had 211 reasoning deltas and then 60 text deltas:

```listing
title: run 0 of each loop
source: capture/lab/internals/05-streaming/trace.txt
lang: text
---
  run 0 reasoning_then_text  emitted r/t=211/60 received r/t=211/60 text emit [31688.1, 40330.7] spread 8642.6 ms; text receive [40474.7, 40474.8] spread 0.1 ms; text lag median/max [4635.1, 8786.6]; reasoning lag median/max [0.7, 7.0]
  run 0 text_only            emitted r/t=211/60 received r/t=0/60 text emit [32307.5, 41001.4] spread 8693.9 ms; text receive [32308.2, 41002.2] spread 8694.0 ms; text lag median/max [0.7, 4.6]; reasoning lag median/max None
  run 0 raw_events           emitted r/t=211/60 received r/t=211/60 text emit [32819.0, 42027.1] spread 9208.1 ms; text receive [32819.8, 42027.8] spread 9208.0 ms; text lag median/max [0.7, 0.9]; reasoning lag median/max [0.7, 4.0]
```

In 5 of 5 runs, the loop that read reasoning first got all 60 text deltas within 0.1 ms of each other. The model had sent them over 8.6 to 8.9 s. This is one run on a loaded guest, so read it as an order. The Mac rows in section 5.1 give the lag as 4.0 to 8.5 s.

Its reasoning deltas arrived live. The text-only loop got the text with a median lag of 0.7 ms and a maximum of 4.9 ms over 300 deltas. The raw loop got them with a median of 0.7 ms and a maximum of 0.9 ms. [Figure](#fig-2-5b) puts run 0 of each loop on one axis.

```figure
id: fig-2-5b
kind: timeline
title: text deltas sent and received under three v3 consumer loops
claim: The loop that reads reasoning first gets all 60 text deltas at once, 8.8 s after the first send, and the other loops get each within 5 ms.
caption: Each pair of rows is one loop, run 0 of five. Olive ticks are sends by the model, and the lower ticks are the moments the loop got a delta. The rose band is the span in which the text waited. The reasoning ran before the shown span. From capture/lab/internals/05-streaming/v3_38484.json and capture/lab/internals/05-streaming/trace.txt.
```

A closed pull request for the issue, #38533, passed the run config to `model_.invoke` in `create_agent` {{code libs/langchain_v1/langchain/agents/factory.py:1509}}. That change does not touch this mechanism. In the same agent, the text-only and raw loops already got every delta live, so the model callbacks reach the stream without it.

## The consumer to write

Pick one of two shapes. When you show only the answer, read `message.text` alone. When you show reasoning and answer, read the raw events of each message and switch on the delta type, as the `raw_events` branch above does. Each delta then reaches your UI in the order the model sent it.

Do not read two projections of one message one after the other. The rule holds for `message.tool_calls` too, which [section 5.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) measured. A projection that you read second always waits for the end of the message.

```takeaways
- Use updates when you need each task result as soon as it exists, and values for whole states.
- Read one v3 projection per message, or iterate the raw events and switch on delta type.
- Never read message.reasoning before message.text in one loop.
- Do not expect a change in create_agent to fix langchain#38484, because the cause is in the projection.
```

Sources: capture/lab/internals/05-streaming/trace.txt, capture/lab/internals/05-streaming/run.py, capture/lab/internals/05-streaming/v3_38484.json, capture/lab/internals/common/real.py; libs/langgraph/langgraph/pregel/main.py, libs/langgraph/langgraph/pregel/_loop.py, libs/langgraph/langgraph/pregel/_messages.py, and libs/langgraph/langgraph/stream/run_stream.py at langgraph 1.2.22; libs/core/langchain_core/language_models/chat_model_stream.py at langchain-core 1.8.0; libs/langchain_v1/langchain/agents/factory.py at langchain==1.5.0; issue langchain-ai/langchain#38484 and pull request #38533.
