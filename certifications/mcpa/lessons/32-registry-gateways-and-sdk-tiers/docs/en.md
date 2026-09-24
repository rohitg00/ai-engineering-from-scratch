# Finding, Routing To, and Trusting a Server

> A name in the registry is a claim about who published a server, not a guarantee about what it does. A gateway decides whether a request may reach that server at all. An SDK's tier says how much of the protocol its implementation actually speaks. Three separate questions, three separate answers.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 31
**Time:** ~45 minutes

## Learning Objectives

- Explain what the MCP Registry stores and what it deliberately does not store, why it only accepts publicly accessible servers, and why it is currently a preview surface
- Verify a server's reverse DNS namespace the way the registry does, through GitHub or domain based authentication, and separate that from the ownership proof a package registry checks
- Read a server.json entry's packages and remotes, and explain why its schema version is independent of the protocol version the server actually speaks at runtime
- Explain what a stateless gateway is responsible for: validating Mcp-Method and Mcp-Name against the request body, routing on that header pair, and respecting cacheScope instead of inventing its own cache authority
- Use an SDK's conformance tier as a portability and trust signal, and explain how a tier is earned and how it can be lost

## The Problem

A team decides to add a third party MCP server to an internal assistant. Three separate questions show up immediately, and they do not share an answer. Where does the team find a candidate server, and how do they know the name it publishes under actually belongs to the company it claims to be, rather than to whoever typed that name into a form first. Once the server is approved, how does every internal client reach it through one front door, with one place to enforce who may call what, without that front door becoming a second parser that has to fully understand every request body just to route it. Once the team is ready to build its own server instead of only consuming one, which SDK is safe to build on, given that the protocol itself has moved four times in two years.

Those three questions map to three different pieces of infrastructure that sit around the protocol rather than inside it: the MCP Registry, a gateway, and the SDK tiering system. It is tempting to treat them as one continuous supply chain, publish to the registry, route through the gateway, trust the SDK, but each layer proves a narrow and different thing, and the exam rewards knowing exactly where one layer's guarantee ends and the next one's begins. The registry proves who published a name. It does not scan the code behind that name for vulnerabilities, and it does not run the server to see whether it behaves. A gateway proves a request is well formed and permitted to proceed. It does not know or vouch for who originally published the backend it is routing to. An SDK's tier is a maintenance and completeness signal about one implementation. It says nothing about any particular server built with that SDK, and nothing about a specific published listing. Conflating these three is exactly the kind of scenario question the Use Cases and Ecosystem domain is built to test.

## The Concept

### The registry: metadata, not code

