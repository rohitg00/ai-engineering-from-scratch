# Building an MCP Server — Python + TypeScript SDKs

> ほとんどの MCP tutorial は stdio の hello-world だけを見せます。実用的な server は tools、resources、prompts を公開し、capability negotiation を扱い、structured errors を emit し、SDK をまたいでも同じように動作します。この lesson では notes server を end-to-end で構築します。stdlib stdio transport、JSON-RPC dispatch、3 つの server primitives、そして卒業後に Python SDK の FastMCP または TypeScript SDK にそのまま移せる pure-function style を扱います。

**種別:** 構築
**言語:** Python (stdlib, stdio MCP server)
**前提条件:** Phase 13 · 06（MCP fundamentals）
**所要時間:** 約 75 分

## Learning Objectives

- `initialize`、`tools/list`、`tools/call`、`resources/list`、`resources/read`、`prompts/list`、`prompts/get` methods を実装する。
- stdin から JSON-RPC messages を読み、stdout に responses を書く dispatch loop を書く。
- JSON-RPC 2.0 spec と MCP の追加 code に従って structured error responses を emit する。
- tool logic を書き直さずに stdlib implementation から FastMCP（Python SDK）または TypeScript SDK へ移行する。

## 問題

remote transport（Phase 13 · 09）や auth layer（Phase 13 · 16）を使う前に、clean な local server が必要です。local とは stdio を意味します。server は client に child process として spawn され、messages は stdin/stdout 上を newline-delimited で流れます。

2025-11-25 spec は、stdio messages を明示的な `\n` separator 付きの JSON objects として encode するよう規定しています。ここに SSE はありません。SSE は古い remote mode であり、2026 年中頃に削除されます（Atlassian の Rovo MCP server は 2026 年 6 月 30 日に、Keboola は 2026 年 4 月 1 日に deprecated にしました）。stdio では、1 行に 1 つの JSON object が wire format のすべてです。

notes server は 3 つの server primitives をすべて exercising するため、よい形です。Tools は mutation を行います（`notes_create`）。Resources は data を公開します（`notes://{id}`）。Prompts は templates を出荷します（`review_note`）。この lesson の形は、どの domain にも一般化できます。

## The Concept

### Dispatch loop

```text
loop:
  line = stdin.readline()
  msg = json.loads(line)
  if has id:
    handle request -> write response
  else:
    handle notification -> no response
```

3 つの rules:

- JSON-RPC envelope 以外を stdout に print しない。debug logs は stderr に送る。
- すべての request は、同じ `id` を持つ response と必ず対応させる。
- Notifications には response を返してはいけない。

### Implementing `initialize`

```python
def initialize(params):
    return {
        "protocolVersion": "2025-11-25",
        "capabilities": {
            "tools": {"listChanged": True},
            "resources": {"listChanged": True, "subscribe": False},
            "prompts": {"listChanged": False},
        },
        "serverInfo": {"name": "notes", "version": "1.0.0"},
    }
```

support するものだけを宣言してください。client は feature を gate するために capability set を信頼します。

### Implementing `tools/list` and `tools/call`

`tools/list` は各 entry が `name`、`description`、`inputSchema` を持つ `{tools: [...]}` を返します。`tools/call` は `{name, arguments}` を受け取り、`{content: [blocks], isError: bool}` を返します。

Content blocks は typed です。最も一般的なもの:

```json
{"type": "text", "text": "Found 2 notes"}
{"type": "resource", "resource": {"uri": "notes://14", "text": "..."}}
{"type": "image", "data": "<base64>", "mimeType": "image/png"}
```

Tool errors には 2 つの shape があります。Protocol-level errors（unknown method、bad params）は JSON-RPC errors です。Tool-level errors（valid call だが tool が failed）は `{content: [...], isError: true}` として返します。これにより model は failure を context 内で見られます。

### Implementing resources

Resources は design 上 read-only です。`resources/list` は manifest を返し、`resources/read` は content を返します。URI は `file://...`、`http://...`、または `notes://` のような custom scheme にできます。

data を tool ではなく resource として公開するとき:

- model はそれを "call" しません。client が user request に応じて context に inject できます。
- Subscriptions により、resource が変化したとき server が updates を push できます（Phase 13 · 10）。
- Phase 13 · 14 はこれを `ui://` による interactive resources へ拡張します。

### Implementing prompts

Prompts は named arguments を持つ templates です。host はそれらを slash-commands として表示します。`review_note` prompt は `note_id` argument を受け取り、client が model に渡す multi-message prompt template を生成できます。

