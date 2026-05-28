# MCP Fundamentals — Primitives、Lifecycle、JSON-RPC Base

> MCP 以前のすべての連携は一回限りの作り込みでした。Model Context Protocol は 2024 年 11 月に Anthropic から初めて公開され、現在は Linux Foundation の Agentic AI Foundation が管理しています。MCP は discovery と invocation を標準化し、どの client もどの server とも会話できるようにします。2025-11-25 spec は 6 つの primitives（server 側 3 つ、client 側 3 つ）、3 フェーズの lifecycle、JSON-RPC 2.0 wire format を定義しています。これらを理解すれば、この phase の MCP 章の残りは読み解けるようになります。

**種別:** 学習
**言語:** Python (stdlib, JSON-RPC parser)
**前提条件:** Phase 13 · 01 から 05（tool interface と function calling）
**所要時間:** 約45分

## 学習目標

- 6 つの MCP primitives（server 側の tools、resources、prompts、client 側の roots、sampling、elicitation）をすべて挙げ、それぞれの use case を 1 つ説明する。
- 3 フェーズの lifecycle（initialize、operation、shutdown）をたどり、各 phase で誰がどの message を送るかを述べる。
- JSON-RPC 2.0 の request、response、notification envelope を parse し、emit する。
- `initialize` における capability negotiation とは何か、そしてそれがないと何が壊れるかを説明する。

## 問題

MCP 以前、tool を使う agent はそれぞれ独自の protocol を持っていました。Cursor には MCP 風だが互換性のない tool system がありました。Claude Desktop は別の仕組みを出荷していました。VS Code の Copilot extension には 3 つ目の仕組みがありました。"Postgres query" tool を作った team は、同じ tool を host ごとの API に合わせて 3 回書いていました。再利用するには code を copy する必要がありました。

その結果、一回限りの integration が爆発的に増え、ecosystem の速度に天井が生まれました。

MCP は wire format を標準化することでこれを修正します。単一の MCP server は、Claude Desktop、ChatGPT、Cursor、VS Code、Gemini、Goose、Zed、Windsurf など、すべての MCP client で動作します。2026 年 4 月時点で client は 300 以上、SDK download は月間 1.1 億、public server は 10,000 以上です。Linux Foundation は 2025 年 12 月、新しい Agentic AI Foundation の下で stewardship を引き受けました。

この phase で使う spec revision は **2025-11-25** です。async Tasks（SEP-1686）、URL-mode elicitation（SEP-1036）、tools 付き sampling（SEP-1577）、incremental scope consent（SEP-835）、OAuth 2.1 resource-indicator semantics が追加されています。Phase 13 · 09 から 16 でそれらの extension を扱います。この lesson は base に留めます。

## コンセプト

### 3 つの server primitives

1. **Tools.** 呼び出し可能な action。Phase 13 · 01 と同じ 4-step loop。
2. **Resources.** 公開された data。URI で address できる read-only content: `file:///path`、`db://query/...`、custom schemes。
3. **Prompts.** 再利用可能な template。host UI の slash-command。server が template を提供し、client が arguments を埋めます。

### 3 つの client primitives

4. **Roots.** server が触れてよい URI の集合。client が宣言し、server がそれを尊重します。
5. **Sampling.** server が client の model に completion を要求します。server-side API key なしで server-hosted agent loop を可能にします。
6. **Elicitation.** server が実行中に client の user へ structured input を求めます。form または URL（SEP-1036）です。

MCP のすべての capability は、これら 6 つのどれか 1 つに必ず属します。Phase 13 · 10 から 14 でそれぞれを深掘りします。

### Wire format: JSON-RPC 2.0

すべての message は次の fields を持つ JSON object です。

- Requests: `{jsonrpc: "2.0", id, method, params}`。
- Responses: `{jsonrpc: "2.0", id, result | error}`。
- Notifications: `{jsonrpc: "2.0", method, params}` — `id` はなく、response は期待されません。

base spec には primitive 別に grouping された約 15 個の methods があります。重要なものは次の通りです。

- `initialize` / `initialized`（handshake）
- `tools/list`, `tools/call`
- `resources/list`, `resources/read`, `resources/subscribe`
- `prompts/list`, `prompts/get`
- `sampling/createMessage`（server-to-client）
- `notifications/tools/list_changed`, `notifications/resources/updated`, `notifications/progress`

### 3 phase lifecycle

**Phase 1: initialize.**

Client は自身の `capabilities` と `clientInfo` を含めて `initialize` を送ります。Server は自身の `capabilities`、`serverInfo`、話せる spec version を返します。Client は response を理解し終えたら `notifications/initialized` を送ります。ここから先は、交渉済み capability に従ってどちらの側も request を送れます。

**Phase 2: operation.**

双方向です。Client は discovery のために `tools/list` を呼び、invocation のために `tools/call` を呼びます。Server はその capability を宣言していれば `sampling/createMessage` を送れます。Server は tool set が変化したとき `notifications/tools/list_changed` を送れます。Client は user が root scope を変更したとき `notifications/roots/list_changed` を送れます。

**Phase 3: shutdown.**

どちらの側も transport を close します。MCP には structured shutdown method はありません。transport（stdio または Streamable HTTP、Phase 13 · 09）が connection 終了 signal を運びます。

### Capability negotiation

`initialize` handshake の `capabilities` が contract です。server からの例:

```json
{
  "tools": {"listChanged": true},
  "resources": {"subscribe": true, "listChanged": true},
  "prompts": {"listChanged": true}
}
```

