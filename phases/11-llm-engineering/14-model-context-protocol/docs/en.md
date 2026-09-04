# Model Context Protocol (MCP)

> MCP gives an AI host one protocol for discovering and invoking tools, resources, and prompts. The 2026-07-28 revision makes that protocol stateless: capability and version context travels with every request, not in a connection-bound handshake.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 03 (Structured Outputs)
**Time:** ~75 minutes

## Learning Objectives

- Distinguish an MCP host, client, server, transport, and server primitive.
- Build a JSON-RPC request with the metadata required by MCP 2026-07-28.
- Use `server/discover` to inspect versions, identity, and capabilities.
- Return typed and cache-aware results from tools, resources, and prompts.
- Explain how modern stateless MCP interoperates with handshake-era servers.
- Choose safe state, transport, and approval boundaries for a server.

## The Problem

Your application needs a database query, a calendar operation, and a file reader. Without a shared protocol, every AI host needs custom discovery, invocation, errors, transport, and authorization glue for those same capabilities.

MCP reduces that integration matrix. A server publishes a standard JSON-RPC surface. A compliant client can discover the surface, present it to a model or user, invoke it, and interpret the result without a server-specific adapter.

The important boundary is easy to miss. MCP standardizes communication. It does not decide which tool the model should call, make untrusted content safe, or turn a stateless request into durable application state. Your host and server still own those decisions.

## The Concept

![MCP host, stateless request, and server primitives](../assets/mcp-architecture.svg)

### The three server primitives

1. **Tools** are callable actions. Each tool has a name, description, JSON Schema input, and handler.
2. **Resources** are named, URI-addressed content that a client can read.
3. **Prompts** are reusable templates that a host can expose to a user.

The host is the AI application. An MCP client inside that host speaks to one server. The transport carries JSON-RPC messages between them.

### Stateless requests replace the handshake

MCP 2026-07-28 removes `initialize` and `notifications/initialized`. It also removes protocol-level sessions. Every request carries the context needed to interpret it in `params._meta`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

The protocol version and client capabilities are required. Client identity is recommended. A missing `_meta`, a missing required field, or a required field with the wrong type is malformed and returns Invalid Params (`-32602`). A well-formed version string that the server does not support returns `UnsupportedProtocolVersionError` (`-32022`). A server can process a valid request without recovering a prior negotiation record.

Stateless does not mean an application can never maintain state. It means that state is not hidden behind an MCP connection or `Mcp-Session-Id`. If a workflow needs continuity, the server mints an opaque handle and the client passes that handle as an ordinary tool argument on later calls. Authorization must still be checked on every request.

### Discovery and version selection

