# The Subscription Stream: Notifications, Progress, and Cancellation

> A notification never gets a reply, so it has to say on its own which conversation it belongs to: the long-lived stream that opened it, or the one request that is still waiting on it.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 15
**Time:** ~45 minutes

## Learning Objectives

- Tell a notification from a request and explain why the receiver must never answer one
- Open a subscriptions/listen stream, read its acknowledgment, and demultiplex the notifications it carries by subscriptionId
- Separate stream notifications (list changed, resource updated) from request scoped notifications (progress, message) by the channel each one travels on, not by guessing
- Track a progress notification's token and total, and explain why its progress value must keep increasing
- Cancel a request or a subscription on each transport, and handle the race between a cancellation and a message that was already on its way

## The Problem

Most of MCP is one request, one reply. A client asks, a server answers, and the exchange is done. That shape does not fit everything a server needs to tell a client. Some information is ongoing: the tool list changed, a subscribed resource was written, a prompt was added. A single reply cannot carry "keep telling me about this," because a reply closes the request it belongs to. Other information is ambient: a call that takes thirty seconds can usefully report that it is a fifth of the way done, but that report is not the answer, it is commentary while the answer is still being computed. And sometimes the client changes its mind after a request or a subscription is already running, with no session to hang a cancel flag on. The stateless core from lesson 04 means the server was never keeping a private place open for this one connection to begin with, so cancellation has to work the same way everything else does: as a message, addressed by id, that stands on its own.

MCP answers the ongoing case with a stream the client opens on purpose, `subscriptions/listen`, and the ambient case with a notification tied to the one request that produced it, `notifications/progress` and, from the deprecated logging feature covered in lesson 15, `notifications/message`. All of these are plain JSON-RPC notifications: a method and params, no id, never answered. What separates them is which channel carries them and how a receiver tells one from another when several are running at the same time.

## The Concept

A notification, recall from lesson 03's envelope, is the one JSON-RPC shape with no `id`. It cannot be a reply to anything specific and the receiver must not send one back. That single rule already explains why MCP needs two different homes for notifications. A request's response channel exists only while that request is open, so anything scoped to a single call, like its progress, naturally rides there. Nothing scoped to a single call can explain an ongoing change like "the tool list is different now," because there may be no call in flight when that happens. For that, the protocol needs a channel that outlives any one request: a stream, opened by its own request and kept alive on purpose.

`subscriptions/listen` opens that stream. The client sends an ordinary request whose `params.notifications` field is a filter: `toolsListChanged`, `promptsListChanged`, and `resourcesListChanged` are booleans, and `resourceSubscriptions` is a list of URIs to watch for updates. A server must never send a notification type the client did not ask for, and it is free to grant less than it was asked for when it does not support a type at all.

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "subscriptions/listen",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {}
    },
    "notifications": {
      "toolsListChanged": true,
      "resourceSubscriptions": ["file:///project/config.json"]
    }
  }
}
```

The very first message the server sends back on that stream, before anything else, is `notifications/subscriptions/acknowledged`. It carries the subset of the filter the server actually honors, and, in `_meta["io.modelcontextprotocol/subscriptionId"]`, the id of the `subscriptions/listen` request that opened the stream, here `7`. That is the whole demultiplexing scheme: every later message belonging to this stream, the acknowledgment and every notification after it, repeats that same subscription id. A client with two subscriptions open on one stdio channel, or several open on separate HTTP streams, tells them apart purely by reading this field, because a transport connection is not a subscription and a subscription is not a connection.

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/subscriptions/acknowledged",
  "params": {
    "_meta": {"io.modelcontextprotocol/subscriptionId": 7},
    "notifications": {"toolsListChanged": true, "resourceSubscriptions": ["file:///project/config.json"]}
  }
}
```

After the acknowledgment, four more notification methods can travel on that same stream, always tagged the same way: `notifications/tools/list_changed`, `notifications/prompts/list_changed`, `notifications/resources/list_changed`, and `notifications/resources/updated`, which carries the `uri` that changed. Nothing else belongs there. `notifications/progress` and `notifications/message` are request scoped: they answer to the one call that asked for them, never to a subscription, and they never carry a subscription id. Progress instead carries `progressToken`, a value the client picks and that must be unique among its active requests, plus a `progress` number that must strictly increase with every notification even when the total is unknown, and optional `total` and human readable `message` fields. A server may send progress at whatever pace it wants, or not at all, but it must stop once the request finishes, and both sides should rate-limit rather than flood the channel. `notifications/message`, the deprecated logging notification from lesson 15, only appears on a request that set a log level in its own `_meta`; without that key the server must not send it.

Cancellation splits by transport instead of by message shape. On Streamable HTTP, closing the SSE response stream for a request is the cancellation signal by itself; no notification is sent or expected. On stdio, where there is no separate per-request stream to close, the client sends `notifications/cancelled` with the `requestId` it wants stopped and an optional `reason`. The one case where a server originates `notifications/cancelled` itself is to tear down a `subscriptions/listen` stream it is ending; a server must never send that notification for any other purpose, so seeing one from a server is itself a strong signal about what kind of stream just closed.

