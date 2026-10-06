# A2A 101 capture kit

Every request, response, and stream frame in A2A 101 comes from this kit. It runs three remote agents and a recording client on your machine, with the Python standard library only. It needs no network and no keys.

```bash
python3 run.py          # writes out/
python3 run.py --check  # captures again into a temporary folder and compares
```

The output is deterministic. Ids come from seeded generators, timestamps from a clock that starts at 2026-10-06T09:00:00Z and moves 250 ms each time it stamps a new task or a status, and every scenario runs its steps in a fixed order. Two runs write byte-identical files, so `--check` is a plain comparison with nothing masked.

## The agents

| Agent | Port | What it does | What it demonstrates |
|---|---|---|---|
| `test-runner` | 41241 | runs a test suite and streams the log | streaming, artifacts in chunks, polling, cancel, push notifications, both JSON bindings |
| `code-reviewer` | 41242 | reviews a diff against a base branch | direct message replies, `TASK_STATE_INPUT_REQUIRED`, rejected content types, no push support |
| `deployer` | 41243 | deploys a build to staging after an operator approves | bearer authentication, `TASK_STATE_AUTH_REQUIRED` with out-of-band approval, rejection, extended and signed cards |

`planner.py` is the client agent of section 7.2. It reads the three cards, picks an agent for each skill, and handles every state a task reaches.

## The scenarios

| File | Shows |
|---|---|
| `01-agent-cards.http` | the three cards from `/.well-known/agent-card.json` |
| `02-message-reply.http` | a question answered with a message and no task |
| `03-blocking-task.http` | a `SendMessage` that waits until the task completes |
| `04-polling.http` | `returnImmediately`, then `GetTask` while working and after completion |
| `05-streaming.http` | every frame of `SendStreamingMessage`, with the log in chunks |
| `06-input-required.http` | the reviewer asks for a base branch and the client answers on the same task |
| `07-auth-required.http` | a deploy waits for an operator while its stream stays open |
| `08-rejected.http` | a production deploy the agent refuses |
| `09-failed.http` | a commit that does not exist |
| `10-cancel.http` | cancel a running task, cancel it again, and message it after it ended |
| `11-errors.http` | task not found, a missing version header, a v0.3 method name, invalid parameters, an unsupported media type, push not supported, a malformed body |
| `12-list-tasks.http` | `ListTasks` pages and a status filter |
| `13-history.http` | `GetTask` with and without `historyLength` |
| `14-resubscribe.http` | a stream dropped after four frames and picked up with `SubscribeToTask` |
| `15-push.http` | a webhook registered in `SendMessage`, the notifications it receives, and the config operations |
| `16-rest-binding.http` | the same operations over HTTP+JSON, including its error shape |
| `17-signed-card.txt` | canonicalizing, signing, and verifying the deployer card |
| `18-extended-card.http` | `GetExtendedAgentCard` without and with a token |
| `19-planner.http` and `19-planner.log` | the planner's run and its decisions |

Files named `*.events.json` hold the frames of a stream, pretty-printed.

## How this kit differs from the reference SDK

The records were compared with traffic from `a2a-sdk` 1.2.2, the Python reference implementation. The structures, field names, field order inside objects, enum values, error codes, and history bookkeeping match. These choices differ or fill a gap the specification leaves open:

- The kit writes JSON-RPC envelopes as `jsonrpc`, `id`, `result`. The SDK writes `result`, `id`, `jsonrpc`. JSON objects have no order, so both are the same message.
- The kit stamps the first `TASK_STATE_SUBMITTED` status with a time. The SDK leaves it out. The field is optional.
- Streams close when a task reaches a terminal state or `TASK_STATE_INPUT_REQUIRED`, and stay open through `TASK_STATE_AUTH_REQUIRED`, as the in-task authorization section asks. The specification disagrees with itself about interrupted states. The SDK's default request handler closes a stream when the agent's `execute()` call returns, so the agent code decides (`src/a2a/server/agent_execution/active_task.py`).
- HTTP+JSON errors and push notifications are sent as `application/a2a+json`, as the specification says. The SDK sends both as `application/json`.
- The push `token` travels in an `X-A2A-Notification-Token` header. The specification gives the token no transport. The header is the SDK's (`src/a2a/server/tasks/base_push_notification_sender.py`).
- A push configuration created without an `id` gets a new UUID. The SDK uses the task id. The specification only says the server assigns one.
- `DeleteTaskPushNotificationConfig` over JSON-RPC returns `{}`, the JSON form of an empty protobuf message. The SDK returns `null`.
- Error details carry metadata such as the task id, as the specification's examples do. The SDK sends an empty `metadata` object.
- Idle streams get no keep-alive comments. The SDK's server sends one every 15 seconds.
- The input check reads only the card's `defaultInputModes`. It treats a `text` part without a `mediaType` as `text/plain` and a `data` part as `application/json`. The SDK's check is off by default. When it is on, the SDK also accepts each skill's `inputModes` and skips parts without a `mediaType`.
- An `artifactUpdate` with `append` for an unknown `artifactId` starts a new artifact. The SDK rejects it with `InvalidAgentResponseError`.
- When a client answers an interrupted task, the kit's server sets `TASK_STATE_WORKING` itself, with no message, before the agent code resumes.
- The HTTP+JSON binding serves the message, task, and card operations. The four push configuration operations run over JSON-RPC only.
- Webhooks receive status and artifact updates, never the first Task snapshot. The SDK pushes that Task too.
- The version check accepts exactly `1.0`, from the `A2A-Version` header or an `A2A-Version` query parameter, as §3.6.1 allows. The SDK compares only the major version and reads only the header.
- Authentication runs in front of the protocol. A missing or wrong bearer token gets HTTP 401 with a `WWW-Authenticate` challenge before any A2A method runs, for both bindings.
- The deployer signs its card with HS256, because the standard library has no ECDSA. Real deployments sign with ES256 or RS256 and publish the key in a JWKS.
- The canonical form sorts keys and drops spaces. That matches RFC 8785 for the plain ASCII text of these cards, and for the deployer card it equals the SDK's canonical bytes.
- The card response carries no `Cache-Control` or `ETag` header. The SDK sends a weak `ETag` and answers a matching request with `304`.
- A client message with any role other than `ROLE_USER` gets `-32602`. The specification names no error for that case.
- `POST /approve/<task id>` on the deployer stands for an operator approving a deploy out of band. It is not part of A2A.
