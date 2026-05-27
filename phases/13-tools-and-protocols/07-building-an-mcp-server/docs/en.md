# Building an MCP Server — Python + TypeScript SDKs

> Most MCP tutorials show only stdio hello-worlds. A real server exposes tools plus resources plus prompts, handles capability negotiation, emits structured errors, and works the same across SDKs. This lesson builds a notes server end-to-end: stdlib stdio transport, JSON-RPC dispatch, the three server primitives, and a pure-function style that drops into either the Python SDK's FastMCP or the TypeScript SDK when you graduate.

**Type:** Build
**Languages:** Python (stdlib, stdio MCP server)
**Prerequisites:** Phase 13 · 06 (MCP fundamentals)
**Time:** ~75 minutes

## Learning Objectives

- Implement `initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`, `prompts/list`, and `prompts/get` methods.
- Write a dispatch loop that reads JSON-RPC messages from stdin and writes responses to stdout.
- Emit structured error responses per the JSON-RPC 2.0 spec and MCP's additional codes.
- Graduate a stdlib implementation to FastMCP (Python SDK) or the TypeScript SDK without rewriting tool logic.

## The Problem

Before you can use a remote transport (Phase 13 · 09) or an auth layer (Phase 13 · 16), you need a clean local server. Local means stdio: the server is spawned by the client as a child process, messages flow over stdin/stdout newline-delimited.

