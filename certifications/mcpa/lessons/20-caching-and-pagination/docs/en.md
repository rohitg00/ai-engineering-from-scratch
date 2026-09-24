# Cache Freshness and Cursor-Based Pagination

> A cacheable result tells a client exactly how long to trust it and who else may reuse the copy; a paginated one hands back an opaque bookmark, never a page number.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 19
**Time:** ~45 minutes

## Learning Objectives

- Name the six operations that return a `CacheableResult` and state what `ttlMs` and `cacheScope` mean on each one
- Apply the freshness rule a 2026-07-28 client must follow: `ttlMs` of `0` is immediately stale, a negative value is treated as `0`, and an absent field defaults to `0`
- Explain why `cacheScope` of `public` versus `private` decides who may reuse a cached response, and why that choice is never an access control decision
- Walk an opaque cursor through `resources/list`: an absent cursor starts at the beginning, an empty string is a valid mid-list position, and an unrecognized cursor returns `-32602`
- Explain why a `list_changed` notification invalidates a cache immediately regardless of remaining TTL, and why a result produced by retrying an MRTR request must never be cached

## The Problem

The stateless core from lesson 04 means a server never remembers a client between requests, so there is no warm connection state a client can lean on to avoid asking twice. At the same time, most of what a client asks for barely changes. A tool catalog might be edited once a week. A resource's byte content might be the same for the next hour. Calling `tools/list` or reading the same resource before every single decision the model makes would multiply round trips for data that has not moved, and on a server reached over the internet each of those round trips costs real latency.

A second, unrelated cost shows up on servers with large result sets. A resource catalog with ten thousand entries cannot come back as one JSON array without making every client pay for the whole list even when it only needs the first handful of names. Returning everything at once also removes the server's ability to change its underlying storage, add entries, or shard a catalog without breaking every client that assumed a fixed response shape.

MCP answers the first cost with a caching envelope attached to the results worth remembering: a time to live and a scope that says who may share the cached bytes. It answers the second with cursor-based pagination: an opaque token that lets the server hand back a manageable slice plus a bookmark for the rest, without ever promising a stable page count or a fixed page size. Both mechanisms fit the same discipline as everything else in this era of the protocol: every fact a client needs, whether that is how long a response stays fresh or where to resume a list, travels explicitly in the messages themselves, never implied by a connection that happens to still be open.

## The Concept

Six operations return a `CacheableResult`: `server/discover`, `tools/list`, `prompts/list`, `resources/list`, `resources/templates/list`, and `resources/read`. Any time one of these returns `resultType: "complete"`, the result carries two fields. `ttlMs` is an integer, `0` or greater, that tells the client how many milliseconds it may consider the response fresh, the same idea as an HTTP `Cache-Control: max-age`. `cacheScope` is either `"public"` or `"private"` and says who may hold onto a copy.

