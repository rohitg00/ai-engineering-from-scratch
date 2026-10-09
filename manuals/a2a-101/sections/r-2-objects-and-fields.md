# Objects and fields

> The proto defines every object in a request, a response, or a stream frame, and each field has one lowerCamelCase JSON name, one type, and a presence rule.

Bold rows name proto messages, the normative source for data objects, and the rows under each are its fields {{spec §1.4}}. Fields carry their lowerCamelCase JSON names {{spec §5.5}}, although the §5.5 example converts `push_notification_config`, a field the proto names `task_push_notification_config` ([conflict D22](#s-ref-sources-the-conflict-register)).

*Yes* in the Req. column marks a `REQUIRED` field, which "MUST be present and set in valid messages" {{spec §5.7}}. A required array holds one element or more, yet an empty `tasks` list is legitimate ([conflict D19](#s-ref-sources-the-conflict-register)). A type that starts with `optional` uses the proto keyword that records whether the field was set.

The tables leave out some optional fields. `Task`, `Message`, `Part`, `Artifact`, and both stream events carry a `metadata` object, and `Message` and `Artifact` carry `extensions`, a list of URIs. A part can name a `filename`, an artifact a `description`, a skill its `examples`, and a card a `documentationUrl` and an `iconUrl`. Every request message, from `SendMessageRequest` to `GetExtendedAgentCardRequest`, carries an optional `tenant` string that must match the chosen interface's `tenant` when that is set {{proto SendMessageRequest}}. [Operations by binding](#s-ref-operations-by-binding) lists the request and response messages.

## Task and message objects

[Message](#s-message), [Part](#s-part), [Artifact and chunks](#s-artifact-and-chunks), [Task, TaskStatus, and TaskState](#s-task-and-task-state), [SendMessage](#s-send-message), and [push notification configs](#s-push-notification-configs) define these objects.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| **Task** | | | The unit of work, created by the server |
| id | string | yes | Minted by the server |
| contextId | string | | The context. Both stream events require it. |
| status | TaskStatus | yes | The state, status message, and time |
| artifacts | repeated Artifact | | The outputs. `ListTasks` needs `includeArtifacts` for them. |
| history | repeated Message | | The kept messages, capped by `historyLength` |
| **TaskStatus** | | | The status of a task |
| state | TaskState | yes | A value from [Task states](#s-ref-task-states) |
| message | Message | | The agent's note, such as a question |
| timestamp | google.protobuf.Timestamp | | When it was recorded, in ISO 8601 and UTC |
| **Message** | | | One turn of conversation |
| messageId | string | yes | Minted by the sender. Agents can use it to detect duplicates. |
| contextId | string | | The context. Every server message has it. |
| taskId | string | | The task. A client value names an existing task that matches `contextId`. |
| role | Role | yes | `ROLE_USER` from the client, `ROLE_AGENT` from the server |
| parts | repeated Part | yes | The content, one part or more |
| referenceTaskIds | repeated string | | Other tasks the message refers to |
| **Part** | | | Exactly one of `text`, `raw`, `url`, and `data` |
| text | string | | Text content |
| raw | bytes | | File content, base64 in JSON |
| url | string | | A URL to the file content |
| data | google.protobuf.Value | | Any JSON value |
| mediaType | string | | The media type, for every kind of part |
| **Artifact** | | | One output of a task |
| artifactId | string | yes | Unique in the task. Chunks match on it. |
| name | string | | A readable name, such as `test-log.txt` |
| parts | repeated Part | yes | The content, one part or more |
| **TaskStatusUpdateEvent** | | | A change of task status |
| taskId, contextId | string | yes | The task and its context |
| status | TaskStatus | yes | The new status |
| **TaskArtifactUpdateEvent** | | | A new artifact, or one chunk of it |
| taskId, contextId | string | yes | The task and its context |
| artifact | Artifact | yes | The artifact or the chunk |
| append | bool | | When true, add to the artifact with this `artifactId` |
| lastChunk | bool | | When true, this is the last chunk |
| **StreamResponse** | | | A frame or push body, one of four {{spec §3.2.3}} {{spec §4.3.3}} |
| task | Task | | The task now. It opens task streams and subscriptions. |
| message | Message | | A message-only stream holds one, then closes. |
| statusUpdate | TaskStatusUpdateEvent | | A change of task status |
| artifactUpdate | TaskArtifactUpdateEvent | | A new artifact or chunk |
| **SendMessageConfiguration** | | | The `configuration` of a send |
| acceptedOutputModes | repeated string | | Media types the client accepts |
| taskPushNotificationConfig | TaskPushNotificationConfig | | A webhook to register, with no `taskId` |
| historyLength | optional int32 | | Unset means no limit, and `0` means none. |
| returnImmediately | bool | | True returns once the task exists. The default waits. |
| **TaskPushNotificationConfig** | | | A webhook for one task |
| tenant | string | | Must match the interface `tenant`, if set |
| id | string | | The configuration id, assigned on create |
| taskId | string | | The task it belongs to |
| url | string | yes | The webhook URL |
| token | string | | A token for the task or session. No transport is defined. |
| authentication | AuthenticationInfo | | How the agent authenticates: a required `scheme`, such as `Bearer`, and optional `credentials` |

## Agent card objects

[AgentCard fields](#s-agentcard-fields), [Extended cards and signatures](#s-extended-cards-and-signatures), [Security schemes](#s-security-schemes-and-in-task-authorization), and [Extensions](#s-extensions) define these objects.

| Field | Type | Req. | Meaning |
|---|---|---|---|
| **AgentCard** | | | What the agent offers, where, and what it demands |
| name | string | yes | A readable name, such as `test-runner` |
| description | string | yes | What the agent does |
| supportedInterfaces | repeated AgentInterface | yes | Where to reach it. The first entry is preferred. |
| provider | AgentProvider | | The provider: a required `url` and `organization` |
| version | string | yes | The agent's own version, such as `2.3.0` |
| capabilities | AgentCapabilities | yes | The optional features it supports |
| securitySchemes | map<string, SecurityScheme> | | Accepted authentication schemes, by name |
| securityRequirements | repeated SecurityRequirement | | Scheme names mapped to scopes, such as `{"schemes": {"bearer": {"list": []}}}` |
| defaultInputModes | repeated string | yes | Media types accepted across all skills |
| defaultOutputModes | repeated string | yes | Media types produced across all skills |
| skills | repeated AgentSkill | yes | What the agent does well |
| signatures | repeated AgentCardSignature | | JWS signatures over the canonical card |
| **AgentInterface** | | | One way to reach the agent |
| url | string | yes | An absolute HTTPS URL in production |
| protocolBinding | string | yes | `JSONRPC`, `GRPC`, `HTTP+JSON`, or a custom binding URI |
| tenant | string | | A routing value. When set, copy it into each request sent to this interface. |
| protocolVersion | string | yes | The A2A version, such as `1.0` |
| **AgentCapabilities** | | | Optional features. An absent flag means `false`. |
| streaming | optional bool | | Allows `SendStreamingMessage` and `SubscribeToTask` |
| pushNotifications | optional bool | | Allows the four push configuration operations |
| extensions | repeated AgentExtension | | The protocol extensions it supports |
| extendedAgentCard | optional bool | | Allows `GetExtendedAgentCard` |
| **AgentExtension** | | | One extension the agent supports, in `capabilities.extensions` |
| uri | string | | The URI that identifies the extension |
| description | string | | How this agent uses the extension |
| required | bool | | When true, the client must understand and comply with the extension |
| params | google.protobuf.Struct | | Configuration for the extension, as a JSON object |
| **AgentSkill** | | | One thing the agent does well |
| id | string | yes | The skill id, such as `run-tests` |
| name | string | yes | A readable name |
| description | string | yes | What the skill does |
| tags | repeated string | yes | Keywords, one or more |
| inputModes | repeated string | | Input media types that override the card's |
| outputModes | repeated string | | Output media types that override the card's |
| securityRequirements | repeated SecurityRequirement | | Requirements for this skill |

## Names the proto does not define

Older material and stale pages of the docs still use these names, and none exists in the v1.0.1 proto ([conflict D10](#s-ref-sources-the-conflict-register)).

| Name | Use instead |
|---|---|
| `kind` on a part or a stream event | The member name, such as `text` or `statusUpdate` |
| `TextPart`, `FilePart`, `DataPart` | One `Part` with `text`, `raw` or `url`, or `data` |
| `final` on `TaskStatusUpdateEvent` | The close of the stream |
| `taskStatusUpdate`, `taskArtifactUpdate` | `statusUpdate`, `artifactUpdate` |
| `Task.createdAt`, `Task.lastModified` | `status.timestamp` |
| `TaskArtifactUpdateEvent.index` | `artifactId`, which chunks match on |
| `PushNotificationConfig`, `CreateTaskPushNotificationConfigRequest` | `TaskPushNotificationConfig`, which the create operation takes as its request ([conflict D4](#s-ref-sources-the-conflict-register)) |
| `configId` on a push configuration | `id` |
| Card `url`, `protocolVersion`, `preferredTransport`, `additionalInterfaces` | `supportedInterfaces`, with `url` and `protocolVersion` on each entry |
| Card `supportsAuthenticatedExtendedCard` | `capabilities.extendedAgentCard` |
| Card `security` | `securityRequirements` ([conflict D6](#s-ref-sources-the-conflict-register)) |
| Card `extensions` at the top level | `capabilities.extensions` ([discrepancy N2](#s-ref-sources-discrepancies-found-after-the-register)) |
| `cursor`, `limit`, `nextCursor` | `pageToken`, `pageSize`, `nextPageToken` |

Sources: proto messages from Task to AgentSkill, with AgentExtension, AuthenticationInfo, AgentProvider, SecurityRequirement, and the request messages from SendMessageRequest to GetExtendedAgentCardRequest (research/sources/a2a.proto); spec §1.4, §3.1.4, §3.1.7, §3.2.2, §3.2.3, §3.3.4, §3.4.2, §4.3.3, §5.5, §5.6.1, §5.7, §A.2.1 (research/sources/specification.md); docs whats-new-v1 (research/sources/docs.md); research/brief-spec.md sections 2.0 to 2.8, 8.3 and 12.2; research/brief-docs.md; research/migration.md section D.6 (N2); capture/out/01-agent-cards.http
