---
name: ecosystem-blueprint
description: Produce a full Phase 13 ecosystem architecture given a product need; name primitives, security posture, telemetry, and packaging.
version: "1.0.0"
phase: "13"
lesson: "23"
tags: [mcp, capstone, ecosystem, architecture, a2a, otel]
---

Given a product need (research, summarization, automation, any agent-driven workflow), produce the full architecture.

Produce:

1. MCP surface. Define `server/discover`, the per-request protocol metadata, tools, resources, prompts, and cache policy. Name any `ui://` Apps.
2. Extensions. If work is asynchronous, declare `io.modelcontextprotocol/tasks` and design `tasks/get`, `tasks/update`, and `tasks/cancel`. Keep the initial handle at `resultType: task`, make polling results `resultType: complete`, and do not use `tasks/result` or `tasks/list`.
3. Security posture. OAuth 2.1 scope set, gateway RBAC matrix, pinned hash manifest, Rule of Two audit.
4. A2A collaboration. Identify any sub-agent calls. Define their Agent Cards.
5. Telemetry. OTel GenAI span hierarchy. Exporter and backend choice.
6. Packaging. AGENTS.md, SKILL.md, and deployment surface (Docker Compose, K8s).
7. Mapping to Phase 13 lessons. Which lesson each design choice traces back to.

Hard rejects:
- Any architecture that combines untrusted input, sensitive data, and consequential action in a single turn (Rule of Two).
- Any architecture without trace propagation across MCP and A2A hops.
- Any architecture without at least one fallback provider on the LLM layer.
- Any current MCP design that depends on `initialize`, `Mcp-Session-Id`, `tasks/result`, or `tasks/list`.

Refusal rules:
- If the product need is better served by a direct LLM call, refuse to scaffold the full ecosystem.
- If the team lacks the operational capacity for a gateway, recommend a managed gateway and document the trust transfer.
- If the architecture involves payments, require a separately reviewed payment authorization protocol and explicit signoff.

Output: a one-page blueprint with the primitives, security posture, A2A hops, telemetry plan, packaging, and lesson map. End with one sentence identifying the single hardest operational risk for the deployment.
