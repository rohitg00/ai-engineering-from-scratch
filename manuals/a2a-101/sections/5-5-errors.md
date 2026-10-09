# Errors

> Nine A2A errors map into three bindings, and because their status codes collide, the `ErrorInfo` reason in the details is what tells them apart.

The planner asks `test-runner` for a task id that does not exist, once over each JSON binding. JSON-RPC answers `HTTP/1.1 200 OK` with code `-32001`, and HTTP+JSON answers `HTTP/1.1 404 Not Found`. Both carry the same `ErrorInfo`, with the reason `TASK_NOT_FOUND`, as [figure](#fig-task-not-found) shows.

When you finish this section, you can read an error in any binding, name the A2A error behind it, and choose what to do next.

```figure
id: fig-task-not-found
kind: comparison
title: TaskNotFoundError in two JSON bindings
claim: The same TaskNotFoundError arrives as HTTP 200 with code -32001 in JSON-RPC and as HTTP 404 in HTTP+JSON, carrying the same ErrorInfo.
caption: Left, GetTask over JSON-RPC from capture/out/11-errors.http. Right, the same lookup over HTTP+JSON from capture/out/16-rest-binding.http. The box at the bottom is the detail both replies carry. Ids shortened to 8 characters.
```

## The detail that names the error

The specification defines nine A2A errors and maps each one into every binding {{spec §3.3.2}} {{spec §5.4}}. JSON-RPC numbers them `-32001` to `-32009` {{spec §9.5}}, HTTP answers `400` for seven, and gRPC answers `FAILED_PRECONDITION` for six, as [the error table](#s-ref-errors) lists.

Every error carries a code, a message, and optional `details`, each detail naming its type in `@type` {{spec §3.3.2}}. For A2A errors the deciding detail is a `google.rpc.ErrorInfo`:

```rule
label: the detail that names the error
source: spec §11.6
---
"implementations **MUST** include a `google.rpc.ErrorInfo` object in the `details` array for A2A-specific errors"
```

Its `reason` is the error's name in upper snake case without the `Error` suffix, such as `TASK_NOT_FOUND`, and its `domain` is `a2a-protocol.org` {{spec §11.6}}. The gRPC binding carries the same MUST {{spec §10.6}}, and JSON-RPC only a SHOULD {{spec §9.5}}. The `metadata` is free-form: the kit fills it, and the reference SDK leaves it empty, as the kit README lists.

## JSON-RPC errors arrive with HTTP 200

A JSON-RPC error is an ordinary response with HTTP `200`. Its `error` member holds `code`, `message`, and `data` where `result` would be {{spec §9.5}}. The five standard JSON-RPC codes, `-32700` and `-32600` to `-32603`, keep their meaning {{spec §9.5}}.

Validation errors carry a different detail type, a `google.rpc.BadRequest` that names the field:

```listing
title: a message without messageId, refused with a BadRequest detail
source: capture/out/11-errors.http
lang: http
note: The request is cut to the start of its message, which has no messageId.
---
    "message": {
      "role": "ROLE_USER",
…
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 4,
  "error": {
    "code": -32602,
    "message": "Invalid parameters",
    "data": [
      {
        "@type": "type.googleapis.com/google.rpc.BadRequest",
        "fieldViolations": [
          {
            "field": "message.messageId",
            "description": "messageId is required"
```

Do not match on message texts: the reference SDK answers the same case with "Validation failed" and names the field `message.message_id` {{sdk src/a2a/utils/proto_utils.py}}.

Authentication can fail before JSON-RPC runs, with HTTP `401` as the specification's example {{spec §3.3.2}}, so read the status first, as [Security schemes](#s-security-schemes-and-in-task-authorization) shows.

## HTTP+JSON errors are google.rpc.Status

An HTTP+JSON error uses the HTTP status and a JSON `google.rpc.Status` {{spec §11.6}}. Its `error` object repeats the status in `code`, names the gRPC status in `status`, and adds `message` and `details`:

```listing
title: a cancel of a completed task over HTTP+JSON
source: capture/out/16-rest-binding.http
lang: http
note: The request headers and body are cut. Over JSON-RPC this error is code -32002, as in 10-cancel.http.
---
POST /a2a/rest/tasks/bbfb9ea5-50ea-4441-b991-2a8ba0d6f3f3:cancel HTTP/1.1
…
HTTP/1.1 400 Bad Request
Content-Type: application/a2a+json

{
  "error": {
    "code": 400,
    "status": "FAILED_PRECONDITION",
    "message": "Task cannot be canceled",
    "details": [
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        "reason": "TASK_NOT_CANCELABLE",
        "domain": "a2a-protocol.org",
        "metadata": {
          "taskId": "bbfb9ea5-50ea-4441-b991-2a8ba0d6f3f3",
          "state": "TASK_STATE_COMPLETED"
```

Two samples in the specification still show `application/problem+json` bodies in the older RFC 9457 style {{spec §6.4}} {{spec §6.5}} ([conflict D13](#s-ref-sources)). [PR #1641](https://github.com/a2aproject/A2A/pull/1641) and [PR #1689](https://github.com/a2aproject/A2A/pull/1689) replace those samples, and both are still open. The migration guide gives the type as `application/json` {{docs whats-new-v1}}, where §11.6 shows `application/a2a+json`. The SDKs send all three, and all answer JSON-RPC errors with HTTP `200`:

| SDK | JSON-RPC errors | HTTP+JSON errors |
|---|---|---|
| a2a-python 1.2.2 | `application/json` {{sdk src/a2a/server/routes/jsonrpc_dispatcher.py}} | `application/json` {{sdk src/a2a/utils/error_handlers.py}} |
| a2a-go | `application/json` {{sdk-go a2asrv/jsonrpc.go at v2.6.0}} | `application/json` {{sdk-go a2asrv/rest.go at v2.6.0}} |
| a2a-java | `application/json` {{sdk-java reference/jsonrpc/src/main/java/org/a2aproject/sdk/server/apps/quarkus/A2AServerRoutes.java at v1.4.0.Final}} | `application/json` {{sdk-java transport/rest/src/main/java/org/a2aproject/sdk/transport/rest/handler/RestHandler.java at v1.4.0.Final}} |
| a2a-js | `application/json` {{sdk-js src/server/express/json_rpc_handler.ts at v1.3.0}} | `application/a2a+json` {{sdk-js src/server/express/rest_handler.ts at v1.3.0}} |
| a2a-dotnet | `application/json` {{sdk-dotnet src/A2A.AspNetCore/JsonRpcResponseResult.cs at v1.0.0-preview2}} | `application/problem+json`, a problem-details body {{sdk-dotnet src/A2A.AspNetCore/A2AHttpProcessor.cs at v1.0.0-preview2}} |
| a2a-rs | `application/json` {{sdk-rust a2a-server/src/jsonrpc.rs at a2a-server-lf-v0.5.1}} | `application/problem+json` {{sdk-rust a2a-server/src/rest.rs at a2a-server-lf-v0.5.1}} |

Send `application/a2a+json`, and accept all three types when you read. Parse the body as `google.rpc.Status` whatever the type says. The exception is a2a-dotnet at this release, whose problem-details body carries no `ErrorInfo`. The gRPC binding puts the same three parts in `status.code`, `status.message`, and `status.details` {{spec §10.6}}.

## What to retry

`UnsupportedOperationError` covers three problems with one code, `-32004`, and one reason, `UNSUPPORTED_OPERATION` {{spec §3.3.4}} {{spec §3.1.1}} {{spec §3.1.6}}. The card lacks `streaming` or the extended card, or the task is terminal, as in `10-cancel.http`. Only `message` and `metadata` tell the cases apart, and the specification fixes neither. So when a task operation gets `-32004`, read the task with `GetTask` before you decide.

Most A2A errors describe the request or the task, so resending the same bytes gets the same answer:

- `-32603`, HTTP `500` or `503`, or a dropped connection: retry with backoff, and honor `Retry-After` {{spec §3.3.2}}.
- HTTP `401`: get a fresh credential, then retry.
- `-32600`, `-32602`, `-32005`, `-32009`, and their `400` forms: fix the request before you send it again.
- `-32001`: stop, because the id is wrong, purged, or hidden from you {{spec §3.3.2}}.
- `-32002`, or `-32004` on a terminal task: start a new task, as [CancelTask and terminal states](#s-cancel-task-and-terminal-states) shows.
- `-32003`, `-32007`, or `-32004` from a capability check: read the card again.

A retried `SendMessage` can start a second task, because duplicate detection by `messageId` is optional {{spec §3.3.1}}. Send the same `messageId` anyway, as [Message](#s-message) explains.

```takeaways
- Read the HTTP status first, then the JSON-RPC `error` member or the `google.rpc.Status` body.
- Decide on the `ErrorInfo` `reason`, never on the status code alone or on the message text.
- Retry only transport and system errors, with backoff.
- Keep the same `messageId` when you retry a send.
```

Sources: spec §3.1.1, §3.1.6, §3.3.1, §3.3.2, §3.3.4, §5.4, §6.4, §6.5, §9.5, §10.6, §11.6 (research/sources/specification.md); docs whats-new-v1 (research/sources/docs.md); a2aproject/A2A PR #1641 and PR #1689, checked 2026-10-06; sdk src/a2a/utils/proto_utils.py, src/a2a/utils/error_handlers.py, src/a2a/server/routes/jsonrpc_dispatcher.py (a2a-python 1.2.2); sdk-go a2asrv/jsonrpc.go, a2asrv/rest.go (a2a-go v2.6.0); sdk-java reference/jsonrpc/src/main/java/org/a2aproject/sdk/server/apps/quarkus/A2AServerRoutes.java, transport/rest/src/main/java/org/a2aproject/sdk/transport/rest/handler/RestHandler.java (a2a-java v1.4.0.Final); sdk-js src/server/express/json_rpc_handler.ts, src/server/express/rest_handler.ts (a2a-js v1.3.0); sdk-dotnet src/A2A.AspNetCore/JsonRpcResponseResult.cs, src/A2A.AspNetCore/A2AHttpProcessor.cs (a2a-dotnet v1.0.0-preview2); sdk-rust a2a-server/src/jsonrpc.rs, a2a-server/src/rest.rs (a2a-rs a2a-server-lf-v0.5.1); capture/out/11-errors.http, 16-rest-binding.http, 10-cancel.http, 14-resubscribe.http; capture/README.md
