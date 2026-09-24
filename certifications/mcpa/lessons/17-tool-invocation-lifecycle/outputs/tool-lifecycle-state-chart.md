# Tool Invocation Lifecycle State Chart

A one-page reference for the MCPA "Interactions and Execution" domain, aligned to MCP 2026-07-28. Keep it next to a client or server implementation while writing lifecycle or error-handling code.

## The eight checkpoints

| Checkpoint | On the wire | What it decides | How it can end |
|---|---|---|---|
| Discover | Yes, `server/discover` (cacheable) | Which versions and capabilities the server offers | `-32022` if the client's version is unsupported |
| List | Yes, `tools/list` (cacheable, deterministic order) | What tools, schemas, and annotations exist | Nothing tool-specific; a stable list |
| Select | No | Which tool the model chooses, from context already in hand | Not applicable; entirely inside the host |
| Confirm | No | Whether a human approves before the call is even sent | The lifecycle simply ends here if declined |
| Call | Yes, `tools/call` | The request actually leaves the client | Nothing yet; this only starts the next checkpoint |
| Validate | No new message; gates the response | Does the server expose a tool with this name | Protocol error `-32602` if unknown, no execute or result follows |
| Execute | No new message; gates the response | Are the arguments schema-valid, does the handler succeed | `isError` result for bad input or a business failure; `-32603` only for a genuine unexpected fault |
| Result | Yes, the response to `tools/call` | `resultType` is `complete` or `input_required` | `input_required` loops back to call; `complete` is final |

## The two error channels

| Channel | Shape | Used for | Model can self-correct |
|---|---|---|---|
| Protocol error | JSON-RPC `error` | Unknown tool (`-32602`), malformed request, genuine server fault (`-32603`) | No, so clients should not blindly retry it |
| Tool execution error | Complete result, `isError: true` | Bad argument, upstream API failure, business rule violation | Yes, this is the channel built for it |

Rule of thumb: validate only ever produces a protocol error. Execute almost always produces a tool execution error, and only reaches for a protocol error when the failure was not something the caller's input could have prevented.

## Pausing, cancelling, and reissuing

| Situation | What happens | What the caller does |
|---|---|---|
| `resultType: "input_required"` | Server needs more input; `inputRequests`, `requestState`, or both are included | Retry with a new JSON-RPC id, `inputResponses` keyed to match, `requestState` echoed back exactly |
| Hard timeout | No resultType is ever produced for this attempt | Streamable HTTP: close the request's stream. stdio: send `notifications/cancelled` with the `requestId` and, optionally, a reason |
| Broken stream | The request and its outcome are both lost; nothing here is resumable | Reissue with a new id; treat `idempotentHint` as a hint, not a guarantee, before repeating a side-effecting call |
| Late response after cancellation | A result or error still arrives for an id the caller already gave up on | Ignore it |

## Checklist before you ship a tools/call path

- Unknown tool names always return `-32602`, never `-32601`.
- Argument-schema failures and business-rule failures come back as `isError: true` results, never as JSON-RPC errors.
- Every request, including a retry, carries `_meta` with the protocol version and client capabilities.
- Every retry after `input_required` uses a new id and echoes `requestState` byte for byte.
- Every reissue after a broken stream uses a new id, and side-effecting tools hand back an explicit, opaque handle so a reissue can act on state instead of guessing.
- Timeouts have a hard maximum that applies even while progress notifications keep arriving.
- Cancellation on stdio is a notification, never a request that expects an answer.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 5, 7, and 8.
