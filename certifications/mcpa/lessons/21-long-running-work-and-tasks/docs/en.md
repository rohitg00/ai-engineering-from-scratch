# Long-Running Work and the Tasks Extension

> Blocking a connection until minutes or hours of work finish gives up everything statelessness bought: any replica can no longer answer, and a dropped connection loses the job. The tasks extension trades that blocking call for a durable handle instead.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 20
**Time:** ~45 minutes

## Learning Objectives

- Explain why blocking a request for long-running work fails: request and transport timeouts, no channel for mid-execution input, and no way to recover after a crash
- Negotiate the `io.modelcontextprotocol/tasks` extension per request: declare it in `clientCapabilities.extensions` and confirm it in `server/discover`
- Read a server-directed `CreateTaskResult` (`resultType: "task"`) and poll `tasks/get`, telling the RPC's own `resultType` apart from the task's nested `status`
- Supply mid-flight input with `tasks/update` and request cooperative cancellation with `tasks/cancel`, and explain why both return only an acknowledgement
- Tell the current extension apart from the removed 2025-11-25 experimental tasks feature, including what replaced `tasks/result` and `tasks/list`
- Choose among a plain call, a Multi Round-Trip Request, a task, and a server-minted handle for a given piece of work

## The Problem

Some tool calls cannot finish inside a single request. A CI pipeline, a batch import, a report that needs a human to approve a step partway through: operations like these take seconds, minutes, or longer, and nothing about that duration is a defect to engineer away. Holding the connection open until the last byte of work finishes runs into three separate failures at once.

The first is timeouts that are not the server's to configure. Clients, proxies, and load balancers between the model and the server each enforce their own limit on how long one request may sit open, and most of those limits were chosen for ordinary lookups, not for a deploy pipeline that runs for twenty minutes. The second is that a blocked request has no channel left for the server to ask the client anything. A tool that discovers midway through that it needs a human's approval has nowhere to put that request: an MRTR round trip answers a question about the same request while it is still open, but it does not turn one open connection into an hours-long conversation. The third is durability. If the client process restarts, or the connection simply drops, a blocked call leaves no trace behind. The client cannot ask whether the work finished, so it either waits forever or resubmits work that may already be running and may already have side effects, such as a real deployment.

The stateless core makes this sharper, not milder. Lesson 04 covered why there is no session to fall back on: nothing about a request is remembered between calls, so a server cannot quietly keep a job attached to one connection and resume it there later. Long-running work needs an explicit answer to the same question statelessness already answers for everything else: what identifies this piece of work across requests, restarts, and replicas, so that any of them can pick it back up.

## The Concept

MCP answers that question with an official extension, `io.modelcontextprotocol/tasks` (SEP-2663). A server that supports it may respond to an eligible request with a durable handle, a task, instead of the final answer, and the client polls, supplies input, and cancels through three methods scoped to that handle.

Negotiation is per request, the same way every other capability in this protocol works. The client declares the extension in `io.modelcontextprotocol/clientCapabilities.extensions` on the request it is making, and the server advertises the same identifier in `capabilities.extensions` from `server/discover`. Declaring the extension on one call does not carry over to the next: there is no session to remember it in, so a client that wants task-aware handling on a later `tasks/get` call must declare the extension again on that call too.

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "run_build_pipeline",
    "arguments": {"project": "web-storefront", "environment": "production"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {"io.modelcontextprotocol/tasks": {}}
      }
    }
  }
}
```

Task creation is server-directed. Declaring the extension only means the client is ready to receive either shape back; the server alone decides, per request, whether this particular call becomes a task. A client that declared the extension must handle a normal `CallToolResult` or a `CreateTaskResult` for the exact same tool, sometimes call to call. Only `tools/call` supports task augmentation in this revision.

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "resultType": "task",
    "taskId": "tsk_786512e29e0d",
    "status": "working",
    "statusMessage": "Installing dependencies and running tests.",
    "createdAt": "2026-09-24T10:30:00Z",
    "lastUpdatedAt": "2026-09-24T10:30:00Z",
    "ttlMs": 900000,
    "pollIntervalMs": 2000
  }
}
```

