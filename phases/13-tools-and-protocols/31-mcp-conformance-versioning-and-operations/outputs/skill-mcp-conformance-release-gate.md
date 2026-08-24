---
name: mcp-conformance-release-gate
description: Build an MCP conformance matrix and evidence-backed promote, hold, or rollback decision.
version: 1.0.0
phase: 13
lesson: 31
tags: [mcp, conformance, versioning, transcripts, proxy, operations]
---

Given an MCP client, server, gateway, SDK, or transport change, produce a wire-level conformance suite and a release decision with redacted evidence.

## Required inputs

- Supported modern and legacy protocol versions and the policy for each deployment target.
- Raw request and response capture points before SDK decoding.
- Mirrored HTTP headers, JSON-RPC bodies, statuses, content types, and intermediary topology.
- Advertised client, server, and extension capabilities.
- SDK names, versions, normalized values, and exceptions.
- Health thresholds, canary window, minimum sample count, and baseline measurements.
- Exact rollback version, admission evidence digest, SHA-256 artifact and descriptor pins, Registry status, current health, trusted release signers, and an attestation over the complete rollback payload.
- Redaction, retention, and evidence access policy.

## Procedure

1. Define explicit protocol eras. Require exact `io.modelcontextprotocol/protocolVersion` and `io.modelcontextprotocol/clientCapabilities` keys in the modern branch. Put initialization-era behavior through `2025-11-25` in a separate legacy adapter.
2. Choose strict or bounded fallback policy per target. A successful `server/discover` or recognized modern error proves the modern branch. A timeout or empty response proves nothing. Permit a legacy probe only for a configured or allowlisted endpoint, then select legacy only after validating a positive `initialize` result for the pinned legacy revision. Never downgrade after `-32020`, `-32021`, or `-32022`.
3. Create golden transcripts for accepted requests, valid method-specific results, advertised extension results, selected legacy behavior, and the notification no-response invariant.
4. Create negative transcripts for malformed envelopes, response version or ID mismatch, result and error exclusivity, malformed errors, incorrect HTTP mapping, missing metadata, header and body mismatch, missing server error response, unsupported version, missing modern `resultType`, malformed method payloads, unknown or unadvertised result types, and forbidden notification responses. Whenever local validation observes `HeaderMismatch`, require and structurally validate the actual HTTP 400 JSON-RPC `-32020` response automatically. A local exception alone never passes that case.
5. Validate JSON-RPC metadata types first. Match HTTP header names case-insensitively, reject conflicting duplicates, decode the exact Base64 sentinel for unsafe `Mcp-Name` values, then compare `MCP-Protocol-Version`, `Mcp-Method`, and applicable `Mcp-Name` values with the body before checking support for the matched value. Treat leading or trailing whitespace as unsafe and reject it when sent raw, even if it equals the body value.
6. Accept known modern `complete` and `input_required` results. Accept an extension discriminator only when its capability was advertised. Reject every unknown or unadvertised `resultType`. Then validate the method payload, including complete tool descriptors for `tools/list`, required lifecycle fields for a task result, and a bounded string-values completion object for `completion/complete`.
7. Preserve raw additive result and `_meta` fields in evidence. Decide explicitly whether each component may ignore them or must forward them.
8. Run every high-risk transcript through each shipped SDK. Compare raw wire semantics with the normalized return value and report every field synthesized, lifted, stripped, or changed.
9. Execute the suite directly and through every production intermediary. Capture redacted ingress, origin, and egress evidence. Detect status collapse, JSON-RPC body rewriting, routing header mismatch, buffering, and content negotiation changes.
10. Apply redaction before serialization, hashing, logging, or upload. Case-fold field and header names and remove separators so camelCase, hyphenated, underscored, and dotted variants share the denylist, then remove credentials such as `Authorization`, `Set-Cookie`, `X-Api-Key`, `accessToken`, `clientSecret`, and `registrationAccessToken` plus method-specific sensitive arguments. Hash the redacted evidence bundle.
11. Evaluate the candidate against non-empty deterministic transcript, SDK differential, and proxy evidence plus a predeclared health window with a positive minimum sample count. Require valid evidence digests from every source. An omitted boundary is a failed gate, not a passing empty list.
12. Verify an exact admitted, pinned, active, healthy rollback target before promotion. Validate exact field types and SHA-256 digests, then cryptographically verify its attestation against a trusted release-controller identity. Promote only when conformance, SDK, proxy, health, and rollback-readiness evidence pass. On candidate failure, roll back only to that verified target. Otherwise hold.

