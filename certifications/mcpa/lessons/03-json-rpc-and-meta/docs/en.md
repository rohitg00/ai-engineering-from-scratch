# The JSON-RPC Envelope

> A server that has never talked to you before still has to know, from this one message alone, whether you expect an answer, which protocol version you speak, and where your metadata ends and your arguments begin.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 02
**Time:** ~45 minutes

## Learning Objectives

- Classify any 2026-07-28 message on the wire as a request, a notification, a result response, or an error response, and state the id rule that makes each one what it is
- Explain what resultType means, why complete and input_required are the two core values, and how a client must treat an unrecognized or an absent one
- Validate a `_meta` key name against the prefix and name grammar, and tell a reserved MCP prefix from a merely similar one by checking its second label, not its first
- Name the reserved `_meta` keys a request, a notification, and a result each carry, and the one exception the prefix rule makes for OpenTelemetry trace context
- Explain why a request missing a required `_meta` field is rejected with `-32602`, and why no two MCP messages ever travel together in one batch

## The Problem

Lesson 02 showed one client discovering two servers it had never seen before and calling a tool on each. Underneath that exchange sits a smaller, sharper question the exam expects you to answer without hesitating: handed an arbitrary bag of JSON that just arrived over stdio or landed in a Streamable HTTP POST body, what kind of message is it, and what is a receiver allowed to assume about it?

JSON-RPC 2.0 gives MCP four shapes to choose from, and the specification is strict about how a receiver tells them apart, because a stateless server has no connection-level agreement to fall back on. There was never an opening handshake that pinned down "this connection speaks version X" or "this stream only carries requests from client Y." Every message has to carry enough of its own identity that a receiver processing it in isolation, quite possibly on a completely different replica of the server than the one that handled the message before it, reaches the same conclusion every time.

That self-description happens on two layers. The outer layer is the envelope itself: is this a request that expects a reply, a notification that does not, a result that finished the job, or an error that did not? Get the `id` field wrong and a server cannot tell a request from a notification, or a client cannot match a response back to the call that produced it. The inner layer is `_meta`, the property a request, a notification, or a result can use to carry protocol-level facts, such as which protocol version a request claims to speak, without those facts colliding with whatever the application itself happens to call `version` or `capabilities` in its own arguments. Get the `_meta` naming rules wrong and a server-specific field can silently shadow, or be shadowed by, a field the protocol itself depends on.

## The Concept

**Four shapes, one rule each.** A request carries `id`, `method`, and optional `params`; the id must be a string or an integer, must never be `null`, and must not repeat an id the sender is still waiting to hear back about.

```json
{"jsonrpc": "2.0", "id": 7, "method": "tools/call", "params": {"name": "get_weather", "arguments": {"location": "Pune"}}}
```

A notification carries `method` and optional `params`, and must not include an `id` at all. The receiver must not send any reply, ever, success or failure.

```json
{"jsonrpc": "2.0", "method": "notifications/progress", "params": {"progressToken": 7, "progress": 1, "total": 2}}
```

A result response echoes the request's `id` and carries a `result` object. That object must include a `resultType` field.

```json
{"jsonrpc": "2.0", "id": 7, "result": {"resultType": "complete", "content": [{"type": "text", "text": "Pune: sunny, 26C"}], "isError": false}}
```

An error response also echoes the request's `id`, except in the one case where the id could not be read at all because the request itself was too malformed to parse; it carries an `error` object with an integer `code` and a string `message`, and may add a `data` field.

```json
{"jsonrpc": "2.0", "id": 3, "error": {"code": -32602, "message": "Missing required _meta field(s): io.modelcontextprotocol/protocolVersion"}}
```

**resultType tells the client how to read what follows.** A value of `"complete"` means the result holds the final content and there is nothing more to do. A value of `"input_required"` means the result is an `InputRequiredResult`, the shape the multi round-trip pattern uses to ask the client for more before the original call can finish; that retry mechanic is its own lesson later in this route. Extensions may register further values, such as `"task"` for long-running work, but only when the client has advertised the matching capability. A client that receives a resultType it does not recognize must treat the result as invalid rather than guess at its shape, and a client talking to a server on an earlier protocol version that never sent resultType at all must treat the missing field as `"complete"`, which is the one piece of backward compatibility this otherwise strict rule makes room for.

