---
name: mcp-threat-model
description: Threat-model an MCP 2026-07-28 deployment across metadata, routing, authorization, MRTR, and compatibility boundaries.
version: 2.0.0
phase: 13
lesson: 15
tags: [mcp, security, stateless, tool-poisoning, mrtr]
---

Given an MCP deployment, produce an evidence-based threat model. Assume any server, package, cache, registry entry, or gateway route can be compromised.

## Required inputs

- Client, gateway, server, authorization server, and registry trust boundaries.
- Complete normalized tool descriptors and approved digests.
- Authentication principal, issuer, audience, scopes, and tool policy.
- Current and legacy protocol revisions accepted.
- MRTR operations, input schemas, state protection, and replay policy.
- Cache scopes, TTLs, subscription routes, and audit retention.

## Produce

1. Wire validation. Verify per-request version and capabilities, then routing-header equality before version support. Require HTTP 400 `-32020` for a mismatch, HTTP 400 `-32022` with exact supported and requested data for an unsupported matched version, HTTP 404 `-32601` for an unknown method, and 202 with an empty body for an accepted notification.
2. Descriptor review. Report poisoning indicators, full-descriptor digest changes, unknown tools, and schema or annotation changes.
3. Namespace map. Give one qualified public name for every backend tool and reject silent collision resolution.
4. Authorization matrix. Map authenticated principal and issuer to resource, tool, argument constraints, and scopes. Do not use `clientInfo` or `serverInfo` as identity.
5. MRTR review. Confirm every `inputRequests` entry is a complete embedded request supported by the client's declared capability. Treat `elicitation: {}` as implicit form support and `elicitation: {form: {}}` as explicit form support. Reject URL-only elicitation with HTTP 400 `-32021` and `data.requiredCapabilities.elicitation.form`. Bind protected `requestState` to method, tool, exact arguments, principal, purpose, expiry, and nonce. Match and validate every `inputResponses` entry by key before atomically consuming the nonce in a bounded, TTL-pruned replay store shared by every handler instance.
6. Risk-axis review. Flag any automatic step that combines untrusted input, sensitive data, and consequential action.
7. Cache and subscription review. Ensure user-dependent results are private and long-lived notifications use `subscriptions/listen`.
8. Compatibility boundary. Isolate any older handshake, session, GET stream, server callback, or experimental task behavior behind explicit version gating.
9. Transport boundary. Identify whether the implementation is a complete HTTP adapter or an in-process protocol model. Connect a model to Lesson 09 for JSON Content-Type and JSON plus SSE Accept validation.
10. Remediation order. Give the three highest-leverage fixes with owners and acceptance evidence.

## Hard rejects

- Silent tool overwrite or route selection by discovery order.
- Updating a descriptor digest without human or policy re-approval.
- Treating self-reported client or server information as authentication.
- Treating a declared capability as permission.
- Trusting plaintext or unsigned `requestState` for a consequential action.
- Keeping the only replay ledger inside one gateway or server instance.
- Keying rate limits or approval state only by `Mcp-Session-Id`.
- Presenting deprecated Sampling, Roots, Logging, or legacy HTTP plus SSE as the new implementation path.

## Output format

Return sections named Trust Boundaries, Wire Findings, Descriptor Findings, Route Map, Authorization Matrix, MRTR Findings, Compatibility Findings, and Remediation. Separate confirmed evidence from assumptions. End with the single attack path that currently crosses the most boundaries.
