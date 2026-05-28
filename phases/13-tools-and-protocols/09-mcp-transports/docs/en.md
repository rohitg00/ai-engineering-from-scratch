# MCP Transports — stdio vs Streamable HTTP vs SSE 移行

> stdio が機能するのはローカルだけです。Streamable HTTP (2025-03-26) はリモートの標準です。古い HTTP+SSE transport は deprecated で、2026 年半ばに削除されます。間違った transport を選ぶと移行が必要になり、正しいものを選べば、session continuity と DNS-rebinding protection を備えたリモートホスト可能な MCP server が手に入ります。

**種別:** 学習
**言語:** Python (stdlib, Streamable HTTP endpoint skeleton)
**前提条件:** Phase 13 · 07, 08 (MCP server and client)
**所要時間:** ~45 分

## Learning Objectives

- deployment の形 (local vs remote、single-process vs fleet) に基づいて stdio と Streamable HTTP を選べる。
- Streamable HTTP の single-endpoint pattern を実装する: request には POST、session stream には GET。
- DNS-rebinding を防ぐために `Origin` validation と session-id semantics を強制する。
- 2026 年半ばの削除期限前に legacy HTTP+SSE server を Streamable HTTP へ移行する。

## 問題

最初の MCP remote transport (2024-11) は HTTP+SSE でした。endpoint は 2 つで、1 つは client の POST 用、もう 1 つは server-to-client stream 用の Server-Sent-Events channel です。これは動きました。ただし扱いにくくもありました。session ごとに 2 endpoint が必要で、一部の CDN の前段では cache が壊れ、さらに一部の WAF が積極的に切断する long-lived SSE connection に強く依存していました。

2025-03-26 spec はこれを Streamable HTTP に置き換えました。endpoint は 1 つで、client request には POST、session stream の確立には GET を使い、どちらも `Mcp-Session-Id` header を共有します。それ以降に構築または移行された server はすべて Streamable HTTP を使います。古い SSE mode は deprecated です。Atlassian Rovo は 2026 年 6 月 30 日に削除し、Keboola は 2026 年 4 月 1 日に削除し、残る enterprise server の多くも 2026 年末までに削除します。

そして local server では今でも stdio が重要です。Claude Desktop、VS Code、IDE 型の client はどれも stdio 経由で server を spawn します。正しい mental model は、stdio は「この machine 用」、Streamable HTTP は「network 越し用」です。交差させません。

## The Concept

### stdio

- child-process transport。Client が server を spawn し、stdin/stdout で通信する。
- 1 行に 1 つの JSON object。newline-delimited。
- session id はない。process identity が session になる。
- auth は不要。child は parent の trust boundary を継承する。
- remote server には絶対に使わない。SSH や socat で tunnel する必要があるなら、その時点で Streamable HTTP を使う。

### Streamable HTTP

single endpoint `/mcp` (または任意の path)。3 つの HTTP method を support します。

- **POST /mcp.** Client が JSON-RPC message を送る。Server は single JSON response、または 1 つ以上の response を含む SSE stream で返す (batched response や、その request に関連する notification に有用)。
- **GET /mcp.** Client が long-lived SSE channel を開く。Server はこれを server-to-client request (sampling、notifications、elicitation) に使う。
- **DELETE /mcp.** Client が明示的に session を終了する。

Session は、server が最初の response に設定し、client が以降すべての request で echo する `Mcp-Session-Id` header によって識別されます。Session id は cryptographically random (128+ bits) でなければなりません。安全のため、client が選んだ id は reject します。

### Single endpoint vs two

古い spec の two-endpoint mode は 2026 年時点でも呼び出せます。spec はこれを "legacy compatible" としています。ただし新しい server はすべて single-endpoint にすべきです。official SDK は single-endpoint を出力します。legacy mode は未移行の remote と通信するときだけ使います。

### `Origin` validation and DNS-rebinding

Browser は (現時点では) MCP client ではありませんが、攻撃者は browser に `localhost:1234/mcp` へ POST させる webpage を作れます。そこでは user の local MCP server が listen しています。Server が `Origin` を確認しなければ、browser の same-origin policy は守ってくれません。`Origin: http://evil.com` は valid cross-origin だからです。

2025-11-25 spec は、`Origin` が allowlist にない request を server が reject することを要求します。allowlist には通常、MCP client host (`https://claude.ai`, `vscode-webview://*`) と local UI 用の localhost variant を含めます。

### Session id lifecycle

1. Client は `Mcp-Session-Id` なしで最初の request を送る。
2. Server は random id を割り当て、response header に `Mcp-Session-Id` を設定する。
3. Client は以降すべての request と stream 用の `GET /mcp` で、その header を echo する。
4. Session は server によって revoke されることがある。Client は以降の request で 404 を受け取り、re-initialize しなければならない。
5. Client は clean shutdown のために session を明示的に DELETE できる。

### Keepalive and reconnect

SSE connection は切れます。Client は同じ `Mcp-Session-Id` で再度 GET して再確立します。Server は outage 中に missed した event を (妥当な window まで) queue し、client が echo する `last-event-id` header を使って replay しなければなりません。

Phase 13 · 13 では Tasks を扱います。これにより、full-session reconnect があっても long-running work を継続できます。

### Backwards compatibility probe

古い server と新しい server の両方を support したい client は、次のようにします。

1. `/mcp` に POST する。
2. response が JSON または SSE の `200 OK` なら、これは Streamable HTTP。
3. response が `Content-Type: text/event-stream` の `200 OK` で、かつ secondary endpoint を指す `Location` header があるなら、これは legacy HTTP+SSE。`Location` に従う。

### Cloudflare, ngrok, and hosting

