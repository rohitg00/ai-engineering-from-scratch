---
id: mcp-client-transports
title: MCP Clients and Transports
code: MP
subtitle: Probe, merge and route MCP 2026-07-28 peers over stdio and Streamable HTTP. Retry MRTR rounds. Frame JSON-RPC.
hue: 190
sources: phases/11-llm-engineering/14-model-context-protocol, phases/13-tools-and-protocols/08-building-an-mcp-client, phases/13-tools-and-protocols/09-mcp-transports, phases/13-tools-and-protocols/11-mcp-sampling, phases/19-capstone-projects/22-jsonrpc-stdio-transport, projects/mcp-at-scale
source_hash: d897fd9af9387495
---

## Multi-server client
type: architecture
from: phases/13-tools-and-protocols/08-building-an-mcp-client/docs/en.md, phases/13-tools-and-protocols/08-building-an-mcp-client/code/main.py

```arch
node | host | 1,1 | Host | model and UI | client
node | client | 2,1 | MultiServerClient | one Peer per server | process
node | reg | 2,2 | registry | canonical name to peer | store
node | notes | 3,1 | notes | modern peer | process
node | files | 3,2 | files | modern peer | process
node | archive | 3,3 | archive | legacy, allow_legacy=True | process
edge | host | client | canonical name
edge | client | reg | lookup
edge | client | notes | _meta on each request
edge | client | files | _meta on each request
edge | client | archive | one initialize probe
```

## Stdio era probe
type: flow
from: phases/13-tools-and-protocols/08-building-an-mcp-client/docs/en.md

1. **Client**: sends `server/discover` before any other request.
2. **Result**: modern. Pick the highest shared version.
3. **-32022**: modern. Pick from `data.supported`. Retry, new id.
4. **-32020, -32021**: modern. Fix the request. No `initialize`.
5. **Timeout, close, unknown error**: ambiguous. Fail closed.
6. **Allowlisted peer**: one bounded `initialize`. Check `protocolVersion`, `capabilities`, `serverInfo`.
7. **Era cache**: keep it for the transport lifetime.

## Client tasks in code
type: task-table
span: 2
from: phases/13-tools-and-protocols/08-building-an-mcp-client/code/main.py, phases/13-tools-and-protocols/08-building-an-mcp-client/docs/en.md, phases/13-tools-and-protocols/09-mcp-transports/code/main.py, phases/19-capstone-projects/22-jsonrpc-stdio-transport/code/main.py

| Task | Code |
|---|---|
| Register a modern peer | `client.add_server("notes", notes)` |
| Permit one legacy probe | `client.add_server("archive", archive, allow_legacy=True)` |
| Probe every peer in name order | `client.connect_all()` |
| List tools of each live peer | `client.discover_tools()` |
| Reject duplicate names | `client.merge(policy="reject")` |
| Call by canonical name | `client.call("notes/search", {})` |
| Mirror body fields into headers | `http_headers_for(message)` |
| Serve JSON-RPC lines until EOF | `serve(handler, StdioTransport(stdin, stdout))` |

## Run the lessons
type: command-table
from: phases/11-llm-engineering/14-model-context-protocol/docs/en.md, phases/13-tools-and-protocols/08-building-an-mcp-client/docs/en.md, phases/13-tools-and-protocols/09-mcp-transports/docs/en.md, phases/13-tools-and-protocols/09-mcp-transports/code/main.py, phases/13-tools-and-protocols/11-mcp-sampling/docs/en.md, phases/19-capstone-projects/22-jsonrpc-stdio-transport/code/main.py

| Command | What it does |
|---|---|
| `python3 code/main.py` | 11.14: discovers `demo-server` at `2026-07-28` |
| `python3 main.py` | 13.08 in `code/`: peers, merged tools, calls |
| `python3 main.py --probe` | 13.09: runs the HTTP probe on a free port |
| `python3 main.py --serve` | 13.09: serves `http://127.0.0.1:8017/mcp` |
| `python3 main.py` | 13.11 in `code/`: request ids `[1, 2, 3]` |
| `python3 code/main.py` | 19.22: BytesIO demo, prints `server_responses` |
| `python3 -m unittest discover tests -v` | Runs the tests from `code/` |

## Stamp every modern request
type: annotated-code
lang: python
from: phases/13-tools-and-protocols/08-building-an-mcp-client/code/main.py

```python
def modern_request(request_id, method, params, version, capabilities=None):
    body_params = dict(params or {})
    body_params["_meta"] = request_meta(version, capabilities)  # new on each call
    return {"jsonrpc": "2.0", "id": request_id, "method": method, "params": body_params}
VERSION_KEY = "io.modelcontextprotocol/protocolVersion"          # required
CAPABILITIES_KEY = "io.modelcontextprotocol/clientCapabilities"  # required
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"           # client identity
RECOGNIZED_MODERN_ERRORS = {-32020, -32021, -32022}              # never downgrade
```

## stdio or Streamable HTTP
type: comparison
from: phases/13-tools-and-protocols/09-mcp-transports/docs/en.md, phases/11-llm-engineering/14-model-context-protocol/docs/en.md

