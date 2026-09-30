# The Tools Primitive: Calling Actions and Reading Their Results

> A tool call is a request like any other. What earns it its own lesson is everything the result can carry back: plain text, an image, audio, a link to a resource, or a resource embedded whole, each one tagged with hints about who it is for and how fresh it is.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 10
**Time:** ~45 minutes

## Learning Objectives

- Read a `tools/list` page for its pagination and caching hints, and explain why the tool list a client receives must not depend on which connection asked for it
- Call a tool and read a `CallToolResult` apart into its three fields: `content`, `structuredContent`, and `isError`
- Identify each content block type a tool result can carry, text, image, audio, a resource link, and an embedded resource, and what its own annotations describe
- Apply the default value of each tool annotation when a server leaves the annotations object out, and explain why those defaults lean cautious rather than permissive
- Trace how a change to a server's tool list reaches a client that already opened a `subscriptions/listen` stream

## The Problem

A server can expose one tool or several hundred. If `tools/list` answered with the whole set every time, in one unpaginated block, and the response carried no promise about how long the answer stayed good, every model turn would either re-fetch the entire catalog for nothing or act on a copy that might already be stale. Nothing about the request or the response would tell a client which choice was safe.

Calling a tool raises a sharper version of the same problem. A tool's job might be to speak a sentence, draw a picture, or hand back the actual bytes of a file, and a single "return a string" contract cannot describe any of that honestly. If every result were forced into one shape, a client would have to guess whether the text it got back was meant for the model to read, the user to see, or a resource to fetch on its own, and it would have no clean way to tell a call that failed outright from one that merely returned something the model still needs to read and correct.

The 2026-07-28 revision answers both problems with the same instinct: give the wire enough structure that a client never has to guess. Pagination and caching hints ride on the list, content comes back typed block by block, and a call's failure mode is a field to check rather than a shape to reverse engineer.

## The Concept

A client asks what a server can do with `tools/list`. The request may carry an opaque `cursor` copied from a previous page; the very first request omits it. Because `tools/list` is one of the cacheable operations, a `"complete"` result always carries an integer `ttlMs` and a `cacheScope` of `"public"` or `"private"`, and when more tools remain it also carries `nextCursor`, another opaque string the client passes back unexamined.

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "resultType": "complete",
    "tools": [
      {"name": "get_readme_link", "description": "Point at the project README instead of inlining it.", "inputSchema": {"type": "object", "additionalProperties": false}}
    ],
    "nextCursor": "",
    "ttlMs": 300000,
    "cacheScope": "public"
  }
}
```

That `nextCursor` is the empty string on purpose: it is a legal cursor value, not a sentinel for "nothing left." A client that decides whether to keep paging with `if result.get("nextCursor")` will stop one page early, because an empty string is falsy in most languages. The only correct check is whether the key is present at all. Pagination itself is the server's implementation detail from end to end; a client that parses, decodes, or increments a cursor is leaning on something the next server version is free to change without notice. The same discipline applies to the list's contents: three calls to `tools/list` from three unrelated connections against an unchanged tool set must come back identical, in the same order. The set may only differ because the authorization on the request changed what that caller is allowed to see, never because of anything a connection happens to remember.

Invoking one tool is `tools/call`, with `name` and `arguments` in `params`. Whatever comes back is a `CallToolResult`: a `content` list that is never left out, an optional `structuredContent` value, and an optional `isError`. Leaving `isError` out of the result means the call succeeded; only `true` marks a problem the tool itself ran into while doing its job. A tool that also defines an `outputSchema` puts its structured answer in `structuredContent` and, so that clients which only read text still get the data, mirrors the same value serialized into a text block inside `content`.

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "resultType": "complete",
    "content": [{"type": "text", "text": "{\"id\": \"TCK-9\", \"title\": \"VPN drops every hour\", \"status\": \"open\"}"}],
    "structuredContent": {"id": "TCK-9", "title": "VPN drops every hour", "status": "open"}
  }
}
```

`content` is a list because one call can hand back more than one kind of thing at once, and five block types cover every case the specification defines. A `text` block carries `text`. An `image` block carries base64 `data` and a `mimeType`. An `audio` block carries the same two fields for sound. A `resource_link` block points at a resource by `uri` and `name` instead of inlining it, useful when the content is large or the model may never need to read it. A `resource` block embeds the resource's own contents (`uri`, `mimeType`, and either `text` or `blob`) directly in the result. Any of these blocks may carry its own `annotations`: an `audience` naming who the block is for (`user`, `assistant`, or both), a `priority` between 0 and 1, and a `lastModified` timestamp. These content annotations sit beside the block's other fields, siblings of `data` or `resource`, never nested one level deeper, a placement worth reading twice since it is easy to assume an embedded resource's annotations live inside its `resource` object when the schema keeps them next to it instead.

```json
{
  "type": "resource",
  "resource": {"uri": "config://release-desk/thresholds", "mimeType": "application/json", "text": "{\"maxOpenIncidents\": 5}"},
  "annotations": {"audience": ["user", "assistant"], "priority": 0.7, "lastModified": "2026-07-01T00:00:00Z"}
}
```

