# MCP Conformance Engineering: Versioning, Evidence, and Operations

> A server is not conformant because its happy path worked through one SDK. Conformance lives at the wire, at version boundaries, through intermediaries, and during rollback.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 17 (gateways), Phase 13 · 30 (registry admission)
**Time:** ~100 minutes

## Learning Objectives

- Turn normative MCP rules into golden and negative wire transcripts.
- Keep strict `2026-07-28` behavior separate from bounded legacy fallback.
- Distinguish additive unknown fields from an invalid unknown `resultType`.
- Compare raw JSON-RPC evidence with an SDK-normalized view.
- Prove header and body integrity through a real proxy boundary.
- Gate releases with redacted transcript, health, and rollback evidence.

## The Problem

Your client calls `tools/list` through an SDK and gets tools. The integration test passes.

That result leaves important questions unanswered:

- Did the request carry modern per-request protocol metadata?
- Did `MCP-Protocol-Version`, `Mcp-Method`, and `Mcp-Name` match the JSON-RPC body?
- Did the response contain a valid `resultType` on the wire, or did the SDK synthesize one?
- Would the client preserve a future additive field?
- Would a recognized modern error accidentally trigger a legacy handshake?
- Did a proxy preserve the origin status and JSON-RPC error?
- Did the notification serializer emit a forbidden response?
- Can operations prove why a release was promoted or rolled back without storing secrets?

Conformance is a set of observable invariants. Build a harness that captures those invariants before production traffic has to discover them.

```figure
mcp-conformance-operations
```

## Start With Version Eras

MCP `2026-07-28` uses self-contained per-request metadata. A modern request carries `params._meta.io.modelcontextprotocol/protocolVersion` and `params._meta.io.modelcontextprotocol/clientCapabilities`. The exact namespaced keys matter; bare `protocolVersion` or `clientCapabilities` aliases are malformed. When mirrored routing headers are present at the HTTP boundary, their values must agree with the JSON-RPC body. Modern successful results carry `resultType`.

Versions through `2025-11-25` use the earlier initialization era. A legacy result without `resultType` is interpreted as complete only after the client has selected that earlier era.

Do not create one permissive validator that accepts both shapes at once. Use two branches:

| Branch | Entry evidence | Missing `resultType` | Initialization |
|---|---|---|---|
| Modern | Successful `server/discover` or recognized modern response | Invalid | Not the default path |
| Legacy | Configured allowlist plus a valid legacy `initialize` result after an inconclusive modern probe | Interpreted as complete | Required by that era |

The separation prevents a malformed modern peer from being rewarded with weaker validation.

### Strict mode

Strict mode requires proof of modern behavior. A successful `server/discover` proves the modern branch. A recognized modern JSON-RPC error also proves it. Correct the request or stop. Never downgrade because the server returned `-32020`, `-32021`, or `-32022`.

### Fallback mode

Fallback mode performs one bounded modern probe. A timeout, empty reply, closed connection, or unrecognized response is inconclusive. It does not prove that the peer is legacy. Only an endpoint explicitly configured or allowlisted for compatibility may then receive a bounded legacy probe, and the client selects the legacy branch only after validating that probe's `initialize` result and negotiated legacy revision.

Fallback is not “try legacy after any error.” A recognized modern error contains useful correction information. Downgrading after it can hide a header mismatch, missing capability declaration, or unsupported version.

This prevents an attacker, outage, or filtering proxy from forcing downgrade by dropping the modern response. Record the endpoint policy, inconclusive modern observation, exact positive legacy evidence, and selected era together.

Record the selected era beside every transcript. Without that fact, a missing field can look acceptable in one test run and invalid in another.

## Build a Transcript Corpus

A transcript fixture records what crossed the boundary, not only the SDK call:

```json
{
  "name": "golden-modern-list",
  "era": "modern",
  "headers": {
    "MCP-Protocol-Version": "2026-07-28",
    "Mcp-Method": "tools/list"
  },
  "request": {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {
      "_meta": {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {}
      }
    }
  },
  "responseStatus": 200,
  "responseBody": {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
      "resultType": "complete",
      "tools": []
    }
  }
}
```

Keep two classes of fixtures.

### Golden transcripts

Golden transcripts prove accepted behavior:

