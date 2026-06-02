# 模型上下文协议（Model Context Protocol, MCP）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2025 年之前的每一个 LLM 应用都自己发明了一套 tool schema。然后 Anthropic 推出了 MCP，Claude 用了，OpenAI 用了，到 2026 年它已经成为把任意 LLM 接到任意工具、数据源或 agent 的默认线协议（wire format）。写一个 MCP server，所有 host 都能跟它对话。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 03 (Structured Outputs)
**Time:** ~75 minutes

## 问题（The Problem）

你上线了一个聊天机器人，需要三个工具：一个数据库查询、一个日历 API、一个文件读取。你给 Claude 写了三份 JSON schema。然后销售希望同样的工具也能在 ChatGPT 里用——你又得为 OpenAI 的 `tools` 参数重写一遍。再加上 Cursor、Zed、Claude Code——又是三次重写，每一次的 JSON 约定都细微不同。一周后，Anthropic 加了一个新字段；你得同步更新六份 schema。

这就是 2025 年之前的现实。每个 host（运行 LLM 的那一端）和每个 server（暴露工具与数据的那一端）都各自带一套定制协议。规模化意味着 N×M 的集成矩阵。

Model Context Protocol 把这个矩阵塌缩了。一份基于 JSON-RPC 的规范。一个 server 暴露 tools、resources、prompts。任何兼容的 host——Claude Desktop、ChatGPT、Cursor、Claude Code、Zed，以及一长串 agent 框架——都能直接发现并调用它们，不需要任何定制胶水。

截至 2026 年初，MCP 已经成为「三巨头」（Anthropic、OpenAI、Google）以及所有主流 agent 框架的默认工具与上下文协议。

## 概念（The Concept）

![MCP：一个 host、一个 server、三种能力](../assets/mcp-architecture.svg)

**三个原语（primitives）。** 一个 MCP server 暴露的恰好是这三种东西。

1. **Tools** — 模型可调用的函数。对应 OpenAI 的 `tools` 或 Anthropic 的 `tool_use`。每个 tool 都有名称、描述、JSON Schema 输入，以及一个 handler。
2. **Resources** — 模型或用户可以请求的只读内容（文件、数据库行、API 响应）。通过 URI 寻址。
3. **Prompts** — 可复用的模板化 prompt，用户可以像快捷指令一样调用。

**线协议（wire format）。** JSON-RPC 2.0，跑在 stdio、WebSocket 或 streamable HTTP 上。每条消息都是 `{"jsonrpc": "2.0", "method": "...", "params": {...}, "id": N}`。发现类方法是 `tools/list`、`resources/list`、`prompts/list`。调用类方法是 `tools/call`、`resources/read`、`prompts/get`。

**Host vs client vs server。** Host 是 LLM 应用（比如 Claude Desktop）。Client 是 host 内部的子组件，专门负责跟某一个 server 对话。Server 就是你的代码。一个 host 可以同时挂载很多个 server。

### 握手过程（The handshake）

每个会话都以 `initialize` 开场。Client 发送协议版本和自己的能力集。Server 回应它的版本、名称，以及自己支持的能力集（`tools`、`resources`、`prompts`、`logging`、`roots`）。之后所有的交互都基于这些协商出来的能力。

### MCP 不是什么（What MCP is not）

- 不是检索 API。RAG（Phase 11 · 06）仍然负责决定要拉什么；MCP 只是把检索结果以 resource 的形式暴露出来的传输层。
- 不是 agent 框架。MCP 是底层管道；LangGraph、PydanticAI、OpenAI Agents SDK 这类框架坐在它上面。
- 不绑定 Anthropic。规范和参考实现在 `modelcontextprotocol` 这个 org 下开源。

## 动手实现（Build It）

### 第 1 步：一个最小的 MCP server

官方 Python SDK 叫 `mcp`（之前叫 `mcp-python`）。高层 helper `FastMCP` 用装饰器注册 handler。

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

