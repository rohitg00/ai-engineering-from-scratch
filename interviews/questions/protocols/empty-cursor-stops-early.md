---
id: empty-cursor-stops-early
title: The pagination loop that ends two pages short
card: protocols
kind: code-reading
level: 2
roles: [agentic-ai-engineer, ai-developer-relations-engineer]
rounds: [coding, debugging]
tags: [mcp, pagination, cursor, tools-list, code-reading]
minutes: 7
lessons: [phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content]
manuals: []
practice: []
cheatsheet: [mcp-client-transports]
related: [protocols/two-error-layers]
updated: 2026-11-03
---

A client collects the tool list of an MCP server with this loop:

```python
tools = []
cursor = None
while True:
    result = call("tools/list", cursor=cursor)
    tools.extend(result["tools"])
    if not result.get("nextCursor"):
        break
    cursor = result["nextCursor"]
```

Against one server the client sees only the first page, and the trace shows a single request. Read the code and find the bug. Then name two more things a client must never do with a cursor.

## Short answer

The loop tests the cursor for truthiness, and an empty string is a valid cursor. The server returned `""` after its first page, the test read it as false, and the loop stopped before the second request. Stop only when `nextCursor` is absent or `null`, and send the value back exactly as received. A client must also never decode a cursor or compare two cursors for order.

## Full answer

### The one decision a client gets

```python
if result.get("nextCursor") is None:
    break
cursor = result["nextCursor"]
```

The server chooses the page size and the cursor format. The sample server in the lesson deliberately returns `""` after its first page, and the correct trace is one request with no cursor followed by one request with the cursor `""`.

### Cursors are opaque

Do not decode a cursor, increment it, compare it with a prior cursor, or infer a page number from it. A server may sign a cursor, bind it to a catalog version, or map it to private state. That is the server's detail and may change without notice. An invalid cursor returns JSON-RPC invalid params, `-32602`.

### Why the bug matters

The tool list is the first gate of the contract pipeline: discover, admit, invoke, execute, consume. A client that drops the last pages exposes a partial catalog to the model and may miss the descriptor it was asked to admit or reject. Discovery must be deterministic and complete before admission starts.

## Follow-ups

- **Level 2:** A page arrives with `nextCursor` present and an empty `tools` array. Do you continue? Expected: yes; continue whenever `nextCursor` is present and not `null`.
- **Level 2:** A cursor looks like base64. May the client decode it to skip ahead? Expected: no; the value is opaque, and the server may sign it or bind it to a catalog version.
- **Level 3:** What should a server put in a cursor so that a client cannot misuse it? Expected: a signed or server-mapped token, bound to a catalog version where needed, with an invalid or stale value rejected as `-32602`.
- **Level 4:** What evidence proves complete paginated discovery for a gateway? Expected: the page trace, the admitted and rejected descriptor sets, and a check that repeated calls give the same logical order.

## Wrong answers

- "An empty string means no more pages." It is a valid cursor. Only absence or `null` ends the loop.
- "Parse the cursor to compute the page number." The format belongs to the server and may be signed or private state.
- "Compare the new cursor with the old one to detect a loop." Clients must not compare cursors for ordering.

## Taught in

The [tool contracts lesson](../../../phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content/) shows the two-request cursor trace and the opaque-cursor rule.
