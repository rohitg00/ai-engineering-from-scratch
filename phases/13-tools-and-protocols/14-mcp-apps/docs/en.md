# MCP Apps — Interactive UI Resources via `ui://`

> Text-only tool output caps what agents can show. MCP Apps (SEP-1724, official January 26, 2026) let a tool return sandboxed interactive HTML rendered inline in Claude Desktop, ChatGPT, Cursor, Goose, and VS Code. Dashboards, forms, maps, 3D scenes, all through one extension. This lesson walks the `ui://` resource scheme, the `text/html;profile=mcp-app` MIME, the iframe-sandbox postMessage protocol, and the security surface that comes with letting a server render HTML.

**Type:** Build
**Languages:** Python (stdlib, UI resource emitter), HTML (sample app)
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 10 (resources)
**Time:** ~75 minutes

## Learning Objectives

- Return a `ui://` resource from a tool call and set the correct MIME and metadata.
- Declare a tool's associated UI with `_meta.ui.resourceUri`, `_meta.ui.csp`, and `_meta.ui.permissions`.
- Implement the iframe sandbox postMessage JSON-RPC for UI-to-host communication.
- Apply CSP and permissions-policy defaults that defend against UI-originated attacks.

## The Problem

A 2025-era `visualize_timeline` tool can return "Here are 14 notes organized chronologically: ...". That is a paragraph. Users actually want the interactive timeline. Before MCP Apps, the options were: client-specific widget APIs (Claude artifacts, OpenAI Custom GPT HTML), or no UI at all.

MCP Apps (SEP-1724, shipped January 26, 2026) standardize the contract. A tool result contains a `resource` whose URI is `ui://...` and whose MIME is `text/html;profile=mcp-app`. The host renders it in a sandboxed iframe with a limited CSP and no network access unless explicitly granted. The UI inside the iframe posts messages to the host via a tiny postMessage JSON-RPC dialect.

Every compatible client (Claude Desktop, ChatGPT, Goose, VS Code) renders the same `ui://` resource the same way. One server, one HTML bundle, universal UI.

## The Concept

### The `ui://` resource scheme

A tool returns:

```json
{
  "content": [
    {"type": "text", "text": "Here is your notes timeline:"},
    {"type": "ui_resource", "uri": "ui://notes/timeline"}
  ],
  "_meta": {
    "ui": {
      "resourceUri": "ui://notes/timeline",
      "csp": {
        "defaultSrc": "'self'",
        "scriptSrc": "'self' 'unsafe-inline'",
        "connectSrc": "'self'"
      },
      "permissions": []
    }
  }
}
```

The host then calls `resources/read` on the `ui://notes/timeline` URI and gets back:

```json
{
  "contents": [{
    "uri": "ui://notes/timeline",
    "mimeType": "text/html;profile=mcp-app",
    "text": "<!doctype html>..."
  }]
}
```

### Iframe sandbox

The host renders the HTML inside a sandboxed `<iframe>` with:

- `sandbox="allow-scripts allow-same-origin"` (or stricter per server declaration)
- Server-declared CSP applied via response headers.
- No cookies, no localStorage from the host's origin.
- Network access limited to `connectSrc` in CSP.

### postMessage protocol

The iframe communicates with the host via `window.postMessage`. A tiny JSON-RPC 2.0 dialect:

Always pin `targetOrigin` to the peer's exact origin, and on the receiving side validate `event.origin` against an allowlist before processing any payload. Never use `"*"` for either side of this channel — the body carries tool calls and resource reads.

```js
// iframe to host  (pin to host origin)
window.parent.postMessage({
  jsonrpc: "2.0",
  id: 1,
  method: "host.callTool",
  params: { name: "notes_update", arguments: { id: "note-14", title: "..." } }
}, "https://host.example.com");

// host to iframe  (pin to iframe origin)
iframe.contentWindow.postMessage({
  jsonrpc: "2.0",
  id: 1,
  result: { content: [...] }
}, "https://iframe.example.com");

// receiver on both sides
window.addEventListener("message", (event) => {
  if (event.origin !== "https://expected-peer.example.com") return;
  // safe to process event.data
});
```

Available host-side methods the UI can call:

- `host.callTool(name, arguments)` — invokes a server tool.
- `host.readResource(uri)` — reads an MCP resource.
- `host.getPrompt(name, arguments)` — fetches a prompt template.
- `host.close()` — dismisses the UI.

Every call still goes through the MCP protocol and inherits the server's permissions.

### Permissions

The `_meta.ui.permissions` list requests extra capabilities:

- `camera` — access the user's camera (used for scan-a-document UIs).
- `microphone` — voice input.
- `geolocation` — location.
- `network:*` — wider network access than `connectSrc` alone allows.

Each permission is a prompt the user sees before the UI renders.

### Security risks

HTML in an iframe is still HTML. New attack surface:

