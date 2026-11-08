---
id: mcp-tasks-elicitation-apps
title: MCP Tasks, Elicitation and Apps
code: MT
subtitle: Explicit scope, MRTR elicitation, durable Tasks, Apps UI resources and safe cancellation on MCP 2026-07-28.
hue: 280
sources: phases/13-tools-and-protocols/12-mcp-roots-and-elicitation, phases/13-tools-and-protocols/13-mcp-async-tasks, phases/13-tools-and-protocols/14-mcp-apps, phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control
source_hash: 79e5ebd870162891
---

## MRTR elicitation round trip
type: flow
from: phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/docs/en.md, phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/code/main.py

1. **Client**: sends `tools/call` id 1 with `elicitation: {"form": {}}` in `_meta` capabilities.
2. **Server**: returns `resultType: "input_required"` with `inputRequests.delete_choice`.
3. **Server**: signs `requestState` with principal, method, `argumentsDigest`, `candidateIds`, nonce, expiry.
4. **Host**: renders the form. The user picks accept, decline or cancel.
5. **Client**: retries `tools/call` with a fresh id 2, `inputResponses` and the same `requestState`.
6. **Server**: verifies the state, re-authorizes the workspace and re-checks containment.
7. **Server**: claims the nonce once, deletes, returns `resultType: "complete"`.

## Task lifecycle on a stateless core
type: architecture
from: phases/13-tools-and-protocols/13-mcp-async-tasks/docs/en.md, phases/13-tools-and-protocols/13-mcp-async-tasks/code/main.py

```arch
node | client | 1,1 | Client | declares tasks extension | client
node | call | 2,1 | tools/call | resultType task | process
node | store | 3,1 | Durable store | persist before return | store
node | worker | 4,1 | Worker | advance_worker | process
node | working | 1,2 | working | statusMessage |
node | input | 2,2 | input_required | inputRequests |
node | done | 3,2 | completed | nested result |
node | stop | 4,2 | cancelled or failed | error on failed |
edge | client | call | _meta
edge | call | store | taskId
edge | store | worker | lease
edge | working | input | worker
edge | input | working | tasks/update
edge | working | done | worker
edge | working | stop | tasks/cancel
```

## Task methods and signals
type: command-table
from: phases/13-tools-and-protocols/13-mcp-async-tasks/docs/en.md, phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/docs/en.md

| Command | What it does |
|---|---|
| `tasks/get` | Full snapshot. Outer `resultType` is always complete |
| `tasks/update` | Sends `inputResponses`. Returns an empty ack |
| `tasks/cancel` | Records cancel intent. The ack is not a final status |
| `subscriptions/listen` | POST with a response SSE stream of task snapshots |
| `notifications/tasks` | Full snapshot tagged with the listen request id |
| `notifications/cancelled` | Request cancel on stdio only. Never for a Task |
| Close the response stream | Request cancel on Streamable HTTP |
| `tasks/status`, `tasks/result`, `tasks/list` | Removed. Method not found |

## Drive a durable task
type: annotated-code
lang: python
from: phases/13-tools-and-protocols/13-mcp-async-tasks/code/main.py

```python
service = TaskService(directory)                # file-backed TaskStore
created = service.dispatch(make_request(1, "tools/call",
    {"name": "generate_report", "arguments": {"size": "large"}}))
task_id = created["result"]["taskId"]           # resultType task, working
service = TaskService(directory)                # new instance reloads it
service.advance_worker(task_id)                 # working to input_required
service.dispatch(make_request(3, "tasks/get", {"taskId": task_id}))
service.dispatch(make_request(4, "tasks/update", {"taskId": task_id,
    "inputResponses": {"approve_outline": {"action": "accept",
                                           "content": {"approved": True}}}}))
service.advance_worker(task_id)                 # stage 2 to completed
body, headers = make_http_request(5, "tasks/get", {"taskId": task_id})
headers["Mcp-Name"]                             # equals params.taskId
```

## Idempotency, buffers and reconnect
type: annotated-code
lang: python
from: phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/code/main.py

```python
ledger = MutationLedger(Path(directory) / "mutations.sqlite3")
ledger.charge("acct-7", 1200, rpc_id=41, idempotency_key="checkout-7")
ledger.charge("acct-7", 1200, rpc_id=42, idempotency_key="checkout-7")
ledger.executions                               # one execution, same receipt
classify_retry(side_effect=True, idempotency_key=None)  # unsafe
buffer = BoundedSseBuffer(3)                    # capacity at least two
buffer.push_final(response)                     # final response never dropped
reconnect_plan(previous_subscription_id, affected_resources,
               unsafe_mutation_was_in_flight=True)  # sendLastEventId False
retry_delay_ms("<client>", attempt)             # capped at 8000 ms
```

