# Resources: Addressable Content for a Stateless Server

> A tool answers a question by doing something. A resource answers it by being something the host can already point the model at, addressed by a URI instead of invoked by a name.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 11
**Time:** ~45 minutes

## Learning Objectives

- Read `resources/list`, `resources/templates/list`, and `resources/read` as three distinct methods with three distinct results.
- Expand an RFC 6570 URI template into a concrete URI, then read it like any other resource.
- Explain why a missing resource is JSON-RPC error `-32602` with `data.uri`, never a result with an empty `contents` array.
- Choose `ttlMs` and `cacheScope` for a read based on whether its content is shared or belongs to one caller.
- Sanitize a URI before it reaches storage so a template can never be used to read outside a server's own root.

## The Problem

A host that wants to put a project's README, a ticket's body, or a user's saved note into a model's context is not asking the model to do anything. It is choosing what the model should already know before it answers. Route that choice through a tool and you inherit tool semantics you do not want: the model decides whether to call it, the call can fail argument validation, and every plain read now looks like an action in the transcript. Route it around MCP entirely, by reading a file straight off disk from inside the host, and you lose the one thing MCP was built to give you: a server that can move to a different machine, sit behind a different transport, or belong to a different team, without the host changing a line of code.

Resources close exactly this gap. They are content, not actions, addressed by a URI instead of invoked by a name, and the application, not the model, decides when one enters context. A note server that exposes `notes://alice/welcome` behaves the same whether the host renders it in a sidebar, feeds it to the model automatically, or never touches it at all in a given turn. The protocol's job stops at describing the content and answering reads correctly; what a host does with a resource once it has read it stays the application's decision, the same way tools left the prompt and the interface to the application.

## The Concept

Resources sit on the application-driven side of MCP's control split: tools are model-controlled, prompts are user-controlled, and resources are chosen by the host. A client discovers what is available and asks for it on the host's terms, whether that means an automatic heuristic, a picker in the interface, or a fixed set the host always includes.

Three methods cover the whole surface. `resources/list` returns the resources currently visible to the caller: a `uri`, a `name`, an optional `description`, `mimeType`, and `icons`. The set may be empty and may change over time, but it must not vary per connection, only by the authorization presented on the request, because the stateless core from lesson 04 forbids a server from remembering which connection asked last time. `resources/templates/list` returns parameterized URIs described with RFC 6570 templates, such as `file:///project/{+path}`, for families of resources too large or too dynamic to enumerate one by one. `resources/read` takes a `uri` and returns one or more content items in `contents`.

A content item takes one of two shapes. Text content is `{uri, mimeType, text}`. Binary content is `{uri, mimeType, blob}`, where `blob` is base64-encoded bytes. A single read can return more than one content item: a resource that represents a directory can read back every file underneath it in one `contents` array, each entry carrying its own `uri` and `mimeType`.

URI schemes are a design decision, not a formality. Use `https://` only when a capable client could fetch the same content directly from the web without going through the server at all; if the server is the only path to the content, prefer `file://`, `git://`, or a scheme of your own, in accordance with RFC 3986. A `file://` URI does not have to name a real path on a real filesystem. It only has to be a stable, namespaced identifier the server understands, which is exactly why a server can serve `file:///project/{+path}` from an in-memory tree and still sanitize every expansion as if it were walking a real directory: normalize the path segment against a synthetic root before ever looking it up, so no sequence of `..` segments can walk the lookup outside that root.

Errors matter here in a way they do not for tools. If the requested URI does not exist, the server returns a JSON-RPC error, code `-32602` (Invalid params), with `data.uri` naming what was asked for. SEP-2164 put the error there deliberately: `-32602` is the ordinary meaning of an invalid parameter, and a non-existent URI is exactly that, an argument the client supplied that does not correspond to anything the server has. Older servers used `-32002`, a code from the JSON-RPC server-error range that the specification never formally reserved for this meaning; a 2026-07-28 server must not emit it, though a well-behaved client still recognizes it from a legacy peer it happens to talk to. What a server must never do, on either code, is return a normal result with an empty `contents` array. An empty array cannot say whether the resource exists and happens to be blank or does not exist at all, so the protocol closes that ambiguity by making absence a distinct, error-shaped answer.

`resources/read` is one of the six methods whose complete results must carry caching hints: `ttlMs`, how many milliseconds the client may treat the answer as fresh, and `cacheScope`, either `public` or `private`. A resource that reads the same for every caller, a public changelog, say, can use `public` with a long `ttlMs`. A resource scoped to one user's data must use `private`, so a cache never lets one caller's read satisfy another caller's request. `cacheScope` describes who may share a cached copy; it does not perform access control by itself, so the server still authorizes every read regardless of what scope it later reports.

