# Registry and Gateway Guide

A one-page reference for the MCPA "Use Cases and Ecosystem" domain, aligned to MCP 2026-07-28. The MCP Registry is currently a preview: expect breaking changes and data resets before general availability.

## Registry admission checklist

A server.json entry is admitted only when all of these hold:

- [ ] Name is a reverse DNS pair, `io.github.username/server` (GitHub authenticated) or `com.example/server` (domain authenticated)
- [ ] The publisher has proven ownership of that exact authority (GitHub OAuth, a DNS TXT record, or an HTTP file at a well known path); a namespace never verified, or verified for someone else, is rejected
- [ ] The server is publicly accessible: a public package (npm, PyPI, NuGet, Cargo, or a public OCI registry) or a remote URL reachable on the open internet; private-network or private-feed servers are refused
- [ ] The version string is unique for this publish, immutable once published, and not a version range (`^1.2.3`, `~1.2.3`, `>=1.2.3`, `1.x`, and similar range syntaxes are prohibited)
- [ ] The underlying artifact carries its own ownership proof matching the server.json name: `mcpName` in package.json for npm, an `mcp-name: name` string in the rendered README for PyPI, NuGet, and Cargo (visible text for Cargo, since crates.io strips HTML comments), or an `io.modelcontextprotocol.server.name` label for Docker or OCI images

## Packages versus remotes

| Field | What it points at | Client picks it when |
|---|---|---|
| `packages` | A stdio-launched artifact on a package registry (npm, PyPI, NuGet, Cargo, OCI, or MCPB) | It wants to run the server locally |
| `remotes` | A `streamable-http` (or deprecated `sse`) URL the server answers directly | It wants to call a hosted server over the network |

Both can be present on one entry; the host chooses. Align the `version` at the top of server.json with the underlying package or remote API version so the two never drift apart in meaning.

## One fact worth memorizing

The `$schema` URL in server.json (for example `.../schemas/2025-12-11/server.schema.json`) is a metadata-format version. It is independent of the MCP protocol version (`2026-07-28`) the running server actually negotiates through `server/discover`. Never read one as evidence of the other.

## Gateway request checklist, in order

1. Parse `params._meta` and confirm `io.modelcontextprotocol/protocolVersion` and `io.modelcontextprotocol/clientCapabilities` are both present.
2. Compare `MCP-Protocol-Version`, `Mcp-Method`, and (for `tools/call`, `resources/read`, `prompts/get`) `Mcp-Name` against the matching body fields. Any disagreement is `HeaderMismatch`, code `-32020`, HTTP `400`, returned before step 3.
3. Route using the header value (that is the entire point of mirroring it), never a second read of the body.
4. Authorize the caller for the resolved backend and tool or resource.
5. Forward a fresh, self contained request; never place the caller's own token inside it.
6. Pass `resultType`, `ttlMs`, and `cacheScope` back to the client unchanged.

## The cacheScope rule, quotable

A `"private"` result must never be served to a different caller than the one it was fetched for. A `"public"` result may be shared across every caller. `cacheScope` is a caching hint, never an access control decision by itself.

## SDK tier requirements

| Requirement | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| Conformance pass rate | 100% | 80% | no minimum |
| New protocol features | before or at the next spec release | within 6 months | no timeline |
| Issue triage | within 2 business days | within a month | no requirement |
| Critical (P0) bug fix | within 7 days | within 2 weeks | no requirement |
| Stable release | required | at least one | not required |
| Roadmap | published | published (or a stated reason to stay Tier 2) | not required |

Extensions (Tasks, MCP Apps, Skills, and the rest) are never required for any tier.

## Relegation thresholds

- Tier 1 to Tier 2: any conformance test fails continuously for 4 weeks on the current stable release
- Tier 2 to Tier 3: more than 20% of conformance tests fail continuously for 4 weeks
- Either tier: unresolved issues sitting for 2 months can also trigger relegation
- Advancement runs the other direction: self assessment, an issue with evidence, a passing conformance run, and SDK Working Group sign off

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 9, 10, and 15.
