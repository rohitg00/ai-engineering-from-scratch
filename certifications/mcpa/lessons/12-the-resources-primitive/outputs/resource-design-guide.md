# Resource Design Guide

A one-page reference for designing and reviewing MCP resources, aligned to MCP 2026-07-28.

## The three methods

| Method | Returns | Cacheable |
|---|---|---|
| `resources/list` | The resource catalog visible to the caller: uri, name, description, mimeType, icons | Yes: ttlMs, cacheScope |
| `resources/templates/list` | RFC 6570 URI templates for families of resources | Yes: ttlMs, cacheScope |
| `resources/read` | One or more content items in `contents` for a given uri | Yes: ttlMs, cacheScope |

## Choosing a URI scheme

| Scheme | Use it when | Notes |
|---|---|---|
| `https://` | A capable client can fetch the same bytes directly from the web itself | Prefer another scheme if the server is the only path to the content |
| `file://` | Content behaves like a filesystem | Need not map to a real filesystem; sanitize every path segment |
| `git://` | Content is version-controlled | Identify the ref in the authority or path, not in a query string |
| Custom | Anything else | Must follow RFC 3986; namespace it to the server's domain |

## Content shape

- Text: `{"uri": ..., "mimeType": ..., "text": ...}`
- Binary: `{"uri": ..., "mimeType": ..., "blob": "<base64>"}`
- A single read may return more than one item in `contents` (for example, a directory-like resource returning every file underneath it).

## Error handling checklist

- [ ] A missing or invalid resource returns JSON-RPC error `-32602` (Invalid params), never `-32601` and never `-32002`.
- [ ] `error.data.uri` names the resource that was requested.
- [ ] A missing resource never comes back as a complete result with an empty `contents` array.
- [ ] Internal failures use `-32603`, not a resource-shaped error.
- [ ] A client still recognizes legacy `-32002` from older servers, even though a 2026-07-28 server must not emit it.

## Cache scope decision table

| Content | cacheScope | Typical ttlMs |
|---|---|---|
| A public catalog or changelog identical for every caller | `public` | Minutes to hours |
| A resource that depends on the authenticated caller | `private` | Seconds to a few minutes |
| Content that changes on every read | either | `0` |

`cacheScope` is a sharing boundary, not access control. Authorize every read regardless of what the cache hints say.

## Security checklist

- [ ] Validate every URI before it reaches storage or a database query.
- [ ] Sanitize path segments against a synthetic root, for example `posixpath.normpath("/" + tail)`, so a `..` sequence can never resolve outside that root.
- [ ] Authorize each read individually; a resource visible in `resources/list` is not automatically readable by every caller.
- [ ] Encode binary content as base64 in `blob`, never embed raw bytes in `text`.
- [ ] Treat resource content as untrusted data once it reaches the model, not as instructions.

## Remember for the exam

- Resources are application-driven: the host chooses when one enters context, not the model.
- `-32602` is the modern not-found code, carrying `data.uri`; `-32002` is legacy-only.
- An empty `contents` array is never a valid way to report a missing resource.
- `resources/read` is one of the six operations whose complete results must carry `ttlMs` and `cacheScope`.
- The modern subscription request is `subscriptions/listen` with a `resourceSubscriptions` filter, not the retired `resources/subscribe`.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 10.
