# Extension Negotiation Guide

A one page reference for the MCPA "Use Cases and Ecosystem" domain, aligned to MCP 2026-07-28.

## Identifier format

`{vendor-prefix}/{extension-name}`, with a mandatory prefix (the same rule as `_meta` keys, except the prefix cannot be omitted).

| Who | Prefix | Example |
|-----|--------|---------|
| Official extensions | `io.modelcontextprotocol` | `io.modelcontextprotocol/oauth-client-credentials` |
| Third party extensions | a reversed domain the author owns | `com.example/my-extension` |
| Invalid | no prefix at all | `my-extension` (missing the mandatory slash and prefix) |

## Where each side declares support

| Side | Location | Shape |
|------|----------|-------|
| Client | `params._meta["io.modelcontextprotocol/clientCapabilities"].extensions`, on every request | map of identifier to settings object |
| Server | `server/discover` result, `capabilities.extensions` | map of identifier to settings object |

An empty settings object, `{}`, means "supported, nothing to configure." Declarations are per request; nothing carries over from an earlier call, because 2026-07-28 has no `initialize` handshake and no session to hold one in.

## Negotiation decision table

| Client declares it | Server declares it | Extension is mandatory for this call | Outcome |
|---|---|---|---|
| Yes | Yes | No (optional) | Active: the enhanced behavior runs |
| Yes | Yes | Yes | Active: the enhanced behavior runs |
| No, or malformed identifier | Yes or No | No (optional) | Falls back to core behavior |
| No, or malformed identifier | Yes or No | Yes | Rejected: `-32021 MissingRequiredClientCapability`, `data.requiredCapabilities` names it |
| Yes | No | Either | Not active: the server never implemented it, so it cannot run |

A malformed identifier, one without its mandatory prefix, never activates even if it happens to appear on both sides. Validating the identifier's shape is part of computing the active set.

## Lifecycle checklist

1. **Propose**: an Extensions Track SEP in the main `modelcontextprotocol/modelcontextprotocol` repository, using the standard SEP guidelines.
2. **Implement**: a working reference implementation in an official SDK, required before Core Maintainers will review it at all.
3. **Review**: Core Maintainers review the SEP and hold final authority over acceptance.
4. **Publish**: a pull request adds it to an extension repository, a repository under the `modelcontextprotocol` GitHub organization named with an `ext-` prefix, for example `ext-auth` or `ext-apps`.
5. **Adopt**: other clients, servers, and SDKs may implement it; none are required to.

Before a SEP exists at all, a Working Group or Interest Group may incubate an idea in an `experimental-ext-` repository, clearly marked non official; Core Maintainers can archive or remove it at their discretion.

Extensions version independently of the core protocol and of each other. A breaking change (removing or renaming a field, changing a field's type, changing what existing behavior means, or adding a new required field) must ship under a new identifier, typically an added `-v2` suffix, never under the old one.

## Official extensions today

| Extension | Identifier | SEP | One line |
|-----------|-----------|-----|----------|
| Tasks | `io.modelcontextprotocol/tasks` | SEP-2663 | Durable job handles for long running work; poll instead of blocking |
| MCP Apps | `io.modelcontextprotocol/ui` | SEP-1865 | A tool points at a sandboxed, renderable interface instead of only text |
| Skills over MCP | `io.modelcontextprotocol/skills` | SEP-2640 | Discover and read reusable workflow instructions through the resources primitive |
| OAuth Client Credentials | published from `ext-auth` | -- | Machine to machine authentication without a browser |
| Enterprise-Managed Authorization | published from `ext-auth` | -- | Centralized access control for enterprise identity providers |

Support for every one of these is opt-in per client. Check the extensions site's client support matrix before a design assumes a specific client already implements one.

## Remember for the exam

- The prefix in an extension identifier is mandatory, not a convention.
- Declarations are per request, in `_meta` and in `server/discover`, never a one time handshake.
- An optional extension falls back to core behavior; a mandatory one that never mutually activates is rejected with `-32021`, not `-32601` or `-32602`.
- A breaking change to an extension needs a new identifier; a non breaking addition does not.
- Extensions are disabled by default on both client and server; conformance to the core spec never requires implementing any of them.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 14.
