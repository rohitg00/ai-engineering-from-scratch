# The run endpoint: StreamingResponse and one task per run

> Start each run as its own asyncio task that writes events to a queue, so the HTTP response only reads, and a client that leaves cannot cancel the run.

You put `agent.astream` inside a FastAPI route and return its chunks as server-sent events. It works until a phone loses signal halfway through a refund. When a client disconnects, Starlette cancels the task group of the response {{code starlette/responses.py:247-285}}. The cancel reaches `astream` too, because it runs in that group.

When you finish this section, you can build the shape that this part uses. A route starts a run, a task owns it, and a stream only reads. You can also say which events the client gets, and in what order.

## The service on one page

The reference service is one FastAPI app with one `create_agent` and one Postgres database. It has six routes.

| Route | What it does |
|---|---|
| `POST /threads` | creates a thread and records its owner |
| `POST /threads/{id}/runs` | starts a run with a user message, and streams its events |
| `POST /threads/{id}/approve` | answers a pending approval, and streams the rest of the run |
| `GET /threads/{id}/state` | returns the messages, the next nodes, and the pending interrupts |
| `GET /memories` | lists the notes saved for the caller |
| `GET /healthz` | reports that the process is up |

The agent has six tools, a middleware stack that [section 9.5](#s-timeouts-retries-backup-model-and-shutdown) explains, and the Postgres checkpointer and store of [section 9.2](#s-postgres-checkpointer-store-and-owner-check). The model is a setting: `ollama:<name>` or `anthropic:<name>`.

The stack has eight middleware, and three of them add nodes. [Figure](#fig-9-1b) draws the compiled graph of `build_agent` from its Mermaid text. The kit builds it with models that are never called, and with a stand-in for the OpenTelemetry module. `Tracing` and `ToolTimeout` have only wrap hooks, so the stand-in changes no node.

```figure
id: fig-9-1b
kind: structure
title: the graph of the service agent
claim: Four hook nodes from three middleware sit around model, and ModelCallLimitMiddleware can end the run before or after the model call.
caption: Read from __start__ at the top. Blue boxes are hook nodes. The other five middleware wrap the model call or the tool calls and add no node. From capture/out/54-draw-service-agent.txt.
```

## A task owns the run

**Run task:** the `asyncio` task that iterates `agent.astream` for one run and puts each event on a queue. The route starts it and returns at once. The response reads the queue.

```listing
title: the route starts a task, and the response reads its queue
source: capture/lab/prodapp-mac/code/app/server.py
lang: python
---
    async def start(self, user_id, thread_id, payload):
        if not await self.locks.acquire(thread_id):
            raise HTTPException(409, "a run is already active on this thread")
        queue = asyncio.Queue()
        task = asyncio.create_task(self.run(user_id, thread_id, payload, queue))
        self.active[thread_id] = task
        task.add_done_callback(lambda _: self.active.pop(thread_id, None))
        return queue
```

Three things come from that split. A client that disconnects ends the response, and the run task does not see it. The service keeps a list of active tasks, so a shutdown can wait for them, as [section 9.5](#s-timeouts-retries-backup-model-and-shutdown) shows. The thread lock is taken before the task starts and released in its `finally`. So a second run on the same thread gets 409 at once.

```listing
title: the run task releases the lock, then sends done
source: capture/lab/prodapp-mac/code/app/server.py
lang: python
---
    async def run(self, user_id, thread_id, payload, queue):
        status, started = "cancelled", time.perf_counter()
        try:
            status = await self.traced(user_id, thread_id, payload, queue)
        finally:
            seconds = round(time.perf_counter() - started, 4)
            event("run.end", thread_id=thread_id, status=status, seconds=seconds)
            await self.locks.release(thread_id)
            queue.put_nowait(("done", {"status": status, "seconds": seconds}))
            queue.put_nowait(None)
```

The order in the `finally` matters. The lock is released before `done` is sent. Otherwise a client that starts its next run when it reads `done` can race the release and get a 409.

**We measured** what a client that leaves does to a run, on the Mac with Qwen3 4B, five trials. Each trial asked a FAQ question and closed the connection after the first SSE event, 245 to 1910 ms after the request. It then posted a second message to the thread at once, and read the state until the run ended.

- The second post got 409 in 5 of 5 trials, because the first run still held the thread.
- The run finished in 5 of 5 trials, with status `done` after 3.56 to 4.71 s. Each thread ended with the human message, a `search_faq` call, its result, and a final answer.

## The events on the stream

The run task asks `astream` for two stream modes at once, `messages` and `updates`, with `version="v2"`. It turns each part into `token`, `tool_call`, `tool_result`, or `interrupt`. The run task adds `done` at the end, and `error` when the run raises.

```listing
title: how stream parts become SSE events
source: capture/lab/prodapp-mac/code/app/server.py
lang: python
---
def to_events(part):
    if part["type"] == "messages":
        chunk, meta = part["data"]
        if chunk.type == "AIMessageChunk" and chunk.text and meta.get("langgraph_node") == "model":
            yield "token", {"text": chunk.text}
        return
    for node, update in part["data"].items():
        if node == "__interrupt__":
            for item in update:
                yield "interrupt", {"id": item.id, **item.value}
            continue
        if node not in ("model", "tools") or not isinstance(update, dict):
            continue
```

The filter on the node name is there for a reason. The summarization middleware runs as a node of its own. Its update removes every message and writes the summary and the kept messages back {{code libs/langchain_v1/langchain/agents/middleware/summarization.py:551-557}}. So it repeats AI messages that the client has already seen. Without the filter, a client would get those `tool_call` events again. Tokens come only from the `model` node, so the text of a summary never reaches the client.

**We measured** one conversation of three requests on the Mac with Qwen3 4B, and recorded the time that each event reached the client. The model was already loaded.

| Request | First event | Events, in order | `done` |
|---|---|---|---|
| order question | `tool_call` at 682 ms | `tool_call`, `tool_result` at 698 ms, 30 tokens from 1016 ms | 1527 ms |
| refund of 8900 cents | `tool_call` at 2090 ms | `tool_call`, `interrupt` at 2122 ms | 2125 ms, status `interrupted` |
| approve | `tool_result` at 32 ms | `tool_result`, 38 tokens from 765 ms | 2158 ms |

Each `tool_call` event reached the client within 30 ms of the end of its model call. The approval request was one `interrupt` event, and the stream ended 3 ms after it with `done` and status `interrupted`. The approve request skipped the model: its first event was the refund result, 32 ms after the request.

The first request of an earlier capture, sent right after the drain trials had used Qwen3 14B, took 15.42 s. Its first model call took 13.4 s while Qwen3 4B loaded again. Keep the model loaded on a shared server, or the first customer after a switch waits for it.

```figure
id: fig-9-1
kind: timeline
title: three requests, the spans of each run, and the events the client read
claim: The client read each tool call when its model call ended, and the approval request arrived as one interrupt event that ended the stream.
caption: Each panel is one HTTP request, in milliseconds after it was sent. The upper row is the run task, with model and tool spans. The lower row is the client, with each SSE event at the time it arrived. From capture/lab/prodapp-mac/summary/stream-mac.json.
```

## A heartbeat while a run waits

A run can wait a long time before its first event, for example behind other runs at the model server. Until then the stream sends no byte, and an HTTP client counts that as a dead connection. The service writes an SSE comment line when no event has come for 15 s. A client must ignore lines that start with a colon, so the comment carries no data.

```listing
title: the stream reader, with a comment line every 15 s of silence
source: capture/lab/prodapp-mac/code/app/server.py
lang: python
---
HEARTBEAT = float(os.environ.get("HEARTBEAT_SECONDS", "15"))


async def sse(queue):
    while True:
        try:
            item = await asyncio.wait_for(queue.get(), HEARTBEAT) if HEARTBEAT > 0 else await queue.get()
        except TimeoutError:
            yield ": waiting\n\n"
            continue
        if item is None:
            return
        name, data = item
        yield f"event: {name}\ndata: {json.dumps(data, default=str)}\n\n"
```

**We measured** the 50-user load cell of [section 9.7](#s-workers-the-advisory-lock-and-cost) again, with one worker and Qwen3 4B on the Mac, one run. The clients kept their read timeout of 120 s.

| | Requests | Client read timeouts | Runs the clients saw end | Runs the server ended | Median and max s per run |
|---|---|---|---|---|---|
| without a heartbeat | 157 | 48 | 107 | 155, of which 19 `cancelled` at shutdown | 164.7 and 193.8 |
| with a heartbeat | 200 | 0 | 192 | 192, none cancelled | 194.8 and 286.7 |

With the heartbeat every session sent all four requests, and the slowest run took 286.7 s with no timeout. The other 8 requests were approves that got 409, because the model had proposed no refund. The runs took longer because more of them reached the model, and the server still finished 0.231 runs each second.

The Mac was loaded for this run, at a load average of 32.78. Read the seconds as upper bounds and the counts as the result. The heartbeat keeps a client attached. It does not make the model faster.

```figure
id: fig-9-1c
kind: comparison
title: what 50 clients saw, without and with a heartbeat on the stream
claim: With a comment line every 15 s, 0 of 200 requests timed out, against 48 sessions lost to read timeouts without it.
caption: Each bar is one run of the load cell with 50 users and one worker. The parts are the requests that ended done, interrupted for approval, rejected with 409, and lost to a client read timeout. From capture/lab/prodapp-mac/summary/fix-mac.json.
```

```takeaways
- Run each agent run in its own asyncio task, and stream from a queue that the task fills.
- Keep a registry of active run tasks, so shutdown can wait for them.
- Release the thread lock before you send the done event.
- Send tool events from the model and tools nodes only, so summaries do not repeat them.
- Answer 409 while a thread has a pending approval or an active run.
- Send an SSE comment line when a run has been silent for 15 s.
```

Sources: capture/lab/prodapp-mac/code/app/server.py, capture/lab/prodapp-mac/code/app/agent.py, capture/out/54-draw-service-agent.txt, capture/s_draw.py, capture/lab/prodapp-mac/code/scripts/capture_stream.py, capture/lab/prodapp-mac/code/scripts/disconnect_real.py, capture/lab/prodapp-mac/summary/stream-mac.json, capture/lab/prodapp-mac/summary/disconnect-mac.json, capture/lab/prodapp-mac/runs/stream/stream-events.jsonl, capture/lab/prodapp-mac/runs/stream/stream.spans.jsonl, capture/lab/prodapp-mac/runs/disconnect/disconnect-trials.json, capture/lab/prodapp-mac/summary/fix-mac.json, capture/lab/prodapp-mac/runs/fix/load/load-summary.json, capture/lab/prodapp-mac/runs/load/load-summary.json; libs/langgraph/langgraph/pregel/main.py at langgraph 1.2.22; starlette/responses.py at starlette 1.10.0.
