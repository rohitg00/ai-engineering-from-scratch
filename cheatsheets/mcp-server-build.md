---
id: mcp-server-build
title: Building an MCP Server
code: BM
subtitle: Validate, dispatch, wrap and cache a stateless MCP 2026-07-28 server. Tools, resources, prompts, policy.
hue: 172
sources: phases/13-tools-and-protocols/07-building-an-mcp-server, phases/13-tools-and-protocols/10-mcp-resources-and-prompts, phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content, phases/19-capstone-projects/13-mcp-server-with-registry, projects/memory-server
source_hash: 04ba5f070c3f22cc
---

## Run the lesson servers
type: task-table
from: phases/13-tools-and-protocols/07-building-an-mcp-server/docs/en.md, phases/13-tools-and-protocols/07-building-an-mcp-server/code/main.py, phases/13-tools-and-protocols/10-mcp-resources-and-prompts/docs/en.md, phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content/docs/en.md, phases/19-capstone-projects/13-mcp-server-with-registry/docs/en.md

| Task | Code |
|---|---|
| Serve on stdio | `python3 main.py` |
| Run the finite demo | `python3 main.py --demo` |
| Run the TypeScript port | `npx tsx main.ts --demo` |
| Run the lesson tests | `python3 -m unittest discover tests -v` |
| Build a request with `_meta` | `make_request(2, "tools/list")` |
| Run the capstone model | `python3 code/main.py` |
| Check the capstone TypeScript | `npm run typecheck` |

## The dispatch loop
type: flow
from: phases/13-tools-and-protocols/07-building-an-mcp-server/docs/en.md, phases/13-tools-and-protocols/07-building-an-mcp-server/code/main.py

1. **serve_stdio**: Reads one line from stdin. Bad JSON gives `-32700`.
2. **dispatch**: No `id` means a notification. The server sends no response.
3. **validate_request**: Checks `params._meta` for version and capabilities.
4. **HANDLERS**: Routes by `method`. An unknown method gives `-32601`.
5. **complete**: Adds `resultType` and serverInfo to the handler result.
6. **serve_stdio**: Writes one JSON line to stdout, flushes, forgets the metadata.

## Validate and wrap every request
type: annotated-code
lang: python
from: phases/13-tools-and-protocols/07-building-an-mcp-server/code/main.py

```python
meta = params.get("_meta")                     # -32602 when missing
requested = meta.get(VERSION_KEY)              # protocolVersion key
if requested not in SUPPORTED_VERSIONS:
    raise RpcProblem(-32022, "Unsupported protocol version",
        {"requested": requested, "supported": SUPPORTED_VERSIONS.copy()})
if not isinstance(meta.get(CAPABILITIES_KEY), dict):
    raise RpcProblem(-32602, f"{CAPABILITIES_KEY} is required")
result = {"resultType": "complete", **payload,
    "_meta": {SERVER_INFO_KEY: SERVER_INFO.copy()}}
if ttl_ms is not None:                         # lists, reads, discovery
    result["ttlMs"] = ttl_ms
    result["cacheScope"] = cache_scope         # default "private"
```

## Register a tool and its executor
type: annotated-code
lang: python
from: phases/13-tools-and-protocols/07-building-an-mcp-server/code/main.py

```python
TOOL_EXECUTORS = {"notes_search": exec_notes_search}  # name to function
def handle_tools_list(params):
    return complete({"tools": sorted(TOOLS, key=lambda tool: tool["name"])},
                    ttl_ms=60_000, cache_scope="public")
def handle_tools_call(params):
    executor = TOOL_EXECUTORS.get(name)
    if executor is None:                      # result, not RPC error
        return complete({"content": [...], "isError": True})
    try:
        return complete({"content": executor(arguments), "isError": False})
    except (KeyError, TypeError, ValueError) as exc:
        return complete({"content": [...], "isError": True})
```

## Tool, resource or prompt
type: comparison
from: phases/13-tools-and-protocols/10-mcp-resources-and-prompts/docs/en.md

| Factor | Tool | Resource | Prompt |
|---|---|---|---|
| Intent | Perform an operation | Read content at a URI | Start a message workflow |
| Chooser | Model or application | Host, application or user | User through host UI |
| Result | Structured action result | Text or binary content | Prompt messages |
| Methods | `tools/list`, `tools/call` | `resources/list`, `resources/read` | `prompts/list`, `prompts/get` |
| Example | `delete_note` | `notes://note-1` | `review_note` |

## Tips
type: tips
from: phases/13-tools-and-protocols/07-building-an-mcp-server/docs/en.md, phases/13-tools-and-protocols/10-mcp-resources-and-prompts/docs/en.md, phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content/docs/en.md, phases/19-capstone-projects/13-mcp-server-with-registry/docs/en.md, projects/memory-server/solution

- Use `cacheScope: "private"` for user data. Use `ttlMs: 0` for secrets.
- Reject descriptors that mirror `password`, `secret`, `token` or `authorization`.
- Cap request bodies. The memory server sends 413 above 50000 bytes.

