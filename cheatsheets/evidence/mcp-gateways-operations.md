# Evidence: cheatsheets/mcp-gateways-operations.md

Abbreviations: P = phases/13-tools-and-protocols. L17 = P/17-mcp-gateways-and-registries, L23 = P/23-capstone-tool-ecosystem, L30 = P/30-mcp-registry-supply-chain-and-drift, L31 = P/31-mcp-conformance-versioning-and-operations. d = docs/en.md, c = code/main.py.

## Gateway request path (architecture, 8 nodes)
- Client sends bearer and _meta over POST: L17/d:62-69, 109-120
- validate_wire, header and body equality, -32020 before backend lookup: L17/c:160, L17/d:73
- RBAC and TokenBucket per principal: L17/c:39-42, 231-245, 383-394
- descriptor pin with descriptor_digest: L17/c:126-128, 290-294, 397-404
- Registry record is publication metadata only: L17/d:156-175
- admission state with verified publisher, joined to record: L17/d:177-190, L17/c:131-157
- notes and issues backends get a fresh request id: L17/c:248-289, L17/d:332
- public names notes.search, issues.list: L17/d:128-133

## Run and verify (command-table, 5)
- python3 code/main.py: L17/d:328, L23/d:205, L30/d:165, L31/d:267
- python3 -m unittest discover code/tests -v: L17/d:329
- python3 -m unittest discover -s code/tests -v: L30/d:291, L31/d:398
- python3 -q from code/: L30/d:224-225, L31/d:320-321
- from main import *: L30/d:241, L31/d:327

## Gateway tasks in code (task-table, 7)
- make_request(method, request_id, params): L17/c:116
- gateway.handle("bearer-alice", body, headers): L17/c:463
- validate_wire(body, headers): L17/c:160
- descriptor_digest(tool): L17/c:126
- TokenBucket().consume(): L17/c:231-245, 386-387
- registry_record_is_admissible: L17/c:131
- gateway_call(token, tool_name, args, ...): L23/c:224

## Registry admission, drift, rollback (annotated-code, 11 lines)
- RegistryAdmissionController(clock=lambda: next(ticks)), active_meta: L30/c:515-516
- controller.admit with namespace_for_domain("example.com"), evidence_for, sample_live: L30/c:518-530
- namespace_for_domain reverses labels to com.example: L30/c:32-36
- controller.check_live with extra tool quarantines: L30/c:532, L30/d:121, 249
- observe_registry_status deprecated: L30/c:533
- rollback to 1.0.0 "unexpected delete tool": L30/c:534
- controller.ledger.verify, edits break verification: L30/c:543, L30/d:153
- namespace_matches com.exampleevil is False: L30/d:232-236, L30/c:39-41

## Conformance harness (annotated-code, 12 lines)
- validate_result legacy infers complete, modern raises ProtocolViolation: L31/d:328-332
- select_era timeout fails closed, -32021 proves modern: L31/d:335-345
- cases = [run_transcript(case) for case in transcript_suite()], 15 cases: L31/c:884, L31/d:270
- compare_sdk_view reports droppedFields futureHint: L31/d:278, 358-362
- inspect_proxy(exchange) finds 400 to 500 collapse: L31/c:750, L31/d:217, 280
- redact(value) before hashing: L31/c:116, L31/d:224
- evaluate_health(healthy_window()) samples, error rate, p95: L31/c:782-790, 873-880
- ReleaseGate(...).evaluate(cases, [sdk_report], [proxy_report], healthy_window(), rollback): L31/c:921-923, L31/d:283

## Seven admission controls (flow, 7)
1. namespace exact segment compare, verified input: L30/d:61-67
2. provenance join fields: L30/d:73-79
3. pin digests, not ^1.4 or latest: L30/d:91-104
4. live drift via server/discover, digest change quarantines: L30/d:110-121
5. official _meta status, deprecated or deleted quarantines: L30/d:125-131
6. rollback to admitted, active, not quarantined pin: L30/d:137-145
7. ledger with previous hash and own hash: L30/d:153

## Gateway errors (troubleshooting, 8)
- 401 -32001 Unauthenticated: L17/c:358-364
- 403 -32003 Forbidden from RBAC: L17/c:383-385, 445
- 429 -32029 Rate limited: L17/c:386-394
- 409 -32010 Descriptor changed; re-approval before pin update: L17/c:397-404, L17/d:145-150
- 400 -32020 header mismatch: L17/d:73-75
- 400 -32022 unsupported version with supported data: L17/d:75
- 406 subscriptions/listen without text/event-stream: L17/c:408-415
- 405 GET and DELETE: L17/c:354-355, L17/d:71

## Defaults and numbers (defaults, 8)
- discover ttlMs 30_000 cacheScope private: L17/c:372-373
- tools/list ttlMs 10_000 private, filtered by user: L17/c:376-380, L17/d:137
- TokenBucket capacity 5, refill_per_second 1.0: L17/c:232-233
- maxErrorRate 0.01: L31/c:786
- maxP95Ms 500: L31/c:788
- MODERN_VERSION 2026-07-28, resultType required: L31/c:17, L31/d:42
- LEGACY_VERSION 2025-11-25, allowlist plus valid initialize: L31/c:18, L31/d:61
- Registry schema 2025-12-11 independent of protocol version: L30/d:49

## Release failures (troubleshooting, 6)
- downgrade after -32021: L31/d:426, 63
- SDK synthesizes discriminator: L31/d:425
- proxy 400 to 500: L31/d:430
- canary zero samples: L31/d:435, L31/c:784
- new tool after approval: L30/d:315
- rollback target never admitted: L30/d:318

## Rules (tips, 7)
- never pass outer gateway token: L17/d:217
- do not copy outer capabilities: L17/d:122
- rate limit keys: L17/d:221
- preserve requestState, re-authorize retry: L17/d:289-291
- task routing by params.taskId in Mcp-Name: L17/d:299
- admission before tools/list: L30/d:213
- redact before serialization, hashing, logs, upload: L31/d:224

## Questions (qa, 5)
- registry presence is not approval: L17/d:190, 202
- serverInfo diagnostic only: L17/d:105, L30/d:117
- unknown field vs unknown resultType: L31/d:164-176
- rollback changes route, not record: L30/d:137
- green local run validates simulation only: L23/d:181
