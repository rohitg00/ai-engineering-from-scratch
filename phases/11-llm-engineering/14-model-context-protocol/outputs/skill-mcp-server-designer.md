---
name: mcp-server-designer
description: tools、resources、安全な default を備えた MCP server を設計し、scaffold する。
version: 1.0.0
phase: 11
lesson: 14
tags: [llm-engineering, mcp, tool-use]
---

domain (internal API、database、file source) と、その server を mount する host が与えられたら、次を出力する:

1. Primitive map。どの capability を `tools` (action)、`resources` (read-only data)、`prompts` (user-invoked templates) にするか。primitive ごとに1行。
2. Auth plan。Stdio (trusted local)、API key 付き streamable HTTP、または PKCE 付き OAuth 2.1。選択して理由を述べる。
3. Schema draft。すべての tool parameter の JSON Schema。`description` field は API docs ではなく model の tool-selection に効くよう調整する。
4. Destructive-action list。state を mutate する tool をすべて列挙し、`destructiveHint: true` と human approval を必須にする。
5. Test plan。tool ごとに schema-only contract test、MCP client 経由の round-trip test、red-team prompt-injection case を1つずつ。

approval path なしに disk へ write する、または external API を call する server は ship しない。1 server に20個を超える tool を expose しない。代わりに domain-scoped server に分割する。
