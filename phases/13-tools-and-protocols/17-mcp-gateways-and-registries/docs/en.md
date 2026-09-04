# Stateless MCP Gateways and Registry Admission

> A gateway should make every route explicit. The 2026-07-28 protocol gives it method, name, version, capability, identity, cache, and trace boundaries without a transport session.

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 13 · 15 (security), Phase 13 · 16 (authorization)
**Time:** ~75 minutes

## Learning Objectives

- Aggregate several MCP servers behind one 2026-07-28 endpoint without session affinity.
- Validate per-request metadata and routing headers before policy or forwarding.
- Merge tools with stable namespaces, deterministic order, descriptor pins, RBAC, and private caching.
- Treat registry records as discovery evidence that still requires admission policy.
- Route request-scoped SSE, `subscriptions/listen`, MRTR retries, and Tasks extension calls correctly.
- Isolate legacy handshake and session support from the modern path.

## The Problem

Connecting one client directly to one server is simple. A larger deployment needs a consistent answer to harder questions:

- Which servers are allowed?
- Which principal can see and call each tool?
- What happens when two backends expose the same name?
- How are descriptor changes reviewed?
- Where are rate limits and audit events applied?
- Can any instance handle the next request?

A gateway sits between clients and backend MCP servers. It presents one MCP endpoint, applies cross-cutting policy, and forwards approved requests.

Older gateway designs often multiplexed one client session into several backend sessions and rewrote `Mcp-Session-Id`. That is a legacy compatibility design. The 2026-07-28 core has no protocol sessions.

## The Concept

### The modern gateway path

For each request:

1. Authenticate the principal from transport authorization.
2. Validate `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name`, and `params._meta`.
3. Authorize the principal, resource, method, tool, and arguments.
4. Apply descriptor, registry, rate, and data policy.
5. Create a fresh self-contained request for the selected backend.
6. Validate the backend result and return a gateway result.
7. Record an audit event without logging secrets.

No step needs a hidden protocol session. Application state can still exist in databases, explicit handles, Tasks, or integrity-protected MRTR state.

### Runtime policy is the primary gateway decision

Admission decides which backend version may enter the gateway. It does not authorize a live call. For every request, the gateway recomputes policy from the authenticated principal, issuer and resource, tenant, matched method and name, normalized arguments, admitted descriptor pin, current backend health, capability intersection, data classification, rate state, and any action-bound approval.

This ordering matters. A Registry record can remain active while a user's role is revoked. A descriptor can remain pinned while a destination argument crosses a tenant boundary. A backend can remain approved while incident policy quarantines state-changing calls. Runtime policy is therefore the primary allow or deny decision, with Registry and descriptor evidence as inputs.

Do not cache an allow decision under a connection or removed session identifier. If policy is unavailable, follow a declared failure policy by operation class. A safe default is to fail closed for state changes and sensitive reads, while explicitly approved public read paths may use a short-lived last-known policy only when their risk model permits it. Record which policy version and failure path made the decision, then validate the backend result before returning it.

### One POST endpoint

Modern Streamable HTTP sends each JSON-RPC message through POST:

```text
POST /mcp
Authorization: Bearer <gateway-token>
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes.search
Accept: application/json, text/event-stream
```

The gateway can return JSON or request-scoped SSE for that POST. GET and DELETE return 405 for modern requests. `Mcp-Session-Id` and `Last-Event-ID` do not create authority, affinity, or replay behavior.

Header and body values must agree. Reject mismatch with `-32020` before looking up a backend. This lets load balancers, gateways, and rate limiters route without parsing the full body while preserving end-to-end integrity.

Validate in one exact order: JSON-RPC and metadata types, header and body equality, then support for the matched version. A mismatch returns HTTP 400 with `-32020`. If header and body agree on an unsupported version, return HTTP 400 with `-32022` and `data` exactly `{"supported":["2026-07-28"],"requested":"<actual>"}`. An unknown method returns HTTP 404 with `-32601`.

