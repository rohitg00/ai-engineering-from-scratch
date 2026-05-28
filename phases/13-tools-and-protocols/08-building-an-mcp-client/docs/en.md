# Building an MCP Client — Discovery, Invocation, Session Management

> MCP の content の多くは server tutorial を出荷し、client には軽く触れるだけです。難しい orchestration は client code にあります。process spawning、capability negotiation、複数 server にまたがる tool list merge、sampling callbacks、reconnection、namespace collision resolution です。この lesson では、3 つの異なる MCP servers を model 用の 1 つの flat tool namespace に持ち上げる multi-server client を構築します。

**種別:** 構築
**言語:** Python (stdlib, multi-server MCP client)
**前提条件:** Phase 13 · 07（building an MCP server）
**所要時間:** 約 75 分

## Learning Objectives

- MCP server を child process として spawn し、`initialize` を complete して `notifications/initialized` を送る。
- per-server session state（capabilities、tool list、last-seen notification ids）を維持する。
- 複数 server の tool lists を 1 つの namespace に merge し、collision handling を行う。
- tool call をその tool を所有する server に route し、response を reassemble する。

## 問題

実際の agent host（Claude Desktop、Cursor、Goose、Gemini CLI）は複数の MCP servers を同時に load します。user は filesystem server、Postgres server、GitHub server を同時に動かしているかもしれません。client の仕事:

1. 各 server を spawn する。
2. それぞれを独立に handshake する。
3. 各 server で `tools/list` を呼び、結果を flatten する。
4. model が `notes_search` を emit したら、merged namespace で lookup し、正しい server に route する。
5. 任意の server からの notifications（`tools/list_changed`）を blocking なしで扱う。
6. transport failure 時に reconnect する。

これを hand-roll できるかどうかが、"toy" と "serviceable" を分けます。official SDKs はこれを wrap しますが、mental model は自分のものにしておく必要があります。

## The Concept

### Child-process spawning

`subprocess.Popen` を `stdin=PIPE, stdout=PIPE, stderr=PIPE` で使います。`bufsize=1` を設定し、line-by-line reads のために text mode を使います。各 server は 1 process です。client は server ごとに 1 つの `Popen` handle を保持します。

### Per-server session state

server ごとに `Session` object が次を保持します。

- `process` — Popen handle。
- `capabilities` — server が `initialize` で宣言したもの。
- `tools` — 直近の `tools/list` result。
- `pending` — request id から response を待つ promise/future への map。

Requests は本質的に async です。server B が mid-call の間に server A へ送った `tools/call` が block されてはいけません。queues 付き threads または asyncio を使います。

### Merged namespace

client が aggregate tool list を見ると、names は collision することがあります。2 つの servers がどちらも `search` を公開しているかもしれません。client には 3 つの options があります。

1. **Prefix by server name.** `notes/search`, `files/search`。明確だが見た目は悪い。
2. **Silent first-come.** 後から来た server の `search` が earlier のものを override する。危険で、collisions を隠す。
3. **Collision rejection.** 2 つ目の server を load しない。user に通知する。security-sensitive hosts では最も安全。

Claude Desktop は prefix-by-server を使います。Cursor は clear error 付きの collision rejection を使います。VS Code MCP も prefix-by-server を採用しています。

### Routing

merge 後、dispatch table は `tool_name -> session` を map します。model は name で call を emit します。client は session を見つけ、その server の stdin に `tools/call` message を write し、response を await します。

### Sampling callback

server が `initialize` で `sampling` capability を宣言している場合、client に LLM を実行させるため `sampling/createMessage` を送ることがあります。client は次を行う必要があります。

1. sample が resolve するまでその server へのさらなる requests を block する。implementation が concurrency を support する場合は pipeline する。
2. 自身の LLM provider を呼ぶ。
3. response を server に返す。

Lesson 11 は sampling を end-to-end で扱います。この lesson では completeness のために stub します。

### Notification handling

`notifications/tools/list_changed` は `tools/list` を再呼び出しせよという意味です。`notifications/resources/updated` は、その resource が use 中なら re-read せよという意味です。Notifications は responses を生成してはいけません。ack しようとしてはいけません。

よくある client bug: notification が stream に残っている間に `tools/call` で read loop を block してしまうこと。background reader thread を使い、すべての message を queue に push します。main thread が dequeue して dispatch します。