A different set of annotations describes the tool itself, not any one result's content: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`, plus a display `title`. None of them are guarantees. A client must treat them as untrusted unless the server itself is trusted, and a server that says nothing about a tool still leaves the client with defaults to fall back on: `readOnlyHint` false, `destructiveHint` true (meaningful only once `readOnlyHint` is false), `idempotentHint` false, and `openWorldHint` true. Those defaults lean cautious on purpose. A tool with no annotations at all is treated as though calling it twice might do something different the second time, not because that is likely, but because nothing told the client otherwise.

A server that declares `tools: {listChanged: true}` promises to say something when its tool set changes, and it says it on a stream rather than the connection at large. A client opens one with `subscriptions/listen`, naming `toolsListChanged` in `params.notifications`. The first message back is always `notifications/subscriptions/acknowledged`, echoing which requested types the server agreed to honor, tagged in `_meta` with `io.modelcontextprotocol/subscriptionId`, the same value as the listen request's own `id`. Every later `notifications/tools/list_changed` on that stream carries the same subscription id, so a client juggling several open streams knows which one just spoke. The notification carries no list of its own, only word that the old one is stale; the client re-fetches with an ordinary `tools/list`.

```figure
mcpa-11-tool-call
```

## Interactive Lab

The figure lays out one `tools/call` round trip: the request going one way, the `CallToolResult` coming back the other, and beneath the arrows, the five content block types that result's `content` array can mix and match. Underneath that, the same result's `isError` field branches two ways: omitted or false means the call went fine, true means the tool hit a problem the model can read and act on. Nothing in the picture is unique to any one server; the same shape applies whether the tool spoke a sentence, drew a badge, or handed back a link to a file nobody needed to read yet.

## Practice Lab

Open `code/main.py`. It builds one `release-desk` server with six tools, one for each content block type plus a structured ticket summary, and lists them three pages deep at two tools per page, the middle page ending in an empty-string cursor on purpose.

```bash
python3 code/main.py
```

Read the printed pages against the concept section: the first two pages each end in a `nextCursor` the client never interprets, and only the third page ends with no `nextCursor` key at all, the sole signal that pagination is actually done. Then find `render_for_audience` near the top of the file and watch it keep the badge image out of a pass rendered for `"assistant"` while keeping it for `"user"`, using the exact `annotations.audience` list `render_badge` attached to its own block. Finally watch the `subscriptions/listen` exchange near the end of the transcript: an acknowledgment, then a `notifications/tools/list_changed` the moment a seventh tool, `triage_incident`, is registered mid-stream, then a fresh `tools/list` walk that now needs a fourth page to reach it. Add an eighth tool of your own to `build_tool_server`, rerun, and confirm the page split and the `effective_tool_annotations` defaults both adjust without touching a single line of client code.

## Shipped Artifact

`outputs/tool-result-anatomy.md` is a one-page reference for this lesson's slice of the exam: the `tools/list` pagination and caching fields, the `CallToolResult` shape, a table of all five content block types with their required fields, the tool annotation defaults, and the one-line version of the listChanged flow. Keep it beside a real server's tool definitions the first few times you review one; every row traces back to a field this lesson's code actually sets.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: that every content block type comes back well formed, that a `resource_link` always carries a `uri` and a `name`, that an embedded resource keeps its `annotations` beside the `resource` object rather than inside it, that filtering content by audience actually excludes blocks meant for someone else, that `isError` stays absent on a normal success, that `tools/list` pages correctly through an empty-string cursor without stopping early, that an unrecognized cursor is refused, that a request missing its metadata is rejected, that the tool list is identical from two independent connections, that omitted tool annotations resolve to the documented defaults, and that a `subscriptions/listen` stream acknowledges before it ever reports a change. The repository's wire checker also validates this lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/11-the-tools-primitive
```

## Capstone Connection

The capstone's single long exchange calls a tool, validates its arguments against a schema, and reads an `isError` result back into a corrected retry. Both moves are this lesson's `CallToolResult`, read the same way whether the call sits alone or inside a longer script: `content` is what the model sees, `structuredContent` is what a program can trust without re-parsing text, and `isError` is the difference between a request that was wrong and a tool that hit a problem worth explaining.

## Key Terms

| Term | Meaning |
|------|---------|
| Tool | A model-controlled, schema-typed action a server exposes by name |
| `tools/list` | The paginated, cacheable request that enumerates a server's tools |
| `tools/call` | The request that invokes one tool by name with arguments |
| `CallToolResult` | The result shape for a tool call: `content`, optional `structuredContent`, optional `isError` |
| Content block | One item of a tool result's `content` list: text, image, audio, a resource link, or an embedded resource |
| `resource_link` | A content block that points at a resource by URI instead of inlining it |
| Content annotations | `audience`, `priority`, and `lastModified` on a content block, describing who should see it and how fresh it is |
| Tool annotations | `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`: untrusted hints about a tool's behavior |
| `nextCursor` | The opaque token a paginated result carries when more tools remain; its presence, not its truthiness, decides |
| `subscriptions/listen` | The request that opens a stream a server uses to announce `notifications/tools/list_changed` |

## Further Reading

- [MCP specification 2026-07-28, Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [MCP specification 2026-07-28, Subscriptions](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions)
- [MCP specification 2026-07-28, Schema Reference](https://modelcontextprotocol.io/specification/2026-07-28/schema)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 10
- `phases/13-tools-and-protocols/07-building-an-mcp-server` and `phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content`, which build tool contracts and content handling in depth
