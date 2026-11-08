# Evidence: cheatsheets/mcp-tasks-elicitation-apps.md

Abbreviations: P = phases/13-tools-and-protocols. L12 = P/12-mcp-roots-and-elicitation, L13 = P/13-mcp-async-tasks, L14 = P/14-mcp-apps, L29 = P/29-mcp-reliability-cancellation-and-flow-control. d = docs/en.md, c = code/main.py.

## MRTR elicitation round trip (flow, 7 steps)
1. tools/call id 1 with elicitation form capability in _meta: L12/d:136-144, L12/c:117-126, 473-486
2. resultType input_required with inputRequests.delete_choice: L12/d:69-99, L12/c:294-298
3. requestState signs principal, method, argumentsDigest, candidateIds, nonce, expiresAt: L12/d:208-215, L12/c:285-293
4. host renders form, user accepts, declines or dismisses: L12/d:102
5. retry with fresh id 2, inputResponses and requestState: L12/d:102-130, L12/c:494-503
6. verify state, re-authorize workspace, re-check containment: L12/d:132
7. claim nonce once, delete, resultType complete: L12/d:219, L12/c:92-115, 428-437, L12/d:239

## Task lifecycle on a stateless core (architecture, 8 nodes)
- Client declares io.modelcontextprotocol/tasks extension: L13/d:63-80
- tools/call returns resultType task: L13/d:116-133, L13/c:236
- Durable store, persist before return: L13/d:135, 457, L13/c:167-180
- Worker advance_worker: L13/c:281-322. Worker lease: L13/d:384
- statuses working, input_required, completed, cancelled, failed: L13/d:144
- statusMessage: L13/d:148. inputRequests on input_required, nested result on completed, error on failed: L13/d:152-154
- tasks/update returns task to working: L13/c:261-267
- tasks/cancel sets cancelled: L13/c:270-279

## Task methods and signals (command-table, 8)
- tasks/get full snapshot, outer resultType complete: L13/d:189, 451
- tasks/update sends inputResponses, empty ack: L13/d:309, 452
- tasks/cancel intent only, ack not final: L13/d:315, L29/d:146
- subscriptions/listen POST with response SSE: L13/d:356
- notifications/tasks full snapshot with listen request id: L13/d:358
- notifications/cancelled stdio only, not for Task: L29/d:52, 70, L13/d:348
- close response stream on Streamable HTTP: L29/d:68-70
- tasks/status, tasks/result, tasks/list removed, method-not-found: L13/d:430, 462

## Drive a durable task (annotated-code, 12 lines)
- TaskService(directory) and TaskStore: L13/c:193-195, 444
- dispatch make_request tools/call generate_report size large: L13/c:451-457
- taskId from result: L13/c:459. resultType task status working: L13/d:423
- new TaskService(directory) reloads the task: L13/c:461, L13/d:397
- advance_worker working to input_required: L13/c:465, 281-306
- tasks/get id 3: L13/c:466-468
- tasks/update approve_outline accept approved True: L13/c:471-485
- advance_worker stage 2 to completed: L13/c:307-310, 487
- make_http_request sets Mcp-Name to params.taskId: L13/c:417-440, L13/d:344

## Idempotency, buffers and reconnect (annotated-code, 10 lines)
- MutationLedger mutations.sqlite3: L29/c:543
- charge acct-7 1200 rpc_id 41 and 42 with idempotency_key checkout-7: L29/c:544-555
- ledger.executions one execution, same receipt: L29/c:556, 571-572, L29/d:402-403
- classify_retry side_effect True with no key gives unsafe: L29/c:244-259
- BoundedSseBuffer(3), capacity at least two: L29/c:437, 558
- push_final never drops the final response: L29/c:466-470
- reconnect_plan arguments and sendLastEventId False: L29/c:490-501
- retry_delay_ms cap 8000: L29/c:504-511

## Elicitation answers (comparison, 5 rows)
- meaning and server action per action: L12/d:196-200
- accept consumes nonce with delete: L12/c:428-433, 317-337
- decline consumes nonce, no delete: L12/c:411-421, L12/d:221
- cancel no mutation, retryable until expiry: L12/c:405-410, L12/d:221
- deleted True / False structuredContent: L12/c:409, 419, 436

## Numbers and defaults (defaults, 8)
- protocol version 2026-07-28 in _meta: L13/c:20, L12/c:26
- ttl_ms 900_000 from creation: L13/c:177, L13/d:382
- poll_interval_ms 1_000: L13/c:116, L13/d:147
- server/discover ttlMs 300_000, cacheScope public: L13/c:205-206, L14/c:200-201
- tools/list ttlMs 60_000 sorted by name: L13/c:212-213, L14/c:211
- requestState expiry 300 seconds: L12/c:292
- ReplayStore max_entries 1_000, -32023 when full: L12/c:82, 110-111
- backoff 250 times 2 per attempt, cap 8_000: L29/c:507, L29/d:281-286

## Errors and failures (troubleshooting, 8)
- -32602 missing or non-string version: L12/d:148, L13/d:84
- -32022 supported and requested data: L12/d:148, L14/d:200
- -32021 missing capability (form, tasks, ui): L12/d:148, L13/d:84, L14/d:201
- -32020 header and body mismatch: L14/d:157, 199
- not found after handle: L13/d:135
- mutation twice with new RPC id: L29/d:417
- progress resets every deadline: L29/d:416
- task ack treated as final: L29/d:427

## Apps rules (concepts, 7)
- extension io.modelcontextprotocol/ui, both peers: L14/d:45, 302
- _meta.ui.resourceUri on tool before call: L14/d:101-119
- ui://notes/timeline.html with text/html;profile=mcp-app: L14/c:23-24, L14/d:304
- empty CSP lists by default: L14/c:33-38, L14/d:212
- ui/initialize then ui/notifications/initialized: L14/d:227-229
- fallback without _meta.ui, text result: L14/d:246-251
- cache key parts: L14/d:189

## Scope rules (tips, 6)
- Roots deprecated, use workspaceUri or resource URI: L12/d:34-38
- three layers authorization, containment, sandbox: L12/d:47-51
- normalize then compare path components: L12/d:63
- no secrets in form mode: L12/d:167
- URL mode accept is not completion: L12/d:188
- empty elicitation means form, URL-only does not: L12/d:146

## Questions (qa, 6)
- server decides task creation: L13/d:92
- final result under result in tasks/get: L13/d:198
- input before vs after task creation: L13/d:239-245
- ui/initialize is not a core session: L14/d:33, 229
- isError true is completed: L13/d:372
- no Last-Event-ID, new listen and refetch: L29/d:263-269