The 2025-11-25 spec prescribes that stdio messages are encoded as JSON objects with an explicit `\n` separator. No SSE here; SSE was the old remote mode and is being removed in mid-2026 (Atlassian's Rovo MCP server deprecated it on June 30, 2026; Keboola on April 1, 2026). For stdio, one JSON object per line is the whole wire format.

A notes server is a good shape because it exercises all three server primitives. Tools do mutations (`notes_create`). Resources expose data (`notes://{id}`). Prompts ship templates (`review_note`). The shape of this lesson generalizes to any domain.

## The Concept

### Dispatch loop

```
loop:
  line = stdin.readline()
  msg = json.loads(line)
  if has id:
    handle request -> write response
  else:
    handle notification -> no response
```

Three rules:

- Do not print anything to stdout that is not a JSON-RPC envelope. Debug logs go to stderr.
- Every request MUST be matched with a response carrying the same `id`.
- Notifications MUST NOT be responded to.

### Implementing `initialize`

```python
def initialize(params):
    return {
        "protocolVersion": "2025-11-25",
        "capabilities": {
            "tools": {"listChanged": True},
            "resources": {"listChanged": True, "subscribe": False},
            "prompts": {"listChanged": False},
        },
        "serverInfo": {"name": "notes", "version": "1.0.0"},
    }
```

Declare only what you support. The client relies on the capability set to gate features.

### Implementing `tools/list` and `tools/call`

`tools/list` returns `{tools: [...]}` with each entry having `name`, `description`, `inputSchema`. `tools/call` takes `{name, arguments}` and returns `{content: [blocks], isError: bool}`.

Content blocks are typed. The most common:

```json
{"type": "text", "text": "Found 2 notes"}
{"type": "resource", "resource": {"uri": "notes://14", "text": "..."}}
{"type": "image", "data": "<base64>", "mimeType": "image/png"}
```

Tool errors come in two shapes. Protocol-level errors (unknown method, bad params) are JSON-RPC errors. Tool-level errors (valid call but the tool failed) are returned as `{content: [...], isError: true}`. That lets the model see the failure in its context.

### Implementing resources

Resources are read-only by design. `resources/list` returns a manifest; `resources/read` returns the content. URIs can be `file://...`, `http://...`, or a custom scheme like `notes://`.

When you expose data as a resource instead of a tool:

- The model does not "call" it; the client can inject it into context on user request.
- Subscriptions let the server push updates when the resource changes (Phase 13 · 10).
- Phase 13 · 14 extends this with `ui://` for interactive resources.

### Implementing prompts

Prompts are templates with named arguments. The host surfaces them as slash-commands. A `review_note` prompt might take a `note_id` argument and produce a multi-message prompt template the client feeds to its model.

### Stdio transport subtleties

- Newline-delimited JSON. No length-prefixed framing.
- Do not buffer. `sys.stdout.flush()` after each write.
- The client controls the lifetime. When stdin closes (EOF), exit cleanly.
- Do not handle SIGPIPE silently; log and exit.

### Annotations

Each tool can carry `annotations` describing safety properties:

- `readOnlyHint: true` — pure read, safe to retry.
- `destructiveHint: true` — irreversible side effects; client should confirm.
- `idempotentHint: true` — same inputs produce same outputs.
- `openWorldHint: true` — interacts with external systems.

The client uses these to decide UX (confirmation dialogs, status indicators) and routing (Phase 13 · 17).

### Graduation path

The stdlib server in `code/main.py` is about 180 lines. FastMCP (Python) collapses the same logic to decorator-style:

```python
from fastmcp import FastMCP
app = FastMCP("notes")

@app.tool()
def notes_search(query: str, limit: int = 10) -> list[dict]:
    ...
```

The TypeScript SDK has an equivalent shape. The graduation path is drop-in when you are ready; the concepts (capabilities, dispatch, content blocks) are the same.

## Use It

`code/main.py` is a complete notes MCP server over stdio, stdlib only. It handles `initialize`, `tools/list`, `tools/call` for three tools (`notes_list`, `notes_search`, `notes_create`), `resources/list` and `resources/read` for each note, and a `review_note` prompt. You can drive it by piping JSON-RPC messages:

```
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | python main.py
```

What to look at:

- The dispatcher is a `dict[str, Callable]` keyed by method name.
- Every tool executor returns a list of content blocks, not a bare string.
- `isError: true` is set when the executor raises.

## Ship It

This lesson produces `outputs/skill-mcp-server-scaffolder.md`. Given a domain (notes, tickets, files, database), the skill scaffolds an MCP server with the right tools / resources / prompts split and SDK graduation path.

## Exercises

1. Run `code/main.py` and drive it with hand-built JSON-RPC messages. Exercise `notes_create`, then `resources/read` to retrieve the new note.

2. Add a `notes_delete` tool with `annotations: {destructiveHint: true}`. Verify the client would surface a confirmation dialog (this requires a real host; Claude Desktop works).

3. Implement `resources/subscribe` so the server pushes `notifications/resources/updated` whenever a note is modified. Add a keepalive task.

4. Port the server to FastMCP. The Python file should shrink to under 80 lines. The wire behavior must be identical; verify with the same JSON-RPC test harness.

5. Read the spec's `server/tools` section and identify one field of a tool definition not implemented in this lesson's server. (Hint: there are several; pick one and add it.)

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MCP server | "The thing that exposes tools" | Process that speaks MCP JSON-RPC over stdio or HTTP |
| stdio transport | "Child process model" | Server is spawned by client; communicates via stdin/stdout |
| Dispatcher | "Method router" | Map of JSON-RPC method name to handler function |
| Content block | "Tool result chunk" | Typed element in the `content` array of a tool response |
| `isError` | "Tool-level failure" | Signals the tool failed; distinguishes from JSON-RPC error |
| Annotations | "Safety hints" | readOnly / destructive / idempotent / openWorld flags |
| FastMCP | "Python SDK" | Decorator-based higher-level framework on top of the MCP protocol |
| Resource URI | "Addressable data" | `file://`, `db://`, or custom scheme identifying a resource |
| Prompt template | "Slash-command brief" | Server-supplied template with argument slots for host UIs |
| Capability declaration | "Feature toggle" | Per-primitive flags declared in `initialize` |

## Further Reading

- [Model Context Protocol — Python SDK](https://github.com/modelcontextprotocol/python-sdk) — the reference Python implementation
- [Model Context Protocol — TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — parallel TS implementation
- [FastMCP — server framework](https://gofastmcp.com/) — decorator-style Python API for MCP servers
- [MCP — Quickstart server guide](https://modelcontextprotocol.io/quickstart/server) — end-to-end tutorial using either SDK
- [MCP — Server tools spec](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) — complete reference for tools/* messages
