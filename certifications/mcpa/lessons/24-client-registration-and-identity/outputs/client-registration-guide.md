# Client Registration Guide

A one-page reference for the MCPA "Security and Governance" domain, aligned to MCP 2026-07-28.

## Registration priority order

1. Pre-registered credentials already on file for this authorization server.
2. A Client ID Metadata Document (CIMD), if the authorization server advertises `client_id_metadata_document_supported`.
3. Dynamic Client Registration (DCR), deprecated, only if a `registration_endpoint` exists and CIMD is unavailable.
4. Ask the person using the client to enter client information by hand.

## What an authorization server checks in a CIMD

| Check | Requirement |
|-------|-------------|
| Scheme and path | client_id is an https URL with a real path component |
| Exact match | The document's own client_id field equals the fetched URL exactly |
| Required fields | client_id, client_name, and redirect_uris are all present |
| Redirect URIs | Each one is https, or http on localhost, and matches the authorization request |
| Fetch safety | Guard against SSRF, cache respecting HTTP cache headers, warn extra hard on localhost-only redirects |

## DCR application_type

- `native`: desktop apps, mobile apps, CLI tools, and locally hosted apps reached through localhost.
- `web`: remote, browser-based applications.
- Omitting it defaults to `web` under OIDC, which can reject a localhost redirect URI.

## Authorization server binding

- Key persisted credentials by the issuer that issued them.
- Detect an authorization server change through updated protected resource metadata.
- Never reuse credentials from one authorization server against another; re-register instead.
- CIMD ids are portable across authorization servers; DCR ids are not.

## Confused deputy

A proxy that forwards many downstream, dynamically registered clients to a third-party authorization server through one static client id must get the user's consent for each downstream client individually before it forwards that client's request.

## Authorization extensions

| Extension | Fits | How it works |
|-----------|------|---------------|
| OAuth Client Credentials | CI pipelines, daemons, background services, no interactive user | Client authenticates with a JWT bearer assertion (recommended) or a client secret |
| Enterprise-Managed Authorization | Employees behind a corporate identity provider | Client exchanges an SSO identity assertion for an ID-JAG, then the ID-JAG for an MCP access token |

Both extensions are opt-in, declared in `clientCapabilities.extensions`, and never active by default.

## Remember for the exam

- Dynamic Client Registration is deprecated; Client ID Metadata Documents are the preferred path after pre-registration.
- A CIMD's client_id must equal the URL it was fetched from exactly, or the authorization server must reject it.
- Credentials are keyed by issuer, never shared across authorization servers.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 12.
