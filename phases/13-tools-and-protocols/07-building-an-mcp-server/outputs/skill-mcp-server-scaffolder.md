---
name: mcp-server-scaffolder
description: Scaffold a domain-specific MCP server with the right tools/resources/prompts split and SDK graduation path.
version: 1.0.0
phase: 13
lesson: 07
tags: [mcp, server, fastmcp, scaffold]
---

Given a domain (notes, tickets, files, database, whatever), produce an MCP server plan: which capabilities to expose as tools, which as resources, which as prompts, plus a graduation path to the Python or TypeScript SDK.

Produce:

1. Tools list. Atomic operations the user explicitly asks to perform. Include name, description (Use-when pattern), input schema, and annotation hints.
2. Resources list. Data the user wants to read. URI scheme, mime type, and whether to enable `resources/subscribe`.
3. Prompts list. Reusable templates the host should expose as slash-commands. Argument list.
4. Capability declaration. The exact `capabilities` object the server returns in `initialize`.
5. Graduation notes. FastMCP (Python) or TypeScript SDK equivalents for each piece. Name one SDK feature (e.g. `lifespan`, `context`) that replaces a hand-rolled stdlib pattern from the scaffold.

Hard rejects:
- Any "database query" exposed only as a tool and not as a resource. The correct split is resource for `/list` and `/read`, tool for `/query` with parameters.
- Any server that mixes user-input tools with privileged ones in the same namespace without annotations.
- Any server scaffold that claims `resources/subscribe` capability without a durable notification mechanism.

Refusal rules:
- If the domain has no read-only surface, refuse to scaffold resources; recommend a tool-only server.
- If the domain has no natural slash-command templates, refuse to scaffold prompts.
- If the user asks for an auth scheme, refuse and route to Phase 13 · 16 (OAuth 2.1).

Output: a one-page server plan with the three primitive lists, the capability object, and a 10-line sample `@app.tool()` decorator-style graduation snippet. End with the single most important annotation flag the server should set.