- modern discovery or method request with matching metadata and headers
- complete result with required fields
- `input_required` result when the method can request more input
- extension result only after the corresponding capability was advertised
- legacy result without `resultType`, but only in the selected legacy era
- notification processing with no JSON-RPC response

A golden transcript is precise, not large. Keep volatile IDs and timestamps deterministic or normalize them before comparison.

### Negative transcripts

Negative transcripts prove refusal behavior:

- header and body mismatch
- missing per-request capabilities
- unsupported matched protocol version
- missing modern `resultType`
- unknown or unadvertised `resultType`
- response `jsonrpc` other than `2.0` or an ID that differs in value or JSON type
- a response containing both `result` and `error`, or neither one
- an error without an integer `code` and string `message`
- a known protocol error mapped to the wrong HTTP status
- response emitted for a notification
- malformed JSON-RPC envelope
- proxy collapse of a protocol error

For each negative case, assert the rejection boundary and stable error code. “The call failed” is too weak. A proxy-generated 500 and an origin `-32020` can both look like failure while telling operators completely different stories.

The header-mismatch fixture must include the server's actual HTTP 400 JSON-RPC response with the matching request ID and error code `-32020`. Enforce that automatically whenever the local validator observes `HeaderMismatch`; do not make response verification an optional fixture flag. A case with HTTP 500 and no body fails even when the local rejection code was correct. A harness that stops after its own request validator throws has tested only itself, not the server's wire behavior.

The official MCP conformance project is useful as an external suite and versioned reference. Keep your local transcripts too. They capture your proxy, SDK, authentication, extensions, and release path, which a general suite cannot know.

## Header Values Must Match the RPC Body

In modern Streamable HTTP, intermediaries can route or enforce policy using mirrored headers. The JSON-RPC body remains the protocol source of truth. A mismatch is an integrity failure, not a hint to choose one value.

Validate in this order:

1. Parse and validate the JSON-RPC envelope and metadata types.
2. Compare `MCP-Protocol-Version` with `params._meta.io.modelcontextprotocol/protocolVersion`.
3. Compare `Mcp-Method` with `method`.
4. When the method has a routing name, compare `Mcp-Name` with the corresponding body value.
5. After equality is established, decide whether the matched version and capability set are supported.

This order distinguishes mismatch `-32020` from unsupported version `-32022`. It also stops a gateway from authorizing the header name while the origin executes a different body name.

HTTP field names are case-insensitive, while their values remain case-sensitive. Normalize header names before lookup and reject conflicting duplicates. For an unsafe, non-ASCII, or leading-or-trailing-whitespace `Mcp-Name`, decode the exact `=?base64?{Base64EncodedValue}?=` UTF-8 sentinel before comparing it with the body. Reject an incomplete sentinel, invalid Base64, invalid UTF-8, or raw unsafe value with `-32020`. Raw surrounding whitespace is invalid even when the body contains the same characters because that value required sentinel encoding before transport.

An intermediary can reject malformed HTTP before a request reaches the MCP server, so its failure may be an HTTP error without JSON-RPC. Capture whether a rejection came from the intermediary or origin. The origin MCP server should use the protocol error contract when it handled a valid JSON-RPC request.

## Unknown Fields Are Not Unknown Results

Forward compatibility requires two different rules.

### Additive unknown fields

Result objects and `_meta` maps can gain fields. A validator should preserve or ignore an additive field according to its role, unless the field violates a reserved contract. The sample keeps the full raw result in evidence and accepts `futureHint` beside a known result.

If you are a transparent proxy, preserving an unknown field is usually safer than stripping it. If you are an application client, ignoring it can be valid. Your differential test should still reveal that the SDK omitted it so the behavior is deliberate.

### Unknown `resultType`

`resultType` is a discriminator. Core modern results use `complete` or `input_required`. An extension can add another value only when its capability was advertised. The Tasks extension, for example, can add `task` in that negotiated capability context.

An unknown or unadvertised discriminator cannot be safely treated as complete. The client does not know the lifecycle it would be discarding. Reject it.

The same raw response can therefore contain an acceptable unknown field and an unacceptable unknown result type. Test both cases.

