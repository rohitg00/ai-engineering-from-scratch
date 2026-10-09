# Agent2Agent (A2A) Protocol Specification

??? note "**Latest Released Version** [`1.0.0`](https://a2a-protocol.org/v1.0.0/specification)"

    **Previous Versions**

    - [`0.3.0`](https://a2a-protocol.org/v0.3.0/specification)
    - [`0.2.6`](https://a2a-protocol.org/v0.2.6/specification)
    - [`0.1.0`](https://a2a-protocol.org/v0.1.0/specification)

See [Release Notes](https://github.com/a2aproject/A2A/releases) for changes made between versions.

## 1. Introduction

The Agent2Agent (A2A) Protocol is an open standard designed to facilitate communication and interoperability between independent, potentially opaque AI agent systems. In an ecosystem where agents might be built using different frameworks, languages, or by different vendors, A2A provides a common language and interaction model.

This document provides the detailed technical specification for the A2A protocol. Its primary goal is to enable agents to:

- Discover each other's capabilities.
- Negotiate interaction modalities (text, files, structured data).
- Manage collaborative tasks.
- Securely exchange information to achieve user goals **without needing access to each other's internal state, memory, or tools.**

### 1.1. Key Goals of A2A

- **Interoperability:** Bridge the communication gap between disparate agentic systems.
- **Collaboration:** Enable agents to delegate tasks, exchange context, and work together on complex user requests.
- **Discovery:** Allow agents to dynamically find and understand the capabilities of other agents.
- **Flexibility:** Support various interaction modes including synchronous request/response, streaming for real-time updates, and asynchronous push notifications for long-running tasks.
- **Security:** Facilitate secure communication patterns suitable for enterprise environments, relying on standard web security practices.
- **Asynchronicity:** Natively support long-running tasks and interactions that may involve human-in-the-loop scenarios.

### 1.2. Guiding Principles

- **Simple:** Reuse existing, well-understood standards (HTTP, JSON-RPC 2.0, Server-Sent Events).
- **Enterprise Ready:** Address authentication, authorization, security, privacy, tracing, and monitoring by aligning with established enterprise practices.
- **Async First:** Designed for (potentially very) long-running tasks and human-in-the-loop interactions.
- **Modality Agnostic:** Support exchange of diverse content types including text, audio/video (via file references), structured data/forms, and potentially embedded UI components (e.g., iframes referenced in parts).
- **Opaque Execution:** Agents collaborate based on declared capabilities and exchanged information, without needing to share their internal thoughts, plans, or tool implementations.

For a broader understanding of A2A's purpose and benefits, see [What is A2A?](./topics/what-is-a2a.md).

### 1.3. Specification Structure

This specification is organized into three distinct layers that work together to provide a complete protocol definition:

```mermaid
graph TB
    subgraph L1 ["A2A Data Model"]
        direction LR
        A[Task] ~~~ B[Message] ~~~ C[AgentCard] ~~~ D[Part] ~~~ E[Artifact] ~~~ F[Extension]
    end

    subgraph L2 ["A2A Operations"]
        direction LR
        G[Send Message] ~~~ H[Send Streaming Message] ~~~ I[Get Task] ~~~ J[List Tasks] ~~~ K[Cancel Task] ~~~ L[Get Agent Card]
    end

    subgraph L3 ["Protocol Bindings"]
        direction LR
        M[JSON-RPC Methods] ~~~ N[gRPC RPCs] ~~~ O[HTTP/REST Endpoints] ~~~ P[Custom Bindings]
    end

    %% Dependencies between layers
    L1 --> L2
    L2 --> L3


    style A fill:#e1f5fe
    style B fill:#e1f5fe
    style C fill:#e1f5fe
    style D fill:#e1f5fe
    style E fill:#e1f5fe
    style F fill:#e1f5fe

    style G fill:#f3e5f5
    style H fill:#f3e5f5
    style I fill:#f3e5f5
    style J fill:#f3e5f5
    style K fill:#f3e5f5
    style L fill:#f3e5f5

    style M fill:#e8f5e8
    style N fill:#e8f5e8
    style O fill:#e8f5e8

    style L1 fill:#f0f8ff,stroke:#333,stroke-width:2px
    style L2 fill:#faf0ff,stroke:#333,stroke-width:2px
    style L3 fill:#f0fff0,stroke:#333,stroke-width:2px
```

**Layer 1: Canonical Data Model** defines the core data structures and message formats that all A2A implementations must understand. These are protocol agnostic definitions expressed as Protocol Buffer messages.

**Layer 2: Abstract Operations** describes the fundamental capabilities and behaviors that A2A agents must support, independent of how they are exposed over specific protocols.

**Layer 3: Protocol Bindings** provides concrete mappings of the abstract operations and data structures to specific protocol bindings (JSON-RPC, gRPC, HTTP/REST), including method names, endpoint patterns, and protocol-specific behaviors.

This layered approach ensures that:

- Core semantics remain consistent across all protocol bindings
- New protocol bindings can be added without changing the fundamental data model
- Developers can reason about A2A operations independently of binding concerns
- Interoperability is maintained through shared understanding of the canonical data model

### 1.4 Normative Content

In addition to the protocol requirements defined in this document, the file `spec/a2a.proto` is the single authoritative normative definition of all protocol data objects and request/response messages. A generated JSON artifact (`spec/a2a.json`, produced at build time and not committed) MAY be published for convenience to tooling and the website, but it is a non-normative build artifact. SDK language bindings, schemas, and any other derived forms **MUST** be regenerated from the proto (directly or via code generation) rather than edited manually.

**Change Control and Deprecation Lifecycle:**

- Introduction: When a proto message or field is renamed, the new name is added while existing published names remain available, but marked deprecated, until the next major release.
- Documentation: Migration guidance MUST be provided via an ancillary document when introducing major breaking changes.
- Anchors: Legacy documentation anchors MUST be preserved (as hidden HTML anchors) to avoid breaking inbound links.
- SDK/Schema Aliases: SDKs and JSON Schemas SHOULD provide deprecated alias types/definitions to maintain backward compatibility.
- Removal: A deprecated name SHOULD NOT be removed earlier than the next major version after introduction of its replacement.

**Automated Generation:**

The documentation build generates `specification/json/a2a.json` on-the-fly (the file is not tracked in source control). Future improvements may publish an OpenAPI v3 + JSON Schema bundle for enhanced tooling.

**Rationale:**

Centering the proto file as the normative source ensures protocol neutrality, reduces specification drift, and provides a deterministic evolution path for the ecosystem.

## 2. Terminology

### 2.1. Requirements Language

The keywords "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://tools.ietf.org/html/rfc2119).

### 2.2. Core Concepts

A2A revolves around several key concepts. For detailed explanations, please refer to the [Key Concepts guide](./topics/key-concepts.md).

- **A2A Client:** An application or agent that initiates requests to an A2A Server on behalf of a user or another system.
- **A2A Server (Remote Agent):** An agent or agentic system that exposes an A2A-compliant endpoint, processing tasks and providing responses.
- **Agent Card:** A JSON metadata document published by an A2A Server, describing its identity, capabilities, skills, service endpoint, and authentication requirements.
- **Message:** A communication turn between a client and a remote agent, having a `role` ("user" or "agent") and containing one or more `Parts`.
- **Task:** The fundamental unit of work managed by A2A, identified by a unique ID. Tasks are stateful and progress through a defined lifecycle.
- **Part:** The smallest unit of content within a Message or Artifact. Parts can contain text, file references, or structured data.
- **Artifact:** An output (e.g., a document, image, structured data) generated by the agent as a result of a task, composed of `Parts`.
- **Streaming:** Real-time, incremental updates for tasks (status changes, artifact chunks) delivered via protocol-specific streaming mechanisms.
- **Push Notifications:** Asynchronous task updates delivered via server-initiated HTTP POST requests to a client-provided webhook URL, for long-running or disconnected scenarios.
- **Context:** An optional identifier to logically group related tasks and messages.
- **Extension:** A mechanism for agents to provide additional functionality or data beyond the core A2A specification.

## 3. A2A Protocol Operations

This section describes the core operations of the A2A protocol in a binding-independent manner. These operations define the fundamental capabilities that all A2A implementations must support, regardless of the underlying binding mechanism.

### 3.1. Core Operations

The following operations define the fundamental capabilities that all A2A implementations must support, independent of the specific protocol binding used. For a quick reference mapping of these operations to protocol-specific method names and endpoints, see [Section 5.3 (Method Mapping Reference)](#53-method-mapping-reference). For detailed protocol-specific implementation details, see:

- [Section 9: JSON-RPC Protocol Binding](#9-json-rpc-protocol-binding)
- [Section 10: gRPC Protocol Binding](#10-grpc-protocol-binding)
- [Section 11: HTTP+JSON/REST Protocol Binding](#11-httpjsonrest-protocol-binding)

#### 3.1.1. Send Message

The primary operation for initiating agent interactions. Clients send a message to an agent and receive either a task that tracks the processing or a direct response message.

**Inputs:**

- [`SendMessageRequest`](#321-sendmessagerequest): Request object containing the message, configuration, and metadata

**Outputs:**

- [`Task`](#411-task): A task object representing the processing of the message, OR
- [`Message`](#414-message): A direct response message (for simple interactions that don't require task tracking)

**Errors:**

- [`ContentTypeNotSupportedError`](#332-error-handling): A Media Type provided in the request's message parts is not supported by the agent.
- [`UnsupportedOperationError`](#332-error-handling): Messages sent to Tasks that are in a terminal state (`TASK_STATE_COMPLETED`, `TASK_STATE_FAILED`, `TASK_STATE_CANCELED`, `TASK_STATE_REJECTED`) cannot accept further messages.
- [`TaskNotFoundError`](#332-error-handling): The task ID does not exist or is not accessible.

**Behavior:**

The agent MAY create a new `Task` to process the provided message asynchronously or MAY return a direct `Message` response for simple interactions. The operation MUST return immediately with either task information or response message. Task processing MAY continue asynchronously after the response when a [`Task`](#411-task) is returned.

#### 3.1.2. Send Streaming Message

Similar to Send Message but with real-time streaming of updates during processing.

**Inputs:**

- [`SendMessageRequest`](#321-sendmessagerequest): Request object containing the message, configuration, and metadata

**Outputs:**

- [`Stream Response`](#323-stream-response) object containing:
    - Initial response: [`Task`](#411-task) object OR [`Message`](#414-message) object
    - Subsequent events following a `Task` MAY include stream of [`TaskStatusUpdateEvent`](#421-taskstatusupdateevent) and [`TaskArtifactUpdateEvent`](#422-taskartifactupdateevent) objects
- Final completion indicator

**Errors:**

- [`UnsupportedOperationError`](#332-error-handling): Streaming is not supported by the agent (see [Capability Validation](#334-capability-validation)).
- [`UnsupportedOperationError`](#332-error-handling): Messages sent to Tasks that are in a terminal state (`TASK_STATE_COMPLETED`, `TASK_STATE_FAILED`, `TASK_STATE_CANCELED`, `TASK_STATE_REJECTED`) cannot accept further messages.
- [`ContentTypeNotSupportedError`](#332-error-handling): A Media Type provided in the request's message parts is not supported by the agent.
- [`TaskNotFoundError`](#332-error-handling): The task ID does not exist or is not accessible.

**Behavior:**

The operation MUST establish a streaming connection for real-time updates. The stream MUST follow one of these patterns:

1. **Message-only stream:** If the agent returns a [`Message`](#414-message), the stream MUST contain exactly one `Message` object and then close immediately. No task tracking or updates are provided.

2. **Task lifecycle stream:** If the agent returns a [`Task`](#411-task), the stream MUST begin with the Task object, followed by zero or more [`TaskStatusUpdateEvent`](#421-taskstatusupdateevent) or [`TaskArtifactUpdateEvent`](#422-taskartifactupdateevent) objects. The stream MUST close when the task reaches a terminal state (`TASK_STATE_COMPLETED`, `TASK_STATE_FAILED`, `TASK_STATE_CANCELED`, `TASK_STATE_REJECTED`).

The agent MAY return a `Task` for complex processing with status/artifact updates or MAY return a `Message` for direct streaming responses without task overhead. The implementation MUST provide immediate feedback on progress and intermediate results.

#### 3.1.3. Get Task

Retrieves the current state (including status, artifacts, and optionally history) of a previously initiated task. This is typically used for polling the status of a task initiated with Send Message, or for fetching the final state of a task after being notified via a push notification or after a stream has ended.

**Inputs:**

{{ proto_to_table("GetTaskRequest") }}

See [History Length Semantics](#324-history-length-semantics) for details about `historyLength`.

**Outputs:**

- [`Task`](#411-task): Current state and artifacts of the requested task

**Errors:**

- [`TaskNotFoundError`](#332-error-handling): The task ID does not exist or is not accessible.

#### 3.1.4. List Tasks

Retrieves a list of tasks with optional filtering and pagination capabilities. This method allows clients to discover and manage multiple tasks across different contexts or with specific status criteria.

**Inputs:**

{{ proto_to_table("ListTasksRequest") }}

When `includeArtifacts` is false (the default), the artifacts field MUST be omitted entirely from each Task object in the response. The field should not be present as an empty array or null value. When `includeArtifacts` is true, the artifacts field should be included with its actual content (which may be an empty array if the task has no artifacts).

**Outputs:**

{{ proto_to_table("ListTasksResponse") }}

Note on `nextPageToken`: The `nextPageToken` field MUST always be present in the response. When there are no more results to retrieve (i.e., this is the final page), the field MUST be set to an empty string (""). Clients should check for an empty string to determine if more pages are available.

**Errors:**

None specific to this operation beyond standard protocol errors.

**Behavior:**

The operation MUST return only tasks visible to the authenticated client and MUST use cursor-based pagination for performance and consistency. Tasks MUST be sorted by last update time in descending order. Implementations MUST implement appropriate authorization scoping to ensure clients can only access authorized tasks. See [Section 13.1 Data Access and Authorization Scoping](#131-data-access-and-authorization-scoping) for detailed security requirements.

***Pagination Strategy:***

This method uses cursor-based pagination (via `pageToken`/`nextPageToken`) rather than offset-based pagination for better performance and consistency, especially with large datasets. Cursor-based pagination avoids the "deep pagination problem" where skipping large numbers of records becomes inefficient for databases. This approach is consistent with the gRPC specification, which also uses cursor-based pagination (page_token/next_page_token).

***Ordering:***

Implementations MUST return tasks sorted by their status timestamp time in descending order (most recently updated tasks first). This ensures consistent pagination and allows clients to efficiently monitor recent task activity.

#### 3.1.5. Cancel Task

Requests the cancellation of an ongoing task. The server will attempt to cancel the task, but success is not guaranteed (e.g., the task might have already completed or failed, or cancellation might not be supported at its current stage).

**Inputs:**

{{ proto_to_table("CancelTaskRequest") }}

**Outputs:**

- Updated [`Task`](#411-task) with cancellation status

**Errors:**

- [`TaskNotCancelableError`](#332-error-handling): The task is not in a cancelable state (e.g., already completed, failed, or canceled).
- [`TaskNotFoundError`](#332-error-handling): The task ID does not exist or is not accessible.

**Behavior:**

The operation attempts to cancel the specified task and returns its updated state.

#### 3.1.6. Subscribe to Task

<span id="79-taskssubscribe"></span>

Establishes a streaming connection to receive updates for an existing task.

**Inputs:**

{{ proto_to_table("SubscribeToTaskRequest") }}

**Outputs:**

- [`Stream Response`](#323-stream-response) object containing:
    - Initial response: [`Task`](#411-task) object with current state
    - Stream of [`TaskStatusUpdateEvent`](#421-taskstatusupdateevent) and [`TaskArtifactUpdateEvent`](#422-taskartifactupdateevent) objects

**Errors:**

- [`UnsupportedOperationError`](#332-error-handling): Streaming is not supported by the agent (see [Capability Validation](#334-capability-validation)).
- [`TaskNotFoundError`](#332-error-handling): The task ID does not exist or is not accessible.
- [`UnsupportedOperationError`](#332-error-handling): The operation is attempted on a task that is in a terminal state (`TASK_STATE_COMPLETED`, `TASK_STATE_FAILED`, `TASK_STATE_CANCELED`, `TASK_STATE_REJECTED`).

**Behavior:**

The operation enables real-time monitoring of task progress and can be used with any task that is not in a terminal state. The stream MUST terminate when the task reaches a terminal state (`TASK_STATE_COMPLETED`, `TASK_STATE_FAILED`, `TASK_STATE_CANCELED`, `TASK_STATE_REJECTED`).

The operation MUST return a `Task` object as the first event in the stream, representing the current state of the task at the time of subscription. This prevents a potential loss of information between a call to `GetTask` and calling `SubscribeToTask`.

#### 3.1.7. Create Push Notification Config

<span id="75-taskspushnotificationconfigset"></span>
<span id="317-create-push-notification-config"></span>

Creates a push notification configuration for a task to receive asynchronous updates via webhook.

**Inputs:**

{{ proto_to_table("TaskPushNotificationConfig") }}

**Outputs:**

- [`PushNotificationConfig`](#431-pushnotificationconfig): Created configuration with assigned ID

**Errors:**

- [`PushNotificationNotSupportedError`](#332-error-handling): Push notifications are not supported by the agent (see [Capability Validation](#334-capability-validation)).
- [`TaskNotFoundError`](#332-error-handling): The task ID does not exist or is not accessible.

**Behavior:**

The operation MUST establish a webhook endpoint for task update notifications. When task updates occur, the agent will send HTTP POST requests to the configured webhook URL with [`StreamResponse`](#323-stream-response) payloads (see [Push Notification Payload](#433-push-notification-payload) for details). This operation is only available if the agent supports push notifications capability. The configuration MUST persist until task completion or explicit deletion.

 <span id="tasks-push-notification-config-operations"></span><span id="grpc-push-notification-operations"></span><span id="push-notification-operations"></span>

#### 3.1.8. Get Push Notification Config

<span id="76-taskspushnotificationconfigget"></span>

Retrieves an existing push notification configuration for a task.

**Inputs:**

{{ proto_to_table("GetTaskPushNotificationConfigRequest") }}

**Outputs:**

- [`PushNotificationConfig`](#431-pushnotificationconfig): The requested configuration

**Errors:**

- [`PushNotificationNotSupportedError`](#332-error-handling): Push notifications are not supported by the agent (see [Capability Validation](#334-capability-validation)).
- [`TaskNotFoundError`](#332-error-handling): The push notification configuration does not exist.

**Behavior:**

The operation MUST return configuration details including webhook URL and notification settings. The operation MUST fail if the configuration does not exist or the client lacks access.

#### 3.1.9. List Push Notification Configs

Retrieves all push notification configurations for a task.

**Inputs:**

{{ proto_to_table("ListTaskPushNotificationConfigsRequest") }}

**Outputs:**

{{ proto_to_table("ListTaskPushNotificationConfigsResponse") }}

**Errors:**

- [`PushNotificationNotSupportedError`](#332-error-handling): Push notifications are not supported by the agent (see [Capability Validation](#334-capability-validation)).
- [`TaskNotFoundError`](#332-error-handling): The task ID does not exist or is not accessible.

**Behavior:**

The operation MUST return all active push notification configurations for the specified task and MAY support pagination for tasks with many configurations.

#### 3.1.10. Delete Push Notification Config

Removes a push notification configuration for a task.

**Inputs:**

{{ proto_to_table("DeleteTaskPushNotificationConfigRequest") }}

**Outputs:**

- Confirmation of deletion (implementation-specific)

**Errors:**

- [`PushNotificationNotSupportedError`](#332-error-handling): Push notifications are not supported by the agent (see [Capability Validation](#334-capability-validation)).
- [`TaskNotFoundError`](#332-error-handling): The task ID does not exist.

**Behavior:**

The operation MUST permanently remove the specified push notification configuration. No further notifications will be sent to the configured webhook after deletion. This operation MUST be idempotent - multiple deletions of the same config have the same effect.

#### 3.1.11. Get Extended Agent Card

Retrieves a potentially more detailed version of the Agent Card after the client has authenticated. This endpoint is available only if `AgentCard.capabilities.extendedAgentCard` is `true`.

**Inputs:**

{{ proto_to_table("GetExtendedAgentCardRequest") }}

**Outputs:**

- [`AgentCard`](#441-agentcard): A complete Agent Card object, which may contain additional details or skills not present in the public card

**Errors:**

- [`UnsupportedOperationError`](#332-error-handling): The agent does not support authenticated extended cards (see [Capability Validation](#334-capability-validation)).
- [`ExtendedAgentCardNotConfiguredError`](#332-error-handling): The agent declares support but does not have an extended agent card configured.

**Behavior:**

- **Authentication**: The client MUST authenticate the request using one of the schemes declared in the public `AgentCard.securitySchemes` and `AgentCard.security` fields.
- **Extended Information**: The operation MAY return different details based on client authentication level, including additional skills, capabilities, or configuration not available in the public Agent Card.
- **Card Replacement**: Clients retrieving this extended card SHOULD replace their cached public Agent Card with the content received from this endpoint for the duration of their authenticated session or until the card's version changes.
- **Availability**: This operation is only available if the public Agent Card declares `capabilities.extendedAgentCard: true`.

For detailed security guidance on extended agent cards, see [Section 13.3 Extended Agent Card Access Control](#133-extended-agent-card-access-control).

### 3.2. Operation Parameter Objects

This section defines common parameter objects used across multiple operations.

#### 3.2.1. SendMessageRequest

{{ proto_to_table("SendMessageRequest") }}

#### 3.2.2. SendMessageConfiguration

{{ proto_to_table("SendMessageConfiguration") }}

**Execution Mode:**

The `return_immediately` field in [`SendMessageConfiguration`](#322-sendmessageconfiguration) controls whether the operation returns immediately or waits for task completion. Operations are blocking by default:

- **Blocking (`return_immediately: false` or unset)**: The operation MUST wait until the task reaches a terminal state (`TASK_STATE_COMPLETED`, `TASK_STATE_FAILED`, `TASK_STATE_CANCELED`, `TASK_STATE_REJECTED`) or an interrupted state (`TASK_STATE_INPUT_REQUIRED`, `TASK_STATE_AUTH_REQUIRED`) before returning. The response MUST include the latest task state with all artifacts and status information. This is the default behavior.

- **Non-Blocking (`return_immediately: true`)**: The operation MUST return immediately after creating the task, even if processing is still in progress. The returned task will have an in-progress state (e.g., `TASK_STATE_WORKING`, `TASK_STATE_INPUT_REQUIRED`). It is the caller's responsibility to poll for updates using [Get Task](#313-get-task), subscribe via [Subscribe to Task](#316-subscribe-to-task), or receive updates via push notifications.

The `return_immediately` field has no effect:

- when the operation returns a direct [`Message`](#414-message) response instead of a task.
- for streaming operations, which always return updates in real-time.
- on configured push notification configurations, which operates independently of execution mode.

#### 3.2.3. Stream Response

<span id="323-stream-response"></span>
<span id="72-messagestream"></span>

{{ proto_to_table("StreamResponse") }}

This wrapper allows streaming endpoints to return different types of updates through a single response stream while maintaining type safety.

#### 3.2.4. History Length Semantics

The `historyLength` parameter appears in multiple operations and controls how much task history is returned in responses. This parameter follows consistent semantics across all operations:

- **Unset/undefined**: No limit imposed; server returns its default amount of history (implementation-defined, may be all history)
- **0**: No history should be returned; the `history` field SHOULD be omitted
- **> 0**: Return at most this many recent messages from the task's history

#### 3.2.5. Metadata

A flexible key-value map for passing additional context or parameters with operations. Metadata keys and are strings and values can be any valid value that can be represented in JSON. [`Extensions`](#46-extensions) can be used to strongly type metadata values for specific use cases.

#### 3.2.6 Service Parameters

A key-value map for passing horizontally applicable context or parameters with case-insensitive string keys and case-sensitive string values. The transmission mechanism for these service parameter key-value pairs is defined by the specific protocol binding (e.g., HTTP headers for HTTP-based bindings, gRPC metadata for gRPC bindings). Custom protocol bindings **MUST** specify how service parameters are transmitted in their binding specification.

**Standard A2A Service Parameters:**

| Name             | Description                                                                                                                                             | Example Value                                                                                 |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------- |
| `A2A-Extensions` | Comma-separated list of extension URIs that the client wants to use for the request                                                                     | `https://example.com/extensions/geolocation/v1,https://standards.org/extensions/citations/v1` |
| `A2A-Version`    | The A2A protocol version that the client is using. If the version is not supported, the agent returns [`VersionNotSupportedError`](#332-error-handling) | `0.3`                                                                                         |

As service parameter names MAY need to co-exist with other parameters defined by the underlying transport protocol or infrastructure, all service parameters defined by this specification will be prefixed with `a2a-`.

### 3.3. Operation Semantics

#### 3.3.1. Idempotency

- **Get operations** (Get Task, List Tasks, Get Extended Agent Card) are naturally idempotent
- **Send Message** operations MAY be idempotent. Agents may utilize the messageId to detect duplicate messages.
- **Cancel Task** operations are idempotent - multiple cancellation requests have the same effect. A duplicate cancellation request MAY return `TaskNotFoundError` if the task has already been canceled and purged.

#### 3.3.2. Error Handling

All operations may return errors in the following categories. Servers **MUST** return appropriate errors and **SHOULD** provide actionable information to help clients resolve issues.

**Error Categories and Server Requirements:**

- **Authentication Errors**: Invalid or missing credentials
    - Servers **MUST** reject requests with invalid or missing authentication credentials
    - Servers **SHOULD** include authentication challenge information in the error response
    - Servers **SHOULD** specify which authentication scheme is required
    - Example error codes: HTTP `401 Unauthorized`, gRPC `UNAUTHENTICATED`, JSON-RPC custom error
    - Example scenarios: Missing bearer token, expired API key, invalid OAuth token

- **Authorization Errors**: Insufficient permissions for requested operation
    - Servers **MUST** return an authorization error when the authenticated client lacks required permissions
    - Servers **SHOULD** indicate what permission or scope is missing (without leaking sensitive information about resources the client cannot access)
    - Servers **MUST NOT** reveal the existence of resources the client is not authorized to access
    - Example error codes: HTTP `403 Forbidden`, gRPC `PERMISSION_DENIED`, JSON-RPC custom error
    - Example scenarios: Attempting to access a task created by another user, insufficient OAuth scopes

- **Validation Errors**: Invalid input parameters or message format
    - Servers **MUST** validate all input parameters before processing
    - Servers **SHOULD** specify which parameter(s) failed validation and why
    - Servers **SHOULD** provide guidance on valid parameter values or formats
    - Example error codes: HTTP `400 Bad Request`, gRPC `INVALID_ARGUMENT`, JSON-RPC `-32602 Invalid params`
    - Example scenarios: Invalid task ID format, missing required message parts, unsupported content type

- **Resource Errors**: Requested task not found or not accessible
    - Servers **MUST** return a not found error when a requested resource does not exist or is not accessible to the authenticated client
    - Servers **SHOULD NOT** distinguish between "does not exist" and "not authorized" to prevent information leakage
    - Example error codes: HTTP `404 Not Found`, gRPC `NOT_FOUND`, JSON-RPC custom error (see A2A-specific errors)
    - Example scenarios: Task ID does not exist, task has been deleted, configuration not found

- **System Errors**: Internal agent failures or temporary unavailability
    - Servers **SHOULD** return appropriate error codes for temporary failures vs. permanent errors
    - Servers **MAY** include retry guidance (e.g., Retry-After header in HTTP)
    - Servers **SHOULD** log system errors for diagnostic purposes
    - Example error codes: HTTP `500 Internal Server Error` or `503 Service Unavailable`, gRPC `INTERNAL` or `UNAVAILABLE`, JSON-RPC `-32603 Internal error`
    - Example scenarios: Database connection failure, downstream service timeout, rate limit exceeded

**Error Payload Structure:**

All error responses in the A2A protocol, regardless of binding, **MUST** convey the following information:

1. **Error Code**: A machine-readable identifier for the error type (e.g., string code, numeric code, or protocol-specific status)
2. **Error Message**: A human-readable description of the error
3. **Error Details** (optional): An array of objects providing additional structured information about the error. Each object in the array **MUST** include a `@type` key that identifies the object's type (using [ProtoJSON `Any` representation](https://protobuf.dev/programming-guides/json)). Well-known types from the [`google.rpc` error model](https://cloud.google.com/apis/design/errors#error_model) (e.g., `ErrorInfo`, `BadRequest`) **SHOULD** be used where applicable. Error details may be used for:
    - Affected fields or parameters
    - Contextual information (e.g., task ID, timestamp)
    - Suggestions for resolution

Protocol bindings **MUST** map these elements to their native error representations while preserving semantic meaning. See binding-specific sections for concrete error format examples: [JSON-RPC Error Handling](#95-error-handling), [gRPC Error Handling](#106-error-handling), and [HTTP/REST Error Handling](#116-error-handling).

**A2A-Specific Errors:**

| Error Name                            | Description                                                                                                                                                                                                            |
| :------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TaskNotFoundError`                   | The specified task ID does not correspond to an existing or accessible task. It might be invalid, expired, or already completed and purged.                                                                            |
| `TaskNotCancelableError`              | An attempt was made to cancel a task that is not in a cancelable state (e.g., it has already reached a terminal state like `TASK_STATE_COMPLETED`, `TASK_STATE_FAILED`, `TASK_STATE_CANCELED`, `TASK_STATE_REJECTED`). |
| `PushNotificationNotSupportedError`   | Client attempted to use push notification features but the server agent does not support them (i.e., `AgentCard.capabilities.pushNotifications` is `false`).                                                           |
| `UnsupportedOperationError`           | The requested operation or a specific aspect of it is not supported by this server agent implementation.                                                                                                               |
| `ContentTypeNotSupportedError`        | A Media Type provided in the request's message parts or implied for an artifact is not supported by the agent or the specific skill being invoked.                                                                     |
| `InvalidAgentResponseError`           | An agent returned a response that does not conform to the specification for the current method.                                                                                                                        |
| `ExtendedAgentCardNotConfiguredError` | The agent does not have an extended agent card configured when one is required for the requested operation.                                                                                                            |
| `ExtensionSupportRequiredError`       | Server requested use of an extension marked as `required: true` in the Agent Card but the client did not declare support for it in the request.                                                                        |
| `VersionNotSupportedError`            | The A2A protocol version specified in the request (via `A2A-Version` service parameter) is not supported by the agent.                                                                                                 |

#### 3.3.3. Asynchronous Processing

A2A operations are designed for asynchronous task execution. Operations return immediately with either [`Task`](#411-task) objects or [`Message`](#414-message) objects, and when a Task is returned, processing continues in the background. Clients retrieve task updates through polling, streaming, or push notifications (see [Section 3.5](#35-task-update-delivery-mechanisms)). Agents MAY accept additional messages for tasks in non-terminal states to enable multi-turn interactions (see [Section 3.4](#34-multi-turn-interactions)).

#### 3.3.4. Capability Validation

Agents declare optional capabilities in their [`AgentCard`](#441-agentcard). When clients attempt to use operations or features that require capabilities not declared as supported in the Agent Card, the agent **MUST** return an appropriate error response:

- **Push Notifications**: If `AgentCard.capabilities.pushNotifications` is `false` or not present, operations related to push notification configuration (Create, Get, List, Delete) **MUST** return [`PushNotificationNotSupportedError`](#332-error-handling).
- **Streaming**: If `AgentCard.capabilities.streaming` is `false` or not present, attempts to use `SendStreamingMessage` or `SubscribeToTask` operations **MUST** return [`UnsupportedOperationError`](#332-error-handling).
- **Extended Agent Card**: If `AgentCard.capabilities.extendedAgentCard` is `false` or not present, attempts to call the Get Extended Agent Card operation **MUST** return [`UnsupportedOperationError`](#332-error-handling). If the agent declares support but has not configured an extended card, it **MUST** return [`ExtendedAgentCardNotConfiguredError`](#332-error-handling).
- **Extensions**: When a server requests use of an extension marked as `required: true` in the Agent Card but the client does not declare support for it, the agent **MUST** return [`ExtensionSupportRequiredError`](#332-error-handling).

Clients **SHOULD** validate capability support by examining the Agent Card before attempting operations that require optional capabilities.

### 3.4. Multi-Turn Interactions

The A2A protocol supports multi-turn conversations through context identifiers and task references, enabling agents to maintain conversational continuity across multiple interactions.

#### 3.4.1. Context Identifier Semantics

A `contextId` is an identifier that logically groups multiple related [`Task`](#411-task) and [`Message`](#414-message) objects, providing continuity across a series of interactions.

**Generation and Assignment:**

- Agents **MAY** generate a new `contextId` when processing a [`Message`](#414-message) that does not include a `contextId` field
- If an agent generates a new `contextId`, it **MUST** be included in the response (either [`Task`](#411-task) or [`Message`](#414-message))
- Agents **MAY** accept and preserve client-provided `contextId` values
- If an agent cannot accept a client-provided `contextId`, it **MUST** reject the request with an error and **MUST NOT** generate a new `contextId` for the response
- Clients **SHOULD NOT** provide a client-generated `contextId` to a server unless they understand how the server will process that `contextId`
- Server-generated `contextId` values **SHOULD** be treated as opaque identifiers by clients

**Grouping and Scope:**

- A `contextId` logically groups multiple [`Task`](#411-task) objects and [`Message`](#414-message) objects that are part of the same conversational context
- All tasks and messages with the same `contextId` **SHOULD** be treated as part of the same conversational session
- Agents **MAY** use the `contextId` to maintain internal state, conversational history, or LLM context across multiple interactions
- Agents **MAY** implement context expiration or cleanup policies and **SHOULD** document any such policies

#### 3.4.2. Task Identifier Semantics

A `taskId` is a unique identifier for a [`Task`](#411-task) object, representing a stateful unit of work with a defined lifecycle.

**Generation and Assignment:**

- Task IDs are **server-generated** when a new task is created in response to a [`Message`](#414-message)
- Agents **MUST** generate a unique `taskId` for each new task they create
- The generated `taskId` **MUST** be included in the [`Task`](#411-task) object returned to the client
- When a client includes a `taskId` in a [`Message`](#414-message), it **MUST** reference an existing task
- Agents **MUST** return a [`TaskNotFoundError`](#332-error-handling) if the provided `taskId` does not correspond to an existing task
- Client-provided `taskId` values for creating new tasks is **NOT** supported

#### 3.4.3. Multi-Turn Conversation Patterns

The A2A protocol supports several patterns for multi-turn interactions:

**Context Continuity:**

- [`Task`](#411-task) objects maintain conversation context through the `contextId` field
- Clients **MAY** include the `contextId` in subsequent messages to indicate continuation of a previous interaction
- Clients **MAY** use `taskId` (with or without `contextId`) to continue or refine a specific task
- Clients **MAY** use `contextId` without `taskId` to start a new task within an existing conversation context
- Agents **MUST** infer `contextId` from the task if only `taskId` is provided
- Agents **MUST** reject messages containing mismatching `contextId` and `taskId` (i.e., the provided `contextId` is different from that of the referenced [`Task`](#411-task)).

**Input Required State:**

- Agents can request additional input mid-processing by transitioning a task to the `input-required` state
- The client continues the interaction by sending a new message with the same `taskId` and `contextId`

**Follow-up Messages:**

- Clients can send additional messages with `taskId` references to continue or refine existing tasks
- Clients **SHOULD** use the `referenceTaskIds` field in [`Message`](#414-message) to explicitly reference related tasks
- Agents **SHOULD** use referenced tasks to understand the context and intent of follow-up requests

**Context Inheritance:**

- New tasks created within the same `contextId` can inherit context from previous interactions
- Agents **SHOULD** leverage the shared `contextId` to provide contextually relevant responses

### 3.5. Task Update Delivery Mechanisms

The A2A protocol provides three complementary mechanisms for clients to receive updates about task progress and completion.

#### 3.5.1. Overview of Update Mechanisms

**Polling (Get Task):**

- Client periodically calls Get Task ([Section 3.1.3](#313-get-task)) to check task status
- Simple to implement, works with all protocol bindings
- Higher latency, potential for unnecessary requests
- Best for: Simple integrations, infrequent updates, clients behind restrictive firewalls

**Streaming:**

- Real-time delivery of events as they occur
- Operations: Send Streaming Message ([Section 3.1.2](#312-send-streaming-message)) and Subscribe to Task ([Section 3.1.6](#316-subscribe-to-task))
- Low latency, efficient for frequent updates
- Requires persistent connection support
- Best for: Interactive applications, real-time dashboards, live progress monitoring
- Requires `AgentCard.capabilities.streaming` to be `true`

**Push Notifications (WebHooks):**

- Agent sends HTTP POST requests to client-registered endpoints when task state changes
- Client does not maintain persistent connection
- Asynchronous delivery, client must be reachable via HTTP
- Best for: Server-to-server integrations, long-running tasks, event-driven architectures
- Operations: Create ([Section 3.1.7](#317-create-push-notification-config)), Get ([Section 3.1.8](#76-taskspushnotificationconfigget)), List ([Section 3.1.9](#319-list-push-notification-configs)), Delete ([Section 3.1.10](#3110-delete-push-notification-config))
- Event types: TaskStatusUpdateEvent ([Section 4.2.1](#421-taskstatusupdateevent)), TaskArtifactUpdateEvent ([Section 4.2.2](#422-taskartifactupdateevent)), WebHook payloads ([Section 4.3](#43-push-notification-objects))
- Requires `AgentCard.capabilities.pushNotifications` to be `true`
- Regardless of the protocol binding being used by the agent, WebHook calls use plain HTTP and the JSON payloads as defined in the HTTP protocol binding

#### 3.5.2. Streaming Event Delivery

**Event Ordering:**

All implementations MUST deliver events in the order they were generated. Events MUST NOT be reordered during transmission, regardless of protocol binding.

**Multiple Streams Per Task:**

An agent MAY serve multiple concurrent streams to one or more clients for the same task. This allows multiple clients (or the same client with multiple connections) to independently subscribe to and receive updates about a task's progress.

When multiple streams are active for a task:

- Events MUST be broadcast to all active streams for that task
- Each stream MUST receive the same events in the same order
- Closing one stream MUST NOT affect other active streams for the same task
- The task lifecycle is independent of any individual stream's lifecycle

This capability enables scenarios such as:

- Multiple team members monitoring the same long-running task
- A client reconnecting to a task after a network interruption by opening a new stream
- Different applications or dashboards displaying real-time updates for the same task

#### 3.5.3. Push Notification Delivery

Push notifications are delivered via HTTP POST to client-registered webhook endpoints. The delivery semantics and reliability guarantees are defined in [Section 4.3](#43-push-notification-objects).

### 3.6 Versioning

The specific version of the A2A protocol in use is identified using the `Major.Minor` elements (e.g. `1.0`) of the corresponding A2A specification version. Patch version numbers used by the specification, do not affect protocol compatibility. Patch version numbers SHOULD NOT be used in requests, responses and Agent Cards, and MUST not be considered when clients and servers negotiate protocol versions.

#### 3.6.1 Client Responsibilities

Clients MUST send the `A2A-Version` header with each request to maintain compatibility after an agent upgrades to a new version of the protocol (except for 0.3 Clients - 0.3 will be assumed for empty header). Sending the `A2A-Version` header also provides visibility to agents about version usage in the ecosystem, which can help inform the risks of inplace version upgrades.

**Example of HTTP GET Request with Version Header:**

```http
GET /tasks/task-123 HTTP/1.1
Host: agent.example.com
A2A-Version: 1.0
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
```

Clients MAY provide the `A2A-Version` as a request parameter instead of a header.

**Example of HTTP GET Request with Version request parameter:**

```http
GET /tasks/task-123?A2A-Version=1.0 HTTP/1.1
Host: agent.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
```

#### 3.6.2 Server Responsibilities

Agents MUST process requests using the semantics of the requested `A2A-Version` (matching `Major.Minor`). If the version is not supported by the interface, agents MUST return a [`VersionNotSupportedError`](#332-error-handling).

Agents MUST interpret empty value as 0.3 version.

Agents CAN expose multiple interfaces for the same transport with different versions under the same or different URLs.

#### 3.6.3 Tooling support

Tooling libraries and SDKs that implement the A2A protocol MUST provide mechanisms to help clients manage protocol versioning, such as negotiation of the transport and protocol version used. Client Agents that require the latest features of the protocol should be configured to request specific versions and avoid automatic fallback to older versions, to prevent silently losing functionality.

### 3.7 Messages and Artifacts

Messages and Artifacts serve distinct purposes within the A2A protocol. The core interaction model defined by A2A is for clients to send messages to initiate a task that produces one or more artifacts.

Messages play several key roles:

- **Task Initiation**: Clients send Messages to agents to initiate new tasks.
- **Clarification Messages**: Agents may send Messages back to the client to request clarification prior to initiating a task.
- **Status Messages**: Agents attach Messages to status update events to inform clients about task progress, request additional input, or provide informational updates.
- **Task Interaction**: Clients send Messages to provide additional input or instructions for ongoing tasks.

Messages SHOULD NOT be used to deliver task outputs. Results SHOULD BE returned using Artifacts associated with a Task. This separation allows for a clear distinction between communication (Messages) and data output (Artifacts).

The Task History field contains Messages exchanged during task execution. However, not all Messages are guaranteed to be persisted in the Task history; for example, transient informational messages may not be stored. Messages exchanged prior to task creation may not be stored in Task history. The agent is responsible to determine which Messages are persisted in the Task History.

Clients using streaming to retrieve task updates MAY not receive all status update messages if the client is disconnected and then reconnects. Messages MUST NOT be considered a reliable delivery mechanism for critical information.

Agents MAY choose to persist all Messages that contain important information in the Task history to ensure clients can retrieve it later. However, clients MUST NOT rely on this behavior unless negotiated out-of-band.

## 4. Protocol Data Model

The A2A protocol defines a canonical data model using Protocol Buffers. All protocol bindings **MUST** provide functionally equivalent representations of these data structures.

### 4.1. Core Objects

<a id="Task"></a>

#### 4.1.1. Task

{{ proto_to_table("Task") }}

<a id="TaskStatus"></a>

#### 4.1.2. TaskStatus

{{ proto_to_table("TaskStatus") }}

<a id="TaskState"></a>

#### 4.1.3. TaskState

{{ proto_enum_to_table("TaskState") }}

<a id="Message"></a>

#### 4.1.4. Message

{{ proto_to_table("Message") }}

<a id="Role"></a>

#### 4.1.5. Role

{{ proto_enum_to_table("Role") }}

<a id="Part"></a>

#### 4.1.6. Part

{{ proto_to_table("Part") }}

<a id="Artifact"></a>

#### 4.1.7. Artifact

{{ proto_to_table("Artifact") }}

### 4.2. Streaming Events

<a id="TaskStatusUpdateEvent"></a>

#### 4.2.1. TaskStatusUpdateEvent

{{ proto_to_table("TaskStatusUpdateEvent") }}

<a id="TaskArtifactUpdateEvent"></a>

#### 4.2.2. TaskArtifactUpdateEvent

{{ proto_to_table("TaskArtifactUpdateEvent") }}

### 4.3. Push Notification Objects

<a id="PushNotificationConfig"></a>

#### 4.3.1. PushNotificationConfig

{{ proto_to_table("PushNotificationConfig") }}

<a id="PushNotificationAuthenticationInfo"></a>

#### 4.3.2. AuthenticationInfo

{{ proto_to_table("AuthenticationInfo") }}

#### 4.3.3. Push Notification Payload

When a task update occurs, the agent sends an HTTP POST request to the configured webhook URL. The payload uses the same [`StreamResponse`](#323-stream-response) format as streaming operations, allowing push notifications to deliver the same event types as real-time streams.

**Request Format:**

```http
POST {webhook_url}
Authorization: {authentication_scheme} {credentials}
Content-Type: application/a2a+json

{
  /* StreamResponse object - one of: */
  "task": { /* Task object */ },
  "message": { /* Message object */ },
  "statusUpdate": { /* TaskStatusUpdateEvent object */ },
  "artifactUpdate": { /* TaskArtifactUpdateEvent object */ }
}
```

**Payload Structure:**

The webhook payload is a [`StreamResponse`](#323-stream-response) object containing exactly one of the following:

- **task**: A [`Task`](#411-task) object with the current task state
- **message**: A [`Message`](#414-message) object containing a message response
- **statusUpdate**: A [`TaskStatusUpdateEvent`](#421-taskstatusupdateevent) indicating a status change
- **artifactUpdate**: A [`TaskArtifactUpdateEvent`](#422-taskartifactupdateevent) indicating artifact updates

**Authentication:**

The agent MUST include authentication credentials in the request headers as specified in the [`PushNotificationConfig.authentication`](#432-authenticationinfo) field. The format follows standard HTTP authentication patterns (Bearer tokens, Basic auth, etc.).

**Client Responsibilities:**

- Clients MUST respond with HTTP 2xx status codes to acknowledge successful receipt
- Clients SHOULD process notifications idempotently, as duplicate deliveries may occur
- Clients MUST validate the task ID matches an expected task
- Clients SHOULD implement appropriate security measures to verify the notification source

**Server Guarantees:**

- Agents MUST attempt delivery at least once for each configured webhook
- Agents MAY implement retry logic with exponential backoff for failed deliveries
- Agents SHOULD include a reasonable timeout for webhook requests (recommended: 10-30 seconds)
- Agents MAY stop attempting delivery after a configured number of consecutive failures

For detailed security guidance on push notifications, see [Section 13.2 Push Notification Security](#132-push-notification-security).

### 4.4. Agent Discovery Objects

<a id="AgentCard"></a>

#### 4.4.1. AgentCard

{{ proto_to_table("AgentCard") }}

<a id="AgentProvider"></a>

#### 4.4.2. AgentProvider

{{ proto_to_table("AgentProvider") }}

<a id="AgentCapabilities"></a>

#### 4.4.3. AgentCapabilities

{{ proto_to_table("AgentCapabilities") }}

<a id="AgentExtension"></a>

#### 4.4.4. AgentExtension

{{ proto_to_table("AgentExtension") }}

<a id="AgentSkill"></a>

#### 4.4.5. AgentSkill

{{ proto_to_table("AgentSkill") }}

<a id="AgentInterface"></a>

#### 4.4.6. AgentInterface

{{ proto_to_table("AgentInterface") }}

<a id="AgentCardSignature"></a>

#### 4.4.7. AgentCardSignature

{{ proto_to_table("AgentCardSignature") }}

### 4.5. Security Objects

<a id="Security"></a>
<a id="SecurityScheme"></a>

#### 4.5.1. SecurityScheme

{{ proto_to_table("SecurityScheme") }}

<a id="APIKeySecurityScheme"></a>

#### 4.5.2. APIKeySecurityScheme

{{ proto_to_table("APIKeySecurityScheme") }}

<a id="HTTPAuthSecurityScheme"></a>

#### 4.5.3. HTTPAuthSecurityScheme

{{ proto_to_table("HTTPAuthSecurityScheme") }}

<a id="OAuth2SecurityScheme"></a>

#### 4.5.4. OAuth2SecurityScheme

{{ proto_to_table("OAuth2SecurityScheme") }}

<a id="OpenIdConnectSecurityScheme"></a>

#### 4.5.5. OpenIdConnectSecurityScheme

{{ proto_to_table("OpenIdConnectSecurityScheme") }}

<a id="MutualTlsSecurityScheme"></a>

#### 4.5.6. MutualTlsSecurityScheme

{{ proto_to_table("MutualTlsSecurityScheme") }}

<a id="OAuthFlows"></a>

#### 4.5.7. OAuthFlows

{{ proto_to_table("OAuthFlows") }}

<a id="AuthorizationCodeOAuthFlow"></a>

#### 4.5.8. AuthorizationCodeOAuthFlow

{{ proto_to_table("AuthorizationCodeOAuthFlow") }}

<a id="ClientCredentialsOAuthFlow"></a>

#### 4.5.9. ClientCredentialsOAuthFlow

{{ proto_to_table("ClientCredentialsOAuthFlow") }}

<a id="DeviceCodeOAuthFlow"></a>

#### 4.5.10. DeviceCodeOAuthFlow

{{ proto_to_table("DeviceCodeOAuthFlow") }}

### 4.6. Extensions

The A2A protocol supports extensions to provide additional functionality or data beyond the core specification while maintaining backward compatibility and interoperability. Extensions allow agents to declare additional capabilities such as protocol enhancements or vendor-specific features, maintain compatibility with clients that don't support specific extensions, enable innovation through experimental or domain-specific features without modifying the core protocol, and facilitate standardization by providing a pathway for community-developed features to become part of the core specification.

#### 4.6.1. Extension Declaration

Agents declare their supported extensions in the [`AgentCard`](#441-agentcard) using the `extensions` field, which contains an array of [`AgentExtension`](#444-agentextension) objects.

*Example: Agent declaring extension support in AgentCard:*

```json
{
  "name": "Research Assistant Agent",
  "description": "AI agent for academic research and fact-checking",
  "supportedInterfaces": [
    {
      "url": "https://research-agent.example.com/a2a/v1",
      "protocolBinding": "HTTP+JSON",
      "protocolVersion": "0.3",
    }
  ],
  "capabilities": {
    "streaming": false,
    "pushNotifications": false,
    "extensions": [
      {
        "uri": "https://standards.org/extensions/citations/v1",
        "description": "Provides citation formatting and source verification",
        "required": false
      },
      {
        "uri": "https://example.com/extensions/geolocation/v1",
        "description": "Location-based search capabilities",
        "required": false
      }
    ]
  },
  "defaultInputModes": ["text/plain"],
  "defaultOutputModes": ["text/plain"],
  "skills": [
    {
      "id": "academic-research",
      "name": "Academic Research Assistant",
      "description": "Provides research assistance with citations and source verification",
      "tags": ["research", "citations", "academic"],
      "examples": ["Find peer-reviewed articles on climate change"],
      "inputModes": ["text/plain"],
      "outputModes": ["text/plain"]
    }
  ]
}
```

Clients indicate their desire to opt into the use of specific extensions through binding-specific mechanisms such as HTTP headers, gRPC metadata, or JSON-RPC request parameters that identify the extension identifiers they wish to utilize during the interaction.

*Example: HTTP client opting into extensions using headers:*

```http
POST /message:send HTTP/1.1
Host: agent.example.com
Content-Type: application/a2a+json
Authorization: Bearer token
A2A-Extensions: https://example.com/extensions/geolocation/v1,https://standards.org/extensions/citations/v1

{
  "message": {
    "role": "ROLE_USER",
    "parts": [{"text": "Find restaurants near me"}],
    "extensions": ["https://example.com/extensions/geolocation/v1"],
    "metadata": {
      "https://example.com/extensions/geolocation/v1": {
        "latitude": 37.7749,
        "longitude": -122.4194
      }
    }
  }
}
```

#### 4.6.2. Extensions Points

Extensions can be integrated into the A2A protocol at several well-defined extension points:

**Message Extensions:**

Messages can be extended to allow clients to provide additional strongly typed context or parameters relevant to the message being sent, or TaskStatus Messages to include extra information about the task's progress.

*Example: A location extension using the extensions and metadata arrays:*

```json
{
  "role": "ROLE_USER",
  "parts": [
    {"text": "Find restaurants near me"}
  ],
  "extensions": ["https://example.com/extensions/geolocation/v1"],
  "metadata": {
    "https://example.com/extensions/geolocation/v1": {
      "latitude": 37.7749,
      "longitude": -122.4194,
      "accuracy": 10.0,
      "timestamp": "2025-10-21T14:30:00Z"
    }
  }
}
```

**Artifact Extensions:**

Artifacts can include extension data to provide strongly typed context or metadata about the generated content.

*Example: An artifact with citation extension for research sources:*

```json
{
  "artifactId": "research-summary-001",
  "name": "Climate Change Summary",
  "parts": [
    {
      "text": "Global temperatures have risen by 1.1°C since pre-industrial times, with significant impacts on weather patterns and sea levels."
    }
  ],
  "extensions": ["https://standards.org/extensions/citations/v1"],
  "metadata": {
    "https://standards.org/extensions/citations/v1": {
      "sources": [
        {
          "title": "Global Temperature Anomalies - 2023 Report",
          "authors": ["Smith, J.", "Johnson, M."],
          "url": "https://climate.gov/reports/2023-temperature",
          "accessDate": "2025-10-21",
          "relevantText": "Global temperatures have risen by 1.1°C"
        }
      ]
    }
  }
}
```

#### 4.6.3. Extension Versioning and Compatibility

Extensions **SHOULD** include version information in their URI identifier. This allows clients and agents to negotiate compatible versions of extensions during interactions. A new URI **MUST** be created for breaking changes to an extension.

If a client requests a versions of an extension that the agent does not support, the agent **SHOULD** ignore the extension for that interaction and proceed without it, unless the extension is marked as `required` in the AgentCard, in which case the agent **MUST** return an error indicating unsupported extension. It **MUST NOT** fall back to a previous version of the extension automatically.

## 5. Protocol Binding Requirements and Interoperability

### 5.1. Functional Equivalence Requirements

When an agent supports multiple protocols, all supported protocols **MUST**:

- **Identical Functionality**: Provide the same set of operations and capabilities
- **Consistent Behavior**: Return semantically equivalent results for the same requests
- **Same Error Handling**: Map errors consistently using appropriate protocol-specific codes
- **Equivalent Authentication**: Support the same authentication schemes declared in the AgentCard

### 5.2. Protocol Selection and Negotiation

- **Agent Declaration**: Agents **MUST** declare all supported protocols in their AgentCard
- **Client Choice**: Clients **MAY** choose any protocol declared by the agent
- **Fallback Behavior**: Clients **SHOULD** implement fallback logic for alternative protocols

### 5.3. Method Mapping Reference

| Functionality                   | JSON-RPC Method                    | gRPC Method                        | REST Endpoint                                           |
| :------------------------------ | :--------------------------------- | :--------------------------------- | :------------------------------------------------------ |
| Send message                    | `SendMessage`                      | `SendMessage`                      | `POST /message:send`                                    |
| Send streaming message          | `SendStreamingMessage`             | `SendStreamingMessage`             | `POST /message:stream`                                  |
| Get task                        | `GetTask`                          | `GetTask`                          | `GET /tasks/{id}`                                       |
| List tasks                      | `ListTasks`                        | `ListTasks`                        | `GET /tasks`                                            |
| Cancel task                     | `CancelTask`                       | `CancelTask`                       | `POST /tasks/{id}:cancel`                               |
| Subscribe to task               | `SubscribeToTask`                  | `SubscribeToTask`                  | `POST /tasks/{id}:subscribe`                            |
| Create push notification config | `CreateTaskPushNotificationConfig` | `CreateTaskPushNotificationConfig` | `POST /tasks/{id}/pushNotificationConfigs`              |
| Get push notification config    | `GetTaskPushNotificationConfig`    | `GetTaskPushNotificationConfig`    | `GET /tasks/{id}/pushNotificationConfigs/{configId}`    |
| List push notification configs  | `ListTaskPushNotificationConfigs`  | `ListTaskPushNotificationConfigs`  | `GET /tasks/{id}/pushNotificationConfigs`               |
| Delete push notification config | `DeleteTaskPushNotificationConfig` | `DeleteTaskPushNotificationConfig` | `DELETE /tasks/{id}/pushNotificationConfigs/{configId}` |
| Get extended Agent Card         | `GetExtendedAgentCard`             | `GetExtendedAgentCard`             | `GET /extendedAgentCard`                                |

### 5.4. Error Code Mappings

All A2A-specific errors defined in [Section 3.3.2](#332-error-handling) **MUST** be mapped to binding-specific error representations. The following table provides the canonical mappings for each standard protocol binding:

| A2A Error Type                        | JSON-RPC Code | gRPC Status           | HTTP Status                 |
| :------------------------------------ | :------------ | :-------------------- | :-------------------------- |
| `TaskNotFoundError`                   | `-32001`      | `NOT_FOUND`           | `404 Not Found`             |
| `TaskNotCancelableError`              | `-32002`      | `FAILED_PRECONDITION` | `400 Bad Request`           |
| `PushNotificationNotSupportedError`   | `-32003`      | `FAILED_PRECONDITION` | `400 Bad Request`           |
| `UnsupportedOperationError`           | `-32004`      | `FAILED_PRECONDITION` | `400 Bad Request`           |
| `ContentTypeNotSupportedError`        | `-32005`      | `INVALID_ARGUMENT`    | `400 Bad Request`           |
| `InvalidAgentResponseError`           | `-32006`      | `INTERNAL`            | `500 Internal Server Error` |
| `ExtendedAgentCardNotConfiguredError` | `-32007`      | `FAILED_PRECONDITION` | `400 Bad Request`           |
| `ExtensionSupportRequiredError`       | `-32008`      | `FAILED_PRECONDITION` | `400 Bad Request`           |
| `VersionNotSupportedError`            | `-32009`      | `FAILED_PRECONDITION` | `400 Bad Request`           |

**Custom Binding Requirements:**

Custom protocol bindings **MUST** define equivalent error code mappings that preserve the semantic meaning of each A2A error type. The binding specification **SHOULD** provide a similar mapping table showing how each A2A error type is represented in the custom binding's native error format.

For binding-specific error structures and examples, see:

- [JSON-RPC Error Handling](#95-error-handling)
- [gRPC Error Handling](#106-error-handling)
- [HTTP/REST Error Handling](#116-error-handling)

### 5.5. JSON Field Naming Convention

All JSON serializations of the A2A protocol data model **MUST** use **camelCase** naming for field names, not the snake_case convention used in Protocol Buffer definitions.

**Naming Convention:**

- Protocol Buffer field: `protocol_version` → JSON field: `protocolVersion`
- Protocol Buffer field: `context_id` → JSON field: `contextId`
- Protocol Buffer field: `default_input_modes` → JSON field: `defaultInputModes`
- Protocol Buffer field: `push_notification_config` → JSON field: `pushNotificationConfig`

**Enum Values:**

- Enum values **MUST** be represented according to the [ProtoJSON specification](https://protobuf.dev/programming-guides/json/), which serializes enums as their string names **as defined in the Protocol Buffer definition** (typically SCREAMING_SNAKE_CASE).

**Examples:**

- Protocol Buffer enum: `TASK_STATE_INPUT_REQUIRED` → JSON value: `"TASK_STATE_INPUT_REQUIRED"`
- Protocol Buffer enum: `ROLE_USER` → JSON value: `"ROLE_USER"`

**Note:** This follows the ProtoJSON specification as adopted in [ADR-001](../adrs/adr-001-protojson-serialization.md).

### 5.6. Data Type Conventions

This section documents conventions for common data types used throughout the A2A protocol, particularly as they apply to protocol bindings.

#### 5.6.1. Timestamps

The A2A protocol uses [`google.protobuf.Timestamp`](https://protobuf.dev/reference/protobuf/google.protobuf/#timestamp) for all timestamp fields in the Protocol Buffer definitions. When serialized to JSON (in JSON-RPC, HTTP/REST, or other JSON-based bindings), these timestamps **MUST** be represented as ISO 8601 formatted strings in UTC timezone.

**Format Requirements:**

- **Format:** ISO 8601 combined date and time representation
- **Timezone:** UTC (denoted by 'Z' suffix)
- **Precision:** Millisecond precision **SHOULD** be used where available
- **Pattern:** `YYYY-MM-DDTHH:mm:ss.sssZ`

**Examples:**

```json
{
  "timestamp": "2025-10-28T10:30:00.000Z",
  "createdAt": "2025-10-28T14:25:33.142Z",
  "lastModified": "2025-10-31T17:45:22.891Z"
}
```

**Implementation Notes:**

- Protocol Buffer's `google.protobuf.Timestamp` represents time as seconds since Unix epoch (January 1, 1970, 00:00:00 UTC) plus nanoseconds
- JSON serialization automatically converts this to ISO 8601 format when using standard Protocol Buffer JSON encoding
- Clients and servers **MUST** parse and generate ISO 8601 timestamps correctly
- When millisecond precision is not available, the fractional seconds portion **MAY** be omitted or zero-filled
- Timestamps **MUST NOT** include timezone offsets other than 'Z' (all times are UTC)

### 5.7. Field Presence and Optionality

The Protocol Buffer definition in `specification/a2a.proto` uses [`google.api.field_behavior`](https://github.com/googleapis/googleapis/blob/master/google/api/field_behavior.proto) annotations to indicate whether fields are `REQUIRED`. These annotations serve as both documentation and validation hints for implementations.

**Required Fields:**

Fields marked with `[(google.api.field_behavior) = REQUIRED]` indicate that the field **MUST** be present and set in valid messages. Implementations **SHOULD** validate these requirements and reject messages with missing required fields. Arrays marked as required **MUST** contain at least one element.

**Optional Field Presence:**

The Protocol Buffer `optional` keyword is used to distinguish between a field being explicitly set versus omitted. This distinction is critical for two scenarios:

1. **Explicit Default Values:** Some fields in the specification define default values that differ from Protocol Buffer's implicit defaults. Implementations should apply the default value when the field is not explicitly provided.

2. **Agent Card Canonicalization:** When creating cryptographic signatures of Agent Cards, it is required to produce a canonical JSON representation. The `optional` keyword enables implementations to distinguish between fields that were explicitly set (and should be included in the canonical form) versus fields that were omitted (and should be excluded from canonicalization). This ensures Agent Cards can be reconstructed to accurately match their signature.

**Unrecognized Fields:**

Implementations **SHOULD** ignore unrecognized fields in messages, allowing for forward compatibility as the protocol evolves.

### 5.8. Custom Binding Identification

Custom protocol bindings **SHOULD** be identified by a URI. Using a URI as the
identifier provides globally unique identification across all implementers.

The `protocolBinding` field in the Agent Card's `supportedInterfaces` entry
**SHOULD** be a URI:

```json
{
  "supportedInterfaces": [
    {
      "url": "wss://agent.example.com/a2a/websocket",
      "protocolBinding": "https://example.com/bindings/websocket/v1",
      "protocolVersion": "1.0"
    }
  ]
}
```

When a breaking change is introduced to a binding, a new URI **MUST** be used
so that clients can distinguish between incompatible versions:

```text
https://example.com/bindings/websocket/v1  →  https://example.com/bindings/websocket/v2
```

## 6. Common Workflows & Examples

This section provides illustrative examples of common A2A interactions across different bindings.

### 6.1. Basic Task Execution

**Scenario:** Client asks a question and receives a completed task response.

**Request:**

```http
POST /message:send HTTP/1.1
Host: agent.example.com
Content-Type: application/a2a+json
Authorization: Bearer token

{
  "message": {
    "role": "ROLE_USER",
    "parts": [{"text": "What is the weather today?"}],
    "messageId": "msg-uuid"
  }
}
```

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/a2a+json

{
  "task": {
    "id": "task-uuid",
    "contextId": "context-uuid",
    "status": {"state": "TASK_STATE_COMPLETED"},
    "artifacts": [{
      "artifactId": "artifact-uuid",
      "name": "Weather Report",
      "parts": [{"text": "Today will be sunny with a high of 75°F"}]
    }]
  }
}
```

### 6.2. Streaming Task Execution

**Scenario:** Client requests a long-running task with real-time updates.

**Request:**

```http
POST /message:stream HTTP/1.1
Host: agent.example.com
Content-Type: application/a2a+json
Authorization: Bearer token

{
  "message": {
    "role": "ROLE_USER",
    "parts": [{"text": "Write a detailed report on climate change"}],
    "messageId": "msg-uuid"
  }
}
```

**SSE Response Stream:**

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream

data: {"task": {"id": "task-uuid", "status": {"state": "TASK_STATE_WORKING"}}}

data: {"artifactUpdate": {"taskId": "task-uuid", "artifact": {"parts": [{"text": "# Climate Change Report\n\n"}]}}}

data: {"statusUpdate": {"taskId": "task-uuid", "status": {"state": "TASK_STATE_COMPLETED"}}}
```

### 6.3. Multi-Turn Interaction

**Scenario:** Agent requires additional input to complete a task.

**Initial Request:**

```http
POST /message:send HTTP/1.1
Host: agent.example.com
Content-Type: application/a2a+json
Authorization: Bearer token

{
  "message": {
    "role": "ROLE_USER",
    "parts": [{"text": "Book me a flight"}],
    "messageId": "msg-1"
  }
}
```

**Response (Input Required):**

```http
HTTP/1.1 200 OK
Content-Type: application/a2a+json

{
  "task": {
    "id": "task-uuid",
    "status": {
      "state": "TASK_STATE_INPUT_REQUIRED",
      "message": {
        "role": "ROLE_AGENT",
        "parts": [{"text": "I need more details. Where would you like to fly from and to?"}]
      }
    }
  }
}
```

**Follow-up Request:**

```http
POST /message:send HTTP/1.1
Host: agent.example.com
Content-Type: application/a2a+json
Authorization: Bearer token

{
  "message": {
    "taskId": "task-uuid",
    "role": "ROLE_USER",
    "parts": [{"text": "From San Francisco to New York"}],
    "messageId": "msg-2"
  }
}
```

### 6.4. Version Negotiation Error

**Scenario:** Client requests an unsupported protocol version.

**Request:**

```http
POST /message:send HTTP/1.1
Host: agent.example.com
Content-Type: application/a2a+json
Authorization: Bearer token
A2A-Version: 0.5

{
  "message": {
    "role": "ROLE_USER",
    "parts": [{"text": "Hello"}],
    "messageId": "msg-uuid"
  }
}
```

**Response:**

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://a2a-protocol.org/errors/version-not-supported",
  "title": "Protocol Version Not Supported",
  "status": 400,
  "detail": "The requested A2A protocol version 0.5 is not supported by this agent",
  "supportedVersions": ["0.3"]
}
```

### 6.5. Task Listing and Management

**Scenario:** Client wants to see all tasks from a specific context or all tasks with a particular status.

#### Request: All tasks from a specific context

**Request:**

```http
GET /tasks?contextId=c295ea44-7543-4f78-b524-7a38915ad6e4&pageSize=10&historyLength=3 HTTP/1.1
Host: agent.example.com
Authorization: Bearer token
```

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/a2a+json

{
  "tasks": [
    {
      "id": "3f36680c-7f37-4a5f-945e-d78981fafd36",
      "contextId": "c295ea44-7543-4f78-b524-7a38915ad6e4",
      "status": {
        "state": "TASK_STATE_COMPLETED",
        "timestamp": "2024-03-15T10:15:00Z"
      }
    }
  ],
  "totalSize": 5,
  "pageSize": 10,
  "nextPageToken": ""
}
```

#### Request: All working tasks across all contexts

**Request:**

```http
GET /tasks?status=TASK_STATE_WORKING&pageSize=20 HTTP/1.1
Host: agent.example.com
Authorization: Bearer token
```

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/a2a+json

{
  "tasks": [
    {
      "id": "789abc-def0-1234-5678-9abcdef01234",
      "contextId": "another-context-id",
      "status": {
        "state": "TASK_STATE_WORKING",
        "message": {
          "role": "ROLE_AGENT",
          "parts": [
            {
              "text": "Processing your document analysis..."
            }
          ],
          "messageId": "msg-status-update"
        },
        "timestamp": "2024-03-15T10:20:00Z"
      }
    }
  ],
  "totalSize": 1,
  "pageSize": 20,
  "nextPageToken": ""
}
```

#### Pagination Example

**Request:**

```http
GET /tasks?contextId=c295ea44-7543-4f78-b524-7a38915ad6e4&pageSize=10&pageToken=base64-encoded-cursor-token HTTP/1.1
Host: agent.example.com
Authorization: Bearer token
```

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/a2a+json

{
  "tasks": [
    /* ... additional tasks */
  ],
  "totalSize": 15,
  "pageSize": 10,
  "nextPageToken": "base64-encoded-next-cursor-token"
}
```

#### Validation Error Example

**Request:**

```http
GET /tasks?pageSize=150&historyLength=-5&status=TASK_STATE_RUNNING HTTP/1.1
Host: agent.example.com
Authorization: Bearer token
```

**Response:**

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "status": 400,
  "detail": "Invalid parameters",
  "errors": [
    {
      "field": "pageSize",
      "message": "Must be between 1 and 100 inclusive, got 150"
    },
    {
      "field": "historyLength",
      "message": "Must be non-negative integer, got -5"
    },
    {
      "field": "status",
      "message": "Invalid status value 'TASK_STATE_RUNNING'. Must be one of: TASK_STATE_SUBMITTED, TASK_STATE_WORKING, TASK_STATE_COMPLETED, TASK_STATE_FAILED, TASK_STATE_CANCELED, TASK_STATE_REJECTED, TASK_STATE_INPUT_REQUIRED, TASK_STATE_AUTH_REQUIRED"
    }
  ]
}
```

### 6.6. Push Notification Setup and Usage

**Scenario:** Client requests a long-running report generation and wants to be notified via webhook when it's done.

**Initial Request with Push Notification Config:**

```http
POST /message:send HTTP/1.1
Host: agent.example.com
Content-Type: application/a2a+json
Authorization: Bearer token

{
  "message": {
    "role": "ROLE_USER",
    "parts": [
      {
        "text": "Generate the Q1 sales report. This usually takes a while. Notify me when it's ready."
      }
    ],
    "messageId": "6dbc13b5-bd57-4c2b-b503-24e381b6c8d6"
  },
  "configuration": {
    "taskPushNotificationConfig": {
      "url": "https://client.example.com/webhook/a2a-notifications",
      "authentication": {
        "scheme": "Bearer",
        "credentials": "secure-client-token-for-task-aaa"
      }
    }
  }
}
```

**Response (Task Submitted):**

```http
HTTP/1.1 200 OK
Content-Type: application/a2a+json

{
  "task": {
    "id": "43667960-d455-4453-b0cf-1bae4955270d",
    "contextId": "c295ea44-7543-4f78-b524-7a38915ad6e4",
    "status": {
      "state": "TASK_STATE_SUBMITTED",
      "timestamp": "2024-03-15T11:00:00Z"
    }
  }
}
```

**Later: Server POSTs Notification to Webhook:**

```http
POST /webhook/a2a-notifications HTTP/1.1
Host: client.example.com
Authorization: Bearer secure-client-token-for-task-aaa
Content-Type: application/a2a+json

{
  "statusUpdate": {
    "taskId": "43667960-d455-4453-b0cf-1bae4955270d",
    "contextId": "c295ea44-7543-4f78-b524-7a38915ad6e4",
    "status": {
      "state": "TASK_STATE_COMPLETED",
      "timestamp": "2024-03-15T18:30:00Z"
    }
  }
}
```

### 6.7. File Exchange (Upload and Download)

**Scenario:** Client sends an image for analysis, and the agent returns a modified image.

**Request with File Upload:**

```http
POST /message:send HTTP/1.1
Host: agent.example.com
Content-Type: application/a2a+json
Authorization: Bearer token

{
  "message": {
    "role": "ROLE_USER",
    "parts": [
      {
        "text": "Analyze this image and highlight any faces."
      },
      {
        "raw": "iVBORw0KGgoAAAANSUhEUgAAAAUA..."
        "filename": "input_image.png",
        "mediaType": "image/png",
      }
    ],
    "messageId": "6dbc13b5-bd57-4c2b-b503-24e381b6c8d6"
  }
}
```

**Response with File Reference:**

```http
HTTP/1.1 200 OK
Content-Type: application/a2a+json

{
  "task": {
    "id": "43667960-d455-4453-b0cf-1bae4955270d",
    "contextId": "c295ea44-7543-4f78-b524-7a38915ad6e4",
    "status": {
      "state": "TASK_STATE_COMPLETED",
      "timestamp": "2024-03-15T12:05:00Z"
    },
    "artifacts": [
      {
        "artifactId": "9b6934dd-37e3-4eb1-8766-962efaab63a1",
        "name": "processed_image_with_faces.png",
        "parts": [
          {
            "url": "https://storage.example.com/processed/task-bbb/output.png?token=xyz",
            "filename": "output.png",
            "mediaType": "image/png"
          }
        ]
      }
    ]
  }
}
```

### 6.8. Structured Data Exchange

**Scenario:** Client asks for a list of open support tickets in a specific JSON format.

**Request:**

```http
POST /message:send HTTP/1.1
Host: agent.example.com
Content-Type: application/a2a+json
Authorization: Bearer token

{
  "message": {
    "role": "ROLE_USER",
    "parts": [
      {
        "text": "Show me a list of my open IT tickets",
        "metadata": {
          "mediaType": "application/json",
          "schema": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "ticketNumber": { "type": "string" },
                "description": { "type": "string" }
              }
            }
          }
        }
      }
    ],
    "messageId": "85b26db5-ffbb-4278-a5da-a7b09dea1b47"
  }
}
```

**Response with Structured Data:**

```http
HTTP/1.1 200 OK
Content-Type: application/a2a+json

{
  "task": {
    "id": "d8c6243f-5f7a-4f6f-821d-957ce51e856c",
    "contextId": "c295ea44-7543-4f78-b524-7a38915ad6e4",
    "status": {
      "state": "TASK_STATE_COMPLETED",
      "timestamp": "2025-04-17T17:47:09.680794Z"
    },
    "artifacts": [
      {
        "artifactId": "c5e0382f-b57f-4da7-87d8-b85171fad17c",
        "parts": [
          {
            "text": "[{\"ticketNumber\":\"REQ12312\",\"description\":\"request for VPN access\"},{\"ticketNumber\":\"REQ23422\",\"description\":\"Add to DL - team-gcp-onboarding\"}]"
          }
        ]
      }
    ]
  }
}
```

### 6.9. Fetching Authenticated Extended Agent Card

**Scenario:** A client discovers a public Agent Card indicating support for an authenticated extended card and wants to retrieve the full details.

**Step 1: Client fetches the public Agent Card:**

```http
GET /.well-known/agent-card.json HTTP/1.1
Host: example.com
```

**Response includes:**

```json
{
  "capabilities": {
    "extendedAgentCard": true
  },
  "securitySchemes": {
    "google": {
      "openIdConnectSecurityScheme": {
        "openIdConnectUrl": "https://accounts.google.com/.well-known/openid-configuration"
      }
    }
  }
}
```

### Step 2: Client obtains credentials (out-of-band OAuth 2.0 flow)

### Step 3: Client fetches authenticated extended Agent Card

```http
GET /extendedAgentCard HTTP/1.1
Host: agent.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/a2a+json

{
  "name": "Extended Agent with Additional Skills",
  "skills": [
    /* Extended skills available to authenticated users */
  ]
}
```

## 7. Authentication and Authorization

A2A treats agents as standard enterprise applications, relying on established web security practices. Identity information is handled at the protocol layer, not within A2A semantics.

For a comprehensive guide on enterprise security aspects, see [Enterprise-Ready Features](./topics/enterprise-ready.md).

### 7.1. Protocol Security

Production deployments **MUST** use encrypted communication (HTTPS for HTTP-based bindings, TLS for gRPC). Implementations **SHOULD** use modern TLS configurations (TLS 1.3+ recommended) with strong cipher suites.

### 7.2. Server Identity Verification

A2A Clients **SHOULD** verify the A2A Server's identity by validating its TLS certificate against trusted certificate authorities (CAs) during the TLS handshake.

### 7.3. Client Authentication Process

1. **Discovery of Requirements:** The client discovers the server's required authentication schemes via the `securitySchemes` field in the AgentCard.
2. **Credential Acquisition (Out-of-Band):** The client obtains the necessary credentials through an out-of-band process specific to the required authentication scheme.
3. **Credential Transmission:** The client includes these credentials in protocol-appropriate headers or metadata for every A2A request.

### 7.4. Server Authentication Responsibilities

The A2A Server:

- **MUST** authenticate every incoming request based on the provided credentials and its declared authentication requirements.
- **SHOULD** use appropriate binding-specific error codes for authentication challenges or rejections.
- **SHOULD** provide relevant authentication challenge information with error responses.

### 7.5. Server Authorization Responsibilities

Once authenticated, the A2A Server authorizes requests based on the authenticated identity and its own policies. Authorization logic is implementation-specific and **MAY** consider:

- Specific skills requested
- Actions attempted within tasks
- Data access policies
- OAuth scopes (if applicable)

### 7.6. In-Task Authorization

In the course of performing a task, an agent may require authorization to perform some action. Examples include:

- An agent requiring an OAuth access token to call an API or another agent
- An agent requiring human approval before a destructive action is taken

In the sections below, we refer to the object that represents the approved authorization as a credential.

Agents may have multiple means for retrieving this authorization, such as via directly sending messages to a human.

A2A provides the capability for agents to delegate the fulfillment of this authorization to the client via the `TASK_STATE_AUTH_REQUIRED` Task state. This provides agents a fallback path for requesting authorization by passing the responsibility to the client.

#### 7.6.1 In-Task Authorization Agent Responsibilities

To request that a client fulfills an authorization request, the agent:

1. MUST use a Task to track the operation it is performing
2. MUST transition the TaskState to `TASK_STATE_AUTH_REQUIRED`
3. MUST include a TaskStatus message explaining the required authorization, unless the details of the authorization have been negotiated out-of-band or via an extension

Agents MUST arrange to receive credentials via an out-of-band means, unless an in-band mechanism has been negotiated out-of-band or via an extension.

If the credential is received out-of-band, the agent SHOULD maintain any active response streams with the client after setting the TaskState to `TASK_STATE_AUTH_REQUIRED`. The agent MAY immediately continue Task processing after receiving the credential, without a requirement that clients send a follow-up message.

Agents SHOULD support receiving messages directed to the Task while the Task remains in `TASK_STATE_AUTH_REQUIRED`. This enables clients to negotiate, correct, or reject an authorization request.

#### 7.6.2 In-Task Authorization Client Responsibilities

Upon receiving a Task in `TASK_STATE_AUTH_REQUIRED`, a client is expected to take action in some way to resolve the agent's request for authorization.

A client may:

- Send a response message to the Task to negotiate, correct, or reject the authorization request.
- Contact another human, agent, or service to fulfill the authorization request
- Directly fulfill the authorization request via an out-of-band or extension negotiated means

If the client is itself an A2A agent actively processing a Task, the client may further delegate the authorization request to its client by transitioning its own Task to `TASK_STATE_AUTH_REQUIRED`. The client SHOULD follow all [In-Task Authorization Agent Responsibilities](#761-in-task-authorization-agent-responsibilities). This enables forming a chain of Tasks in `TASK_STATE_AUTH_REQUIRED`.

Clients may not be aware of when the agent receives credentials out-of-band and subsequently continues Task processing. If a client does not have an active response stream open with the agent, the client risks missing Task updates. To avoid this, a client SHOULD perform one of the following:

- Subscribe to a stream of events for the Task using the [Subscribe to Task](#316-subscribe-to-task) operation
- Register a webhook to receive events, if supported by the agent, using the [Create Push Notification Config](#317-create-push-notification-config) operation
- Begin polling the Task using the [Get Task](#313-get-task) operation

#### 7.6.3 In-Task Authorization Security Considerations

Agents SHOULD receive credentials for in-task authorization requests out of band via a secure channel, such as HTTPS. This ensures that credentials are provided directly to the agent.

In-band credential exchange may be negotiated via out-of-band means or by using extensions. In-band credential exchange can allow credentials to be passed across chains of multiple A2A agents, exposing those credentials to each agent participating in the chain.

If using in-band credential exchange, we recommend adhering to the following security practices:

- Credentials SHOULD be bound to the agent which originated the request, such that only this agent is able to use the credentials. This ensures that credentials propagating through a chain of A2A requests are only usable by the requesting agent.
- Credentials containing sensitive information SHOULD be only readable by the agent which originated the request, such as by encrypting the credential.

## 8. Agent Discovery: The Agent Card

<span id="5-agent-discovery-the-agent-card"></span>

### 8.1. Purpose

A2A Servers **MUST** make an Agent Card available. The Agent Card describes the server's identity, capabilities, skills, and interaction requirements. Clients use this information for discovering suitable agents and configuring interactions.

For more on discovery strategies, see the [Agent Discovery guide](./topics/agent-discovery.md).

### 8.2. Discovery Mechanisms

Clients can find Agent Cards through:

- **Well-Known URI:** Accessing `https://{server_domain}/.well-known/agent-card.json` (see [Section 8.6](#86-caching) for caching guidance)
- **Registries/Catalogs:** Querying curated catalogs of agents
- **Direct Configuration:** Pre-configured Agent Card URLs or content

### 8.3. Protocol Declaration Requirements

The AgentCard **MUST** properly declare supported protocols:

#### 8.3.1. Supported Interfaces Declaration

- The `supportedInterfaces` field **SHOULD** declare all supported protocol combinations in preference order
- The first entry in `supportedInterfaces` represents the preferred interface
- Each interface **MUST** accurately declare its transport protocol and URL
- URLs **MAY** be reused if multiple transports are available at the same endpoint

#### 8.3.2. Client Protocol Selection

Clients **MUST** follow these rules:

1. Parse `supportedInterfaces` if present, and select the first supported transport
2. Prefer earlier entries in the ordered list when multiple options are supported
3. Use the correct URL for the selected transport
4. Set the `tenant` field in every request message to exactly the value declared in the selected `AgentInterface` entry (omit the field if `tenant` is not set in that entry)

### 8.4. Agent Card Signing

Agent Cards **MAY** be digitally signed using JSON Web Signature (JWS) as defined in [RFC 7515](https://tools.ietf.org/html/rfc7515) to ensure authenticity and integrity. Signatures allow clients to verify that an Agent Card has not been tampered with and originates from the claimed provider.

#### 8.4.1. Canonicalization Requirements

Before signing, the Agent Card content **MUST** be canonicalized using the JSON Canonicalization Scheme (JCS) as defined in [RFC 8785](https://tools.ietf.org/html/rfc8785). This ensures consistent signature generation and verification across different JSON implementations.

**Canonicalization Rules:**

1. **Field Presence and Default Value Handling**: Before canonicalization, the JSON representation **MUST** respect Protocol Buffer field presence semantics as defined in [Section 5.7](#57-field-presence-and-optionality). This ensures that the canonical form accurately reflects which fields were explicitly provided versus which were omitted, enabling signature verification when Agent Cards are reconstructed:
    - **Optional fields not explicitly set**: Fields marked with the `optional` keyword that were not explicitly set **MUST** be omitted from the JSON object
    - **Optional fields explicitly set to defaults**: Fields marked with `optional` that were explicitly set to a value (even if that value matches a default) **MUST** be included in the JSON object
    - **Required fields**: Fields marked with `REQUIRED` **MUST** always be present, even if the field value matches the default.
    - **Default values**: Fields with default values **MUST** be omitted unless the field is marked as `REQUIRED` or has the `optional` keyword.

2. **RFC 8785 Compliance**: The Agent Card JSON **MUST** be canonicalized according to RFC 8785, which specifies:
    - Predictable ordering of object properties (lexicographic by key)
    - Consistent representation of numbers, strings, and other primitive values
    - Removal of insignificant whitespace

3. **Signature Field Exclusion**: The `signatures` field itself **MUST** be excluded from the content being signed to avoid circular dependencies.

**Example of Default Value Removal:**

Original Agent Card fragment:

```json
{
  "name": "Example Agent",
  "description": "",
  "capabilities": {
    "streaming": false,
    "pushNotifications": false,
    "extensions": []
  },
  "skills": []
}
```

Applying the canonicalization rules:

- `name`: "Example Agent" - REQUIRED field → **include**
- `description`: "" - REQUIRED field → **include**
- `capabilities`: object - REQUIRED field → **include** (after processing children)
    - `streaming`: false - optional field, present in JSON (explicitly set) → **include**
    - `pushNotifications`: false - optional field, present in JSON (explicitly set) → **include**
    - `extensions`: [] - repeated field (not REQUIRED) with empty array → **omit**
- `skills`: [] - REQUIRED field → **include**

After applying RFC 8785:

```json
{"capabilities":{"pushNotifications":false,"streaming":false},"description":"","name":"Example Agent","skills":[]}
```

#### 8.4.2. Signature Format

Signatures use the JSON Web Signature (JWS) format as defined in [RFC 7515](https://tools.ietf.org/html/rfc7515). The [`AgentCardSignature`](#447-agentcardsignature) object represents JWS components using three fields:

- **`protected`** (required, string): Base64url-encoded JSON object containing the JWS Protected Header
- **`signature`** (required, string): Base64url-encoded signature value
- **`header`** (optional, object): JWS Unprotected Header as a JSON object (not base64url-encoded)

**JWS Protected Header Parameters:**

The protected header **MUST** include:

- `alg`: Algorithm used for signing (e.g., "ES256", "RS256")
- `typ`: **SHOULD** be set to "JOSE" for JWS
- `kid`: Key ID for identifying the signing key

The protected header **MAY** include:

- `jku`: URL to JSON Web Key Set (JWKS) containing the public key

**Signature Generation Process:**

1. **Prepare the payload:**
    - Remove properties with default values from the Agent Card
    - Exclude the `signatures` field
    - Canonicalize the resulting JSON using RFC 8785 to produce the canonical payload

2. **Create the protected header:**
    - Construct a JSON object with the required header parameters (`alg`, `typ`, `kid`) and any optional parameters (`jku`)
    - Serialize the header to JSON
    - Base64url-encode the serialized header to produce the `protected` field value

3. **Compute the signature:**
    - Construct the JWS Signing Input: `ASCII(BASE64URL(UTF8(JWS Protected Header)) || '.' || BASE64URL(JWS Payload))`
    - Sign the JWS Signing Input using the algorithm specified in the `alg` header parameter and the private key
    - Base64url-encode the resulting signature bytes to produce the `signature` field value

4. **Assemble the AgentCardSignature:**
    - Set `protected` to the base64url-encoded protected header from step 2
    - Set `signature` to the base64url-encoded signature value from step 3
    - Optionally set `header` to a JSON object containing any unprotected header parameters.

**Example:**

Given a canonical Agent Card payload and signing key, the signature generation produces:

```json
{
  "protected": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpPU0UiLCJraWQiOiJrZXktMSIsImprdSI6Imh0dHBzOi8vZXhhbXBsZS5jb20vYWdlbnQvandrcy5qc29uIn0",
  "signature": "QFdkNLNszlGj3z3u0YQGt_T9LixY3qtdQpZmsTdDHDe3fXV9y9-B3m2-XgCpzuhiLt8E0tV6HXoZKHv4GtHgKQ"
}
```

Where the `protected` value decodes to:

```json
{"alg":"ES256","typ":"JOSE","kid":"key-1","jku":"https://example.com/agent/jwks.json"}
```

#### 8.4.3. Signature Verification

Clients verifying Agent Card signatures **MUST**:

1. Extract the signature from the `signatures` array
2. Retrieve the public key using the `kid` and `jku` (or from a trusted key store)
3. Remove properties with default values from the received Agent Card
4. Exclude the `signatures` field
5. Canonicalize the resulting JSON using RFC 8785
6. Verify the signature against the canonicalized payload

**Security Considerations:**

- Clients **SHOULD** verify at least one signature before trusting an Agent Card
- Public keys **SHOULD** be retrieved over secure channels (HTTPS)
- Clients **MAY** maintain a trusted key store for known agent providers
- Expired or revoked keys **MUST NOT** be used for verification
- Multiple signatures **MAY** be present to support key rotation

### 8.5. Sample Agent Card

```json
{
  "name": "GeoSpatial Route Planner Agent",
  "description": "Provides advanced route planning, traffic analysis, and custom map generation services. This agent can calculate optimal routes, estimate travel times considering real-time traffic, and create personalized maps with points of interest.",
  "supportedInterfaces": [
    {"url": "https://georoute-agent.example.com/a2a/v1", "protocolBinding": "JSONRPC", "protocolVersion": "1.0"},
    {"url": "https://georoute-agent.example.com/a2a/grpc", "protocolBinding": "GRPC", "protocolVersion": "1.0"},
    {"url": "https://georoute-agent.example.com/a2a/json", "protocolBinding": "HTTP+JSON", "protocolVersion": "1.0"}
  ],
  "provider": {
    "organization": "Example Geo Services Inc.",
    "url": "https://www.examplegeoservices.com"
  },
  "iconUrl": "https://georoute-agent.example.com/icon.png",
  "version": "1.2.0",
  "documentationUrl": "https://docs.examplegeoservices.com/georoute-agent/api",
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "extendedAgentCard": true
  },
  "securitySchemes": {
    "google": {
      "openIdConnectSecurityScheme": {
        "openIdConnectUrl": "https://accounts.google.com/.well-known/openid-configuration"
      }
    }
  },
  "security": [{ "google": ["openid", "profile", "email"] }],
  "defaultInputModes": ["application/json", "text/plain"],
  "defaultOutputModes": ["application/json", "image/png"],
  "skills": [
    {
      "id": "route-optimizer-traffic",
      "name": "Traffic-Aware Route Optimizer",
      "description": "Calculates the optimal driving route between two or more locations, taking into account real-time traffic conditions, road closures, and user preferences (e.g., avoid tolls, prefer highways).",
      "tags": ["maps", "routing", "navigation", "directions", "traffic"],
      "examples": [
        "Plan a route from '1600 Amphitheatre Parkway, Mountain View, CA' to 'San Francisco International Airport' avoiding tolls.",
        "{\"origin\": {\"lat\": 37.422, \"lng\": -122.084}, \"destination\": {\"lat\": 37.7749, \"lng\": -122.4194}, \"preferences\": [\"avoid_ferries\"]}"
      ],
      "inputModes": ["application/json", "text/plain"],
      "outputModes": [
        "application/json",
        "application/vnd.geo+json",
        "text/html"
      ]
    },
    {
      "id": "custom-map-generator",
      "name": "Personalized Map Generator",
      "description": "Creates custom map images or interactive map views based on user-defined points of interest, routes, and style preferences. Can overlay data layers.",
      "tags": ["maps", "customization", "visualization", "cartography"],
      "examples": [
        "Generate a map of my upcoming road trip with all planned stops highlighted.",
        "Show me a map visualizing all coffee shops within a 1-mile radius of my current location."
      ],
      "inputModes": ["application/json"],
      "outputModes": [
        "image/png",
        "image/jpeg",
        "application/json",
        "text/html"
      ]
    }
  ],
  "signatures": [
    {
      "protected": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpPU0UiLCJraWQiOiJrZXktMSIsImprdSI6Imh0dHBzOi8vZXhhbXBsZS5jb20vYWdlbnQvandrcy5qc29uIn0",
      "signature": "QFdkNLNszlGj3z3u0YQGt_T9LixY3qtdQpZmsTdDHDe3fXV9y9-B3m2-XgCpzuhiLt8E0tV6HXoZKHv4GtHgKQ"
    }
  ]
}
```

### 8.6. Caching

Agent Card content changes infrequently relative to the frequency at which clients may fetch it. Servers and clients **SHOULD** use standard HTTP caching mechanisms to reduce unnecessary network overhead.

#### 8.6.1. Server Requirements

- Agent Card HTTP endpoints **SHOULD** include a `Cache-Control` response header with a `max-age` directive appropriate for the agent's expected update frequency
- Agent Card HTTP endpoints **SHOULD** include an `ETag` response header derived from the Agent Card's `version` field or a hash of the card content
- Agent Card HTTP endpoints **MAY** include a `Last-Modified` response header

#### 8.6.2. Client Requirements

- Clients **SHOULD** honor HTTP caching semantics as defined in [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111) when fetching Agent Cards
- When a cached Agent Card has expired, clients **SHOULD** use conditional requests (`If-None-Match` with the stored `ETag`, or `If-Modified-Since`) to avoid re-downloading unchanged cards
- When the server does not include caching headers, clients **MAY** apply an implementation-specific default cache duration

## 9. JSON-RPC Protocol Binding

The JSON-RPC protocol binding provides a simple, HTTP-based interface using JSON-RPC 2.0 for method calls and Server-Sent Events for streaming.

### 9.1. Protocol Requirements

- **Protocol:** JSON-RPC 2.0 over HTTP(S)
- **Content-Type:** `application/json` for requests and responses
- **Method Naming:** PascalCase method names matching gRPC conventions (e.g., `SendMessage`, `GetTask`)
- **Streaming:** Server-Sent Events (`text/event-stream`)

### 9.2. Service Parameter Transmission

A2A service parameters defined in [Section 3.2.6](#326-service-parameters) **MUST** be transmitted using standard HTTP request headers, as JSON-RPC 2.0 operates over HTTP(S).

**Service Parameter Requirements:**

- Service parameter names **MUST** be transmitted as HTTP header fields
- Service parameter keys are case-insensitive per HTTP specification (RFC 7230)
- Multiple values for the same service parameter (e.g., `A2A-Extensions`) **SHOULD** be comma-separated in a single header field

**Example Request with A2A Service Parameters:**

```http
POST /rpc HTTP/1.1
Host: agent.example.com
Content-Type: application/json
Authorization: Bearer token
A2A-Version: 0.3
A2A-Extensions: https://example.com/extensions/geolocation/v1,https://standards.org/extensions/citations/v1

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "SendMessage",
  "params": { /* SendMessageRequest */ }
}
```

### 9.3. Base Request Structure

All JSON-RPC requests **MUST** follow the standard JSON-RPC 2.0 format:

```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "method": "category/action",
  "params": { /* method-specific parameters */ }
}
```

### 9.4. Core Methods

#### 9.4.1. `SendMessage`

Sends a message to initiate or continue a task.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "SendMessage",
  "params": { /* SendMessageRequest object */ }
}
```

**Referenced Objects:** [`SendMessageRequest`](#321-sendmessagerequest), [`Message`](#414-message)

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    /* SendMessageResponse object, contains one of:
     * "task": { Task object }
     * "message": { Message object }
    */
  }
```

**Referenced Objects:** [`Task`](#411-task), [`Message`](#414-message)

#### 9.4.2. `SendStreamingMessage`

Sends a message and subscribes to real-time updates via Server-Sent Events.

**Request:** Same as `SendMessage`

**Response:** HTTP 200 with `Content-Type: text/event-stream`

```text
data: {"jsonrpc": "2.0", "id": 1, "result": { /* StreamResponse object */ }}

data: {"jsonrpc": "2.0", "id": 1, "result": { /* StreamResponse object */ }}
```

**Referenced Objects:** [`StreamResponse`](#323-stream-response)

#### 9.4.3. `GetTask`

Retrieves the current state of a task.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "GetTask",
  "params": {
    "id": "task-uuid",
    "historyLength": 10
  }
}
```

#### 9.4.4. `ListTasks`

Lists tasks with optional filtering and pagination.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "ListTasks",
  "params": {
    "contextId": "context-uuid",
    "status": "TASK_STATE_WORKING",
    "pageSize": 50,
    "pageToken": "cursor-token"
  }
}
```

#### 9.4.5. `CancelTask`

Cancels an ongoing task.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "CancelTask",
  "params": {
    "id": "task-uuid"
  }
}
```

#### 9.4.6. `SubscribeToTask`

<span id="936-taskssubscribe"></span>

Subscribes to a task stream for receiving updates on a task that is not in a terminal state.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "SubscribeToTask",
  "params": {
    "id": "task-uuid"
  }
}
```

**Response:** SSE stream (same format as `SendStreamingMessage`)

**Error:** Returns `UnsupportedOperationError` if the task is in a terminal state (`TASK_STATE_COMPLETED`, `TASK_STATE_FAILED`, `TASK_STATE_CANCELED`, or `TASK_STATE_REJECTED`).

#### 9.4.7. Push Notification Configuration Methods

- `CreateTaskPushNotificationConfig` - Create push notification configuration
- `GetTaskPushNotificationConfig` - Get push notification configuration
- `ListTaskPushNotificationConfigs` - List push notification configurations
- `DeleteTaskPushNotificationConfig` - Delete push notification configuration

#### 9.4.8. `GetExtendedAgentCard`

Retrieves an extended Agent Card.

**Request:**

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "GetExtendedAgentCard"
}
```

### 9.5. Error Handling

JSON-RPC error responses use the standard [JSON-RPC 2.0 error object](https://www.jsonrpc.org/specification#error_object) structure, which maps to the generic A2A error model defined in [Section 3.3.2](#332-error-handling) as follows:

- **Error Code**: Mapped to `error.code` (numeric JSON-RPC error code)
- **Error Message**: Mapped to `error.message` (human-readable string)
- **Error Details**: Mapped to `error.data` (array of objects, each containing a `@type` key, using ProtoJSON `Any` representation)

**Standard JSON-RPC Error Codes:**

| JSON-RPC Error Code | Error Name            | Standard Message                   | Description                                             |
| :------------------ | :-------------------- | :--------------------------------- | :------------------------------------------------------ |
| `-32700`            | `JSONParseError`      | "Invalid JSON payload"             | The server received invalid JSON                        |
| `-32600`            | `InvalidRequestError` | "Request payload validation error" | The JSON sent is not a valid Request object             |
| `-32601`            | `MethodNotFoundError` | "Method not found"                 | The requested method does not exist or is not available |
| `-32602`            | `InvalidParamsError`  | "Invalid parameters"               | The method parameters are invalid                       |
| `-32603`            | `InternalError`       | "Internal error"                   | An internal error occurred on the server                |

**A2A-Specific Error Codes:**

A2A-specific errors use codes in the range `-32001` to `-32099`. For the complete mapping of A2A error types to JSON-RPC error codes, see [Section 5.4 (Error Code Mappings)](#54-error-code-mappings).

**Error Detail Objects:**

Each object in the `data` array **MUST** include a `@type` key that identifies the object's type. Implementations **SHOULD** use well-known types such as `google.rpc.ErrorInfo` to refine error reporting, or `google.rpc.BadRequest` to attach structured data to validation errors. Additional error context **MAY** be included as further objects in the `data` array.

**Error Response Structure:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid parameters",
    "data": [
      {
        "@type": "type.googleapis.com/google.rpc.BadRequest",
        "fieldViolations": [
          {
            "field": "message.parts",
            "description": "At least one part is required"
          }
        ]
      }
    ]
  }
}
```

**Example A2A-Specific Error Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32001,
    "message": "Task not found",
    "data": [
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        "reason": "TASK_NOT_FOUND",
        "domain": "a2a-protocol.org",
        "metadata": {
          "taskId": "nonexistent-task-id",
          "timestamp": "2025-11-09T10:30:00.000Z"
        }
      }
    ]
  }
}
```

## 10. gRPC Protocol Binding

The gRPC Protocol Binding provides a high-performance, strongly-typed interface using Protocol Buffers over HTTP/2. The gRPC Protocol Binding leverages the [API guidelines](https://google.aip.dev/general) to simplify gRPC to HTTP mapping.

### 10.1. Protocol Requirements

- **Protocol:** gRPC over HTTP/2 with TLS
- **Definition:** Use the normative Protocol Buffers definition in `specification/a2a.proto`
- **Serialization:** Protocol Buffers version 3
- **Service:** Implement the `A2AService` gRPC service

### 10.2. Service Parameter Transmission

A2A service parameters defined in [Section 3.2.6](#326-service-parameters) **MUST** be transmitted using gRPC metadata (headers).

**Service Parameter Requirements:**

- Service parameter names **MUST** be transmitted as gRPC metadata keys
- Metadata keys are case-insensitive and automatically converted to lowercase by gRPC
- Multiple values for the same service parameter (e.g., `A2A-Extensions`) **SHOULD** be comma-separated in a single metadata entry

**Example gRPC Request with A2A Service Parameters:**

```go
// Go example using gRPC metadata
md := metadata.Pairs(
    "authorization", "Bearer token",
    "a2a-version", "0.3",
    "a2a-extensions", "https://example.com/extensions/geolocation/v1,https://standards.org/extensions/citations/v1",
)
ctx := metadata.NewOutgoingContext(context.Background(), md)

// Make the RPC call with the context containing metadata
response, err := client.SendMessage(ctx, request)
```

**Metadata Handling:**

- Implementations **MUST** extract A2A service parameters from gRPC metadata for processing
- Servers **SHOULD** validate required service parameters (e.g., `A2A-Version`) from metadata
- Service parameter keys in metadata are normalized to lowercase per gRPC conventions

### 10.3. Service Definition

{{ proto_service_to_table("A2AService") }}

### 10.4. Core Methods

#### 10.4.1. SendMessage

Sends a message to an agent.

**Request:**

{{ proto_to_table("SendMessageRequest") }}

**Response:**

{{ proto_to_table("SendMessageResponse") }}

#### 10.4.2. SendStreamingMessage

Sends a message with streaming updates.

**Request:**

{{ proto_to_table("SendMessageRequest") }}

**Response:** Server streaming [`StreamResponse`](#stream-response) objects.

#### 10.4.3. GetTask

Retrieves task status.

**Request:**

{{ proto_to_table("GetTaskRequest") }}

**Response:** See [`Task`](#411-task) object definition.

#### 10.4.4. ListTasks

Lists tasks with filtering.

**Request:**

{{ proto_to_table("ListTasksRequest") }}

**Response:**

{{ proto_to_table("ListTasksResponse") }}

#### 10.4.5. CancelTask

Cancels a running task.

**Request:**

{{ proto_to_table("CancelTaskRequest") }}

**Response:** See [`Task`](#411-task) object definition.

#### 10.4.6. SubscribeToTask

Subscribe to task updates via streaming. Returns `UnsupportedOperationError` if the task is in a terminal state.

**Request:**

{{ proto_to_table("SubscribeToTaskRequest") }}

**Response:** Server streaming [`StreamResponse`](#stream-response) objects.

#### 10.4.7. CreateTaskPushNotificationConfig

Creates a push notification configuration for a task.

**Request:**

{{ proto_to_table("CreateTaskPushNotificationConfigRequest") }}

**Response:** See [`PushNotificationConfig`](#431-pushnotificationconfig) object definition.

#### 10.4.8. GetTaskPushNotificationConfig

Retrieves an existing push notification configuration for a task.

**Request:**

{{ proto_to_table("GetTaskPushNotificationConfigRequest") }}

**Response:** See [`PushNotificationConfig`](#431-pushnotificationconfig) object definition.

#### 10.4.9. ListTaskPushNotificationConfigs

Lists all push notification configurations for a task.

**Request:**

{{ proto_to_table("ListTaskPushNotificationConfigsRequest") }}

**Response:**

{{ proto_to_table("ListTaskPushNotificationConfigsResponse") }}

#### 10.4.10. DeleteTaskPushNotificationConfig

Removes a push notification configuration for a task.

**Request:**

{{ proto_to_table("DeleteTaskPushNotificationConfigRequest") }}

**Response:** `google.protobuf.Empty`

#### 10.4.11. GetExtendedAgentCard

Retrieves the agent's extended capability card after authentication.

**Request:**

{{ proto_to_table("GetExtendedAgentCardRequest") }}

**Response:** See [`AgentCard`](#441-agentcard) object definition.

### 10.5. gRPC-Specific Data Types

#### 10.5.1. TaskPushNotificationConfig

Resource wrapper for push notification configurations. This is a gRPC-specific type used in resource-oriented operations to provide the full resource name along with the configuration data.

{{ proto_to_table("TaskPushNotificationConfig") }}

### 10.6. Error Handling

gRPC error responses use the standard [gRPC status](https://grpc.io/docs/guides/error/) structure with [google.rpc.Status](https://github.com/googleapis/googleapis/blob/master/google/rpc/status.proto), which maps to the generic A2A error model defined in [Section 3.3.2](#332-error-handling) as follows:

- **Error Code**: Mapped to `status.code` (gRPC status code enum)
- **Error Message**: Mapped to `status.message` (human-readable string)
- **Error Details**: Mapped to `status.details` (repeated google.protobuf.Any messages)

**A2A Error Representation:**

For A2A-specific errors, implementations **MUST** include a `google.rpc.ErrorInfo` message in the `status.details` array with:

- `reason`: The A2A error type in UPPER_SNAKE_CASE without the "Error" suffix (e.g., `TASK_NOT_FOUND`)
- `domain`: Set to `"a2a-protocol.org"`
- `metadata`: Optional map of additional error context

For the complete mapping of A2A error types to gRPC status codes, see [Section 5.4 (Error Code Mappings)](#54-error-code-mappings).

**Error Response Example:**

```proto
// Standard gRPC invalid argument error
status {
  code: INVALID_ARGUMENT
  message: "Invalid request parameters"
  details: [
    {
      type: "type.googleapis.com/google.rpc.BadRequest"
      field_violations: [
        {
          field: "message.parts"
          description: "At least one part is required"
        }
      ]
    }
  ]
}
```

**Example A2A-Specific Error Response:**

```proto
// A2A-specific task not found error
status {
  code: NOT_FOUND
  message: "Task with ID 'task-123' not found"
  details: [
    {
      type: "type.googleapis.com/google.rpc.ErrorInfo"
      reason: "TASK_NOT_FOUND"
      domain: "a2a-protocol.org"
      metadata: {
        task_id: "task-123"
        timestamp: "2025-11-09T10:30:00Z"
      }
    }
  ]
}
```

### 10.7. Streaming

gRPC streaming uses server streaming RPCs for real-time updates. The `StreamResponse` message provides a union of possible streaming events:

{{ proto_to_table("StreamResponse") }}

## 11. HTTP+JSON/REST Protocol Binding

The HTTP+JSON protocol binding provides a RESTful interface using standard HTTP methods and JSON payloads.

### 11.1. Protocol Requirements

- **Protocol:** HTTP(S) with JSON payloads
- **Content-Type:** application/a2a+json **SHOULD** be used for requests and responses
- **Methods:** Standard HTTP verbs (GET, POST, PUT, DELETE)
- **URL Patterns:** RESTful resource-based URLs
- **Streaming:** Server-Sent Events for real-time updates

### 11.2. Service Parameter Transmission

A2A service parameters defined in [Section 3.2.6](#326-service-parameters) **MUST** be transmitted using standard HTTP request headers.

**Service Parameter Requirements:**

- Service parameter names **MUST** be transmitted as HTTP header fields
- Service parameter keys are case-insensitive per HTTP specification (RFC 9110)
- Multiple values for the same service parameter (e.g., `A2A-Extensions`) **SHOULD** be comma-separated in a single header field

**Example Request with A2A Service Parameters:**

```http
POST /message:send HTTP/1.1
Host: agent.example.com
Content-Type: application/a2a+json
Authorization: Bearer token
A2A-Version: 0.3
A2A-Extensions: https://example.com/extensions/geolocation/v1,https://standards.org/extensions/citations/v1

{
  "message": {
    "role": "ROLE_USER",
    "parts": [{"text": "Find restaurants near me"}]
  }
}
```

### 11.3. URL Patterns and HTTP Methods

#### 11.3.1. Message Operations

- `POST /message:send` - Send message
- `POST /message:stream` - Send message with streaming (SSE response)

#### 11.3.2. Task Operations

- `GET /tasks/{id}` - Get task status
- `GET /tasks` - List tasks (with query parameters)
- `POST /tasks/{id}:cancel` - Cancel task
- `POST /tasks/{id}:subscribe` - Subscribe to task updates (SSE response, returns error for terminal tasks)

#### 11.3.3. Push Notification Configuration

- `POST /tasks/{id}/pushNotificationConfigs` - Create configuration
- `GET /tasks/{id}/pushNotificationConfigs/{configId}` - Get configuration
- `GET /tasks/{id}/pushNotificationConfigs` - List configurations
- `DELETE /tasks/{id}/pushNotificationConfigs/{configId}` - Delete configuration

#### 11.3.4. Agent Card

- `GET /extendedAgentCard` - Get authenticated extended Agent Card

### 11.4. Request/Response Format

All requests and responses use JSON objects structurally equivalent to the Protocol Buffer definitions.

**Example Send Message:**

```http
POST /message:send
Content-Type: application/a2a+json

{
  "message": {
    "messageId": "uuid",
    "role": "ROLE_USER",
    "parts": [{"text": "Hello"}]
  },
  "configuration": {
    "acceptedOutputModes": ["text/plain"]
  }
}
```

**Referenced Objects:** [`SendMessageRequest`](#321-sendmessagerequest), [`Message`](#414-message)

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/a2a+json

{
  "task": {
    "id": "task-uuid",
    "contextId": "context-uuid",
    "status": {
      "state": "TASK_STATE_COMPLETED"
    }
  }
}
```

**Referenced Objects:** [`Task`](#411-task)

### 11.5. Query Parameter Naming for Request Parameters

HTTP methods that do not support request bodies (GET, DELETE) **MUST** transmit operation request parameters as path parameters or query parameters. This section defines how to map Protocol Buffer field names to query parameter names.

**Naming Convention:**

Query parameter names **MUST** use `camelCase` to match the JSON serialization of Protocol Buffer field names. This ensures consistency with request bodies used in POST operations.

**Example Mappings:**

| Protocol Buffer Field | Query Parameter Name | Example Usage       |
| --------------------- | -------------------- | ------------------- |
| `context_id`          | `contextId`          | `?contextId=uuid`   |
| `page_size`           | `pageSize`           | `?pageSize=50`      |
| `page_token`          | `pageToken`          | `?pageToken=cursor` |
| `task_id`             | `taskId`             | `?taskId=uuid`      |

**Usage Examples:**

List tasks with filtering:

```http
GET /tasks?contextId=uuid&status=TASK_STATE_WORKING&pageSize=50&pageToken=cursor
```

Get task with history:

```http
GET /tasks/{id}?historyLength=10
```

**Field Type Handling:**

- **Strings**: Passed directly as query parameter values
- **Booleans**: Represented as lowercase strings (`true`, `false`)
- **Numbers**: Represented as decimal strings
- **Enums**: Represented using their string values (e.g., `status=TASK_STATE_WORKING`)
- **Repeated Fields**: Multiple values **MAY** be passed by repeating the parameter name (e.g., `?tag=value1&tag=value2`) or as comma-separated values (e.g., `?tag=value1,value2`)
- **Nested Objects**: Not supported in query parameters; operations requiring nested objects **MUST** use POST with a request body
- **Datetimes/Timestamps**: Represented as ISO 8601 strings (e.g., `2025-11-09T10:30:00Z`)

**URL Encoding:**

All query parameter values **MUST** be properly URL-encoded per [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986.html).

### 11.6. Error Handling

HTTP error responses use the [google.rpc.Status](https://github.com/googleapis/googleapis/blob/master/google/rpc/status.proto) JSON representation, which maps to the generic A2A error model defined in [Section 3.3.2](#332-error-handling) as follows:

- **Error Code**: Mapped to the HTTP status code and the `error.code` field
- **Error Message**: Mapped to the `error.message` field (human-readable string)
- **Error Details**: Mapped to the `error.details` array (array of objects, each containing a `@type` key, using ProtoJSON `Any` representation)

**Error Detail Objects:**

Each object in the `details` array **MUST** include a `@type` key that identifies the object's type. Implementations **SHOULD** use well-known types such as `google.rpc.BadRequest` to attach structured data to validation errors. Additional error context **MAY** be included as further objects in the `details` array.

**A2A Error Representation:**

Since multiple A2A error types may map to the same HTTP status code (e.g., `TaskNotCancelableError` and `PushNotificationNotSupportedError` both map to `400 Bad Request`), implementations **MUST** include a `google.rpc.ErrorInfo` object in the `details` array for A2A-specific errors with:

- `@type`: Set to `"type.googleapis.com/google.rpc.ErrorInfo"`
- `reason`: The A2A error type in UPPER_SNAKE_CASE without the "Error" suffix (e.g., `TASK_NOT_FOUND`, `TASK_NOT_CANCELABLE`)
- `domain`: Set to `"a2a-protocol.org"`

For the complete mapping of A2A error types to HTTP status codes, see [Section 5.4 (Error Code Mappings)](#54-error-code-mappings).

**Error Response Example:**

```http
HTTP/1.1 404 Not Found
Content-Type: application/a2a+json

{
  "error": {
    "code": 404,
    "status": "NOT_FOUND",
    "message": "The specified task ID does not exist or is not accessible",
    "details": [
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        "reason": "TASK_NOT_FOUND",
        "domain": "a2a-protocol.org",
        "metadata": {
          "taskId": "task-123",
          "timestamp": "2025-11-09T10:30:00.000Z"
        }
      }
    ]
  }
}
```

Extension fields like `taskId` and `timestamp` provide additional context to help diagnose the error.

### 11.7. Streaming

<span id="stream-response"></span>

REST streaming uses Server-Sent Events with the `data` field containing JSON serializations of the protocol data objects:

```http
POST /message:stream
Content-Type: application/a2a+json

{ /* SendMessageRequest object */ }
```

**Referenced Objects:** [`SendMessageRequest`](#321-sendmessagerequest)

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream

data: { /* StreamResponse object */ }

data: { /* StreamResponse object */ }
```

**Referenced Objects:** [`StreamResponse`](#323-stream-response)
Streaming responses are simple, linearly ordered sequences: first a `Task` (or single `Message`), then zero or more status or artifact update events until the task reaches a terminal or interrupted state, at which point the stream closes. Implementations SHOULD avoid re-ordering events and MAY optionally resend a final `Task` snapshot before closing.

## 12. Custom Binding Guidelines

While the A2A protocol provides three standard bindings (JSON-RPC, gRPC, and HTTP+JSON/REST), implementers **MAY** create custom protocol bindings to support additional transport mechanisms or communication patterns. Custom bindings **MUST** comply with all requirements defined in [Section 5 (Protocol Binding Requirements and Interoperability)](#5-protocol-binding-requirements-and-interoperability). This section provides additional guidelines specific to developing custom bindings.

### 12.1. Binding Requirements

Custom protocol bindings **MUST**:

1. **Implement All Core Operations**: Support all operations defined in [Section 3 (A2A Protocol Operations)](#3-a2a-protocol-operations)
2. **Preserve Data Model**: Use data structures functionally equivalent to those defined in [Section 4 (Protocol Data Model)](#4-protocol-data-model)
3. **Maintain Semantics**: Ensure operations behave consistently with the abstract operation definitions
4. **Document Completely**: Provide comprehensive documentation of the binding specification

### 12.2. Data Type Mappings

Custom bindings **MUST** provide clear mappings for:

- **Protocol Buffer Types**: Define how each Protocol Buffer message type is represented
- **Timestamps**: Follow the conventions in [Section 5.6.1 (Timestamps)](#561-timestamps)
- **Binary Data**: Specify encoding for binary content (e.g., base64 for text-based protocols)
- **Enumerations**: Define representation of enum values (e.g., strings, integers)

### 12.3. Service Parameter Transmission

As specified in [Section 3.2.6 (Service Parameters)](#326-service-parameters), custom protocol bindings **MUST** document how service parameters are transmitted. The binding specification **MUST** address:

1. **Transmission Mechanism**: The protocol-specific method for transmitting service parameter key-value pairs
2. **Value Constraints**: Any limitations on service parameter values (e.g., character encoding, size limits)
3. **Reserved Names**: Any service parameter names reserved by the binding itself
4. **Fallback Strategy**: What happens when the protocol lacks native header support (e.g., passing service parameters in metadata)

**Example Documentation Requirements:**

- **For native header support**: "Service parameters are transmitted using HTTP request headers. Service parameter keys are case-insensitive and must conform to RFC 7230. Service parameter values must be UTF-8 strings."
- **For protocols without headers**: "Service parameters are serialized as a JSON object and transmitted in the request metadata field `a2a-service-parameters`."

### 12.4. Error Mapping

Custom bindings **MUST**:

1. **Map Standard Errors**: Provide mappings for all A2A-specific error types defined in [Section 3.2.2 (Error Handling)](#332-error-handling)
2. **Preserve Error Information**: Ensure error details are accessible to clients
3. **Use Appropriate Codes**: Map to protocol-native error codes where applicable
4. **Document Error Format**: Specify the structure of error responses

### 12.5. Streaming Support

If the binding supports streaming operations:

1. **Define Stream Mechanism**: Document how streaming is implemented (e.g., WebSockets, long-polling, chunked encoding)
2. **Event Ordering**: Specify ordering guarantees for streaming events
3. **Reconnection**: Define behavior for connection interruption and resumption
4. **Stream Termination**: Specify how stream completion is signaled

If streaming is not supported, the binding **MUST** clearly document this limitation in the Agent Card.

### 12.6. Authentication and Authorization

Custom bindings **MUST**:

1. **Support Standard Schemes**: Implement authentication schemes declared in the Agent Card
2. **Document Integration**: Specify how credentials are transmitted in the protocol
3. **Handle Challenges**: Define how authentication challenges are communicated
4. **Maintain Security**: Follow security best practices for the transport protocol

### 12.7. Agent Card Declaration

Custom bindings **MUST** be declared in the Agent Card:

1. **Transport Identifier**: Use a URI to identify the binding (see [Section 5.8](#58-custom-binding-identification))
2. **Endpoint URL**: Provide the full URL where the binding is available

**Example:**

```json
{
  "supportedInterfaces": [
    {
      "url": "wss://agent.example.com/a2a/websocket",
      "protocolBinding": "https://example.com/bindings/websocket/v1"
    }
  ]
}
```

### 12.8. Interoperability Testing

Custom binding implementers **SHOULD**:

1. **Test Against Reference**: Verify behavior matches standard bindings
2. **Document Differences**: Clearly note any deviations from standard binding behavior
3. **Provide Examples**: Include sample requests and responses
4. **Test Edge Cases**: Verify handling of error conditions, large payloads, and long-running tasks

## 13. Security Considerations

This section consolidates security guidance and best practices for implementing and operating A2A agents. For additional enterprise security considerations, see [Enterprise-Ready Features](./topics/enterprise-ready.md).

### 13.1. Data Access and Authorization Scoping

Implementations **MUST** ensure appropriate scope limitation based on the authenticated caller's authorization boundaries. This applies to all operations that access or list tasks and other resources.

**Authorization Principles:**

- Servers **MUST** implement authorization checks on every [A2A Protocol Operations](#3-a2a-protocol-operations) request
- Implementations **MUST** scope results to the caller's authorized access boundaries as defined by the agent's authorization model
- Even when `contextId` or other filter parameters are not specified in requests, implementations **MUST** scope results to the caller's authorized access boundaries
- Authorization models are agent-defined and **MAY** be based on:
    - User identity (user-based authorization)
    - Organizational roles or groups (role-based authorization)
    - Project or workspace membership (project-based authorization)
    - Organizational or tenant boundaries (multi-tenant authorization)
    - Custom authorization logic specific to the agent's domain

**Operations Requiring Scope Limitation:**

- [`List Tasks`](#314-list-tasks): **MUST** only return tasks visible to the authenticated client according to the agent's authorization model
- [`Get Task`](#313-get-task): **MUST** verify the authenticated client has access to the requested task according to the agent's authorization model
- Task-related operations (Cancel, Subscribe, Push Notification Config): **MUST** verify the client has appropriate access rights according to the agent's authorization model

**Implementation Requirements:**

- Authorization boundaries are defined by each agent's authorization model, not prescribed by the protocol
- Authorization checks **MUST** occur before any database queries or operations that could leak information about the existence of resources outside the caller's authorization scope
- Agents **SHOULD** document their authorization model and access control policies

See also: [Section 3.1.4 List Tasks (Security Note)](#314-list-tasks) for operation-specific requirements.

### 13.2. Push Notification Security

When implementing push notifications, both agents (as webhook callers) and clients (as webhook receivers) have security responsibilities.

**Agent (Webhook Caller) Requirements:**

- Agents **MUST** include authentication credentials in webhook requests as specified in [`PushNotificationConfig.authentication`](#432-authenticationinfo)
- Agents **SHOULD** implement reasonable timeout values for webhook requests (recommended: 10-30 seconds)
- Agents **SHOULD** implement retry logic with exponential backoff for failed deliveries
- Agents **MAY** stop attempting delivery after a configured number of consecutive failures
- Agents **SHOULD** validate webhook URLs to prevent SSRF (Server-Side Request Forgery) attacks:
    - Reject private IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
    - Reject localhost and link-local addresses
    - Implement URL allowlists where appropriate

**Client (Webhook Receiver) Requirements:**

- Clients **MUST** validate webhook authenticity using the provided authentication credentials
- Clients **SHOULD** verify the task ID in the payload matches an expected task they created
- Clients **MUST** respond with HTTP 2xx status codes to acknowledge successful receipt
- Clients **SHOULD** process notifications idempotently, as duplicate deliveries may occur
- Clients **SHOULD** implement rate limiting to prevent webhook flooding
- Clients **SHOULD** use HTTPS endpoints for webhook URLs to ensure confidentiality

**Configuration Security:**

- Webhook URLs **SHOULD** use HTTPS to protect payload confidentiality in transit
- Authentication tokens in [`PushNotificationConfig`](#431-pushnotificationconfig) **SHOULD** be treated as secrets and rotated periodically
- Agents **SHOULD** securely store push notification configurations and credentials
- Clients **SHOULD** use unique, single-purpose tokens for each push notification configuration

See also: [Section 4.3 Push Notification Objects](#43-push-notification-objects) and [Section 4.3.3 Push Notification Payload](#433-push-notification-payload).

### 13.3. Extended Agent Card Access Control

The extended Agent Card feature allows agents to provide additional capabilities or information to authenticated clients beyond what is available in the public Agent Card.

**Access Control Requirements:**

- The [`Get Extended Agent Card`](#3111-get-extended-agent-card) operation **MUST** require authentication
- Agents **MUST** authenticate requests using one of the schemes declared in the public `AgentCard.securitySchemes` and `AgentCard.security` fields
- Agents **MAY** return different extended card content based on the authenticated client's identity or authorization level
- Agents **SHOULD** implement appropriate caching headers to control client-side caching of extended cards

**Capability-Based Access:**

- Extended cards **MAY** include additional skills not present in the public card
- Extended cards **MAY** expose more detailed capability information (e.g., rate limits, quotas)
- Extended cards **MAY** include organization-specific or user-specific configuration
- Agents **SHOULD** document which capabilities are available at different authentication levels

**Security Considerations:**

- Extended cards **SHOULD NOT** include sensitive information that could be exploited if leaked (e.g., internal service URLs, unmasked credentials)
- Agents **MUST** validate that clients have appropriate permissions before returning privileged information in extended cards
- Clients retrieving extended cards **SHOULD** replace their cached public Agent Card with the extended version for the duration of their authenticated session
- Agents **SHOULD** version extended cards appropriately and honor client cache invalidation

**Availability Declaration:**

- Agents declare extended card support via `AgentCard.capabilities.extendedAgentCard`
- When `capabilities.extendedAgentCard` is `false` or not present, the operation **MUST** return [`UnsupportedOperationError`](#332-error-handling)
- When support is declared but no extended card is configured, the operation **MUST** return [`ExtendedAgentCardNotConfiguredError`](#332-error-handling)

See also: [Section 3.1.11 Get Extended Agent Card](#3111-get-extended-agent-card) and [Section 3.3.4 Capability Validation](#334-capability-validation).

### 13.4. General Security Best Practices

**Transport Security:**

- Production deployments **MUST** use encrypted communication (HTTPS for HTTP-based bindings, TLS for gRPC)
- Implementations **SHOULD** use modern TLS configurations (TLS 1.3+ recommended) with strong cipher suites
- Agents **SHOULD** enforce HSTS (HTTP Strict Transport Security) headers when using HTTP-based bindings
- Implementations **SHOULD** disable support for deprecated SSL/TLS versions (SSLv3, TLS 1.0, TLS 1.1)

**Input Validation:**

- Agents **MUST** validate all input parameters before processing
- Agents **SHOULD** implement appropriate limits on message sizes, file sizes, and request complexity
- Agents **SHOULD** sanitize or validate file content types and reject unexpected media types

**Credential Management:**

- API keys, tokens, and other credentials **MUST** be treated as secrets
- Credentials **SHOULD** be rotated periodically
- Credentials **SHOULD** be transmitted only over encrypted connections
- Agents **SHOULD** implement credential revocation mechanisms
- Agents **SHOULD** log authentication failures and implement rate limiting to prevent brute-force attacks

**Audit and Monitoring:**

- Agents **SHOULD** log security-relevant events (authentication failures, authorization denials, suspicious requests)
- Agents **SHOULD** implement monitoring for unusual patterns (rapid task creation, excessive cancellations)
- Agents **SHOULD** provide audit trails for sensitive operations
- Logs **MUST NOT** include sensitive information (credentials, personal data) unless required and properly protected

**Rate Limiting and Abuse Prevention:**

- Agents **SHOULD** implement rate limiting on all operations
- Agents **SHOULD** return appropriate error responses when rate limits are exceeded
- Agents **MAY** implement different rate limits for different operations or user tiers

**Data Privacy:**

- Agents **MUST** comply with applicable data protection regulations
- Agents **SHOULD** provide mechanisms for users to request deletion of their data
- Agents **SHOULD** implement appropriate data retention policies
- Agents **SHOULD** minimize logging of sensitive or personal information

**Custom Binding Security:**

- Custom protocol bindings **MUST** address security considerations in their specification
- Custom bindings **SHOULD** follow the same security principles as standard bindings
- Custom bindings **MUST** document authentication integration and credential transmission

See also: [Section 12.6 Authentication and Authorization (Custom Bindings)](#126-authentication-and-authorization).

## 14. IANA Considerations

This section provides registration templates for the A2A protocol's media type, HTTP headers, and well-known URI, intended for submission to the Internet Assigned Numbers Authority (IANA).

### 14.1. Media Type Registration

#### 14.1.1. application/a2a+json

**Type name:** `application`

**Subtype name:** `a2a+json`

**Required parameters:** None

**Optional parameters:**

- None

**Encoding considerations:** Binary (UTF-8 encoding MUST be used for JSON text)

**Security considerations:**
This media type shares security considerations common to all JSON-based formats as described in RFC 8259, Section 12. Additionally:

- Content MUST be validated against the A2A protocol schema before processing
- Implementations MUST sanitize user-provided content to prevent injection attacks
- File references within A2A messages MUST be validated to prevent server-side request forgery (SSRF)
- Authentication and authorization MUST be enforced as specified in Section 7 of the A2A specification
- Sensitive information in task history and artifacts MUST be protected according to applicable data protection regulations

**Interoperability considerations:**
The A2A protocol supports multiple protocol bindings. This media type is intended for the HTTP+JSON/REST binding.

**Published specification:**
Agent2Agent (A2A) Protocol Specification, available at: <https://a2a-protocol.org/latest/specification>

**Applications that use this media type:**
AI agent platforms, agentic workflow systems, multi-agent collaboration tools, and enterprise automation systems that implement the A2A protocol for agent-to-agent communication.

**Fragment identifier considerations:** None

**Additional information:**

- **Deprecated alias names for this type:** None
- **Magic number(s):** None
- **File extension(s):** .a2a.json
- **Macintosh file type code(s):** TEXT

**Person & email address to contact for further information:**
A2A Protocol Working Group, <a2a-protocol@example.org>

**Intended usage:** COMMON

**Restrictions on usage:** None

**Author:** A2A Protocol Working Group

**Change controller:** A2A Protocol Working Group

**Provisional registration:** No

### 14.2. HTTP Header Field Registrations

**Note:** The following HTTP headers represent the HTTP-based protocol binding implementation of the abstract A2A service parameters defined in [Section 3.2.6](#326-service-parameters). These registrations are specific to HTTP/HTTPS transports.

#### 14.2.1. A2A-Version Header

**Header field name:** A2A-Version

**Applicable protocol:** HTTP

**Status:** Standard

**Author/Change controller:** A2A Protocol Working Group

**Specification document:** Section 3.2.5 of the A2A Protocol Specification

**Related information:**
The A2A-Version header field indicates the A2A protocol version that the client is using. The value MUST be in the format `Major.Minor` (e.g., "0.3"). If the version is not supported by the agent, the agent returns a `VersionNotSupportedError`.

**Example:**

```text
A2A-Version: 0.3
```

#### 14.2.2. A2A-Extensions Header

**Header field name:** A2A-Extensions

**Applicable protocol:** HTTP

**Status:** Standard

**Author/Change controller:** A2A Protocol Working Group

**Specification document:** Section 3.2.5 of the A2A Protocol Specification

**Related information:**
The A2A-Extensions header field contains a comma-separated list of extension URIs that the client wants to use for the request. Extensions allow agents to provide additional functionality beyond the core A2A specification while maintaining backward compatibility.

**Example:**

```text
A2A-Extensions: https://example.com/extensions/geolocation/v1,https://standards.org/extensions/citations/v1
```

### 14.3. Well-Known URI Registration

**URI suffix:** agent-card.json

**Change controller:** A2A Protocol Working Group

**Specification document:** Section 8.2 of the A2A Protocol Specification

**Related information:**
The `.well-known/agent-card.json` URI provides a standardized location for discovering an A2A agent's capabilities, supported protocols, authentication requirements, and available skills. The resource at this URI MUST return an AgentCard object as defined in Section 4.4.1 of the A2A specification.

**Status:** Permanent

**Security considerations:**

- The Agent Card MAY contain public information about an agent's capabilities and SHOULD NOT include sensitive credentials or internal implementation details
- Implementations SHOULD support HTTPS to ensure authenticity and integrity of the Agent Card
- Agent Cards MAY be signed using JSON Web Signatures (JWS) as specified in the AgentCardSignature object (Section 4.4.7)
- Clients SHOULD verify signatures when present to ensure the Agent Card has not been tampered with
- Extended Agent Cards retrieved via authenticated endpoints (Section 3.1.11) MAY contain additional information and MUST enforce appropriate access controls

**Example:**

```text
https://agent.example.com/.well-known/agent-card.json
```

---

## Appendix A. Migration & Legacy Compatibility

This appendix catalogs renamed protocol messages and objects, their legacy identifiers, and the planned deprecation/removal schedule. All legacy names and anchors MUST remain resolvable until the stated earliest removal version.

| Legacy Name                                     | Current Name                              | Earliest Removal Version | Notes                                                  |
| ----------------------------------------------- | ----------------------------------------- | ------------------------ | ------------------------------------------------------ |
| `MessageSendParams`                             | `SendMessageRequest`                      | >= 0.5.0                 | Request payload rename for clarity (request vs params) |
| `SendMessageSuccessResponse`                    | `SendMessageResponse`                     | >= 0.5.0                 | Unified success response naming                        |
| `SendStreamingMessageSuccessResponse`           | `StreamResponse`                          | >= 0.5.0                 | Shorter, binding-agnostic streaming response           |
| `SetTaskPushNotificationConfigRequest`          | `CreateTaskPushNotificationConfigRequest` | >= 0.5.0                 | Explicit creation intent                               |
| `ListTaskPushNotificationConfigSuccessResponse` | `ListTaskPushNotificationConfigsResponse` | >= 0.5.0                 | Consistent response suffix removal                     |
| `GetAuthenticatedExtendedCardRequest`           | `GetExtendedAgentCardRequest`             | >= 0.5.0                 | Removed "Authenticated" from naming                    |

Planned Lifecycle (example timeline; adjust per release strategy):

1. 0.3.x: New names introduced; legacy names documented; aliases added.
2. 0.4.x: Legacy names marked "deprecated" in SDKs and schemas; warning notes added.
3. ≥0.5.0: Legacy names eligible for removal after review; migration appendix updated.

### A.1 Legacy Documentation Anchors

Hidden anchor spans preserve old inbound links:

<!-- Legacy inbound link compatibility anchors (old spec numbering & names) -->
<span id="32-supported-transport-protocols"></span>
<span id="324-transport-extensions"></span>
<span id="35-method-mapping-and-naming-conventions"></span>
<span id="5-agent-discovery-the-agent-card"></span>
<span id="53-recommended-location"></span>
<span id="55-agentcard-object-structure"></span>
<span id="56-transport-declaration-and-url-relationships"></span>
<span id="563-client-transport-selection-rules"></span>
<span id="57-sample-agent-card"></span>
<span id="6-protocol-data-objects"></span>
<span id="61-task-object"></span>
<span id="610-taskpushnotificationconfig-object"></span>
<span id="611-json-rpc-structures"></span>
<span id="612-jsonrpcerror-object"></span>
<span id="63-taskstate-enum"></span>
<span id="69-pushnotificationauthenticationinfo-object"></span>
<span id="711-messagesendparams-object"></span>
<span id="72-messagestream"></span>
<span id="721-sendstreamingmessageresponse-object"></span>
<span id="731-taskqueryparams-object"></span>
<span id="741-listtasksparams-object"></span>
<span id="742-listtasksresult-object"></span>
<span id="751-taskidparams-object-for-taskscancel-and-taskspushnotificationconfigget"></span>
<span id="77-taskspushnotificationconfigget"></span>
<span id="771-gettaskpushnotificationconfigparams-object-taskspushnotificationconfigget"></span>
<span id="781-listtaskpushnotificationconfigparams-object-taskspushnotificationconfiglist"></span>
<span id="791-deletetaskpushnotificationconfigparams-object-taskspushnotificationconfigdelete"></span>
<span id="8-error-handling"></span>
<span id="82-a2a-specific-errors"></span>
<!-- Legacy renamed message/object name anchors -->
<span id="messagesendparams"></span>
<span id="sendmessagesuccessresponse"></span>
<span id="sendstreamingmessagesuccessresponse"></span>
<span id="settaskpushnotificationconfigrequest"></span>
<span id="listtaskpushnotificationconfigsuccessresponse"></span>
<span id="getauthenticatedextendedcardrequest"></span>
<span id="938-agentgetauthenticatedextendedcard"></span>

Each legacy span SHOULD be placed adjacent to the current object's heading (to be inserted during detailed object section edits). If an exact numeric-prefixed anchor existed (e.g., `#414-message`), add an additional span matching that historical form if known.

### A.2 Migration Guidance

Client Implementations SHOULD:

- Prefer new names immediately for all new integrations.
- Implement dual-handling where schemas/types permit (e.g., union type or backward-compatible decoder).
- Log a warning when receiving legacy-named objects after the first deprecation announcement release.

Server Implementations MAY:

- Accept both legacy and current request message forms during the overlap period.
- Emit only current form in responses (recommended) while providing explicit upgrade notes.

#### A.2.1 Breaking Change: Kind Discriminator Removed

**Version 1.0 introduces a breaking change** in how polymorphic objects are represented in the protocol. This affects `Part` types and streaming event types.

**Legacy Pattern (v0.3.x):**
Objects used an inline `kind` field as a discriminator to identify the object type:

**Example 1 - TextPart:**

```json
{
  "kind": "text",
  "text": "Hello, world!"
}
```

**Example 2 - FilePart:**

```json
{
  "kind": "file",
  "file": {
    "name": "diagram.png",
    "mimeType": "image/png",
    "fileWithBytes": "iVBORw0KGgo..."
  }
}
```

**Current Pattern (v1.0):**
Objects now use the **JSON member name** itself to identify the type. The member name acts as the discriminator, and the value structure depends on the specific type:

**Example 1 - TextPart:**

```json
{
  "text": "Hello, world!"
}
```

**Example 2 - FilePart:**

```json
{
  "raw": "iVBORw0KGgo...",
  "filename": "diagram.png",
  "mediaType": "image/png"
}
```

**Affected Types:**

1. **Part Union Types**:
   - **TextPart**:
     - **Legacy:** `{ "kind": "text", "text": "..." }`
     - **Current:** `{ "text": "..." }` (member presence acts as discriminator)
   - **FilePart**:
     - **Legacy:** `{ "kind": "file", "file": { "name": "...", "mimeType": "...", "fileWithBytes": "..." } }`
     - **Current:** `{ "raw": "...", "filename": "...", "mediaType": "..." }` (or `url` instead of `raw`)
   - **DataPart**:
     - **Legacy:** `{ "kind": "data", "data": {...} }`
     - **Current:** `{ "data": {...}, "mediaType": "application/json" }`

2. **Streaming Event Types**:
   - **TaskStatusUpdateEvent**:
     - **Legacy:** `{ "kind": "status-update", "taskId": "...", "status": {...} }`
     - **Current:** `{ "statusUpdate": { "taskId": "...", "status": {...} } }`
   - **TaskArtifactUpdateEvent**:
     - **Legacy:** `{ "kind": "artifact-update", "taskId": "...", "artifact": {...} }`
     - **Current:** `{ "artifactUpdate": { "taskId": "...", "artifact": {...} } }`

**Migration Strategy:**

For **Clients** upgrading from pre-0.3.x:

1. Update parsers to expect wrapper objects with member names as discriminators
2. When constructing requests, use the new wrapper format
3. Implement version detection based on the agent's `protocolVersions` in the `AgentCard`
4. Consider maintaining backward compatibility by detecting and handling both formats during a transition period

For **Servers** upgrading from pre-0.3.x:

1. Update serialization logic to emit wrapper objects
2. **Breaking:** The `kind` field is no longer part of the protocol and should not be emitted
3. Update deserialization to expect wrapper objects with member names
4. Ensure the `AgentCard` declares the correct `protocolVersions` (e.g., ["1.0"] or later)

**Rationale:**

This change aligns with modern API design practices and Protocol Buffers' `oneof` semantics, where the field name itself serves as the type discriminator. This approach:

- Reduces redundancy (no need for both a field name and a `kind` value)
- Aligns JSON-RPC and gRPC representations more closely
- Simplifies code generation from schema definitions
- Eliminates the need for representing inheritance structures in schema languages
- Improves type safety in strongly-typed languages

#### A.2.2 Breaking Change: Extended Agent Card Field Relocated

**Version 1.0 relocates the extended agent card capability** from a top-level field to the capabilities object for architectural consistency.

**Legacy Structure (pre-1.0):**

```json
{
  "supportsExtendedAgentCard": true,
  "capabilities": {
    "streaming": true
  }
}
```

**Current Structure (1.0+):**

```json
{
  "capabilities": {
    "streaming": true,
    "extendedAgentCard": true
  }
}
```

**Proto Changes:**

- Removed: `AgentCard.supports_extended_agent_card` (field 13)
- Added: `AgentCapabilities.extended_agent_card` (field 5)

**Migration Steps:**

For **Agent Implementations**:

1. Remove `supportsExtendedAgentCard` from top-level AgentCard
2. Add `extendedAgentCard` to `capabilities` object
3. Update validation: `agentCard.capabilities?.extendedAgentCard`

For **Client Implementations**:

1. Update capability checks: `agentCard.capabilities?.extendedAgentCard`
2. Temporary fallback (transition period):

   ```javascript
   const supported = agentCard.capabilities?.extendedAgentCard ||
                     agentCard.supportsExtendedAgentCard;
   ```

3. Remove fallback after agent ecosystem migrates

For **SDK Developers**:

1. Regenerate code from updated proto
2. Update type definitions
3. Document breaking change in release notes

**Rationale:**

All optional features enabling specific operations (`streaming`, `pushNotifications`) reside in `AgentCapabilities`. Moving `extendedAgentCard` achieves:

- Architectural consistency
- Improved discoverability
- Semantic correctness (it is a capability)

### A.3 Future Automation

Once the proto→schema generation pipeline lands, this appendix will be partially auto-generated (legacy mapping table sourced from a maintained manifest). Until then, edits MUST be manual and reviewed in PRs affecting `a2a.proto`.

## Appendix B. Relationship to MCP (Model Context Protocol)

A2A and MCP are complementary protocols designed for different aspects of agentic systems:

- **[Model Context Protocol (MCP)](https://modelcontextprotocol.io/):** Focuses on standardizing how AI models and agents connect to and interact with **tools, APIs, data sources, and other external resources.** It defines structured ways to describe tool capabilities (like function calling in LLMs), pass inputs, and receive structured outputs. Think of MCP as the "how-to" for an agent to *use* a specific capability or access a resource.
- **Agent2Agent Protocol (A2A):** Focuses on standardizing how independent, often opaque, **AI agents communicate and collaborate with each other as peers.** A2A provides an application-level protocol for agents to discover each other, negotiate interaction modalities, manage shared tasks, and exchange conversational context or complex results. It's about how agents *partner* or *delegate* work.

**How they work together:**
An A2A Client agent might request an A2A Server agent to perform a complex task. The Server agent, in turn, might use MCP to interact with several underlying tools, APIs, or data sources to gather information or perform actions necessary to fulfill the A2A task.

For a more detailed comparison, see the [A2A and MCP guide](./topics/a2a-and-mcp.md).

---
