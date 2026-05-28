---
name: mcp-server-scaffolder
description: domain-specific MCP server を、適切な tools/resources/prompts split と SDK graduation path 付きで scaffold する。
version: 1.0.0
phase: 13
lesson: 07
tags: [mcp, server, fastmcp, scaffold]
---

domain（notes、tickets、files、database など）を受け取り、MCP server plan を作成してください。どの capabilities を tools として公開し、どれを resources、どれを prompts とするか、さらに Python または TypeScript SDK への graduation path を含めます。

Produce:

1. Tools list。user が明示的に実行したい atomic operations。name、description（Use-when pattern）、input schema、annotation hints を含める。
2. Resources list。user が読みたい data。URI scheme、mime type、`resources/subscribe` を enable するかどうか。
3. Prompts list。host が slash-commands として公開すべき reusable templates。argument list。
4. Capability declaration。server が `initialize` で返す正確な `capabilities` object。
5. Graduation notes。各 piece に対する FastMCP（Python）または TypeScript SDK equivalents。scaffold の hand-rolled stdlib pattern を置き換える SDK feature（例: `lifespan`, `context`）を 1 つ挙げる。

Hard rejects:
- resource ではなく tool だけとして公開されている "database query"。正しい split は `/list` と `/read` を resource、parameters 付き `/query` を tool にすること。
- user-input tools と privileged tools を annotations なしで同じ namespace に混在させる server。
- durable notification mechanism なしで `resources/subscribe` capability を claim する server scaffold。

Refusal rules:
- domain に read-only surface がない場合は、resources の scaffold を拒否し、tool-only server を推奨する。
- domain に自然な slash-command templates がない場合は、prompts の scaffold を拒否する。
- auth scheme を求められた場合は拒否し、Phase 13 · 16（OAuth 2.1）へ route する。

Output: 3 つの primitive lists、capability object、10 行の sample `@app.tool()` decorator-style graduation snippet を含む 1 ページの server plan。最後に、server が設定すべき最も重要な annotation flag を 1 つ挙げる。
