# HTTP+JSON

> HTTP+JSON names each operation with a verb and a path from the proto's `google.api.http` annotations, and sends the request and response messages as plain JSON bodies.

The planner repeats its first test run over the second interface of `test-runner`, `http://localhost:41241/a2a/rest` with the binding `HTTP+JSON`. The same agent and task store answer, in `16-rest-binding.http`, and only the envelope differs from `03-blocking-task.http`.

When you finish this section, you can map any operation to its route, set its content type, and send a `tenant` when the card asks.

## Routes from the proto

Every rpc of `A2AService` carries an `option (google.api.http)` with a verb and a path template {{proto A2AService}}, and §11.3 lists the same routes {{spec §11.3}}. An operation with a request body is a `POST` with `body: "*"`: `/message:send`, `/message:stream`, `/tasks/{id}:cancel`, and `/tasks/{task_id}/pushNotificationConfigs`. Reads are `GET`, and the configuration delete is `DELETE`. [Operations by binding](#s-ref-operations-by-binding) gives all eleven routes with their messages.

For subscribe the proto says `get: "/tasks/{id=*}:subscribe"` {{proto A2AService}}, and §5.3 and §11.3.2 say `POST /tasks/{id}:subscribe` {{spec §5.3}} {{spec §11.3.2}} ([conflict D1](#s-ref-sources)). The reference SDK's server accepts both verbs, and its client sends `POST` {{sdk src/a2a/server/routes/rest_routes.py}} {{sdk src/a2a/client/transports/rest.py}}. The Java and .NET servers accept only `POST` {{sdk-java reference/rest/src/main/java/org/a2aproject/sdk/server/rest/quarkus/A2AServerRoutes.java at v1.4.0.Final}} {{sdk-dotnet src/A2A.AspNetCore/A2AEndpointRouteBuilderExtensions.cs at v1.0.0-preview2}}. So accept both on a server, and send `POST` from a client.

```listing
title: SendMessage over HTTP+JSON, with no envelope
source: capture/out/16-rest-binding.http
lang: http
note: Host and the rest of both bodies are cut. Over JSON-RPC the same reply sits under result, in 03-blocking-task.http.
---
POST /a2a/rest/message:send HTTP/1.1
A2A-Version: 1.0
Content-Type: application/a2a+json

{
  "message": {
    "messageId": "48f165d5-7b00-47f4-b81e-f86f5c8cc1ab",
    "role": "ROLE_USER",
…
HTTP/1.1 200 OK
Content-Type: application/a2a+json

{
  "task": {
    "id": "bbfb9ea5-50ea-4441-b991-2a8ba0d6f3f3",
    "contextId": "41c0d462-fed8-4f6b-8569-6c9afe9497c3",
…
```

## Query parameters and content types

`GET` and `DELETE` carry no body, so their request fields travel "as path parameters or query parameters" {{spec §11.5}}, in camelCase. `GetTask` puts the task `id` in the path and `historyLength` in the query. `ListTasks` takes `contextId`, `status`, `pageSize`, `pageToken`, `historyLength`, `statusTimestampAfter`, and `includeArtifacts` {{proto ListTasksRequest}} {{spec §11.5}}. A nested object cannot go in a query string, so that request must be a `POST` {{spec §11.5}}. [Figure](#fig-two-json-bindings) sets both operations beside their JSON-RPC form.

```figure
id: fig-two-json-bindings
kind: comparison
title: SendMessage and GetTask in two JSON bindings
claim: JSON-RPC posts every operation to one URL and names it in the body, HTTP+JSON names it with a verb and a path, and gRPC calls an rpc.
caption: Each row is one operation, headed by its rpc line from a2a.proto. Bold marks where each binding names the operation, and italic type names stand for the message that fills that place. Left, capture/out/03-blocking-task.http and 04-polling.http. Right, capture/out/16-rest-binding.http. Ids shortened to 8 characters.
```

"application/a2a+json **SHOULD** be used for requests and responses" {{spec §11.1}}, and the kit sends it on every body. The reference SDK sends its errors as `application/json` {{sdk src/a2a/utils/error_handlers.py}}, and the Java and Go servers send every body that way {{sdk-java transport/rest/src/main/java/org/a2aproject/sdk/transport/rest/handler/RestHandler.java at v1.4.0.Final}} {{sdk-go a2asrv/rest.go at v2.6.0}}. So send `application/a2a+json`, and accept both types when you read.

## Streams and errors

A stream is the same `text/event-stream` response as in JSON-RPC {{spec §11.7}}. Each `data:` line holds the `StreamResponse` alone, with no envelope. No capture records a stream in this binding, so [streaming and subscribing](#s-streaming-and-subscribe-to-task) shows the JSON-RPC frames.

An error uses the HTTP status code and the JSON form of `google.rpc.Status` in an `error` object {{spec §11.6}}. Exchanges 3 and 4 of the record show two, and [Errors](#s-errors) reads that body.

## The tenant field

**Tenant:** an optional string on an interface, "An opaque string used for routing requests to a specific agent" {{proto AgentInterface}} or to one tenant when several agents share one endpoint. The same `tenant` field sits on all ten request messages, from `SendMessageRequest` to `GetExtendedAgentCardRequest` {{proto SendMessageRequest}} {{proto GetExtendedAgentCardRequest}}. A client copies the card's value into every request, and must "omit the field if `tenant` is not set in that entry" {{spec §8.3.2}}. The protocol gives the value no format, and no kit card sets one.

Here the value can also travel in the path. Every rpc has a second `google.api.http` form with a `/{tenant}` prefix, such as `post: "/{tenant}/message:send"` {{proto A2AService}}. Only the proto lists these routes, and §5.3, §11.3, and §11.5 show the plain ones {{spec §11.3}}. In JSON-RPC the value is `params.tenant`, and in gRPC it is the message field. The migration guide calls this "Native tenant scoping in gRPC requests" {{docs whats-new-v1}}, which understates it.

The project's guide names three routing keys for several agents on one host: a URL prefix, the credential, and the `tenant` field {{docs multi-tenancy}}. "The three approaches are not mutually exclusive." {{docs multi-tenancy}}

The reference SDK's client wraps the transport in a `TenantTransportDecorator` when the chosen interface sets a tenant {{sdk src/a2a/client/client_factory.py}} {{sdk src/a2a/client/transports/tenant_decorator.py}}. Its HTTP+JSON transport puts the value in the path prefix {{sdk src/a2a/client/transports/rest.py}}. Its server mounts every route again under `/{tenant}`, copies the value into the call context, and never compares it with the card {{sdk src/a2a/server/routes/rest_routes.py}} {{sdk src/a2a/server/routes/rest_dispatcher.py}}. The agent reads `RequestContext.tenant` and decides what it means {{sdk src/a2a/server/agent_execution/context.py}}.

```takeaways
- Build each route from the proto's `google.api.http` annotation, and accept `GET` and `POST` on `:subscribe`.
- Send `application/a2a+json`, and accept `application/json` as well when you read.
- Put the fields of a `GET` or `DELETE` in the path or the query string, in camelCase.
- Copy the interface's `tenant` into every request, and omit it when the card sets none.
```

Sources: spec §5.3, §8.3.2, §11.1, §11.3, §11.3.2, §11.5, §11.6, §11.7 (research/sources/specification.md); proto A2AService, AgentInterface, SendMessageRequest, GetTaskRequest, ListTasksRequest, GetExtendedAgentCardRequest (research/sources/a2a.proto); docs multi-tenancy, whats-new-v1 (research/sources/docs.md); sdk src/a2a/server/routes/rest_routes.py, src/a2a/server/routes/rest_dispatcher.py, src/a2a/server/agent_execution/context.py, src/a2a/client/client_factory.py, src/a2a/client/transports/tenant_decorator.py, src/a2a/client/transports/rest.py, src/a2a/utils/error_handlers.py (a2a-python 1.2.2); sdk-java reference/rest/src/main/java/org/a2aproject/sdk/server/rest/quarkus/A2AServerRoutes.java, transport/rest/src/main/java/org/a2aproject/sdk/transport/rest/handler/RestHandler.java at v1.4.0.Final; sdk-dotnet src/A2A.AspNetCore/A2AEndpointRouteBuilderExtensions.cs at v1.0.0-preview2; sdk-go a2asrv/rest.go at v2.6.0; capture/out/16-rest-binding.http, 03-blocking-task.http, 04-polling.http; capture/a2a_ref.py
