# Evidence: cheatsheets/mcp-client-transports.md

Abbreviations: L14 = phases/11-llm-engineering/14-model-context-protocol, C08 = phases/13-tools-and-protocols/08-building-an-mcp-client, T09 = phases/13-tools-and-protocols/09-mcp-transports, S11 = phases/13-tools-and-protocols/11-mcp-sampling, J22 = phases/19-capstone-projects/22-jsonrpc-stdio-transport, PJ = projects/mcp-at-scale. d = docs/en.md, c = code/main.py.

## Multi-server client (architecture, 6 nodes, 5 edges)
- Host owns model and UI, client speaks to servers: C08/d:21, L14/d:37
- MultiServerClient with one Peer per server: C08/c:270, 290, 326-330, C08/d:36
- registry maps canonical name to peer and local name: C08/c:283-286, 311, 521-526
- notes and files modern peers: C08/c:560-561, 565-566
- archive legacy peer with allow_legacy=True: C08/c:562, 567, C08/d:97
- edge canonical name: C08/d:142, 148-150
- edge _meta on each request: C08/c:472-481, C08/d:45
- edge one initialize probe: C08/c:358-369, C08/d:102

## Stdio era probe (flow, 7 steps)
1. server/discover before any other request: C08/d:76
2. DiscoverResult is modern, highest mutually supported version: C08/d:70, 78, C08/c:340-342
3. -32022, choose from data.supported, retry with new id: C08/d:79
4. -32020 and -32021 are modern, correct the request, no initialize: C08/d:79, 84-88
5. unrecognized error, timeout, close, empty response are ambiguous, fail closed: C08/d:80
6. allowlisted peer gets one initialize under a deadline, checks protocolVersion, capabilities, serverInfo: C08/d:100-108
7. era cache for the transport lifetime: C08/d:112, 124

## Client tasks in code (task-table, 8 rows)
- client.add_server("notes", notes): C08/c:565
- client.add_server("archive", archive, allow_legacy=True): C08/c:567, C08/d:97
- client.connect_all() probes peers in sorted name order: C08/c:468-470, 569
- client.discover_tools() lists tools of available peers: C08/c:499-504, 570
- client.merge(policy="reject"): C08/c:506-517
- client.call("notes/search", {}): C08/c:529, 580-581
- http_headers_for(message): T09/c:147-166
- serve(handler, StdioTransport(stdin, stdout)): J22/c:112, 186, 250-251

## Run the lessons (command-table, 7 rows)
- python3 code/main.py, demo-server at 2026-07-28: L14/d:217, 222
- python3 main.py in code/ for 13.08, peers, merged tools, calls: C08/d:179-180, C08/c:573-582
- python3 main.py --probe: T09/d:190-191, T09/c:502-504, 569-571
- python3 main.py --serve, http://127.0.0.1:8017/mcp: T09/c:569-573
- python3 main.py in code/ for 13.11, request ids [1, 2, 3]: S11/d:211-212, 222
- python3 code/main.py BytesIO demo prints server_responses: J22/c:8, 217-254
- python3 -m unittest discover tests -v: L14/d:219, C08/d:181, T09/d:192, S11/d:213

## Stamp every modern request (annotated-code, 8 lines)
- modern_request signature and body: C08/c:46-55
- body_params["_meta"] = request_meta(version, capabilities): C08/c:54
- return envelope: C08/c:55
- VERSION_KEY: C08/c:16, required at C08/c:133-135
- CAPABILITIES_KEY: C08/c:17, required at C08/c:142-143
- CLIENT_INFO_KEY: C08/c:18, 22
- RECOGNIZED_MODERN_ERRORS: C08/c:20, 438-440

