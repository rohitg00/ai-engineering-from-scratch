# Building an MCP Client — Discovery, Invocation, Session Management

> Most MCP content ships server tutorials and waves a hand at the client. Client code is where the hard orchestration lives: process spawning, capability negotiation, tool list merging across multiple servers, sampling callbacks, reconnection, and namespace collision resolution. This lesson builds a multi-server client that lifts three different MCP servers into one flat tool namespace for the model.

**Type:** Build
**Languages:** Python (stdlib, multi-server MCP client)
**Prerequisites:** Phase 13 · 07 (building an MCP server)
**Time:** ~75 minutes

## Learning Objectives

- Spawn an MCP server as a child process, complete `initialize`, and send a `notifications/initialized`.
- Maintain per-server session state (capabilities, tool list, last-seen notification ids).
- Merge tool lists across multiple servers into one namespace with collision handling.
- Route a tool call to the server that owns it and reassemble the response.

## The Problem

A real agent host (Claude Desktop, Cursor, Goose, Gemini CLI) loads multiple MCP servers at once. A user might have a filesystem server, a Postgres server, and a GitHub server running simultaneously. The client's job:

1. Spawn each server.
2. Handshake each independently.
3. Call `tools/list` on each and flatten the result.
4. When the model emits `notes_search`, look it up in the merged namespace and route to the right server.
5. Handle notifications from any server (`tools/list_changed`) without blocking.
6. Reconnect on transport failure.

Hand-rolling all of that is what separates "toy" from "serviceable". The official SDKs wrap this, but the mental model has to be yours.

## The Concept

### Child-process spawning

`subprocess.Popen` with `stdin=PIPE, stdout=PIPE, stderr=PIPE`. Set `bufsize=1` and use text mode for line-by-line reads. Each server is one process; the client holds one `Popen` handle per server.

### Per-server session state

A `Session` object per server holds:

- `process` — the Popen handle.
- `capabilities` — what the server declared at `initialize`.
- `tools` — the last `tools/list` result.
- `pending` — map of request id to a promise/future waiting for the response.

Requests are async by nature; a `tools/call` sent to server A while server B is mid-call must not block. Either use threads with queues or asyncio.

### Merged namespace

When the client sees the aggregate tool list, names can collide. Two servers might both expose `search`. The client has three options:

1. **Prefix by server name.** `notes/search`, `files/search`. Clear but ugly.
2. **Silent first-come.** Later server's `search` overrides the earlier. Risky; hides collisions.
3. **Collision rejection.** Refuse to load the second server; notify the user. Safest for security-sensitive hosts.

Claude Desktop uses prefix-by-server. Cursor uses collision rejection with a clear error. VS Code MCP adopts prefix-by-server as well.

### Routing

After merging, a dispatch table maps `tool_name -> session`. The model emits a call by name; the client finds the session and writes a `tools/call` message to that server's stdin, then awaits the response.

### Sampling callback

If the server declared the `sampling` capability at `initialize`, it may send `sampling/createMessage` asking the client to run its LLM. The client must:

1. Block further requests to that server until the sample resolves, or pipeline if its implementation supports concurrency.
2. Call its LLM provider.
3. Send the response back to the server.

Lesson 11 covers sampling end-to-end. This lesson stubs it for completeness.

### Notification handling

`notifications/tools/list_changed` means re-call `tools/list`. `notifications/resources/updated` means re-read the resource if it is in use. Notifications must not produce responses — do not try to ack them.

A common client bug: blocking the read loop on `tools/call` while a notification sits in the stream. Use a background reader thread that pushes every message onto a queue; the main thread dequeues and dispatches.

### Reconnection

Transport can fail: server crashed, OS killed the process, stdio pipe broke. The client detects EOF on stdout and treats the session as dead. Options:

- Silently restart the server and re-handshake. OK for pure read-only servers.
- Surface the failure to the user. OK for stateful servers with user-visible sessions.

Phase 13 · 09 covers the Streamable HTTP reconnection semantics; stdio is simpler.

### Keepalive and session id

Streamable HTTP uses a `Mcp-Session-Id` header. Stdio has no session id — the process identity IS the session. Keepalive pings are optional; stdio pipes do not break under inactivity.

## Use It

`code/main.py` spawns three simulated MCP servers as subprocesses, handshakes each, merges their tool lists, and routes tool calls to the right one. The "servers" are actually other Python processes running toy responders (no real LLM). Run it to see:

- Three initializations, each with their own capability set.
- Three `tools/list` results merged into a 7-tool namespace.
- A routing decision based on the tool name.
- A collision prevented by namespace prefixing.

What to look at:

- The `Session` dataclass holds per-server state cleanly.
- The background reader thread dequeues every line on stdout without blocking the main thread.
- The dispatch table is a simple `dict[str, Session]`.
- Collision handling is explicit: when two servers declare the same name, the later one is renamed with a prefix.

## Ship It

This lesson produces `outputs/skill-mcp-client-harness.md`. Given a declarative list of MCP servers (name, command, args), the skill produces a harness that spawns them, merges tool lists, and ships a routing function with collision resolution.

## Exercises

1. Run `code/main.py` and watch the server spawn log. Kill one of the simulated server processes with a SIGTERM and observe how the client detects the EOF and marks that session as dead.

2. Implement namespace prefixing. When two servers expose `search`, rename the second as `<server>/search`. Update the dispatch table and verify tool calls route correctly.

3. Add a connection-pool-style backoff for server restart: exponential backoff on consecutive failures, cap at 30 seconds, emit a notification to the user after three failures.

4. Sketch a client that supports 100 concurrent MCP servers. What data structure replaces the simple dispatch dict? (Hint: trie for prefix namespacing, plus a metric for tool-count-per-server.)

5. Port the client to the official MCP Python SDK. The SDK wraps `stdio_client` and `ClientSession`. The code should shrink from ~200 lines to ~40 lines while preserving multi-server routing.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MCP client | "The agent host" | Process that spawns servers and orchestrates tool calls |
| Session | "Per-server state" | Capabilities, tool list, and pending-request bookkeeping |
| Merged namespace | "One tool list" | Flat set of tool names across all active servers |
| Namespace collision | "Two servers same tool" | Client must prefix, reject, or first-come the duplicate |
| Routing | "Who gets this call?" | Dispatch from tool name to owning server |
| Background reader | "Non-blocking stdout" | Thread or task that drains server stdout into a queue |
| Sampling callback | "LLM-as-a-service" | Client handler for `sampling/createMessage` from server |
| `notifications/*_changed` | "Primitive mutated" | Signal the client must re-discover or re-read |
| Reconnection policy | "When server dies" | Restart semantics when transport fails |
| Stdio session | "Process = session" | No session id; child process lifetime is the session |

## Further Reading

- [Model Context Protocol — Client spec](https://modelcontextprotocol.io/specification/2025-11-25/client) — canonical client behavior
- [MCP — Quickstart client guide](https://modelcontextprotocol.io/quickstart/client) — hello-world client tutorial with the Python SDK
- [MCP Python SDK — client module](https://github.com/modelcontextprotocol/python-sdk) — reference `ClientSession` and `stdio_client`
- [MCP TypeScript SDK — Client](https://github.com/modelcontextprotocol/typescript-sdk) — TS parallel
- [VS Code — MCP in extensions](https://code.visualstudio.com/api/extension-guides/ai/mcp) — how VS Code multiplexes multiple MCP servers in a single editor host