`ProtocolError` carries optional `data`, and the gateway serializes it into the JSON-RPC error object. A notification has no `id`, so it never receives a JSON-RPC success or error. An accepted HTTP notification returns 202 with an empty body.

### Implement discovery at every layer

The gateway implements `server/discover` for clients. It also discovers each backend so it knows protocol versions, capabilities, and extensions.

Example gateway result:

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "tools": {"listChanged": true}
  },
  "ttlMs": 30000,
  "cacheScope": "private",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "enterprise-gateway",
      "version": "2.0.0"
    }
  }
}
```

Advertise only the capability intersection the gateway can honor end to end. A backend feature is not automatically safe to expose. A gateway feature with no backend path is not useful to advertise.

`serverInfo` is self-reported display and diagnostic data. Do not use it as registry or publisher proof.

### Per-request client capabilities

Every forwarded request needs a current `_meta` envelope:

```json
{
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
  "io.modelcontextprotocol/clientInfo": {
    "name": "enterprise-gateway",
    "version": "1.0.0"
  }
}
```

Do not blindly copy the outer client capabilities to a backend. The gateway is the backend's client. Advertise only features the gateway will mediate correctly.

### Deterministic namespacing

Merge backend tools under stable public names:

```text
notes.search
notes.create
issues.list
issues.open
```

Keep a mapping from public name to backend and original tool name. Never choose the first or last collision. A public name is part of the approval and audit contract, so changing it is a migration.

`tools/list` must be deterministic. When visibility differs by principal, return `cacheScope: private`. A bounded `ttlMs` reduces backend discovery load without allowing a user-specific list to leak across authorization contexts.

Every exposed tool descriptor includes a stable name, description, and object-root `inputSchema`. Namespacing cannot remove required descriptor fields. The complete list result also includes `resultType`, server identity metadata, and cache hints.

### Pin approved descriptors

At admission time, canonicalize the complete descriptor and store its digest under the qualified public name. At list and call time, compare the live descriptor with the approved digest.

If it changes:

- Remove it from `tools/list`.
- Reject direct calls.
- Emit an audit event.
- Require policy or human re-approval before updating the pin.

A gateway is a useful central enforcement point, but it does not turn a first-seen descriptor into a safe one. Initial review remains necessary.

### Registries help discover, not decide

A Registry `server.json` provides publication metadata. A package-backed record can look like this:

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "com.example/notes",
  "description": "Example notes MCP server.",
  "version": "1.0.0",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "@example/notes-mcp",
      "version": "1.0.0",
      "transport": {"type": "stdio"}
    }
  ]
}
```

Publication metadata does not carry the gateway's security decision. Keep verified publisher and provenance evidence in separate admission state:

```json
{
  "registryName": "com.example/notes",
  "registryVersion": "1.0.0",
  "publisher": {"namespace": "com.example", "status": "verified"},
  "provenance": {
    "source": "registry.modelcontextprotocol.io",
    "recordId": "com.example/notes@1.0.0"
  },
  "admission": {"status": "approved", "reviewedBy": "gateway-policy"}
}
```

The gateway checks the `server.json` shape and joins it to that external state. The gateway still needs an admission policy.

For each admitted backend, record:

- Exact registry and record identifier.
- Verified publisher namespace or domain evidence.
- Allowed transport and endpoint.
- Pinned version or approved upgrade policy.
- Artifact or descriptor digest.
- Authorization issuer and resource.
- Reviewer, approval time, and expiry.

Do not accept a server because its display name resembles a familiar product. Do not treat registry presence as an operational security review. Private servers can be admitted through the same evidence schema even when they never appear in a public registry.