**`_meta` keeps protocol facts out of the application's own namespace.** A `_meta` key has two parts: an optional prefix, and a name. When present, the prefix is one or more dot-separated labels followed by a slash; each label starts with a letter, ends with a letter or a digit, and may use letters, digits, or hyphens in between. The name, when non-empty, starts and ends with an alphanumeric character and may use letters, digits, hyphens, underscores, and dots in between. A prefix is reserved for MCP's own use whenever its second label, not its first, is `modelcontextprotocol` or `mcp`. That single word, second, is where most exam traps live: `io.modelcontextprotocol/protocolVersion` and `dev.mcp/anything` are both reserved, because `modelcontextprotocol` and `mcp` sit in the second position. `com.example.mcp/scanId` is not reserved, because its second label is `example`; `mcp` only shows up third. A key such as `mcp.example/thing`, where `mcp` is the first label and nothing reserved sits second, is not reserved by this rule either. Implementations are encouraged to use reverse DNS notation for their own prefixes, such as `com.example/` rather than `example.com/`, precisely so a namespace collision is a choice, not an accident.

**Every request states its own version and capabilities; every result may say who answered.** Three `_meta` keys under `io.modelcontextprotocol/` matter on every request: `protocolVersion` (a string, required), `clientCapabilities` (an object, required, and allowed to be empty), and `clientInfo` (an `Implementation` naming the client, not strictly required but expected on every request unless a client is deliberately configured to omit it). A fourth, `logLevel`, opts a single request into log notifications for the deprecated logging feature; a later lesson on deprecated client features covers it in full. A request missing either required field is malformed, and a conformant server must reject it with JSON-RPC error `-32602` and, on an HTTP transport, a `400 Bad Request` status. On the way back, a server should attach `io.modelcontextprotocol/serverInfo` to a result's `_meta` so the response names the implementation that produced it. Both `clientInfo` and `serverInfo` are self-reported by whichever side sends them and are never verified by the protocol; they exist for display, logging, and debugging, and a server or a gateway that lets either one influence an authorization or routing decision has confused a courtesy field for a credential.

**A short list of other keys is reserved outright.** `progressToken`, carried without any prefix, opts a request into progress notifications. `io.modelcontextprotocol/subscriptionId` appears on every notification delivered over a `subscriptions/listen` stream so the client can tell which subscription produced it, a mechanic a later lesson on notifications and subscriptions builds out fully. The keys `traceparent`, `tracestate`, and `baggage` are the one deliberate exception to the prefix rule: OpenTelemetry's own trace-context convention expects those exact bare names, so MCP reserves them without a namespace prefix rather than break interoperability with existing tracing tooling, a choice documented in SEP-414.

**No message ever travels with company.** JSON-RPC batching was removed from MCP in the 2025-06-18 revision and has not returned. On Streamable HTTP, one POST body carries exactly one request or one notification; on stdio, one newline-delimited line carries exactly one message. If a client has three requests ready to go, it sends three POST bodies, not one array of three.

```figure
mcpa-03-envelope
```

## Interactive Lab

The figure's top row lines up the four shapes side by side with the field each one lives or dies by: a request's non-null id, a notification's complete absence of one, a result's resultType, an error's code and message. The bottom half zooms into a single `_meta` key twice, splitting each one at the slash into its labels and its name. `io.modelcontextprotocol/protocolVersion` highlights its second label, `modelcontextprotocol`, to show why it is reserved. `com.example.mcp/scanId` highlights its second label too, but that label is `example`, so nothing is reserved even though `mcp` does appear later in the string. Read the two highlighted rows side by side and the trap explains itself: position, not presence, decides whether a prefix belongs to MCP.

