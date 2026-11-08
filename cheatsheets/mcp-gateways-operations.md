---
id: mcp-gateways-operations
title: MCP Gateways, Registries and Conformance
code: GR
subtitle: Route through a stateless gateway, admit registry versions, catch drift, test the wire and gate releases.
hue: 30
sources: phases/13-tools-and-protocols/17-mcp-gateways-and-registries, phases/13-tools-and-protocols/23-capstone-tool-ecosystem, phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift, phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations
source_hash: 30a66413dc9dbd36
---

## Gateway request path
type: architecture
from: phases/13-tools-and-protocols/17-mcp-gateways-and-registries/docs/en.md, phases/13-tools-and-protocols/17-mcp-gateways-and-registries/code/main.py

```arch
node | client | 1,1 | Client | bearer and _meta | client
node | wire | 2,1 | validate_wire | headers equal body | process
node | policy | 3,1 | RBAC and TokenBucket | per principal | process
node | pin | 4,1 | Descriptor pin | descriptor_digest | process
node | reg | 1,2 | Registry record | publication only | store
node | adm | 2,2 | Admission state | verified publisher | store
node | notes | 3,2 | notes backend | fresh request id | process
node | issues | 4,2 | issues backend | fresh request id | process
edge | client | wire | POST
edge | wire | policy | -32020 first
edge | policy | pin | allow
edge | pin | notes | notes.search
edge | pin | issues | issues.list
edge | reg | adm | join
edge | adm | pin | admit
```

## Run and verify
type: command-table
from: phases/13-tools-and-protocols/17-mcp-gateways-and-registries/docs/en.md, phases/13-tools-and-protocols/23-capstone-tool-ecosystem/docs/en.md, phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/docs/en.md, phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/docs/en.md

| Command | What it does |
|---|---|
| `python3 code/main.py` | Runs the demo from the lesson folder |
| `python3 -m unittest discover code/tests -v` | Runs the gateway tests (lesson 17) |
| `python3 -m unittest discover -s code/tests -v` | Runs the registry and conformance suites |
| `python3 -q` | Opens a shell in `code/` for the labs |
| `from main import *` | Loads the lab functions in that shell |

## Gateway tasks in code
type: task-table
from: phases/13-tools-and-protocols/17-mcp-gateways-and-registries/code/main.py, phases/13-tools-and-protocols/23-capstone-tool-ecosystem/code/main.py

| Task | Code |
|---|---|
| Build a request and headers | `make_request(method, request_id, params)` |
| Send it as a principal | `gateway.handle("bearer-alice", body, headers)` |
| Check the wire first | `validate_wire(body, headers)` |
| Pin one descriptor | `descriptor_digest(tool)` |
| Rate limit a principal | `TokenBucket().consume()` |
| Admit a registry record | `registry_record_is_admissible` |
| Scope check in the capstone | `gateway_call(token, tool_name, args, ...)` |

## Registry admission, drift, rollback
type: annotated-code
lang: python
from: phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/code/main.py, phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/docs/en.md

```python
controller = RegistryAdmissionController(clock=lambda: next(ticks))
active_meta = {OFFICIAL_META_KEY: {"status": "active"}}
controller.admit(sample_record("1.1.0"), active_meta,
    namespace_for_domain("example.com"),         # gives com.example
    evidence_for("1.1.0"), sample_live("1.1.0"))  # admit 1.0.0 the same way
drift = controller.check_live("com.example/inventory", "1.1.0",
    sample_live("1.1.0", True))                  # extra tool: quarantined
controller.observe_registry_status("com.example/inventory", "1.1.0", "deprecated")
controller.rollback("com.example/inventory", "1.0.0", "unexpected delete tool")
controller.ledger.verify()                       # False after any edit
namespace_matches("com.exampleevil/inventory", "com.example")  # False
```

## Conformance harness
type: annotated-code
lang: python
from: phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/code/main.py, phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/docs/en.md

```python
validate_result({"tools": []}, "legacy")      # infers complete
validate_result({"tools": []}, "modern")      # raises ProtocolViolation
select_era({"kind": "timeout"}, "fallback")   # fails closed
select_era({"kind": "jsonrpc_error", "code": -32021}, "fallback")  # modern
cases = [run_transcript(case) for case in transcript_suite()]  # 15 cases
compare_sdk_view(raw_result, {"tools": []})   # droppedFields futureHint
inspect_proxy(exchange)                       # finds a 400 turned into 500
redact(value)                                 # before hashing or upload
evaluate_health(healthy_window())             # samples, error rate, p95
ReleaseGate(signers).evaluate(cases, [sdk_report], [proxy_report],
                              healthy_window(), rollback)  # promote or rollback
```