## stdio or Streamable HTTP (comparison, 8 rows)
- use: client-launched subprocess vs network service: T09/d:12, 30
- framing: one UTF-8 message per line vs one message per POST: T09/d:32-33, 44
- version context in params._meta, headers mirror it: T09/d:36, 80-94
- response: stdout line vs JSON or request-scoped SSE: T09/d:33, 46-49
- notification: no response vs 202 Accepted with no body: J22/d:43 (stdio rule shared), T09/d:51
- diagnostics: stderr vs HTTP status plus JSON-RPC body: T09/d:34, 104-106
- change events: reopen after restart vs subscriptions/listen POST stream: T09/d:38, 126, 150
- safety: exit on stdin EOF vs validate Origin and bind 127.0.0.1: T09/d:35, 72-74

## MRTR round for Sampling (flow, 6 steps)
1. tools/call with clientCapabilities holding sampling: S11/d:44-60, S11/c:221-226
2. input_required with inputRequests and requestState: S11/d:84-108, S11/c:189-195
3. client checks capability and approval policy, asks its model: S11/d:113, 178
4. retry with same method and arguments, new id, inputResponses, exact requestState: S11/d:113, 143, S11/c:351-357
5. server verifies HMAC, principal, arguments digest, expiry: S11/d:156-164, S11/c:148-162
6. final resultType complete: S11/d:72, 202

## Defaults in the lesson code (defaults, 8 rows)
- discovery_timeout_ms 1_000, must be positive: C08/c:297, 302-303
- legacy_probe_timeout_ms 1_000, passed to transport: C08/c:298, 369, C08/d:110
- merge policy prefix-on-collision or reject: C08/c:506-507
- discovery ttl_ms 3_600_000 and cache_scope="public": C08/c:183-184
- MAX_REQUEST_BYTES 1_048_576, parse error -32700 on bad length: T09/c:37, 415-419, 428
- READ_TIMEOUT_SECONDS 5.0 on the body read: T09/c:38, 420-421
- maxTokens 400 per sampling request: S11/c:178
- requestState expiry 300 seconds: S11/c:235, 268

## Status and error codes (troubleshooting, 8 rows)
- HTTP 400 and -32020 for missing or mismatched header: T09/d:104, T09/c:209-219
- HTTP 400 and -32022 with supported data: T09/d:104, T09/c:193-198
- -32021 with data.requiredCapabilities: S11/d:64
- -32602 for missing _meta or bad requestState: L14/d:61, S11/d:164
- HTTP 403 for Origin not allowed, exact match: T09/d:72, 76, T09/c:372
- HTTP 404 with -32601 for unknown modern method: T09/d:106, T09/c:459
- HTTP 405 for GET and DELETE, use subscriptions/listen: T09/d:63-64, 126
- -32700 with null id, loop continues: J22/d:59, 63, 90

## Questions (qa, 5 bullets)
- -32601 is not legacy evidence, only one probe for an allowlisted peer: C08/d:90
- no stream resume, Last-Event-ID ignored, new request with new id: T09/d:66-68
- workflow state in a server-minted handle passed as an argument: T09/d:156
- no server-initiated requests, input_required and retry: C08/d:166
- model preferences are independent hints: S11/d:170

## Project: MCP Tool Discovery Workbench (command-table, 4 rows)
- --all --path --strict grader, --init first: PJ/README.md:12, 19
- cli.py samples/inventory.json --query "pods count" --max-chars 500, best schema in budget: PJ/README.md:21, 33, 38
- cli.py /absolute/inventory.json --serve with catalog_search: PJ/README.md:44, PJ/API.md:3
- checks -32002 before initialize, 32 tools per page, 250 names across 8 pages: PJ/project.json:74, 84, PJ/solution/protocol.py:54, 65-69

## Tips (tips, 5 bullets)
- inspect the final serialized request: C08/d:66
- Base64 sentinel for Mcp-Name: T09/d:96-99
- cap MRTR rounds, validate each sampling response: S11/d:179-180
- reissue subscriptions/listen on stream loss and refetch: T09/d:150
- stdio diagnostics to stderr: T09/d:34
