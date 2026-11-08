---
id: cache-scope-private
title: A shared cache in front of private notes
card: protocols
kind: tradeoff
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design, design-review]
tags: [mcp, caching, cache-scope, ttl, resources]
minutes: 8
lessons: [phases/13-tools-and-protocols/10-mcp-resources-and-prompts, phases/13-tools-and-protocols/07-building-an-mcp-server]
manuals: []
practice: []
cheatsheet: [mcp-server-build]
related: [protocols/tool-resource-or-prompt]
updated: 2026-11-03
---

A notes server wants a shared cache in front of it, so its `resources/read` results carry a public scope and a five-minute freshness hint. A security reviewer objects. What is the risk, which scope and freshness do you pick for a user's note, and what do you do with a result that must never be stored at all?

## Short answer

A public scope lets a shared cache hand one user's note to another user who asks for the same URI. Content bound to a user gets `cacheScope: "private"`, which ties the entry to the requesting credential context, and a short freshness such as one minute. MCP defines only `public` and `private`, so a secret-bearing or fast-changing result gets `private` with `ttlMs: 0`, and the host adds a stricter no-store rule in its own cache policy.

## Full answer

### Two scopes, one rule

| Scope | Meaning | Typical use |
|---|---|---|
| `public` | may be reused across users when authorization permits | a public prompt catalog |
| `private` | bound to the requesting user or credential context | user-owned note content |

The hints describe freshness and sharing. They never replace authorization. The server still authorizes every read, and a cached response must not cross authorization contexts.

### Which results carry hints

`tools/list`, `resources/list`, `prompts/list`, `resources/templates/list`, `resources/read` and `server/discover` are cacheable and include `ttlMs` and `cacheScope`. A rendered `prompts/get` result is complete, but it is not one of the cacheable results. A safe default is `ttlMs: 0` with `cacheScope: "private"`.

### Choosing the freshness

Pick the TTL from the data's change rate and the damage of staleness. A public prompt catalog can live for minutes. A private note read may use one minute. The lesson's examples use `300000` for a resource list, `600000` for a prompt list and `3600000` for discovery.

### Keys and determinism

A cache key must include every request dimension that changes visibility: tenant, user, scope, locale and pagination cursor. If a shared cache cannot express those dimensions safely, use `private` with a zero TTL and a host-level no-store policy. List results also need deterministic ordering, so that equal results give stable cache keys and stable model context.

### The trade

A shared cache saves work on public catalogs and costs nothing in safety there. On private content it buys a few milliseconds and risks a cross-user leak that no TTL can shorten to zero. Cache the catalog, not the note.

## Follow-ups

- **Level 2:** Why must `resources/list` return a stable order? Expected: so that equivalent responses produce stable cache keys and stable model context, and host UIs do not jump between refreshes.
- **Level 2:** A client receives a cached list and wants to know when it changes. What does it do? Expected: open `subscriptions/listen` with the list-change category, and refetch after expiry or after an event.
- **Level 3:** `tools/list` differs by principal because of per-user authorization. Which scope? Expected: `private`; per-user tool visibility must not sit behind a shared public cache.
- **Level 4:** The team proposes `cacheScope: "no-store"`. What do you answer? Expected: it is not an MCP value; return `private` with `ttlMs: 0` and apply no-store in the host cache policy.

## Wrong answers

- "A short TTL makes the public scope safe." Scope decides who may share an entry, and TTL decides for how long. One second of sharing still leaks the note.
- "The cache hints are the authorization." They are freshness and sharing hints. The server authorizes every read on its own.
- "Only tool lists need cache hints." Resource reads and discovery carry them too, and a user-specific read is where the private scope matters most.

## Taught in

The [resources and prompts lesson](../../../phases/13-tools-and-protocols/10-mcp-resources-and-prompts/) treats cache hints as part of correctness, and the [server lesson](../../../phases/13-tools-and-protocols/07-building-an-mcp-server/) lists which results carry them.
