# Tool Result Anatomy

A one-page reference for the MCPA "Interactions and Execution" domain, aligned to MCP 2026-07-28.

## tools/list, at a glance

| Field | Where | Meaning |
|-------|-------|---------|
| `cursor` | request, optional | opaque token from a previous page; omitted on the first request |
| `tools` | result | the page's tool definitions |
| `nextCursor` | result, optional | present, even as an empty string, whenever more tools remain |
| `ttlMs` | result, required | freshness hint in milliseconds; the client may cache until it lapses |
| `cacheScope` | result, required | `public` (shareable) or `private` (this authorization context only) |

The tool list must not vary per connection or as a side effect of another request. It may vary by the authorization presented on the request itself.

## tools/call and CallToolResult

| Field | Required | Meaning |
|-------|----------|---------|
| `content` | yes | list of content blocks; never omitted, may be empty |
| `structuredContent` | no | any JSON value; should conform to the tool's `outputSchema` when one exists |
| `isError` | no | absent or false means success; true means a tool execution error the model can read and correct |

## Content block catalog

| Block type | Required fields | Used for |
|------------|------------------|----------|
| `text` | `text` | plain natural-language output |
| `image` | `data` (base64), `mimeType` | pictures meant for the user |
| `audio` | `data` (base64), `mimeType` | spoken or sound output |
| `resource_link` | `uri`, `name` | pointing at a resource instead of inlining it |
| `resource` | `resource` object with `uri`, `mimeType`, and `text` or `blob` | embedding a resource's contents directly |

Any block may carry `annotations`: `audience` (`user`, `assistant`, or both), `priority` (0 to 1), and `lastModified`. These sit beside the block's other fields, siblings of `data` or `resource`, never nested one level deeper.

## Tool annotation defaults

| Annotation | Default | Note |
|------------|---------|------|
| `readOnlyHint` | false | true means the tool never modifies its environment |
| `destructiveHint` | true | meaningful only when `readOnlyHint` is false |
| `idempotentHint` | false | true means repeat calls with the same arguments add nothing new |
| `openWorldHint` | true | false means the tool's domain of interaction is closed |

All four are hints, not guarantees. Treat them as untrusted unless the server itself is trusted, and never make a safety decision from an annotation alone.

## The two error channels for a tool call

| Situation | Channel | Example |
|-----------|---------|---------|
| The named tool does not exist | JSON-RPC error | `-32602` |
| The tool ran but hit a problem the model can fix | result with `isError: true` | a bad date, a value out of range |

## listChanged in one line

A client opens `subscriptions/listen` with `toolsListChanged: true`, gets `notifications/subscriptions/acknowledged` first, then a `notifications/tools/list_changed` (tagged with that stream's subscription id) whenever the set changes, and re-fetches with an ordinary `tools/list`.

## Remember for the exam

- `nextCursor` presence, not truthiness, decides whether to keep paging; an empty string is a legal cursor value.
- Tool annotations describe intent, not enforcement; content annotations describe one block, not the whole tool.
- `isError` is normal result data meant for the model, not a protocol-level error.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 10.