| Factor | stdio | Streamable HTTP |
|---|---|---|
| Use it for | Client-launched subprocess | Network service |
| Framing | One UTF-8 JSON-RPC message per line | One JSON-RPC message per POST |
| Version context | `params._meta` | `params._meta` plus mirrored headers |
| Response | One line on stdout | JSON or request-scoped SSE |
| Notification | No response line | `202 Accepted`, no body |
| Diagnostics | stderr only | HTTP status plus JSON-RPC error |
| Change events | Reopen after restart | `subscriptions/listen` POST stream |
| Safety | Exit on stdin EOF | Validate `Origin`, bind `127.0.0.1` |

## MRTR round for Sampling
type: flow
from: phases/13-tools-and-protocols/11-mcp-sampling/docs/en.md, phases/13-tools-and-protocols/11-mcp-sampling/code/main.py

1. **Client**: calls `tools/call`. Capabilities hold `sampling`.
2. **Server**: returns `input_required`, `inputRequests`, `requestState`.
3. **Client**: checks policy and asks its model.
4. **Client**: same method and arguments, new id, `inputResponses`, exact `requestState`.
5. **Server**: verifies HMAC, principal, arguments digest, expiry.
6. **Server**: last round returns `resultType: "complete"`.

## Defaults in the lesson code
type: defaults
from: phases/13-tools-and-protocols/08-building-an-mcp-client/code/main.py, phases/13-tools-and-protocols/09-mcp-transports/code/main.py, phases/13-tools-and-protocols/11-mcp-sampling/code/main.py

| Setting | Default | Note |
|---|---|---|
| `discovery_timeout_ms` | 1_000 | Must be positive |
| `legacy_probe_timeout_ms` | 1_000 | Passed to the transport adapter |
| `merge` policy | prefix-on-collision | Or `reject` |
| Discovery `ttl_ms` | 3_600_000 | `cache_scope="public"` |
| `MAX_REQUEST_BYTES` | 1_048_576 | Larger body gives `-32700` |
| `READ_TIMEOUT_SECONDS` | 5.0 | Socket timeout on the body read |
| `maxTokens` | 400 | Per embedded sampling request |
| `requestState` expiry | 300 | Seconds after the first call |

## Status and error codes
type: troubleshooting
from: phases/13-tools-and-protocols/09-mcp-transports/docs/en.md, phases/13-tools-and-protocols/09-mcp-transports/code/main.py, phases/11-llm-engineering/14-model-context-protocol/docs/en.md, phases/13-tools-and-protocols/11-mcp-sampling/docs/en.md, phases/19-capstone-projects/22-jsonrpc-stdio-transport/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| HTTP 400, `-32020` | Header missing or differs from body | Build headers from the final body |
| HTTP 400, `-32022` | Version not supported | Retry with a value from `supported` |
| `-32021` | Client lacks a required capability | Read `data.requiredCapabilities` |
| `-32602` | Missing `_meta` or bad `requestState` | Send `_meta` and echo the state |
| HTTP 403 | `Origin` not in the allowlist | Use an exact origin match |
| HTTP 404, `-32601` | Unknown modern method | Do not treat it as legacy proof |
| HTTP 405 | GET or DELETE on `/mcp` | Use POST and `subscriptions/listen` |
| `-32700`, id null | One stdio line is broken JSON | Loop continues with the next line |

## Questions
type: qa
from: phases/13-tools-and-protocols/08-building-an-mcp-client/docs/en.md, phases/13-tools-and-protocols/09-mcp-transports/docs/en.md, phases/13-tools-and-protocols/11-mcp-sampling/docs/en.md

- **Is -32601 proof of a legacy server?** No. It only lets an allowlisted peer get one probe.
- **Can a stream resume?** No. `Last-Event-ID` is ignored. Send a new request with a new id.
- **Where does workflow state go?** In a server-minted handle that the client passes as an argument.
- **Can the server call the client?** No. It returns `input_required` and the client retries.
- **Do model preferences sum to one?** No. They are independent hints.

## Project: MCP Tool Discovery Workbench
type: command-table
span: 2
from: projects/mcp-at-scale/README.md, projects/mcp-at-scale/API.md, projects/mcp-at-scale/project.json, projects/mcp-at-scale/solution

| Command | What it does |
|---|---|
| `python3 scripts/project_test.py mcp-at-scale --all --path <dir> --strict` | Runs the grader. Init first with `--init <dir>` |
| `python3 cli.py samples/inventory.json --query "pods count" --max-chars 500` | Best schemas inside the budget |
| `python3 cli.py /absolute/inventory.json --serve` | stdio server with `catalog_search` |
| Checks | Before initialize: -32002. Pages of 32 tools. 250 names across 8 pages |

## Tips
type: tips
from: phases/13-tools-and-protocols/08-building-an-mcp-client/docs/en.md, phases/13-tools-and-protocols/09-mcp-transports/docs/en.md, phases/13-tools-and-protocols/11-mcp-sampling/docs/en.md

- Inspect the final serialized request.
- Send a non-ASCII `Mcp-Name` as `=?base64?{Base64EncodedValue}?=`.
- Cap MRTR rounds. Validate each sampling response.
- On stream loss, reissue `subscriptions/listen` and refetch.
- Under stdio, write diagnostics to stderr.
