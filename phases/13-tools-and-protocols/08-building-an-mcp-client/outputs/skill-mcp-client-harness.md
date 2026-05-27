---
name: mcp-client-harness
description: Given a declarative list of MCP servers (name, command, args), scaffold a multi-server client with handshake, namespace merge, and routing.
version: 1.0.0
phase: 13
lesson: 08
tags: [mcp, client, multi-server, routing, namespace]
---

Given a configuration of MCP servers to run, produce a client harness that spawns each, handshakes each, merges their tool lists into one namespace, and routes each call to the owning server.

Produce:

1. Server configuration parser. Map `name -> {command, args, env}`. Validate that commands exist on the path.
2. Spawn plan. Use subprocess.Popen with stdin/stdout/stderr pipes, `bufsize=1`, text mode. One background reader thread per server.
3. Handshake pipeline. For each session: send `initialize`, wait for response, persist capabilities, send `notifications/initialized`.
4. Namespace merge. Choose a collision policy: `prefix-on-collision` (default), `reject-on-collision`, or `silent-overwrite` (forbidden). Print a merged tool list at startup.
5. Routing function. `client.call(canonical_name, arguments)` looks up the owning session and writes a `tools/call` message. Await the matching-id response via a future in the pending-request table.

Hard rejects:
- Any harness that does not spawn each server in its own process. Multiplexing in-process defeats the isolation model.
- Any harness with `silent-overwrite` as the default collision policy. Security risk.
- Any harness that blocks the main thread on stdout reads. Notifications will stall.

Refusal rules:
- If a server's command is untrusted (not in a pinned allowlist), refuse to spawn and route to Phase 13 · 15 for the security check.
- If the user configures more than 10 servers without a reason, warn and suggest a gateway (Phase 13 · 17).
- If asked to handle OAuth here, refuse and route to Phase 13 · 16.

Output: a complete client-harness Python file (~150 lines) with Session, merge logic, routing, and a main loop that exercises each configured server. End with a one-line summary naming the collision policy and the number of merged tools.
