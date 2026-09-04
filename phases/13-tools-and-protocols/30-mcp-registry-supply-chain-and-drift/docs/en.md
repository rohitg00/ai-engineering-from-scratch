# MCP Registry Supply Chain: Admission, Drift, and Rollback

> A registry entry tells you what a publisher declared. Production admission proves what you fetched, what you observed, what you approved, and what you can safely restore.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13 · 17 (gateways and registries), Phase 13 · 18 (production authentication)
**Time:** ~90 minutes

## Learning Objectives

- Separate Registry publication, package provenance, runtime discovery, and local approval.
- Verify an MCP server namespace without trusting the name inside its own record.
- Pin immutable publication, execution-source, provenance, and live descriptor evidence.
- Detect registry status changes and runtime drift after admission.
- Roll back routing to a previously admitted version without rewriting history.
- Maintain a tamper-evident admission ledger that explains every decision.

## The Problem

You find `com.example/inventory` in a registry. Its description looks right. Its package exists. The server answers `server/discover`.

That is not one fact. It is a chain of facts from different authorities:

1. A publisher authenticated for a namespace submitted a record.
2. A package registry served an artifact with a specific identity and digest.
3. A running endpoint reported a protocol version, capabilities, tools, and diagnostic server information.
4. Your organization decided that this exact combination was allowed.

Collapsing those facts into “it is in the registry, so trust it” creates a supply chain blind spot. A valid publication can still be deprecated. A package tag can point at an unexpected artifact if you do not pin its digest. A server can add a destructive tool after review. A rollback can silently choose a version that was never admitted.

The fix is an admission controller with evidence at every boundary.

## The Registry Is an Index, Not Your Approval System

The official MCP Registry stores server metadata. Its `server.json` record names a server version and declares one or more packages or remote endpoints. Publication rules add namespace authentication, package ownership checks, restricted registry rules, and a narrow publisher metadata location.

Those controls answer publication questions. Your production policy still answers deployment questions:

| Boundary | Question | Evidence owner |
|---|---|---|
| Namespace | Was the publisher allowed to use this name? | Registry authentication plus your verified namespace input |
| Record | What did the publisher declare for this version? | Immutable `server.json` digest |
| Execution source | Which package or remote endpoint will execute? | Declared source fields, verified ownership result, transport, and trusted digest |
| Runtime | What does the endpoint expose now? | `server/discover` and tool descriptors |
| Admission | Did your policy approve this exact set? | Local pin and ledger entry |
| Operations | Is it still safe, and what can replace it? | Drift checks, status sync, health, and rollback route |

The Registry schema version and the MCP protocol version are independent. A record may use the published `2025-12-11` server schema while the live server supports MCP `2026-07-28`. Never infer one from the other.

```figure
mcp-registry-admission
```

## Seven Controls in One Admission Decision

### 1. Namespace verification

Official Registry names use authenticated namespaces. A verified domain can map to a reversed domain prefix. For example, control of `example.com` can establish `com.example/*`.

Do not accept a string prefix check:

```python
server_name.startswith("com.example")
```

That also accepts `com.exampleevil/tool`. Split the name at `/`, require a non-empty slug, and compare the namespace segment exactly. More importantly, pass the verified namespace into admission from the authentication result. Do not derive trust from the untrusted record.

GitHub-backed namespaces and domain-backed namespaces use different authentication paths. Normalize either path into one admission input: the exact verified namespace string.

### 2. Provenance join

For a package record, the declaration and fetched artifact must join on explicit fields:

- package registry type
- package identifier
- package version
- verified ownership result
- downloaded artifact digest

Also validate the declared package transport. A record with only a remote endpoint is valid and must not be rejected for lacking a package. For a remote source, join the declared URL and transport type to independently verified endpoint ownership and a digest of the trusted connection or deployment evidence.

The lesson code supports both source kinds and hashes the selected source together with the Registry source, server name, Registry version, record digest, and evidence digest. The resulting provenance digest is a compact pointer to the full evidence set. It is not a substitute for retaining the evidence.

Never accept a digest supplied only by the artifact you are trying to verify. Calculate it at a trusted fetch boundary, or receive it from a package service whose verification result you validate.

### 3. Pin the decision, not only the version

Registry versions are unique publication identifiers. Published metadata is immutable. A changed record requires a new version. Semantic versioning is recommended, but the Registry does not require it and does not accept version ranges.

This means `^1.4` is not an admission pin. Neither is “latest.” A useful pin contains:

```json
{
  "server": "com.example/inventory",
  "version": "1.0.0",
  "recordDigest": "...",
  "source": {"kind": "package", "registryType": "pypi"},
  "sourceDigest": "...",
  "toolsetDigest": "...",
  "provenanceDigest": "...",
  "registryStatus": "active"
}
```

Pinning several layers lets you identify which boundary changed. A record digest change under the same Registry version is a Registry integrity failure. A source digest change under the same package coordinate or remote deployment is an execution-source integrity failure. A toolset digest change is runtime drift.

