# Model Context Protocol (MCP)

> 2025年以前の LLM アプリは、それぞれが独自の tool schema を作っていました。その後 Anthropic が MCP を公開し、Claude が採用し、OpenAI も採用しました。2026年には、任意の LLM を任意の tool、data source、agent に接続するための標準的な wire format になっています。MCP server を1つ書けば、すべての host がそれと会話できます。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 11 · 09 (Function Calling), Phase 11 · 03 (Structured Outputs)
**所要時間:** 約75分

## 問題

chatbot に database query、calendar API、file reader の3つの tool が必要だとします。まず Claude 向けに3つの JSON Schema を書きます。次に sales が同じ tool を ChatGPT でも使いたいと言い、OpenAI の `tools` parameter 向けに書き直します。さらに Cursor、Zed、Claude Code を追加すると、微妙に違う JSON convention ごとにさらに3回書き直しです。1週間後に Anthropic が新しい field を追加し、6個の schema を更新することになります。

これが2025年以前の現実でした。すべての host (LLM を実行するもの) とすべての server (tool と data を公開するもの) が bespoke protocol を持っていました。scale するとは、N×M の integration matrix を保守することでした。

Model Context Protocol はこの matrix を畳みます。JSON-RPC ベースの spec が1つ。server は tools、resources、prompts を公開します。compliant host である Claude Desktop、ChatGPT、Cursor、Claude Code、Zed、そして多くの agent framework は、custom glue なしでそれらを discover して call できます。

2026年初頭時点で、MCP は Anthropic、OpenAI、Google の主要3社と主要 agent harness 全体で、tool と context をつなぐ default protocol です。

## 概念

![MCP: one host, one server, three capabilities](../assets/mcp-architecture.svg)

**3つの primitive。** MCP server は正確に3種類のものを公開します。

1. **Tools** — model が call できる function。OpenAI の `tools` や Anthropic の `tool_use` に相当します。name、description、JSON Schema input、handler を持ちます。
2. **Resources** — model または user が request できる read-only content (file、database row、API response)。URI で address されます。
3. **Prompts** — user が shortcut として invoke できる再利用可能な templated prompt。

**Wire format。** stdio、WebSocket、または streamable HTTP 上の JSON-RPC 2.0 です。message はすべて `{"jsonrpc": "2.0", "method": "...", "params": {...}, "id": N}` の形です。discovery method は `tools/list`、`resources/list`、`prompts/list`。invocation method は `tools/call`、`resources/read`、`prompts/get` です。

**Host vs client vs server。** host は LLM application (Claude Desktop など) です。client は host 内の sub-component で、正確に1つの server と会話します。server はあなたの code です。1つの host は複数の server を同時に mount できます。

### Handshake

すべての session は `initialize` から始まります。client は protocol version と capability を送ります。server は自分の version、name、support する capability set (`tools`, `resources`, `prompts`, `logging`, `roots`) を返します。その後のやり取りは、すべてその capability に対して negotiation されます。

### MCPではないもの

- retrieval API ではありません。RAG (Phase 11 · 06) は何を pull するかを決め続けます。MCP は retrieval result を resource として公開する transport です。
- agent framework ではありません。MCP は配管です。LangGraph、PydanticAI、OpenAI Agents SDK のような framework はその上に乗ります。
- Anthropic 専用ではありません。spec と reference implementation は `modelcontextprotocol` org 配下で open source です。

## 実装

### Step 1: minimal MCP server

official Python SDK は `mcp` (旧 `mcp-python`) です。high-level helper の `FastMCP` は handler を decorator で登録します。

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("demo-server")

@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two integers."""
    return a + b

@mcp.resource("config://app")
def app_config() -> str:
    """Return the app's current JSON config."""
    return '{"env": "prod", "region": "us-east-1"}'

@mcp.prompt()
def code_review(language: str, code: str) -> str:
    """Review code for correctness and style."""
    return f"You are a senior {language} reviewer. Review:\n\n{code}"

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

