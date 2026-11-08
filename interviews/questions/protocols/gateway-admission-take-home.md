---
id: gateway-admission-take-home
title: Build the admission gate of an MCP gateway
card: protocols
kind: take-home
level: 4
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [take-home, coding]
tags: [mcp, gateway, admission, pagination, x-mcp-header, take-home]
minutes: 60
lessons: [phases/13-tools-and-protocols/15-mcp-security-tool-poisoning, phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content, phases/19-capstone-projects/13-mcp-server-with-registry]
manuals: []
practice: [tool-call-parser]
cheatsheet: [mcp-gateways-operations, mcp-security-auth]
related: [protocols/descriptor-pin-rug-pull, protocols/empty-cursor-stops-early, protocols/header-body-mismatch-order]
updated: 2026-11-03
---

Take-home. Build the admission module of an MCP gateway. It takes the `tools/list` results of several servers and produces an admitted set, a rejected set and an audit trail. It must page through every list completely, pin each descriptor, qualify names before it merges, reject a descriptor that mirrors a sensitive parameter into a header or places `x-mcp-header` anywhere but a direct top-level property, validate structured results against output schemas on the invoke path, and emit header audit events that carry names and never values. Describe your design, the tests you ship, and the evidence a reviewer should expect.

## Short answer

Run the five gates in order and keep them separate. Discover with an opaque cursor loop that stops only when `nextCursor` is absent or `null`; admit each descriptor against a canonical whole-descriptor digest, a full schema-tree walk for `x-mcp-header`, and a sensitive-name policy; qualify every tool as `<server>.<tool>` before the merge; and validate `structuredContent` against the published output schema before anything reaches the model. Tests prove that one rejected descriptor does not block valid tools, that an empty-string cursor continues, that an annotation under `oneOf`, `items` or `$ref` is rejected, and that a changed `inputSchema` fails the pin. The evidence is the page trace, the admitted and rejected sets, the digest ledger and redacted audit events.

## Full answer

### Modules

| Module | Responsibility |
|---|---|
| `discover` | opaque cursor loop per server; records every request as a page trace |
| `admit` | canonical digest, schema walk, header policy, scanner tripwire |
| `namespace` | qualified names, backend mapping, collision policy |
| `consume` | argument validation before invoke, result validation before model use |
| `audit` | header names, rejection categories, digests; no values |

### Admission rules

1. Canonicalize the descriptor with sorted keys and compact separators, hash it, and store the digest under the qualified name with publisher evidence and approval time. An unknown key is quarantined. A changed digest is a rug pull and is quarantined until re-approved.
2. Walk the entire `inputSchema` tree. `x-mcp-header` is legal only on a direct member of `inputSchema.properties`, with type string, integer or boolean, a non-empty token header name unique without regard to case, and integer values inside the JavaScript safe range. Reject it under a nested object, a `oneOf` branch, `items`, a `$ref` target or any output schema.
3. Reject a descriptor whose mirrored property is named `password`, `secret`, `token`, `api_key` or `authorization`.
4. Run the static scanner for role tags, instruction overrides, concealment, secret access and obscured destinations. Treat a hit as review evidence, not as a verdict.
5. A descriptor without an input schema object is rejected; a tool with no arguments declares `{"type": "object", "additionalProperties": false}`.
6. Store the verified publisher namespace and the live `server/discover` identity with the approved record. On a later refresh, quarantine a server whose namespace or live identity differs, even when every descriptor digest still matches.

### Namespacing and merge

Qualified names are the public gateway names. Record the backend mapping separately. Sort before merging so local order does not depend on process timing. Never let discovery order decide a collision.

### The invoke path

Validate arguments before the call. Encode mirrored header values as plain visible ASCII or the exact base64 UTF-8 sentinel. Validate `structuredContent` as any JSON value against the output schema, including results with `isError: true`. Audit the header name and the encoding decision, never the value.

### Tests to ship

- A two-page list whose first page returns `""` as the cursor produces two requests.
- One unsafe descriptor is rejected and every valid descriptor on the same server is admitted.
- An annotation under `oneOf`, `items`, a nested `properties` or a `$ref` definition is rejected even when that branch is never used.
- Changing `inputSchema` without changing the description fails the pin.
- An unchanged descriptor behind a changed `server/discover` identity is quarantined.
- Two servers that both expose `search` become two qualified names and two digests.
- An array result passes an array output schema and an object fails it.
- Header audit events contain names and no values, checked by a test that greps for the value.

### Evidence for the reviewer

The capstone grades admission evidence: verified publisher namespace and live `server/discover` identity, deterministic and complete paginated discovery, descriptor validation before model exposure, validated structured output, and routing metadata that preserves authorization boundaries. Capture the descriptor, the page trace, the admitted set, the rejected set with a reason per descriptor, the digest ledger and one validated result. Do not claim gateway compatibility from a successful `tools/call` alone.

## Follow-ups

- **Level 3:** Why not stop pagination when a page's `tools` array is empty? Expected: emptiness is the server's choice; continue while `nextCursor` is present and not `null`.
- **Level 4:** Two servers return byte-identical descriptors under different names. What does the ledger hold? Expected: two qualified keys with two digests; the same digest under different keys is fine, and a different digest under the same key is the rug pull.
- **Level 4:** The scanner flags a legitimate warning sentence in a description. What happens? Expected: review, not automatic rejection; the scanner is a tripwire and a human approves the full descriptor.
- **Level 4:** A descriptor passes every check and is poisoned from day one. What catches it? Expected: nothing automatic; the design needs a review queue before the first pin, because hash equality proves stability and not safety.

## Wrong answers

- "Hash the description; schemas rarely change." Schema and annotation changes are the rug pull; pin the whole canonical descriptor.
- "Trust the server's deterministic order and skip the sort." Local registry order must not depend on process startup timing; sort before you merge.
- "Log header values to make debugging easier." A mirrored value can be routing data or, in a bad descriptor, a secret; audit names and rejection categories only.

## Taught in

The [tool poisoning lesson](../../../phases/13-tools-and-protocols/15-mcp-security-tool-poisoning/) gives the pin and the scanner, the [tool contracts lesson](../../../phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content/) gives the header and cursor rules, and the [capstone](../../../phases/19-capstone-projects/13-mcp-server-with-registry/) names the admission evidence.