## Cache hints in the lessons
type: defaults
span: 1
from: phases/13-tools-and-protocols/07-building-an-mcp-server/code/main.py, phases/13-tools-and-protocols/10-mcp-resources-and-prompts/code/main.py, phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content/code/main.py, phases/19-capstone-projects/13-mcp-server-with-registry/code/main.py

| Setting | Default | Note |
|---|---|---|
| `server/discover` ttl | 3_600_000 | ms, `cacheScope` public |
| `tools/list` ttl | 60_000 | public. Capstone uses private |
| `resources/list` ttl | 10_000 | Lesson 07, private |
| `resources/read` ttl | 5_000 | Lesson 07, private |
| `prompts/list` ttl | 600_000 | Lesson 10, public |
| `cache_scope` | private | `complete()` default in lesson 07 |
| `limit` of `notes_search` | 10 | Integer from 1 through 50 |
| `MAX_TOOL_LIST_PAGES` | 100 | Lesson 28 client page cap |

## Error codes
type: troubleshooting
from: phases/13-tools-and-protocols/07-building-an-mcp-server/docs/en.md, phases/13-tools-and-protocols/07-building-an-mcp-server/code/main.py, phases/13-tools-and-protocols/10-mcp-resources-and-prompts/docs/en.md, phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| `-32700` Parse error | Line is not JSON | Send one JSON object per line |
| `-32600` Invalid Request | No `jsonrpc` 2.0 or no method | Fix the envelope |
| `-32602` invalid params | `params._meta` missing | Send version and capabilities each time |
| `-32022` | Unsupported version string | Retry with a version from `supported` |
| `-32601` | Method not in `HANDLERS` | Add the handler or fix the name |
| `-32602` on `resources/read` | Unknown or invalid URI | Never return an empty read |
| HTTP `400` and `-32020` | `Mcp-Param-*` header differs from body | Reject before dispatch |
| Client parse fails | Logs on stdout | Write diagnostics to stderr |

## Tool contracts
type: concepts
from: phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content/docs/en.md, phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content/code/main.py

- **inputSchema**: JSON Schema. With no `$schema`, the dialect is 2020-12.
- **No arguments**: `{"type": "object", "additionalProperties": false}`.
- **outputSchema**: Optional. Once published, every result carries conforming `structuredContent`.
- **structuredContent**: Any JSON value. Also send the JSON as a text block.
- **Content blocks**: `text`, `image`, `audio`, `resource_link`, `resource`.
- **x-mcp-header**: Mirrors a top-level argument to `Mcp-Param-{name}`. String, integer or boolean only.
- **Header encoding**: Non-ASCII or padded values use `=?base64?{Base64UTF8}?=`.
- **Cursors**: Opaque. An empty `nextCursor` is valid. Stop only on `None`.

## Memory server project
type: command-table
from: projects/memory-server/README.md, projects/memory-server/API.md, projects/memory-server/project.json, projects/memory-server/solution

| Command | What it does |
|---|---|
| `project_test.py --init <workspace>` | Creates your workspace. A fresh starter fails |
| `project_test.py --all --path <workspace> --strict` | Grades all four stages |
| `cli.ts --data-dir <dir> --put <file>` | Appends revision 1 to the JSONL log |
| `cli.ts --data-dir <dir> --query "<text>"` | 0.6 lexical plus 0.4 cosine score |
| `cli.ts --data-dir <dir> --history <id>` | Every revision with its source |
| `--put <file> --revision 1` | Appends revision 2. Revision 0 conflicts |
| `cli.ts --data-dir <dir> --serve --port 8788` | REST and MCP on one store. Needs MEMORY_TOKEN |

## Capstone policy gate
type: architecture
from: phases/19-capstone-projects/13-mcp-server-with-registry/docs/en.md, phases/19-capstone-projects/13-mcp-server-with-registry/code/main.py

```arch
node | reg | 1,1 | Registry API | server.json | store
node | client | 2,1 | MCP client | server/discover, tools/list | client
node | gw | 3,1 | policy_decide | issuer, audience, scope | process
node | ro | 4,1 | Read-only replicas | no affinity | process
node | appr | 2,2 | Approval record | arguments_digest | store
node | rw | 3,2 | State-changing replicas | destructive tools | process
node | audit | 4,2 | Audit sink | redacted entries | store
edge | reg | client | remote URL
edge | client | gw | tools/call
edge | gw | ro | allow
edge | gw | rw | allow
edge | appr | rw | approval
edge | ro | audit |
edge | rw | audit |
```

## Questions
type: qa
from: phases/13-tools-and-protocols/07-building-an-mcp-server/docs/en.md, phases/13-tools-and-protocols/10-mcp-resources-and-prompts/docs/en.md, phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content/docs/en.md, phases/19-capstone-projects/13-mcp-server-with-registry/docs/en.md, projects/memory-server/project.json

- **Tool error or protocol error?** A failed valid call returns `isError: true`. A bad envelope returns a JSON-RPC error.
- **Does discovery unlock the server?** No. `tools/list` carries the same request metadata.
- **Can the server ask the client for input?** It returns `input_required`. It never sends its own request.
- **How does a client learn a resource changed?** It opens `subscriptions/listen`. It then calls `resources/read` again.
- **Do annotations authorize?** No. `readOnlyHint` and `destructiveHint` are hints only.
