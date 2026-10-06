# a2a-tck 1.0.0.alpha2 against the A2A 101 capture kit

Run on 2026-10-06. The kit's `test-runner` agent was served from the manual's capture directory, untouched, and the official conformance kit was run against it: once exactly as published at the tag (run 1), and once with a two-line change to the TCK's JSON-RPC client that is explained below (run 2). Run 2 found one kit defect; the kit was fixed the same day and run 2 was repeated in full against the fixed kit. The run 2 numbers and tables below are from that repeat; the pre-fix outputs are kept under `*before-kit-fix*` names. Every result that is not a pass is classified in section 3. Paths below are relative to `research/` (scratchpad) unless they start with `/tmp/aiefs-manuals`. Line numbers for the kit refer to `/tmp/aiefs-manuals/manuals/a2a-101/capture/a2a_ref.py` and `agents.py` as of the fix (file dated 2026-10-06 16:18 local); line numbers for the specification refer to `/tmp/aiefs-manuals/manuals/a2a-101/research/sources/specification.md` (v1.0.1).

## 1. What was run

**TCK.** `repos/a2a-tck` at tag `1.0.0.alpha2` = `29063fe95e903cddac5d8ff811ab94df1ad6ef86` (2026-05-27), package version `1.0.0` (`pyproject.toml:7`), bundled specification snapshot of the A2A `v1.0.0` branch at `1736957` (`specification/version.json`). Where the tag's behavior has changed on `main` (`repos/a2a-tck-main` at `263b9cf`, 2026-09-01) the commit is named. The TCK's own level policy is `README.md:66-74`: MUST hard-fails, SHOULD is an `xfail`, MAY is skipped when the card does not declare the capability.

**Environment.** macOS (Darwin 25.2.0), Python 3.12.7 (pyenv) in `.venv` inside the clone, pytest 9.1.1, httpx 0.28.1, jsonschema 4.26.0, uv 0.9.25. `uv venv` panics under the session's Seatbelt sandbox ("Attempted to create a NULL object"), so the two install commands were run once with the sandbox off; nothing was installed globally.

**Agent.** `test-runner` from `agents.py:18-36` and `113-134`, started by `tck-run/serve_kit.py` with the kit's own `serve()` on `127.0.0.1:41251` (checked free with `lsof -i :41251` before each start). PID 33757 served run 1 and the pre-fix run 2 and was stopped with `kill 33757`; PID 53737 served the post-fix run 2 and was stopped with `kill 53737`; the port was confirmed free after each. The launcher builds the agent from the kit's `TEST_RUNNER_CARD` and `run_tests` with the card's `supportedInterfaces` rebuilt by the kit's `interfaces()` helper for that port, so the card the TCK fetched declares `JSONRPC` at `http://localhost:41251/a2a/jsonrpc` and `HTTP+JSON` at `http://localhost:41251/a2a/rest`, `capabilities.streaming` and `capabilities.pushNotifications`, `defaultInputModes` `text/plain` and `application/json`, and no security scheme. No gRPC interface exists: the kit is standard-library Python.

Why test-runner and not the other two: the TCK sends generic text ("Hello from TCK", "TCK prerequisite task creation") and expects most of it to produce a task that reaches a terminal state on its own. `run_tests` drives any text to `TASK_STATE_COMPLETED` (only "deadbee" fails). `code-reviewer` answers a question ending in `?` with a bare Message and parks every other first message in `TASK_STATE_INPUT_REQUIRED` until a follow-up contains `base:` (`agents.py:137-163`), and it does not declare push notifications. `deployer` requires `Authorization: Bearer dpl_test_7c1e4b` and blocks in `TASK_STATE_AUTH_REQUIRED` until something POSTs `/approve/<task id>`, which the TCK never does (`agents.py:166-179`). Only test-runner lets the streaming, push and completed-task families run unattended. The cost of that choice is explained under class (c): the TCK's "working task" prerequisite expects an agent that stops in `INPUT_REQUIRED`, which test-runner never does.

**Commands.**

```bash
cd research/repos/a2a-tck
uv venv --python /Users/rohitghumare/.pyenv/versions/3.12.7/bin/python   # sandbox off, see above
uv pip install -e .

python3 research/v2/tck-run/serve_kit.py 41251 > research/v2/tck-run/server.log 2>&1 &   # PID 33757

# run 1, the tag as published (2026-10-06T10:30:26Z to 10:30:29Z)
.venv/bin/python run_tck.py --sut-host http://127.0.0.1:41251 -v -- --webhook-host=127.0.0.1 -ra

# run 2, same command after a two-line change to the JSON-RPC client
# (pre-fix kit: 2026-10-06T10:33:58Z to 10:34:01Z; archived as *before-kit-fix*)
sed -i '' 's|^                "/",$|                self.base_url,|' tck/transport/jsonrpc_client.py
.venv/bin/python run_tck.py --sut-host http://127.0.0.1:41251 -v -- --webhook-host=127.0.0.1 -ra
git checkout -- tck/transport/jsonrpc_client.py        # clone restored; git status clean
kill 33757

# run 2 repeated against the fixed kit (2026-10-06T10:49:37Z to 10:49:39Z)
python3 research/v2/tck-run/serve_kit.py 41251 > research/v2/tck-run/server.log 2>&1 &   # PID 53737
sed -i '' 's|^                "/",$|                self.base_url,|' tck/transport/jsonrpc_client.py
.venv/bin/python run_tck.py --sut-host http://127.0.0.1:41251 -v -- --webhook-host=127.0.0.1 -ra
git checkout -- tck/transport/jsonrpc_client.py
kill 53737
```

