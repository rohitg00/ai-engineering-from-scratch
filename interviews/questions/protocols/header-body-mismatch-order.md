---
id: header-body-mismatch-order
title: The gateway that authorized a read and ran a delete
card: protocols
kind: debug
level: 3
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [debugging, system-design]
tags: [mcp, streamable-http, headers, gateway, validation-order]
minutes: 10
lessons: [phases/13-tools-and-protocols/06-mcp-fundamentals, phases/13-tools-and-protocols/09-mcp-transports, phases/13-tools-and-protocols/15-mcp-security-tool-poisoning]
manuals: []
practice: []
cheatsheet: [mcp-gateways-operations, mcp-security-auth]
related: [protocols/post-only-streamable-http, protocols/descriptor-pin-rug-pull]
updated: 2026-11-03
---

A gateway in front of an MCP server authorizes each `tools/call` by reading the `Mcp-Name` header and checking it against the caller's role. The origin server behind it executes `params.name` from the JSON body. An attacker sends `Mcp-Name: notes.read` with a body whose `params.name` is `notes.delete`. The gateway also rejects an unsupported `MCP-Protocol-Version` before it looks at anything else. Walk through what happens, and give the validation order you would ship.

## Short answer

The gateway approves a read while the origin runs a delete, because two components decide from two different fields. Ship one fixed order: validate the JSON-RPC and metadata types, compare every mirrored header with the body, and only after equality is proven check whether the matched version is supported. A disagreement is HTTP `400` with `-32020` even when one of the two version values is unsupported, so the request dies before a backend is selected, a role is checked or a rate-limit token is spent.

## Full answer

### The mirrored headers

| Header | Must equal |
|---|---|
| `MCP-Protocol-Version` | `params._meta.io.modelcontextprotocol/protocolVersion` |
| `Mcp-Method` | the JSON-RPC `method` |
| `Mcp-Name` | `params.name`, or `params.uri` for `resources/read` |

Header names are case-insensitive. Header values are case-sensitive. A non-ASCII or unsafe name travels as the `=?base64?{value}?=` sentinel, and the server decodes it before the comparison.

### The order and the codes

1. Parse one envelope. Confirm `jsonrpc` is `"2.0"`, an `id` exists on a request (a notification has none), `method` is a string and `params` is an object.
2. Require the version string and the capability object in `params._meta`. Missing or malformed metadata is `-32602`.
3. Compare each mirrored header with the body. A mismatch is HTTP `400` with `-32020`, even when one value is unsupported.
4. With equality established, reject a matched but unsupported version with HTTP `400` and `-32022`, with data exactly `{"supported":["2026-07-28"],"requested":"<actual>"}`.
5. Check required capabilities, route by `method`, validate method-specific arguments.
6. Authenticate and authorize the concrete operation before its handler runs.
7. Return a complete result with server identity, then forget the request-scoped metadata.

An unknown method is HTTP `404` with `-32601`. A notification has no `id` and receives no JSON-RPC body; an accepted one gets `202` with an empty body.

### Why the order matters

Each step leaves a distinct piece of evidence: malformed input, header confusion, version negotiation, capability failure, authorization and handler failure stay separate. Checking version support before header equality mixes two classes and lets a crafted header reach a decision. Validating routing before policy closes the gap in which one component authorizes the body while another routes by the header.

### What the gateway does after validation

Authorization still comes from the authenticated principal and resource policy, not from the header and not from `clientCapabilities`. The sequence is: authenticate the transport credential, validate version, headers and shape, check capability compatibility, then authorize the principal against the exact verb, resource and normalized arguments, and only then execute or request user input.

## Follow-ups

- **Level 3:** Header and body both say version `2027-01-01`. Which response? Expected: HTTP `400` with `-32022` and data `{"supported":["2026-07-28"],"requested":"2027-01-01"}`.
- **Level 3:** `Mcp-Name` carries a resource URI with non-ASCII characters. How does the server compare it? Expected: the client sends the exact base64 UTF-8 sentinel, and the server decodes it before comparing with `params.uri`.
- **Level 4:** Why must the mismatch check run before a rate-limit token is consumed? Expected: a rejected request should cost nothing and leave its own evidence; otherwise an attacker spends quota or triggers policy against the wrong object.
- **Level 4:** The attacker's request also carries a valid bearer token. Does that change the outcome? Expected: no; the wire validation fails first, and authentication tells you who sent a malformed request, not that it may run.

## Wrong answers

- "Trust the header, because the gateway routes on it." The body is what executes. The two must be proven equal before either is used for a decision.
- "Check version support first so that bad clients fail fast." A mismatch must return `-32020` even when a version is unsupported; support is checked only after equality.
- "Header values are case-insensitive like header names." Values are case-sensitive, and a name that differs in case is a different name.

## Taught in

The [fundamentals lesson](../../../phases/13-tools-and-protocols/06-mcp-fundamentals/) gives the lifecycle order, the [transports lesson](../../../phases/13-tools-and-protocols/09-mcp-transports/) defines the mirrored headers, and the [security lesson](../../../phases/13-tools-and-protocols/15-mcp-security-tool-poisoning/) places routing before policy.
