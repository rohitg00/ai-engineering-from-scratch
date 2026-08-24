# MCP Security: Poisoned Metadata, Routing, and MRTR State

> Stateless does not mean trustless. It means every request exposes the evidence a server and gateway need to validate the call independently.

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 08 (MCP client)
**Time:** ~60 minutes

## Learning Objectives

- Treat tool descriptions, annotations, client information, and server information as untrusted data.
- Detect metadata poisoning, descriptor changes, and cross-server name collisions.
- Validate the 2026-07-28 request metadata and Streamable HTTP routing headers.
- Protect MRTR `requestState` against tampering and bind confirmation to exact arguments.
- Apply authorization and rate limits to a principal, not a removed protocol session.

## The Problem

A model reads tool descriptions to decide what to call. A router reads tool names to decide where to send a request. A user reads labels to decide what to approve. One malicious descriptor can target all three.

The official MCP security guidance is direct: descriptions and annotations should be treated as untrusted unless they come from a trusted server. Even then, deployment trust can change. A server update, compromised package, registry mistake, or gateway merge can alter what the model sees.

The current protocol also changes the security boundary. In 2026-07-28 there is no core handshake and no transport session. A security design that keys approval, rate limits, or audit history only by `Mcp-Session-Id` is not a current design.

## The Concept

### Seven attack surfaces worth checking

Use a concrete list instead of the vague instruction to be careful.

1. **Metadata poisoning.** A description contains instructions unrelated to the declared tool behavior.
2. **Descriptor rug pull.** A previously approved name, description, schema, or annotation changes.
3. **Cross-server shadowing.** Two backends expose the same unqualified tool name and routing chooses one silently.
4. **Header and body confusion.** `Mcp-Method` or `Mcp-Name` disagrees with the JSON-RPC request.
5. **Capability escalation.** A peer claims an extension or client feature and the server mistakes that declaration for authorization.
6. **MRTR state tampering.** A client changes `requestState`, answers a different question, or reuses confirmation with different arguments.
7. **Supply-chain identity confusion.** A familiar display name is treated as proof of publisher or server identity.

These surfaces overlap. Hash pinning helps with descriptor changes but does not prove that the first descriptor was safe. Static scanning catches obvious phrases but not subtle instructions. Namespacing prevents one collision class but not a malicious namespaced server. Stack the controls.

### The current request envelope is evidence, not identity

Every 2026-07-28 request contains:

```json
{
  "_meta": {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {
      "elicitation": {"form": {}}
    },
    "io.modelcontextprotocol/clientInfo": {
      "name": "security-lab",
      "version": "1.0.0"
    }
  }
}
```

Validate the version and capability shape on every request. Use capabilities to choose a compatible response shape. Do not use `clientInfo` as an authenticated principal. It is self-reported.

The same warning applies to `io.modelcontextprotocol/serverInfo` in result metadata. It is useful for logs and debugging. It is not a certificate, registry proof, or authorization decision.

### Validate routing before policy

For `tools/call`, Streamable HTTP includes:

```text
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes.export
```

The header method must equal the body method. The header name must equal `params.name`. Reject disagreement with `-32020` before selecting a backend, applying RBAC, or consuming a rate-limit token.

This ordering closes a common ambiguity: one component authorizes the body while another routes by the header.

Wire validation follows one exact sequence. Validate JSON-RPC and metadata types, compare header values with the body, then check whether the matched version is supported. A mismatched header returns HTTP 400 with `-32020`. If header and body agree on an unsupported version, return HTTP 400 with `-32022` and `data` exactly `{"supported":["2026-07-28"],"requested":"<actual>"}`. An unknown method returns HTTP 404 with `-32601`.

Every error object includes optional `data` when the contract needs structured recovery information. A notification has no `id`, so it never receives a JSON-RPC success or error response. An accepted HTTP notification returns 202 with an empty body.

### Pin the whole descriptor

A description hash alone misses schema and annotation changes. Canonicalize and hash the descriptor fields the user approved:

```python
normalized = json.dumps(tool, sort_keys=True, separators=(",", ":"))
digest = hashlib.sha256(normalized.encode()).hexdigest()
```

Store the digest under a qualified key such as `notes.export`, together with publisher evidence and approval time outside this toy example.

On every refresh:

- Unknown key: quarantine until review.
- Same key, different digest: quarantine as a rug pull until re-approved.
- Duplicate unqualified name: require deterministic namespacing.
- Scanner hit: block and review the complete descriptor.