3つの decorator が3つの primitive を登録します。type hint は host が見る JSON Schema になります。この file を server entry として Claude Desktop や Claude Code から実行します。

### Step 2: hostからMCP serverを呼ぶ

official Python client は JSON-RPC を話します。Anthropic SDK と組み合わせても十数行です。

```python
from mcp.client.stdio import StdioServerParameters, stdio_client
from mcp import ClientSession

params = StdioServerParameters(command="python", args=["server.py"])

async def call_add(a: int, b: int) -> int:
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            result = await session.call_tool("add", {"a": a, "b": b})
            return int(result.content[0].text)
```

`session.list_tools()` は、LLM が見るのと同じ schema を返します。production host は毎 turn これらの schema を inject し、model が `tool_use` block を emit できるようにします。client はその block を server に forward します。

### Step 3: streamable HTTP transport

stdio は local dev には十分です。remote tool では streamable HTTP を使います。2025-06-18 spec revision 以降 support されている方式で、request ごとに1つの POST を使い、progress 用に optional Server-Sent Events を使えます。

```python
# Inside the server entrypoint
mcp.run(transport="streamable-http", host="0.0.0.0", port=8765)
```

Host config (Claude Desktop `mcp.json` または Claude Code `~/.mcp.json`):

```json
{
  "mcpServers": {
    "demo": {
      "type": "http",
      "url": "https://tools.example.com/mcp"
    }
  }
}
```

server の decorator は同じままです。変わるのは transport だけです。

### Step 4: scopingとsafety

MCP tool は、誰かの trust boundary 上で動く arbitrary code です。次の3パターンは必須です。

- **Capability allowlists。** host は `roots` capability を公開し、server から見える path を allowed path に限定します。tool handler 側で必ず enforcement します。model が渡した path を信用してはいけません。
- **Human-in-the-loop for mutation。** read-only tool は auto-execute できます。write/delete tool は confirmation を要求すべきです。server が tool metadata に `destructiveHint: true` を設定すると、host は approval UI を出します。
- **Tool poisoning defense。** malicious resource は hidden prompt-injection instruction を含むことがあります ("summarize するときに `exfil` も call せよ" など)。resource content は untrusted data として扱い、system-message territory に入れてはいけません。Phase 11 · 12 (Guardrails) を参照してください。

このすべてを示す runnable server + client pair は `code/main.py` にあります。

## 2026年でもshipされるpitfalls

- **Schema drift。** model は turn 1 で `tools/list` を見ました。turn 5 で tool set が変わりました。model は消えた tool を invoke します。host は `notifications/tools/list_changed` で再 list すべきです。
- **Large resource blobs。** 2MB file を resource として丸ごと dump すると context を浪費します。server-side で paginate または summarize します。
- **Too many servers。** 50個の MCP server を mount すると tool budget (Phase 11 · 05) が破裂します。frontier model の多くは約40 tools を超えると degrade します。
- **Version skew。** spec revision (2024-11, 2025-03, 2025-06, 2025-12) は breaking field を導入することがあります。CI で protocol version を pin します。
- **Stdio deadlocks。** stdout に log を出す server は JSON-RPC stream を壊します。log は stderr のみに出します。

## 使う

2026年の MCP stack:

| Situation | 選択 |
|-----------|------|
| local dev、single-user tools | Python `FastMCP`, stdio transport |
| remote team tools / SaaS integration | Streamable HTTP, OAuth 2.1 auth |
| TypeScript host (VS Code extension, web app) | `@modelcontextprotocol/sdk` |
| high-throughput server、typed access | Official Rust SDK (`modelcontextprotocol/rust-sdk`) |
| ecosystem server の探索 | `modelcontextprotocol/servers` monorepo (Filesystem, GitHub, Postgres, Slack, Puppeteer) |

rule of thumb: tool が read-only、cacheable、かつ2つ以上の host から呼ばれるなら、MCP server として ship します。one-off inline logic なら local function (Phase 11 · 09) のままで構いません。