A server must not send that handle until a `tasks/get` for it would already resolve. In an eventually consistent store, that means waiting for the write to become visible before answering; skipping that step hands the client a `taskId` that immediately reports not found, which is worse than blocking a little longer would have been.

The client polls with `tasks/get`, sending only the `taskId` it was given. Here is the detail the exam likes to test: `tasks/get` itself is an ordinary request that completes, so its own `resultType` is always `"complete"`. The status of the underlying job, `working`, `input_required`, `completed`, `failed`, or `cancelled`, travels in a separate, nested `status` field in that same result, not in `resultType`. Confusing the two looks harmless until a client stops polling the moment it sees `resultType: "complete"`, which is true on every single poll regardless of whether the job is still running.

There is no `tasks/result`. When a task reaches `completed`, the very next `tasks/get` response carries the original result inline under `result`, shaped exactly like what the request would have returned synchronously. When a task reaches `failed`, that same response carries the JSON-RPC error under `error`. A tool call that finishes with `isError: true` is still `completed`, because the call itself succeeded at the protocol level; `failed` is reserved for a JSON-RPC error during execution, never for an ordinary tool-level failure.

There is also no `tasks/list`. The 2025-11-25 experimental version had one, but a session-free server has no safe scope to list tasks within: without a session or a connection to bind a list to, a naive listing would either leak every caller's tasks to every other caller or require inventing an authorization model the base protocol does not define. A product that needs task history exposes its own authorized, filtered tool instead; the general-purpose listing call was removed rather than shipped insecure by default.

A task can pause mid-execution for input it did not need at creation time. Its status becomes `input_required`, and the same `tasks/get` response gains an `inputRequests` map, each entry shaped like one MRTR request: `elicitation/create`, `sampling/createMessage`, or `roots/list`. The client answers with `tasks/update`, sending `inputResponses` keyed the same way, and gets back only an empty acknowledgement; the updated status shows up on the next poll rather than in that response. This is a different continuation from core MRTR even though the shapes rhyme: MRTR retries the original request with a new id, while `tasks/update` is its own method aimed at the `taskId`, and the client never resends the original `tools/call`. Each `inputRequests` key stays unique for the life of the task, so a server ignores a response for a key it never issued or already satisfied, and a client deduplicates a key it has already shown the user across repeated polls.

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tasks/update",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "inputResponses": {
      "approve_deploy": {"action": "accept", "content": {"approved": true}}
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {"io.modelcontextprotocol/tasks": {}}
      }
    }
  }
}
```

Cancellation works the same way: `tasks/cancel` sends only the `taskId` and gets back an empty acknowledgement. It is cooperative, not a guarantee; the server records the intent and may still finish the work, since stopping it partway through might not be safe or possible. Do not reach for `notifications/cancelled` here. That notification tears down one still-open request on its own transport stream, and a task's originating request already returned the moment it became `resultType: "task"`, so there is no open request left to cancel that way. `tasks/cancel` is the only path to a durable job once one exists.

A task method called by a client that never declared the extension on that particular request gets `-32021`, Missing Required Client Capability, naming the extension in `data.requiredCapabilities`. An unknown or expired `taskId` gets `-32602`, the same code lesson 18 already introduced for a malformed request, because `tasks/get`, `tasks/update`, and `tasks/cancel` are ordinary JSON-RPC requests subject to the same rules as everything else in this protocol, per-request metadata included.

Choosing among the four patterns comes down to what actually needs to survive past the current request. A plain call is enough when the work is quick and deterministic. An MRTR round trip (lesson 14) is enough when the server just needs one short answer before it can finish the request it is already answering. A task earns its added complexity when the work might outlive a timeout, might pause for input partway through, or needs to survive a client restart or a deliberate cancellation. A server-minted handle (lesson 04's pattern) solves a different problem entirely: it carries cross-call application state, such as a cart or an open session, forward as an ordinary tool argument. A `taskId` happens to be one instance of that same idea, purpose-built for polling a single unit of deferred work rather than for holding state open indefinitely.

```figure
mcpa-21-task-states
```

## Interactive Lab

The figure lays out every status a task can reach and which call drives each move. Follow `working` up to `input_required` and notice that edge is labeled by what the server decided, not by a request the client sent; then follow the return edge back down, labeled by the one request the client actually sends, `tasks/update`. On the right, three terminal states fan out from `working`: completing because the work finished, cancelling because the client asked, or failing because a protocol error interrupted execution. All three are drawn with a dashed border to mark them terminal: once a task reaches one, `tasks/get` keeps returning that same snapshot.

## Practice Lab

Open `code/main.py`. `run_build_pipeline` is a single tool with the same input schema and the same job either way: install, test, and, once approved, deploy a project to an environment. What differs is only whether the caller declared `io.modelcontextprotocol/tasks`.

```bash
python3 code/main.py
```

Read the printed exchanges against the concept section above. A call without the extension finishes synchronously and reports that the deploy step needs the extension for approval; a call with the extension gets back `resultType: "task"` immediately. The lab advances the task explicitly between polls, the way a real worker would move forward between separate requests, rather than sleeping in a background thread, so every state transition in the transcript is deterministic and repeatable. Follow one `taskId` from its first `working` poll through `input_required`, through the `tasks/update` that supplies `{"approved": true}`, to the final `completed` poll, and compare the nested `result` there with what the no-extension call returned directly. Then find the two errors: `tasks/get` against a `taskId` that was never created comes back `-32602`, and that same, valid `taskId` polled by a client that dropped the extension declaration comes back `-32021`.

## Shipped Artifact

`outputs/long-running-work-patterns.md` is a decision reference: when to reach for a plain call, an MRTR round trip, a task, or a server-minted handle; the capability negotiation checklist; the `CreateTaskResult` fields; the polling and status rules, including the `tasks/get` versus nested `status` distinction; and a table of what the 2025-11-25 experimental methods were replaced by. Keep it next to a server's tool descriptions when a tool might not return before its caller's patience, or its transport's timeout, runs out.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: a call without the extension still returns a normal result, a call with it returns a task handle, polling shows the status actually progress from `working` to `input_required`, the `input_required` snapshot surfaces a well-formed `inputRequests` entry, `tasks/update` resumes the task, a `completed` snapshot carries the original result shape inline, `tasks/cancel` moves a working task to `cancelled`, an unknown `taskId` is a protocol error, and the same task method without the declared capability is `-32021` instead. The repository's wire checker also validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/21-long-running-work-and-tasks
```

