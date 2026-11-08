---
id: a2a-version-header-missing
title: Two errors from a client that forgot the version
card: protocols
kind: debug
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer, ai-developer-relations-engineer]
rounds: [debugging, coding]
tags: [a2a, versioning, json-rpc, migration, headers]
minutes: 8
lessons: []
manuals: [a2a-101#s-version-and-extension-headers, a2a-101#s-from-0-3-to-1-0]
practice: []
cheatsheet: [a2a, a2a-and-agent-messaging]
related: [protocols/a2a-card-before-the-call, protocols/a2a-rejected-task-loop]
updated: 2026-11-03
---

A client written for an older A2A release calls a current agent. Its first `SendMessage` carries only `Host` and `Content-Type` headers and gets HTTP 200 with a JSON-RPC error, code `-32009`. Its second call sends `A2A-Version: 1.0`, names the method `message/send` and gets code `-32601`. Explain both replies, and name the two changes the client needs.

## Short answer

Both replies are a current server reading an old client. An empty `A2A-Version` must be read as version 0.3, and an interface that serves only 1.0 answers `VersionNotSupportedError`; the recorded run reported the request as `0.3 (no header)` against `supported: 1.0`. `message/send` is the old method name, and 1.0 uses the PascalCase rpc names such as `SendMessage`, so the second call is method-not-found. The client must send `A2A-Version: 1.0` on every request and switch to the 1.0 names.

## Full answer

### The version header

`A2A-Version` and `A2A-Extensions` are service parameters. They travel as HTTP request headers in the JSON-RPC and HTTP+JSON bindings and as lowercase metadata keys in gRPC. A version is `Major.Minor`, and requests, responses and cards should not carry a patch number. The server has two duties: process the request with the semantics of that version, and return `VersionNotSupportedError` when the interface does not support it. The error is `-32009` in JSON-RPC, `400` in HTTP+JSON and `FAILED_PRECONDITION` in gRPC.

Never rely on the server to refuse a missing header. In the recorded SDK comparison, one server never reads the header at all, and another accepts a missing one as 1.0. Three samples in the specification itself still send the old value, so copy the value from the card's `protocolVersion`, not from a sample.

### What else changed

| Area | Old | 1.0 |
|---|---|---|
| method names | `message/send`, `tasks/get`, `tasks/resubscribe` | `SendMessage`, `GetTask`, `SubscribeToTask` |
| task states and roles | `"working"`, `"user"` | `TASK_STATE_WORKING`, `ROLE_USER` |
| parts | `TextPart`, `FilePart`, `DataPart` with `kind` | one `Part` whose `text`, `raw`, `url` or `data` member names the type |
| end of a stream | `final: true` on the last status update | the binding closes the stream |
| card endpoint | `url`, `preferredTransport`, `additionalInterfaces` | `supportedInterfaces[]` with `url`, `protocolBinding`, `protocolVersion` |
| errors | problem details | a `Status` object with an `ErrorInfo` detail, plus `-32008` and `-32009` |

### The change the migration guide misses

The old `blocking` flag defaulted to false, so a send returned at once. Its replacement `returnImmediately` also defaults to false, which now means the send waits for a terminal or interrupted state. A migrated client that polls after a send must set `returnImmediately: true`, or it holds one request open for the whole task.

### Serving old clients during the overlap

Each SDK has a 0.3 layer. The reference SDK takes a flag on its route builders plus a second `AgentInterface` with `protocolVersion` `0.3` on the card, and routes by method name before the version check. Others route by the header or by a second URL. The proto is normative where the migration guide names a field the proto lacks.

## Follow-ups

- **Level 2:** Why send `1.0` and not the release `1.0.1`? Expected: the version is `Major.Minor`; no patch number travels in requests, responses or cards.
- **Level 3:** After the fix, the client's sends hang for the length of each task. Why? Expected: the old `blocking` default was false and the new `returnImmediately` default is also false, which now means wait; set it to true and poll or subscribe.
- **Level 3:** Will every server reject a request that carries no version at all? Expected: no; one SDK never reads the header and another accepts its absence, so the client must send it on every call.
- **Level 4:** You must serve both old and new clients for a quarter. What do you change on the server? Expected: turn on the SDK's 0.3 layer, add a second interface with `protocolVersion` `0.3` to the card, and route by header, method name or URL as that SDK does.

## Wrong answers

- "HTTP 200 means the call worked." JSON-RPC errors arrive inside a 200 response; read the `error` member before `result`.
- "Send the version as a query parameter instead." Both JSON bindings require the header, and the reference SDK reads only the header.
- "The method name is case-insensitive." The names are exact PascalCase rpc names, and the old slash form is unknown to a 1.0 server.

## Taught in

The [version header section](../../../manuals/a2a-101/sections/5-4-version-and-extension-headers.md) shows the recorded `-32009` and each SDK's behavior, and the [migration section](../../../manuals/a2a-101/sections/7-4-from-0-3-to-1-0.md) maps every renamed field.