`run_tck.py` expands each run to `python -m pytest tests/compatibility/ --sut-host=... --tb=short -v --compatibility-report=reports/compatibility --html=reports/tck_report.html --self-contained-html --junitxml=reports/junitreport.xml --webhook-host=127.0.0.1 -ra`. All levels ran (no `--level`), and both transports the card declares ran (no `--transport`).

Why there is a run 2. The TCK's JSON-RPC client is an `httpx.Client(base_url=<interface url>)` that posts to `"/"` (`tck/transport/jsonrpc_client.py:81-85, 104-105, 138-141`). httpx appends a slash to every base URL and strips the leading slash of the request path (`httpx/_client.py:234` `_enforce_trailing_slash`, `:391-409` `_merge_url`), so every JSON-RPC request went to `http://localhost:41251/a2a/jsonrpc/`, which is not the URL in the card. The kit routes JSON-RPC only at the exact path (`a2a_ref.py:549`) and answers `404 {"error": {"code": 404, "status": "NOT_FOUND", "message": "No such path"}}`; the TCK's own reference SUT declares its JSON-RPC interface at the host root (`sut/a2a-python/sut_agent.py:199`), where `/` and `` are the same URL, so the TCK never meets this itself. 63 of the 85 JSON-RPC records in run 1 fail or skip for this one reason, which says nothing about the kit. Run 2 replaces `"/"` with `self.base_url` in the two `post`/`build_request` calls (`tck-run/tck-jsonrpc-url.patch`), nothing else. On `main` the client still posts to `"/"` but sets `follow_redirects=True` (`main jsonrpc_client.py:85`, commit `c478be0`), which rescues servers that redirect `/path/` to `/path`; the kit answers 404 rather than redirecting, so `main` would see the same 63 failures.

**The kit fix of 2026-10-06.** The pre-fix run 2 showed the HTTP+JSON binding answering `404 Method not found` for `POST /tasks/{id}/pushNotificationConfigs`, the one MUST defect of section 4. The same day `a2a_ref.py` gained `rest_push()` (`:626-648`): `POST /tasks/{id}/pushNotificationConfigs`, `GET /tasks/{id}/pushNotificationConfigs/{configId}`, `GET /tasks/{id}/pushNotificationConfigs` and `DELETE /tasks/{id}/pushNotificationConfigs/{configId}`, behind the same `pushNotifications` capability guard as the JSON-RPC branch (`:630-631`, compare `:601-603`), answering `application/a2a+json`, routed from `rest()` at `:681-682`; the README sentence that said the four push operations ran over JSON-RPC only was removed. The repeat of run 2 and hand check 7 below verify it.

**Hand checks.** `tck-run/wire_check.py` (output in `wire-check.txt`), the inline webhook receiver whose output is `push-check.txt`, and the REST push-config probe whose output is `wire-check-rest-push.txt` reproduce the claims the classification rests on:

| Check | Request | Kit's answer |
|---|---|---|
| 1a | `POST /a2a/jsonrpc/` (what the tag sends) | `404 No such path` |
| 1b | `POST /a2a/jsonrpc` (the card URL) | `200`, task completed |
| 2a | `CreateTaskPushNotificationConfig` with `task_id` (TCK) | `-32001 TaskNotFound`, `metadata.taskId: ""` |
| 2b | same with `taskId` (spec 5.5) | config returned with `id`, `taskId`, `url` |
| 3a | `GetTask` with `history_length: 1` (TCK) | 2 history entries (parameter ignored) |
| 3b | `GetTask` with `historyLength: 1` (spec 5.5) | 1 history entry |
| 4a | JSON-RPC `SendMessage`, part `mediaType: application/x-unsupported-tck-type` | `-32005`, ErrorInfo `CONTENT_TYPE_NOT_SUPPORTED` |
| 4b | REST `POST /message:send`, same part | `400 INVALID_ARGUMENT`, ErrorInfo `CONTENT_TYPE_NOT_SUPPORTED` |
| 5a | `Content-Type: text/plain`, body is a Python `repr` (the tag's test) | `-32700 Invalid JSON payload` |
| 5b | `Content-Type: text/plain`, body is valid JSON (`main` `37d4944`) | `200`, task completed (header ignored) |
| 6 | `SendMessage` with inline `taskPushNotificationConfig` (Bearer auth, token) | 8 webhook POSTs: `Authorization: Bearer tck-test-token`, `Content-Type: application/a2a+json`, `X-A2A-Notification-Token: tok-1`, bodies `statusUpdate` WORKING, six `artifactUpdate`, `statusUpdate` COMPLETED |
| 7a | REST `POST /tasks/{id}/pushNotificationConfigs` (after the fix) | `200 application/a2a+json`, config with `id`, `taskId`, `url`, `authentication` |
| 7b, 7c | REST `GET .../{configId}`, `GET .../pushNotificationConfigs` | `200`, the config; `200 {"configs": [...]}` |
| 7d, 7f | REST `GET` of a missing or deleted config id | `404`, ErrorInfo `TASK_NOT_FOUND` (same choice as the JSON-RPC branch, `:608-611`) |
| 7e, 7g | REST `DELETE .../{configId}`, then again | `200 {}` both times (idempotent) |
| 7h | REST `POST` for an unknown task | `404`, ErrorInfo `TASK_NOT_FOUND` |
| 7i, 7j | `PUT` on the collection; `DELETE` on the collection | `501` from the standard library (no `do_PUT`, not an A2A operation); `404 Method not found` |

**Files.** `tck-run/serve_kit.py`, `run1-pristine.log`, `run2-jsonrpc-url-patch.log` (post-fix), `run2-before-kit-fix.log`, `reports/run1-pristine/`, `reports/run2-jsonrpc-url-patch/` (post-fix) and `reports/run2-before-kit-fix/` (each `compatibility.json`, `compatibility.html`, `tck_report.html`, `junitreport.xml` copied from the clone's `reports/`), `tck-jsonrpc-url.patch`, `wire_check.py`, `wire-check.txt`, `push-check.txt`, `wire-check-rest-push.txt`, `make_summary.py`, `summary.txt` (run 1), `summary-run2-jsonrpc-url-patch.txt` (post-fix run 2), `summary-run2-before-kit-fix.txt`, `server-run1-run2.log` (PID 33757) and `server.log` (PID 53737). The server logs hold the launcher's start line and identical `ConnectionResetError` tracebacks from `http.server.handle_one_request` waiting on a keep-alive connection that an httpx client closed; the kit serves HTTP/1.1 keep-alive (`a2a_ref.py:476`) and the standard library prints the reset. No request failed because of it.

## 2. Numbers

From `compatibility.json` (`summary` and `per_transport`) and the pytest totals:

| | Run 1, tag as published | Run 2, exact JSON-RPC URL, fixed kit |
|---|---|---|
| overall_compatibility | 32.3% | 66.7% |
| must_compatibility | 35.4% | 72.0% |
| should_compatibility | 14.3% | 14.3% |
| may_compatibility | 0.0% | 50.0% |
| requirements PASS / FAIL / SKIPPED / NOT TESTED (of 129) | 30 / 63 / 11 / 25 | 62 / 31 / 11 / 25 |
| MUST passed / failed / skipped (of 114) | 29 / 74 / 11 | 59 / 44 / 11 |
| SHOULD passed / failed / skipped (of 11) | 1 / 10 / 0 | 1 / 10 / 0 |
| MAY passed / failed / skipped (of 4) | 0 / 4 / 0 | 2 / 2 / 0 |
| pytest: passed / failed / skipped / xfailed (265 collected) | 70 / 44 / 149 / 2 | 119 / 21 / 125 / 0 |
| transport jsonrpc: passed / failed / skipped records | 12 / 63 / 10 (85) | 66 / 29 / 7 (102) |
| transport http_json | 59 / 30 / 6 (95) | 65 / 24 / 6 (95) |
| transport agent_card | 6 / 4 / 0 (10) | 6 / 4 / 0 (10) |
| transport grpc | 0 / 0 / 72 (72) | 0 / 0 / 72 (72) |

Before the kit fix, run 2 read 113 / 22 / 130 / 0 on pytest and 59 / 30 / 6 on http_json, with the same percentages and the same 129 verdicts. The fix flipped six HTTP+JSON records to PASS (PUSH-CREATE-001, PUSH-CREATE-002, PUSH-GET-001, PUSH-LIST-001, PUSH-DEL-001, PUSH-DEL-002) and removed five skips; no verdict moves because each of those six requirements still fails on its JSON-RPC side for the TCK's `task_id` parameter (class b, section 3.2), and a requirement fails if any transport fails.

How the TCK arrives at these: a requirement is FAIL if any record on any transport failed, SKIPPED if every record was a skip, else PASS (`tck/reporting/aggregator.py:118-125`); registry entries that no test touched are NOT TESTED (`:154-170`); the percentages divide passing requirements by requirements that are neither SKIPPED nor NOT TESTED (`:189-204`). The registry has 129 requirements, 114 MUST, 11 SHOULD, 4 MAY; 23 of them run through the generic runner, the rest need a dedicated test, and 25 have none at the tag.

Two accounting facts change how the numbers read.

1. The tag records a `pytest.skip()` raised inside a test body as a failure. The safety-net hook in `tests/compatibility/conftest.py:251-297` records any call-phase report that did not pass and did not call `record()` as FAIL with the skip tuple as the error text (`:271` tests only `report.passed`; `:292-297` records). `main` adds `if report.skipped: return` with the comment "Auto-recording it as a FAIL would misrepresent it" (`main conftest.py:310-318`). In run 2, 21 of the 31 FAIL requirements are of this kind (section 3.3). With `main`'s rule they are SKIPPED: PASS 62, FAIL 10, SKIPPED 32, NOT TESTED 25, which is overall 86.1% (62/72), MUST 89.4% (59/66), SHOULD 33.3% (1/3), MAY 66.7% (2/3).
2. The per-transport entry in `per_requirement[...].transports` is the last record written for that transport (`aggregator.py:105-111`), so a requirement with several tests on one transport can show `jsonrpc: PASS` next to a FAIL verdict (`JSONRPC-SSE-002`, `HTTP_JSON-ERR-001`, `HTTP_JSON-SVC-001`, `DM-ART-001`, `DM-MSG-001`). The summary files therefore carry the verdict as the status field and fold the per-transport records into the transport field.

Of the 10 requirements that fail in run 2 on a real assertion, none fails on the kit's account at MUST level: seven are the TCK's (class b: CORE-SEND-003, HTTP_JSON-ERR-001, HTTP_JSON-SVC-001, JSONRPC-SSE-002, PUSH-CREATE-001, CARD-CACHE-003), two are the agent story (class c: DM-ART-001, DM-MSG-001) and two are SHOULD-level omissions the kit documents (class e: CARD-CACHE-001, CARD-CACHE-002). Section 4 has the kit-defect record.

## 3. Every non-passing result

Classes: (a) kit breaks a v1.0.1 MUST; (b) the TCK expects something the specification does not require or contradicts; (c) the TCK's sample input does not suit the kit agent's story, so the result says nothing about conformance; (d) not supported by design; (e) other. Rows are requirement by transport, as the TCK records them. Test names are from `tests/compatibility/`.

### 3.1 Run 1 only: rows that pass once the JSON-RPC client posts to the card URL

All 32 rows below are class (b): the TCK sent every JSON-RPC request to `<url>/` (`tck/transport/jsonrpc_client.py:104-105, 138-141`; httpx `_client.py:391-409`), the kit answered `404 No such path` (`a2a_ref.py:549, 560`), and the TCK recorded either "Operation failed: No such path", "Expected error code -32001 (TaskNotFoundError), got 404" (the 404 body's `code` read as a JSON-RPC code), a schema error on the 404 body, or a prerequisite skip (`_task_helpers.py:90`) that the hook turned into a FAIL. Specification: `AgentInterface.url` is where the interface is available and "Each interface MUST accurately declare its transport protocol and URL" (`specification.md:1990`); nothing requires a server to also serve `<url>/`. Wire check 1a/1b. Every one of these is PASS in run 2.

| Requirement | Level | Transport | Run 1 record |
|---|---|---|---|
| CORE-SEND-001, CORE-SEND-002, CORE-STREAM-001, CORE-STREAM-002, CORE-STREAM-003, CORE-GET-001, CORE-LIST-001, CORE-LIST-002, CORE-LIST-003, CORE-LIST-004, CORE-LIST-005, CORE-CANCEL-002, CORE-EXECUTION-MODE-001, CORE-EXECUTION-MODE-002, CORE-MULTI-001a, CORE-MULTI-002a, CORE-MULTI-003, CORE-MULTI-006, STREAM-ORDER-001, STREAM-SUB-003, JSONRPC-FMT-001, JSONRPC-SSE-001 | MUST | jsonrpc | FAIL, "No such path" (directly or via a prerequisite skip) |
| CORE-GET-002, CORE-CANCEL-003, CORE-MULTI-004, STREAM-SUB-004 | MUST | jsonrpc | FAIL, "Expected error code -32001, got 404" |
| JSONRPC-ERR-001, JSONRPC-ERR-002 | MUST | jsonrpc | FAIL, the 404 body validated as a JSON-RPC error object ("'status' was unexpected", "404 is not in A2A range") |
| JSONRPC-ERR-003 | MUST | jsonrpc | SKIPPED/FAIL, "error.data is absent" on the 404 body |
| PUSH-GET-002 | MUST | jsonrpc | FAIL via prerequisite skip |
| CORE-MULTI-001, CORE-MULTI-002 | MAY | jsonrpc | xfailed, "No such path" |

Rows that are non-passing in both runs appear once, in 3.2 or 3.3, with their run 2 reason; in run 1 their JSON-RPC side also failed for the slash first (for example `JSONRPC-SSE-002`'s TaskNotFound, cancel and range sub-tests, which pass in run 2). Run 1 also recorded `PUSH-CREATE-001` http_json and the five push CRUD requirements' http_json sides as `404 Method not found`; that was the kit defect fixed on 2026-10-06 (section 4), and run 1 is kept as it was.

### 3.2 Run 2: rows that fail on a real assertion

| Requirement | Level | Transport | Class | Reason | Evidence |
|---|---|---|---|---|---|
| CARD-CACHE-001 | SHOULD | agent_card | (e) | The card response has no `Cache-Control` header. The specification says servers SHOULD send one with `max-age` (`spec:2219`); the kit's README documents the omission; the TCK hard-asserts a SHOULD although its README says SHOULD is an `xfail`. | `test_agent_card_caching.py:73-121` (asserts at 98, 121); `a2a_ref.py:531-532, 494-500`; kit `README.md` ("no `Cache-Control` or `ETag` header"); TCK `README.md:66-74` |
| CARD-CACHE-002 | SHOULD | agent_card | (e) | No `ETag` header; SHOULD at `spec:2220`; same hard assert. | `test_agent_card_caching.py:129-154`; kit `README.md` |
| CARD-CACHE-003 | MAY | agent_card | (b) | No `Last-Modified` header. The specification says MAY (`spec:2221`); a MAY cannot be failed, and the TCK's own policy is to skip MAY tests, yet the test asserts. | `test_agent_card_caching.py:162-187` (assert at 187); `tck/requirements/agent_card.py:212-215` |
| CORE-SEND-003 | MUST | jsonrpc | (b) | The TCK sent a part with `mediaType: application/x-unsupported-tck-type` and the kit answered `-32005 ContentTypeNotSupportedError` with ErrorInfo, exactly what 3.1.1 requires (`spec:174`, table `spec:559`, `spec:1186`). The registry entry has no `expected_error`, so the generic runner treats any error as "Operation failed". Unchanged on `main`. | `tck/requirements/core_operations.py:95-122` (contrast `:218-235`, which sets `expected_error`); `test_requirements.py:99-114`; `a2a_ref.py:258-261`; wire check 4a |
| CORE-SEND-003 | MUST | http_json | (b) | Same; the kit answered `400` with ErrorInfo `CONTENT_TYPE_NOT_SUPPORTED`. | wire check 4b; `a2a_ref.py:684-692` |
| DM-ART-001 | MUST | jsonrpc, http_json | (c) | Four tests send `messageId` prefixes `tck-artifact-text`, `-file`, `-file-url`, `-data` and expect the SUT scenario that returns the text "Generated text content", a file part named `output.txt` of `text/plain`, or the data `{"key": "value", "count": 42}`. That is the contract of the TCK's own SUT, not the protocol; test-runner streams its test log. The kit's artifacts passed the `SendMessageResponse` schema check that also records DM-ART-001. | `test_artifacts.py:55-71, 97-107, 128-162, 183-216, 237-248`; `sut/a2a-python/sut_agent.py:89-124`; schema pass `test_data_model.py:158-187`; `agents.py:113-134` |
| DM-MSG-001 | MUST | jsonrpc, http_json | (c) | Prefix `tck-message-response` expects a bare Message "Direct message response". The specification lets an agent return a Task or a Message (`spec:180`); test-runner always creates a Task. The Message schema check that records DM-MSG-001 passed. | `test_artifacts.py:257-295`; `sut_agent.py:112`; `test_data_model.py:158-187` |
| HTTP_JSON-ERR-001 | MUST | http_json | (b) | The error response is `Content-Type: application/a2a+json`; the test requires the substring `application/json`. The specification says `application/a2a+json` SHOULD be used for REST requests and responses (`spec:2750`) and its 11.6 example sends `Content-Type: application/a2a+json` (`spec:2924`). The other six HTTP_JSON-ERR-001/002 sub-tests (AIP-193 shape, `code` equals status, ErrorInfo reason and domain) passed. Unchanged on `main`. | `test_error_handling.py:604-634` (check at 621); `test_problem_details.py:84-116` (check at 101); `tck/requirements/binding_http_json.py:98-110`; `a2a_ref.py:688` |
| HTTP_JSON-SVC-001 | MUST | http_json | (b) | Same substring check on the success response; the schema sub-test passed. The registry text "MUST use Content-Type application/json" contradicts `spec:2750`. | `test_transport_behavior.py:250-261` (check at 260), `:264-278`; `binding_http_json.py:58-70`; `a2a_ref.py:660, 667, 676, 678, 680` |
| JSONRPC-SSE-002 | MUST | jsonrpc | (b) | `test_content_type_not_supported_error` posts `str(payload).encode()`, a Python `repr`, not JSON, with `Content-Type: text/plain`, and expects `-32005`. The kit answers `-32700 JSONParseError`, which 9.5 defines for "The server received invalid JSON" (`spec:2443`). The specification ties `ContentTypeNotSupportedError` to message parts (`spec:559`), not to the HTTP header. `main` `37d4944` sends valid JSON; the kit then accepts the request (wire check 5b) and the test would skip. The other seven JSONRPC-SSE-002 sub-tests passed. | `jsonrpc/test_error_codes.py:196-243` (body at 219-223); `main test_error_codes.py:228`; `a2a_ref.py:566-570`; wire check 5a |
| PUSH-CREATE-001 | MUST | jsonrpc | (b) | The client sends `{"task_id": ..., "id": ..., "url": ...}`; the kit reads `taskId`, finds no task and answers `-32001`. JSON field names MUST be camelCase (`spec:1204-1210`, with `context_id` to `contextId` as the worked example). The same client sends `history_length`, `context_id`, `page_size`, `include_artifacts`; the HTTP+JSON client sends them in camelCase, and with the fixed kit the HTTP+JSON side of this requirement is PASS. Unchanged on `main`. | `tck/transport/jsonrpc_client.py:245-271, 204-212, 214-235`; `http_json_client.py:248-287, 305-316`; `a2a_ref.py:604-607`; wire checks 2a/2b, 3a/3b, 7a |

### 3.3 Run 2: rows the hook recorded as FAIL after a skip in the test body

| Requirement | Level | Transport | Class | Reason | Evidence |
|---|---|---|---|---|---|
| CORE-CANCEL-001 | MUST | jsonrpc, http_json | (c) | `create_working_task` sends prefix `tck-input-required` and skips unless the task is in `TASK_STATE_INPUT_REQUIRED`; test-runner completes it ("Expected task state 'TASK_STATE_INPUT_REQUIRED' but got 'TASK_STATE_COMPLETED'"). Cancel of a live task was never attempted. | `_task_helpers.py:55-64, 96-98`; `test_task_lifecycle.py:195`; `sut_agent.py:116` |
| CORE-HIST-001, CORE-HIST-003, CORE-HIST-005, CORE-HIST-006 | SHOULD | jsonrpc, http_json | (c) | Same prerequisite, through `create_multiturn_task` / `_with_history` / `create_working_task`. | `test_task_history.py:69, 143, 247, 295`; `_task_helpers.py:107-187` |
| CORE-HIST-002 | MUST | jsonrpc, http_json | (c) | Same. Had it run, the JSON-RPC side would have sent `history_length` (class b) and the kit would have returned the full history (wire check 3a). | `test_task_history.py:104`; `jsonrpc_client.py:211-212` |
| CORE-HIST-004 | MAY | jsonrpc, http_json | (c) | Same prerequisite. | `test_task_history.py:193` |
| CORE-MULTI-005 | MUST | jsonrpc, http_json | (c) | Same prerequisite. | `test_task_lifecycle.py:299` |
| STREAM-ORDER-002, STREAM-ORDER-003, STREAM-ORDER-004 | MUST | jsonrpc, http_json | (c) | Same prerequisite (two parallel subscriptions on a working task). | `test_multi_stream.py:158, 184, 224` |
| STREAM-SUB-001 | MUST | jsonrpc | (c) | Same prerequisite. The generic STREAM-SUB-001 check is not run (multi-operation). | `jsonrpc/test_sse_streaming.py:243` |
| STREAM-SUB-002 | MUST | jsonrpc, http_json | (c) | Same prerequisite. The kit does close `SubscribeToTask` streams at terminal states (`a2a_ref.py:367-375`), which STREAM-SUB-003 confirmed from the other side (PASS). | `test_task_lifecycle.py:380` |
| PUSH-CREATE-002, PUSH-GET-001, PUSH-LIST-001, PUSH-DEL-001, PUSH-DEL-002 | MUST | jsonrpc | (b) | Each skips when the create call fails; it fails on `task_id` (3.2, PUSH-CREATE-001 jsonrpc). Their HTTP+JSON sides are PASS with the fixed kit (create, get, list, delete, delete-again). | `test_push_notifications.py:159-160, 196-197, 261-262, 293-294, 340-341`; wire check 7 |
| PUSH-DELIVER-001, PUSH-DELIVER-002, PUSH-DELIVER-003 | MUST | jsonrpc, http_json | (c) | `_setup_push_and_trigger` registers the webhook inline on a `tck-input-required` message, then sends a follow-up to "trigger" delivery. Test-runner completed the task on the first message, so the follow-up got `UnsupportedOperationError` (the behavior CORE-SEND-002 requires and that passed) and the test skipped before reading its receiver. The deliveries had already happened: push check 6 shows eight POSTs with `Authorization: Bearer <credentials>`, `Content-Type: application/a2a+json`, and `StreamResponse` bodies, which is what the three tests check (`spec:844-860`). | `test_push_notifications.py:370-408` (skip at 406), `:416-516`; `a2a_ref.py:379-391`; `push-check.txt` |

### 3.4 Run 2: requirements whose verdict is SKIPPED

| Requirement | Level | Transport | Class | Reason | Evidence |
|---|---|---|---|---|---|
| CARD-EXT-001, CARD-EXT-002 | MUST | jsonrpc, http_json | (e) | Tagged `agent-card`; the generic runner skips when the card does not declare `extendedAgentCard`. test-runner does not; the deployer does but needs a token, and the TCK has no way to send one. | `test_requirements.py:29-60` |
| CARD-EXT-001, CARD-EXT-002 | MUST | grpc | (d) | No gRPC interface. | `conftest.py:85-140` |
| CORE-CAP-001 | MUST | jsonrpc, http_json | (e) | Negative test ("push config when unsupported") cannot run because the card declares `pushNotifications`. | `test_error_handling.py:212-253` (skips at 223, 245) |
| CORE-CAP-002 | MUST | jsonrpc | (e) | Same, for streaming. (CORE-CAP-003, extended card not supported, ran and passed.) | `test_error_handling.py:262-288` (273) |
| CORE-CAP-004 | MUST | jsonrpc, http_json | (e) | The card declares no extension with `required: true`, so `ExtensionSupportRequiredError` cannot be provoked. | `test_error_handling.py:294-354` (318, 342) |
| GRPC-SVC-001, GRPC-SVC-002, GRPC-META-001, GRPC-ERR-001, GRPC-ERR-002, GRPC-ERR-003 | MUST | grpc | (d) | No gRPC interface; the kit is standard-library only and the card declares none. | `conftest.py:85-140`; `agents.py:11-15` |
| every other requirement with a `grpc` column (60 requirements in all carry `grpc=SKIPPED`) | | grpc | (d) | Same. | `summary-run2-jsonrpc-url-patch.txt` |

### 3.5 NOT TESTED at the tag

25 requirements have no test in `tests/compatibility` and are class (e), "no test exists": AUTH-INTASK-001 to 006, AUTH-SCOPE-001 to 003, AUTH-SERVER-001/002, AUTH-TLS-001/002 (13); BIND-EQUIV-001 to 004 (4); CARD-SIGN-001 to 004 (4); GRPC-SVC-003; VER-CLIENT-001/002, VER-SERVER-001 (3). Two of these matter for the kit: BIND-EQUIV-* is where the kit defect of section 4 would have been caught directly, and CARD-SIGN-* is where the deployer's HS256 signature would have been checked.

### 3.6 Pytest skips in run 2, by cause (125)

68 gRPC transport not configured (d); 25 `tck-input-required` prerequisite (c); 5 push CRUD tests on JSON-RPC after the `task_id` create failure (b); 6 push delivery follow-ups (c); 6 `agent-card` capability rows for CARD-EXT (e); 12 negative tests the card makes impossible, including `test_content_type_not_supported_returns_415`, which skipped because the kit accepted a valid JSON body sent as `text/plain` (e); 3 "No requirements at this level" placeholder parameters of the generic runner (e). Before the kit fix there were 130: the five HTTP+JSON push CRUD skips after the `404 Method not found` create failure are gone. Run 1 had 149: the extra ones were all slash-caused (25 prerequisite skips, 5 artifact, 3 push, 3 error-info, 2 SSE, 1 ordering, 1 transport-behavior) plus the five HTTP+JSON push skips, minus the 13 JSON-RPC prerequisite skips that run 2 reaches.

### 3.7 Passes to read with care

`PUSH-GET-002` (jsonrpc) passed because the `task_id` parameter made the kit answer TaskNotFound for every config, not because it checked the config id. `CORE-MULTI-006` passed on the terminal-state check, not the contextId mismatch, because the TCK uses a completed task (`sdk-splits.md` B10). `VER-SERVER-003` passed because the TCK accepts a result or an error for an empty `A2A-Version`; the kit returns `VersionNotSupportedError` (`a2a_ref.py:524-527`), which is a defensible reading of 3.6.2 but not the "treat as 0.3" one. `CORE-LIST-001` to `005` passed with the kit ignoring the snake_case `context_id`, `page_size` and `include_artifacts` the TCK sent, so only the response schema was checked.

### 3.8 Totals by class

Counting rows as requirement by transport over both runs (run 1's 32 slash rows plus run 2's 143 non-passing rows, NOT TESTED counted once each): (a) 0, (b) 44, (c) 35, (d) 60, (e) 36; 175 rows. Before the kit fix the same count was (a) 6 and 181 rows. By requirement, nothing fails on the kit's account at MUST level; two SHOULDs (`CARD-CACHE-001/002`) remain.

## 4. Kit defects

None remaining at MUST level.

One was found in the pre-fix run 2 and is recorded here because run 1 still shows it. **The HTTP+JSON binding did not serve the four push-notification-config operations.** The pre-fix `Handler.rest()` routed `message:send`, `message:stream`, `tasks`, `tasks/{id}`, `tasks/{id}:subscribe`, `tasks/{id}:cancel` and `extendedAgentCard`, and nothing under `tasks/{id}/pushNotificationConfigs`; the README said so. The card declares both `JSONRPC` and `HTTP+JSON` with `capabilities.pushNotifications: true`, and 5.1 says "When an agent supports multiple protocols, all supported protocols MUST: Identical Functionality: Provide the same set of operations and capabilities" (`spec:1145-1149`); 5.3 and 11.3.3 give the REST forms (`spec:1163-1166`, `spec:2797-2800`). Observed as `PUSH-CREATE-001` http_json FAIL (`[404] Method not found`) and five dependent skips.

Fixed in the kit on 2026-10-06: `a2a_ref.py` gained `rest_push()` (`:626-648`) with `POST /tasks/{id}/pushNotificationConfigs` (body is the config; `find` then `add_push`), `GET /tasks/{id}/pushNotificationConfigs/{configId}`, `GET /tasks/{id}/pushNotificationConfigs` (`prune({"configs": ...})`) and `DELETE /tasks/{id}/pushNotificationConfigs/{configId}`, behind the `pushNotifications` capability guard (`:630-631`) and answering `application/a2a+json`; `rest()` dispatches to it at `:681-682`; the README sentence was removed. Verified by the repeat of run 2 (PUSH-CREATE-001, PUSH-CREATE-002, PUSH-GET-001, PUSH-LIST-001, PUSH-DEL-001 and PUSH-DEL-002 PASS on http_json; pytest 119 passed, up from 113) and by hand check 7 (create, get, list, missing id 404, delete, get-after-delete 404, delete-again 200, unknown task 404).

Not defects under the (a) definition, but worth a line in the manual: the card response carries no `Cache-Control` or `ETag` (`spec:2219-2220`, SHOULD; the kit's README documents it), and `GetTask` and `ListTasks` do not accept snake_case parameter names, which is correct under 5.5 but means a client that sends them gets the defaults silently rather than an `InvalidParamsError`.

## 5. Where the TCK departs from v1.0.1, in order of effect here

1. JSON-RPC requests go to `<url>/`, not the card's `url` (`jsonrpc_client.py:104-105, 138-141`; httpx `_merge_url`). Costs 63 of 85 JSON-RPC records in run 1; `main` only follows redirects.
2. The JSON-RPC client sends snake_case parameters (`task_id`, `history_length`, `context_id`, `page_size`, `include_artifacts`) against 5.5's MUST camelCase (`spec:1204`); the REST client sends camelCase. With the fixed kit this is the only reason PUSH-CREATE-001 and the five push requirements behind it fail, and it would have neutralised CORE-HIST-002 and the CORE-LIST filters. Unchanged on `main`.
3. Success and error Content-Type must contain `application/json` (`binding_http_json.py:58-70, 98-110`; checks at `test_transport_behavior.py:260`, `test_error_handling.py:621`, `test_problem_details.py:101`) against 11.1's `application/a2a+json` SHOULD (`spec:2750`). Fails HTTP_JSON-SVC-001 and HTTP_JSON-ERR-001 for a server that follows the specification. Unchanged on `main`.
4. CORE-SEND-003 carries no `expected_error`, so the required `ContentTypeNotSupportedError` is counted as a failure (`core_operations.py:95-122`).
5. The wrong-Content-Type test sends a Python `repr` and expects `-32005` where 9.5 says `-32700` (`test_error_codes.py:219-223`); fixed on `main` (`37d4944`), after which the kit's accepting answer makes the test skip.
6. SHOULD and MAY card-caching tests hard-fail instead of `xfail`/skip (`test_agent_card_caching.py:98, 121, 154, 187`), against the TCK's own `README.md:66-74`.
7. A `pytest.skip()` in a test body is recorded as FAIL (`conftest.py:251-297`); fixed on `main` (`conftest.py:310-318`). Turns 21 skipped requirements into failures in run 2.
8. Latent here, from `tck/requirements/base.py:269-331`: `TaskNotCancelableError` 409 (spec 400, `spec:1183`), `ContentTypeNotSupportedError` 415 (spec 400, `spec:1186`), `InvalidAgentResponseError` 502 (spec 500), and `UNIMPLEMENTED` for three errors the spec maps to `FAILED_PRECONDITION`. The kit uses the spec's codes (`a2a_ref.py:20-33`); the only test that touches these accepted 404 for a nonexistent task (`test_http_status.py:78-104`), and the 415 test skipped.