## Seven admission controls
type: flow
from: phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/docs/en.md

1. **Namespace**: compare the segment before `/` exactly with the verified namespace.
2. **Provenance**: join registry type, identifier, version, ownership and artifact digest.
3. **Pin**: store record, source, toolset and provenance digests. Never `^1.4` or latest.
4. **Live drift**: call `server/discover`. Any descriptor digest change quarantines the pin.
5. **Status**: read the official `_meta` status. Deprecated or deleted quarantines.
6. **Rollback**: route to an admitted pin that is active and not quarantined.
7. **Ledger**: append each decision with the previous hash and its own hash.

## Gateway errors
type: troubleshooting
from: phases/13-tools-and-protocols/17-mcp-gateways-and-registries/code/main.py, phases/13-tools-and-protocols/17-mcp-gateways-and-registries/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| 401 `-32001` | Bearer is not known | Authenticate the principal |
| 403 `-32003` | Tool is not in `RBAC` for the user | Grant the role or keep the deny |
| 429 `-32029` | `TokenBucket` is empty | Wait for refill |
| 409 `-32010` | Live descriptor differs from the pin | Review, then re-approve the pin |
| 400 `-32020` | Header and body disagree | Match `Mcp-Method` and `Mcp-Name` |
| 400 `-32022` | Matched version is not supported | Send a version in `supported` |
| 406 on `subscriptions/listen` | Accept has no `text/event-stream` | Accept SSE |
| 405 | GET or DELETE on the endpoint | Send each message as POST |

## Defaults and numbers
type: defaults
from: phases/13-tools-and-protocols/17-mcp-gateways-and-registries/code/main.py, phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/code/main.py, phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Gateway discover `ttlMs` | 30_000 | `cacheScope` private |
| Gateway tools/list `ttlMs` | 10_000 | Private because RBAC filters it |
| `TokenBucket` `capacity` | 5 | `refill_per_second` 1.0 |
| `maxErrorRate` | 0.01 | Health gate default |
| `maxP95Ms` | 500 | Health gate default |
| `MODERN_VERSION` | 2026-07-28 | Needs `resultType` |
| `LEGACY_VERSION` | 2025-11-25 | Only by allowlist and valid `initialize` |
| Registry schema | 2025-12-11 | Independent of the protocol version |

## Release failures
type: troubleshooting
from: phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/docs/en.md, phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Client goes legacy after `-32021` | Recognized modern error read as legacy | Never fall back after a modern error |
| SDK shows `resultType` the wire lacked | SDK synthesizes the discriminator | Validate the raw body |
| Origin 400 arrives as 500 | Proxy collapses the error | Compare ingress, origin and egress |
| Canary has zero errors and no traffic | No minimum sample count | Enforce `sampleCount` above 0 |
| New tool appears after approval | Runtime drift | Quarantine the route |
| Rollback target was never admitted | Route and approval state disconnected | Refuse, run a new admission |

## Rules
type: tips
from: phases/13-tools-and-protocols/17-mcp-gateways-and-registries/docs/en.md, phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/docs/en.md, phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/docs/en.md

- Never pass the outer gateway token to a backend.
- Do not copy outer client capabilities to a backend. The gateway is its client.
- Key rate limits by principal, issuer, resource, tool, cost class and window.
- Preserve `requestState` byte for byte. Re-authorize every MRTR retry.
- Route `tasks/get`, `tasks/update`, `tasks/cancel` by `params.taskId` in `Mcp-Name`.
- Run admission before a server appears in `tools/list`.
- Redact before serialization, hashing, logs or upload.

## Questions
type: qa
from: phases/13-tools-and-protocols/17-mcp-gateways-and-registries/docs/en.md, phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/docs/en.md, phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/docs/en.md, phases/13-tools-and-protocols/23-capstone-tool-ecosystem/docs/en.md

- **Does registry presence approve a server?** No. Admission policy decides.
- **Can `serverInfo` prove the publisher?** No. It is diagnostic data only.
- **Is an unknown field an unknown result?** No. Keep the field. Reject an unknown `resultType`.
- **Does rollback edit the old record?** No. It changes the active route.
- **Does a green capstone run prove the wire?** No. It validates the simulation only.