This lesson implements the gateway seam: join publication evidence to local admission before a backend becomes routable. [Lesson 30: MCP Registry Supply Chain, Admission, Drift, and Rollback](../../30-mcp-registry-supply-chain-and-drift/docs/en.md) builds the full control plane for exact namespace proof, artifact provenance, immutable pins, live descriptor drift, Registry status reconciliation, a tamper-evident admission ledger, and evidence-backed rollback. Keep that supply-chain state separate from the per-request runtime decision above.

### Credential mediation

The gateway authenticates its callers and separately authenticates to backends. Backend credentials never go to the client.

Keep these bindings explicit:

```text
outer principal -> gateway role and policy
backend issuer + resource -> backend registration and token
```

Never pass the outer gateway token to a backend. Never reuse a backend token at a different issuer or resource. If a tool acts on behalf of an end user, preserve that delegation with a designed exchange or claims model rather than impersonating the user with a shared service credential.

### Rate limits without sessions

Key limits by authenticated principal, issuer, resource, public tool, cost class, and time window. A session id is absent and would be easy to rotate even if it existed.

Apply cheap validation before consuming expensive work. Decide whether rejected calls count against abuse limits, business quotas, or both.

### Audit the decision chain

Record enough to reconstruct a call:

- Request and trace identifiers.
- Authenticated principal and issuer.
- Public tool and backend route.
- Descriptor pin version.
- Policy decision and reason.
- Latency and result class.
- MRTR round or task identifier when applicable.

Redact bearer tokens, authorization codes, refresh tokens, raw secrets, and unnecessary sensitive arguments.

### Request-scoped SSE

A normal POST may return request-scoped SSE when work streams during that one request. Closing the response stream cancels that in-flight modern HTTP request.

Do not create a separate GET stream and do not promise Last-Event-ID replay. Those are older transport assumptions.

### Long-lived change notifications

For list and resource change notifications, a current client sends `subscriptions/listen` through POST and receives an SSE response. Notification filters use the exact flat fields `toolsListChanged`, `promptsListChanged`, `resourcesListChanged`, and `resourceSubscriptions`:

```json
{
  "jsonrpc": "2.0",
  "id": "listen-tools",
  "method": "subscriptions/listen",
  "params": {
    "notifications": {
      "toolsListChanged": true
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

The first event acknowledges the supported subset. Its subscription identifier is the JSON-RPC id of the request that opened the stream:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/subscriptions/acknowledged",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/subscriptionId": "listen-tools"
    },
    "notifications": {
      "toolsListChanged": true
    }
  }
}
```

The gateway then forwards only the acknowledged change types. Every notification on that stream carries the same `io.modelcontextprotocol/subscriptionId` in `params._meta`. There is no automatic replay or automatic re-listen. On reconnect, the client reopens the subscription and refreshes the lists it relies on. A server-initiated graceful close returns a final complete result tagged with the same subscription id.

The modern path replaces `resources/subscribe`, `resources/unsubscribe`, and unsolicited standalone GET streaming. Keep those only in a version-gated older path.

### MRTR through a gateway

When a backend returns `resultType: input_required`, the gateway can forward that result only if the outer client supports the needed input request. Preserve `requestState` byte for byte unless the gateway deliberately terminates and reissues the interaction.

The client retries the original public tool with a fresh JSON-RPC id and `inputResponses`. The gateway re-authorizes the retry, checks the same public route, then forwards a fresh backend request. It must not assume an earlier round granted unlimited approval.

### Tasks extension routing

Tasks are an official extension identified by `io.modelcontextprotocol/tasks`. They are not a core session replacement.

The client declares the extension inside per-request client capabilities, and the gateway advertises it in discovery only when it can preserve the lifecycle end to end. For a supported `tools/call`, the backend alone decides whether to return the ordinary result or `resultType: task`. A task result carries `taskId`, `status`, timestamps, `ttlMs`, and an optional `pollIntervalMs` directly in the result. The task must already be durably readable before that result is sent.

