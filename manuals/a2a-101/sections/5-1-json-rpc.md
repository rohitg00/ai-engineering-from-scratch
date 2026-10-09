# JSON-RPC

> JSON-RPC posts every operation to one URL, names it in `method`, carries the request message in `params`, and returns the response message or an error in a 200 reply.

The planner asks `code-reviewer` a question before it sends any diff: "What languages can you review?". The card lists `http://localhost:41242/a2a/jsonrpc` with the binding `JSONRPC`, so the planner sends one POST to that URL. The reviewer answers with a message and no task, and the record is `02-message-reply.http`.

When you finish this section, you can write any A2A call as a JSON-RPC request and read its reply, its stream frames, and its errors.

## The envelope

**Protocol binding:** the form the eleven operations take on one transport, with its names, routes, envelopes, headers, and error shapes. Three are standard: JSON-RPC {{spec §9}}, gRPC {{spec §10}}, and HTTP+JSON {{spec §11}}, and a card names each one in `protocolBinding` {{proto AgentInterface}}. The Core Concepts guide still says "JSON-RPC 2.0 is used as the payload format for all requests and responses" {{docs key-concepts}}, which describes one binding of three ([conflict D27](#s-ref-sources)).

A JSON-RPC request is one JSON object with four members {{spec §9.3}}. `jsonrpc` is always `2.0`, the client chooses `id`, `method` holds the operation name, and `params` holds the request message. The names are "PascalCase method names matching gRPC conventions" {{spec §9.1}}, so `method` holds `SendMessage` or `GetTask`, the rpc names of `A2AService` {{proto A2AService}}. The template in §9.3 still shows the 0.3 style, `"method": "category/action"` {{spec §9.3}}, so copy the names from §9.1 or from [operations by binding](#s-ref-operations-by-binding) ([conflict D14](#s-ref-sources)). The kit answers the old name `message/send` with `-32601`, as exchange 3 of `11-errors.http` shows.

The reply repeats the request's `id` and holds the response message in `result` {{spec §9.4.1}}. For `SendMessage` that message is a `SendMessageResponse` with one `task` or one `message` {{proto SendMessageResponse}}:

```listing
title: a question and its direct answer over JSON-RPC
source: capture/out/02-message-reply.http
lang: http
note: The Host and A2A-Version headers and the parts of both messages are cut. [Send message](#s-send-message) explains when the result is a message and when it is a task.
---
POST /a2a/jsonrpc HTTP/1.1
Content-Type: application/json
…
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "SendMessage",
  "params": {
    "message": {
      "messageId": "d95bafc8-f2a4-427b-9cf4-bb99f4bea973",
      "role": "ROLE_USER",
…
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "message": {
      "messageId": "3b4b1206-4b6f-467f-b735-2d7e4f7f4bcd",
      "contextId": "dc423c62-d5f4-48e5-82c0-4963b9bc4334",
      "role": "ROLE_AGENT",
…
```

## One URL, one content type

Every call is a POST to the URL of the chosen interface, because the binding is "JSON-RPC 2.0 over HTTP(S)" {{spec §9.1}}. The path carries no operation name, and the kit serves all eleven operations at `/a2a/jsonrpc`. Both the request and the reply use `application/json` {{spec §9.1}}, where HTTP+JSON uses its own type, as [HTTP+JSON](#s-http-json) explains.

The headers beside the body are the two service parameters, `A2A-Version` and `A2A-Extensions`, which "MUST be transmitted using standard HTTP request headers" in this binding {{spec §9.2}}. [A2A-Version and A2A-Extensions](#s-version-and-extension-headers) gives their rules and what each SDK does without them.

## Streams as SSE frames

`SendStreamingMessage` and `SubscribeToTask` answer with `Content-Type: text/event-stream` instead of one JSON body {{spec §9.4.2}}. Each `data:` line is a complete JSON-RPC response: the same `id` as the request, and one `StreamResponse` in `result` {{spec §9.4.2}} {{proto StreamResponse}}. So one parser reads both the single reply and every frame.

```listing
title: the first two frames of a stream, each a full JSON-RPC response
source: capture/out/05-streaming.http
lang: sse
note: The request and the inside of each frame are cut. The file holds all nine frames, and 05-streaming.events.json prints them in full.
---
HTTP/1.1 200 OK
Content-Type: text/event-stream

data: {"jsonrpc": "2.0", "id": 1, "result": {"task": {"id": "728ba084-97eb-422b-b94b-b0fe9153ce2c", …

data: {"jsonrpc": "2.0", "id": 1, "result": {"statusUpdate": {"taskId": "728ba084-97eb-422b-b94b-b0fe9153ce2c", …
```

An HTTP+JSON frame carries the `StreamResponse` alone, and gRPC returns a server-streaming rpc, as [HTTP+JSON](#s-http-json) and [gRPC](#s-grpc) show. In every binding the frames carry the same four payloads and end for the same reasons, which [streaming and subscribing](#s-streaming-and-subscribe-to-task) covers.

## Errors in the same envelope

A failed call is still a JSON-RPC response: an `error` member with `code`, `message`, and `data` replaces `result` {{spec §9.5}}. The specification sets no HTTP status for that case, and the kit and the reference SDK send `200` {{sdk src/a2a/server/routes/jsonrpc_dispatcher.py}}. The A2A errors take the codes `-32001` to `-32009`, and the detail that names each one is in `data`. [Errors](#s-errors) reads them in every binding.

```takeaways
- Post every operation to the one JSON-RPC URL on the card, with the PascalCase name in `method`.
- Send `Content-Type: application/json`, and read the response message from `result`.
- Parse each SSE `data:` line as a complete JSON-RPC response with the request's `id`.
- Check every reply and frame for an `error` member before you read `result`.
```

Sources: spec §9, §9.1, §9.2, §9.3, §9.4.1, §9.4.2, §9.5, §10, §11 (research/sources/specification.md); proto AgentInterface, A2AService, SendMessageResponse, StreamResponse (research/sources/a2a.proto); docs key-concepts (research/sources/docs.md); sdk src/a2a/server/routes/jsonrpc_dispatcher.py (a2a-python 1.2.2); capture/out/02-message-reply.http, 05-streaming.http, 05-streaming.events.json, 11-errors.http; capture/a2a_ref.py
