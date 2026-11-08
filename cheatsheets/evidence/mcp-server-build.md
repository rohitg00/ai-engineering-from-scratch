# Evidence: cheatsheets/mcp-server-build.md

Abbreviations: L07 = phases/13-tools-and-protocols/07-building-an-mcp-server, L10 = phases/13-tools-and-protocols/10-mcp-resources-and-prompts, L28 = phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content, C13 = phases/19-capstone-projects/13-mcp-server-with-registry, MS = projects/memory-server. d = docs/en.md, c = code/main.py.

## Run the lesson servers (task-table)
- Serve on stdio, `python3 main.py`: L07/c:401-405 (no flag runs serve_stdio), L10/d:281
- `python3 main.py --demo`: L07/d:162, L07/c:5, 402
- `npx tsx main.ts --demo`: L07/d:169
- `python3 -m unittest discover tests -v`: L07/d:163, L10/d:282, L28/d:356
- `make_request(2, "tools/list")` stamps `_meta`: L07/c:113-122, 382
- `python3 code/main.py`: C13/d:256
- `npm run typecheck`: C13/d:265

## The dispatch loop (flow, 6 steps)
1. serve_stdio reads lines, bad JSON gives -32700: L07/c:359-367, L07/d:31
2. no id is a notification, no response: L07/c:342-343, L07/d:33
3. validate_request checks params._meta: L07/c:154-182, L07/d:34
4. HANDLERS routes by method, unknown gives -32601: L07/c:330-338, 348-350, L07/d:35
5. complete adds resultType and serverInfo: L07/c:137-151, L07/d:36
6. write one line, flush, forget metadata: L07/c:375-376, L07/d:37-38, 44, 70

## Validate and wrap every request (annotated-code)
- meta = params.get("_meta"), -32602 when missing: L07/c:162-164
- requested = meta.get(VERSION_KEY): L07/c:19, 165
- -32022 with requested and supported: L07/c:168-173
- CAPABILITIES_KEY required, -32602: L07/c:174-175
- resultType complete plus SERVER_INFO_KEY in _meta: L07/c:143-147
- ttlMs and cacheScope only when ttl_ms set, cache_scope default "private": L07/c:141, 148-150, L07/d:138

## Register a tool and its executor (annotated-code)
- TOOL_EXECUTORS maps name to function: L07/c:227-231
- handle_tools_list sorted by name, 60_000, public: L07/c:246-251
- unknown tool returns isError True result: L07/c:259-263
- executor result with isError False: L07/c:264-265
- KeyError, TypeError, ValueError give isError True: L07/c:266-269

## Tips (tips)
- cacheScope private for user data, ttlMs 0 for secrets: L07/d:117, L10/d:189
- reject mirrored password, secret, token, authorization: L28/d:187
- body cap 50000 bytes, 413: MS/solution/main.ts:199-201

## Tool, resource or prompt (comparison)
- intent row: L10/d:28-30
- chooser row: L10/d:28-30
- result row: L10/d:28-30
- methods row: L10/d:94, 118, 150, 174
- examples delete_note, notes://note-1, review_note: L10/d:32

## Cache hints in the lessons (defaults)
- server/discover 3_600_000 public: L07/c:241-242, L10/code/main.py:107-108, C13/c:115-116
- tools/list 60_000 public, capstone private: L07/c:249-250, C13/c:135
- resources/list 10_000 private: L07/c:277
- resources/read 5_000 private: L07/c:291-292
- prompts/list 600_000 public: L10/code/main.py:134
- cache_scope default private: L07/c:141
- notes_search limit default 10, 1 through 50: L07/c:47, 199-201
- MAX_TOOL_LIST_PAGES 100: L28/c:27

## Error codes (troubleshooting)
- -32700 Parse error: L07/c:367
- -32600 Invalid Request: L07/c:155-156
- -32602 missing params._meta: L07/c:163-164, L07/d:70
- -32022 unsupported version, supported list: L07/d:70, L07/c:168-173
- -32601 method not found: L07/c:349-350
- -32602 unknown resource URI, not an empty read: L10/d:118, 134
- HTTP 400 and -32020 on Mcp-Param mismatch: L28/d:214-223
- logs on stdout, use stderr: L07/d:43

## Tool contracts (concepts)
- inputSchema default dialect 2020-12: L28/d:56
- no-argument schema with additionalProperties false: L28/d:58-67
- outputSchema optional, commits to structuredContent: L28/d:69-73
- structuredContent any JSON value, plus text block: L28/d:77-84, 118
- content block types text, image, audio, resource_link, resource: L28/d:137-143
- x-mcp-header to Mcp-Param-{name}, string, integer or boolean: L28/d:153, 176-178
- base64 sentinel form: L28/d:193-206
- empty nextCursor valid, stop on None: L28/d:235-248

## Memory server project (command-table)
- --init creates workspace, fresh starter fails: MS/README.md:9, 12
- --all --path --strict grades the stages: MS/README.md:19, 60-65
- --put appends revision 1: MS/README.md:21, 42
- --query, 0.6 lexical plus 0.4 cosine: MS/README.md:22, MS/solution/main.ts:157, MS/project.json:76
- --history shows revisions with sources: MS/README.md:23, 95
- --put updated --revision 1 appends revision 2, revision 0 conflicts: MS/README.md:42, 58, 91
- --serve --port 8788 with MEMORY_TOKEN, shared store: MS/README.md:48, 55, MS/API.md:3

## Capstone policy gate (architecture, 7 nodes, 7 edges)
- Registry API and server.json: C13/d:56-72, 153
- MCP client calls server/discover and tools/list: C13/d:154-156
- policy_decide checks issuer, audience, scope: C13/c:213-232
- read-only replicas, no affinity: C13/d:121, 158, 230
- approval record bound to arguments_digest: C13/c:163, 174, 233-243, C13/d:190
- state-changing replicas, destructive tools: C13/d:159, C13/c:491
- audit sink with redacted entries: C13/d:160-162, C13/c:249, 257, 282-297

## Questions (qa)
- isError for a failed valid call, JSON-RPC error for bad envelope: L07/d:102, MS/project.json:95
- discovery does not unlock the server: L07/d:96
- input_required, no server-initiated request: L07/d:142-144
- subscriptions/listen, then resources/read: L10/d:197, 259
- annotations are hints: L07/d:104-111, C13/d:184
