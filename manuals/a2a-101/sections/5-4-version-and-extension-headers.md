# A2A-Version and A2A-Extensions

> Two service parameters travel as HTTP headers or gRPC metadata on every request, and a missing `A2A-Version` means 0.3, which a 1.0 agent must refuse.

The kit sends `test-runner` a `SendMessage` with only `Host` and `Content-Type` headers, as a client that forgot the version would. The agent answers `-32009` and reports the request as `0.3 (no header)`, in exchange 2 of `11-errors.http`. Every other request in the captures carries `A2A-Version: 1.0`.

When you finish this section, you can set both headers in any binding and predict what each SDK does without a version.

## Service parameters

**Service parameter:** "A key-value map for passing horizontally applicable context or parameters with case-insensitive string keys and case-sensitive string values." {{spec §3.2.6}} The specification defines two, `A2A-Version` and `A2A-Extensions`, and reserves the prefix `a2a-` for its own {{spec §3.2.6}}. Each binding says how they travel: as HTTP request headers in JSON-RPC and HTTP+JSON {{spec §9.2}} {{spec §11.2}}, and as metadata keys in gRPC {{spec §10.2}}. A custom binding "MUST document how service parameters are transmitted" {{spec §12.3}}.

The IANA templates for both headers cite "Section 3.2.5 of the A2A Protocol Specification" {{spec §14.2.1}} {{spec §14.2.2}}, which is the metadata section, where the parameters are §3.2.6 ([conflict D17](#s-ref-sources)). [Issue #2305](https://github.com/a2aproject/A2A/issues/2305) tracks it, still open.

## A2A-Version

A version is `Major.Minor`, such as `1.0`, and "Patch version numbers SHOULD NOT be used in requests, responses and Agent Cards" {{spec §3.6}}. "Clients MUST send the `A2A-Version` header with each request" {{spec §3.6.1}}, and a 1.0 client sends `1.0`. A server has two duties: process the request with the semantics of that version, and return `VersionNotSupportedError` when the interface does not support it {{spec §3.6.2}}. The empty case has a fixed meaning: "Agents MUST interpret empty value as 0.3 version" {{spec §3.6.2}}. So a client that forgets the header gets 0.3 semantics from an agent that still serves 0.3, and this error from one that does not:

```listing
title: no A2A-Version header, read as 0.3 and refused
source: capture/out/11-errors.http
lang: http
note: The request body and the error details are cut down. The request carries only Host and Content-Type, and the kit speaks only 1.0.
---
POST /a2a/jsonrpc HTTP/1.1
Host: localhost:41241
Content-Type: application/json
…
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32009,
    "message": "Protocol version not supported",
…
          "requested": "0.3 (no header)",
          "supported": "1.0"
```

`VersionNotSupportedError` is `-32009` in JSON-RPC, `400` in HTTP+JSON, and `FAILED_PRECONDITION` in gRPC, with the reason `VERSION_NOT_SUPPORTED` {{spec §5.4}}, as [errors](#s-errors) lists. The version to send comes from the card: each `supportedInterfaces` entry declares its own `protocolVersion`, and "Agents CAN expose multiple interfaces for the same transport with different versions" {{spec §3.6.2}}, as [AgentCard fields](#s-agentcard-fields) shows.

Three samples in the specification send `A2A-Version: 0.3` {{spec §9.2}} {{spec §11.2}} {{spec §14.2.1}}, and the gRPC sample in §10.2 sends the same value as metadata {{spec §10.2}}. Never copy a sample's value into a 1.0 client ([conflict D39](#s-ref-sources)). §3.6.1 also says "Clients MAY provide the `A2A-Version` as a request parameter instead of a header" {{spec §3.6.1}}, while both JSON bindings require the header ([conflict D31](#s-ref-sources)). The reference SDK reads only the header {{sdk src/a2a/utils/version_validator.py}}, and the kit reads both, so send the header.

## What each SDK does without the header

| Implementation | Missing or empty header | Accepted values | Where it checks |
|---|---|---|---|
| kit, `a2a_ref.py` | refused as `0.3 (no header)` | exactly `1.0`, from the header or the query parameter | JSON-RPC and HTTP+JSON |
| a2a-python 1.2.2 | read as `0.3`, then refused | `1`, `1.0`, `1.0.0`, and `1.5`, because only the major must be 1 {{sdk src/a2a/utils/version_validator.py}} | JSON-RPC and HTTP+JSON, never gRPC {{sdk src/a2a/server/request_handlers/grpc_handler.py}} |
| a2a-js 1.3.0 | read as `0.3`, refused unless the card lists it | only the strings the card declares for that binding, so `1.0.0` is refused {{sdk-js src/server/version.ts at v1.3.0}} | all three bindings |
| a2a-java 1.4.0.Final | read as `0.3`, then refused | the same major, in `major.minor` form, so `1` is refused {{sdk-java server-common/src/main/java/org/a2aproject/sdk/server/version/A2AVersionValidator.java at v1.4.0.Final}} | all three, with gRPC `UNIMPLEMENTED` instead of `FAILED_PRECONDITION` |
| a2a-go 2.6.0 | accepted | anything, because no server code reads the header {{sdk-go a2a/svcparams.go at v2.6.0}} | nowhere |
| a2a-dotnet 1.0.0-preview2 | accepted as 1.0 | `1.0` or `0.3`, with `0.3` processed as 1.0 {{sdk-dotnet src/A2A.AspNetCore/A2AJsonRpcProcessor.cs at v1.0.0-preview2}} | JSON-RPC only |
| a2a-rs, a2a-server 0.5.1 | read as `0.3`, then refused | major 1 {{sdk-rust a2a-server/src/jsonrpc.rs at a2a-server-lf-v0.5.1}} | JSON-RPC only |

Every client in the list sends `1.0` on each call, and the Python and JS clients send it on the card fetch too. So send the literal string `1.0`, never a patch number, and never rely on a server to refuse a missing header.

## A2A-Extensions

`A2A-Extensions` is a "Comma-separated list of extension URIs that the client wants to use for the request" {{spec §3.2.6}}, one header field in both JSON bindings {{spec §9.2}} {{spec §11.2}} and one metadata entry in gRPC {{spec §10.2}}. §4.6.1 also allows "JSON-RPC request parameters" as the mechanism {{spec §4.6.1}}, while §9.2 requires the header, so send the header ([conflict D30](#s-ref-sources)). The reference SDK's `with_a2a_extensions` helper joins the URIs with commas on the client {{sdk src/a2a/client/service_parameters.py}}, and its server reads them into the call context {{sdk src/a2a/server/routes/common.py}}. What the server does with them, the payload keyed by URI, and `ExtensionSupportRequiredError` are in [extensions](#s-extensions).

```takeaways
- Send `A2A-Version: 1.0` as a header or metadata on every request, with no patch number.
- Refuse a request without `A2A-Version` with `VersionNotSupportedError` when you serve only 1.0.
- Never rely on the query parameter or on a server to reject a missing version.
- Send `A2A-Extensions` as one comma-separated header field, never as a request parameter.
```

Sources: spec §3.2.6, §3.6, §3.6.1, §3.6.2, §4.6.1, §5.4, §9.2, §10.2, §11.2, §12.3, §14.2.1, §14.2.2 (research/sources/specification.md); sdk src/a2a/utils/version_validator.py, src/a2a/server/request_handlers/grpc_handler.py, src/a2a/client/service_parameters.py, src/a2a/server/routes/common.py (a2a-python 1.2.2); sdk-js src/server/version.ts at v1.3.0; sdk-java server-common/src/main/java/org/a2aproject/sdk/server/version/A2AVersionValidator.java at v1.4.0.Final; sdk-go a2a/svcparams.go at v2.6.0; sdk-dotnet src/A2A.AspNetCore/A2AJsonRpcProcessor.cs at v1.0.0-preview2; sdk-rust a2a-server/src/jsonrpc.rs at a2a-server-lf-v0.5.1; capture/out/11-errors.http, 01-agent-cards.http; capture/a2a_ref.py