- **Prompt-injection via UI.** A malicious server UI can show text that looks like a system message and tricks the user. Host rendering should visibly distinguish server UI from host UI.
- **Exfiltration via `connectSrc`.** If CSP permits `connect-src: *`, the UI can send data anywhere. Default should be strict.
- **Clickjacking.** The UI overlays host chrome. Hosts must prevent z-index manipulation and enforce opacity rules.
- **Steal focus.** UI takes keyboard focus and captures the next message. Hosts must intercept.

Phase 13 · 15 covers these in depth as part of MCP security; this lesson introduces them.

### `ui/initialize` handshake

After the iframe loads, it sends `ui/initialize` over postMessage:

```json
{"jsonrpc": "2.0", "id": 0, "method": "ui/initialize",
 "params": {"theme": "dark", "locale": "en-US", "sessionId": "..."}}
```

Host responds with capabilities and a session token. The UI uses the session token on every subsequent host call.

### AppRenderer / AppFrame SDK primitives

The ext-apps SDK exposes two convenience primitives:

- `AppRenderer` (server side) — wraps a React / Vue / Solid component and emits a `ui://` resource with the right MIME and metadata.
- `AppFrame` (client side) — receives the resource, mounts the iframe, and mediates postMessage.

You can use these or hand-roll the HTML and JSON-RPC.

### Ecosystem status

MCP Apps shipped January 26, 2026. Client support as of April 2026:

- **Claude Desktop.** Full support since January 2026.
- **ChatGPT.** Full support via the Apps SDK (same underlying MCP Apps protocol).
- **Cursor.** Beta; enable via settings.
- **VS Code.** Insider builds only.
- **Goose.** Full support.
- **Zed, Windsurf.** Roadmapped.

Servers in production: dashboards, map visualizations, data tables, chart builders, sandbox IDE previews.

## Use It

`code/main.py` extends the notes server with a `visualize_timeline` tool that returns a `ui://notes/timeline` resource, plus a handler for `resources/read` on that URI which returns a small but complete HTML bundle with an SVG timeline. The HTML is stdlib-templated — no build system. postMessage is sketched in JS comments since stdlib cannot drive a browser.

What to look at:

- `_meta.ui` on the tool response carries resourceUri, CSP, permissions.
- The HTML renders without network access; all data is inlined.
- JS calls `host.callTool` via `window.parent.postMessage` (documented but inert in this stdlib demo).

## Ship It

This lesson produces `outputs/skill-mcp-apps-spec.md`. Given a tool that would benefit from an interactive UI, the skill produces the full MCP Apps contract: `ui://` URI, CSP, permissions, postMessage entrypoints, and a security checklist.

## Exercises

1. Run `code/main.py` and inspect the HTML emitted. Open the HTML directly in a browser; verify the SVG renders. Then sketch the postMessage contract the UI would use to call `host.callTool("notes_update", ...)`.

2. Tighten the CSP: remove `'unsafe-inline'` and use a nonce-based script policy. What changes in the HTML generation code?

3. Add a second UI resource `ui://notes/editor` with a form for editing a note in place. When the user submits, the iframe calls `host.callTool("notes_update", ...)`.

4. Audit the UI's attack surface. Where could a malicious server inject content? What does the iframe sandbox defend against and what does it not?

5. Read the SEP-1724 spec and identify one capability in the MCP Apps SDK that this toy implementation does not use. (Hint: component-level state sync.)

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MCP Apps | "Interactive UI resources" | SEP-1724 extension shipped 2026-01-26 |
| `ui://` | "App URI scheme" | Resource scheme for UI bundles |
| `text/html;profile=mcp-app` | "The MIME" | Content-type for MCP App HTML |
| Iframe sandbox | "Render container" | Browser sandboxing of the UI with CSP and permissions |
| postMessage JSON-RPC | "UI-to-host wire" | Tiny JSON-RPC-over-postMessage dialect for host calls |
| `_meta.ui` | "Tool-UI binding" | Metadata linking a tool result to a UI resource |
| CSP | "Content-Security-Policy" | Declares allowed sources for scripts, network, styles |
| AppRenderer | "Server SDK primitive" | Converts a framework component into a `ui://` resource |
| AppFrame | "Client SDK primitive" | Iframe mount helper that mediates postMessage |
| `ui/initialize` | "Handshake" | First postMessage from UI to host |

## Further Reading

- [MCP ext-apps — GitHub](https://github.com/modelcontextprotocol/ext-apps) — reference implementation and SDK
- [MCP Apps specification 2026-01-26](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) — formal spec document
- [MCP — Apps extension overview](https://modelcontextprotocol.io/extensions/apps/overview) — high-level documentation
- [MCP blog — MCP Apps launch](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) — January 2026 launch post
- [MCP Apps API reference](https://apps.extensions.modelcontextprotocol.io/api/) — JSDoc-style SDK reference