### Reconnection

Transport は fail します。server crash、OS による process kill、stdio pipe break です。client は stdout の EOF を検出し、その session を dead と扱います。options:

- server を黙って restart し、re-handshake する。pure read-only servers では OK。
- failure を user に表示する。user-visible sessions を持つ stateful servers では OK。

Phase 13 · 09 は Streamable HTTP reconnection semantics を扱います。stdio はより単純です。

### Keepalive and session id

Streamable HTTP は `Mcp-Session-Id` header を使います。stdio には session id がありません。process identity そのものが session です。Keepalive pings は optional です。stdio pipes は inactivity で切れません。

## Use It

`code/main.py` は 3 つの simulated MCP servers を subprocesses として spawn し、それぞれを handshake し、tool lists を merge し、tool calls を正しい server に route します。"servers" は実際には toy responders を実行する別の Python processes です（real LLM はありません）。実行すると次が見えます。

- 3 つの initialization。それぞれが独自の capability set を持つ。
- 3 つの `tools/list` results が 7-tool namespace に merge される。
- tool name に基づく routing decision。
- namespace prefixing によって collision が防がれる。

見るべき点:

- `Session` dataclass が per-server state を clean に保持しています。
- background reader thread が main thread を block せずに stdout の各 line を dequeue します。
- dispatch table は単純な `dict[str, Session]` です。
- collision handling は explicit です。2 つの servers が同じ name を宣言した場合、後から来たものは prefix 付きに rename されます。

## Ship It

この lesson は `outputs/skill-mcp-client-harness.md` を生成します。MCP servers の declarative list（name、command、args）を受け取り、skill はそれらを spawn し、tool lists を merge し、collision resolution 付きの routing function を出荷する harness を生成します。

## Exercises

1. `code/main.py` を実行し、server spawn log を観察してください。simulated server process の 1 つを SIGTERM で kill し、client が EOF を検出してその session を dead と mark する様子を観察してください。

2. namespace prefixing を実装してください。2 つの servers が `search` を公開する場合、2 つ目を `<server>/search` に rename します。dispatch table を update し、tool calls が正しく route されることを verify してください。

3. server restart のための connection-pool-style backoff を追加してください。連続 failure に対して exponential backoff、30 秒で cap、3 回 failure したら user に notification を emit します。

4. 100 個の concurrent MCP servers を support する client を sketch してください。単純な dispatch dict はどの data structure に置き換わりますか？（Hint: prefix namespacing 用の trie と、tool-count-per-server の metric。）

5. client を official MCP Python SDK に port してください。SDK は `stdio_client` と `ClientSession` を wrap します。multi-server routing を保ったまま、code は約 200 行から約 40 行に縮むはずです。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MCP client | "agent host" | servers を spawn し、tool calls を orchestrate する process |
| Session | "Per-server state" | capabilities、tool list、pending-request bookkeeping |
| Merged namespace | "One tool list" | active servers 全体にまたがる flat set of tool names |
| Namespace collision | "2 servers same tool" | client は duplicate を prefix、reject、または first-come にする必要がある |
| Routing | "この call は誰が受ける？" | tool name から owning server への dispatch |
| Background reader | "Non-blocking stdout" | server stdout を queue に drain する thread または task |
| Sampling callback | "LLM-as-a-service" | server からの `sampling/createMessage` に対する client handler |
| `notifications/*_changed` | "Primitive mutated" | client が re-discover または re-read すべき signal |
| Reconnection policy | "server が死んだとき" | transport failure 時の restart semantics |
| Stdio session | "Process = session" | session id はなく、child process lifetime が session |

## 参考文献

- [Model Context Protocol — Client spec](https://modelcontextprotocol.io/specification/2025-11-25/client) — canonical client behavior
- [MCP — Quickstart client guide](https://modelcontextprotocol.io/quickstart/client) — Python SDK を使う hello-world client tutorial
- [MCP Python SDK — client module](https://github.com/modelcontextprotocol/python-sdk) — reference `ClientSession` and `stdio_client`
- [MCP TypeScript SDK — Client](https://github.com/modelcontextprotocol/typescript-sdk) — TS parallel
- [VS Code — MCP in extensions](https://code.visualstudio.com/api/extension-guides/ai/mcp) — VS Code が単一 editor host 内で複数 MCP servers を multiplex する方法