A client that fetches a resource records the local time it received the response, call it `t_received`. The response stays fresh while `now < t_received + ttlMs`. Three edge cases matter for the exam. If `ttlMs` is `0`, the response is immediately stale and the client may refetch the next time it is needed. If a server sends a negative `ttlMs`, a conformant client ignores the sign and treats it as `0`. If `ttlMs` is missing entirely, which should only happen against an older server that predates this mechanism, the client again assumes `0` and falls back to its own heuristics or to change notifications. None of this makes the TTL a polling interval: a client checks freshness lazily, when it next needs the data, rather than waking up on a timer to refetch in the background. If an implementation does poll anyway, it must add jitter and backoff so that many clients do not refetch in lockstep.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "complete",
    "resources": [
      {"uri": "note://private/journal", "name": "journal"},
      {"uri": "note://private/vault", "name": "vault"}
    ],
    "nextCursor": "",
    "ttlMs": 120000,
    "cacheScope": "public"
  }
}
```

`cacheScope` answers a different question: not how long, but for whom. `"public"` means the response holds nothing caller specific, so any client, gateway, or proxy may store it once and serve it to a different caller entirely. A tool catalog that is identical for every user is a normal `public` case. `"private"` means the content depends on who asked, so a cached copy may only be replayed for the same authorization context, never handed to a different token. Reading a shared readme is `public`; reading a caller's own private note is `private`, because the bytes differ per caller even though the request looks the same on the wire. Treat `cacheScope` as a caching instruction, not a security boundary: a `public` scope tells a cache it is allowed to share bytes that contain no user-specific data, it does not grant anyone access to call the method in the first place, and a server still enforces its own per-primitive access control on every request regardless of what the last cached response claimed.

A cached entry is identified by the request method together with whichever parameters affect the result: the `uri` for `resources/read`, the `cursor` for a paginated list. A client must never serve a cached response for a request whose method or relevant parameters differ from the one that produced it, and a result produced by retrying a request through a multi round-trip exchange, the pattern from lesson 14, must never be cached at all, because that result depended on `inputResponses` that are not part of the cache key. An interim `input_required` result is not cacheable either and carries no `ttlMs` or `cacheScope` fields to begin with; there is nothing to remember about a question that has not been answered yet.

TTL and push notifications are complementary, not competing. A server may ship `ttlMs` without ever advertising `listChanged: true`, in which case the TTL is the client's only freshness signal. A server may advertise both, in which case the TTL avoids needless refetches between notifications while the notification, covered in depth in lesson 16, still acts as an immediate invalidation the moment something actually changes. When a client receives a `notifications/resources/list_changed`, `notifications/tools/list_changed`, or `notifications/prompts/list_changed` on a subscription stream while a cached response is still inside its TTL window, the notification wins: the cached copy is stale immediately, no matter how much time was left on the clock.

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/resources/list_changed",
  "params": {"_meta": {"io.modelcontextprotocol/subscriptionId": 7}}
}
```

