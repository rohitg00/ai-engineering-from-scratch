# Errors

> Every A2A error has a JSON-RPC code, an HTTP status, a gRPC status, and an `ErrorInfo` reason, and over HTTP the reason is what tells seven of them apart.

The nine A2A errors take their codes from the canonical table in §5.4 {{spec §5.4}}. Each also has an `ErrorInfo` reason: its name in upper snake case without `Error`, such as `TASK_NOT_FOUND`. The spec spells out only that one and `TASK_NOT_CANCELABLE`, and the reference SDK uses the same nine strings {{spec §11.6}} {{sdk src/a2a/utils/errors.py}}.

| Error | JSON-RPC | HTTP | gRPC |
|---|---|---|---|
| TaskNotFoundError | -32001 | 404 | NOT_FOUND |
| TaskNotCancelableError | -32002 | 400 | FAILED_PRECONDITION |
| PushNotificationNotSupportedError | -32003 | 400 | FAILED_PRECONDITION |
| UnsupportedOperationError | -32004 | 400 | FAILED_PRECONDITION |
| ContentTypeNotSupportedError | -32005 | 400 | INVALID_ARGUMENT |
| InvalidAgentResponseError | -32006 | 500 | INTERNAL |
| ExtendedAgentCardNotConfiguredError | -32007 | 400 | FAILED_PRECONDITION |
| ExtensionSupportRequiredError | -32008 | 400 | FAILED_PRECONDITION |
| VersionNotSupportedError | -32009 | 400 | FAILED_PRECONDITION |
| JSONParseError | -32700 | none | none |
| InvalidRequestError | -32600 | none | none |
| MethodNotFoundError | -32601 | none | none |
| InvalidParamsError | -32602 | 400 | INVALID_ARGUMENT |
| InternalError | -32603 | 500 or 503 | INTERNAL or UNAVAILABLE |
| Authentication error | custom | 401 | UNAUTHENTICATED |
| Authorization error | custom | 403 | PERMISSION_DENIED |

The last seven rows have no A2A code. Five are the standard JSON-RPC errors, whose messages are `Invalid JSON payload`, `Request payload validation error`, `Method not found`, `Invalid parameters`, and `Internal error` {{spec §9.5}}. §3.3.2 gives example HTTP and gRPC codes for two of them and for authentication and authorization errors {{spec §3.3.2}}. JSON-RPC reserves `-32001` to `-32099` for A2A errors and assigns only `-32001` to `-32009`.

The official test kit, a2a-tck at tag `1.0.0.alpha2`, keeps its own table and departs from §5.4 in six places. It expects HTTP `409` for `TaskNotCancelableError`, `415` for `ContentTypeNotSupportedError`, and `502` for `InvalidAgentResponseError`. It expects gRPC `UNIMPLEMENTED` for `UnsupportedOperationError`, `PushNotificationNotSupportedError`, and `VersionNotSupportedError`. A server that follows §5.4 fails those checks, and a2a-java matches the kit on `UnsupportedOperationError`. [Conformance testing](#s-conformance-testing) shows how to run the kit.

[Operations by binding](#s-ref-operations-by-binding) lists the operations that raise each A2A error, and none lists `InvalidAgentResponseError` {{spec §3.3.2}}. `UnsupportedOperationError` covers a terminal task, streaming that is off, and an extended card that is off, so read its message and metadata {{spec §3.1.1}} {{spec §3.3.4}}. Servers "MUST NOT reveal the existence of resources the client is not authorized to access" {{spec §3.3.2}}, so answer a task the caller cannot access with `TaskNotFoundError`.

Every error carries a code, a message, and optional details, each with an `@type` key {{spec §3.3.2}}. JSON-RPC carries them in `error.code`, `error.message`, and `error.data`, with an HTTP status the spec does not set {{spec §9.5}}. The kit and the SDK send `200 OK` {{sdk src/a2a/server/routes/jsonrpc_dispatcher.py}}. The gRPC binding sends `google.rpc.Status`, and HTTP+JSON sends its JSON form in an `error` object. For an A2A error, both hold an `ErrorInfo` with `reason` and the `domain` `a2a-protocol.org` {{spec §10.6}} {{spec §11.6}}. [Errors](#s-errors) reads one of each.

Sources: spec §3.1.1 to §3.1.11, §3.3.2, §3.3.4, §5.4, §9.5, §10.6, §11.6 (research/sources/specification.md); research/brief-spec.md sections 7.1 to 7.5 and 12.1; sdk src/a2a/utils/errors.py and src/a2a/server/routes/jsonrpc_dispatcher.py at v1.2.2; a2a-tck tck/requirements/base.py and tests/compatibility/http_json/test_http_status.py at tag 1.0.0.alpha2 (research/conformance-tools.md); capture/out/10-cancel.http, 11-errors.http, 16-rest-binding.http