Hash equality proves stability, not safety. A poisoned descriptor stays poisoned when perfectly pinned.

### Static scanning is a tripwire

Simple patterns can flag role tags, instruction overrides, concealment, secret access, and obscured network destinations. They are cheap enough for install time and CI.

They are not a semantic proof. A safe description can contain a flagged phrase in a legitimate warning. A malicious description can avoid every phrase. Treat scanner output as review evidence, not an automatic innocence score.

### Namespace before merging

Suppose two servers both expose `search`. Never let discovery order decide which wins.

```text
notes.search
issues.search
```

The qualified name is the public gateway name. Record the backend mapping separately. Stable names make approval, audit, hash pins, and `Mcp-Name` routing refer to the same object.

### Capabilities are compatibility declarations

Per-request `clientCapabilities` tells a server which protocol features the client can process. It does not grant the client access to tools, data, or actions.

Authorization still comes from the authenticated principal and resource policy. The sequence is:

1. Authenticate transport credentials.
2. Validate version, headers, and request shape.
3. Check capability compatibility.
4. Authorize principal, tool, resource, and arguments.
5. Execute or request user input.

### Protect stateless MRTR confirmation

A consequential tool may need user confirmation. Current MCP uses Multi Round-Trip Requests instead of a server-to-client callback.

First response:

```json
{
  "resultType": "input_required",
  "inputRequests": {
    "confirm": {
      "method": "elicitation/create",
      "params": {
        "mode": "form",
        "message": "Export notes to archive?",
        "requestedSchema": {
          "type": "object",
          "properties": {
            "confirm": {"type": "boolean"}
          },
          "required": ["confirm"]
        }
      }
    }
  },
  "requestState": "opaque-integrity-protected-value"
}
```