server は `tools/list_changed` notifications を emit でき、`resources/subscribe` を support すると宣言しています。client は自身のものを宣言して合意します。

```json
{
  "roots": {"listChanged": true},
  "sampling": {},
  "elicitation": {}
}
```

client が `sampling` を宣言していなければ、server は `sampling/createMessage` を呼んではいけません。対称的に、server が `resources.subscribe` を宣言していなければ、client は subscribe を試みてはいけません。

これが ecosystem drift を防ぎます。sampling を support しない client も有効な MCP client です。`sampling` を呼ばない server も有効な MCP server です。ただ、その feature を一緒には使わないだけです。

### Structured content and error shapes

`tools/call` は typed block の `content` array を返します: `text`、`image`、`resource`。Phase 13 · 14 では MCP Apps（`ui://` interactive UI）がこの list に加わります。

Errors は JSON-RPC error codes を使います。spec が追加で定義するものは、`-32002` "Resource not found"、`-32603` "Internal error"、さらに `error.data` としての MCP-specific error data です。

### Client capabilities vs tool call details

よくある混乱があります。`capabilities.tools` は client が tool-list-changed notifications を support するかどうかです。client が特定の tools を実際に呼ぶかどうかは model による runtime choice であり、capability flag ではありません。capability flag は spec-level contract です。model の選択とは直交します。

### なぜ REST ではなく JSON-RPC なのか

JSON-RPC 2.0（2010）は軽量な bidirectional protocol です。REST は client-initiated です。MCP には server-initiated messages（sampling、notifications）が必要だったため、対称的な request/response shape を持つ JSON-RPC が自然に合いました。JSON-RPC は stdio と WebSocket/Streamable HTTP の上でも、HTTP の request shape を作り直すことなくきれいに合成できます。

## 使ってみる

`code/main.py` は最小の JSON-RPC 2.0 parser と emitter を出荷し、`initialize` → `tools/list` → `tools/call` → `shutdown` sequence を手でたどりながらすべての message を print します。実 transport はありません。message shape だけです。各 envelope を確認するには 参考文献の spec と比較してください。

見るべき点:

- `initialize` は両方向の capabilities を宣言します。response には `serverInfo` と `protocolVersion: "2025-11-25"` があります。
- `tools/list` は `tools` array を返します。各 entry には `name`、`description`、`inputSchema` があります。
- `tools/call` は `params.name` と `params.arguments` を使います。
- response の `content` は `{type, text}` blocks の array です。

## 出荷物

この lesson は `outputs/skill-mcp-handshake-tracer.md` を生成します。pcap-style の MCP client-server interaction transcript を受け取り、skill は各 message に対して、どの primitive、どの lifecycle phase、どの capability に依存するかを注釈します。

## 演習

1. `code/main.py` を実行してください。capability negotiation が起きる行を特定し、server が `tools.listChanged` を宣言していなかった場合に何が変わるかを説明してください。

2. parser を拡張して `notifications/progress` を扱ってください。message shape は `{method: "notifications/progress", params: {progressToken, progress, total}}` です。long-running `tools/call` の実行中に emit し、client handler が progress bar を表示できることを確認してください。

3. MCP 2025-11-25 spec を最初から最後まで読んでください。全体で約 80 ページです。ほとんどの server が必要としない capability flag を 1 つ特定してください。Hint: resource subscription に関係します。

4. 仮想的な "cron job" feature がどの primitive に属するか、紙に sketch してください。（Hint: server は client に scheduled time で invoke してほしい。現在の 6 primitives のどれにも合いません。）MCP の 2026 roadmap にはこのための draft SEP があります。

5. GitHub 上の open MCP server から session log を 1 つ parse してください。request、response、notification messages の数を数えます。traffic のうち lifecycle と operation がそれぞれどの割合かを計算してください。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|----------------|------------------------|
| MCP | "Model Context Protocol" | model-to-tool discovery と invocation のための open protocol |
| Server primitive | "server が公開するもの" | tools（actions）、resources（data）、prompts（templates） |
| Client primitive | "client が server に使わせるもの" | roots（scope）、sampling（LLM callbacks）、elicitation（user input） |
| JSON-RPC 2.0 | "wire format" | 対称的な request/response/notification envelopes |
| `initialize` handshake | "Capability negotiation" | 最初の message pair。servers と clients が support する features を宣言する |
| `tools/list` | "Discovery" | client が server に現在の tool set を尋ねる |
| `tools/call` | "Invocation" | client が server に arguments 付きで tool の実行を求める |
| `notifications/*_changed` | "Mutation events" | server が client に primitive list の変更を伝える |
| Content block | "Typed result" | tool result 内の `{type: "text" \| "image" \| "resource" \| "ui_resource"}` |
| SEP | "Spec Evolution Proposal" | 名前付きの draft proposal（例: async Tasks の SEP-1686） |

## 参考資料

- [Model Context Protocol — Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — 正典仕様ドキュメント
- [Model Context Protocol — Architecture concepts](https://modelcontextprotocol.io/docs/concepts/architecture) — six-primitive mental model
- [Anthropic — Introducing the Model Context Protocol](https://www.anthropic.com/news/model-context-protocol) — 2024 年 11 月の launch post
- [MCP blog — First MCP anniversary](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/) — 1 年 retrospective と 2025-11-25 spec changes
- [WorkOS — MCP 2025-11-25 spec update](https://workos.com/blog/mcp-2025-11-25-spec-update) — SEP-1686、1036、1577、835、1724 の summary
