# Risk and Safety Controls for MCP Tool Calls

> A tool description is not documentation the model happens to see. It is a string the model reads as instructions, which makes it the cheapest place to attack a system that otherwise looks fully locked down.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 25
**Time:** ~45 minutes

## Learning Objectives

- Name the attack surfaces a correctly authorized, stateless 2026-07-28 deployment still exposes: metadata poisoning, rug pulls, tool shadowing, confused deputy, token passthrough, requestState tampering, SSRF, DNS rebinding, malicious icons, and supply chain drift
- Pin a tool definition by hash and detect the moment a later descriptor changes underneath an earlier approval
- Treat a tool's description, annotations, and results as untrusted input the model reads as instructions, not as documentation a human already vetted
- Block token passthrough so a credential scoped to the MCP server never reaches an unrelated upstream API
- Choose an isError tool execution result over an invented protocol error code when a policy, not a malformed request, is the reason a call was refused

## The Problem

A support gateway aggregates a dozen MCP servers so one assistant can search tickets, read internal documentation, and push resolved cases into a billing system. Every one of those servers is, from the model's point of view, just text: a name, a description, a schema, and whatever content a tool call happens to return. The protocol does not ask whether that text is honest. It asks whether a message is well formed, and a message can be perfectly well formed while lying about what a tool does.

Lesson 22 drew the trust boundaries and lesson 25 built the consent gate that asks a human before a destructive call runs. Neither one finishes the job by itself. Consent gates the call a human actually sees; it does nothing about the description the model already read to decide which call to make, or the routine, non-destructive calls nobody reviews one at a time. A gateway needs controls that hold even when no human is watching, and that catch a problem before it ever reaches a confirmation dialog.

## The Concept

Security and Governance builds in layers. Lesson 22 named the trust zones. Lesson 23 and lesson 24 covered how a client proves who it is. Lesson 25 built the moment a human approves one specific call. This lesson is the layer underneath all of that: what a server or a gateway does automatically, for the calls nobody reviews one at a time, and for the moment before any human sees anything, when a tool description is already sitting in the model's context.

Treat a tool's name, description, annotations, icons, and results as untrusted input to the model, the same way lesson 22 treats every other piece of server-supplied content. A description can embed an instruction that has nothing to do with what the tool actually does: language telling the model to also call a different tool, to forward its output somewhere else, or to not mention a step to the user. The model reads natural language as natural language; it cannot tell a genuine usage note from an attack by tone alone, so the defense cannot be reading more carefully. The same risk applies to what a tool returns. A successful, well formed CallToolResult is exactly as trustworthy as the server that produced it, so a compromised or malicious server can plant an instruction inside a normal result's text content just as easily as inside its own description. A static scanner that flags phrases such as an instruction to ignore prior guidance, or a request to keep a step secret from the user, is cheap enough to run at registration and on every change. It is a tripwire, not a proof of safety: a scanner can miss an attack phrased carefully enough, and it can flag a legitimate warning that happens to share a phrase. Treat a hit as something a reviewer looks at, not an automatic verdict either way.

A tool that passed review yesterday is not the same tool forever. A rug pull is a change to a previously approved name, description, schema, or annotation, and the danger is that the name usually stays the same, so nothing about a later call looks different. Pinning only the description text misses a schema or annotation change that alters what a tool can do just as much as new wording would, so pin the whole descriptor instead: canonicalize it and hash it.

```python
payload = json.dumps(
    {"name": name, "description": description, "inputSchema": input_schema},
    sort_keys=True, separators=(",", ":"),
)
digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
```

Store the digest against the tool's qualified name. On every refresh, an unknown key waits for review, a duplicate unqualified name needs a namespace, and a known key whose digest changed is a rug pull: quarantine the tool, hold it for re-review, and only fold the new digest in once someone has actually looked at it. Hash equality proves stability, not safety. A poisoned descriptor stays poisoned even when it is perfectly pinned, which is why pinning is a change detector layered on top of the description scan, never a replacement for it.

Two servers can each expose a tool literally named search without either one knowing the other exists. A gateway that aggregates both and lets discovery order silently pick a winner has created tool shadowing: a call meant for one server's search can route to the other's, and nothing in the request shows the mistake. Lesson 06 already prefixes aggregated names with a server identifier for exactly this reason, and lesson 09's manifest review treats an unqualified, collision-prone name as a finding worth flagging on its own. The qualified name, not the description or the server's self-reported serverInfo, is what approval, audit, hash pins, and routing should all refer to.