The MCP Registry is the official, centrally hosted metadata index for publicly accessible MCP servers, and it is explicitly a preview: its maintainers warn that breaking changes or data resets can happen before it reaches general availability. What it stores is a `server.json` document per published version: a reverse DNS name, a title and description, a version string, and either a `packages` array, a `remotes` array, or both. The registry never hosts the server itself. A `packages` entry names a `registryType` (`npm`, `pypi`, `nuget`, `cargo`, or `oci`, plus `mcpb` for a prebuilt binary release) and an `identifier` that a package registry such as npm, PyPI, or Docker Hub actually serves. A `remotes` entry names a transport, `streamable-http` or the deprecated `sse`, and a URL the server answers on directly, optionally with `variables` for multi tenant URL templates and `headers` for values the client must send. The registry can carry both at once so a host can choose whichever installation path it prefers.

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.acme/weather-mcp",
  "title": "Weather",
  "version": "1.0.0",
  "packages": [
    {"registryType": "npm", "identifier": "@acme/weather-mcp", "version": "1.0.0", "transport": {"type": "stdio"}}
  ],
  "remotes": [
    {"type": "streamable-http", "url": "https://weather.acme.example/mcp"}
  ]
}
```

Notice the `$schema` field: it names a schema revision, `2025-12-11` in this example, that describes the shape of `server.json` itself. That date has nothing to do with the MCP protocol version, `2026-07-28`, that the running server actually negotiates at the wire level once a client calls `server/discover`. A registry entry can validate against a newer or older schema revision while the server behind it speaks any protocol version it likes; the two dates are tracked and versioned completely separately, and reading them as the same fact is exactly the kind of trap a scenario question sets.

The name itself is the registry's trust mechanism. Names follow a reverse DNS format, `io.github.username/server` or `io.github.orgname/server` for GitHub authenticated publishers, or `com.example/server` for a publisher who proved they control the `example.com` domain, through a DNS TXT record or an HTTP file at a well known path. This namespace authentication is what stops an unrelated party from publishing a server named after a company they do not represent: the registry only accepts a publish under a given authority from the publisher who proved they own that authority, at publish time, every time. That check is separate from the ownership check a package registry performs on the underlying artifact: npm looks for an `mcpName` field in `package.json`, PyPI, NuGet, and Cargo look for an `mcp-name: name` string in the rendered README (Cargo needs it as visible text, since crates.io strips HTML comments that PyPI and NuGet preserve), and Docker or OCI images look for an `io.modelcontextprotocol.server.name` label. Two separate proofs, one for the name in the registry and one for the artifact the name points at, both have to agree with `server.json` before a listing is trustworthy.

Versioning has its own narrow rules worth knowing cold. A version string must be unique per publish and is immutable once published; semantic versioning is recommended and lets the registry mark a listing "latest" automatically, but strings that look like a version range rather than one exact version, `^1.2.3`, `~1.2.3`, `>=1.2.3`, or `1.x`, are prohibited outright, because the registry has no way to resolve a range to one artifact. The registry is also deliberately narrow about what it will list at all: it accepts only publicly accessible servers, meaning the package is on a public package registry or the remote URL answers to the public internet. A server reachable only inside a private network or a private package feed cannot be published here; a team that needs that runs its own registry implementing the same published OpenAPI interface. Security scanning is delegated outward, to the underlying package registries and to downstream aggregators, and the registry's own moderation is deliberately permissive: it removes illegal content, malware, spam, and non functioning servers, but explicitly does not remove a server merely for being low quality, buggy, vulnerable, or a duplicate of something else. A host application is not meant to query the official registry directly at all; it is meant to consume a downstream aggregator or marketplace, which polls the registry's read only REST API on an infrequent schedule, keeps its own copy, and may add curation, ratings, or a security scan of its own on top.

### Gateways: routing on the wire, not on trust

A gateway sits in front of one or more backend MCP servers and presents one MCP endpoint to every client behind it. Because the stateless core removed sessions, a gateway does not need to pin a client to one backend replica the way a session aware design once did; any healthy instance can answer any self contained request, the same guarantee that let lesson 04's replicas trade requests freely. What the gateway does need is a fast way to decide where a request goes and whether it is allowed to go there at all, and this is exactly what the Streamable HTTP header mirror from lesson 19 is for. Every POST carries `MCP-Protocol-Version`, `Mcp-Method`, and, for `tools/call`, `resources/read`, and `prompts/get`, `Mcp-Name`. A gateway reads those headers to pick a route and apply policy without first deserializing and fully understanding the JSON-RPC body on its fast path.

Headers are a routing shortcut, never a second source of truth. Before a gateway (or the backend behind it) treats a request as valid, it has to confirm the header values agree with the corresponding body fields, `Mcp-Method` against `method`, `Mcp-Name` against `params.name` or `params.uri`, `MCP-Protocol-Version` against `params._meta["io.modelcontextprotocol/protocolVersion"]`. A mismatch is rejected as `HeaderMismatch`, code `-32020`, HTTP `400`, before any backend lookup happens at all. Skipping that check is not a small shortcut: a gateway that routed on the header alone and executed on the body could be tricked into logging and rate limiting one tool while a completely different, more sensitive tool actually ran.

```http
POST /mcp HTTP/1.1
MCP-Protocol-Version: 2026-07-28
Mcp-Method: prompts/get
Mcp-Name: lookup_account

