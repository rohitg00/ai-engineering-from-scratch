# MCP Reliability, Cancellation, and Flow Control

> A request ID correlates a message. It does not make a side effect safe, stop a worker, or protect a stream from a slow consumer.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13, Lessons 09 and 13
**Time:** ~120 minutes

## Learning Objectives

- Implement the correct cancellation signal for stdio and Streamable HTTP.
- Resolve completion and cancellation races without sending messages after cancellation.
- Separate request cancellation from durable `tasks/cancel` semantics.
- Build retry decisions from side effects and explicit idempotency keys.
- Bound progress queues while preserving final responses.
- Recover streams through reconnect, refetch, and jittered backoff.

## The Problem

The happy path hides the most expensive distributed-systems bugs.

A client calls a tool. The server starts work. Progress arrives. A proxy buffers the stream. The client reaches its timeout and disconnects. The server finishes one millisecond later. The client retries with a new JSON-RPC id. The mutation runs twice.

Every component behaved locally. The system failed globally.

MCP defines message and transport behavior, but your application still owns:

- time budgets;
- business idempotency;
- bounded queues;
- retry classification;
- durable task state;
- reconnect and refetch policy.

This lesson builds those decisions into a deterministic simulator. There are
no sleeps, sockets, or random failures. You control cancellation event order
directly. One synchronized thread test forces two ledger clients to compete
for the same idempotency key.

## Request Cancellation Is Transport-Specific

The intent is the same on every transport: the client no longer needs an in-flight result. The wire signal is different.

### stdio

