# Push notification configs

> A TaskPushNotificationConfig tells an agent where to POST the same StreamResponse objects a stream carries, with credentials you chose, after your request has returned.

A test run can outlast any connection the planner wants to hold open. So the planner sends `SendMessage` with `returnImmediately: true` and a webhook, gets the task back in `TASK_STATE_SUBMITTED`, and closes the connection. From then on `test-runner` posts eight notifications to `http://localhost:41250/a2a-events`.

When you finish this section, you can register a webhook, authenticate what arrives, and build a receiver that stays correct when a notification comes twice.

## The configuration object

**TaskPushNotificationConfig:** the object that tells an agent where to post updates for one task and how to authenticate them {{proto TaskPushNotificationConfig}}. Only `url` is REQUIRED. The optional `token` is "A token unique for this task or session" {{proto TaskPushNotificationConfig}}, and the optional `authentication` holds a `scheme` such as `Bearer` and its `credentials` {{proto AuthenticationInfo}}. The server assigns the config's `id`. The prose calls this object `PushNotificationConfig`, a type the proto does not define, so use the proto name {{spec §4.3.1}} ([conflict D4](#s-ref-sources)).

```listing
title: a webhook registered inside SendMessage
source: capture/out/15-push.http
lang: http
note: The headers and the message parts are cut. The configuration carries no task id, because the task does not exist yet.
---
POST /a2a/jsonrpc HTTP/1.1
…
  "method": "SendMessage",
  "params": {
    "message": {
      "messageId": "85750621-02fb-4d4f-b57f-bc5af71a1bfc",
…
    "configuration": {
      "returnImmediately": true,
      "taskPushNotificationConfig": {
        "url": "http://localhost:41250/a2a-events",
        "token": "planner-run-0006",
        "authentication": {
          "scheme": "Bearer",
          "credentials": "hook_secret_91d2"
        }
```

