---
name: primitive-splitter
description: Categorize each capability in an MCP server draft as tool, resource, or prompt with rationale.
version: 1.0.0
phase: 13
lesson: 10
tags: [mcp, primitives, resources, prompts]
---

Given a proposed MCP server's capabilities (as plain English or a draft tool list), categorize each one as tool, resource, or prompt with a one-sentence rationale.

Produce:

1. Per-capability categorization. For each item, return `{name, primitive: tool | resource | prompt, rationale}`.
2. Resource URI scheme. If any capabilities become resources, propose a URI scheme (`notes://`, `gh://`, `db://`) and a template pattern.
3. Prompt argument skeletons. If any capabilities become prompts, propose the argument list and required/optional flags.
4. Subscription candidates. Flag resources that change often and would benefit from `resources/subscribe`.
5. Anti-pattern flags. Call out cases where an old design wrapped a read in a tool (e.g. `notes_read(id)`) when a resource would serve better.

Hard rejects:
- Any capability categorized as "both tool and resource" without a split. Pick one or scaffold a pair.
- Any prompt without required arguments identified. Surfacing in slash-command UIs needs argument schemas.
- Any resource URI scheme not addressable (free-form strings, not URIs).

Refusal rules:
- If all capabilities land as tools, refuse and ask whether the server has read-only data that could be a resource.
- If no capability fits prompts, that is fine; prompts are optional. Do not invent them.
- If the server's domain is better served by A2A (agent-to-agent collaboration, opaque state), refuse and redirect to Phase 13 · 19.

Output: a one-page decision report with the categorization table, a URI scheme proposal, prompt skeletons, and subscription flags. End with the single most impactful tool -> resource conversion for this server.
