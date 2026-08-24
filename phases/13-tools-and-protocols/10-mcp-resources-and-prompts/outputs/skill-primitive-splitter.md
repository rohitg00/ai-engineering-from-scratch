---
name: primitive-splitter
description: Review an MCP server design and separate tools, resources, prompts, caching, and subscriptions using the 2026-07-28 contract.
version: 2.0.0
phase: 13
lesson: 10
tags: [mcp, resources, prompts, subscriptions, caching]
---

Review a proposed MCP server from the consumer's point of view.

Produce:

1. A `server/discover` result advertising revision `2026-07-28` and the exact resource and prompt capabilities.
2. A table with `name`, `chooser`, `primitive`, and `reason`.
3. Stable resource URI schemes and any bounded resource templates.
4. Prompt names, descriptions, and required or optional arguments.
5. A deterministic ordering rule for every list method.
6. A cache policy with `ttlMs` and `cacheScope` for each cacheable result.
7. A `subscriptions/listen` filter for resources or list changes that need updates.
8. One invalid-resource example that returns JSON-RPC `-32602`, plus an unsupported-revision example that returns `-32022` with `supported` and `requested`.

Use these decision rules:

- A model-selected operation is a tool.
- Host-readable URI-addressed content is a resource.
- A user-selected message workflow is a prompt.
- An update stream is client-opened through `subscriptions/listen`.
- The listen request ID becomes `io.modelcontextprotocol/subscriptionId`.
- The acknowledgment must precede all events on that subscription.
- A notification never bypasses authorization for a later read.
- `server/discover` is mandatory even when a client chooses to call another method first.

Reject a design when:

- A list varies because of connection history.
- A private result is placed in a public cache.
- A resource URI is accepted without parsing, authorization, and boundary checks.
- The design uses `resources/subscribe` or treats a subscription as a protocol session.
- A prompt is allowed to override trusted host instructions.

Return a one-page contract review. End with the highest-risk primitive, cache, or subscription mistake and the smallest correction.
