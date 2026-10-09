# gRPC

> The gRPC binding is the proto itself: the eleven rpcs of `A2AService` in package `lf.a2a.v1`, carried over HTTP/2 with TLS, with the service parameters in metadata.

The planner reads three cards and finds only `JSONRPC` and `HTTP+JSON` interfaces, so no call in `19-planner.http` uses gRPC. The kit is standard library only, and the standard library has no gRPC, so no capture in this manual shows a gRPC call. The reference SDK's sample agent lists a third interface, `protocol_binding='GRPC'` at a plain host and port {{sdk samples/hello_world_agent.py}}.

When you finish this section, you can read a `GRPC` interface, call `A2AService` from a generated stub, and read its errors and streams.

## The service

The binding has four requirements: "gRPC over HTTP/2 with TLS", the normative definition in `specification/a2a.proto`, "Protocol Buffers version 3", and the `A2AService` service {{spec §10.1}}. The file declares `package lf.a2a.v1`, so the full service name is `lf.a2a.v1.A2AService` {{proto A2AService}}. Its eleven rpcs carry the same PascalCase names as the JSON-RPC methods, and [operations by binding](#s-ref-operations-by-binding) lists them with their messages.

Two rpcs return `stream StreamResponse`: `SendStreamingMessage` and `SubscribeToTask` {{proto A2AService}} {{spec §10.7}}. The other nine are unary, and none takes a client stream. Each rpc also carries the `google.api.http` annotation that defines its HTTP+JSON route, as [HTTP+JSON](#s-http-json) shows:

```listing
title: the streaming send, as the proto defines it
source: research/sources/a2a.proto
lang: text
note: The rpc with its HTTP annotation, complete. The additional_bindings block is the tenant route.
---
  // Sends a streaming message to an agent, allowing for real-time interaction and status updates.
  // Streaming version of `SendMessage`
  rpc SendStreamingMessage(SendMessageRequest) returns (stream StreamResponse) {
    option (google.api.http) = {
      post: "/message:stream"
      body: "*"
      additional_bindings: {
        post: "/{tenant}/message:stream"
        body: "*"
      }
    };
  }
```

A card names this binding with `protocolBinding` set to `GRPC` {{proto AgentInterface}}. At the tag the proto wants an absolute HTTPS URL for every interface, while a gRPC client dials a host and port ([conflict D34](#s-ref-sources)). [AgentCard fields](#s-agentcard-fields) notes the same gap. [PR #1997](https://github.com/a2aproject/A2A/pull/1997) changed the comment on main to the form `hostname:port`, the one change queued for release 1.0.2, not yet released.

## Metadata, errors, and streams

The two service parameters "MUST be transmitted using gRPC metadata (headers)" {{spec §10.2}}. gRPC lowercases metadata keys, so the keys are `a2a-version` and `a2a-extensions`, and servers "SHOULD validate required service parameters (e.g., `A2A-Version`) from metadata" {{spec §10.2}}. The §10.2 sample sends `a2a-version` with the old example value `0.3` {{spec §10.2}}, so send `1.0` from a 1.0 client, as [A2A-Version and A2A-Extensions](#s-version-and-extension-headers) explains.

An error is a `google.rpc.Status` with `status.code`, `status.message`, and `status.details` {{spec §10.6}}. For an A2A error the details "MUST include a `google.rpc.ErrorInfo` message" {{spec §10.6}}. Its `reason` is the error name in upper snake case without `Error`, such as `TASK_NOT_FOUND`, and its `domain` is `a2a-protocol.org` {{spec §10.6}}. The table in [errors](#s-errors) gives the status of each error, and `FAILED_PRECONDITION` covers six of the nine, so read the reason.

A stream is a server-streaming rpc, and each message is one `StreamResponse` with one of `task`, `message`, `status_update`, or `artifact_update` {{spec §10.7}} {{proto StreamResponse}}. The stream ends when the rpc completes with its status, and the Go server returns `OK` when its event sequence ends {{sdk-go a2agrpc/v1/handler.go at v2.6.0}}. [Figure](#fig-grpc-call) follows one streaming call from the request to that end.

```figure
id: fig-grpc-call
kind: sequence
title: one SendStreamingMessage call over gRPC
claim: One rpc sends the request with its metadata, the server streams StreamResponse messages until the task ends, and the rpc status closes the stream.
caption: Read top to bottom. The client sends one SendMessageRequest with a2a-version in its metadata, and each reply is one StreamResponse payload. Names are the proto's, because the kit has no gRPC capture, so no values are shown. From research/sources/a2a.proto.
```

## SDK support

| SDK | gRPC server | gRPC client | How to enable it |
|---|---|---|---|
| a2a-python 1.2.2 | `GrpcHandler` {{sdk src/a2a/server/request_handlers/grpc_handler.py}} | `GrpcTransport` {{sdk src/a2a/client/transports/grpc.py}} | `pip install a2a-sdk[grpc]`, register the handler as the servicer, and list `GRPC` in the client factory {{sdk src/a2a/client/client_factory.py}} |
| a2a-js 1.3.0 | `grpcService`, Node only {{sdk-js src/server/grpc/grpc_service.ts at v1.3.0}} | `GrpcTransport` | add `GrpcTransportFactory`, which the default factory omits {{sdk-js src/client/factory.ts at v1.3.0}} |
| a2a-go 2.6.0 | `a2agrpc/v1.NewHandler` {{sdk-go a2agrpc/v1/handler.go at v2.6.0}} | `a2agrpc/v1.WithGRPCTransport` | add the transport option, which the default client omits {{sdk-go a2aclient/factory.go at v2.6.0}} |
| a2a-java 1.4.0.Final | `transport/grpc` and the Quarkus `reference/grpc` server | `client/transport/grpc` | add the Maven modules {{sdk-java README.md at v1.4.0.Final}} |
| a2a-dotnet 1.0.0-preview2 | none, only the name constant {{sdk-dotnet src/A2A/Client/ProtocolBindingNames.cs at v1.0.0-preview2}} | none | `A2A.Grpc.AspNetCore` and `A2A.Grpc` exist on main, not yet released |
| a2a-rs, a2a-grpc 0.3.9 | `GrpcHandler` in the `a2a-grpc` crate | `GrpcTransport` in the same crate | register it yourself, because the client factory lists JSON-RPC and HTTP+JSON only {{sdk-rust a2a-client/src/factory.rs at a2a-server-lf-v0.5.1}} |

The servers differ on the version check: the Python, Go, and Rust gRPC servers never read `a2a-version`, as the table in [A2A-Version and A2A-Extensions](#s-version-and-extension-headers) shows.

One custom binding exists in the project today, SLIMRPC: Protocol Buffers RPC over SLIM instead of HTTP/2. A card names it `https://a2a-protocol.org/bindings/experimental-slimrpc/v1`, and [its repository](https://github.com/a2aproject/experimental-cpb-slimrpc) marks it experimental. A custom binding "SHOULD be identified by a URI" {{spec §5.8}}, and the project's guide gives the rules for one {{docs custom-protocol-bindings}}.

```takeaways
- Generate the stub from `specification/a2a.proto`, package `lf.a2a.v1`, and keep its rpc names.
- Send `a2a-version` and `a2a-extensions` as lowercase metadata keys on every call.
- Read `ErrorInfo.reason` from `status.details`, because `FAILED_PRECONDITION` covers six A2A errors.
- Register the gRPC transport yourself in the JS, Go, and Rust client factories.
```

Sources: spec §5.8, §10, §10.1, §10.2, §10.6, §10.7 (research/sources/specification.md); proto A2AService, AgentInterface, StreamResponse (research/sources/a2a.proto); docs custom-protocol-bindings (research/sources/docs.md); sdk samples/hello_world_agent.py, src/a2a/server/request_handlers/grpc_handler.py, src/a2a/client/transports/grpc.py, src/a2a/client/client_factory.py (a2a-python 1.2.2); sdk-go a2agrpc/v1/handler.go, a2aclient/factory.go at v2.6.0; sdk-js src/server/grpc/grpc_service.ts, src/client/factory.ts at v1.3.0; sdk-java README.md at v1.4.0.Final; sdk-dotnet src/A2A/Client/ProtocolBindingNames.cs at v1.0.0-preview2; sdk-rust a2a-client/src/factory.rs at a2a-server-lf-v0.5.1; capture/out/01-agent-cards.http, 19-planner.http; capture/README.md
