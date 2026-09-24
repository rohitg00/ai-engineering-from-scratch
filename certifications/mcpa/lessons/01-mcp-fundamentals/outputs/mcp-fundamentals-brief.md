# MCP Fundamentals Field Brief

A one-page reference for the MCPA "MCP Fundamentals" domain (16 percent of the exam).

## The four roles, one sentence each

- **Host**: the application the user interacts with; it embeds one or more clients.
- **Client**: a component inside the host that holds exactly one connection to one server.
- **Server**: a separate program that exposes capabilities such as tools, resources, and prompts.
- **Tool**: a named, described, schema-typed action a model can ask the server to run.

## The flow

1. **Handshake**: client and server exchange protocol version and capabilities (`initialize`).
2. **Discovery**: client asks for the tool list; server returns each tool with a name, description, and input schema (`tools/list`).
3. **Invocation**: client sends a call; server runs the tool and returns a result, or a JSON-RPC error for a bad request (`tools/call`).

Messages ride on JSON-RPC 2.0: a request carries `method` and `params`; a response carries `result` or `error` keyed to the request `id`.

## Why standardize

Custom integrations are an N times M problem: N models times M systems means N times M pieces of glue, each with its own format and security assumptions. MCP makes it N plus M: a host speaks MCP once, a server exposes MCP once, and any host can drive any server. Interoperability is the reason the protocol exists, not a feature added later.

## The trust boundary

The host and its client are inside your application. The server is separate, often third-party. When a tool result crosses back, untrusted content enters the model's context. Every security control in later domains sits on that boundary.

## Exam facts for this domain

- The exam is aligned to MCP specification 2026-07-28.
- Source: MCPA certification page and launch announcement; see `certifications/mcpa/research/source-verification-ledger.md`.
