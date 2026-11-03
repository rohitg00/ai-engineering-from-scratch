---
id: descriptor-pin-rug-pull
title: The pin that passed a changed tool
card: protocols
kind: debug
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer, ai-developer-relations-engineer]
rounds: [debugging, design-review]
tags: [mcp, tool-poisoning, rug-pull, hash-pin, gateway]
minutes: 9
lessons: [phases/13-tools-and-protocols/15-mcp-security-tool-poisoning]
manuals: []
practice: []
cheatsheet: [mcp-security-auth, mcp-gateways-operations]
related: [protocols/two-error-layers]
updated: 2026-11-03
---

Your gateway pins each approved tool by hashing its description text. A connected server ships an update. The description is unchanged, but the `inputSchema` gains a `destination` field and `destructiveHint` flips to false. The pin passes, and the model begins calling the tool with the new argument. What went wrong, and how do you pin correctly?

## Short answer

The pin covered one field, so a schema and annotation change passed as unchanged. Canonicalize the complete descriptor with sorted keys, hash it, and store the digest under a qualified name together with publisher evidence and the approval time. On every refresh, quarantine an unknown key or a changed digest until a person re-approves it. Hash equality proves stability, not safety, so the first descriptor needs review too.

## Full answer

### Pin the whole descriptor

```python
normalized = json.dumps(tool, sort_keys=True, separators=(",", ":"))
digest = hashlib.sha256(normalized.encode()).hexdigest()
```

Store the digest under a qualified key such as `notes.export`. On every refresh:

| Observation | Action |
|---|---|
| unknown key | quarantine until review |
| same key, different digest | quarantine as a rug pull until re-approved |
| duplicate unqualified name | require deterministic namespacing |
| scanner hit | block and review the complete descriptor |

### Seven surfaces, not one

Metadata poisoning, the descriptor rug pull, cross-server shadowing, header and body confusion, capability escalation, MRTR state tampering, and supply-chain identity confusion overlap. Hash pinning helps with changes but does not prove the first version was safe. A static scanner catches obvious phrases and misses subtle ones. Namespacing prevents one collision class and not a malicious namespaced server. Stack the controls.

### The scanner is a tripwire

Simple patterns flag role tags, instruction overrides, concealment, secret access and obscured network destinations. They are cheap at install time and in CI. They are not a semantic proof: a safe description can contain a flagged phrase in a warning, and a malicious one can avoid every phrase. Treat a hit as review evidence.

### Namespace before you merge

When two servers both expose `search`, never let discovery order decide. The qualified names `notes.search` and `issues.search` become the public gateway names, and the backend mapping is recorded separately. Stable names make approval, audit, pins and `Mcp-Name` routing refer to the same object.

### Run the checks twice

Run the pin comparison at discovery and again before dispatch. A cache can reduce discovery work, but a cached approval must expire or be invalidated when the descriptor changes.

## Follow-ups

- **Level 2:** What does a clean scanner result prove? Expected: nothing semantic; it is review evidence, not an innocence score.
- **Level 3:** The server's `serverInfo` says it is the familiar publisher. How much trust does that buy? Expected: none; it is self-reported display data for logs, not a certificate or registry proof.
- **Level 3:** The descriptor was poisoned on day one and the pin stored that digest. What catches it? Expected: review before the first approval, with the scanner as a tripwire; the hash cannot.
- **Level 4:** How does a gateway stop the model from treating annotations as policy? Expected: annotations stay presentation hints; authorization binds the principal to the exact verb, resource and normalized arguments, and a consequential call needs action-bound approval.

## Wrong answers

- "Hash the description; the schema is only typing." The schema decides which arguments the model can send, and a new field can route data to a new destination.
- "A matching hash means the tool is safe." It means the descriptor did not change. A poisoned descriptor stays poisoned when pinned.
- "Set `destructiveHint` and the host will confirm." Annotations are untrusted hints. The server enforces authorization and approval.

## Taught in

The [tool poisoning lesson](../../../phases/13-tools-and-protocols/15-mcp-security-tool-poisoning/) lists the seven attack surfaces and pins the complete descriptor.