The client obtains input and retries the original method with a new JSON-RPC id:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "notes.export",
    "arguments": {"query": "private", "destination": "archive"},
    "requestState": "opaque-integrity-protected-value",
    "inputResponses": {
      "confirm": {
        "action": "accept",
        "content": {"confirm": true}
      }
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "elicitation": {"form": {}}
      }
    }
  }
}
```

Each `inputRequests` value is a complete embedded request with `method` and `params`. Its key must match the corresponding entry in `inputResponses`. A form elicitation uses an object-root `requestedSchema`, and the client must have declared form elicitation capability before the server requests it.

The current capability has two valid form declarations. `{"elicitation":{}}` implicitly supports form elicitation, while `{"elicitation":{"form":{}}}` states it explicitly. A URL-only declaration such as `{"elicitation":{"url":{}}}` does not support a form request. The server returns HTTP 400 with `-32021` and `data.requiredCapabilities` equal to `{"elicitation":{"form":{}}}`.

Treat `requestState` as hostile input. Sign or encrypt it, validate it, and bind it to method, tool, exact arguments, purpose, expiry, principal, and a one-time nonce when replay matters. The lesson code uses HMAC and exact argument matching to make the boundary visible.

The nonce ledger must not live inside one gateway object. The runnable model injects a bounded, TTL-pruned replay store that can be shared by multiple gateway instances. Its atomic claim is the execution boundary: only a validated acceptance or explicit terminal decline consumes state. A malformed response or `cancel` executes nothing and remains retryable until expiry. A production fleet needs the same conditional claim in shared durable storage.

Do not store hidden confirmation context in a protocol session. Any server instance should be able to validate the retry.

### Rule of two for high-risk calls

Classify a call along three axes:

- It consumes untrusted input.
- It can access sensitive data.
- It causes a consequential external action.

A single automatic step should not combine all three. Split it, reduce privilege, or request explicit user input through MRTR. This is a design heuristic, not a protocol capability.

### Reduce authority before execution

Statelessness alone is not safety. It removes hidden protocol history, but a self-contained request can still ask an overpowered handler to leak data or make an irreversible change. Safety comes from reducing authority at each boundary:

1. **Typed verb.** Expose one bounded operation such as `archive_note`, not a generic `run` or `request` tool that can express unrelated powers.
2. **Validated arguments.** Use a closed schema where practical, reject unknown fields, normalize identifiers once, cap sizes, and validate destination, tenant, and resource ownership before policy evaluation.
3. **Current authorization.** Bind the authenticated principal to the exact verb, resource, environment, and normalized arguments. Tool annotations and client capabilities do not grant this authority.
4. **Action-bound approval.** For a consequential call, bind approval to a digest of the typed verb and normalized arguments, plus principal, expiry, and one-time policy. Any changed field requires a new decision.
5. **First-class refusal.** Model deny, expired approval, user decline, and unsafe destination as ordinary outcomes that execute no side effect. Do not translate refusal into a weaker fallback tool.
6. **Redacted audit evidence.** Record who asked, which admitted descriptor and policy version were used, what normalized target was authorized, why the decision allowed or refused, and whether execution began. Store digests or redacted values instead of secrets.

Each step narrows what the next component may do. The final handler should receive an already validated domain command, not raw model text plus broad credentials. Repeat the entire chain on an MRTR retry, task update, or gateway-forwarded call. An earlier approval does not turn later requests into trusted session traffic.

### Current and legacy interaction paths

Roots, Sampling, and Logging are deprecated for new 2026-07-28 implementations. A gateway may retain older request-channel code only as a version-gated compatibility path.

Do not build a new defense around a per-session sampling limiter. Apply quotas to authenticated principal, issuer, resource, tool, and time window. For current interactive work, inspect MRTR input requests and responses.

### Stateless transport checks

- Accept modern MCP messages at the single POST endpoint.
- Return 405 for modern GET and DELETE.
- Do not mint or depend on `Mcp-Session-Id`.
- Ignore legacy session and replay headers as authority inputs.
- Return JSON or request-scoped SSE for that POST.
- Use `subscriptions/listen` only for opted-in long-lived change notifications.

```figure
tp-tool-poisoning
```

## Build It

`code/main.py` implements a small in-process security gateway model. It canonicalizes and pins full tool descriptors, reports metadata poisoning and shadowing, validates the modern request envelope and routing values, and performs a two-round confirmed export with signed `requestState` and an injected shared replay store.

The model starts after an HTTP adapter has parsed the JSON body and routing headers. It does not validate `Content-Type` or `Accept`. Connect the same dispatcher to Lesson 09's complete Streamable HTTP adapter, which requires `Content-Type: application/json` and an `Accept` value containing both `application/json` and `text/event-stream`.

Run it:

```bash
cd phases/13-tools-and-protocols/15-mcp-security-tool-poisoning
python3 code/main.py
python3 -m unittest discover code/tests -v
```

The sample intentionally mutates a descriptor. The scanner and digest comparison produce independent findings. The export then demonstrates the `input_required` response and stateless retry.

## Use It

Replace `SAFE_TOOLS` with a normalized snapshot from your own approved servers. Keep credentials and secrets out of the snapshot. Review every new or changed descriptor before updating its digest.

At a gateway, run the same checks during discovery and again before dispatch. A cache can reduce discovery work, but a cached approval must expire or be invalidated when the descriptor changes.

## Ship It

This lesson ships `outputs/skill-mcp-threat-model.md`. It produces a current-protocol threat model across metadata, routing, capability, authorization, MRTR, caching, registry, and compatibility boundaries.

## Exercises

1. Bind the authenticated principal and current authorization decision to the sealed MRTR state, then reject a retry under a different principal.
2. Replace the in-memory replay store with a persistent conditional insert and prove two processes cannot both claim one nonce.
3. Inject a failure after replay claim but before a simulated export. Define and test the transaction or idempotency rule that makes recovery safe.
4. Change a tool's `inputSchema` without changing its description. Confirm whole-descriptor pinning catches it.
5. Add a policy that refuses public caching when `tools/list` differs by principal.
6. Model an older server behind the gateway. Put all handshake and session behavior behind an explicit `2025-11-25` compatibility branch.

## Key Terms

| Term | Meaning |
|------|---------|
| Metadata poisoning | Instructions or deceptive claims embedded in a tool descriptor |
| Rug pull | Change to a previously approved descriptor |
| Tool shadowing | Ambiguous routing caused by duplicate unqualified names |
| Header mismatch | Routing header and JSON-RPC body disagreement, error `-32020` |
| Hash pin | Digest of the complete approved descriptor |
| MRTR | Stateless response and retry pattern for server-requested input |
| `requestState` | Opaque round-trip value that must be treated as untrusted input |
| Capability declaration | Statement of protocol compatibility, not authorization |
| Implicit form support | An empty `elicitation` capability object, equivalent to form support |
| Qualified tool name | Stable gateway name such as `notes.search` |

## Further Reading

- [MCP security and trust guidance](https://modelcontextprotocol.io/specification/2026-07-28#security-and-trust--safety)
- [Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Deprecated features](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)