Every modern server implements `server/discover`. The result advertises supported versions, capabilities, and server identity:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "complete",
    "supportedVersions": ["2026-07-28"],
    "capabilities": {
      "tools": {},
      "resources": {},
      "prompts": {}
    },
    "ttlMs": 3600000,
    "cacheScope": "public",
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "demo-server",
        "version": "1.0.0"
      }
    }
  }
}
```

A client may call another method directly and handle a version error, but discovery makes capability display and version selection explicit. An unsupported version returns `UnsupportedProtocolVersionError` with code `-32022`. Its data contains `supported`, an array of server revisions, and `requested`, the rejected revision.

On stdio, a dual-era client probes with `server/discover`. A discovery result or a recognized modern error such as `UnsupportedProtocolVersionError` identifies a modern server. Any error or timeout that is not recognized as modern permits fallback to the 2025-11-25 `initialize` flow. Legacy behavior is compatibility code, not the modern default.

### Results are explicit

Every core 2026-07-28 result has `resultType`:

- `complete` means the operation finished.
- `input_required` means the server needs another round trip through the Multi Round-Trip Requests pattern. Core servers may return it only from `tools/call`, `resources/read`, or `prompts/get`.

Clients must treat a legacy result that omits `resultType` as complete.

Servers should include `io.modelcontextprotocol/serverInfo` in every result's `_meta`. This identity is self-reported and is for display, logging, and debugging, not for security decisions.

List and read results also carry `ttlMs` and `cacheScope`. A deterministic `tools/list` order plus a freshness hint lets clients cache discovery safely and improves prompt-cache stability. `cacheScope: public` permits shared caching; `private` confines reuse to the calling context.

### The wire format and transport

MCP uses JSON-RPC 2.0 over stdio or Streamable HTTP.

- A request has `jsonrpc`, `id`, `method`, and `params`.
- A response has the matching `id` and either `result` or `error`.
- A notification has no `id` and expects no response.

Modern Streamable HTTP exposes one endpoint that accepts POST. Each JSON-RPC message gets its own POST. A request POST receives either one JSON object or a request-scoped Server-Sent Events stream that ends with the final response. An accepted notification POST receives HTTP 202 with no response body; this core revision defines no client-to-server notifications over Streamable HTTP.

There is no standalone MCP GET stream, DELETE session endpoint, `Mcp-Session-Id`, or `Last-Event-ID` replay in 2026-07-28. Long-lived change notifications use a `subscriptions/listen` POST whose response remains open as an SSE stream.

### Client input without server-initiated requests

Older revisions let a server send requests such as `sampling/createMessage`, `roots/list`, or `elicitation/create` over a stream. The current protocol uses Multi Round-Trip Requests instead. An eligible tool call, resource read, or prompt get returns `resultType: input_required` with at least one of `inputRequests` or `requestState`. The client gathers any requested input, retries the original method with a new JSON-RPC ID and the corresponding `inputResponses`, and echoes the exact `requestState` when one was provided. If no `inputRequests` were present, the retry omits `inputResponses`.

Roots, Sampling, and Logging remain functional but are deprecated, so new implementations should not adopt them. Existing Roots or Sampling requests travel inside MRTR `inputRequests`, never as independent server-to-client JSON-RPC requests. Prefer explicit file or directory parameters, resource URIs, server configuration, and direct model-provider integration. Use stderr for stdio diagnostics and OpenTelemetry for production telemetry.

```figure
mcp-nxm-collapse
```

## Build It

### Step 1: register a server surface

Registration stays simple even though the request contract changed:

```python
server = MCPServer("demo-server")

@server.tool(
    "add",
    "Add two integers.",
    {
        "type": "object",
        "properties": {
            "a": {"type": "integer"},
            "b": {"type": "integer"}
        },
        "required": ["a", "b"]
    }
)
def add(a: int, b: int) -> dict:
    return {"sum": a + b}
```

The shipped implementation in `code/main.py` also registers a resource and prompt. It deliberately uses the standard library so you can see each envelope rather than delegating the protocol to an SDK.

### Step 2: attach metadata to every request

```python
def request(method, params=None):
    body_params = dict(params or {})
    body_params["_meta"] = {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
        "io.modelcontextprotocol/clientInfo": {
            "name": "demo-client",
            "version": "1.0.0"
        }
    }
    return {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": body_params
    }
```

Do not cache this metadata only in a connection object. The server validates it on each request.

### Step 3: optionally discover before listing

Call `server/discover`, choose a supported version, then call `tools/list`. A direct `tools/list` is also valid if you already know the version and can handle `-32022`.

The demo returns tool lists in name order and attaches `ttlMs`, `cacheScope`, `resultType`, and server identity. A tool call returns a complete, non-cacheable result because its output can depend on current state.

### Step 4: map the same request to HTTP

A remote `tools/call` POST includes headers that mirror the JSON-RPC body:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: add
```

The `MCP-Protocol-Version` header must match the version in `_meta`. `Mcp-Method` is required on every JSON-RPC request and must match `method`. `Mcp-Name` is required only for `tools/call`, `resources/read`, and `prompts/get`, where it must match the tool name, resource URI, or prompt name. A missing required header or mismatch returns HTTP 400 with `HeaderMismatch` code `-32020`.

