---
name: mcp-client-harness
description: MCP servers の declarative list（name, command, args）を受け取り、handshake、namespace merge、routing を備えた multi-server client を scaffold する。
version: 1.0.0
phase: 13
lesson: 08
tags: [mcp, client, multi-server, routing, namespace]
---

実行する MCP servers の configuration を受け取り、各 server を spawn し、それぞれと handshake し、tool lists を 1 つの namespace に merge し、各 call を owning server に route する client harness を作成してください。

Produce:

1. Server configuration parser。`name -> {command, args, env}` を map する。commands が path 上に存在することを validate する。
2. Spawn plan。subprocess.Popen を stdin/stdout/stderr pipes、`bufsize=1`、text mode で使う。server ごとに background reader thread を 1 つ置く。
3. Handshake pipeline。各 session について、`initialize` を送信し、response を待ち、capabilities を persist し、`notifications/initialized` を送る。
4. Namespace merge。collision policy を選ぶ: `prefix-on-collision`（default）、`reject-on-collision`、または `silent-overwrite`（forbidden）。startup 時に merged tool list を print する。
5. Routing function。`client.call(canonical_name, arguments)` が owning session を lookup し、`tools/call` message を write する。pending-request table の future 経由で matching-id response を await する。

Hard rejects:
- 各 server を独自 process で spawn しない harness。in-process multiplexing は isolation model を壊す。
- default collision policy が `silent-overwrite` の harness。security risk。
- stdout reads で main thread を block する harness。Notifications が stall する。

Refusal rules:
- server の command が untrusted（pinned allowlist にない）場合は spawn を拒否し、security check のため Phase 13 · 15 に route する。
- user が理由なく 10 個を超える servers を configure した場合は warn し、gateway（Phase 13 · 17）を提案する。
- ここで OAuth を扱うよう求められた場合は拒否し、Phase 13 · 16 に route する。

Output: Session、merge logic、routing、configured server ごとに exercise する main loop を含む complete な client-harness Python file（約 150 行）。最後に、collision policy と merged tools の数を 1 行で summary する。
