# Use Case Decision Matrix

A one-page reference for the MCPA "Use Cases and Ecosystem" domain, aligned to MCP 2026-07-28. Start with the four questions, then check the row that matches.

## The four questions

1. Who initiates the action: the model, the application, the user, or an unattended system?
2. How sensitive is the data behind it: public, or private to one user or organization?
3. How long does the work take: one request-response pair, or minutes and beyond?
4. Does the result need an interactive surface, and is a human present to authorize or consent?

## The matrix

| Use case | Primitive | Transport | Auth path | Extension | Cache scope |
|---|---|---|---|---|---|
| Developer tools (local code search, local file access) | Tool | stdio | Environment credentials, no OAuth flow | none | private |
| Data access (read-only context: tickets, docs, records) | Resource | Streamable HTTP | Interactive OAuth 2.1 with PKCE | none | private if user-specific, else public |
| Enterprise systems of record | Tool or resource | Streamable HTTP | Enterprise-Managed Authorization | `io.modelcontextprotocol/enterprise-managed-authorization` | private |
| Workflow automation and long jobs | Tool | Streamable HTTP | Interactive OAuth 2.1, or client credentials if unattended | `io.modelcontextprotocol/tasks` | private |
| Interactive UIs (dashboards, forms, viewers) | Tool | Streamable HTTP | Interactive OAuth 2.1 | `io.modelcontextprotocol/ui`, with a text fallback | private |
| Reusable workflows (skills) | Prompt, backed by Skills over MCP | Streamable HTTP | Interactive OAuth 2.1 | `io.modelcontextprotocol/skills` | public or private by content |
| Machine-to-machine integration | Tool | Streamable HTTP | OAuth client credentials, no human present | `io.modelcontextprotocol/oauth-client-credentials` | private |

## When MCP is the wrong tool

A capability with no external system and no second consumer, string formatting, arithmetic, composing a prompt from local variables, does not need a protocol boundary. A JSON-RPC envelope, a discovery round trip, and an authorization decision only pay for themselves when a client and a server actually need to interoperate across a process or organization boundary. If nothing crosses that boundary, use a plain function call.

## Four operational concerns, every use case

| Concern | What to decide |
|---|---|
| Auth path | Environment credentials (stdio), interactive OAuth 2.1 (a human is present), client credentials (unattended, machine-to-machine), or enterprise-managed (central IdP policy) |
| Cache scope | `public` when the data has no per-user sensitivity, `private` when it does; only applies to the six cacheable operations, and is never itself an access control |
| Consent | An MRTR elicitation for a sensitive or slow action with a human present; a pre-authorized scope with no elicitation when nobody is present to ask |
| Observability | Trace context (`traceparent`, `tracestate`) propagated in `_meta`; audit records keyed on the authenticated principal, never on self-reported `clientInfo` |

## Remember for the exam

- Tools are model controlled, resources are application driven, prompts are user controlled: that split, not the transport or the data format, decides the primitive.
- Extensions are opt-in and disabled by default; a server offering one still degrades gracefully for a caller that has not declared it.
- cacheScope limits sharing across authorization contexts. It is not an access control.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 10 and 14.