The gateway records the authenticated principal and backend route for the opaque task identifier. Subsequent `tasks/get`, `tasks/update`, and `tasks/cancel` calls use `params.taskId` as `Mcp-Name`, which gives intermediaries a routing key. `tasks/get` returns `resultType: complete` with the current task state and inlines the final result or protocol error in a terminal state. `tasks/update` sends keyed `inputResponses` for outstanding task input and returns an empty complete acknowledgment. `tasks/cancel` is a cooperative intent with an empty complete acknowledgment, not a guarantee that work stops.

Do not implement new `tasks/list` or `tasks/result` methods. They belong to the older experimental model. A task that needs input exposes complete embedded requests through `tasks/get`; the client answers them through `tasks/update`, not by retrying the original tool call. The client still polls at the suggested interval; task creation remains server-directed.

Durable task route state is application data keyed by the task handle, not a protocol session.

### Compatibility boundary

If the gateway must serve an older client or backend:

- Detect the era explicitly.
- Keep initialization, transport sessions, GET streams, resource subscriptions, and old task vocabulary inside a legacy adapter.
- Never leak a legacy session id into modern routing or authorization.
- Prefer a bounded discovery probe and explicit fallback policy over silent downgrade.

```figure
t3-gateway-funnel
```

## Build It

`code/main.py` implements an in-process protocol gateway and two backend servers. Each backend receives a fresh current-protocol request. The gateway provides discovery, user-filtered deterministic `tools/list`, namespaced routing, Registry `server.json` plus external admission state, descriptor pins, RBAC, principal-keyed rate limits, audit decisions, and a modeled `subscriptions/listen` SSE acknowledgment.

The model receives parsed request bodies, routing headers, and an authenticated bearer identity. It is not a complete HTTP adapter and does not parse `Content-Type` or the full `Accept` contract. Connect it to Lesson 09's Streamable HTTP adapter, which requires `Content-Type: application/json` and an `Accept` value containing both `application/json` and `text/event-stream`.

Run it:

```bash
cd phases/13-tools-and-protocols/17-mcp-gateways-and-registries
python3 code/main.py
python3 -m unittest discover code/tests -v
```

The demo prints the outer request id and fresh backend request id so the stateless hop is visible.

## Use It

Replace the in-process backend objects with real current-protocol clients. Keep the same seams:

- Admission record before connection.
- Backend discovery before capability exposure.
- Qualified public name before authorization.
- Descriptor pin before list or call.
- Fresh per-request metadata before forwarding.
- Result validation before returning.

## Ship It

This lesson ships `outputs/skill-gateway-bootstrap.md`. It produces a modern gateway design covering ingress, discovery, admission, namespaces, authorization, caching, streaming, subscriptions, MRTR, Tasks, observability, and legacy isolation.

## Exercises

1. Add trace context to the outer and forwarded request metadata and record the correlation in the audit event.
2. Add a Tasks-capable backend and route `tasks/get` by task id in `Mcp-Name`.
3. Change one backend descriptor and prove both discovery and direct call are blocked.
4. Add a principal-specific server capability and explain why discovery must remain privately cached.
5. Write a legacy adapter interface without adding any legacy state to the modern `Gateway` class.

## Key Terms

| Term | Meaning |
|------|---------|
| MCP gateway | Policy and routing server between clients and backend MCP servers |
| Admission record | Evidence and policy decision allowing one backend into the gateway |
| Qualified tool name | Stable public route such as `notes.search` |
| Descriptor pin | Approved digest checked during discovery and dispatch |
| Private cache scope | Cached result restricted to one authorization context |
| Request-scoped SSE | Streaming response attached to one POST request |
| `subscriptions/listen` | Client-opened SSE stream for selected long-lived change notifications |
| Task route | Application mapping from an opaque task id to its backend |
| Legacy adapter | Explicit version-gated boundary for old handshake and session behavior |

## Further Reading

- [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [Official Registry server.json requirements](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/official-registry-requirements.md)
- [MCP Tasks extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)