### 4. Live drift detection

Admission should observe the server that will actually receive traffic. Call `server/discover`, list or otherwise obtain the exposed tool descriptors through your trusted path, and verify:

- `2026-07-28` is in `supportedVersions`
- all locally required capabilities are present
- every tool descriptor has the required identity and schema surface
- the normalized descriptor digest matches the admitted pin on later checks

The optional result `_meta["io.modelcontextprotocol/serverInfo"]` value is self-reported display, log, and debugging context. Record it as diagnostic evidence, but never use it to establish namespace, package ownership, endpoint ownership, admission, or any other security decision. A direct `serverInfo` alias outside `_meta` is not the contract field and should not be promoted into diagnostic evidence.

Normalize only fields whose order has no meaning. The sample sorts the tool list by stable name before hashing, so a harmless list-order change does not cause drift. It does not discard descriptor fields. A new tool, changed schema, changed description, or new annotations changes the pin.

The sample treats malformed descriptors and any descriptor digest change as drift, quarantines the pin, removes its active route, and blocks that version as a rollback target. A production policy may allow an editorial change only through a new review, because descriptions influence model tool selection. “Cosmetic” metadata can alter agent behavior.

### 5. Registry status is live state

The Registry API attaches a response-level `_meta` object beside each server record. Registry-managed fields live under `_meta["io.modelcontextprotocol.registry/official"]`. Pass the response `_meta` object to admission and read `_meta["io.modelcontextprotocol.registry/official"].status`. A direct `_meta.status` value is not the official wire shape. Do not confuse response metadata with the publication record's own `_meta`. Status can be:

- `active`: returned by default and eligible for local admission
- `deprecated`: still discoverable with a warning, but no longer a safe automatic choice
- `deleted`: hidden by default while its historical record remains available through deleted or incremental views

Sync status after admission. If an active version becomes deprecated or deleted, quarantine its pin and stop routing new work to it. Keep the evidence. Deletion from the default listing is not permission to erase your audit trail.

Publisher-provided custom metadata belongs only under `_meta.io.modelcontextprotocol.registry/publisher-provided` in a publication record. Registry-managed response metadata is separate. Do not let a publisher set its own official status.

### 6. Rollback means route restoration

An immutable publication is not edited during rollback. Rollback selects a previously admitted, currently eligible pin and changes the active route.

A safe target must:

1. Have a completed admission record.
2. Still have an active Registry status under your policy.
3. Not be quarantined by runtime or security evidence.
4. Still resolve to the pinned package and live descriptor set.
5. Pass current health checks.

The sample focuses on the first three conditions. A real reconciler should re-fetch the package and re-check the live endpoint before activation.

### 7. Append an admission ledger

An admission database says what is active. A ledger explains why.

Each sample entry contains a sequence, time, event, server, version, outcome, reasons, evidence, the previous entry hash, and its own hash. Changing an older outcome breaks verification of that entry and every later link.

This is tamper-evident, not magically tamper-proof. Anchor periodic ledger heads in a separate trust domain, such as signed release metadata or write-once storage. Restrict who can append. Keep authorization tokens, package credentials, tool arguments, and private endpoint data out of evidence.

## Build It

The runnable controller is in `code/main.py`. It uses only the Python standard library.

Start with the finite demonstration:

```bash
cd phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift
python3 code/main.py
```

The demonstration performs five operations:

1. Admit `1.0.0` with matching namespace, package provenance, protocol, capabilities, and tools.
2. Admit `1.1.0` and make it active.
3. Observe an unexpected delete tool at runtime.
4. Observe the Registry status for `1.1.0` become `deprecated`.
5. Restore routing to the still-admitted `1.0.0` pin.

Expected shape:

```json
{
  "admitted": [true, true],
  "driftAllowed": false,
  "rollbackAllowed": true,
  "activeVersion": "1.0.0",
  "ledgerValid": true
}
```

Read the implementation in this order:

1. `namespace_for_domain()` and `namespace_matches()` establish exact naming authority.
2. `digest()` and `normalized_tools()` produce deterministic evidence.
3. `RegistryAdmissionController.admit()` joins publication, provenance, runtime, and policy.
4. `check_live()` compares a new observation with the pin.
5. `observe_registry_status()` quarantines versions whose Registry state changes.
6. `rollback()` activates only a previously admitted eligible target.
7. `AdmissionLedger.verify()` detects changes to recorded history.

## Use It

Put the controller between discovery and routing:

```text
Registry sync -> artifact verifier -> live discovery -> admission controller -> route table
                                               |                 |
                                               v                 v
                                          evidence store    admission ledger
```

Use separate identities for these jobs. A Registry sync worker needs read access to metadata. An artifact verifier needs package fetch access. A route reconciler needs permission to activate an approved pin. None of them needs every credential.

Make rollout state explicit. “Approved” means the evidence passed policy. “Active” means the route currently selects it. “Quarantined” means it cannot receive new work. “Superseded” means another admitted version is active. Do not encode all four meanings in one Boolean.