The discriminator is only the first layer. Validate the method-specific payload after it. A complete `tools/list` result needs a `tools` array whose descriptors have unique non-empty names, useful descriptions, and object-root `inputSchema` values. A `task` result is valid only for an eligible `tools/call` with the Tasks capability and requires `taskId`, known status, creation and update timestamps, and `ttlMs`, plus a valid optional polling interval. A complete `completion/complete` result requires a `completion` object with no more than 100 string values, an optional non-negative integer `total` that is not smaller than the returned values, and an optional Boolean `hasMore`. A well-spelled `resultType` cannot make a malformed payload conformant.

## The Notification Invariant

A JSON-RPC notification has no `id`. The receiver must not send a JSON-RPC success or error response.

For an accepted HTTP notification shape, the harness expects an HTTP `202` with an empty body. MCP `2026-07-28` defines no core client-to-server notifications over Streamable HTTP. The sample uses a namespaced course extension notification only to test the one-way serializer invariant. Do not present it as a new core method.

Test the serializer, not only the handler. A handler may return `None` while middleware wraps it in a JSON success object. Capture the final egress bytes.

## Add an SDK Differential

SDKs often turn wire objects into convenient language types. That is useful, but a normalized object cannot prove what was received.

For every high-risk fixture, capture:

1. Raw status, headers, and response body before SDK decoding.
2. SDK-normalized return value or exception.
3. The expected semantic projection for the selected era.
4. Fields lifted, synthesized, stripped, or changed by the SDK.

The sample permits SDK-only removal of known wire bookkeeping such as `resultType`, `_meta`, `ttlMs`, and `cacheScope` while comparing the application payload. It reports a dropped `futureHint` because that unknown semantic field disappeared.

Do not assume every difference is an SDK bug. The point is to make the transformation visible. Decide whether your component is an application endpoint, which may ignore an additive field, or a transparent intermediary, which should preserve it.

Run the differential against every SDK and version you ship. If two SDKs normalize the same transcript differently, release policy should say which behavior is acceptable rather than choosing the most convenient output after the fact.

## Capture Proxy Evidence

Most production MCP failures occur across more than one process. Record three views:

| View | Minimum evidence |
|---|---|
| Ingress | request headers, JSON-RPC body, content type, authenticated route, receive time |
| Origin | forwarded headers and body digest, origin status, response headers and body |
| Egress | client-visible status, headers, body, and send time |

The sample detects two common transformations:

- an origin HTTP 400 or 404 JSON-RPC error becomes a generic proxy 500
- the egress JSON-RPC body differs from the origin body

Add deployment-specific assertions for content type, `Accept`, compression, request-scoped SSE, cache headers, and trace correlation. Capture both sides of TLS termination when policy permits. Never log credentials just to prove the path.

## Redact Before Evidence Leaves Memory

Redaction is part of conformance operations, not a later cleanup job. Apply it before serialization, hashing, logs, test artifacts, or failure uploads.

The sample case-folds key names and removes separators before matching, then recursively replaces values under keys such as `Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key`, `accessToken`, `clientSecret`, `registrationAccessToken`, `token`, `password`, `secret`, and `api_key`. Canonicalization and the denylist must use the same form so camelCase, hyphenated, underscored, and dotted variants cannot bypass one another's policy. A production collector should add method-specific argument policy, because a harmless key like `query` can still contain personal or regulated data.

Hash the redacted evidence bundle. Keep raw captures only in an approved short-lived system when a specific investigation requires them. A digest proves which redacted bundle drove the decision; it does not reveal the removed value.

## Make Health and Rollback Part of the Gate

Protocol conformance is necessary but not sufficient for release. A conformant candidate can still time out, leak memory, or overload a dependency.

Define a health window before rollout:

- minimum sample count
- maximum error rate
- maximum latency percentile
- saturation or resource limits
- observation duration
- comparison with the admitted baseline

Define rollback evidence before rollout too:

- exact prior version
- admission evidence digest
- SHA-256 artifact and descriptor pins
- current Registry status
- current health result
- route restoration procedure
- an attestation over those exact fields from a trusted release-controller identity

Require that rollback target to be verified and healthy before promotion, not only after the candidate fails. A successful release without a usable recovery path is not production-ready.

