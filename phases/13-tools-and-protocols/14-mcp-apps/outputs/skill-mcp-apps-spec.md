---
name: mcp-apps-spec
description: Design and review an MCP App contract on the stateless 2026-07-28 protocol.
version: 2.0.0
phase: 13
lesson: 14
tags: [mcp, apps, stateless, ui-resources, csp, sandbox]
---

Given an MCP tool that may need an interactive view, produce a framework-neutral contract.

## Required inputs

- Tool name, arguments, ordinary text result, and structured result.
- User interactions the view must support.
- Data sensitivity and whether responses vary by authorization context.
- Browser permissions and external origins the view needs.
- Text-only behavior for hosts without Apps support.

## Produce

1. Current core envelope. Show `2026-07-28`, per-request `protocolVersion`, `clientCapabilities`, recommended `clientInfo`, matching `Mcp-Method` and `Mcp-Name` headers, and `resultType` responses.
2. Discovery entry. Advertise `io.modelcontextprotocol/ui` in `server/discover`, with conservative `ttlMs` and `cacheScope`.
3. Tool declaration. Put nested `_meta.ui.resourceUri` on the tool returned by `tools/list`. Do not wait for `tools/call` to reveal the UI.
4. Resource contract. Include deterministic `resources/list` metadata before `resources/read`. Give one canonical `ui://` URI, stable name and description, `text/html;profile=mcp-app`, cache hints, CSP domain lists (`connectDomains`, `resourceDomains`, `frameDomains`, `baseUriDomains`), and the minimum permissions object.
5. Result contract. Return useful text and structured data whether or not the host renders the App.
6. Bridge contract. List every Apps `ui/*` or proxied method, exact message origin, argument schema, result schema, and host-side consent check.
7. Fallback. Describe the tool and result when the client omits the Apps extension capability.
8. Verification table. Cover HTTP 400 `-32020` header mismatch before routing, HTTP 400 `-32022` with exact supported and requested version data, HTTP 400 `-32021` with `data.requiredCapabilities`, HTTP 404 `-32601`, 202 empty-body notifications, CSP violation, untrusted content, unauthorized bridge calls, and text fallback.
9. Transport boundary. If the implementation receives parsed requests and headers, label it an in-process protocol model and connect it to Lesson 09's complete Streamable HTTP adapter. A real adapter must require JSON Content-Type and an Accept value containing JSON plus SSE.

## Hard rejects

- A core `initialize`, `notifications/initialized`, or `Mcp-Session-Id` path presented as current MCP.
- A wildcard `postMessage` target origin or a receiver that skips `event.origin` validation.
- A UI binding revealed only after the tool runs.
- Wildcard CSP domain lists, unbounded network origins, or permissions without a visible feature.
- User-controlled HTML inserted without a defined sanitization boundary.
- A consequential UI action that treats an iframe click as host authorization.
- A server that advertises resources but omits `resources/list`.
- Any JSON-RPC response body for a notification without an `id`.

## Compatibility boundary

Legacy flat UI metadata may be read as a fallback, but new output uses nested `_meta.ui.resourceUri`. `ui/initialize` is allowed only when identified as the Apps postMessage handshake. It never stands in for removed MCP core initialization.

## Output format

Return a compact design with these headings: Core Wire, Discovery, Tool, Resource, Result, Bridge, Security, Fallback, Verification. End with the single riskiest origin, permission, or consent assumption.
