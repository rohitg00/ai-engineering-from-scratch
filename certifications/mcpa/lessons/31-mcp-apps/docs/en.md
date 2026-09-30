# Interactive Interfaces Inside the Conversation

> A tool result does not have to stop at text: a server can point at a small HTML interface and let the host render it, sandboxed, right where the conversation is already happening.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 30
**Time:** ~45 minutes

## Learning Objectives

- Explain what an interactive interface adds beyond a tool's ordinary text and structured content, and recognize the use cases where reaching for one pays off
- Negotiate the `io.modelcontextprotocol/ui` extension per request and trace a `ui://` resource from a tool's `_meta.ui.resourceUri` through an ordinary `resources/read` call
- Read a UI resource's `_meta.ui.csp` domain lists and `_meta.ui.permissions` flags, and construct the Content Security Policy a host must enforce, including its restrictive default
- Enforce a tool's `visibility` so the agent's tool list and an app's own `tools/call` requests only ever see what each side is allowed to see
- Describe the sandboxed iframe security model, the app-to-host bridge, and why an app-initiated tool call still crosses a consent boundary
- Design a fallback so a UI-capable tool keeps working for a host that never declares the extension

## The Problem

A dashboard tool that answers "show me sales by region" can return a paragraph of numbers, or it can return a small table wrapped in `structuredContent`. Neither one lets a user click a region to drill in, hover a bar for the exact figure, or flip between metrics without asking the model to run the tool again for every click. A configuration tool faces the same ceiling from the other direction: turning "which region, which instance size, autoscaling or not" into a back-and-forth conversation is slower and more error-prone than a form the user fills out once, with defaults and validation visible up front.

Text and structured content remain the right choice for most tools. The gap they leave is narrow but real: results a user wants to explore, not just read, and choices a user wants to make with everything visible at once, not one question at a time. MCP Apps closes that gap with an optional extension, not a new transport or a second protocol standing next to MCP. It reuses two primitives this track already covers, a tool and a resource, and adds one rule for how a host renders what it fetches.

## The Concept

The extension identifier is `io.modelcontextprotocol/ui`. It negotiates exactly the way every extension negotiates, the same per-request declaration lesson 30 walked through for extensions in general: a client declares support in `io.modelcontextprotocol/clientCapabilities.extensions` on the requests it sends, and a server declares its own support in `capabilities.extensions` from `server/discover`. Declaring the extension does not depend on any earlier request. It is per request, the same as the protocol version and every other capability.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "server/discover",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {"io.modelcontextprotocol/ui": {}}
      }
    }
  }
}
```

A server that supports the extension answers with `capabilities.extensions` naming the same identifier, alongside whatever `tools` and `resources` capabilities it already advertises. That answer does not depend on what the caller declared either: `server/discover` reports what the server can do, and a client works out what is actually usable by intersecting that with what it itself supports. A host that never declares the extension gets the identical discovery result; it simply never acts on the part of it that names an extension it does not implement.

A UI-capable tool carries one extra field in its definition, `_meta.ui.resourceUri`, pointing at a `ui://` resource. This is static per-tool metadata, part of the same `tools/list` entry every client receives, so it does not vary by who is asking any more than the rest of a tool's definition does. Because the binding is visible before the tool is ever called, a host can preload and review the resource ahead of time instead of discovering it only after the model decides to invoke the tool.

A tool's `_meta.ui` can also carry `visibility`, an array that defaults to `["model", "app"]` when the field is absent. A tool visible to `"model"` is the one the agent can see and decide to call, the ordinary case this track has covered since lesson 11. A tool visible to `"app"` is one the rendered app itself may call directly, through the bridge, without asking the model to take a turn. The two are independent gates a host enforces on two different lists: a tool whose visibility drops `"model"` never appears in the agent's own tool list at all, and a tool whose visibility drops `"app"` still appears to the model as normal, but the host rejects a `tools/call` an app tries to place against it. A cross-server call to an app-only tool, one whose server does not match the app's own, is blocked outright, regardless of visibility.