An MCP server that calls a third-party API on a client's behalf is an OAuth client itself, and that makes it a deputy: something acting with authority delegated from someone else. A confused deputy attack tricks that deputy into using its authority on the attacker's behalf, most often through a static client id and a browser that still carries a consent cookie from an earlier, legitimate flow. The everyday version of the same mistake is simpler and more common: token passthrough, where a handler takes the bearer token a client used to authenticate to the MCP server itself and forwards that same token to an unrelated upstream API.

```json
{
  "http": {"headers": {"Authorization": "Bearer client-bearer-9f2c"}},
  "message": {
    "jsonrpc": "2.0", "id": 5, "method": "tools/call",
    "params": {
      "name": "sync_upstream_ticket",
      "arguments": {"ticket_id": "T-88", "upstream_credential": "client-bearer-9f2c"}
    }
  }
}
```

The value in `arguments.upstream_credential` is the same string as the inbound bearer token, and a handler that forwards it has handed the upstream API a credential that was only ever validated for the MCP server's own audience. The fix is not cleverer parsing; it is refusing to forward and minting a separate, upstream-scoped credential instead, exactly as the authorization security considerations require: a server must validate that a token was issued for its own audience and must never pass through the token it received from its client on an upstream call.

Lesson 14 covers Multi Round-Trip Requests in depth, but its `requestState` field belongs on this lesson's threat list too, because it is attacker-controlled the moment it leaves the server. A client cannot be trusted to return it unmodified. If `requestState` ever influences an authorization decision, resource access, or business logic, sign or encrypt it, bind it to the authenticated principal, a short expiry, and a digest of the request it belongs to, and enforce single use on the server rather than hoping a client behaves.

Several MCP surfaces ask a client, a server, or an authorization server to fetch a URL somebody else supplied, and each one is a server-side request forgery opportunity if that URL is followed blindly: an authorization server fetching a Client ID Metadata Document, a client following a `resource_metadata` URL from a `WWW-Authenticate` challenge, or a validator resolving a `$ref` inside a tool's inputSchema. The rule is the same in every case: never auto-dereference a network URI by default. Fetching one, if it is ever necessary, is an explicit, opt-in action behind an allowlist that blocks private and link-local address ranges, enforces HTTPS, and applies a timeout, because a URL that looks ordinary during validation can resolve to an internal address by the time the request actually runs. DNS rebinding is that same gap applied to a local HTTP server: a hostname resolves to a safe address once, then to a loopback or internal address on the next lookup, so lesson 19's Origin validation and localhost binding exist specifically to close it. Icons carry a smaller version of the same risk in image form: accept only `https:` or `data:` URIs, require the same origin as the server that declared the icon, and treat SVG as executable content rather than as a picture, because an SVG can carry a script.

Supply chain risk shows up before any of this. A registry listing, a package version, and the endpoint that actually answers a request are three separate facts from three separate authorities, and treating a registry hit as automatic trust collapses them into one. A namespace has to be verified against its authenticated owner, not just string matched, because a prefix check alone accepts a lookalike namespace as readily as the real one. A package or remote source has to be pinned by digest, because a floating version tag can point at different bytes tomorrow than it did during review. The running server has to be re-observed after admission too, because a server that passed review can still add a tool later, which is a supply chain rug pull wearing a different name. None of these checks substitutes for the others.

A policy engine has exactly three channels available for a refusal, and reaching for the wrong one is itself a common mistake worth naming. A request that is malformed, such as naming a tool the server never registered, is a JSON-RPC protocol error: code `-32602`, the same channel lesson 02 used for an unknown tool. A refusal the model should read and possibly react to, such as a rate limit that tripped or a tool held after a rug pull, belongs in a normal result with `isError: true` and an explanation in its content, never a JSON-RPC error and never a made up code. The temptation is to reach for something like `-32001`, because the legacy `-32000` to `-32019` block looks like open space for a custom denial code. It is not: that block exists for legacy implementations only, `-32020` to `-32099` is reserved for the specification itself, and an application-defined code, if one is truly needed, belongs outside `-32768` to `-32000` entirely. Most policy refusals never need one, because `isError` already gives the model a channel it can read, explain to the user, and sometimes correct for.

None of these controls needs a human in the loop to work, which is the point. A single automatic step that reads untrusted input, touches sensitive data, and takes a consequential action all at once is the shape every threat on this list is trying to reach. Splitting that step, whether by pinning a descriptor before it can silently change, scanning a description before it reaches a model, validating a credential's audience before it leaves the server, or refusing a network reference before it is ever fetched, is what keeps one missed review from becoming an incident. A rate limit, a timeout, and running a tool handler in a sandboxed process with reduced privileges are blunter still: none of them understands what an attack looks like, and that is exactly their value, because they bound the damage even when every smarter check upstream missed something.

```figure
mcpa-26-attack-surface
```

## Interactive Lab