### Step 5: enforce safety outside protocol state

- Validate authorization and audience on every HTTP request.
- Bind local servers to localhost and validate `Origin` on Streamable HTTP.
- Mark mutating tools with `destructiveHint: true` and require host approval.
- Pass directory and file scope explicitly instead of depending on deprecated Roots.
- Treat resources and tool output as untrusted data.
- Keep stdout reserved for JSON-RPC under stdio; write diagnostics to stderr.

## Use It

Run the lesson from its directory:

```bash
python3 code/main.py
cd code
python3 -m unittest discover tests -v
```

The first line should report discovery of `demo-server` at protocol `2026-07-28`. Then inspect `MCPClient.request`: it reconstructs `_meta` for every call. Remove the metadata from one request and observe the server reject it.

## Ship It

`outputs/skill-mcp-server-designer.md` turns a domain into a stateless MCP design. Its acceptance gate requires a discovery result, per-request metadata policy, deterministic cache-aware lists, explicit state handles, transport headers, authorization, and approval rules.

## Continue the MCP Deep Dive

This lesson gives you the protocol model. Phase 13 turns four production boundaries into separate build-and-verify lessons:

1. [MCP Tool Contracts and Content](../../../13-tools-and-protocols/28-mcp-tool-contracts-and-content/docs/en.md) covers closed input schemas, structured content, routing metadata, opaque pagination, completion authorization, and the difference between protocol and tool-domain errors.
2. [MCP Reliability, Cancellation, and Flow Control](../../../13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/docs/en.md) covers request cancellation, durable task cancellation, deadlines, idempotency, backpressure, proxy buffering, and reconnect behavior.
3. [MCP Registry Supply Chain, Admission, Drift, and Rollback](../../../13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/docs/en.md) covers namespace proof, artifact provenance, immutable pins, live drift, Registry status, admission evidence, and rollback.
4. [MCP Conformance Engineering](../../../13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/docs/en.md) covers golden and negative wire transcripts, strict version eras, SDK differentials, proxy evidence, redaction, health gates, and release rollback.

Follow them in order when the server will cross a team or trust boundary. Together they move from “the method works” to “the contract remains safe and diagnosable through deployment.”

## Exercises

1. Add a `subtract` tool and confirm `tools/list` remains alphabetically ordered.
2. Remove the protocol-version key and verify Invalid Params (`-32602`). Then send the well-formed but unsupported version `2025-11-25`, verify `-32022`, confirm `requested` echoes that revision, and choose from `supported`.
3. Add a server-minted `draftId` to a create operation, then require it as an argument to update. Explain why that is application state rather than a protocol session.
4. Return `input_required` from a tool that needs user confirmation. Retry the original call with a new ID, an `inputResponses` entry, and the exact `requestState` instead of inventing a server-to-client JSON-RPC request.
5. Sketch a dual-era stdio client. Treat a result or recognized modern error as modern, and permit fallback to `initialize` only for an unrecognized error or timeout.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| MCP | "Tool protocol for LLMs" | JSON-RPC protocol for server discovery, tools, resources, prompts, and extensions |
| Host | "The AI app" | Owns the model and UI and mounts one or more MCP clients |
| Client | "The connector" | Speaks MCP to one server on behalf of a host |
| Stateless MCP | "No session" | Every request carries version and capabilities; no protocol state is keyed by a connection |
| `server/discover` | "Capability probe" | Required server method advertising versions, capabilities, and identity |
| `resultType` | "Result state" | Marks a result as `complete` or `input_required` |
| State handle | "Workflow id" | Server-minted application identifier passed as an ordinary argument |
| Streamable HTTP | "Remote transport" | One POST endpoint with JSON or request-scoped SSE responses |
| MRTR | "Ask and retry" | Input request embedded in a result, followed by a retry of the original operation |

## Further Reading

- [MCP 2026-07-28 key changes](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP deprecated features](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)