Fetching that resource uses no special method. The host reads it the same way it reads any other resource, through `resources/read`, and the result must carry `mimeType` set to exactly `text/html;profile=mcp-app`. That profile parameter is what marks the document as a renderable app rather than an arbitrary HTML page a browser happens to be able to open; a resource that answers with plain `text/html` is not one, no matter how well-formed its markup is, and a careful host checks the mime type on every fetch rather than trusting the `ui://` scheme alone.

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "resultType": "complete",
    "contents": [
      {
        "uri": "ui://dashboard/sales-by-region.html",
        "mimeType": "text/html;profile=mcp-app",
        "text": "<!doctype html>...",
        "_meta": {
          "ui": {
            "csp": {
              "connectDomains": ["https://api.sales-metrics.example"],
              "resourceDomains": ["https://cdn.trusted-charts.example"]
            },
            "permissions": {"camera": {}, "geolocation": {}},
            "prefersBorder": true
          }
        }
      }
    ],
    "ttlMs": 60000,
    "cacheScope": "public"
  }
}
```

The same resource carries the fields that govern how the host may render it, all inside `_meta.ui`. `csp` is an object, not a flat list: `connectDomains` covers fetch, XHR, and WebSocket; `resourceDomains` covers scripts, styles, images, and fonts; `frameDomains` covers nested iframes; `baseUriDomains` covers the document's own base URI. Every key is optional. A host MUST construct its Content Security Policy from exactly the domains a resource declares and MUST NOT allow a domain the resource never named; declaring a domain is not the same as getting it, because the host MAY still further restrict what it actually honors, as a matter of its own policy, not because the wire failed. If `csp` is omitted entirely, a host MUST fall back to a restrictive default that blocks everything but same-origin content and inline styles and scripts, with no outbound connections at all. Missing `frameDomains` always means `frame-src 'none'`, and missing `baseUriDomains` always means `base-uri 'self'`, whether or not the rest of `csp` is present. A host SHOULD log the CSP it ends up constructing for later security review.

`permissions` is a second object, one optional empty-object flag per capability: `camera`, `microphone`, `geolocation`, `clipboardWrite`. A host MAY honor any of them by setting the iframe's `allow` attribute accordingly, and an app SHOULD NOT assume a requested permission was actually granted; it degrades the same way any web page does when a permission prompt is denied. Rendering does not wait on permissions the way it waits on the mime type: a resource that asks for a permission the host will not grant still renders, just without that capability.

Once rendered, the app and the host talk over their own JSON-RPC dialect, carried over `postMessage`, not over the client-server connection this curriculum otherwise covers. Some of its messages share a name with the core protocol, such as `tools/call`; most are new, with a `ui/` prefix, such as `ui/initialize`, which sets up the channel between one iframe and the host frame that embeds it. That local handshake is unrelated to the core `initialize` request, which does not exist in 2026-07-28: it never negotiates a protocol version, never creates a session, and never touches the stateless client-server wire this track has covered since lesson 04. When the host is a web page, it MUST NOT talk to the view directly either: it wraps the view in an intermediate sandbox proxy on a different origin from the host's own, and that proxy is what actually forwards bridge messages in both directions.

Through that bridge, the app can ask the host to place a tool call on its behalf, but only against a tool whose visibility includes `"app"` in the first place. The host is still the one that decides: it forwards the request to the server as an ordinary `tools/call`, with a fresh id and full `_meta`, only after the same consent a user would apply to any tool invocation, and it can decline outright. The iframe cannot approve its own consequential action; it can only ask, and the host answers.

This is also the shape of the security argument for choosing an app over a plain linked webpage. The iframe cannot read the host page's cookies, local storage, or DOM, and it cannot navigate the parent page or run script in its context; every privileged action must cross the mediated bridge. That isolation is what lets a host safely render an app from a server it has not audited line by line, the same way it already renders untrusted tool results and resource text without letting them dictate what the model or the user ultimately does, the trust-boundary discipline lesson 22 already established.

None of this is mandatory for a tool to keep working. A UI-capable tool still returns a useful `content` text answer from every `tools/call`, and a host that never declared the extension simply never reads the `ui://` resource: it uses that text the way it would for any other tool, and the extension's own rule applies, the side without support falls back to core behavior rather than the request failing.

```figure
mcpa-31-app-sandbox
```

## Interactive Lab

The figure follows one tool call through both branches at once. On the left, a host that declared the extension reads the tool's `_meta.ui.resourceUri` through an ordinary `resources/read`, checks the mime type, and constructs a Content Security Policy from the declared domains, narrowed further by its own policy, before rendering inside the sandboxed iframe; a dashed line marks the consent gate an app-initiated tool call must still cross, on top of the tool's own visibility, before it reaches the server. On the right, a host that never declared the extension stops after the plain `tools/call` and renders the same tool's text content, never touching the resource at all.

## Practice Lab