## Required matrix

For every case, report:

- stable case name and normative invariant
- protocol era and selection evidence
- client, server, SDK, proxy, and build versions
- expected status, response shape, result type, or error code
- observed ingress, origin, and egress evidence digests
- SDK normalization differences
- pass or fail at each boundary
- redaction policy version
- final reason code

At minimum include these cases:

- golden modern discovery or method call
- golden known complete result with an additive field
- golden legacy missing `resultType` in the selected legacy era
- golden advertised extension result
- golden valid `completion/complete` result
- golden notification with no JSON-RPC response
- negative header and body mismatch
- negative missing capabilities
- negative unsupported matched version
- negative missing modern `resultType`
- negative unknown or unadvertised `resultType`
- negative proxy status or body transformation
- negative SDK semantic field loss
- negative malformed `completion/complete` result

## Hard rejects

- Claiming conformance from SDK return values without raw wire evidence.
- One parser that silently accepts both modern and legacy shapes.
- Legacy fallback after a recognized modern error.
- Legacy fallback based only on timeout, silence, connection closure, or an unrecognized response.
- Passing a negative request case without capturing and validating the server's error response.
- Making HTTP 400 JSON-RPC `-32020` evidence optional after local `HeaderMismatch` detection.
- Inferring complete for a missing `resultType` before selecting a legacy era.
- Treating an unknown discriminator as complete.
- Rejecting all additive unknown fields without a reserved-field reason.
- Sending any JSON-RPC response to a notification.
- Accepting a known `resultType` without validating the method-specific payload.
- Authorizing mirrored headers without checking equality with the body.
- Treating HTTP field names as case-sensitive or comparing an encoded `Mcp-Name` without exact sentinel decoding.
- Accepting a raw `Mcp-Name` with leading or trailing whitespace instead of requiring sentinel encoding.
- Accepting a completion result without a valid bounded string-values completion object.
- Treating a proxy-generated 500 as equivalent to an origin protocol error.
- Writing bearer tokens, cookies, secrets, or sensitive arguments into evidence.
- Using redaction normalization that lets camelCase or separator variants bypass the canonical credential denylist.
- Declaring a zero-sample canary healthy.
- Treating empty transcript, SDK, or proxy evidence as a passing boundary.
- Treating truthy strings or an unauthenticated rollback dictionary as verified evidence.
- Rolling back to a version without exact admission, pin, status, and health evidence.
- Promoting a production candidate before proving a healthy rollback target.

## Produce

Return these sections:

1. Era Policy: modern proof, strict targets, bounded fallback triggers, and forbidden downgrade signals.
2. Transcript Matrix: golden and negative cases with expected wire outcomes.
3. Result Compatibility: core discriminators, advertised extensions, additive field policy, and legacy inference boundary.
4. SDK Differential: raw and normalized digests plus lifted, stripped, synthesized, and changed fields.
5. Proxy Evidence: ingress, origin, and egress results with the exact failing hop.
6. Redaction Report: policy version, removed field classes, and redacted evidence digest.
7. Health Window: samples, error rate, latency, saturation, duration, thresholds, and baseline comparison.
8. Rollback Proof: exact target, admission digest, pins, Registry status, health, signer identity, verified attestation, and route restoration plan.
9. Decision: `promote`, `hold`, or `rollback`, with stable reason codes and the complete evidence digest.

End with the first failing boundary. If all boundaries pass, state the canary completion condition that authorizes full promotion.