The figure arranges eight threats around a central gateway node: poisoned descriptions and rug pulls near the top, tool shadowing and token passthrough on the right, requestState tampering and a network `$ref` toward the bottom, DNS rebinding and supply chain drift on the left. Nothing in the diagram is exotic; every spoke is a variation on the same idea, something a server, a registry, or a client supplied that the gateway chose to verify instead of trust. The center names the three moves that answer all eight: pin a descriptor so a later change is visible, scan a description before it reaches a model, and limit what a single caller or a single tool can do even when every individual call looks legitimate on its own.

## Practice Lab

Open `code/main.py`. It builds a `RiskGateway` fronting two tools, `search_helpdesk` and `sync_upstream_ticket`, then registers a third tool whose schema references a network `$ref` and a fourth tool whose description carries an injected instruction.

```bash
python3 code/main.py
```

Read the printed transcript against the concept section. The registration line for `bulk_import` shows `accepted=False`: the network `$ref` gets it refused before the tool ever reaches the catalog. The registration line for `draft_reply_wizard` shows `accepted=True` with a reason naming the flagged phrase: a poisoned tool is still recorded, but quarantined on the spot. In the request log, the first `search_helpdesk` call succeeds, then `gateway.observe()` simulates a descriptor refresh with a changed schema, and the very next call to the same tool comes back `isError: true`, held for review as a rug pull even though the tool's name never changed. `gateway.approve()` clears the hold and repins the hash, and the following call succeeds again. Watch `sync_upstream_ticket` get called twice: once with `upstream_credential` set to the same token the client used to authenticate, refused as token passthrough, and once with a distinct, upstream-scoped credential, which succeeds. The final `search_helpdesk` calls push past its configured `rate_limit` of four, and the call that would be the fifth comes back as an execution error rather than silently queuing or crashing. Then add a phrase to `SUSPICIOUS_PHRASES`, register a new tool whose description contains it, and confirm it is quarantined the moment it is registered, before anyone ever calls it.

## Shipped Artifact

`outputs/threat-control-matrix.md` is a one-page reference mapping ten threats, the eight in the figure plus prompt injection through results and malicious icons, to the control that answers each one and where the specification or this lesson's code shows it working. Keep it next to lesson 22's trust boundary map and lesson 25's consent checklist; together they cover protocol-level trust, human review, and the automatic controls this lesson adds.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: an unknown tool is a protocol error while a rate limit trip and a held rug pull are both `isError` tool execution results, a network `$ref` is refused at registration before it ever reaches the catalog, a poisoned description is quarantined the moment it is registered, a changed descriptor is held until `approve()` repins its hash, a token passthrough attempt is blocked while a distinct upstream credential succeeds, and every request on the wire still carries its protocol version and capabilities. The repository's wire checker validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/26-risk-and-safety-controls
```

## Capstone Connection

Lesson 33 assembles one exchange that touches every domain, including a tool call, an MRTR consent round trip, and an audit chain. None of that is safe to demonstrate on an ungoverned catalog. The capstone's tool call assumes something like this lesson's gateway already pinned the descriptor it is calling, already scanned it for an injected instruction, and already knows the credential it is about to use will never be forwarded upstream unchanged. Carry the threat-control matrix into lesson 27's audit trail: a control decides what is allowed to happen, and the log that lesson builds proves what did.

## Key Terms

| Term | Meaning |
|------|---------|
| Metadata poisoning | An instruction embedded in a tool's name, description, or annotations that has nothing to do with what the tool does |
| Rug pull | A change to a previously approved tool descriptor, often while the tool's name stays the same |
| Definition pinning | Hashing a tool's whole descriptor at approval time so a later change is detectable |
| Tool shadowing | Two servers exposing the same unqualified tool name so discovery order silently picks one |
| Confused deputy | An intermediary tricked into using its own delegated authority on an attacker's behalf |
| Token passthrough | Forwarding a client's MCP-server-scoped bearer token to an unrelated upstream API |
| requestState tampering | Modifying the opaque MRTR state a client is supposed to echo back unchanged |
| SSRF | Server-side request forgery: inducing a fetch of an internal or unintended URL |
| DNS rebinding | A hostname that resolves to a safe address during validation and an internal one at request time |
| Supply chain drift | A registry listing, a package, or a running endpoint changing independently after admission |

## Further Reading

- [MCP security best practices](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices), especially Token Passthrough, Server-Side Request Forgery, and State Handle Hijacking
- [Authorization security considerations](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations)
- [Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr), Security Considerations
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 13
- `phases/13-tools-and-protocols/15-mcp-security-tool-poisoning`, for the attack surfaces this lesson builds on
- `phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift`, for admission pinning and rollback in depth