## Capstone Connection

The capstone's audited tool call may run long enough, or need enough mid-flight approval, to justify becoming a task rather than a plain call. When it does, the same four questions from this lesson apply directly: has the client declared the extension on this request, has the server advertised it, is the handle durable before it is returned, and does every poll distinguish the wrapper's own `resultType` from the job's nested `status`.

## Key Terms

| Term | Meaning |
|------|---------|
| `io.modelcontextprotocol/tasks` | The official extension identifier for durable, server-directed async work |
| `CreateTaskResult` | The `resultType: "task"` response a server may return instead of a normal result |
| `tasks/get` | Polls a full, current snapshot of one task by `taskId` |
| `tasks/update` | Submits `inputResponses` for a task's outstanding `inputRequests` |
| `tasks/cancel` | Signals cooperative cancellation intent for one task |
| `input_required` | The task status meaning the server needs client input before it can continue |
| `pollIntervalMs` | The server's current suggested minimum delay between polls |
| `ttlMs` | The task's expiry duration measured from its creation |
| Durable before return | The rule that a `taskId` must already resolve before it is handed to the client |
| Cooperative cancellation | `tasks/cancel` records intent; the server is not obligated to stop the work |

## Further Reading

- [Tasks, MCP extensions](https://modelcontextprotocol.io/extensions/tasks/overview)
- [SEP-2663: Tasks Extension](https://modelcontextprotocol.io/seps/2663-tasks-extension)
- [SEP-1686: Tasks (2025-11-25 experimental, historical record)](https://modelcontextprotocol.io/seps/1686-tasks)
- [Stateful Tools, MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools#stateful-tools)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 4 and 14
- `phases/13-tools-and-protocols/13-mcp-async-tasks`, which builds a task-backed worker with restart recovery and a shared durable store