If a candidate fails and the rollback target lacks that evidence, hold traffic instead of guessing. “Roll back to whatever was there” is not an operational control.

Do not reduce readiness to truthiness checks such as a non-empty version, `healthy: "yes"`, or an arbitrary evidence string. The sample requires exact types, an active status, three SHA-256 digests, a trusted signer, and a valid HMAC-SHA-256 attestation over the complete rollback payload. Its deterministic demo key is a non-secret fixture. Inject a protected key, KMS verification result, or public-key attestation verifier at the release boundary in production.

The release gate also refuses empty transcript, SDK differential, or proxy evidence. Each source must carry valid evidence digests. A green health window cannot fill in a boundary that was never observed.

## Build It

Run the standard-library harness:

```bash
cd phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations
python3 code/main.py
```

The demo runs exactly fifteen golden and negative transcripts, including valid and malformed completion results, compares a raw result with an SDK view, inspects a proxy that collapsed an origin error, evaluates health, authenticates the rollback evidence, and selects that target.

Expected shape:

```json
{
  "transcriptsPassed": 15,
  "transcriptsTotal": 15,
  "sdkDroppedFields": ["futureHint"],
  "proxyIssues": [
    "proxy collapsed a protocol error into HTTP 500",
    "proxy changed the origin JSON-RPC body"
  ],
  "releaseAction": "rollback",
  "evidenceDigest": "..."
}
```

Read `code/main.py` in this order:

1. `validate_request()` enforces era-specific request and header rules.
2. `validate_result()` separates missing legacy discriminators, valid modern values, extensions, and unknown values.
3. `select_era()` implements strict and bounded fallback policy.
4. `run_transcript()` evaluates golden and negative fixtures.
5. `compare_sdk_view()` exposes normalization differences.
6. `inspect_proxy()` compares ingress, origin, and egress evidence.
7. `redact()` removes obvious secrets before evidence hashing.
8. `rollback_evidence_ready()` validates exact pin fields and the trusted release attestation.
9. `ReleaseGate.evaluate()` joins non-empty conformance, SDK, proxy, health, and rollback evidence.

## Use It

Run the harness at four points:

1. On every implementation change with an in-process test adapter.
2. Against the built client and server binaries over the real transport.
3. Through the deployed proxy or gateway in a staging environment.
4. During canary rollout with live health and rollback evidence.

Keep the same stable case names across layers. `negative-header-body-mismatch` should mean the same invariant in unit, end-to-end, proxy, and canary reports. The evidence digest will differ because the boundary changed; the requirement should not.

Store fixture schemas in version control. Store redacted run evidence in your release system. Store short-lived raw captures only under incident access controls.

## Interactive Lab

### Lab A: prove the era boundary

From the `code` directory, open Python:

```bash
cd phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/code
python3 -q
```

Run:

```python
from main import *
validate_result({"tools": []}, "legacy")
validate_result({"tools": []}, "modern")
```

The legacy call infers `complete`. The modern call raises `ProtocolViolation`. Now test fallback:

```python
select_era({"kind": "timeout"}, "fallback")
select_era(
    {"kind": "timeout"},
    "fallback",
    legacy_allowed=True,
    legacy_evidence={"kind": "initialize_success", "protocolVersion": LEGACY_VERSION},
)
select_era({"kind": "jsonrpc_error", "code": -32021}, "fallback")
```

The first timeout fails closed because silence is not legacy evidence. The second call selects legacy only because configuration allows it and a valid legacy initialization result was observed. The recognized missing-capability error proves the modern branch.

### Lab B: additive field versus discriminator

```python
validate_result({"resultType": "complete", "tools": [], "futureHint": True}, "modern")
validate_result({"resultType": "future_mode", "tools": []}, "modern")
```

The first result preserves `futureHint`. The second is rejected because the lifecycle discriminator is unknown.

### Lab C: inspect an SDK transformation

```python
compare_sdk_view(
    {"resultType": "complete", "tools": [], "futureHint": {"mode": "new"}},
    {"tools": []},
)
```

Decide whether your component may ignore `futureHint` or must forward it. Write that choice into release policy. Do not silently erase the differential.

### Lab D: repair the proxy

