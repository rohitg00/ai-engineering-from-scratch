---
id: mcp
title: Model Context Protocol (MCP)
code: MC
subtitle: Build, call and serve stateless MCP 2026-07-28 servers over stdio and Streamable HTTP.
hue: 160
sources: phases/13-tools-and-protocols/06-mcp-fundamentals, phases/13-tools-and-protocols/07-building-an-mcp-server, phases/13-tools-and-protocols/08-building-an-mcp-client, phases/13-tools-and-protocols/09-mcp-transports, phases/13-tools-and-protocols/12-mcp-roots-and-elicitation, phases/13-tools-and-protocols/16-mcp-security-oauth-2-1, phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control
source_hash: 971c475a75b5a0e9
---

## Tasks
type: task-table
from: phases/13-tools-and-protocols/07-building-an-mcp-server/docs/en.md, phases/13-tools-and-protocols/07-building-an-mcp-server/code/main.py, phases/13-tools-and-protocols/08-building-an-mcp-client/code/main.py, phases/13-tools-and-protocols/09-mcp-transports/docs/en.md, phases/13-tools-and-protocols/09-mcp-transports/code/main.py

| Task | Code |
|---|---|
| Serve over stdio | `python3 main.py` |
| Run the stdio demo | `python3 main.py --demo` |
| Serve Streamable HTTP | `python3 main.py --serve` |
| Probe the HTTP server | `python3 main.py --probe` |
| Discover a server | `make_request(1, "server/discover")` |
| List tools | `make_request(2, "tools/list")` |
| Call a tool | `make_request(5, "tools/call", {"name": "<tool>", "arguments": <args>})` |
| Add a legacy peer | `client.add_server("<name>", <transport>, allow_legacy=True)` |

## Define and run a tool
type: annotated-code
lang: python
from: phases/13-tools-and-protocols/07-building-an-mcp-server/code/main.py

```python
TOOLS = [{
    "name": "notes_search",                    # name the model sees
    "description": "Search note titles and bodies by keyword.",
    "inputSchema": {"type": "object",          # JSON Schema of arguments
        "properties": {"query": {"type": "string"}},
        "required": ["query"]},
    "annotations": {"readOnlyHint": True},     # hint only
}]
def handle_tools_call(params):
    executor = TOOL_EXECUTORS.get(params.get("name"))
    if executor is None:                       # unknown tool
        return complete({"content": [...], "isError": True})
    content = executor(params.get("arguments", {}))
    return complete({"content": content, "isError": False})
```

## One tools/call over HTTP
type: annotated-code
lang: text
from: phases/13-tools-and-protocols/09-mcp-transports/docs/en.md, phases/13-tools-and-protocols/06-mcp-fundamentals/docs/en.md

```text
POST /mcp                                  # one message per POST
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28           # equals the _meta version
Mcp-Method: tools/call                     # equals the JSON-RPC method
Mcp-Name: notes_search                     # equals params.name
{"jsonrpc": "2.0", "id": 7, "method": "tools/call",
 "params": {"name": "notes_search", "arguments": {"query": "MCP"},
  "_meta": {
   "io.modelcontextprotocol/protocolVersion": "2026-07-28",
   "io.modelcontextprotocol/clientCapabilities": {}}}}
```

## Architecture
type: architecture
from: phases/13-tools-and-protocols/08-building-an-mcp-client/docs/en.md, phases/13-tools-and-protocols/08-building-an-mcp-client/code/main.py, phases/13-tools-and-protocols/07-building-an-mcp-server/code/main.py, phases/13-tools-and-protocols/09-mcp-transports/docs/en.md, phases/13-tools-and-protocols/16-mcp-security-oauth-2-1/docs/en.md

```arch
node | host | 1,1 | Agent host | merges tool catalogs
node | client | 2,1 | MultiServerClient | one Peer per server
node | stdio | 3,1 | stdio | one JSON line each
node | server | 4,1 | MCP server | dispatch, HANDLERS
node | authz | 2,2 | Authorization server | issues tokens
node | http | 3,2 | Streamable HTTP | POST /mcp
node | prims | 4,2 | Primitives | tools, resources, prompts
edge | host | client | route
edge | client | stdio | subprocess
edge | client | authz | token
edge | client | http | POST
edge | stdio | server | stdin
edge | http | server | /mcp
edge | server | prims | handler
```

## Discover, list, call
type: flow
from: phases/13-tools-and-protocols/06-mcp-fundamentals/docs/en.md, phases/13-tools-and-protocols/07-building-an-mcp-server/code/main.py, phases/13-tools-and-protocols/07-building-an-mcp-server/docs/en.md

1. **Client**: Sends `server/discover` with version and capabilities in `params._meta`.
2. **Server**: Returns `supportedVersions` and `capabilities`. No session starts.
3. **Client**: Sends `tools/list`. Gets a sorted list with `ttlMs` and `cacheScope`.
4. **Client**: Sends `tools/call` with `name`, `arguments` and a new `id`.
5. **Server**: `validate_request()` checks `params._meta`. A bad version gives `-32022`.
6. **Server**: `dispatch()` routes by `method` to `handle_tools_call()`.
7. **Server**: Returns `resultType` complete with `content` and `isError`.

## Methods
type: command-table
from: phases/13-tools-and-protocols/06-mcp-fundamentals/docs/en.md, phases/13-tools-and-protocols/09-mcp-transports/docs/en.md, phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/docs/en.md

| Command | What it does |
|---|---|
| `server/discover` | Versions, capabilities, instructions, server identity |
| `tools/list` | Lists tools. Cacheable |
| `tools/call` | Runs one tool. Returns content blocks |
| `resources/list` | Lists URI-addressed data. Cacheable |
| `resources/read` | Reads one resource by URI |
| `prompts/list`, `prompts/get` | Lists and renders prompt templates |
| `subscriptions/listen` | Long-lived POST stream for change events |
| `notifications/cancelled` | Cancels a request on stdio. No response |

