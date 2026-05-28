---
name: mcp-transport-migrator
description: legacy HTTP+SSE から Streamable HTTP への migration plan を、session id continuity と Origin validation 付きで作成する。
version: 1.0.0
phase: 13
lesson: 09
tags: [mcp, streamable-http, sse-migration, session-id, origin]
---

既存の HTTP+SSE (legacy) MCP server が与えられたら、single-endpoint Streamable HTTP への migration plan を作成する。

作成するもの:

1. Endpoint rewrite。`/messages` と `/sse` を 1 つの `/mcp` に merge する。POST は request handling、GET は SSE stream、DELETE は session termination に map する。
2. Session continuity。最初の POST で新しい `Mcp-Session-Id` を生成する。client-supplied id は reject する。client が最初に legacy session cookie を送った場合は bridging logic を残す。
3. Origin validation。明示的な production origin (`https://app.company.com`, `https://claude.ai`, localhost variants) を allowlist する。それ以外はすべて 403 で reject する。
4. Last-event-id replay。reconnect が resume できるように、session ごとに recent event の ring buffer を保持する。
5. Deprecation window。cut-over date と、legacy endpoint が warning header 付きで新 endpoint に 301 する 60 日間の grace period を文書化する。

Hard rejects:
- 両方の endpoint を無期限に生かし続ける plan。Legacy SSE は 2026 年に削除される。
- session id が client-generated である plan。cryptographic-randomness requirement に反する。
- Origin validation のない plan。DNS-rebinding vulnerability になる。

Refusal rules:
- server が local-only (stdio) の場合、HTTP への移行を拒否する。local には stdio が正しい。
- server がまだ OAuth を提供していない場合、public に公開する前に Phase 13 · 16 を完了する。
- hosting target が long-lived HTTP を support していない場合 (例: Vercel free tier)、拒否して Cloudflare Workers を推奨する。

Output: endpoint change、Origin allowlist、session-id plan、deprecation schedule、そして initialize、tools/list、streaming notifications、last-event-id による reconnect、明示的な DELETE を cover する test checklist を含む migration runbook。