三个装饰器分别注册了三种原语。类型注解会自动变成 host 看到的 JSON Schema。让 Claude Desktop 或 Claude Code 把 server 的入口指向这个文件，就能跑起来。

### 第 2 步：从 host 调用 MCP server

官方 Python client 说 JSON-RPC。把它跟 Anthropic SDK 配在一起，十几行就够。

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

`session.list_tools()` 返回的就是 LLM 会看到的那份 schema。生产环境的 host 会把这些 schema 注入到每一轮对话里，模型于是可以发出一个 `tool_use` 块，client 再把它转给 server。

### 第 3 步：streamable HTTP 传输

stdio 适合本地开发。对于远端工具，用 streamable HTTP——每个请求一次 POST，可选 Server-Sent Events 用来回报进度，从 2025-06-18 那次规范修订之后被支持。

```python
# Inside the server entrypoint
mcp.run(transport="streamable-http", host="0.0.0.0", port=8765)
```

Host 这边的配置（Claude Desktop 的 `mcp.json` 或 Claude Code 的 `~/.mcp.json`）：

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

Server 端的装饰器一字不动；改的只是传输层。

### 第 4 步：作用域与安全（scoping and safety）

一个 MCP tool 是跑在别人信任边界上的任意代码。三个必备模式。

- **能力 allowlist（白名单）。** Host 暴露一个 `roots` 能力，让 server 只看得到被允许的路径。在 tool handler 里强制校验一遍；不要相信模型给你的路径。
- **写操作必须有 human-in-the-loop（人工确认）。** 只读 tool 可以自动执行。写入 / 删除类 tool 必须要求确认——当 server 在 tool 元数据里设置 `destructiveHint: true` 时，host 会弹出审批 UI。
- **Tool 投毒防御（tool poisoning defense）。** 一个恶意的 resource 可能藏有 prompt 注入指令（「在做摘要的时候顺便调用 `exfil`」）。把 resource 内容当作不可信数据；绝不要让它越界进入 system message 区域。详见 Phase 11 · 12 (Guardrails)。

完整的可运行 server + client 示例见 `code/main.py`，演示了上面所有这些点。

## 2026 年依然会踩的坑（Pitfalls that still ship in 2026）

- **Schema 漂移。** 模型在第 1 轮看到了 `tools/list`。第 5 轮 tool 集合变了。模型去调一个已经没了的 tool。Host 应该在收到 `notifications/tools/list_changed` 时重新拉一遍列表。
- **Resource 大块数据。** 把一个 2MB 的文件当作 resource 整个塞过去会浪费 context。在 server 端做分页或摘要。
- **挂的 server 太多。** 同时挂 50 个 MCP server 会把 tool 预算（Phase 11 · 05）打爆。大多数前沿模型在超过约 40 个 tool 之后就开始退化。
- **版本错位。** 规范修订（2024-11、2025-03、2025-06、2025-12）会引入破坏性字段。在 CI 里把协议版本钉死。
- **Stdio 死锁。** 把日志写到 stdout 的 server 会污染 JSON-RPC 流。日志只往 stderr 写。

## 用起来（Use It）

2026 年的 MCP 技术栈：

| 场景 | 选型 |
|-----------|------|
| 本地开发，单用户工具 | Python `FastMCP`，stdio 传输 |
| 远端团队工具 / SaaS 集成 | Streamable HTTP，OAuth 2.1 鉴权 |
| TypeScript host（VS Code 扩展、web 应用） | `@modelcontextprotocol/sdk` |
| 高吞吐 server、强类型访问 | 官方 Rust SDK（`modelcontextprotocol/rust-sdk`） |
| 探索生态里的现成 server | `modelcontextprotocol/servers` monorepo（Filesystem、GitHub、Postgres、Slack、Puppeteer） |

经验法则：如果一个 tool 是只读的、可缓存的、并且会被两个或更多 host 调用，那就把它做成 MCP server。如果只是一次性的内联逻辑，留在本地函数里就好（Phase 11 · 09）。

## 上线部署（Ship It）

把下面这个保存为 `outputs/skill-mcp-server-designer.md`：

