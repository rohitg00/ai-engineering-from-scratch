# MCP Apps on the Stateless Protocol

> An interactive result is still an MCP tool and resource exchange. The 2026-07-28 core makes that exchange self-contained, while the Apps extension adds the sandboxed browser surface.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 10 (resources)
**Time:** ~75 minutes

## Learning Objectives

- Advertise MCP Apps through `server/discover` and per-request extension capabilities.
- Declare a `ui://` resource on a tool before the tool is called.
- Return complete tool and resource results on the 2026-07-28 stateless wire.
- Separate the Apps `ui/initialize` bridge message from the removed MCP core handshake.
- Apply origin validation, sandboxing, CSP, and least-privilege permissions.

## The Problem

A text result can describe a timeline. It cannot give the user a timeline they can filter, inspect, or act on.

MCP Apps solves the presentation problem with an optional extension. A tool definition points to a `ui://` resource. The host can fetch and review that resource before the tool runs, render it in a sandboxed iframe, and mediate all app actions through a JSON-RPC bridge.

The core protocol changed in 2026-07-28. Do not wrap an App in the old connection lifecycle:

- There is no core `initialize` request or `notifications/initialized` notification.
- There is no `Mcp-Session-Id` header.
- Every request carries protocol version and client capabilities in `params._meta`.
- A server implements `server/discover` so clients can inspect versions, core capabilities, and extensions.
- Every successful result has a `resultType` discriminator.
- Streamable HTTP uses one POST per request. Modern GET and DELETE entrypoints return 405.

The Apps bridge still has a method named `ui/initialize`. It belongs to the iframe postMessage dialect. It does not recreate a core MCP session.

## The Concept

### Two protocols, one feature

Keep the layers explicit:

1. The MCP core carries `server/discover`, `tools/list`, `tools/call`, `resources/list`, and `resources/read`.
2. The MCP Apps extension declares the UI and defines the iframe-to-host bridge.
3. Browser sandbox rules limit what the UI can reach.

The extension identifier is `io.modelcontextprotocol/ui`. Both peers opt in. A client sends extension support inside the capabilities object on each request:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "server/discover",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/ui": {}
        }
      },
      "io.modelcontextprotocol/clientInfo": {
        "name": "timeline-host",
        "version": "1.0.0"
      }
    }
  }
}
```

`clientInfo` is recommended for diagnostics. It is self-reported data, not an authorization identity.

### Discover before rendering

The server's discovery result advertises the extension:

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "tools": {},
    "resources": {},
    "extensions": {
      "io.modelcontextprotocol/ui": {}
    }
  },
  "ttlMs": 300000,
  "cacheScope": "public",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "timeline-app-server",
      "version": "2.0.0"
    }
  }
}
```

The server must support discovery. A client is not forced to call discovery before every action because each action carries its own capabilities.

### Declare the UI on the tool definition

The modern Apps contract binds a UI to the tool in `tools/list`:

```json
{
  "name": "notes_timeline",
  "description": "Render a timeline of notes.",
  "inputSchema": {
    "type": "object",
    "properties": {}
  },
  "_meta": {
    "ui": {
      "resourceUri": "ui://notes/timeline.html"
    }
  }
}
```

This is deliberately pre-call metadata. The host can preload, cache, and security-review the HTML before a result asks to display it. Older flat metadata keys may be accepted by compatibility code, but new servers should emit the nested `_meta.ui.resourceUri` form.

`tools/list` is cacheable in the current core. Include deterministic ordering, `ttlMs`, and `cacheScope`. Use `private` when the visible tools vary by user or token.

### Return data, then let the host bind the view

The tool call returns ordinary content plus structured data:

```json
{
  "resultType": "complete",
  "content": [
    {"type": "text", "text": "Timeline ready."}
  ],
  "structuredContent": {
    "notes": [
      {"id": "note-1", "title": "Discover", "created": "2026-07-28"}
    ]
  },
  "isError": false
}
```

The host already knows which view belongs to the tool. Avoid inventing a new content block just to repeat the URI.

### Serve the app as a resource

The server advertises `resources` in discovery, so it also implements the mandatory `resources/list` operation. Its deterministic list entry includes the canonical URI, a stable name, description, and MIME type. The list result includes `resultType`, server identity metadata, `ttlMs`, and `cacheScope`, just like the deterministic tool list.

The host sends `resources/read`. On Streamable HTTP, the request has:

```text
POST /mcp
MCP-Protocol-Version: 2026-07-28
Mcp-Method: resources/read
Mcp-Name: ui://notes/timeline.html
```

