---
name: mcp-registry-admission
description: Admit, pin, monitor, quarantine, and roll back an MCP Registry release with supply chain evidence.
version: 1.0.0
phase: 13
lesson: 30
tags: [mcp, registry, provenance, admission, drift, rollback]
---

Given an MCP Registry response, a verified publisher identity, artifact evidence, a live server observation, and local policy, produce an admission decision and an evidence bundle.

## Required inputs

- Registry source, server record, Registry-managed metadata, and retrieval time.
- Verified namespace and the authentication method that established it.
- Package registry, identifier, exact version, ownership result, and calculated artifact digest.
- Live `server/discover` result, protocol versions, capabilities, diagnostic server information, and complete tool descriptors.
- Required capabilities, prohibited tool properties, reviewers, evidence retention, and rollback policy.
- Previously admitted pins, current routes, quarantines, and recent health observations.

## Procedure

1. Validate the Registry record shape. Require a non-empty name, version, description, and at least one package or remote. Treat the Registry schema version and live MCP protocol version as independent values.
2. Read Registry-managed status from response-level `_meta["io.modelcontextprotocol.registry/official"].status`, not from direct `_meta.status` or the publication record. Reject automatic admission unless status is `active`.
3. Compare the name namespace exactly with the namespace established by trusted authentication. Reject prefix lookalikes and empty slugs.
4. Join one declared execution source to verified evidence. For a package, match registry type, identifier, exact version, and transport. For a remote-only record, match URL and transport to independently verified endpoint evidence. Require a trusted SHA-256 evidence digest for either source.
5. Hash the canonical Registry record. Hash a provenance object that joins Registry source, server name, Registry version, record digest, selected source, and source evidence digest.
6. Observe the live endpoint. Require an accepted protocol version, required capabilities, and complete tool descriptors. Preserve result `_meta["io.modelcontextprotocol/serverInfo"]` only for display, logs, and debugging. Never use self-reported `serverInfo`, including a direct-only alias, as admission or security authority.
7. Normalize only semantically unordered collections. Hash the full normalized descriptor surface so a name, description, schema, annotation, or tool-set change creates drift.
8. Apply local authorization, data, network, and review policy. Registry publication is evidence, not local approval.
9. On approval, store an immutable pin containing record, execution-source, provenance, and toolset digests. Keep approval state separate from active routing state.
10. Append the decision, reasons, evidence references, previous ledger hash, and current entry hash to the admission ledger. Redact credentials and sensitive arguments before evidence storage.
11. Reconcile Registry status and live descriptors on a schedule and before activation. Quarantine and deactivate a pin when status becomes deprecated or deleted, its source evidence changes, or its live behavior differs. A quarantined pin is never a rollback target.
12. Roll back only to a previously admitted, currently eligible, healthy, non-quarantined pin. Record route restoration as a new event. Never rewrite an old publication or admission decision.

## Hard rejects

- Trust derived only from a familiar display name or Registry presence.
- `startswith` namespace checks or a namespace claimed only by the submitted record.
- `latest`, version ranges, or package coordinates without an artifact digest.
- Publisher fields that imitate Registry-managed status or verification.
- Missing or malformed protocol, capability, or descriptor evidence.
- Treating self-reported `serverInfo` as namespace, provenance, endpoint, or admission authority.
- Silent descriptor pin updates after drift.
- Activation of deprecated, deleted, unknown, or quarantined versions.
- Rollback to a target with no complete admission evidence.
- Ledger evidence containing bearer tokens, cookies, package credentials, or unnecessary tool arguments.

## Produce

Return these sections:

1. Decision: `approve`, `reject`, or `quarantine`, with stable reason codes.
2. Namespace Proof: verified namespace, authentication source, and exact name comparison.
3. Publication Pin: Registry source, server name, exact version, status, schema version, and record digest.
4. Source Pin: package coordinate and transport or remote URL and transport, ownership result reference, and source evidence digest.
5. Runtime Pin: accepted protocol version, required capabilities, toolset digest, and optional diagnostic `serverInfo`.
6. Provenance Join: the canonical fields and resulting provenance digest.
7. Policy Results: every passed, failed, and not-applicable control.
8. Ledger Event: sequence, time, event, outcome, reason codes, evidence references, previous hash, and entry hash.
9. Reconciliation Plan: next status, artifact, discovery, descriptor, and health checks.
10. Rollback Plan: eligible prior pin, validation steps, route change, health window, and evidence to retain.

End with the single missing fact that would most change the decision. If no required fact is missing, state the next scheduled drift check.
