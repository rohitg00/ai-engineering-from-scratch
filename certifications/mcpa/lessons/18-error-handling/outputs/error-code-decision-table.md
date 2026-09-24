# Error Code Decision Table

A one-page reference for choosing the right channel, code, data shape, and HTTP status when an MCP 2026-07-28 request fails. Pair this with `docs/en.md` for the full walkthrough. Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 5.

## Step 1: pick the channel

| The failure is about | Channel | Shape |
|---|---|---|
| The request itself: an unknown method, an unknown tool, a malformed envelope, a server fault | Protocol error | `{"jsonrpc": "2.0", "id": ..., "error": {"code": ..., "message": ..., "data": ...}}` |
| What the tool found once it ran: bad input, a failed API call, a business rule, an expired handle | Tool execution error | A normal `complete` result: `{"content": [...], "isError": true}` |

If you are unsure which one fits, prefer the tool execution error. Only unknown tools, malformed requests, and server faults belong on the protocol error channel; the model cannot act on a protocol error the way it can act on `isError` content.

## Step 2: pick the code (protocol errors only)

| Code | Name | Fires when | HTTP status |
|---|---|---|---|
| -32700 | Parse error | The body is not valid JSON; `id` is `null` because none could be read | not specified by the spec; typically 400 |
| -32600 | Invalid Request | Valid JSON, but not a well-formed JSON-RPC 2.0 object | not specified by the spec |
| -32601 | Method not found | The method itself is not one this server implements | 404 |
| -32602 | Invalid params | Unknown tool, missing required `_meta`, resource not found, invalid prompt name or argument, invalid cursor, invalid log level | 400 |
| -32603 | Internal error | The server itself failed | not specified by the spec |
| -32020 | HeaderMismatch | An HTTP header disagrees with the body, or a required header is missing | 400 |
| -32021 | MissingRequiredClientCapability | The server needs a capability this request's `clientCapabilities` did not declare; carries `data.requiredCapabilities` | 400 |
| -32022 | UnsupportedProtocolVersion | The requested protocol version is not supported; carries `data.supported` and `data.requested` | 400 |

## Step 3: never emit these

| Code | Why it is forbidden |
|---|---|
| -32000 to -32019 | Legacy sub-range from before the 2026-07-28 allocation policy. New implementations must not allocate or use codes here. |
| -32002 | Was the resource-not-found code through 2025-11-25. SEP-2164 replaced it with -32602. |
| -32042 | Was the URL-elicitation-required code, only in 2025-11-25. It has no replacement code; use the elicitation flow instead. |
| any other -32020 to -32099 | Reserved for the MCP specification. Only -32020, -32021, and -32022 are defined; an undefined code in this band is forbidden. |

A conformant implementation refuses to construct one of these codes before it ever reaches a socket, not after. Build the refusal into whatever function assembles your error responses (see `code/main.py`'s `safe_error`), so the forbidden numbers cannot leave the process.

## Step 4: place an application-defined code correctly

If neither a defined MCP code nor `isError` fits, a new code should sit outside `-32768` to `-32000` entirely (for example, a small positive integer your own client and server agree on). Prefer `isError` first; SEP-1303 exists precisely so implementations stop inventing codes for problems the model could otherwise read and fix itself.

## Transport events without a JSON-RPC code

| Event | HTTP status | Carries a JSON-RPC error? |
|---|---|---|
| Notification POST accepted | 202 Accepted | No, no body at all |
| GET or DELETE to the MCP endpoint | 405 Method Not Allowed | No |
| Missing or invalid bearer token | 401 Unauthorized | No, this is an OAuth-layer response |
| Insufficient scope | 403 Forbidden | No, this is an OAuth-layer response |

## The one exception to "always echo the request id"

An error response omits `id` only when the id could not be read at all, for example a parse failure on the raw body. Every other response, result or error, carries the same id the request carried.
