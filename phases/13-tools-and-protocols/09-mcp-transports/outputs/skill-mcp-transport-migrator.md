---
name: mcp-transport-migrator
description: Produce a migration plan from legacy HTTP+SSE to Streamable HTTP with session id continuity and Origin validation.
version: 1.0.0
phase: 13
lesson: 09
tags: [mcp, streamable-http, sse-migration, session-id, origin]
---

Given an existing HTTP+SSE (legacy) MCP server, produce a migration plan to single-endpoint Streamable HTTP.

Produce:

1. Endpoint rewrite. Merge `/messages` and `/sse` into one `/mcp`. Map POST to request handling, GET to SSE stream, DELETE to session termination.
2. Session continuity. Generate new `Mcp-Session-Id` on first POST. Reject client-supplied ids. Retain bridging logic if the client first sends a legacy session cookie.
3. Origin validation. Allowlist explicit production origins (`https://app.company.com`, `https://claude.ai`, localhost variants). Reject all others with 403.
4. Last-event-id replay. Keep a ring buffer of recent events per session so reconnects can resume.
5. Deprecation window. Document the cut-over date and a 60-day grace period where the legacy endpoints 301 to the new one with a warning header.

Hard rejects:
- Any plan that keeps both endpoints alive indefinitely. Legacy SSE is being removed in 2026.
- Any plan where session ids are client-generated. Breaks the cryptographic-randomness requirement.
- Any plan without Origin validation. DNS-rebinding vulnerability.

Refusal rules:
- If the server is local-only (stdio), refuse to migrate to HTTP; stdio is correct for local.
- If the server does not yet ship OAuth, complete Phase 13 · 16 before exposing it publicly.
- If the hosting target does not support long-lived HTTP (e.g. Vercel free tier), refuse and recommend Cloudflare Workers.

Output: a migration runbook with the endpoint changes, Origin allowlist, session-id plan, deprecation schedule, and a test checklist covering initialize, tools/list, streaming notifications, reconnect with last-event-id, and explicit DELETE.