## Key concepts
type: concepts
from: phases/13-tools-and-protocols/06-mcp-fundamentals/docs/en.md, phases/13-tools-and-protocols/07-building-an-mcp-server/docs/en.md, phases/13-tools-and-protocols/09-mcp-transports/docs/en.md

- **Stateless core**: Every request carries the metadata to interpret it.
- **Request metadata**: Version and capabilities are required. `clientInfo` is recommended.
- **Complete result**: Every success has `resultType` set to complete.
- **Cacheable result**: Lists, reads and discovery carry `ttlMs` and `cacheScope`.
- **Tool annotations**: `readOnlyHint`, `destructiveHint` are hints. The server enforces.
- **stdio**: Client-launched subprocess. JSON on stdout, logs on stderr.
- **Streamable HTTP**: One `/mcp` endpoint. Each message is a new POST.
- **Legacy era**: Up to `2025-11-25`, `initialize` then `notifications/initialized`.

## Defaults
type: defaults
from: phases/13-tools-and-protocols/07-building-an-mcp-server/code/main.py, phases/13-tools-and-protocols/08-building-an-mcp-client/code/main.py, phases/13-tools-and-protocols/09-mcp-transports/code/main.py

| Setting | Default | Note |
|---|---|---|
| `PROTOCOL_VERSION` | 2026-07-28 | Modern revision in the lessons |
| `server/discover` ttl | 3_600_000 | ms, `cacheScope` public |
| `tools/list` ttl | 60_000 | ms, `cacheScope` public |
| `resources/read` ttl | 5_000 | ms, `cacheScope` private |
| `cache_scope` | private | `complete()` default |
| HTTP port | 8017 | `--serve` binds 127.0.0.1 |
| `MAX_REQUEST_BYTES` | 1_048_576 | HTTP body cap |
| `legacy_probe_timeout_ms` | 1_000 | Deadline for one `initialize` probe |

## Troubleshooting
type: troubleshooting
from: phases/13-tools-and-protocols/06-mcp-fundamentals/docs/en.md, phases/13-tools-and-protocols/07-building-an-mcp-server/docs/en.md, phases/13-tools-and-protocols/08-building-an-mcp-client/docs/en.md, phases/13-tools-and-protocols/09-mcp-transports/docs/en.md, phases/13-tools-and-protocols/16-mcp-security-oauth-2-1/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| `-32022` | Version not supported | Pick from `data.supported`. Retry, new id |
| `-32602` | Missing request metadata | Stamp `_meta` on every request |
| HTTP 400 `-32020` | Header disagrees with body | Mirror version, method and name exactly |
| HTTP 403 on POST | `Origin` not allowed | Add the exact origin to the allowlist |
| HTTP 405 | GET or DELETE on `/mcp` | POST, and `subscriptions/listen` for events |
| stdio client fails to parse | Logs on stdout | Write diagnostics to stderr |
| HTTP 401 | Invalid, expired or wrong-audience token | Get a token for this resource |
| 403 `insufficient_scope` | Tool needs more scope | Step up with the challenge scope |

## Glossary
type: glossary
from: phases/13-tools-and-protocols/06-mcp-fundamentals/docs/en.md, phases/13-tools-and-protocols/09-mcp-transports/docs/en.md, phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/docs/en.md, phases/13-tools-and-protocols/16-mcp-security-oauth-2-1/docs/en.md

- **JSON-RPC 2.0**: Envelope of every MCP request, response and notification.
- **SSE**: `text/event-stream` response. Notifications, then the final response.
- **MRTR**: Multi Round-Trip Request. `input_required`, then a fresh retry.
- **PKCE**: Verifier and S256 challenge. Protects an intercepted code.
- **CIMD**: HTTPS metadata document whose URL is the client id.
- **DCR**: Deprecated dynamic client enrollment for compatibility.
- **RFC 9728**: Protected-resource metadata. Names the authorization servers.

## Questions and answers
type: qa
from: phases/13-tools-and-protocols/07-building-an-mcp-server/docs/en.md, phases/13-tools-and-protocols/08-building-an-mcp-client/docs/en.md, phases/13-tools-and-protocols/16-mcp-security-oauth-2-1/docs/en.md, phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/docs/en.md, phases/13-tools-and-protocols/06-mcp-fundamentals/docs/en.md

- **Tool error or protocol error?** `isError: true` for a valid call that fails. JSON-RPC error for a bad request.
- **Can a server call the client?** No. It returns `input_required`. The client retries with a new id.
- **How do I cancel?** stdio: send `notifications/cancelled`. HTTP: close the response stream.
- **Does stdio need OAuth?** No. Authorization applies to HTTP transports.
- **When do I send `initialize`?** Only to an allowlisted legacy peer. Never by default.

## Tips
type: tips
from: phases/13-tools-and-protocols/06-mcp-fundamentals/docs/en.md, phases/13-tools-and-protocols/08-building-an-mcp-client/docs/en.md, phases/13-tools-and-protocols/09-mcp-transports/docs/en.md, phases/13-tools-and-protocols/16-mcp-security-oauth-2-1/docs/en.md

- Sort list items. Stable order gives stable cache keys and model context.
- Bind local servers to `127.0.0.1`. Origin checks are not authentication.
- Match origins exactly. Prefix checks accept attacker suffixes.
- Send the bearer token in `Authorization`. Never in the URL.
- Return an explicit state handle. Sticky routing breaks on failover.
- On a tool name collision, prefix or reject. Never overwrite.
