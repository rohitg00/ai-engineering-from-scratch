# Operations by binding

> Every A2A operation has one name in JSON-RPC and gRPC, one route in HTTP+JSON, one request and one response message, and a fixed list of errors.

The proto defines eleven operations in one gRPC service, `A2AService`, and the JSON-RPC `method` carries the same name as the rpc {{proto A2AService}} {{spec §5.3}}. The routes are the proto's `google.api.http` templates {{proto A2AService}}. The first column links each operation to the section that explains it.

| JSON-RPC method | gRPC rpc | HTTP+JSON route | Request in, response out |
|---|---|---|---|
| [SendMessage](#s-send-message) | `SendMessage` | `POST /message:send` | `SendMessageRequest`, `SendMessageResponse` |
| [SendStreamingMessage](#s-streaming-and-subscribe-to-task) | `SendStreamingMessage` | `POST /message:stream` | `SendMessageRequest`, a stream of `StreamResponse` |
| [GetTask](#s-get-task-and-list-tasks) | `GetTask` | `GET /tasks/{id=*}` | `GetTaskRequest`, `Task` |
| [ListTasks](#s-get-task-and-list-tasks) | `ListTasks` | `GET /tasks` | `ListTasksRequest`, `ListTasksResponse` |
| [CancelTask](#s-cancel-task-and-terminal-states) | `CancelTask` | `POST /tasks/{id=*}:cancel` | `CancelTaskRequest`, `Task` |
| [SubscribeToTask](#s-streaming-and-subscribe-to-task) | `SubscribeToTask` | `GET /tasks/{id=*}:subscribe` in the proto, and `POST` in §5.3 and §11.3.2, so accept both verbs, as the reference SDK does ([conflict D1](#s-ref-sources-the-conflict-register)) {{sdk src/a2a/server/routes/rest_routes.py}} | `SubscribeToTaskRequest`, a stream of `StreamResponse` |
| [CreateTaskPushNotificationConfig](#s-push-notification-configs) | `CreateTaskPushNotificationConfig` | `POST /tasks/{task_id=*}/pushNotificationConfigs` | `TaskPushNotificationConfig` in and out, with no request wrapper ([conflict D5](#s-ref-sources-the-conflict-register)) |
| [GetTaskPushNotificationConfig](#s-push-notification-configs) | `GetTaskPushNotificationConfig` | `GET /tasks/{task_id=*}/pushNotificationConfigs/{id=*}` | `GetTaskPushNotificationConfigRequest`, `TaskPushNotificationConfig` |
| [ListTaskPushNotificationConfigs](#s-push-notification-configs) | `ListTaskPushNotificationConfigs` | `GET /tasks/{task_id=*}/pushNotificationConfigs` | `ListTaskPushNotificationConfigsRequest`, `ListTaskPushNotificationConfigsResponse` |
| [DeleteTaskPushNotificationConfig](#s-push-notification-configs) | `DeleteTaskPushNotificationConfig` | `DELETE /tasks/{task_id=*}/pushNotificationConfigs/{id=*}` | `DeleteTaskPushNotificationConfigRequest`, `google.protobuf.Empty` |
| [GetExtendedAgentCard](#s-extended-cards-and-signatures) | `GetExtendedAgentCard` | `GET /extendedAgentCard` | `GetExtendedAgentCardRequest`, `AgentCard` |

Every rpc has a second route in its `additional_bindings`, the same path under a `/{tenant}` prefix, such as `POST /{tenant}/message:send` {{proto A2AService}}. The prose in §5.3, §11.3, and §11.5 lists only the plain routes ([discrepancy N12](#s-ref-sources-discrepancies-found-after-the-register)). In JSON-RPC the same value travels as `params.tenant`, and in gRPC as the `tenant` field of the request. In every binding it must match the `tenant` of the chosen interface when that is set {{proto SendMessageRequest}}, as [HTTP+JSON](#s-http-json) explains.

`SendMessageResponse` holds one `task` or one `message`. A send requires `message`, and get, cancel, and subscribe require the task `id`. The get, list, and delete configuration requests require `taskId`, get and delete also require `id`, and create requires `url`. JSON-RPC posts each call as one envelope, with the name in `method` and the request message in `params` {{spec §9.3}}.

Each operation can raise the errors §3.1 lists for it. The last column names the card capability that must be `true`. When it is `false` or absent, the push configuration methods fail with `PushNotificationNotSupportedError` and the others with `UnsupportedOperationError` {{spec §3.3.4}}.

| Method | Other A2A errors | Capability flag |
|---|---|---|
| SendMessage | `ContentTypeNotSupportedError`, `TaskNotFoundError`, and `UnsupportedOperationError` for a terminal task | none |
| SendStreamingMessage | The same three as `SendMessage` | streaming |
| GetTask | `TaskNotFoundError` | none |
| ListTasks | None beyond the standard protocol errors | none |
| CancelTask | `TaskNotCancelableError`, `TaskNotFoundError` | none |
| SubscribeToTask | `TaskNotFoundError`, and `UnsupportedOperationError` for a terminal task | streaming |
| The four push configuration methods | `TaskNotFoundError`, which `GetTaskPushNotificationConfig` also returns for a missing configuration | pushNotifications |
| GetExtendedAgentCard | `ExtendedAgentCardNotConfiguredError` when the flag is on and no extended card is configured | extendedAgentCard |

Any operation can also fail with `VersionNotSupportedError`, `ExtensionSupportRequiredError`, or an authentication or authorization error {{spec §3.6.2}} {{spec §3.3.2}}. [Errors](#s-ref-errors) gives their codes in every binding, and [the gRPC binding](#s-grpc) shows one rpc with its full annotation.

Sources: proto `A2AService` with its `google.api.http` routes and `additional_bindings`, and the request and response messages from `SendMessageRequest` to `ListTaskPushNotificationConfigsResponse` (research/sources/a2a.proto); spec §3.1.1 to §3.1.11, §3.3.2, §3.3.4, §3.6.2, §5.3, §9.3, §11.3, §11.3.2, §11.5 (research/sources/specification.md); research/brief-spec.md sections 2.7, 2.8, 3.0, 7.5 and 12.2; research/migration.md section D.6 (N12); sdk src/a2a/server/routes/rest_routes.py at v1.2.2
