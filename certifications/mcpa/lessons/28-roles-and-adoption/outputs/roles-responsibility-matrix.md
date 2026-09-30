# Roles and Responsibility Matrix

A one-page reference for the MCPA "Use Cases and Ecosystem" domain, aligned to MCP 2026-07-28.

## The six roles

| Role | Owns |
|------|------|
| Server author | The implementation: tools, schemas, server/discover, statelessness |
| Host and client developer | The application and its client: capability declarations, the OAuth client, the consent surface |
| Platform or gateway operator | The running process: stdio environment, connection termination, network policy, header checks at the edge |
| Security and governance owner | Cross-cutting requirements no single implementer owns: token handling, requestState protection, consent policy |
| Registry publisher | server.json, namespace verification, what a registry serves about the server |
| End user | Consent; the accountable party for what the host does on their behalf |

## Three adoption paths

| Path | What changes |
|------|---------------|
| Local stdio | No OAuth client to build; the operator supplies credentials from the environment before the process starts |
| Remote Streamable HTTP with OAuth | The server author implements Protected Resource Metadata and Origin validation directly; the host and client developer implements the OAuth client and Resource Indicators |
| Gateway-fronted enterprise with extensions | Origin validation and header checks move to the platform or gateway operator; the security and governance owner sets the policy the gateway enforces; extension support becomes an organizational allow list |

## Worked example: Origin validation

The Streamable HTTP transport states that servers MUST validate the Origin header on all incoming connections to prevent DNS rebinding attacks. Plain HTTP: the server author owns it, because the server's own code is the first thing a request reaches. Gateway-fronted: the platform or gateway operator owns it, because the gateway terminates the connection first. The requirement never moved in the specification. The owner moved with the deployment shape.

## Governance in one page

- Stewardship: a project of the Agentic AI Foundation.
- Hierarchy: Lead Maintainers (final veto) over Core Maintainers (spec and project direction) over Maintainers (one area each) over Contributors, with sustained Contributors becoming Members first.
- Working Group: builds a concrete deliverable, usually a SEP plus a reference implementation.
- Interest Group: discusses a problem and produces non-binding recommendations, not a design.
- SEP status path: draft, in-review, then accepted or rejected, and final once the reference implementation, and any required conformance test, both land.
- Feature lifecycle: Active, then optionally Deprecated (migration path required, minimum twelve month window), then eventually Removed.

## SDK tiers as an adoption decision

| Tier | Conformance | New features | Critical bugs |
|------|-------------|---------------|-----------------|
| Tier 1 | 100 percent | before or with a spec release | fixed within 7 days |
| Tier 2 | 80 percent | within 6 months | fixed within 2 weeks |
| Tier 3 | no minimum | no timeline commitment | no requirement |

## Remember for the exam

- Host, client, and server describe wire topology. The six roles above describe who is accountable for a requirement in a real deployment; the two lists answer different questions.
- The same MUST can have a different owner depending on the deployment shape; a gateway absorbs responsibilities it did not have to carry before.
- A MUST with no owner in your team's matrix is a gap to close, not a detail to skip.

Source: certifications/mcpa/research/mcp-2026-07-28-brief.md; MCP community documentation (governance, working-interest-groups, sep-guidelines, sdk-tiers).
