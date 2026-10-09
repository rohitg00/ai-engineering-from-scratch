# Glossary

> Each term below has one meaning across the manual, and its link names the section that defines it.

| Term | Meaning in this manual | Defined in |
|---|---|---|
| A2A error | One of the nine errors the specification defines and maps into every binding, such as `TaskNotFoundError` | [5.5](#s-errors) |
| Agent card | The JSON document that describes an agent, usually at `/.well-known/agent-card.json` | [2.1](#s-agentcard-fields) |
| Artifact | An output of a task, made of parts. A long one arrives in chunks. | [3.3](#s-artifact-and-chunks) |
| Blocking call | A send that waits for a terminal or interrupted state, the default | [4.1](#s-send-message) |
| Capability | A card flag, such as `streaming`, that allows a group of operations | [2.1](#s-agentcard-fields) |
| Card signature | An entry in `signatures`: a JSON Web Signature over the card's RFC 8785 canonical form | [2.3](#s-extended-cards-and-signatures) |
| Context | A conversation that groups tasks and messages under one `contextId` | [3.5](#s-context-id) |
| Direct reply | A `Message` that is the whole result of a send, with no task | [4.1](#s-send-message) |
| Extended card | A fuller card that `GetExtendedAgentCard` returns to an authenticated client | [2.3](#s-extended-cards-and-signatures) |
| Extension | A protocol addition named by a URI, declared in `capabilities.extensions` and activated with `A2A-Extensions` | [6.2](#s-extensions) |
| History | The messages a task keeps, capped by `historyLength` | [4.3](#s-get-task-and-list-tasks) |
| In-task authorization | An agent's request for permission partway through a task. The task waits in `TASK_STATE_AUTH_REQUIRED` for an answer that arrives outside A2A. | [6.1](#s-security-schemes-and-in-task-authorization) |
| Interface | One entry in `supportedInterfaces`: a URL, a protocol binding, a protocol version, and an optional tenant | [2.1](#s-agentcard-fields) |
| Interrupted state | `TASK_STATE_INPUT_REQUIRED` or `TASK_STATE_AUTH_REQUIRED`. The task waits. | [4.2](#s-input-required-and-auth-required) |
| Message | One turn, with a `messageId`, a `role`, and parts | [3.1](#s-message) |
| Opaque | Hidden from the caller. An opaque agent shows only what it sends back. | [1.1](#s-what-a2a-standardizes) |
| Part | The smallest unit of content: one of `text`, `raw`, `url`, or `data` | [3.2](#s-part) |
| Polling | Calling `GetTask` again and again to follow a task | [4.1](#s-send-message) |
| Protocol binding | One concrete form of the operations: JSON-RPC, gRPC, or HTTP+JSON | [5.1](#s-json-rpc) |
| Push notification | An HTTP POST of a `StreamResponse` to a webhook the client registered | [4.6](#s-push-notification-configs) |
| Remote agent | The agent behind an A2A endpoint that receives messages and runs tasks | [1.1](#s-what-a2a-standardizes) |
| Security requirement | One entry in `securityRequirements`, which maps scheme names to the scopes a request needs | [6.1](#s-security-schemes-and-in-task-authorization) |
| Security scheme | A named way to authenticate, declared in a card's `securitySchemes` | [6.1](#s-security-schemes-and-in-task-authorization) |
| Service parameter | A per-request key, such as `A2A-Version`, sent as an HTTP header or as gRPC metadata | [5.4](#s-version-and-extension-headers) |
| Skill | One entry in a card's `skills`, such as `run-tests` | [2.1](#s-agentcard-fields) |
| Status message | The one `message` a `TaskStatus` can hold, such as a question or a reason | [3.1](#s-message) |
| Stream | Server-Sent Events, or a gRPC stream, of `StreamResponse` frames. `SubscribeToTask` opens one on a task. | [4.5](#s-streaming-and-subscribe-to-task) |
| Task | The unit of work a server creates for a message, with an `id` and a `TaskState` | [3.4](#s-task-and-task-state) |
| Tenant | An optional routing string on an interface, copied into every request sent to that interface | [5.2](#s-http-json) |
| Terminal state | `TASK_STATE_COMPLETED`, `TASK_STATE_FAILED`, `TASK_STATE_CANCELED`, or `TASK_STATE_REJECTED`. The task never changes again. | [4.4](#s-cancel-task-and-terminal-states) |

Sources: spec §1, §1.2, §1.3, §2.2, §3.2.2, §3.2.6, §3.4.1, §3.4.2, §3.7, §4.6, §7.3, §7.6.1, §8.2, §8.3.2, §8.4, §B (research/sources/specification.md); proto TaskState, Role, Message, Part, Artifact, TaskStatus, TaskPushNotificationConfig, AgentCard, AgentCapabilities, AgentExtension, AgentInterface, SecurityRequirement (research/sources/a2a.proto); the definition paragraphs of sections 1.1 to 6.2; capture/planner.py, capture/agents.py, capture/out/05-streaming.events.json
