# Caching and Pagination Decision Guide

A one-page reference for implementing MCP clients and servers correctly, aligned to MCP 2026-07-28.

## Does this result need ttlMs and cacheScope?

Only six operations are cacheable, and only when `resultType` is `"complete"`:

| Operation | Typical cacheScope | Notes |
|-----------|--------------------|-------|
| `server/discover` | public | identical for every caller of the server |
| `tools/list` | public (usually) | private only if the tool set itself varies per caller |
| `prompts/list` | public (usually) | same rule as tools/list |
| `resources/list` | public or private | private if the listing itself is filtered per caller |
| `resources/templates/list` | public | templates rarely vary per caller |
| `resources/read` | depends on the resource | private for anything user-specific |

An `input_required` result is never cacheable and carries neither field. A result produced by retrying an MRTR request is never cached either, even though it still reports both fields.

## Choosing ttlMs

- Longer TTL for data that changes rarely (a static reference document, a stable tool catalog).
- Shorter TTL for data that changes often or where staleness is costly (a live queue depth, a balance).
- `0` when the response must always be treated as stale, such as a resource whose content control the server cannot revoke through a notification.
- Never negative. If you are a client and you receive a negative value, clamp it to `0`.
- Missing `ttlMs` from an older server also means `0`. Do not assume a long default.

## Choosing cacheScope

- `"public"`: the bytes contain nothing caller-specific. Any client, gateway, or proxy may store and replay them to a different caller.
- `"private"`: the bytes depend on who asked. Only the same authorization context may reuse the cached copy.
- `cacheScope` is a caching instruction, never an access control. A server still enforces its own per-primitive authorization on every request, and a client still authenticates every call normally; the scope only says whether a cache is allowed to share what it already has.

## Client cache checklist

- Key every cache entry by the request method plus the parameters that affect the result (`uri` for `resources/read`, `cursor` for a paginated list call).
- Partition private entries by the caller's authorization context. Never let a private entry stored for one token answer a lookup from a different token.
- Never store an `input_required` result.
- Never store the completion of an MRTR retry.
- On a relevant `list_changed` notification, invalidate the affected cache entries immediately, even if their TTL has not expired.
- Do not poll on a TTL timer in the background. Check freshness lazily, when the data is next needed.
- If a re-fetch fails (network error, server down), you may serve the stale entry rather than fail the caller outright.

## Pagination checklist

- Treat `cursor` as an opaque string. Never parse it, decode it, or infer position from its contents.
- Do not assume a fixed page size. The server chooses it and may change it between pages.
- A present `nextCursor` continues the list, including when its value is `""`. Only the absence of `nextCursor` means the list is finished.
- An unrecognized cursor returns `-32602 Invalid params`. On that error, discard cached pages for the listing and restart from the beginning if you need the full set.
- There is no cross-page consistency guarantee. If you need a true snapshot, re-fetch from the beginning without a cursor.
- A server must use the same `cacheScope` on every page of one listing request.

## Remember for the exam

- `ttlMs` is a freshness hint, never a guarantee that the underlying data has not changed.
- An empty-string cursor is valid and is not the end of the list.
- MRTR-retried results are never cached, even though the specification still requires ttlMs and cacheScope on them.
- Deterministic list ordering helps a client's own cache and also helps an LLM provider's prompt cache reuse a byte-identical prefix.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 10.