2026 年の production remote MCP server は、Cloudflare Workers (MCP Agents SDK 付き)、Vercel Functions、または containerized Node/Python で動きます。重要なのは、hosting が SSE GET 用の long-lived HTTP connection を support していることです。Vercel の free tier は 10 秒で cap されるため不適です。Cloudflare Workers は indefinite stream を support します。

### Gateway composition

複数の MCP server を gateway (Phase 13 · 17) の背後に置く場合、gateway は session id を rewrite し、upstream を multiplex する single Streamable HTTP endpoint になります。Tool は gateway layer で merge され、client には 1 つの logical server として見えます。

### Transport failure modes

- **stdio SIGPIPE.** write 中に child process が死ぬと SIGPIPE が発生する。Server は clean に exit すべき。Client は EOF を検出し、session を dead と mark すべき。
- **HTTP 502 / 504.** Cloudflare、nginx、その他 proxy は upstream failure でこれらを返す。Streamable HTTP client は短い backoff 後に 1 回 retry すべき。
- **SSE connection drop.** TCP RST、proxy timeout、client network change によって stream が閉じる。Client は `Mcp-Session-Id` と任意の `last-event-id` で reconnect して resume する。
- **Session revocation.** Server が session id を invalidate する。Client は次の request で 404 を見る。Client は re-handshake しなければならない。
- **Clock skew.** Client 側の Resource-TTL calculation が server とずれる。Client は server timestamp を authoritative として扱うべき。

### When to bypass Streamable HTTP

一部の enterprise は、自社 network 内で gRPC や message-queue transport の背後に MCP server を deploy します。これは non-standard です。MCP spec はこれらを formal には定義していません。Gateway は内部で gRPC を使いながら、MCP client に対して Streamable HTTP surface を公開できます。外部 surface は spec-compliant に保ち、translation は gateway が担います。

## Use It

`code/main.py` は `http.server` (stdlib) を使って minimal な Streamable HTTP endpoint を実装します。`/mcp` の POST、GET、DELETE を処理し、最初の response に `Mcp-Session-Id` を設定し、`Origin` を validate し、allowlist にない origin からの request を reject します。Handler は Lesson 07 notes server の dispatch logic を再利用します。

見るべき点:

- POST handler は JSON-RPC body を読み、dispatch し、JSON response を書く (single-response variant。SSE variant も構造は似ている)。
- `Origin` check は default の `http://evil.example` probe を reject し、`http://localhost` は accept する。
- Session id は random な 128-bit hex string。Server は per-session state を memory に保持する。

## Ship It

このレッスンは `outputs/skill-mcp-transport-migrator.md` を作ります。HTTP+SSE (legacy) MCP server が与えられると、この skill は session-id continuity、Origin check、backwards-compatible probe support を備えた Streamable HTTP への migration plan を作成します。

## Exercises

1. `code/main.py` を実行する。`curl` から `initialize` を POST し、`Mcp-Session-Id` response header を観察する。header を echo する 2 回目の request を POST し、session continuity を確認する。

2. SSE stream を開く GET handler を追加する。5 秒ごとに `notifications/progress` event を 1 つ送る。同じ session id で再度 GET して reconnect し、server が accept することを確認する。

3. `last-event-id` replay logic を実装する。reconnect 時に、その id 以降に生成された event を replay する。

4. wildcard pattern (`https://*.example.com`) を support するように `Origin` validation を拡張し、`https://app.example.com` は accept し、`https://evil.example.com.attacker.net` は reject することを確認する。

5. official registry にある legacy HTTP+SSE server (複数ある) を 1 つ取り上げ、migration を sketch する。endpoint handling、session id generation、header semantics がどう変わるかを書く。

## Key Terms

| Term | よく言われること | 実際の意味 |
|------|----------------|------------------------|
| stdio transport | "Local child process" | stdin/stdout 上の JSON-RPC、newline-delimited |
| Streamable HTTP | "The remote transport" | Single-endpoint POST + GET + optional SSE、2025-03-26 spec |
| HTTP+SSE | "Legacy" | 2026 年半ばに削除される two-endpoint model |
| `Mcp-Session-Id` | "Session header" | Server が割り当て、以降すべての request で echo される random id |
| `Origin` allowlist | "DNS-rebinding defense" | approve されていない Origin の request を reject する |
| Single endpoint | "One URL" | `/mcp` がすべての session operation の POST / GET / DELETE を処理する |
| `last-event-id` | "SSE replay" | event を取りこぼさず dropped stream を resume するための header |
| Backwards-compat probe | "Old vs new detection" | transport を自動選択する client response-shape check |
| Long-lived HTTP | "SSE streaming" | Server が 1 つの TCP connection で数分から数時間 event を push する |
| Session revocation | "Force re-init" | Server が session id を invalidate し、client は再 handshake する必要がある |

## 参考文献

- [MCP — Basic transports spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) — stdio と Streamable HTTP の canonical reference
- [MCP — Basic transports spec 2025-03-26](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) — Streamable HTTP を導入した revision
- [Cloudflare — MCP transport](https://developers.cloudflare.com/agents/model-context-protocol/transport/) — Workers-hosted Streamable HTTP pattern
- [AWS — MCP transport mechanisms](https://builder.aws.com/content/35A0IphCeLvYzly9Sw40G1dVNzc/mcp-transport-mechanisms-stdio-vs-streamable-http) — deployment shape ごとの比較
- [Atlassian — HTTP+SSE deprecation notice](https://community.atlassian.com/forums/Atlassian-Remote-MCP-Server/HTTP-SSE-Deprecation-Notice/ba-p/3205484) — 具体的な migration deadline example