stdio uses one shared bidirectional channel. A client sends a notification:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/cancelled",
  "params": {
    "requestId": 41,
    "reason": "User closed the operation"
  }
}
```

The notification is fire-and-forget. The server emits no JSON-RPC response to it.

The server should stop work, free resources, and avoid sending a response for the cancelled request. It may ignore cancellation when the request is unknown, already finished, or cannot be stopped safely.

Malformed, unknown, and already completed cancellation notifications are ignored. Turning those races into new errors would create more races.

### Streamable HTTP

Modern Streamable HTTP gives each request its own HTTP response or SSE response stream. The client cancels by closing that request's response stream.

Do not POST `notifications/cancelled` for an ordinary HTTP request. Stream closure is the cancellation signal.

Once the server observes the disconnect, it should stop work and must not send more messages for that request.

### Server-sent cancellation is narrow

A server does not use `notifications/cancelled` to cancel arbitrary client calls. On stdio, server-sent cancellation is reserved for terminating a `subscriptions/listen` request. Keep that path separate from ordinary client-request cancellation.

## Cancellation Is a Race

Two event orders are both valid.

### Cancellation wins

```text
request starts
client sends cancellation signal
server marks request cancelled
worker reaches completion
server suppresses the response
```

### Completion wins

```text
request starts
worker commits the result
server sends the response
cancellation arrives late
server ignores the late notification
```

The client must also ignore a late response for a request it already abandoned. Network latency means neither side can prove which event the other side observed first.

```figure
mcp-reliability-race
```

The lesson's `RequestCoordinator` stores one terminal state. `complete()` returns no response after cancellation. A late cancellation cannot change a completed record.

## Timeouts Need Two Clocks

A single inactivity timer is not enough.

Use two limits:

1. **Idle timeout.** How long the request may produce no useful activity.
2. **Maximum timeout.** The absolute wall-clock budget from request start.

Progress may reset the idle clock. It must never remove the maximum deadline.

```text
start: 0 ms
progress: 400 ms
progress: 800 ms
progress: 1200 ms
idle timeout: 500 ms
maximum timeout: 2000 ms
```

At 1500 ms, the request is still active because the latest progress is only 300 ms old. At 2000 ms, the maximum deadline cancels it even if another progress event arrived at 1999 ms.

Progress is optional. A server can accept a progress token and emit no updates. Never turn the presence of a token into an infinite timeout.

MCP progress values must increase. Notifications stop after completion or cancellation. Rate-limit progress so a fast worker cannot flood the transport.

## Request Cancellation Is Not `tasks/cancel`

These mechanisms solve different lifetimes.

| Mechanism | Target | Signal | What success means |
|-----------|--------|--------|--------------------|
| Request cancellation on stdio | One in-flight RPC | `notifications/cancelled` | Client abandoned the request; server should stop if practical |
| Request cancellation on HTTP | One in-flight response stream | Close the stream | Client abandoned the request; server should stop if practical |
| `tasks/cancel` | One durable Task | Ordinary MCP request | Server acknowledged cancellation intent |

A successful `tasks/cancel` result does not prove the worker stopped. The task may remain `working` until a worker checkpoint observes the flag. Work may complete before that checkpoint.

Do not erase durable task state when the HTTP connection closes. The reason to create a Task is that its lifecycle outlives one request and one connection.

## A New JSON-RPC ID Is Not Idempotency

JSON-RPC ids correlate requests and responses. They do not identify a business operation.

Suppose a client submits a charge with id `41`, loses the response, and retries with id `42`. The server sees two different messages. Without an application key, it cannot know they represent one checkout.

An idempotency key identifies the business intent:

```json
{
  "name": "charge_account",
  "arguments": {
    "account": "acct-7",
    "cents": 1200,
    "idempotencyKey": "checkout-7"
  }
}
```

The server stores:

- the key;
- a fingerprint of operation arguments;
- the committed result.

The same key and same arguments return the stored result. The same key with different arguments is rejected. This prevents accidental key reuse from mutating a different business operation.

### The ledger boundary must be atomic and durable

This sequence is unsafe:

```text
check key
run mutation
store result
```

Two workers can both observe a missing key and both run the mutation. A crash
after the effect but before the store creates the same ambiguity on retry.

The lesson uses a file-backed SQLite ledger. `BEGIN IMMEDIATE` serializes the
key check, simulated business effect, execution counter, and stored result into
one transaction. Two independent ledger connections racing with the same key
therefore observe one committed result and one execution. Closing and reopening
the ledger keeps that record.

Every return value is reconstructed from stored JSON. The caller never receives
the mutable object held by the ledger, so changing a returned dictionary cannot
corrupt later replay results.

The simulator's business effect is the receipt and execution counter inside the
same SQLite transaction. A real payment, deployment, or external API call is
not made atomic merely by writing a local table. Production needs a durable
shared database transaction, a transactional outbox, or an upstream provider
that enforces the same idempotency key. A process lock alone does not protect
multiple replicas or survive a restart.

### Retry matrix

Classify retries before implementing them.

| Class | Example | Retry rule |
|------|---------|------------|
| Safe | Deterministic read with no side effect | Retry with a new JSON-RPC id after the failure boundary is understood |
| Conditional | Mutation with a durable idempotency key | Retry with the same key and identical arguments |
| Unsafe | Mutation without business deduplication | Do not retry automatically; reconcile first |

Tool annotations such as `readOnlyHint` and `idempotentHint` remain untrusted hints. The application contract and server implementation decide retry safety.

## Backpressure Is Part of Correctness

An SSE producer can generate progress faster than a client, proxy, or network can consume it. An unbounded queue converts slowness into memory exhaustion.

Use a bounded queue and define what can be lost.

Progress is replaceable. A later progress value supersedes an earlier one for the same token. A final JSON-RPC response is not replaceable.

The lesson buffer applies this policy:

1. Coalesce adjacent progress for the same token.
2. Drop the oldest progress when capacity is reached.
3. Mark the stream as needing authoritative refetch.
4. Preserve the final response.
5. Refuse a state where preserving the final response would require dropping another final response.

This is bounded loss with explicit recovery. Silent loss is not a strategy.

### Proxy buffering

A server can stream correctly while a reverse proxy holds events in a buffer.

For an SSE response, send:

```http
Content-Type: text/event-stream
Cache-Control: no-cache
X-Accel-Buffering: no
```

The 2026 Streamable HTTP specification recommends `X-Accel-Buffering: no` so compatible proxies deliver events immediately.

For quiet long-lived streams, periodically emit an SSE comment:

```text
:
```

The client ignores comment lines. Intermediaries see traffic and are less likely to close an idle connection.

Keepalive is not progress. Do not reset an operation's semantic idle timeout merely because a transport comment arrived.

## Reconnect Means Refetch

Modern Streamable HTTP does not support resumable SSE through `Last-Event-ID`.

After a `subscriptions/listen` stream drops:

1. Open a new listen request with a new JSON-RPC id.
2. Restore the desired subscription filter.
3. Refetch affected tools, resources, prompts, or Tasks from authoritative methods.
4. Deduplicate application state by stable identifiers.
5. Do not replay an unsafe mutation just because its response was lost.

The sample recovery plan explicitly sets `sendLastEventId` to false and lists resources to refetch.

### Prevent a reconnect herd

If 10,000 clients reconnect at exactly one second, the recovering server fails again.

Use exponential backoff with jitter and a cap. The lesson computes deterministic jitter from client id and attempt number so tests remain reproducible:

```text
attempt 0: up to 250 ms
attempt 1: up to 500 ms
attempt 2: up to 1000 ms
...
cap: 8000 ms
```

Production can use cryptographically secure or runtime randomness. The invariant is distribution, not a specific formula.

## Build It

`code/main.py` builds five small reliability components.

### `RequestCoordinator`

- starts an in-flight request with idle and maximum deadlines;
- emits monotonic progress notifications;
- produces the correct stdio or HTTP cancellation signal;
- ignores invalid cancellation notifications;
- makes cancellation and completion terminal races explicit;
- reserves server-sent cancellation for stdio subscriptions.

### `MutationLedger`

- proves that two JSON-RPC ids execute twice without a business key;
- uses a file-backed SQLite transaction for the key check, simulated effect,
  execution counter, and result commit;
- deduplicates matching arguments under one idempotency key across independent
  ledger connections;
- rejects one key reused with different arguments;
- returns defensive copies and preserves committed records across reopen.

### `DurableTaskService`

- acknowledges a cancellation request;
- keeps the task `working` until a worker checkpoint;
- demonstrates why acknowledgement is not final status.

### `BoundedSseBuffer`

- coalesces or drops progress under pressure;
- records that authoritative refetch is required;
- never drops the final response.

### Recovery helpers

- return proxy-safe SSE headers and keepalive comments;
- create a reconnect and refetch plan;
- spread retries with deterministic exponential backoff and jitter.

## Use It

From the repository root:

```bash
cd phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/code
python3 main.py
python3 -m unittest discover tests -v
```

The demo runs both sides of the central race, executes a transactionally
deduplicated mutation in a temporary file-backed ledger, overloads a bounded
progress buffer, and shows a durable Task moving from acknowledged cancellation
to worker-observed cancellation.

## Interactive Lab

Run four event orderings without adding sleeps.

1. Start request `A`, cancel it, then call `complete()`.
2. Start request `B`, complete it, then deliver cancellation.
3. Start request `C`, emit progress before every idle deadline, then cross the maximum deadline.
4. Start request `D` over Streamable HTTP and close its response stream.

Record for each scenario:

- the terminal request state;
- whether a final response exists;
- the cancellation signal placed on the wire;
- which event the client should ignore.

Then change `D` to stdio. The operation is identical, but the cancellation signal must change.

## Practice Lab

Add a `reserve_inventory` mutation to `MutationLedger`.

Requirements:

1. The key binds SKU, quantity, tenant, and operation name.
2. A retry with the same key and same arguments returns the first reservation.
3. A retry with changed quantity fails without another reservation.
4. An execution that committed but lost its response can be reconciled by key.
5. The result records no secret or payment data.
6. Automatic retry is disabled when the client did not provide a key.
7. Add a simulated subscription drop and refetch the inventory record before deciding what to do next.
8. Start two ledger connections at a barrier and submit the same key
   concurrently. Assert one reservation was committed.
9. Mutate the first returned reservation object. Replay the key and prove the
   stored result did not change.
10. Close and reopen the ledger file, then reconcile the reservation by key.

Keep the lab honest: if inventory lives in another service, explain whether
that service accepts the same idempotency key or whether a transactional outbox
bridges the local commit to the remote effect.

## Shipped Artifact

`outputs/skill-mcp-reliability-reviewer.md` is a flat reliability review skill. Give it an MCP operation, transport, timeout policy, retry behavior, queue policy, and recovery plan. It returns a race table, retry classification, idempotency boundary, flow-control checks, and failure fixtures.

## Verify It

The lesson is complete when these statements are true:

- stdio cancellation sends `notifications/cancelled` and receives no response.
- Streamable HTTP cancellation closes the request stream and sends no cancellation POST.
- Cancel-before-complete suppresses the final response.
- Complete-before-cancel preserves the response and ignores the late cancellation.
- Progress can reset idle timeout but never maximum timeout.
- A new JSON-RPC id alone executes the mutation again.
- One idempotency key and identical arguments execute once under a concurrent
  two-connection race.
- A committed record survives reopen and replay returns a defensive copy.
- Mutating one returned result cannot alter the stored result.
- The bounded buffer stays within capacity and preserves the final response.
- Reconnect uses a new request, does not send `Last-Event-ID`, and refetches affected state.
- `tasks/cancel` acknowledgement leaves the task non-terminal until the worker observes it.

## Production Failure Modes

| Failure | Observable symptom | Correct response |
|---------|--------------------|------------------|
| HTTP client POSTs cancellation notification | Server and client disagree about request lifetime | Close the request's SSE response stream |
| Server responds after accepted cancellation | Client receives an unusable late result | Stop work and suppress further messages when cancellation wins |
| Progress resets every deadline | Hung work survives forever | Keep a separate absolute maximum timeout |
| New RPC id treated as deduplication | Charge, deployment, or deletion runs twice | Add a durable application idempotency key |
| Key check and effect are separate | Concurrent workers both observe a missing key | Commit key claim, effect record, and result atomically |
| In-memory ledger used across replicas | Restart or another worker forgets prior commits | Use shared durable storage or upstream idempotency |
| Stored mutable result returned directly | Caller mutation corrupts later replays | Serialize committed results and return defensive copies |
| Key reused with changed arguments | One key aliases two business intents | Store and compare an argument fingerprint |
| Unbounded progress queue | Memory rises with a slow consumer | Coalesce and drop replaceable progress within a bound |
| Final response dropped under pressure | Client cannot know the request outcome | Reserve capacity or evict progress, never the final response |
| Proxy buffers SSE | Progress arrives in bursts or after timeout | Disable buffering and configure compatible proxy timeouts |
| `Last-Event-ID` assumed | Client resumes from state the server does not support | Reconnect with a new request and refetch |
| Every client reconnects immediately | Recovery creates another outage | Use capped exponential backoff with jitter |
| Task ack treated as final cancellation | Worker keeps running after UI says stopped | Poll the Task until a terminal status |

## Capstone Connection

The tool-ecosystem capstone should treat reliability as executable evidence, not a paragraph in an architecture diagram.

Require these artifacts:

- one cancellation race transcript for each transport;
- a retry table for every exposed mutation;
- an idempotency-key record and mismatch fixture;
- a concurrent same-key transcript, a reopen check, and a mutation-alias check;
- a bounded-buffer overload result;
- reverse-proxy SSE headers and idle policy;
- a reconnect plan that names authoritative refetch methods;
- a durable Task cancellation trace when the capstone uses Tasks.

A green request in a local process proves only the happy path. The capstone is production-ready when lost responses, late cancellation, slow consumers, and reconnect herds have deterministic outcomes.

## Key Terms

| Term | Meaning |
|------|---------|
| Request cancellation | Abandonment of one in-flight MCP request |
| Cancellation race | Competition between terminal completion and cancellation events |
| Idle timeout | Limit since the last useful request activity |
| Maximum timeout | Absolute limit from request start, unaffected by progress |
| Idempotency key | Application identifier that deduplicates one business intent |
| Atomic ledger | Durable boundary that commits the key claim, effect record, and result as one unit |
| Backpressure | Control applied when producers outpace consumers |
| Progress coalescing | Replacing older progress with a newer authoritative value |
| Refetch | Reading current state again after a stream gap |
| Jitter | Deliberate variation that spreads retries across time |

## Further Reading

- [MCP Cancellation](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/cancellation)
- [MCP Progress](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/progress)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Tasks Extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)