The header values and JSON-RPC body must match. A mismatch is protocol error `-32020`.

The result contains the HTML resource and cache hints:

```json
{
  "resultType": "complete",
  "contents": [
    {
      "uri": "ui://notes/timeline.html",
      "mimeType": "text/html;profile=mcp-app",
      "text": "<!doctype html>...",
      "_meta": {
        "ui": {
          "csp": {
            "connectDomains": [],
            "resourceDomains": [],
            "frameDomains": [],
            "baseUriDomains": []
          },
          "permissions": {}
        }
      }
    }
  ],
  "ttlMs": 60000,
  "cacheScope": "public"
}
```

### Cache UI resources as executable content

An App resource is not interchangeable with ordinary prose. Its cache entry can execute bridge code, render tool data, and request host-mediated actions. Key it by canonical `ui://` URI, admitted server identity and version, resource content digest, and authorization context when `cacheScope` is private. Never reuse a private App resource across principals because the HTML or its policy metadata may differ even when the URI is identical.

Invalidate the entry when its `ttlMs` expires, the tool's `_meta.ui.resourceUri` binding changes, the server version or admitted descriptor pin changes, or an acknowledged resource-change subscription names the URI. Refetch and reapply CSP and permission review before remounting. A stale iframe must not keep broader permissions merely because a new resource version has not loaded yet.

### Reject wire ambiguity before feature policy

Validation has a deliberate order. First validate the JSON-RPC shape and require string protocol metadata plus an object client capability map. Next compare routing headers with the body. Only then decide whether the matched protocol version is supported. This order prevents a proxy and server from interpreting different requests.

| Condition | HTTP | JSON-RPC error |
|-----------|------|----------------|
| Header and body version, method, or name disagree | 400 | `-32020` |
| Header and body agree on an unsupported version | 400 | `-32022`, with `data` exactly `{"supported":["2026-07-28"],"requested":"<actual>"}` |
| `resources/read` lacks the Apps extension capability | 400 | `-32021`, with `data.requiredCapabilities.extensions.io.modelcontextprotocol/ui` |
| Method is unknown | 404 | `-32601` |

A JSON-RPC notification has no `id`, so the server never emits a JSON-RPC response for it. An accepted HTTP notification returns 202 with an empty body. An error can change the HTTP status, but it still cannot create a JSON-RPC error body for a notification.

### The sandbox is a boundary, not a trust verdict

A host controls the iframe. The App cannot directly read host cookies, local storage, or page DOM. All privileged work must cross the bridge.

Use these defaults:

- Leave all CSP domain lists empty, then add only the origins the App needs. Use `connectDomains` for fetch, XHR, and WebSocket; use `resourceDomains` for scripts, styles, images, and fonts.
- Bundle code and data when practical.
- Request no camera, microphone, or location permission unless a visible feature needs it.
- Pin `postMessage` to the exact peer origin and reject events from every other origin.
- Treat tool arguments, tool results, resource text, and bridge messages as untrusted input.
- Keep user consent in the host. The iframe cannot approve its own consequential action.

Do not copy a fixed `sandbox` attribute from a tutorial into every host. The host must choose flags based on the App's origin model and its own isolation design.

An allowed domain is still an exfiltration path. `connectDomains: ["https://api.example.com"]` means any script that executes inside the App can send permitted data there. Exact origin matching prevents destination confusion, but it does not decide whether the payload is appropriate. Keep connect access empty by default, avoid placing bearer tokens in the iframe, proxy narrow operations through the host when practical, limit response and request sizes, and audit which user action caused each outbound request. Treat `resourceDomains` separately from `connectDomains`; permission to load a font or script should not grant arbitrary data upload.

### The Apps bridge has its own lifecycle

The Apps bridge is a JSON-RPC dialect over `postMessage`. It can exchange `ui/initialize` and `ui/*` notifications and can proxy core-looking methods such as `tools/call`.

The View sends `ui/initialize` with `appInfo` and an `appCapabilities` object. The host returns its capabilities and host context. Only after that response does the View send `ui/notifications/initialized`. The host must wait for this Apps notification before sending messages to the View.

That local handshake creates a bridge between one iframe and one host frame. It does not negotiate the MCP protocol version, create server state, or mint a transport session. Notice the exact prefix: core `notifications/initialized` was removed, while Apps `ui/notifications/initialized` remains. A core request generated by a bridged tool call is a new self-contained request with a new JSON-RPC id and full request metadata.

### Host context, actions, and revocation

The host remains the authority after bridge initialization. A View can request a tool action, navigation, clipboard use, or another privileged effect only through a capability the host advertised. The host validates the typed request, current user, target, and arguments, applies approval policy, and may refuse it. A button click and a valid bridge message express intent; neither grants authority.

