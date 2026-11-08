# Evidence: cheatsheets/mcp.md

Abbreviations: L06 = phases/13-tools-and-protocols/06-mcp-fundamentals, L07 = phases/13-tools-and-protocols/07-building-an-mcp-server, L08 = phases/13-tools-and-protocols/08-building-an-mcp-client, L09 = phases/13-tools-and-protocols/09-mcp-transports, L12 = phases/13-tools-and-protocols/12-mcp-roots-and-elicitation, L16 = phases/13-tools-and-protocols/16-mcp-security-oauth-2-1, L29 = phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control.

## Front matter
- subtitle 2026-07-28, stdio and Streamable HTTP: L06/docs/en.md:22, L09/docs/en.md:28-42

## Tasks (task-table, 8)
- python3 main.py serves stdio (no flag): L07/code/main.py:401-406
- python3 main.py --demo: L07/docs/en.md:162, L07/code/main.py:403
- python3 main.py --serve: L09/code/main.py:568-572
- python3 main.py --probe: L09/docs/en.md:191
- make_request(1, "server/discover"): L07/code/main.py:381
- make_request(2, "tools/list"): L07/code/main.py:382
- make_request(5, "tools/call", {"name", "arguments"}): L07/code/main.py:385-389
- client.add_server(..., allow_legacy=True): L08/code/main.py:567, L08/docs/en.md:97

## Define and run a tool (annotated-code, 14 lines)
- TOOLS entry notes_search, description, inputSchema, required, annotations readOnlyHint: L07/code/main.py:39-51 (limit property and idempotentHint left out)
- annotations are hints, server enforces: L07/docs/en.md:104-111
- handle_tools_call, TOOL_EXECUTORS.get, unknown tool isError True, success isError False: L07/code/main.py:254-269 (type checks and exception branch left out)

## One tools/call over HTTP (annotated-code, 10 lines)
- POST /mcp, one message per POST: L09/docs/en.md:42-44
- Accept header: L09/docs/en.md:56
- MCP-Protocol-Version, Mcp-Method, Mcp-Name and equality rules: L09/docs/en.md:82-93
- request body with _meta version and clientCapabilities: L06/docs/en.md:59-74, L09/docs/en.md:128-147

## Architecture (7 nodes)
- Agent host merges catalogs: L08/docs/en.md:21
- MultiServerClient, one Peer per server: L08/code/main.py:270, 290; L08/docs/en.md:36
- stdio one JSON line each, subprocess, stdin: L09/docs/en.md:30-33
- MCP server dispatch, HANDLERS: L07/code/main.py:330-341
- Authorization server issues tokens: L16/docs/en.md:39
- Streamable HTTP POST /mcp: L09/docs/en.md:42
- Primitives tools, resources, prompts: L06/docs/en.md:37-41

## Discover, list, call (flow, 7)
1. server/discover with _meta: L06/docs/en.md:57-77, 108
2. supportedVersions, capabilities, no session: L07/docs/en.md:74-96, L06/docs/en.md:145
3. tools/list sorted with ttlMs, cacheScope: L07/code/main.py:246-251, L07/docs/en.md:100
4. tools/call name, arguments, new id: L07/code/main.py:255-256, 385-389
5. validate_request, -32022: L07/code/main.py:154-173
6. dispatch routes by method: L07/code/main.py:341-352
7. resultType complete, content, isError: L07/code/main.py:137-151, 265

## Methods (command-table, 8)
- server/discover: L06/docs/en.md:108-114
- tools/list: L06/docs/en.md:39
- tools/call: L06/docs/en.md:39
- resources/list: L06/docs/en.md:40
- resources/read: L06/docs/en.md:40
- prompts/list, prompts/get: L06/docs/en.md:41
- cacheable list results: L06/docs/en.md:104
- subscriptions/listen: L09/docs/en.md:124-150
- notifications/cancelled, no response: L29/docs/en.md:45-60

## Key concepts (concepts, 8)
- stateless core: L06/docs/en.md:22, 192
- metadata required/recommended: L06/docs/en.md:77
- complete result: L06/docs/en.md:83
- cacheable result: L06/docs/en.md:104
- annotations are hints: L07/docs/en.md:104-111
- stdio stdout/stderr: L07/docs/en.md:43, L09/docs/en.md:30-34
- Streamable HTTP one endpoint, each message a POST: L09/docs/en.md:42-44
- legacy initialize, notifications/initialized through 2025-11-25: L06/docs/en.md:149

## Defaults (defaults, 8)
- PROTOCOL_VERSION 2026-07-28: L07/code/main.py:17
- server/discover ttl 3_600_000 public: L07/code/main.py:241-242
- tools/list ttl 60_000 public: L07/code/main.py:249-250
- resources/read ttl 5_000 private: L07/code/main.py:291-292
- complete() cache_scope default private: L07/code/main.py:141
- --serve on 127.0.0.1 port 8017: L09/code/main.py:572
- MAX_REQUEST_BYTES 1_048_576: L09/code/main.py:37
- legacy_probe_timeout_ms 1_000: L08/code/main.py:298

## Troubleshooting (troubleshooting, 8)
- -32022 pick from data.supported, new id: L08/docs/en.md:79, L06/docs/en.md:127
- -32602 missing metadata: L07/docs/en.md:70
- HTTP 400 -32020 header mismatch: L09/docs/en.md:104
- 403 Origin not allowed, exact match: L09/docs/en.md:72, 76
- 405 GET and DELETE: L09/docs/en.md:63-64
- stdout only JSON, logs to stderr: L07/docs/en.md:43
- 401 invalid, expired, wrong audience: L16/docs/en.md:176
- 403 insufficient_scope step up: L16/docs/en.md:180-183

## Glossary (glossary, 7)
- JSON-RPC 2.0: L06/docs/en.md:47-51
- SSE text/event-stream: L09/docs/en.md:49, 224
- MRTR: L07/docs/en.md:144, L12/docs/en.md:289
- PKCE: L16/docs/en.md:290
- CIMD: L16/docs/en.md:287
- DCR: L16/docs/en.md:288
- RFC 9728: L16/docs/en.md:49-60, 286

## Questions and answers (qa, 5)
- tool error vs protocol error: L07/docs/en.md:102
- no server-initiated requests, input_required: L07/docs/en.md:140-144
- cancel on stdio and HTTP: L29/docs/en.md:47-72
- stdio needs no OAuth: L16/docs/en.md:43-45
- initialize only for allowlisted legacy peer: L08/docs/en.md:100-102, L06/docs/en.md:151

## Tips (tips, 6)
- sort lists: L06/docs/en.md:104, L08/docs/en.md:132
- bind 127.0.0.1, origin not auth: L09/docs/en.md:74
- exact origin match: L09/docs/en.md:76
- bearer token in Authorization, not URL: L16/docs/en.md:47
- explicit state handle, sticky routing fails: L09/docs/en.md:156-168
- collision prefix or reject, never overwrite: L08/docs/en.md:136-140