### Stdio transport subtleties

- Newline-delimited JSON。length-prefixed framing はない。
- buffer しない。write ごとに `sys.stdout.flush()` する。
- lifetime は client が control する。stdin が close（EOF）したら cleanly に exit する。
- SIGPIPE を黙って処理しない。log して exit する。

### Annotations

各 tool は safety properties を説明する `annotations` を持てます。

- `readOnlyHint: true` — pure read。retry して安全。
- `destructiveHint: true` — irreversible side effects。client は confirm すべき。
- `idempotentHint: true` — same inputs が same outputs を生む。
- `openWorldHint: true` — external systems とやり取りする。

client はこれらを使って UX（confirmation dialogs、status indicators）と routing（Phase 13 · 17）を決めます。

### Graduation path

`code/main.py` の stdlib server は約 180 行です。FastMCP（Python）では同じ logic が decorator-style に圧縮されます。

```python
from fastmcp import FastMCP
app = FastMCP("notes")

@app.tool()
def notes_search(query: str, limit: int = 10) -> list[dict]:
    ...
```

TypeScript SDK にも同等の shape があります。準備ができたら graduation path は drop-in です。concepts（capabilities、dispatch、content blocks）は同じです。

## Use It

`code/main.py` は stdio 上で動く complete な notes MCP server で、stdlib のみを使います。`initialize`、3 つの tools（`notes_list`、`notes_search`、`notes_create`）のための `tools/list` と `tools/call`、各 note のための `resources/list` と `resources/read`、そして `review_note` prompt を扱います。JSON-RPC messages を pipe して drive できます。

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | python main.py
```

見るべき点:

- dispatcher は method name を key にした `dict[str, Callable]` です。
- すべての tool executor は bare string ではなく content blocks の list を返します。
- executor が raise したとき `isError: true` が設定されます。

## Ship It

この lesson は `outputs/skill-mcp-server-scaffolder.md` を生成します。domain（notes、tickets、files、database）を受け取り、skill は適切な tools / resources / prompts の split と SDK graduation path を持つ MCP server を scaffold します。

## Exercises

1. `code/main.py` を実行し、hand-built JSON-RPC messages で drive してください。`notes_create` を exercise してから、`resources/read` で新しい note を取得してください。

2. `annotations: {destructiveHint: true}` を持つ `notes_delete` tool を追加してください。client が confirmation dialog を表示することを verify してください（これには実 host が必要です。Claude Desktop で動きます）。

3. `resources/subscribe` を実装し、note が modified されるたびに server が `notifications/resources/updated` を push するようにしてください。keepalive task を追加してください。

4. server を FastMCP に port してください。Python file は 80 行未満に縮むはずです。wire behavior は identical でなければなりません。同じ JSON-RPC test harness で verify してください。

5. spec の `server/tools` section を読み、この lesson の server で実装していない tool definition field を 1 つ特定してください。（Hint: いくつかあります。1 つ選んで追加してください。）

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MCP server | "tools を公開するもの" | stdio または HTTP 上で MCP JSON-RPC を話す process |
| stdio transport | "Child process model" | server は client に spawn され、stdin/stdout で通信する |
| Dispatcher | "Method router" | JSON-RPC method name から handler function への map |
| Content block | "Tool result chunk" | tool response の `content` array にある typed element |
| `isError` | "Tool-level failure" | tool が failed したことを示し、JSON-RPC error と区別する |
| Annotations | "Safety hints" | readOnly / destructive / idempotent / openWorld flags |
| FastMCP | "Python SDK" | MCP protocol の上にある decorator-based higher-level framework |
| Resource URI | "Addressable data" | resource を identify する `file://`、`db://`、または custom scheme |
| Prompt template | "Slash-command brief" | host UI 用の argument slots 付き server-supplied template |
| Capability declaration | "Feature toggle" | `initialize` で宣言される per-primitive flags |

## 参考文献

- [Model Context Protocol — Python SDK](https://github.com/modelcontextprotocol/python-sdk) — reference Python implementation
- [Model Context Protocol — TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — parallel TS implementation
- [FastMCP — server framework](https://gofastmcp.com/) — MCP servers 用の decorator-style Python API
- [MCP — Quickstart server guide](https://modelcontextprotocol.io/quickstart/server) — いずれかの SDK を使う end-to-end tutorial
- [MCP — Server tools spec](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) — tools/* messages の complete reference
