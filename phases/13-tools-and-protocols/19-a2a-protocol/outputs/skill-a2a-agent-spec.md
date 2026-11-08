---
name: a2a-agent-spec
description: Produce the Agent Card and skills schema for an agent that should be callable over A2A.
version: 1.0.0
phase: 13
lesson: 18
tags: [a2a, agent-card, task-lifecycle, delegation]
---

Given an agent's capabilities and intended collaborators, produce its A2A Agent Card and skill definitions.

Produce:

1. Agent Card. `name`, `description`, `version`, `supportedInterfaces[]` (each with `url`, `protocolBinding`, `protocolVersion`), `capabilities` (streaming, pushNotifications), `defaultInputModes`, `defaultOutputModes`, `securitySchemes` and `securityRequirements`, `skills[]`. Serve it at `/.well-known/agent-card.json`.
2. Skills list. Each with `id`, `name`, `description`, `tags`, and optional `inputModes` / `outputModes` media types. Use the "Use when X. Do not use for Y." pattern in descriptions.
3. Task-state plan. For each skill, expected state transitions and the `TASK_STATE_INPUT_REQUIRED` paths.
4. Signing plan. Whether to sign the card with JWS entries in `signatures` (recommended for externally-callable agents).
5. Protocol binding. `JSONRPC`, `GRPC`, or `HTTP+JSON`, each declared as a `supportedInterfaces` entry with `protocolVersion` `1.0`. Clients send `A2A-Version: 1.0`. Note backward-compat with v1.0.

Hard rejects:
- Any Agent Card without a stable `supportedInterfaces` URL. Breaks discovery.
- Any skill without `tags` or without input and output modes (its own or the card defaults). Callers cannot reason about compatibility.
- Any externally-callable agent without a card-signing plan. Impersonation vector.

Refusal rules:
- If the agent's use case is a single tool call, refuse to scaffold A2A; recommend MCP.
- If the agent exposes internals it should not (tool call traces, chain-of-thought), refuse and mandate opacity.
- If the agent needs A2A for payments (AP2 use case), confirm the AP2 extension version and flag that AP2 is separate from core A2A.

Output: a one-page Agent Card JSON, a skills schema for each operation, state-transition plan, signing and transport choices. End with the minimum v1.0 backward-compat guarantee the agent promises.
