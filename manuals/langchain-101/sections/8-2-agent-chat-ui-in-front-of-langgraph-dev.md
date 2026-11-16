# Agent Chat UI in front of langgraph dev

> Agent Chat UI answers batched approvals only, and a typed message closes a pending approval, so the model said the tool ran in 2 of 2 trials.

You serve your agent with `langgraph dev`, and you want a chat window in front of it today. Agent Chat UI is the client that the LangGraph docs point to. You enter the server address and the graph id, and you chat. Then a reviewer types "did you send it?" instead of clicking Approve. The model answers yes, and no email left.

When you finish this section, you can connect Agent Chat UI to a local server. You can say which requests it sends and which stream modes it asks for. You can say which approval payloads it can answer, and what happens to a pending approval when the user types instead.

## What the UI needs from your graph

**Agent Chat UI:** an open source Next.js app that chats with a graph on Agent Server through the LangGraph JavaScript SDK. The docs describe a hosted copy and a local clone {{docs oss/python/langgraph/ui}}.

The repository has no release and no tag. We ran commit `0d21f7f` of `main`, with Next.js 16.4.3 and `@langchain/langgraph-sdk` 1.12.8. The server was `langgraph-cli` 0.4.43 with `langgraph-api` 0.18.0.

The setup form asks for three values. The **deployment URL** is the address of the server. The **assistant or graph id** is a key under `graphs` in `langgraph.json`. The **LangSmith API key** is optional, and a local server does not need it. The UI keeps that key in the local storage of the browser {{code src/lib/api-key.tsx:15-32}}.

The graph must keep its conversation under a `messages` key, as every `create_agent` graph does. Our graph was a `create_agent` on Qwen3 4B with two tools. `get_weather` ran freely, and `HumanInTheLoopMiddleware` held `send_email` for approval.

```listing
title: the two graphs that langgraph dev served
source: capture/lab/chat-ui-mac/code/graphs.py
lang: python
---
GATE = {"send_email": {"allowed_decisions": ["approve", "edit", "reject"]}}

agent = create_agent(model(), tools=[get_weather, send_email], system_prompt=SYSTEM,
                     middleware=[HumanInTheLoopMiddleware(GATE)])

agent_percall = create_agent(model(), tools=[get_weather, send_email], system_prompt=SYSTEM,
                             middleware=[HumanInTheLoopMiddleware(GATE, interrupt_mode="per_call")])
```

## The requests of one approval