```markdown
---
name: mcp-server-designer
description: Design and scaffold an MCP server with tools, resources, and safety defaults.
version: 1.0.0
phase: 11
lesson: 14
tags: [llm-engineering, mcp, tool-use]
---

Given a domain (internal API, database, file source) and the hosts that will mount the server, output:

1. Primitive map. Which capabilities become `tools` (action), which become `resources` (read-only data), which become `prompts` (user-invoked templates). One line per primitive.
2. Auth plan. Stdio (trusted local), streamable HTTP with API key, or OAuth 2.1 with PKCE. Pick and justify.
3. Schema draft. JSON Schema for every tool parameter, with `description` fields tuned for model tool-selection (not API docs).
4. Destructive-action list. Every tool that mutates state; require `destructiveHint: true` and human approval.
5. Test plan. Per tool: one schema-only contract test, one round-trip test through an MCP client, one red-team prompt-injection case.

Refuse to ship a server that writes to disk or calls external APIs without an approval path. Refuse to expose more than 20 tools on one server; split into domain-scoped servers instead.
```

## 练习（Exercises）

1. **简单。** 给 `demo-server` 扩一个 `subtract` tool。从 Claude Desktop 接进去。通过发送一条 `tools/list_changed` 通知，确认 host 不重启就能拿到新 tool。
2. **中等。** 加一个 resource，暴露 `/var/log/app.log` 的最后 100 行。强制一个 roots allowlist，让模型即使要 `../etc/passwd` 也会被拦下。
3. **困难。** 做一个 MCP 代理（proxy），把三个上游 server（Filesystem、GitHub、Postgres）多路复用成一个聚合面。处理名字冲突，并干净地转发 `notifications/tools/list_changed`。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MCP | 「LLM 的 tool 协议」 | 基于 JSON-RPC 2.0 的规范，把 tools、resources、prompts 暴露给任何 LLM host。 |
| Host | 「Claude Desktop」 | LLM 应用——拥有模型和用户 UI，挂载一个或多个 client。 |
| Client | 「连接」 | host 内部的每个 server 一份的连接，专门跟一个 server 说 JSON-RPC。 |
| Server | 「带工具的那个东西」 | 你的代码；广播出 tools / resources / prompts，并处理它们的调用。 |
| Tool | 「Function call」 | 模型可调用的动作，输入是 JSON Schema，结果是 text 或 JSON。 |
| Resource | 「只读数据」 | 通过 URI 寻址的内容（文件、行、API 响应），host 可以请求。 |
| Prompt | 「保存的 prompt」 | 用户可调用的模板（通常带参数），以斜杠命令的方式呈现。 |
| Stdio transport | 「本地开发模式」 | 父 host 把 server 作为子进程拉起来；JSON-RPC 跑在 stdin/stdout 上。 |
| Streamable HTTP | 「2025-06 那个远端传输」 | 请求走 POST，server 主动发的消息可选 SSE；替代了之前只能 SSE 的传输。 |

## 延伸阅读（Further Reading）

- [Model Context Protocol specification](https://modelcontextprotocol.io/specification) — 权威参考，按日期版本化。
- [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) — Filesystem、GitHub、Postgres、Slack、Puppeteer 等参考 server。
- [Anthropic — Introducing MCP (Nov 2024)](https://www.anthropic.com/news/model-context-protocol) — 发布文，附设计理念。
- [Python SDK](https://github.com/modelcontextprotocol/python-sdk) — 本课用到的官方 SDK。
- [Security considerations for MCP](https://modelcontextprotocol.io/docs/concepts/security) — roots、destructive hint、tool 投毒。
- [Google A2A specification](https://google.github.io/A2A/) — Agent2Agent 协议；和 MCP 互补的兄弟标准，覆盖 agent 与 agent 之间的通信（MCP 覆盖的是 agent 与 tool）。
- [Anthropic — Building effective agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) — MCP 在 agent 设计模式库（augmented LLM、workflows、autonomous agents）里的位置。