Run admission before exposing a server in `tools/list`. Otherwise a client can discover a tool during the gap between publication and policy evaluation.

## Interactive Lab

You will watch one boundary fail at a time.

### Lab A: namespace collision

Open a Python shell from the code directory:

```bash
cd phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/code
python3 -q
```

Then run:

```python
from main import namespace_matches
namespace_matches("com.example/inventory", "com.example")
namespace_matches("com.exampleevil/inventory", "com.example")
```

The first result is `True`; the second is `False`. Replace the exact comparison with `startswith` locally and observe why the second name crosses the boundary. Restore the exact comparison before continuing.

### Lab B: descriptor drift

```python
from main import *
times = iter(f"2026-08-21T12:00:{n:02d}+00:00" for n in range(10))
c = RegistryAdmissionController(clock=lambda: next(times))
meta = {OFFICIAL_META_KEY: {"status": "active"}}
c.admit(sample_record("1.0.0"), meta, "com.example", evidence_for("1.0.0"), sample_live("1.0.0"))
c.check_live("com.example/inventory", "1.0.0", sample_live("1.0.0", True))
```

Inspect the reasons and route state. The package and Registry record did not change. The runtime tool surface did, so the controller quarantined and deactivated the pin. This is why supply chain control must continue after installation.

### Lab C: status and rollback

Admit `1.1.0`, mark it deprecated, and try both rollback targets:

```python
c.admit(sample_record("1.1.0"), meta, "com.example", evidence_for("1.1.0"), sample_live("1.1.0"))
c.observe_registry_status("com.example/inventory", "1.1.0", "deprecated")
c.rollback("com.example/inventory", "1.1.0", "unsafe retry")
c.rollback("com.example/inventory", "1.0.0", "restore known release")
c.ledger.verify()
```

The quarantined target is rejected. The earlier active pin is accepted. The ledger remains valid.

## Practice Lab

Extend the controller with a two-person approval gate.

Requirements:

- Store approvals as signed evidence references, not mutable names in the pin.
- Require two different reviewer identities for a toolset that contains a tool with `destructiveHint: true`.
- Reject duplicate reviewer identities.
- Preserve the original admission attempt in the ledger when approval is incomplete.
- Add tests for zero, one, duplicate, and two distinct approvals.
- Do not log signatures, credentials, or full private tool arguments.

Success means a destructive tool cannot become active until both identities approved the exact record, package, and toolset digests.

## Shipped Artifact

This lesson ships `outputs/skill-mcp-registry-admission.md`. Use it as a flat, reusable runbook when reviewing a new Registry version or investigating drift. It defines the inputs, refusal rules, evidence bundle, status reconciliation, and rollback proof without depending on the sample class names.

## Verify It

Run the demonstration and the deterministic suite:

```bash
cd phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

Verification should prove:

- exact namespace boundaries reject lookalike prefixes
- only the official namespaced Registry status can make a version eligible
- unverified or mismatched package and remote evidence is rejected
- publisher metadata cannot impersonate Registry-managed metadata
- tool ordering is normalized without hiding descriptor changes
- malformed package and tool structures refuse safely
- `serverInfo` remains diagnostic and never supplies admission authority
- descriptor drift quarantines, deactivates, and blocks rollback to the pin
- status changes quarantine active pins
- rollback cannot select a quarantined or unknown version
- ledger tampering is detected

## Production Failure Modes

| Failure | Why it happens | Required response |
|---|---|---|
| Name looks valid but namespace was never authenticated | Policy trusted record text | Reject until a trusted namespace verifier supplies the exact prefix |
| Same package coordinate returns new bytes | Mutable upstream or compromised distribution | Stop activation, retain both digests, investigate the fetch boundary |
| “Latest” changes without review | Floating selection escaped the pin | Resolve only exact admitted versions and digests |
| New tool appears after approval | Runtime drift or a different deployment | Quarantine the route and capture a fresh descriptor observation |
| Deprecated version remains active | Status sync is missing or delayed | Reconcile status on a schedule and before activation |
| Deleted record disappears from default sync | Client requested only active records | Use incremental or deleted-aware reconciliation and preserve local history |
| Rollback target was never admitted | Route control and approval state are disconnected | Refuse rollback and run a new admission for the target |
| Ledger verifies locally after an attacker rewrites all entries | Hash chain has no external anchor | Publish signed ledger heads to a separate trust domain |
| Evidence contains bearer tokens or tool arguments | Logging copied whole requests | Redact at collection time and store only the minimum proof |

## Operational Rule

Publication answers “can this identity publish this name?” Admission answers “will we execute this exact artifact and expose this exact behavior?” Keep those decisions separate, pin every join, and make rollback choose evidence rather than memory.

## Further Reading

- [Official Registry server.json requirements](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/official-registry-requirements.md)
- [Official Registry OpenAPI contract](https://registry.modelcontextprotocol.io/openapi.yaml)
- [MCP 2026-07-28 server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
