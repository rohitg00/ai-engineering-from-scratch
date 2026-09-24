# Architecture Roles Map

A one-page reference for the MCPA "Architecture and Components" domain, aligned to MCP 2026-07-28.

## The three participants

| Role | What it is | Responsible for |
|------|------------|------------------|
| Host | The application process the user works in (a chat assistant, an IDE, a batch pipeline) | Creating and managing clients, enforcing security and consent, aggregating context across servers, coordinating the model |
| Client | An object the host creates, one per server connection | Attaching protocol version and capabilities to every request, keeping one server's data isolated from another's |
| Server | A separate program that exposes context and capabilities | Implementing tools, resources, prompts, and completion; declaring its own capabilities; never seeing the full conversation |

Rule to keep: one client, one connection, one server. A host with five connected servers runs five clients, never one client juggling five conversations.

## Local versus remote servers

| | Local server | Remote server |
|---|---|---|
| Transport | stdio (subprocess, newline-delimited JSON-RPC) | Streamable HTTP (POST per message, optional SSE) |
| Boundary that carries trust | Process boundary, same machine | Network boundary, a separate origin |
| Typical client count | Usually one client for the life of the process | Often many clients across many host instances |
| Credentials | Read from the environment; stdio implementations should not run the OAuth flow | Bearer token from an OAuth 2.1 flow is the recommended path |

## Server features versus client features

| Feature | Side | Who controls it | Status in 2026-07-28 |
|---|---|---|---|
| Tools | Server | Model | Active |
| Resources | Server | Application | Active |
| Prompts | Server | User | Active |
| Completion | Server | Application (autocomplete for arguments) | Active |
| Elicitation | Client | User, through an MRTR round trip | Active |
| Sampling | Client | User approves, client mediates | Deprecated, migrate to calling LLM provider APIs directly |
| Roots | Client | Host, advisory only | Deprecated, migrate to tool parameters, resource URIs, or server configuration |

## Aggregation checklist for a host with many servers

1. Discover every connected server independently with `server/discover`; never assume one server's capabilities apply to another.
2. Build the tool registry from `tools/list` only for servers that actually declared a `tools` capability.
3. Key every registry entry, and every routing decision, by the connection identifier the host itself assigned when it connected, such as a config key or a slot index. Never key on `serverInfo.name`: it is self-reported, and two independently written servers can report the same name.
4. Keep tool names unique within a server, but expect collisions across servers. On a collision, keep the first server's name as the canonical, bare entry and expose every later collision as `<server-id>/<tool-name>`.
5. Route a call by looking up its registry entry, then sending `tools/call` to the one connection that owns it. The receiving server still enforces its own errors (unknown tool is `-32602`, a bad argument is a tool execution error) independently of how the host aggregated it.
6. Treat a server's tools, resources, and prompts as isolated from every other server's. The host is the only party that sees across all of them.

## Remember for the exam

- A host embeds one client per server; a client never serves two servers.
- Tools are model-controlled, resources are application-driven, prompts are user-controlled.
- Sampling and roots are deprecated in 2026-07-28, not removed; both are still functional.
- `serverInfo.name` is for display and logging, never for identity or routing.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 4, 6, and 10.