{"jsonrpc": "2.0", "id": 7, "method": "tools/call", "params": {"name": "lookup_account", "arguments": {"accountId": "acct-1"}, "_meta": {"io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {}}}}
```

```json
{"jsonrpc": "2.0", "id": 7, "error": {"code": -32020, "message": "Header mismatch: Mcp-Method", "data": {"headers": ["Mcp-Method"]}}}
```

A gateway's other responsibilities all follow from the same discipline of adding policy without adding authority the protocol never granted it. It enforces which principal may reach which backend and tool, and it never re-emits a legacy `-32000` through `-32019` code or invents a new one inside the `-32020` through `-32099` reserved band on top of what the specification already defines. When it forwards a cacheable result, `server/discover`, `tools/list`, `prompts/list`, `resources/list`, `resources/templates/list`, or `resources/read`, it passes `ttlMs` and `cacheScope` through unchanged rather than stripping them, because the calling client depends on those hints. The exam favorite detail sits inside `cacheScope` itself: a `"private"` result must never be served across two different callers even when the request otherwise looks identical, while a `"public"` result may be shared freely. A gateway's own cache is an optimization layered on top of the origin server's hint, never a new authority that can promote a private result to shared just because that would be convenient, and it partitions every private cache entry by the authenticated caller, never by the request shape alone. Finally, a gateway is not the place to terminate one caller's token and mint or reuse a different one when calling upstream; token passthrough is forbidden for the same reason it is forbidden anywhere else in the protocol, covered fully in lesson 23, and a gateway that logs or partitions cache entries by the caller's identity still must not place that identity inside the JSON-RPC message it forwards to the backend.

### SDK tiers: a portability signal, not a scan

Every server or client in this curriculum is written against some SDK, and the SDK Tiering System is how the ecosystem measures whether a given SDK build is safe to build long lived infrastructure on. Tier 1 requires a 100 percent pass rate on the automated conformance test suite, shipping new protocol features before or alongside the next spec release, triaging issues (confirming and labeling them, not necessarily fixing them) within two business days, fixing a critical severity bug within seven days, at least one stable, non prerelease version with a documented breaking change policy, comprehensive documentation, a published dependency update policy, and a published roadmap. Tier 2 asks for 80 percent conformance, new features within six months, triage within a month, critical bug fixes within two weeks, one stable release, basic documentation, and either a plan toward Tier 1 or a stated reason for staying at Tier 2. Tier 3 has no minimum on any of it: experimental, partially implemented, or narrowly specialized SDKs live here with no timeline commitment at all. Extensions such as Tasks or MCP Apps are never required for any tier; an SDK can be a fully conformant Tier 1 implementation of the core protocol while simply not implementing a given extension, since extensions are opt in by design.

A tier is not a one time certificate. Conformance is measured continuously against the current stable release, and an SDK that fails any conformance test continuously for four weeks drops from Tier 1 to Tier 2, while one that fails more than 20 percent of tests for four weeks drops from Tier 2 to Tier 3; unresolved issues sitting for two months can trigger relegation as well. Advancing a tier runs the opposite direction: the maintainers self assess against the published requirements, open an issue with supporting evidence, pass the automated conformance suite, and get sign off from the SDK Working Group. This is the connective tissue back to the N plus M portability argument from lesson 02. The wire format claiming compliance is not the same thing as an SDK actually implementing every required behavior correctly; a Tier 2 or Tier 3 SDK might silently mishandle `_meta`, skip a required header, or misbehave on an MRTR retry from lesson 14. Portability across clients is not a fixed table memorized in advance. It is the combination of two things checked at run time and at build time: the per-request capability declaration a client makes on `server/discover` from lesson 07, and the tier of the SDK actually sitting behind whichever client or server you are relying on.

```figure
mcpa-32-registry-flow
```

## Interactive Lab

The figure traces one server from publication to a live call. On the left, a publisher who has proven ownership of a namespace submits a `server.json`, and the registry admits it only after the namespace check and the public-only check both pass; an aggregator polls the registry on its own schedule and republishes toward host applications, never the other way around. On the right, a client's request to a gateway carries `Mcp-Method` and `Mcp-Name` alongside the body; the gateway's header-versus-body check branches two ways, a match proceeds to the correct backend, and a mismatch turns into `-32020` before any backend is touched. Underneath, three tier badges show the same conformance percentage this lesson's code encodes as data. Follow one name from the left edge to the right edge and notice that nothing about being correctly registered gives a request special treatment at the gateway. Those are two separate gates.

## Practice Lab

Open `code/main.py`. `admit_to_registry` models the registry's own admission check as a small pure function: it splits a claimed name into an authority and a slug with `split_namespace`, rejects a namespace the calling publisher never verified, rejects a `visibility` of `"private"`, and rejects a version string that `looks_like_version_range` flags. Run it once for a publisher against their own verified namespace and once for a different publisher against the same claimed name, and compare the `reason` string each time. `resolve_install_target` reads a `packages` or `remotes` entry the way a host deciding how to install a server would. `schema_version_from_url` pulls the schema date out of a `$schema` URL so you can see it sitting next to, and independent of, `PROTOCOL_VERSION`.

The `Gateway` class is the part that speaks real MCP. `call_tool` and `read_resource` build a normal request, compute the headers a Streamable HTTP client would send with `_headers_for`, and route using `self.routes.get(headers["Mcp-Name"])`, the header value itself, not a second read of the body, which is the entire point of mirroring the name into a header in the first place. Read `_validate_headers` and confirm it checks all three fields before anything reaches a backend. Then read `call_tool_with_mismatched_method_header`: it changes only the `Mcp-Method` header after building a perfectly valid request body, and logs that one entry wrapped with `"violation"` so you can see exactly what a gateway operator would see on the wire, immediately followed by the real `-32020` response. Run the scenario and watch `accounts.read_count` after `token-alice` reads a private resource twice and `token-bob` reads the same URI once: the count is two, not three, because alice's second read was a cache hit and bob's was not, proof that the private cache never crossed between them. Compare that against `status.read_count` after the same two callers read a public resource: the count stays at one. Finally, search every entry in `gateway.log` for the literal string `"secret-token-value"` after calling `call_tool` with that token; it never appears, because the token exists only inside the gateway's own cache-partitioning logic, never inside the message it forwards.

```bash
python3 code/main.py
```

## Shipped Artifact

`outputs/registry-and-gateway-guide.md` is a one-page reference: the registry admission checklist, the packages-versus-remotes decision, the header-validation order a gateway must enforce before routing, the cacheScope rule stated as a single sentence you can quote back on the exam, and the SDK tier requirement table with its relegation thresholds.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: a publisher is admitted only under a namespace they verified, a spoofed claim against someone else's namespace is rejected, a private-visibility server is rejected from the public registry even with a verified namespace, a version string that looks like a range is prohibited, the server.json schema version and the protocol version are independent facts, `resolve_install_target` prefers a remote and falls back to a package, a gateway call reaches the backend the `Mcp-Name` header names, a header-body mismatch comes back as `-32020` and never reaches the backend, a private resource's cache never crosses two different callers while a public resource's cache is shared between them, a caller's token never appears inside the JSON-RPC message the gateway forwards, the SDK tier table answers exactly what the specification states, and the relegation rule only fires after four continuous weeks of failure. The repository's wire checker also validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/32-registry-gateways-and-sdk-tiers
```

## Capstone Connection

The capstone's end-to-end exchange assumes a server the candidate could plausibly have found and trusted before the first request is ever sent, and this lesson is where that trust gets decomposed into checkable parts instead of one vague feeling. When the capstone scenario asks you to defend why a request reached the right backend, you are pointing at the same header-versus-body check this lesson builds by hand. When it asks why a cached result was or was not reused, you are quoting the same `cacheScope` rule. And when it asks whether a given implementation can be relied on to speak the full 2026-07-28 surface, the honest answer runs through the SDK tier of whatever sits behind it, not through hope.

## Key Terms

| Term | Meaning |
|------|---------|
| MCP Registry | The official, preview-stage metadata index of publicly accessible server.json listings |
| server.json | The metadata document a registry entry stores: name, version, and packages or remotes |
| Namespace verification | Proof, via GitHub or a domain challenge, that a publisher controls the authority in a claimed name |
| Aggregator | A downstream consumer that polls the registry's REST API and republishes toward host applications |
| Subregistry | An aggregator that also implements the registry's own OpenAPI interface for host applications |
| Gateway | A single MCP endpoint in front of one or more backends that routes and enforces policy per request |
| HeaderMismatch | The `-32020` error a gateway or server returns when a mirrored header disagrees with the request body |
| cacheScope | The `public` or `private` hint on a cacheable result; private entries must never cross callers |
| SDK tier | A conformance and maintenance rating (Tier 1, 2, or 3) measured continuously against test results |
| Relegation | The rule that drops an SDK's tier after sustained conformance failure over four continuous weeks |

## Further Reading

- [The MCP Registry](https://modelcontextprotocol.io/registry/about)
- [Registry package types](https://modelcontextprotocol.io/registry/package-types)
- [Registry authentication](https://modelcontextprotocol.io/registry/authentication)
- [Registry aggregators](https://modelcontextprotocol.io/registry/registry-aggregators)
- [SDK tiering system](https://modelcontextprotocol.io/community/sdk-tiers)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 9, 10, and 15
- `phases/13-tools-and-protocols/17-mcp-gateways-and-registries`, which builds a full gateway policy engine in more depth
