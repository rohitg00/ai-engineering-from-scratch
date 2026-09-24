# Prompt and Completion Reference

A one-page reference for the MCPA "Interactions and Execution" domain, aligned to MCP 2026-07-28.

## prompts/list

- Cacheable and paginated: `resultType: "complete"` results carry `ttlMs` (integer, 0 or more) and `cacheScope` (`public` or `private`).
- Request takes an optional opaque `cursor`; result includes `nextCursor` only when another page remains.
- Must not vary per connection; may vary by the authorization on the request.
- An unrecognized cursor is `-32602`, never a silent fallback to page one.

## prompts/get

- Request: `name` and an `arguments` map of strings.
- Not one of the six cacheable operations: no `ttlMs`, no `cacheScope` on the result.
- May answer with an `InputRequiredResult` instead of a final result (multi round-trip requests).
- Result carries `description` and `messages`, each a `role` (`user` or `assistant`) plus one content block.

## PromptMessage content types

| Type | Carries | Typical use |
|------|---------|-------------|
| `text` | `text` | The rendered instruction, arguments already substituted |
| `image` | base64 `data`, `mimeType` | Visual context inline in the message |
| `audio` | base64 `data`, `mimeType` | Audio context inline in the message |
| `resource_link` | `uri`, `name`, optional `description`, `mimeType` | Point at a resource without inlining its bytes |
| `resource` (embedded) | `uri`, `mimeType`, `text` or `blob` | Small resource content sent directly in the message |

## Errors

| Situation | Code |
|-----------|------|
| Unknown prompt name | `-32602` |
| Missing required argument | `-32602` |
| Unrecognized pagination cursor | `-32602` |
| Internal server failure | `-32603` |

There is no tool-style `isError` channel for prompts: rendering a template does not execute anything, so a bad name or a missing argument is always a protocol error, never a partial result for the model to patch.

## completion/complete

- Request: `ref` (`ref/prompt` by name, or `ref/resource` by URI or URI template), `argument` (`name`, `value`), optional `context.arguments` (already-resolved argument names and values).
- Result: `completion.values` (at most 100, ranked), optional `total`, and `hasMore`.
- `hasMore` is `true` whenever the true match count exceeds 100, regardless of how the client got there.
- Not cacheable: no `ttlMs`, no `cacheScope` on the result.
- Requires the server to declare the `completions: {}` capability in `server/discover`.

## Reference types

| Type | Example |
|------|---------|
| `ref/prompt` | `{"type": "ref/prompt", "name": "code_review"}` |
| `ref/resource` | `{"type": "ref/resource", "uri": "file:///src/{path}"}` |

## Remember for the exam

- Prompts are user-controlled; tools are model-controlled; resources are application-driven.
- `prompts/list` is cacheable; `prompts/get` and `completion/complete` are not.
- An unknown prompt, a missing required argument, and an invalid cursor are all `-32602`.
- `context.arguments` narrows completions using answers the user already gave, not new ones.
- The 100-value cap and `hasMore` are independent of pagination cursors; completion never uses a cursor.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`.