## Elicitation answers
type: comparison
from: phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/docs/en.md, phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/code/main.py

| Factor | accept | decline | cancel |
|---|---|---|---|
| Meaning | User submitted | User refused | User dismissed |
| Server action | Validate content, continue | Complete refusal result | Stop safely |
| Nonce | Consumed with the delete | Consumed, no delete | Not consumed |
| Retry later | No | No | Yes, until expiry |
| Result | `deleted: True` | `deleted: False` | `deleted: False` |

## Numbers and defaults
type: defaults
from: phases/13-tools-and-protocols/13-mcp-async-tasks/code/main.py, phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/code/main.py, phases/13-tools-and-protocols/14-mcp-apps/code/main.py, phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/code/main.py

| Setting | Default | Note |
|---|---|---|
| Protocol version | 2026-07-28 | In `_meta` on every request |
| Task `ttl_ms` | 900_000 | Measured from creation |
| Task `poll_interval_ms` | 1_000 | Minimum suggested poll delay |
| `server/discover` `ttlMs` | 300_000 | `cacheScope` public |
| `tools/list` `ttlMs` | 60_000 | Sorted by tool name |
| `requestState` expiry | 300 | Seconds after the form |
| `ReplayStore` `max_entries` | 1_000 | Full store gives -32023 |
| Backoff cap | 8_000 | 250 ms times 2 per attempt |

## Errors and failures
type: troubleshooting
from: phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/docs/en.md, phases/13-tools-and-protocols/13-mcp-async-tasks/docs/en.md, phases/13-tools-and-protocols/14-mcp-apps/docs/en.md, phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| `-32602` | Missing or non-string protocol version | Send the version in `_meta` |
| `-32022` | Unsupported version string | Read `supported` and `requested` data |
| `-32021` | Missing form or tasks or ui capability | Declare it in this request |
| `-32020` | Header and body disagree | Match `Mcp-Method` and `Mcp-Name` |
| Task id gives not found | Handle sent before the store could read it | Persist before return |
| Mutation runs twice | New JSON-RPC id used as dedupe | Add a durable idempotency key |
| Hung work never ends | Progress resets every deadline | Keep an absolute maximum timeout |
| UI says stopped, worker runs | Cancel ack read as final | Poll the Task to a terminal status |

## Apps rules
type: concepts
from: phases/13-tools-and-protocols/14-mcp-apps/docs/en.md, phases/13-tools-and-protocols/14-mcp-apps/code/main.py

- **Extension**: `io.modelcontextprotocol/ui`, declared by both peers on each request.
- **Binding**: `_meta.ui.resourceUri` on the tool in `tools/list`, before any call.
- **Resource**: `ui://notes/timeline.html` with MIME `text/html;profile=mcp-app`.
- **CSP**: empty `connectDomains`, `resourceDomains`, `frameDomains`, `baseUriDomains` by default.
- **Bridge**: View sends `ui/initialize`, then `ui/notifications/initialized` after the host answers.
- **Fallback**: no ui capability gives the tool without `_meta.ui` and a text result.
- **Cache key**: `ui://` URI, server identity and version, content digest, principal if private.

## Scope rules
type: tips
from: phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/docs/en.md

- Roots are deprecated. Put scope in a `workspaceUri` argument or a resource URI.
- Enforce three layers: authorization, containment and an OS sandbox.
- Normalize the URI first. Then compare path components, not string prefixes.
- Never use form mode for passwords, API keys, tokens or payment data.
- URL mode `accept` means the user agreed to open the URL. It is not proof of completion.
- An empty `"elicitation": {}` means form support. URL-only does not.

## Questions
type: qa
from: phases/13-tools-and-protocols/13-mcp-async-tasks/docs/en.md, phases/13-tools-and-protocols/14-mcp-apps/docs/en.md, phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/docs/en.md

- **Who decides that a call becomes a Task?** The server. The client only declares the extension.
- **Where is the final task result?** Under `result` in the next `tasks/get` snapshot.
- **Input before or after task creation?** Before: MRTR retry. After: `tasks/update`.
- **Does `ui/initialize` start an MCP session?** No. It is the iframe bridge handshake only.
- **Is an `isError: true` tool result a failed Task?** No. The Task is `completed`.
- **Resume a dropped stream with `Last-Event-ID`?** No. Open a new listen request and refetch.
