# Notification Routing Table

A one-page reference for the MCPA "Interactions and Execution" domain, aligned to MCP 2026-07-28.

## Two channels, never mixed

| Channel | Opened by | Tag every message carries | Notification methods |
|---|---|---|---|
| Listen stream | `subscriptions/listen` (a request) | `_meta["io.modelcontextprotocol/subscriptionId"]`, equal to the listen request id | `notifications/subscriptions/acknowledged`, `notifications/tools/list_changed`, `notifications/prompts/list_changed`, `notifications/resources/list_changed`, `notifications/resources/updated` |
| A request's own response | Any ordinary request | Nothing shared across requests; `progress` carries `progressToken`, `message` requires that request's own `logLevel` | `notifications/progress`, `notifications/message` |

## Opening and closing a subscription

1. Client sends `subscriptions/listen` with a `notifications` filter: `toolsListChanged`, `promptsListChanged`, `resourcesListChanged` (booleans), and `resourceSubscriptions` (a URI list).
2. The server's first reply on that stream is `notifications/subscriptions/acknowledged`, echoing the granted subset and the subscription id, which equals the listen request's own id. Nothing else is sent before it.
3. Every later message on the stream repeats that same subscription id, which is how a client demultiplexes several open subscriptions sharing one channel.
4. A subscription ends by client cancellation (close the SSE stream on HTTP, or send `notifications/cancelled` on stdio), by server-initiated graceful closure (a `complete` result on the original listen request, subscription id in `_meta`), or by an abrupt transport drop, which carries no message at all.
5. On stdio, a reconnect after a crash or restart carries no memory: the client resends `subscriptions/listen`, with a fresh id, to rebuild every stream it still wants.

## Progress

- The client opts in with `_meta.progressToken` (a string or integer, unique among its own active requests).
- `progress` must strictly increase with every notification, even if `total` is unknown; `total` and `message` are optional.
- Notifications stop once the request completes; both sides should rate-limit rather than flood the channel.
- Progress never carries a subscription id and never appears on a listen stream.

## Cancellation by transport

| Transport | How the client cancels | What the server sends |
|---|---|---|
| Streamable HTTP | Closes the request's SSE response stream | Nothing; the closed stream is the cancellation signal by itself |
| stdio | Sends `notifications/cancelled` with `requestId` and an optional `reason` | Nothing for an ordinary request; `notifications/cancelled` only to tear down a listen stream the server itself is ending |

## Races are normal, not errors

A message generated before a cancellation takes effect can still arrive after the receiver has already stopped tracking it. Neither side treats this as a failure: the sender may find there is nothing left to cancel, and the receiver drops a message it no longer recognizes instead of routing it anywhere.

## Remember for the exam

- Progress and the deprecated logging `message` notification never carry a subscription id; a subscription notification always does.
- A server may originate `notifications/cancelled` for exactly one reason: tearing down a subscription stream it is ending. Never for anything else.
- `resources/subscribe` and `resources/unsubscribe` do not exist in 2026-07-28; watch a resource through `subscriptions/listen` with `resourceSubscriptions`.
- Closing a stdio process is not itself a cancellation; on stdio, cancellation is always an explicit `notifications/cancelled` message naming the request.
- A graceful closure result and an abrupt transport drop are different signals; only the first tells the client the subscription ended cleanly.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 8.