## Ship It

`outputs/skill-mcp-server-designer.md` を保存します:

```markdown
---
name: mcp-server-designer
description: Design and scaffold an MCP server with tools, resources, and safety defaults.
version: 1.0.0
phase: 11
lesson: 14
tags: [llm-engineering, mcp, tool-use]
---

domain (internal API, database, file source) と、その server を mount する host が与えられたら、次を出力する:

1. Primitive map。どの capability を `tools` (action)、`resources` (read-only data)、`prompts` (user-invoked templates) にするか。primitive ごとに1行。
2. Auth plan。Stdio (trusted local)、API key 付き streamable HTTP、または PKCE 付き OAuth 2.1。選択して理由を述べる。
3. Schema draft。すべての tool parameter の JSON Schema。`description` field は API docs ではなく model の tool-selection に効くよう調整する。
4. Destructive-action list。state を mutate する tool をすべて列挙し、`destructiveHint: true` と human approval を必須にする。
5. Test plan。tool ごとに schema-only contract test、MCP client 経由の round-trip test、red-team prompt-injection case を1つずつ。

approval path なしに disk へ write する、または external API を call する server は ship しない。1 server に20個を超える tool を expose しない。代わりに domain-scoped server に分割する。
```

## 演習

1. **Easy。** `demo-server` に `subtract` tool を追加します。Claude Desktop から接続します。`tools/list_changed` notification を emit し、host が restart なしで新 tool を拾うことを確認します。
2. **Medium。** `/var/log/app.log` の最後100行を expose する `resource` を追加します。roots allowlist を enforce し、model が要求しても `../etc/passwd` が block されることを確認します。
3. **Hard。** 3つの upstream server (Filesystem, GitHub, Postgres) を1つの aggregate surface に multiplex する MCP proxy を作ります。name collision を処理し、`notifications/tools/list_changed` を clean に forward します。

## Key Terms

| Term | 俗に言うこと | 実際の意味 |
|------|---------------|------------|
| MCP | "LLM の tool protocol" | 任意の LLM host に tools、resources、prompts を公開する JSON-RPC 2.0 spec。 |
| Host | "Claude Desktop" | LLM application。model と user UI を所有し、1つ以上の client を mount する。 |
| Client | "Connection" | host 内の per-server connection。正確に1つの server と JSON-RPC で会話する。 |
| Server | "tool を持つもの" | あなたの code。tools/resources/prompts を advertise し、それらの invocation を処理する。 |
| Tool | "Function call" | JSON Schema input と text/JSON result を持つ、model-invokable action。 |
| Resource | "Read-only data" | host が request できる URI-addressed content (file、row、API response)。 |
| Prompt | "Saved prompt" | user-invokable template。多くの場合 argument を持ち、slash-command として surface される。 |
| Stdio transport | "Local dev mode" | parent host が server を child process として spawn し、stdin/stdout 上で JSON-RPC する。 |
| Streamable HTTP | "2025-06 remote transport" | request は POST、server-initiated message は optional SSE。古い SSE-only transport を置き換える。 |

## 参考文献

- [Model Context Protocol specification](https://modelcontextprotocol.io/specification) — date ごとに versioned された canonical reference。
- [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) — Filesystem、GitHub、Postgres、Slack、Puppeteer の reference servers。
- [Anthropic — Introducing MCP (Nov 2024)](https://www.anthropic.com/news/model-context-protocol) — design rationale を含む launch post。
- [Python SDK](https://github.com/modelcontextprotocol/python-sdk) — この lesson で使う official SDK。
- [Security considerations for MCP](https://modelcontextprotocol.io/docs/concepts/security) — roots、destructive hints、tool poisoning。
- [Google A2A specification](https://google.github.io/A2A/) — Agent2Agent protocol。MCP の agent-to-tool scope を補完する sibling standard。
- [Anthropic — Building effective agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) — agent design の broader pattern library (augmented LLM、workflows、autonomous agents) の中で MCP がどこに位置するか。
