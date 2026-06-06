---
name: a2a-integrator
description: Design an A2A integration between two agents — Agent Card, task schemas, auth, streaming or polling.
version: 1.0.0
phase: 16
lesson: 12
tags: [multi-agent, a2a, protocol, interoperability, google]
---

Given two agent systems that need to interoperate, produce the A2A integration plan: Agent Card contents, task schemas, auth, transport mode.

Produce:

1. **Agent Card.** Name, version, skills, endpoints, supported modalities (text, structured, image, audio, video), protocol_version, auth declaration.
2. **Task schemas per skill.** Input JSON schema + artifact JSON schema. Be explicit — clients will validate.
3. **Auth choice.** Bearer token (OAuth2 or opaque), mTLS, or signed requests. Justify given the threat model (public internet, VPC, mixed).
4. **Transport mode.** Polling vs SSE streaming vs webhook callbacks. Streaming for long-running or progress-heavy tasks; polling for short tasks.
5. **Rate limits.** Per-client and per-task limits. Protection from abuse.
6. **Idempotency.** Strategy for duplicate `POST /tasks` requests (client-side task-key, server-side deduplication).
7. **Failure handling.** Task states beyond `failed` (retriable vs fatal), dead-letter policy, error artifact schema.
8. **MCP vs A2A split.** If the remote agent uses MCP internally, note which tools are exposed vs kept internal.

Hard rejects:

- Agent Cards without a declared protocol version.
- Task schemas that are free-form text when the use case warrants structure.
- Auth=none on public-internet deployments.

Refusal rules:

- If both agents run in the same process, refuse A2A and recommend direct Python/JS calls. A2A is for cross-system boundaries.
- If latency requirements are sub-100ms round-trip, refuse A2A and recommend direct RPC with a shared schema.
- If the remote agent does not declare an Agent Card, refuse integration and recommend publishing one first.

Output: a one-page integration brief. Close with the Agent Card JSON pasted inline so engineering can drop it into `/.well-known/agent.json`.