Pagination uses an opaque cursor instead of a page number. `resources/list`, `resources/templates/list`, `prompts/list`, and `tools/list` all support it the same way: a response may include `nextCursor`, and if it does, the client can continue by sending that exact string back as `cursor` on the next call. The server picks the page size; a client must not assume it is fixed, and must not try to parse, decode, or reason about the cursor's contents, since the string is only meaningful to the server that issued it. A missing `nextCursor` is the end of the list. The trap the exam likes here is the empty string: a cursor can legally be `""`, and that is a real position, not a signal that the list is over and not a request to start over from the beginning. A client that checks `if cursor:` instead of `if cursor is not None:` will silently stop paginating early the one time a server happens to mint an empty token. An unrecognized cursor, one the server did not issue or can no longer resolve, comes back as `-32602 Invalid params`.

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "error": {"code": -32602, "message": "Invalid cursor: 'not-a-real-cursor'"}
}
```

Pagination and caching interact in specific ways worth memorizing. Each page is its own independently cacheable response with its own `ttlMs`, and the freshness clock for a given page starts when that page was received, not when the first page of the list was received. A server may even choose a longer TTL for early, stable pages and a shorter one for a volatile final page. There is no cross-page consistency guarantee: if the underlying list changes between two page fetches, a client may see an item twice or miss one entirely, the same trade-off HTTP pagination has always carried, and a client that needs a true snapshot has to refetch from the beginning without a cursor. What a server must not do is vary `cacheScope` across the pages of one listing; if the first page of a `resources/list` call is `private`, every later page of that same call is `private` too.

Finally, ordering. `tools/list` and the other list operations should return results in a stable, deterministic order across identical calls. This matters twice over: it lets a client's own cache and its pagination bookkeeping behave predictably, and it lets an upstream large language model provider's own prompt cache recognize a byte-identical prefix the next time the same tool catalog is serialized into a system prompt, which is a real latency and cost saving that has nothing to do with MCP's cache and everything to do with keeping the wire output stable.

```figure
mcpa-20-cache-freshness
```

## Interactive Lab

The figure lays a single cached response on a timeline. The response lands at `t_received`, and a shaded band stretches forward by `ttlMs`: inside that band the client answers from its cache with no wire traffic at all. Watch what happens to the second copy of the same timeline: a `list_changed` notification arrives well before the TTL band would have ended, and the freshness line is cut short exactly there. The figure's caption calls out the rule this is testing: a notification invalidates on arrival, and the remaining TTL on the clock stops mattering the instant it does.

## Practice Lab

Open `code/main.py`. It builds a small `notes` resource server with three shared, public notes and two private ones, fronted by a `ClientCache` that two client identities, `alice-token` and `bob-token`, share the way a gateway cache would.

```bash
python3 code/main.py
```

Read the printed transcript against the concept section. The first five exchanges page through `resources/list`: the second call is silent because it hits the cache, the third sends `cursor: ""` and gets back the middle page rather than the first, the fourth follows `nextCursor` to the last page, and the fifth sends a cursor the server never issued and gets `-32602` back. The next block reads notes: alice and bob share one cached copy of the public readme, since `cacheScope` there is `"public"`, but each gets their own fetch of the private journal, since a `"private"` entry never crosses tokens even inside a shared cache. Then alice opens a `subscriptions/listen` stream, the server's list changes, and the very next `resources/list` call goes back to the wire even though its TTL had not expired. Reading the private vault note triggers an `input_required` result carrying an `elicitation/create` request; the client answers it, retries with a new id and the echoed `requestState`, and the completed read is deliberately never stored in the cache, so reading the vault twice means asking twice. The transcript's last entry is not something the client sent: it is wrapped as a deliberate violation, a `resources/list` reply from a hypothetical pre-SEP-2549 server that omits `ttlMs` and `cacheScope` altogether, which is exactly the shape that forces a conformant client back to its `ttlMs: 0` default.

## Shipped Artifact

`outputs/caching-decision-guide.md` is a one-page decision guide for choosing `ttlMs` and `cacheScope` values and for implementing a client-side cache correctly, citing the brief. Keep it next to any code that calls `resources/list`, `resources/read`, `tools/list`, `prompts/list`, `resources/templates/list`, or `server/discover`.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: a fresh entry is served without a new request, a stale entry past its TTL triggers a refetch, a private entry never crosses tokens while a public one is shared across them, a `list_changed` notification invalidates before the TTL would have, an `input_required` result and the completion that follows an MRTR retry are both never cached, an empty-string cursor continues pagination instead of ending it, an unrecognized cursor returns `-32602`, listings come back in a deterministic order, and a missing or negative `ttlMs` is clamped to zero. The repository's wire checker also validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/20-caching-and-pagination
```

## Capstone Connection

The capstone's full exchange has to decide, for every cacheable call it makes, how long to trust the answer and whether it is safe to share across callers, and it has to page through at least one large listing without assuming a page count. Both decisions rest on this lesson: read `ttlMs` and `cacheScope` off the result instead of inventing a caching policy, key the cache by method and the parameters that actually affect the result, treat an empty cursor as data rather than an ending, and never let a retried or interim result sit in the cache pretending to be reusable.

## Key Terms

| Term | Meaning |
|------|---------|
| `CacheableResult` | The envelope of `ttlMs` and `cacheScope` carried by six `complete` results |
| `ttlMs` | Milliseconds a client may consider a response fresh; `0` or absent means immediately stale, negative is clamped to `0` |
| `cacheScope` | `public` (any cache may share it) or `private` (only the same authorization context may reuse it); never an access control |
| Cache key | The request method plus the parameters that affect the result, such as `uri` or `cursor` |
| Cursor | An opaque, server-chosen token marking a position in a list; clients must not parse or assume a fixed page size |
| `nextCursor` | The token that continues pagination; its absence, not an empty string, means the list is finished |
| `list_changed` notification | A push signal that invalidates a cached list immediately, regardless of remaining TTL |
| MRTR retried result | The completion that follows an `input_required` round trip; never eligible for caching |

## Further Reading

- [MCP caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)
- [MCP pagination](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/pagination)
- [SEP-2549: TTL for List Results](https://modelcontextprotocol.io/seps/2549-ttl-for-list-results)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 10
- `phases/13-tools-and-protocols/10-mcp-resources-and-prompts`, which covers the resources and prompts primitives these cacheable, paginated results belong to
