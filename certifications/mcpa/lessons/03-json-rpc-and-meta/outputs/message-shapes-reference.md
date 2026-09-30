# Message Shapes Reference

A one-page reference for MCP 2026-07-28 wire traffic: the four JSON-RPC shapes, resultType, and the `_meta` key rules.

## The four shapes

| Shape | Has `id`? | Has `method`? | Carries | Gets a reply? |
|---|---|---|---|---|
| Request | Yes, non-null, unique among in-flight ids | Yes | `params` (optional) | Yes, exactly one |
| Notification | No, never | Yes | `params` (optional) | No, never |
| Result response | Yes, echoes the request | No | `result` with `resultType` | It is the reply |
| Error response | Yes, unless the id could not be read | No | `error` with `code` and `message` | It is the reply |

## `resultType` values

| Value | Meaning |
|---|---|
| `complete` | The result holds the final content |
| `input_required` | An `InputRequiredResult`; the client must retry with more input (MRTR) |
| absent (server on an earlier protocol version) | Client must treat as `complete` |
| unrecognized | Client must treat the result as invalid |
| extension value (for example `task`) | Only valid when the matching capability was advertised |

## `_meta` key grammar

- Optional prefix: dot-separated labels, then a slash. Each label starts with a letter and ends with a letter or digit; hyphens are allowed inside.
- Name: unless empty, starts and ends with an alphanumeric character; hyphens, underscores, and dots are allowed inside.
- A prefix is reserved for MCP only when its SECOND label is `modelcontextprotocol` or `mcp`. Check position, not presence.
  - Reserved: `io.modelcontextprotocol/`, `dev.mcp/`, `org.modelcontextprotocol.api/`, `com.mcp.tools/`
  - Not reserved: `com.example.mcp/` (second label is `example`); `mcp.example/` (no second label matches, `mcp` is only first)

## Reserved `_meta` keys

| Key | Carried on | Notes |
|---|---|---|
| `progressToken` | request | No prefix; opts the request into progress notifications |
| `io.modelcontextprotocol/protocolVersion` | request, required | Protocol version for this request |
| `io.modelcontextprotocol/clientCapabilities` | request, required | Client capabilities relevant to this request, may be `{}` |
| `io.modelcontextprotocol/clientInfo` | request, should | Client name and version, self-reported |
| `io.modelcontextprotocol/logLevel` | request, optional | Deprecated logging opt-in; still valid in 2026-07-28 |
| `io.modelcontextprotocol/serverInfo` | result, should | Server name and version, self-reported |
| `io.modelcontextprotocol/subscriptionId` | notification on a `subscriptions/listen` stream | Correlates a notification with its subscription |
| `traceparent`, `tracestate`, `baggage` | any | OpenTelemetry trace context; the one exception to the prefix rule (SEP-414) |

## Rejection rule

A request whose `_meta` is missing `protocolVersion` or `clientCapabilities` is malformed: JSON-RPC error `-32602`, and `400 Bad Request` on HTTP.

## Remember for the exam

- `clientInfo` and `serverInfo` are self-reported. Never use either for a security or routing decision.
- The reserved-prefix test checks the SECOND label, not the first, and not "does mcp appear anywhere in the string."
- No batching: one request or notification per Streamable HTTP POST body, one message per stdio line.
- A missing `resultType` from an older server means `complete`. An unrecognized `resultType` from any server is invalid.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 2 and 3.
