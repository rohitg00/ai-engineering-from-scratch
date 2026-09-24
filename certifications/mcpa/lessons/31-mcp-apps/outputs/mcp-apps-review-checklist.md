# MCP Apps Review Checklist

A one-page reference for reviewing a UI-capable tool before a host renders what it points at, aligned to MCP 2026-07-28 and the MCP Apps specification (2026-01-26).

## Before you trust a `ui://` resource

- The extension is negotiated on this request: the client declared `io.modelcontextprotocol/ui` in `io.modelcontextprotocol/clientCapabilities.extensions`, and the server named the same identifier in `capabilities.extensions` from `server/discover`.
- The tool definition carries `_meta.ui.resourceUri`, and that field, like the rest of the tool's definition, does not change depending on who is asking.
- The tool's `_meta.ui.visibility` (default `["model", "app"]` when omitted) decides who may reach it: drop `"model"` and the agent's own tool list must never show it; drop `"app"` and the host must reject a `tools/call` the app itself tries to place against it. A cross-server call to an app-only tool is always blocked.
- The resource was fetched through an ordinary `resources/read`, not a special method; nothing in the base wire fetches a `ui://` resource any other way.
- The result's `mimeType` is exactly `text/html;profile=mcp-app`. Plain `text/html`, with or without a `charset` parameter, is not a renderable app, no matter how well-formed the markup is. This one is a hard MUST, not a policy choice.
- The result's `_meta.ui.csp` is an object, not a list: `connectDomains`, `resourceDomains`, `frameDomains`, and `baseUriDomains`, each an optional array of origins. The host MUST construct its Content Security Policy from exactly those domains and MUST NOT allow one the resource never declared; it MAY further restrict what it actually honors as its own policy. Omit `csp` entirely and the host MUST fall back to a restrictive default (no outbound connections, same-origin scripts and styles only); omit `frameDomains` and `frame-src` is `'none'`; omit `baseUriDomains` and `base-uri` is `'self'`.
- The result's `_meta.ui.permissions` is an object of empty-object flags: `camera`, `microphone`, `geolocation`, `clipboardWrite`. The host MAY honor any of them through the iframe `allow` attribute; it is never required to, and a missing grant is not a reason to reject the resource. A well-built app SHOULD NOT assume a requested permission was granted.
- The result carries `ttlMs` and `cacheScope`, and a private-scoped read is never reused across a different authorization context.

## Rendering and the bridge

- The app renders inside a sandboxed iframe the host controls. It cannot read the host page's cookies, local storage, or DOM, and it cannot navigate the parent page.
- If the host is a web page, it MUST NOT talk to the view directly: it wraps the view in a sandbox proxy on a different origin from the host's own, and that proxy is what forwards bridge messages in both directions.
- All app-to-host communication crosses a `postMessage` JSON-RPC dialect, separate from the client-server connection: some method names are shared (`tools/call`), most are new with a `ui/` prefix (`ui/initialize`).
- That bridge handshake is not the core protocol's removed `initialize` request. It sets up one iframe's channel to its host frame; it does not negotiate a protocol version or create a session.
- An app-initiated tool call must clear two independent gates before it reaches the server: the target tool's `visibility` must include `"app"`, and the host's own consent must be given. Either gate alone can stop it. A forwarded call is an ordinary `tools/call` with a fresh id and full `_meta`.

## Fallback

- A UI-capable tool still returns a useful `content` text answer from every `tools/call`, independent of whether the extension was ever declared.
- A host that does not support the extension never reads the `ui://` resource at all; it uses the tool's text content the way it would for any other tool.
- The general extension rule applies here like everywhere else: the side without support falls back to core behavior rather than the request failing outright.

## Decision table

| Check | Passes | Fails |
|-------|--------|-------|
| Extension negotiated on this request | Continue to the resource fetch | Use the tool's text content; never fetch the resource |
| Tool `visibility` includes the caller (`model` or `app`) | Continue (agent sees it, or the app may call it) | Agent's tool list omits it, or the app's call is refused |
| `mimeType` is `text/html;profile=mcp-app` | Continue to CSP construction | Treat as an ordinary resource, not an app; fall back to text |
| Every declared CSP domain is inside host policy | Render with a CSP built from the declared domains | Fall back to text, as a matter of host policy, not a protocol failure |
| Requested `permissions` | Grant the subset host policy allows; render either way | Never a reason to reject the resource |
| App-initiated tool call has both visibility and consent | Forward as an ordinary `tools/call` | Do not forward; nothing reaches the server |

## Remember for the exam

- The extension identifier is `io.modelcontextprotocol/ui`, negotiated per request like every other extension, never once per connection.
- `_meta.ui.csp` is an object of domain-list keys, not a flat array; `_meta.ui.permissions` is an object of empty-object flags, not a list of strings.
- A wrong mime type is a hard MUST failure; an out-of-policy CSP domain is the host exercising its own further-restrict latitude, not a spec-mandated rejection; a missing permission grant never blocks rendering at all.
- `visibility` defaults to `["model", "app"]`; dropping either name gates a different caller, and cross-server app-only calls are always blocked.
- `ui/initialize` is part of the app-to-host bridge, not the removed core `initialize` request, and a web host reaches the view only through an intermediate, different-origin sandbox proxy.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 14, and the MCP Apps specification (2026-01-26).