**We measured** this on the Mac with a recording proxy between the browser and the server. The browser was headless Chromium, and the session had 15 runs. [Figure](#fig-8-2) draws the requests of one approval from that record.

On load, the UI called `GET /info` and `POST /threads/search` with the graph id as metadata and a limit of 100. That search fills the thread history list. The first message of a thread created the thread with `POST /threads`, and then started the run.

```listing
title: the body of POST runs/stream for a new message
source: capture/lab/chat-ui-mac/summary/extracts.json
lang: json
note: Cut to the options after the input.
---
   "stream_mode": [
    "values",
    "messages-tuple",
    "custom"
   ],
   "stream_subgraphs": true,
   "stream_resumable": true,
   "assistant_id": "agent",
   "checkpoint": {
    "checkpoint_id": "1f1e0efc-1319-6874-8005-0625969a5466",
    "checkpoint_ns": ""
   },
   "on_disconnect": "continue"
```

The UI code asks for `values` only. The SDK adds `messages-tuple` for the tokens and `custom` for UI events {{code @langchain/langgraph-sdk/dist/react/stream.lgp.js:545-557}} {{code @langchain/langgraph-sdk/dist/react/stream.lgp.js:148}}. The graph id goes in `assistant_id`, and the server resolves it. After every run, the UI called `POST /history` with a limit of 10.

The approval reached the UI inside a `values` event, under the key `__interrupt__`. The stream had no `updates` event. [Section 5.1](#s-streaming-v1-v2-stream-events-v3-and-the-tools-mode) explains each stream mode.

```figure
id: fig-8-2
kind: sequence
title: the requests of Agent Chat UI for one approval
claim: A message is one POST runs/stream with three stream modes, the approval returns in a values event, and Approve is a second POST with command.resume.
caption: Read from the top. Solid arrows are requests, dotted arrows are SSE events, and the amber arrow carries the interrupt. Times are from the recording proxy on the Mac. From capture/lab/chat-ui-mac/summary/chatui-mac.json.
```

## Approve, edit, and reject

The batched payload has `action_requests` and `review_configs`. The UI checks for both lists and draws a form with one text box per argument {{code src/lib/agent-inbox-interrupt.ts}}. Approve, edit, and reject each worked once, with n=1 for each.

A decision goes back as a plain resume value with a `decisions` list. The request also names the checkpoint to resume from.

```listing
title: the body of POST runs/stream for an edit
source: capture/lab/chat-ui-mac/summary/extracts.json
lang: json
note: Cut to the command and the stream options.
---
   "command": {
    "resume": {
     "decisions": [
      {
       "type": "edit",
       "edited_action": {
        "name": "send_email",
        "args": {
         "to": "lee@example.com",
         "subject": "Report",
         "body": "The report is ready. Edited by the reviewer."
        }
       }
      }
     ]
    }
   },
   "stream_mode": [
    "values",
    "messages-tuple",
    "custom"
   ],
   "stream_resumable": false,
```

The resume request sets `on_disconnect` to `cancel`, while a new message sets `continue`. The SDK picks `cancel` when the call does not ask for a resumable stream {{code @langchain/langgraph-sdk/dist/react/stream.lgp.js:357}}. So a reviewer who closes the tab during the resume cancels that run.

The tool log of the graph shows what ran. The approved call ran with the model's arguments. The edited call ran with the reviewer's body. The rejected call did not run, and the model answered "I won't send an invoice."

The edit has a display gap. The tool call card still showed the body that the model wrote, not the edited one. The middleware keeps the model's call in the AI message and swaps the arguments only when the tool runs. Only the tool result names the arguments that ran, in a note from the middleware. [Section 6.5](#s-human-in-the-loop-batched-and-per-call) shows that note.

## A per-call approval has no buttons

In per-call mode the interrupt value is a `tool_approval` object with a `response_schema`. It has no `action_requests`, so the UI check fails. The UI drew a read-only card named "Human Interrupt", with the fields and no decision control (n=1).

```listing
title: the per-call interrupt that the UI could not answer
source: capture/lab/chat-ui-mac/summary/extracts.json
lang: json
note: Cut before the response schema.
---
  "per_call, request 50": [
   {
    "value": {
     "type": "tool_approval",
     "tool_call_id": "1e1f026b-628e-4c7f-87d1-5a31a5bf9810",
     "name": "send_email",
     "args": {
      "to": "pat@example.com",
      "subject": "Hello",
      "body": "Hi Pat."
     },
```

The resume of the UI could not answer it anyway. Per-call mode wants one decision keyed by interrupt id, and the UI sends a `decisions` list. The service of the [production part](#s-approvals-and-the-idempotency-key) uses per-call mode and its own routes, so this UI cannot drive it as is.

## Typing over a pending approval

The UI lets the user type while an approval waits. Before it sends the message, it looks for an AI message whose tool calls have no tool result. For each one, it adds a tool message with the content "Successfully handled tool call." and an id that starts with `do-not-render-` {{code src/lib/ensure-tool-responses.ts:6-34}}. The chat view hides every message with that prefix.

**We measured** this once in each mode. We asked for an email, let the approval wait, and typed "Did you send the email to Max?"

```listing
title: the thread after the typed message, batched mode
source: capture/lab/chat-ui-mac/summary/extracts.json
lang: json
note: Cut to the last three messages.
---
   {
    "type": "tool",
    "id": "do-not-render-ffe0b0fe-312b-470a-9b50-a18c7b7ac6b5",
    "content": "Successfully handled tool call.",
    "tool_calls": null
   },
   {
    "type": "human",
    "id": "89f41e3f-5d09-4143-8ed2-b2430d9c4c03",
    "content": [
     {
      "type": "text",
      "text": "Did you send the email to Max?"
     }
    ],
    "tool_calls": null
   },
   {
    "type": "ai",
    "id": "lc_run--01a1df36-eb02-75cb-b5cb-1d9aa2fb8800",
    "content": "Yes, I sent the email to max@example.com.",
    "tool_calls": null
   }
```

`send_email` never ran in either trial. The thread was `idle` with no interrupt, so the approval was gone. In both modes the model said that it sent the email. The user saw that answer and no trace of the placeholder result.

So the UI decides the approval for the user. Keep the side effect safe in the tool, as the [production part](#s-approvals-and-the-idempotency-key) does with a key. In your own fork, disable the input while `thread.interrupt` is set.

## Streaming, tool calls, and time on screen

Text streamed token by token. Each token was one `messages` event, and the UI grew the reply in place. `ChatOllama` sends a tool call whole, on one chunk with the final metadata. So the tool call card appeared at once, complete, with no partial arguments.

**We measured** the delay from the proxy to the screen with a DOM observer in the page. The browser and the proxy share the clock of the Mac. The first visible change came 0.037 to 0.158 s after its SSE event reached the proxy, median 0.094 s, n=9.

For a plain question in a new thread, the first token reached the proxy 0.87 to 1.23 s after the POST, n=3. It was on screen 0.04 to 0.07 s later. The approval form came 0.145 and 0.204 s after the tool call card, n=2.

The first run waited in a queue behind another client of the same Ollama before its tool call. Do not read its time as UI time.

## Threads, history, and what leaves the machine

The history panel listed each thread by its first human message. A click on a thread sent one `POST /history` with a limit of 10. That call returned 85,940 bytes for a thread of four turns, and the full thread came back. A reload of a thread with a pending approval drew the approval form again from the same call (n=1).

Tracing was off, and no LangSmith key was set. Our hooks on `httpx` and `requests` logged 16 requests from the server, all `POST /api/chat` to the local Ollama. The browser made 97 requests, all to the UI and to the proxy. We set `NEXT_TELEMETRY_DISABLED=1`, so we did not test the default telemetry of Next.js. [Section 8.1](#s-agent-server-langgraph-dev-up-and-deploy) shows what the server sends when tracing is on.

The repository also has a passthrough route that adds your LangSmith key to each request. Its README warns that the route checks no caller. Deployed as is, it lets anyone read your threads and start runs on your account.

```takeaways
- Require approval with batched HumanInTheLoopMiddleware when Agent Chat UI must answer it.
- Expect a per-call approval to show as a read-only card with no decision control.
- Make the tool safe on its own, because a typed message closes the approval as a success.
- Read the tool result after an edit, because the tool call card keeps the model's arguments.
- Expect a resume to cancel when the tab closes, because the UI sends on_disconnect cancel.
- Put your own auth in front of the passthrough route before you deploy it.
```

Sources: capture/lab/chat-ui-mac/summary/chatui-mac.json, capture/lab/chat-ui-mac/summary/extracts.json, capture/lab/chat-ui-mac/summary/timing-summary.json, capture/lab/chat-ui-mac/runs/requests.jsonl, capture/lab/chat-ui-mac/runs/sse/, capture/lab/chat-ui-mac/runs/graph-events.jsonl, capture/lab/chat-ui-mac/runs/server-netlog.jsonl, capture/lab/chat-ui-mac/runs/browser-network.txt, capture/lab/chat-ui-mac/runs/state-batched-after-new-message.json, capture/lab/chat-ui-mac/runs/state-percall-after-new-message.json, capture/lab/chat-ui-mac/code/graphs.py, capture/lab/chat-ui-mac/code/recproxy.py, capture/lab/chat-ui-mac/code/ui_observer.js, capture/lab/chat-ui-mac/VERSIONS.txt; src/lib/api-key.tsx, src/lib/agent-inbox-interrupt.ts, src/lib/ensure-tool-responses.ts, and README.md at agent-chat-ui commit 0d21f7ff4c45287797e876dc6d8b150b6f277b1e; dist/react/stream.lgp.js at @langchain/langgraph-sdk 1.12.8; oss/python/langgraph/ui in the LangChain docs, read on 2026-11-15.