Treat theme, size, and accessibility as changing host context rather than one-time render inputs:

- Apply host-provided color and typography tokens, then react when theme or contrast preference changes.
- Let the View report desired dimensions, but let the host cap and apply iframe size so content cannot escape its layout or create deceptive overlays.
- Preserve keyboard order, visible focus, accessible names, screen-reader status, sufficient contrast, zoom, and reduced-motion behavior inside the iframe.
- Re-test focus transfer between host controls and View controls after resize and rerender.

Capabilities can be revoked while the App is open because the user changes account, policy changes, a server is quarantined, or the host narrows consent. Check capability and authorization at action time, not only during `ui/initialize`. On revocation, reject pending privileged calls, stop network activity that no longer fits policy, clear sensitive rendered state, and remount or fall back to text when the UI resource itself is no longer admitted. A View must handle refusal as a normal result, not retry until the host gives in.

### Fallback is part of the contract

An Apps-aware server can still serve hosts that do not advertise the UI extension:

- Return the same tool without `_meta.ui` in `tools/list`.
- Keep a useful text result for `tools/call`.
- Refuse `resources/read` for the UI with a missing-capability error.
- Never assume an iframe exists when deciding whether the tool completed.

```figure
t3-ui-sandbox
```

## Build It

`code/main.py` builds a small in-process protocol model without an SDK. It validates the current request envelope and Streamable HTTP routing values, advertises Apps through `server/discover`, lists tools and resources, executes the tool, and serves a self-contained HTML resource.

The model receives already parsed bodies and routing headers. It is not a complete HTTP adapter and does not parse `Content-Type` or `Accept`. Use Lesson 09 for the full Streamable HTTP adapter that requires `Content-Type: application/json` and an `Accept` value containing both `application/json` and `text/event-stream`.

Run it:

```bash
cd phases/13-tools-and-protocols/14-mcp-apps
python3 code/main.py
python3 -m unittest discover code/tests -v
```

Inspect four things in the output:

1. Every call is independent.
2. Every request has `_meta` capabilities.
3. `resources/list` returns a stable descriptor before any resource read.
4. Every result has `resultType` and server identity metadata.
5. No core session identifier appears.

## Use It

Start with `server/discover`. Confirm `io.modelcontextprotocol/ui` appears in the server extension map. Then call `tools/list` twice, once with Apps capability and once without it. The first response declares the resource. The second remains a usable text-only tool.

Read `ui://notes/timeline.html`. Search the HTML for `hostOrigin` and the `event.origin` guard. Those two lines are the minimum visible proof that the bridge does not use a wildcard target.

## Ship It

This lesson ships `outputs/skill-mcp-apps-spec.md`. Use it to review an App contract before writing framework code. It forces the author to state the current core envelope, extension negotiation, fallback, UI resource, cache policy, CSP, permissions, bridge methods, and consent boundary.

## Exercises

1. Change the client capability to an empty extension map. Confirm `tools/list` keeps the tool but removes the UI binding.
2. Send `Mcp-Name: ui://notes/other.html` with a body that reads the timeline. Confirm error `-32020`.
3. Change the resource to `cacheScope: private`. Describe the user-specific condition that justifies it.
4. Move the script to `https://static.example.com/app.js`. Add that origin to `resourceDomains` and explain the new supply-chain risk.
5. Add an `notes_open` tool and route the button click through the host. Keep user approval in the host.

## Key Terms

| Term | Meaning |
|------|---------|
| MCP Apps | Optional extension for interactive HTML rendered by an MCP host |
| `io.modelcontextprotocol/ui` | Extension identifier advertised by both peers |
| `ui://` | Resource scheme for an App's UI template |
| `text/html;profile=mcp-app` | MIME type for MCP App HTML |
| `server/discover` | Current RPC for protocol and capability discovery |
| `resources/list` | Mandatory resource listing method when the server advertises resources |
| `resultType` | Required discriminator for modern successful results |
| `ui/initialize` | First Apps bridge request, separate from removed core initialization |
| `ui/notifications/initialized` | Apps View readiness notification sent after the host responds |
| CSP | Browser policy that restricts scripts, styles, images, and network origins |
| Text fallback | Tool behavior retained for a host without Apps support |

## Further Reading

- [MCP 2026-07-28 base protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic)
- [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview)
- [MCP Apps build guide](https://modelcontextprotocol.io/extensions/apps/build)
- [Official extension support matrix](https://modelcontextprotocol.io/extensions/client-matrix)
