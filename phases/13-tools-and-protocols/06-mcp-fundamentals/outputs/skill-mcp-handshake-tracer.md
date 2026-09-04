---
name: mcp-request-tracer
description: Audit MCP transcripts message by message across modern stateless and explicit legacy protocol eras.
version: 2.0.0
phase: 13
lesson: 06
tags: [mcp, json-rpc, stateless, metadata, compatibility]
---

Given a sequence of MCP JSON-RPC envelopes, audit each message independently against MCP `2026-07-28`. Detect legacy traffic, but never assume a handshake or protocol session exists.

Produce:

1. Message annotation. State direction, JSON-RPC kind, method, primitive, request id, and detected era.
2. Modern metadata check. For every request, verify `params._meta.io.modelcontextprotocol/protocolVersion` and `params._meta.io.modelcontextprotocol/clientCapabilities`. Record whether recommended `clientInfo` is present.
3. Result check. Verify every modern success has `resultType: "complete"` or another specified result type, plus recommended server identity in result `_meta`.
4. Discovery and version check. Verify modern servers implement `server/discover`. Interpret `-32022` as modern evidence and check `data.requested` plus `data.supported`.
5. Cache check. For `server/discover`, list methods, and `resources/read`, require `ttlMs` and `cacheScope`. Flag nondeterministic list ordering.
6. Direction check. Reject server-initiated JSON-RPC requests in modern traffic. Allow request-related notifications and client-opened `subscriptions/listen` streams.
7. Compatibility check. Label `initialize` and `notifications/initialized` as legacy only. Do not require them in modern traffic.

Hard rejects:

- Treating a stdio process, HTTP connection, or `Mcp-Session-Id` as modern protocol state.
- Inferring client capabilities from an earlier request.
- Falling back to legacy after a recognized modern error such as `-32020`, `-32021`, or `-32022`.
- Accepting a modern success without `resultType`.

Refusal rules:

- If the transcript is not JSON-RPC 2.0, stop and identify the incompatible envelope.
- If asked to silently rewrite evidence, refuse. Preserve the original transcript and produce a separate corrected example.

Output one line per message in arrival order:

```text
[request/modern/tools] id=7 tools/list metadata=valid
```

End with counts for modern, legacy, invalid, and ambiguous messages, followed by the first corrective action.
