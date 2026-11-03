---
id: two-error-layers
title: A protocol error is not a tool error
card: protocols
kind: concept
level: 1
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [screen, coding]
tags: [mcp, json-rpc, iserror, output-schema, tools]
minutes: 6
lessons: [phases/13-tools-and-protocols/07-building-an-mcp-server, phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content]
manuals: []
practice: []
cheatsheet: [mcp-server-build]
related: [protocols/tool-resource-or-prompt]
updated: 2026-11-03
---

Your MCP server has a tool `route_report` that reads a report from an upstream source. A reviewer reads the handler and finds two things. When the upstream source is down, the handler returns a JSON-RPC error. When a client sends a tool name that the server does not know, the handler returns a result with `isError: true`. Is that the right way round?

## Short answer

No, both cases are backwards. A JSON-RPC error means the request could not be dispatched at all: an unknown tool name, a malformed envelope, missing request metadata or an invalid cursor. A complete result with `isError: true` means a valid call reached the tool and the tool reports a failure the model can act on, such as a source that is unavailable right now.

## Full answer

### Two layers, two audiences

| Layer | Use it for | Who repairs it |
|---|---|---|
| JSON-RPC `error` | the envelope or the method parameters are invalid | the client or the developer |
| result with `isError: true` | the tool ran and reports an actionable failure | often the model, by changing arguments or waiting |

A model can read "report source unavailable" and try later or tell the user. It cannot repair a server that rejected a well-formed request as a tool failure, because it does not know that the request never ran.

### The output schema still holds

Once a server publishes an `outputSchema`, every complete result commits to conforming `structuredContent`. The `isError` flag classifies the outcome. It does not waive the contract. So model the failure inside the schema. The sample `route_report` failure returns its requested region with `accepted: false`, plus error text, plus `isError: true`.

### Wrong codes send the wrong signal

Missing request metadata is invalid params, `-32602`. An unsupported protocol version is `-32022` with `requested` and `supported` in the error data. An unknown method is a method-not-found error. Keep those distinct, because a client reads the code to decide whether to correct the request, retry another version, or stop.

### Annotations do not decide any of this

`readOnlyHint`, `destructiveHint`, `idempotentHint` and `openWorldHint` are hints for presentation and confirmation. The server still enforces authorization, and the client still validates results.

## Follow-ups

- **Level 1:** A request arrives without the protocol version in `params._meta`. Which code? Expected: `-32602`, invalid params, never filled in from an earlier call.
- **Level 2:** The tool publishes an output schema. Must an error result match it? Expected: yes; every complete result, with `isError: true` included, must return conforming `structuredContent`.
- **Level 2:** Why does the host validate `structuredContent` instead of trusting the descriptor? Expected: a server can violate its own schema, a model cannot repair that, so the client validates before model use.
- **Level 3:** A valid tool call has an argument that fails the input schema. Which layer? Expected: method parameters are invalid, so a JSON-RPC error; the capstone's TypeScript model instead returns a complete result with `isError: true` without invoking the executor, so name your choice and apply it everywhere.

## Wrong answers

- "Return `isError` for everything so the model always gets text." A malformed envelope then looks like a tool failure, and the model retries a request that can never run.
- "An unknown tool is a tool failure." The call never reached a tool, so it is a dispatch error at the protocol layer.
- "An error result can skip the output schema." The flag classifies the outcome, and the published contract still holds.

## Taught in

The [server lesson](../../../phases/13-tools-and-protocols/07-building-an-mcp-server/) names the two layers, and the [tool contracts lesson](../../../phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content/) binds error results to the output schema.
