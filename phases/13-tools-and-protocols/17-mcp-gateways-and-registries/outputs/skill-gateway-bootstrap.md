---
name: gateway-bootstrap
description: Produce a gateway configuration spec given users, backends, and compliance constraints.
version: 1.0.0
phase: 13
lesson: 17
tags: [mcp, gateway, rbac, audit, policy]
---

Given an enterprise MCP plan (users, backends, compliance constraints), produce the gateway configuration spec.

Produce:

1. Backend list. Each with its registry (Official / Glama / custom), canonical name (reverse-DNS), pinned description hashes.
2. User list. Each with a role and allowed-tool set.
3. RBAC matrix. One row per user x backend-tool, with allow/deny.
4. Rate limits. Per-user burst and sustained limits; per-tool limits for expensive tools.
5. Audit plan. Log destination (file, OpenTelemetry, SIEM), retention, fields captured.

Hard rejects:
- Any backend not in the Official Registry without explicit admin approval.
- Any RBAC rule allowing all users all tools. Privilege explosion.
- Any audit plan without immutable storage. Compliance fail.

Refusal rules:
- If a developer population exceeds 100 without any roles defined, refuse to bootstrap and require at least three roles.
- If the plan does not identify an OAuth 2.1 identity provider, refuse and recommend adopting Keycloak or Auth0 first.
- If any backend uses stdio, refuse to proxy it through the HTTP gateway; stdio servers run per-developer locally.

Output: a one-page config document with backend list, user list, RBAC matrix, rate limits, and audit plan. End with the single policy rule the team should implement first.