Inline, as here, the config rides in `configuration.taskPushNotificationConfig` {{proto SendMessageConfiguration}}. That leaves no gap, because the kit and the reference SDK store it before the first event {{sdk src/a2a/server/request_handlers/default_request_handler_v2.py}}. For a task that already exists, `CreateTaskPushNotificationConfig` takes the config itself, with its `taskId` {{proto A2AService}}. The prose and Appendix A name a `CreateTaskPushNotificationConfigRequest` instead, which the proto does not define {{spec §10.4.7}} ([conflict D5](#s-ref-sources)).

Agents SHOULD validate the `url` {{spec §13.2}}, as [Security requirements](#s-security-requirements) explains.

## What arrives at the webhook

Each notification is an HTTP POST whose body is one `StreamResponse` {{spec §4.3.3}}. The JSON is always the HTTP+JSON form, whatever binding the agent speaks {{spec §3.5.1}}. So `test-runner` posts a plain `statusUpdate` with no JSON-RPC envelope, as [figure](#fig-push-webhook) shows.

```figure
id: fig-push-webhook
kind: sequence
title: one test run reported through a webhook
claim: With a webhook registered, test-runner posts eight StreamResponse bodies to the planner's receiver after the SendMessage call has already returned.
caption: Read top to bottom in the order the kit ran the steps. The capture file prints the eight deliveries last, but they arrived before the config calls. From capture/out/15-push.http, ids shortened to 8 characters.
```

```listing
title: the first notification, as the receiver saw it
source: capture/out/15-push.http
lang: http
note: The status message is cut. The kit's receiver records only these three headers.
---
POST /a2a-events HTTP/1.1
Content-Type: application/a2a+json
Authorization: Bearer hook_secret_91d2
X-A2A-Notification-Token: planner-run-0006

{
  "statusUpdate": {
    "taskId": "d7d3dceb-7333-4676-90ce-36542116a45c",
    "contextId": "e051d022-3c39-4f5c-bd9c-7a902ae474cd",
    "status": {
      "state": "TASK_STATE_WORKING",
…
      "timestamp": "2026-10-06T09:00:05.000Z"
```

"The agent MUST include authentication credentials in the request headers as specified in the `PushNotificationConfig.authentication` field" {{spec §4.3.3}}. The specification gives the `token` no transport, and the kit sends it in `X-A2A-Notification-Token`, the reference SDK's header {{sdk src/a2a/server/tasks/base_push_notification_sender.py}}.

The specification's request format uses `application/a2a+json` {{spec §4.3.3}}, and the reference SDK posts `application/json` {{sdk src/a2a/server/tasks/base_push_notification_sender.py}}, as the kit README lists. The SDKs also differ on the token header and the timeout, and none retries:

| SDK | Content-Type | Token header | Timeout | Retries |
|---|---|---|---|---|
| a2a-python 1.2.2 {{sdk src/a2a/server/tasks/base_push_notification_sender.py}} | `application/json` | `X-A2A-Notification-Token` | set by the `httpx` client the server passes in | none |
| a2a-go {{sdk-go a2asrv/push/sender.go at v2.6.0}} | `application/json` | `A2A-Notification-Token` | 30 s | none |
| a2a-java {{sdk-java server-common/src/main/java/org/a2aproject/sdk/server/tasks/BasePushNotificationSender.java at v1.4.0.Final}} | `application/json` | `X-A2A-Notification-Token` | none set | none |
| a2a-js {{sdk-js src/server/push_notification/default_push_notification_sender.ts at v1.3.0}} | `application/a2a+json` | `X-A2A-Notification-Token`, only when `authentication` is empty | 5 s | none |
| a2a-dotnet {{sdk-dotnet src/A2A/Server/A2AServer.cs at v1.0.0-preview2}} | no sender: every config operation returns `-32003` | | | |
| a2a-rs {{sdk-rust a2a-server/src/push/sender.rs at a2a-server-lf-v0.5.1}} | `application/json` | `A2A-Notification-Token` | 30 s | none |

Every sender in the table posts one `StreamResponse` per event. So accept both content types, read either token header, and put the secret you rely on in `authentication`. The specification does not say which events are posted, and the reference SDK also posts the first `Task` {{sdk src/a2a/server/tasks/push_notification_sender.py}}, so handle every `StreamResponse` member.

## Delivery is attempted at least once

```rule
label: delivery
source: spec §4.3.3
---
"Agents MUST attempt delivery at least once for each configured webhook"
```

At least once means a notification can arrive twice, so the receiver has duties too: "Clients MUST respond with HTTP 2xx status codes to acknowledge successful receipt", "Clients SHOULD process notifications idempotently, as duplicate deliveries may occur", and "Clients MUST validate the task ID matches an expected task" {{spec §4.3.3}}.

A status update is safe to apply twice, keyed by `taskId` and `timestamp`. An `artifactUpdate` with `append: true` is not, and the specification defines no delivery id. So treat each notification as a signal and read the task with `GetTask`, as the project's guide suggests {{docs streaming-and-async}}.

Retries are optional: "Agents MAY implement retry logic with exponential backoff for failed deliveries" {{spec §4.3.3}}. No SDK in the table retries, so a receiver that was down reads the task with `GetTask` when it comes back.

## Managing configurations

Four operations manage the stored configs of a task: create, get, list, and delete {{proto A2AService}}. The capture lists, reads, and deletes its config after the run, as [figure](#fig-push-webhook) shows. A config "MUST persist until task completion or explicit deletion" {{spec §3.1.7}}, and a delete "MUST be idempotent" {{spec §3.1.10}}.

Get and list return the stored `credentials` unchanged, in the kit and the reference SDK {{sdk src/a2a/server/request_handlers/default_request_handler_v2.py}}, so whoever can call them can read the webhook secret. All four operations need `pushNotifications` on the card, or they return `PushNotificationNotSupportedError` {{spec §3.3.4}}.

```takeaways
- Register the webhook inline in `SendMessage`, so no event slips out before the config exists.
- Put the secret your receiver checks in `authentication`, because `token` has no standard header.
- Read the task with `GetTask` before you act on a notification, because one can arrive twice.
- Restrict who can call the four config operations, because a read returns the webhook credentials.
```

Sources: spec §3.1.7, §3.1.10, §3.3.4, §3.5.1, §4.3.1, §4.3.3, §10.4.7, §13.2, Appendix A (research/sources/specification.md); proto TaskPushNotificationConfig, AuthenticationInfo, SendMessageConfiguration, A2AService (research/sources/a2a.proto); docs streaming-and-async (research/sources/docs.md); sdk src/a2a/server/tasks/base_push_notification_sender.py, src/a2a/server/tasks/push_notification_sender.py, src/a2a/server/request_handlers/default_request_handler_v2.py (a2a-python 1.2.2); sdk-go a2asrv/push/sender.go (a2a-go v2.6.0); sdk-java server-common/src/main/java/org/a2aproject/sdk/server/tasks/BasePushNotificationSender.java (a2a-java v1.4.0.Final); sdk-js src/server/push_notification/default_push_notification_sender.ts (a2a-js v1.3.0); sdk-dotnet src/A2A/Server/A2AServer.cs (a2a-dotnet v1.0.0-preview2); sdk-rust a2a-server/src/push/sender.rs (a2a-rs a2a-server-lf-v0.5.1); capture/out/15-push.http; capture/run.py, capture/a2a_ref.py, capture/README.md