## Practice Lab

Open `code/main.py`. It has no network calls and no SDK, just the message shapes this lesson teaches. `classify_message` looks at a raw dict and returns `"request"`, `"notification"`, `"result"`, `"error"`, or `"invalid"`, using exactly the id rule described above: a `method` with no `id` is a notification, a `method` with a well-formed id is a request, and a `method` with a `null` id is neither, so it comes back invalid. `meta_key_status` takes a key string and returns `"reserved"`, `"free"`, or `"invalid"`, applying the prefix grammar and the second-label rule to decide.

```bash
python3 code/main.py
```

Read the printed classification list against the concept section first, then watch `run_scenario` play out a short exchange: a well-formed `tools/call` request answered with a complete result, a `notifications/progress` notification that gets no reply, and three deliberate mistakes the wire checker treats as violations rather than as real traffic, each labeled with the reason it is wrong. One is a notification carrying an id it should never have. One is a request whose id is `null`. One is a request whose `_meta` is missing entirely; that one is followed by the real `-32602` error a conformant server sends back, produced by the same `handle_request` function the well-formed call used. Change the missing field to `clientCapabilities` instead of `protocolVersion` and rerun to see the error message name the other key.

## Shipped Artifact

`outputs/message-shapes-reference.md` is a one-page reference for the four message shapes, the resultType values, the `_meta` grammar with the second-label test spelled out, and the full reserved-key table, each row citing the brief. Keep it open while reading raw MCP traffic; it answers "is this shape valid" and "is this key mine to use" faster than paging back through the specification.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: all four shapes classify correctly, a null request id and an id-bearing notification are both rejected, a result without resultType is flagged, `io.modelcontextprotocol/protocolVersion` and `dev.mcp/anything` come back reserved while `com.example.mcp/anything` comes back free, the four bare reserved keys are recognized, a malformed key name is invalid, a request missing `protocolVersion` or missing `clientCapabilities` each comes back as `-32602`, a well-formed request completes normally, and every unwrapped result in the transcript carries a resultType. The repository's wire checker validates the same transcript against the full set of 2026-07-28 rules, including how the three deliberate violations are wrapped:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/03-json-rpc-and-meta
```

## Capstone Connection

Lesson 04 builds statelessness directly on top of the envelope this lesson defines: a server can only treat every request as self-contained because every request already carries its own version and capabilities in `_meta`, with nothing left over to infer from the connection. Lesson 18's error taxonomy assumes you already know that `-32602` is the code a malformed `_meta` produces and that an error response's `data` field is optional. The capstone's end-to-end exchange opens with a request built exactly like the one in this lesson's practice lab, `_meta` and all, and nothing later in the route works if that first envelope is wrong.

## Key Terms

| Term | Meaning |
|------|---------|
| Request | A message with `id`, `method`, and optional `params`; expects exactly one reply |
| Notification | A message with `method` and optional `params`, never an `id`; gets no reply |
| Result response | A reply that echoes the request id and carries a `result` object with resultType |
| Error response | A reply that carries an `error` object with an integer `code` and a string `message` |
| resultType | The field naming what kind of result this is: complete, input_required, or an extension value |
| `_meta` | The property carrying protocol-level metadata, keyed by an optional dotted prefix plus a name |
| Reserved prefix | A `_meta` prefix whose second dot-separated label is `modelcontextprotocol` or `mcp` |
| protocolVersion | The required `_meta` field naming the protocol version a request speaks |
| clientCapabilities | The required `_meta` field naming the capabilities relevant to one request |
| Self-reported field | clientInfo and serverInfo: sender-supplied identity, never verified, never a security signal |

## Further Reading

- [MCP specification 2026-07-28, Base Protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic), especially Messages and the `_meta` general field
- [SEP-414, OpenTelemetry trace context in `_meta`](https://modelcontextprotocol.io/seps/414-request-meta)
- [TypeScript schema, source of truth for every message shape](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/schema/2026-07-28/schema.ts)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 2 and 3