Resources also carry optional annotations, `audience`, `priority`, and `lastModified`, hints a host can use to decide what to surface first, and a capability flag, `subscribe`, that lets a client watch a URI for changes through `subscriptions/listen` with a `resourceSubscriptions` filter rather than the retired standalone subscribe call. The full mechanics of that stream, acknowledgment, demultiplexing, cancellation, get their own treatment later, but the shape of the request is the same stateless, per-request `_meta` you have used since the envelope lesson.

```figure
mcpa-12-resource-read
```

## Interactive Lab

The figure follows one URI from a template to a result. On the left, a template, `file:///project/{+path}`, expands a path segment into a concrete URI; the `+` keeps the slashes in a nested path instead of escaping them the way a plain `{path}` expansion would. The middle box is `resources/read` itself, which sanitizes the expanded URI against the server's root before it ever performs a lookup. From there the diagram forks: a URI that resolves to something real returns a complete result carrying `contents`, `ttlMs`, and `cacheScope`; a URI that resolves to nothing, whether because it was never registered or because a `..` segment tried to walk it outside the root, returns `-32602` naming the URI in `data.uri`, never a quietly empty `contents` array. Trace both paths before moving to the code: they are the same two outcomes every resource server has to implement correctly.

## Practice Lab

Open `code/main.py`. It builds one in-memory workspace server: a `README.md`, a directory of two files under `src/`, a binary `logo.png`, a version-controlled changelog under a `git://` URI, and one private note under a `user://` URI. Run it from the lesson directory.

```bash
python3 code/main.py
```

Read the printed transcript against the concept section. `resources/list` returns the catalog sorted by URI, each entry carrying `cacheScope: public` and a `ttlMs`. `resources/templates/list` returns one template, `file:///project/{+path}`; the demo expands it with `path=src/utils.py` and reads the result straight back. Reading `file:///project/src`, the directory entry, returns two content items in one `contents` array, one per file underneath it. Reading `logo.png` returns a `blob` field instead of `text`; decode it and check the bytes against the source. Reading `user://alice/notes/welcome` returns `cacheScope: private` with a short `ttlMs`, because that content belongs to one user rather than to everyone who can reach the server. The last two reads are the deliberate failures: a URI that was never registered comes back `-32602` with `data.uri` set, and a URI built by walking `..` segments out of the project root resolves to nothing and fails the same way, never landing on any file outside the sandboxed root. Change which file the template expands, add a resource of your own, and rerun to see the catalog and the read both pick it up without any change to the client.

## Shipped Artifact

`outputs/resource-design-guide.md` is a one-page reference for designing and reviewing resources: a scheme-choice table, the three methods and what each returns, the two content shapes, an error-handling checklist built around `-32602` and `data.uri`, a cache-scope decision table, and a short security checklist for URI sanitization. Keep it next to a server's resource handlers while you write or review them.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: the catalog is sorted and carries cache hints, the template expands and reads the right file, a binary read carries a base64 `blob`, a missing URI fails with `-32602` and `data.uri`, a `..` segment can never resolve outside the project root, a directory read returns multiple content items, a private note carries `cacheScope: private`, and requests without the right protocol metadata are rejected the same way every other method rejects them. The repository's wire checker validates the same transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/12-the-resources-primitive
```

## Capstone Connection

The capstone's single end-to-end transcript needs at least one resource read alongside its tool call and its consent flow, and it needs to get the read's error handling right under the same rules this lesson tests: a missing resource is `-32602` with `data.uri`, never a bare empty `contents` array, and every complete read carries `ttlMs` and `cacheScope`. Carry the sanitize-before-lookup habit forward too; it is the same discipline the capstone's authorization checks depend on.

## Key Terms

| Term | Meaning |
|------|---------|
| Resource | Application-driven content identified by a URI |
| `resources/list` | Returns the resource catalog visible to the caller, with cache hints |
| `resources/templates/list` | Returns RFC 6570 URI templates for families of resources |
| `resources/read` | Returns one or more content items in `contents` for a URI |
| Text content | `{uri, mimeType, text}` |
| Binary content | `{uri, mimeType, blob}`, base64-encoded |
| `-32602` | Invalid params; the code for a missing or invalid resource URI, carrying `data.uri` |
| `ttlMs` | How long, in milliseconds, a client may treat a cached read as fresh |
| `cacheScope` | `public` (shareable) or `private` (bound to one authorization context) |
| `subscriptions/listen` | The modern way to watch a resource for changes, replacing the retired `resources/subscribe` |

## Further Reading

- [MCP specification 2026-07-28: Resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources)
- [MCP specification 2026-07-28: Caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 10
- `phases/13-tools-and-protocols/10-mcp-resources-and-prompts`, which builds a resources and prompts server in depth