A subscription can also end gracefully. Its `subscriptions/listen` request is, formally, still an open JSON-RPC request the whole time the stream is alive. When a server decides to end a subscription on its own initiative, such as during a shutdown, it should answer that original request with a result, `resultType` complete, the same subscription id in `_meta`, before it closes the stream. That result is what lets a client tell "this stream ended cleanly" apart from "the transport just disappeared," which carries no such message at all. Because cancellation and delivery are two independent things happening at once, a notification generated moments before a cancel takes effect can still arrive after the receiver has already stopped tracking that id. Both sides are expected to tolerate this rather than treat it as an error: the sender may have nothing left to cancel, and the receiver simply drops a message it no longer recognizes instead of routing it anywhere.

One more consequence of statelessness shows up here directly. If a stdio process restarts, the new server process holds no memory of subscriptions the old one had open; the client must resend `subscriptions/listen`, with a fresh id, to rebuild each stream it still wants. Nothing is resumed, nothing is replayed from before the restart, because there is no session for the server to have kept it in.

```figure
mcpa-16-subscription-stream
```

## Interactive Lab

The figure lays a client and a server side by side and follows one scenario down the page. Two `subscriptions/listen` requests open, each acknowledged first with its own id in `_meta`, and the notifications that follow are tagged the same way, so the tools-and-config subscription and the resources-only subscription never get confused even though they share the same channel. Underneath, a separate `tools/call` runs its own request and reply, with its own progress ticks in between; none of those three progress notifications carry a subscription id, because they belong to that call, not to either stream. Near the bottom, the client cancels the second subscription, and a stray update for it that was already in flight arrives anyway and is dropped rather than delivered. Read the figure once for the shape, then trace which field, subscription id or progress token, would let you write code that never mixes these channels up.

## Practice Lab

Open `code/main.py`. `SubscriptionServer` tracks each open `subscriptions/listen` request as a `Subscription` with the notification types it actually granted, and exposes `resource_updated`, `list_changed`, `cancel`, and `close_gracefully` as the only ways to produce a stream message, each one refusing to emit anything once a subscription is closed or was never granted that type. `call_long_job` answers an ordinary `tools/call` and, if the request carried a `progressToken`, returns a short run of progress notifications alongside the final result, completely separate from any subscription. `SubscriberClient` sends `subscriptions/listen`, records the acknowledgment, and demultiplexes everything that follows through `receive_stream`, which only accepts a notification whose subscription id the client still recognizes locally.

```bash
python3 code/main.py
```

Read the printed transcript against the concept section. Find the two acknowledgments and confirm each subscription id equals the id of the `subscriptions/listen` request that produced it. Find the three progress notifications for the `run_build` call and confirm none of them carries `_meta` at all. Find the cancellation near the end and the wrapped entry right after it, a `resources/updated` notification for the subscription that was just cancelled, marked as a deliberate violation because the client must drop it rather than deliver it. Then try opening a third subscription for `promptsListChanged`, call `list_changed` for it, and watch it come back `None`, because this server never declared a prompts capability to grant it against.

## Shipped Artifact

`outputs/notification-routing-table.md` is a one-page reference mapping every notification method in this lesson to its channel, its required fields, and the rule that governs it: which four methods only ever appear on a listen stream, which two are request scoped and why, and what a client should do on each transport when it wants to cancel something. Keep it next to the error code table from a later lesson as the two references you reach for when a transcript's notifications need decoding under time pressure.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: that the acknowledgment is the first message on a stream and carries the listen request's id as its subscription id, that the acknowledgment only echoes the notification types the server actually grants, that an unrequested or ungranted type is never sent, that progress values strictly increase and never carry a subscription id while genuine stream notifications always do, that cancelling a subscription stops the server from producing anything further for it, that a message already in flight when a cancellation lands is dropped rather than delivered, that a graceful closure result carries the subscription id and that closing twice is a no-op, and that two concurrent subscriptions are demultiplexed correctly by id. The repository's wire checker also validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/16-notifications-and-subscriptions
```

## Capstone Connection

The capstone's long-running step needs exactly this vocabulary: a progress-bearing call that is not a subscription, told apart from the tasks extension in a later lesson by the absence of a `taskId`, and a listen stream whose notifications it must route by subscription id rather than by guesswork. When the capstone scenario cancels something mid-flight, it is this lesson's transport split, an SSE stream closing on HTTP versus a `notifications/cancelled` notification on stdio, that decides what message, if any, appears on the wire.

## Key Terms

| Term | Meaning |
|------|---------|
| Notification | A JSON-RPC message with no id that is never answered |
| `subscriptions/listen` | The request that opens a long-lived stream of notifications |
| Subscription id | The listen request's own id, echoed in every message that stream carries |
| Stream notification | `list_changed` or `resources/updated`, delivered only on a listen stream |
| Request scoped notification | `progress` or `message`, delivered only on the response channel of the request it describes |
| `progressToken` | A client-chosen value, unique among its active requests, that ties progress updates to one call |
| Graceful closure | A `complete` result on the original listen request that signals a clean end, unlike an abrupt transport drop |
| `notifications/cancelled` | The stdio cancellation message; the only purpose a server may use it for is tearing down a listen stream |

## Further Reading

- [MCP message patterns](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns), the overview of requests, MRTR, and subscribe-and-notify
- [Subscriptions](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions)
- [Progress](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/progress)
- [Cancellation](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/cancellation)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 8
- `phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control`, which goes deeper on timeouts and flow control around these same messages