Modify the demo exchange so egress preserves the origin status and body. Run `python3 main.py` again. The proxy issues should disappear, but the SDK differential still blocks promotion. Then include `futureHint` in the SDK view and observe the action change to `promote` when every evidence source passes.

## Practice Lab

Add request-scoped SSE transcripts to the harness.

Requirements:

- Capture response status, content type, ordered SSE events, and stream termination.
- Prove each JSON-RPC event has a valid era-specific result or error.
- Add a negative case for a proxy that buffers the full stream before forwarding.
- Add a negative case for an SSE event whose JSON-RPC id differs from the request.
- Redact event data before writing evidence.
- Include stream duration, first-event latency, and event count in the health window.
- Make the release gate choose only an evidenced rollback target when the stream fails.

Success means the same case runs directly and through the proxy, with a report that identifies the exact boundary that changed behavior.

## Shipped Artifact

This lesson ships `outputs/skill-mcp-conformance-release-gate.md`. Use it to turn a server, client, gateway, or SDK change into a versioned conformance matrix and release decision. The artifact requires raw wire evidence, negative cases, explicit era selection, SDK differentials, proxy proof, redaction, health thresholds, and rollback evidence.

## Verify It

Run the demo and deterministic suite:

```bash
cd phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

Verification should prove:

- every included golden and negative transcript reaches its expected outcome
- modern requests require the exact namespaced metadata keys
- HTTP header names are matched case-insensitively and encoded `Mcp-Name` values are decoded exactly
- header and body mismatch returns the modern mismatch code
- response version, ID, result or error exclusivity, error shape, and HTTP mapping are validated
- method-specific tool-list, task, and completion payload requirements are enforced
- every observed `HeaderMismatch` requires an actual HTTP 400 JSON-RPC `-32020` response
- raw `Mcp-Name` whitespace is rejected while exact sentinel-encoded whitespace round-trips
- a missing `resultType` is valid only in the selected legacy era
- additive fields survive raw validation while unknown result types fail
- extension result types require their advertised capability
- recognized modern errors never cause legacy fallback
- notifications produce no JSON-RPC response
- SDK bookkeeping removal and semantic field loss are distinguished
- proxy error collapse is detected and credentials are redacted recursively across camelCase and separator variants
- promotion requires non-empty transcript, SDK, proxy, and healthy operational evidence
- promotion and rollback both require an authenticated, pinned, active, healthy rollback target

## Production Failure Modes

| Failure | What the weak test reports | What the harness must prove |
|---|---|---|
| SDK synthesizes a missing discriminator | “tools/list passed” | Raw modern result lacked `resultType` and is invalid |
| Client downgrades after `-32021` | “legacy retry worked” | Recognized modern error forbids fallback |
| Unknown result type treated as complete | “response parsed” | Unadvertised lifecycle discriminator is rejected |
| Proxy authorizes one tool and origin executes another | “request reached server” | `Mcp-Name` equals the body routing name at every hop |
| Harness throws before reading the server response | “header mismatch test passed” | HTTP 400 and JSON-RPC `-32020` response are captured and validated |
| Proxy turns origin 400 into generic 500 | “upstream error” | Origin and egress statuses and JSON-RPC bodies are preserved |
| Notification middleware emits `{result: null}` | “handler returned none” | Final egress body is empty and no JSON-RPC response exists |
| SDK strips an additive field | “typed objects match” | Raw and normalized views show the exact dropped field |
| Failure artifact leaks a bearer token | “debug bundle uploaded” | Redaction occurred before hashing, logging, or upload |
| Credential key style bypasses redaction | “denylist contains api_key” | CamelCase and separator variants share one canonical denylist form |
| Canary has no samples but appears healthy | “zero errors” | Minimum sample count is enforced |
| Rollback selects an unknown build | “previous deployment restored” | Target version, admission digest, pins, status, and health are present |

## Operational Rule

Test the bytes you send, the bytes every intermediary forwards, the semantics each SDK exposes, and the evidence operations will use under pressure. Compatibility is an explicit branch. Rollback is an evidence-backed release action. Neither should be an accidental side effect of a permissive parser.

## Further Reading

- [MCP 2026-07-28 base protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic)
- [MCP version negotiation](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Official MCP conformance project](https://github.com/modelcontextprotocol/conformance)
