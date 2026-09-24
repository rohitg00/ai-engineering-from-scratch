# MCP Architecture Map

A one-page reference for the MCPA "Architecture and Components" domain (14 percent of the exam).

## The roles, restated for process topology

- **Host process**: the single application process the user runs. It embeds one or more clients and owns none of the servers directly.
- **Client**: an object inside the host that owns exactly one connection to exactly one server, for the life of that connection.
- **Server process**: a separate program that declares its own protocol version, capabilities, and tools. It never shares memory or state with the host.
- **Connection**: the negotiated link between one client and one server, opened by `initialize` and closed independently of every other connection the host holds.

## The process and trust boundary

A host with three servers runs one process with three clients inside it, wired to three separate server processes, not three servers sharing one connection. The process boundary and the trust boundary usually line up: a server is often written by a different team or company, so its output is never assumed safe just because the connection succeeded. Anything that crosses back from a server, a tool result, a capability claim, a schema, is untrusted content entering the host from outside its own process.

## The handshake fields

Every connection opens the same way:

1. **Request**: the client sends `initialize` with `protocolVersion`, the version it speaks (`2026-07-28` for this curriculum).
2. **Match**: the server compares that version against its own. A mismatch returns a structured JSON-RPC error, not a silent coercion and not a crash; the connection is treated as never opened.
3. **Response**: on a match, the server returns `serverInfo` (naming itself) and `capabilities` (what it supports for this connection: tools, whether the tool list can change, resources, prompts). Each server declares its own capabilities; nothing is assumed across servers.
4. **Discovery**: the client can now call `tools/list`. The host folds every connected server's tool list into one directory, tool name to owning server, and uses that directory to route each `tools/call` to the one client that owns the right connection.

## Why the topology matters

One client per server keeps a version mismatch, a capability claim, or a bad tool result contained to the connection it came from. Flattening several servers behind one connection would let a capability declared by one server leak into a session with another, or let a version negotiated with one server get silently applied to a different one. The topology is not a style preference; it is how the specification keeps N servers from becoming one blurred trust boundary.

## Exam facts for this domain

- Architecture and Components is 14 percent of the MCPA exam, covering schemas and structured data, MCP hosts/clients/servers, and the model interaction flow.
- The exam is aligned to MCP specification 2026-07-28.
- Source: MCPA certification page; see `certifications/mcpa/research/source-verification-ledger.md`.