Open `code/main.py`. A single server exposes three tools bound to one dashboard view: `sales_by_region` (default visibility, both model and app), `refresh_sales_view` (`visibility: ["app"]`, hidden from the agent), and `export_sales_report` (`visibility: ["model"]`, unreachable from inside the app). It also exposes four resources: the tool's real `ui://` view, a `legacy-widget` resource that answers with plain `text/html` instead of the app profile, a `scripts-widget` resource whose CSP names a domain outside the host's own policy, and a `minimal-widget` resource that omits `csp` entirely.

```bash
python3 code/main.py
```

`HostAppLoader.load` runs the full decision twice on the same tool and arguments, once with the extension declared and once without, so the two plans in the printed output are directly comparable: one is `{"mode": "app", ...}` built from a real `resources/read`, carrying a constructed `csp` string and a `grantedPermissions` list that is a strict subset of what the resource asked for; the other is `{"mode": "text", ...}` that never issues that call at all. `review_app_resource` and `build_csp` run separately against the flawed and minimal resources and explain, in plain text, which check each one fails or which default applies. Near the bottom, `request_tool_call_from_app` shows two independent gates: a call against `export_sales_report` is refused for missing `"app"` in its visibility before consent is even considered, while a call against `refresh_sales_view` is refused when declined and forwarded with a fresh id when approved. Compare the two `tools/call` entries for the same tool and confirm every request still carries its own `_meta`, extension declaration included, with nothing remembered between them.

## Shipped Artifact

`outputs/mcp-apps-review-checklist.md` is a one-page review checklist: what to confirm before trusting a `ui://` resource enough to render it, the fallback a UI-capable tool must keep, and a short decision table mapping each check's outcome to render, fall back, or reject. Keep it next to a server's tool descriptions when a tool declares `_meta.ui`.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: the extension is negotiated only when both sides declare it, a tool's UI binding appears in `tools/list` no matter who is asking, an omitted `visibility` defaults to both `"model"` and `"app"`, the agent's own tool list excludes an app-only tool, an app-aware host resolves the resource through exactly one `resources/read`, a host without the extension falls back to text and skips that call entirely, a resource with the wrong mime type is rejected even though the read itself succeeds, a resource whose CSP names a domain outside the host's policy is rejected and says which domain, `build_csp` constructs the right directives from declared domains and falls back to the restrictive default when `csp` is omitted, granted permissions never exceed the host's own policy, a declined app-initiated tool call never reaches the wire, an approved one is forwarded with a fresh id, a call against a tool whose visibility excludes `"app"` is refused before consent is even asked, an unknown resource is a protocol error, and every cacheable result carries `ttlMs` and `cacheScope`. The repository's wire checker also validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/31-mcp-apps
```

## Capstone Connection

The capstone's end-to-end exchange can include a UI-capable tool among its calls, and every question this lesson raises still applies there: has the extension actually been negotiated on this request, does the fetched resource carry the exact mime type before anything renders, and does an app-initiated call still cross the same consent gate the capstone already enforces for every other tool invocation.

## Key Terms

| Term | Meaning |
|------|---------|
| MCP Apps | The optional extension that lets a tool point at an interactive HTML interface the host renders |
| `io.modelcontextprotocol/ui` | The extension identifier both client and server declare to negotiate MCP Apps |
| `ui://` | The URI scheme reserved for an app's UI resource |
| `_meta.ui.resourceUri` | The field on a tool definition that points at its `ui://` resource |
| `text/html;profile=mcp-app` | The exact mime type that marks a fetched resource as a renderable app |
| `_meta.ui.csp` | An object of optional domain lists (`connectDomains`, `resourceDomains`, `frameDomains`, `baseUriDomains`) a host builds its Content Security Policy from |
| `_meta.ui.permissions` | An object of optional empty-object flags (`camera`, `microphone`, `geolocation`, `clipboardWrite`) a host may honor |
| `visibility` | A tool's `_meta.ui` array, `["model", "app"]` by default, gating the agent's tool list and an app's own `tools/call` requests separately |
| Sandboxed iframe | The isolated frame a host renders an app inside, with no direct access to the host page |
| Sandbox proxy | The different-origin intermediary a web host MUST use between itself and a rendered view |
| App-to-host bridge | The JSON-RPC dialect over `postMessage` that an app and its host use, separate from the client-server wire |
| Text fallback | The plain `content` result a UI-capable tool still returns for a host without the extension |

## Further Reading

- [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview)
- [Build an MCP App](https://modelcontextprotocol.io/extensions/apps/build)
- [SEP-1865: MCP Apps, Interactive User Interfaces for MCP](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp)
- [MCP Apps specification, 2026-01-26](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 14
- `phases/13-tools-and-protocols/14-mcp-apps`, which builds a full request-and-resource server and a stricter Streamable HTTP adapter around the same extension
