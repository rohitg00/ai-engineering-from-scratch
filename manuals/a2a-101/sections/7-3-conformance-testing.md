# Conformance testing

> a2a-tck grades one server against v1.0.0 on three bindings, and a run against the capture kit shows which failures are the server's and which are the TCK's.

On 2026-10-06 the kit's `test-runner` served on port 41251 for two runs of a2a-tck 1.0.0.alpha2. The first run, with the TCK as published, scored 32.3 percent. The second, after a two-line change to the TCK's JSON-RPC client, scored 66.7 percent. When you finish this section, you can run the TCK against your server and tell a real failure from a defect in the test.

## Running a2a-tck

The TCK is a pytest project. It reads `{sut-host}/.well-known/agent-card.json`, builds one client for each `supportedInterfaces` entry, and runs each test on each binding the card declares. It checks the `v1.0.0` branch, not the 1.0.1 patch this manual pins.

```bash
git clone --filter=blob:none https://github.com/a2aproject/a2a-tck.git
cd a2a-tck
git checkout 1.0.0.alpha2
uv venv && source .venv/bin/activate
uv pip install -e .
./run_tck.py --sut-host http://localhost:9999
```

`run_tck.py` builds one pytest command, and `--transport`, `--level`, and `--webhook-host` narrow it. A `MUST` test is a hard failure. A `SHOULD` test is an `xfail`, and a `MAY` test is skipped when the card does not declare the capability. `compatibility.json` holds one verdict per requirement, and the percentages count only PASS and FAIL.

## What the kit's run showed

In the first run, 63 of the 85 JSON-RPC records failed for one reason. The TCK's JSON-RPC client posts to the card's `url` plus a trailing slash, and the kit answers HTTP 404 for that path. The second run posted to the exact `url` and reached 62 PASS, 31 FAIL, 11 SKIPPED, and 25 NOT TESTED of 129 requirements. All 72 gRPC records were skipped, because the kit has no gRPC interface.

Of the 31 failures, 21 are skips inside a test body, which the tag records as FAIL and `main` records as SKIPPED. Most expect a task parked in `TASK_STATE_INPUT_REQUIRED`, which `test-runner` never does. With the `main` rule the run reads 62 PASS, 10 FAIL, and 32 SKIPPED, or 86.1 percent.

One of the ten is the kit's. `Handler.rest` serves no route under `tasks/{id}/pushNotificationConfigs`, while the card declares both JSON bindings with `pushNotifications`, and every declared binding must offer the same operations {{spec §5.1}}. `PUSH-CREATE-001` fails over HTTP+JSON, and five push tests skip behind it. Two `SHOULD` failures are the card's missing `Cache-Control` and `ETag` headers {{spec §8.6}}. The rest are the TCK's own, or its sample inputs. The per-requirement list is `research/v2/tck-run/summary.txt`, and `RESULTS.md` beside it classifies every row.

## Where the TCK departs from v1.0.1

| The TCK expects | The specification says | Effect on the kit |
|---|---|---|
| JSON-RPC requests at `<url>/` | the interface is at `url` {{spec §8.3.1}} | 63 records in run 1 |
| snake_case parameters such as `task_id` and `history_length` on JSON-RPC | JSON field names MUST be camelCase {{spec §5.5}} | `PUSH-CREATE-001` fails on JSON-RPC, `GetTask` ignores `history_length` |
| a `Content-Type` that contains `application/json` on REST | `application/a2a+json` SHOULD be used {{spec §11.1}} | `HTTP_JSON-SVC-001` and `HTTP_JSON-ERR-001` fail |
| any error on `CORE-SEND-003` counts as a failure | an unsupported part gets `ContentTypeNotSupportedError` {{spec §3.3.2}} | fails on both bindings |
| HTTP 409 for `TaskNotCancelableError`, 415 for `ContentTypeNotSupportedError`, 502 for `InvalidAgentResponseError`, and gRPC `UNIMPLEMENTED` for three errors | 400, 400, 500, and `FAILED_PRECONDITION` {{spec §5.4}} | not reached in this run |
| a hard assertion on the `SHOULD` and `MAY` caching tests | `SHOULD` is an `xfail` in the TCK's own README | three card-cache failures |

[Errors](#s-errors) has the full mapping.

## What the TCK does not test

Five behaviors that split the SDKs never run. The REST subscribe verb (B1): the client always sends POST. Pagination (B5): one `ListTasks` call, checked against the schema only. An `append` to an unknown artifact (B11): no test sends an artifact update. Another caller's task (B12): `AUTH-SCOPE-001` to `003` have no test. A resent `messageId` (B14): every test mints a new id.

The 25 NOT TESTED requirements also cover in-task authorization, TLS, card signatures, binding equivalence, and the client's version header. [Security requirements](#s-security-requirements) and [signed cards](#s-extended-cards-and-signatures) give those rules.

## Three more tools

a2a-inspector is a browser debugger. It fetches a card, checks its structure, sends messages, and shows each event. Its only release, `v0.1.0`, predates 1.0 and requires a top-level `url`. Use `main`, which accepts 0.3 and 1.0 payloads and builds its client from the card's first interface. Run `uv sync` and `npm install` in `frontend`, then `bash scripts/run.sh`, and open `http://127.0.0.1:5001`. It decides nothing about conformance.

a2a-cli is the official command-line client, `v0.3.0`, built on a2a-go. `a2a card get <url>` reads a card, and `a2a send -a <url> "text"` sends a message, with `--stream` or `--async`. `a2a task get`, `list`, `cancel`, and `subscribe` cover the rest, and `--svc-param A2A-Version=0.3` sets a header by hand. It is a client, not a grader.

a2a-itk has no release. It is a cross-SDK harness: each agent forwards a nested instruction to the next peer over the scenario's binding. `uv run run_tests.py` runs the bundled set. Its `known_failures.yaml` records the B1 split: the Rust client sends `GET`, and the .NET server accepts `POST` only.

```takeaways
- Read `compatibility.json` per requirement, not the percentage.
- Expect the TCK to post JSON-RPC requests to the card URL plus a trailing slash.
- Treat a content-type or snake_case failure as the TCK's until its tests change.
- Test owner scoping, duplicate messages, and artifact appends yourself.
```

Sources: spec §3.3.2, §5.1, §5.4, §5.5, §8.3.1, §8.6, §11.1 (research/sources/specification.md); the TCK run of 2026-10-06 in research/v2/tck-run (RESULTS.md, summary.txt, summary-run2-jsonrpc-url-patch.txt, reports/, wire-check.txt, push-check.txt); a2a-tck at tag 1.0.0.alpha2 (README.md, run_tck.py, tck/requirements/base.py, tck/transport/jsonrpc_client.py, tests/compatibility/conftest.py) and main 263b9cf; a2a-inspector main 8aa0646 (README.md, backend/validators.py, backend/app.py); a2a-cli v0.3.0 (README.md, internal/README.md, specification/SPEC.md); a2a-itk main b57c533 (README.md, matrix.yaml, known_failures.yaml); capture/a2a_ref.py, capture/agents.py, capture/README.md
