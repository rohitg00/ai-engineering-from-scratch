# Threat Control Matrix

A one-page reference for the MCPA "Security and Governance" domain, aligned to MCP 2026-07-28. Ten threats a correctly authorized, stateless deployment still faces, the control that answers each one, and where to look for the mechanics.

## The ten threats

| Threat | What it looks like | Control | Where to look |
|---|---|---|---|
| Metadata poisoning | A tool description or annotation embeds an instruction unrelated to what the tool does | Treat descriptions and annotations as untrusted; scan on registration and on every change | This lesson, `scan_for_injection` |
| Prompt injection through results | A successful CallToolResult carries text designed to redirect the model | Treat results as untrusted the same as descriptions; do not grant a server's output more trust than its metadata | Security best practices, tool results |
| Rug pull | A previously approved name, description, schema, or annotation changes, often with the name unchanged | Hash-pin the whole descriptor; quarantine on any change and hold for re-review, not just a name check | This lesson, `RiskGateway.observe` and `approve` |
| Tool shadowing | Two servers expose the same unqualified tool name and discovery order silently picks one | Prefix aggregated names with a stable server identifier; never resolve a collision by arrival order | Lesson 06 (hosts, clients, servers), lesson 09 (manifest review) |
| Confused deputy | A proxy server is tricked into using its own delegated authority on an attacker's behalf | Per-client consent before forwarding to a third-party authorization server; never trust a static client id alone | Authorization security considerations, Confused Deputy Problem |
| Token passthrough | A handler forwards the client's MCP-scoped bearer token to an unrelated upstream API | Validate token audience; mint a separate, upstream-scoped credential; never forward the inbound token | This lesson, `RiskGateway.call` upstream check; authorization, section 12 |
| requestState tampering | The opaque MRTR state a client must echo back is modified to alter server behavior | HMAC or AEAD integrity, principal binding, short expiry, digest of the original request, single use enforced server-side | Lesson 14 (MRTR), MRTR Security Considerations |
| SSRF (CIMD fetch, network $ref) | A server-supplied URL, such as a Client ID Metadata Document or a schema $ref, is fetched blindly | Never auto-dereference a network URI by default; opt-in fetch behind an allowlist, private-range block, HTTPS, timeout | This lesson, `find_network_ref`; security best practices, SSRF |
| DNS rebinding | A hostname resolves to a safe address during validation and an internal address at request time | Validate Origin; bind local HTTP servers to loopback rather than trusting the Host header | Lesson 19 (transports and HTTP headers), Streamable HTTP security |
| Supply chain drift | A registry listing, a package version, or a running endpoint changes independently after admission | Verify the namespace against its authenticated owner, pin by digest, re-observe the live server after admission | Lesson 30 (`phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift`) |

## The three refusal channels

| Situation | Channel | Example |
|---|---|---|
| The request itself is malformed | JSON-RPC protocol error | unknown tool: `-32602` |
| A policy, not the request shape, is why the call was refused | Normal result with `isError: true` | rate limit tripped, tool held after a rug pull, token passthrough attempt |
| A custom application code is genuinely needed | An application-defined code outside `-32768` to `-32000` | rarely needed; prefer `isError` first |

Never emit `-32000` to `-32019` (legacy range), `-32002` or `-32042` (retired), or an undefined code in `-32020` to `-32099` (reserved for the specification). A policy refusal the model should read belongs in `isError`, not a made-up protocol error code.

## Working checklist

- Pin every tool's whole descriptor (name, description, inputSchema, annotations) by hash at approval time, not just its description.
- Scan every description and every result for embedded instructions before it reaches a model; treat a hit as a review trigger, not an automatic verdict.
- Prefix aggregated tool names with a stable server identifier so no two servers can shadow each other.
- Validate every inbound token's audience; never forward it upstream unchanged; mint a separate, upstream-scoped credential.
- Treat `requestState` as attacker-controlled: sign or encrypt it, bind it to principal, expiry, and a request digest, and enforce single use server-side.
- Never auto-dereference a network URI (a CIMD fetch, a schema `$ref`, a redirect target) without an explicit allowlist and a block on private and link-local ranges.
- Validate `Origin` and bind local HTTP servers to loopback to close DNS rebinding.
- Accept only `https:` or `data:` icon URIs from the server's own origin, and treat SVG as executable.
- Verify a registry namespace against its authenticated owner, pin packages and remote sources by digest, and re-observe the live server after admission.
- Route every automatic refusal through the right channel: `-32602` for a malformed request, `isError: true` for a policy refusal, never an invented code in `-32000` to `-32099`.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 13.
