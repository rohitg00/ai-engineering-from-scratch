# 14 · 模型上下文协议（MCP）

> 2025 年之前构建的每一个 LLM 应用都自己发明了一套工具 schema。后来 Anthropic 发布了 MCP，Claude 采用了它，OpenAI 也采用了它，到 2026 年它已成为连接任意 LLM 与任意工具、数据源或智能体的默认线缆格式。写一个 MCP 服务器，每个宿主都能与它对话。

**类型：** 实战
**语言：** Python
**前置：** 阶段 11 · 09（函数调用）、阶段 11 · 03（结构化输出）
**时长：** 约 75 分钟

## 问题所在

你发布了一个聊天机器人，它需要三个工具：一个数据库查询、一个日历 API 和一个文件读取器。你为 Claude 写了三套 JSON schema。然后销售团队希望在 ChatGPT 里用同样的工具——你得为 OpenAI 的 `tools` 参数重写一遍。接着你又要接入 Cursor、Zed 和 Claude Code——又是三次重写，每一次的 JSON 约定都有细微差别。一周后，Anthropic 新增了一个字段；你得更新六套 schema。

这就是 2025 年之前的现实。每个宿主（host，即运行 LLM 的那一方）和每个服务器（server，即暴露工具和数据的那一方）都各自发布定制协议。规模化意味着一个 N×M 的集成矩阵。

模型上下文协议（Model Context Protocol）让这个矩阵坍缩。一套基于 JSON-RPC 的规范。一个服务器暴露工具、资源和提示词。任何合规的宿主——Claude Desktop、ChatGPT、Cursor、Claude Code、Zed，以及一长串智能体框架——都能发现并调用它们，无需任何定制胶水代码。

截至 2026 年初，MCP 已成为三巨头（Anthropic、OpenAI、Google）以及所有主流智能体框架（harness）中默认的工具与上下文协议。

## 核心概念

〔图：MCP 架构——一个宿主、一个服务器、三种能力〕

**三大原语。** 一个 MCP 服务器恰好暴露三样东西。

1. **工具（Tools）**——模型可以调用的函数。对应 OpenAI 的 `tools` 或 Anthropic 的 `tool_use`。每个工具都有名称、描述、JSON Schema 输入和一个处理函数。
2. **资源（Resources）**——模型或用户可以请求的只读内容（文件、数据库行、API 响应）。通过 URI 寻址。
3. **提示词（Prompts）**——用户可作为快捷方式调用的、可复用的模板化提示词。

**线缆格式。** JSON-RPC 2.0，承载于 stdio、WebSocket 或可流式 HTTP（streamable HTTP）之上。每条消息都是 `{"jsonrpc": "2.0", "method": "...", "params": {...}, "id": N}`。发现方法有 `tools/list`、`resources/list`、`prompts/list`。调用方法有 `tools/call`、`resources/read`、`prompts/get`。

**宿主、客户端与服务器的区别。** 宿主（host）是 LLM 应用（如 Claude Desktop）。客户端（client）是宿主内部的一个子组件，专门与某一个服务器对话。服务器（server）就是你的代码。一个宿主可以同时挂载多个服务器。

### 握手过程

每个会话都以 `initialize` 开始。客户端发送协议版本及其能力。服务器返回自己的版本、名称以及它所支持的能力集（`tools`、`resources`、`prompts`、`logging`、`roots`）。此后的一切都基于这些能力进行协商。

### MCP 不是什么

- 不是检索 API。RAG（阶段 11 · 06）仍然负责决定该拉取什么；MCP 只是把检索结果作为资源暴露出来的传输层。
- 不是智能体框架。MCP 是底层管道；LangGraph、PydanticAI 和 OpenAI Agents SDK 这类框架位于它之上。
- 不绑定 Anthropic。规范和参考实现以开源形式发布在 `modelcontextprotocol` 组织下。

## 动手构建

### 第 1 步：一个极简 MCP 服务器

官方 Python SDK 是 `mcp`（前身为 `mcp-python`）。高层的 `FastMCP` 辅助类通过装饰器注册处理函数。

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("demo-server")

@mcp.tool()
def add(a: int, b: int) -> int:
    """对两个整数求和。"""
    return a + b

@mcp.resource("config://app")
def app_config() -> str:
    """返回应用当前的 JSON 配置。"""
    return '{"env": "prod", "region": "us-east-1"}'

@mcp.prompt()
def code_review(language: str, code: str) -> str:
    """从正确性和风格角度审查代码。"""
    return f"You are a senior {language} reviewer. Review:\n\n{code}"

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

三个装饰器注册了三种原语。类型提示会变成宿主所看到的 JSON Schema。把服务器入口指向此文件，即可在 Claude Desktop 或 Claude Code 下运行它。

### 第 2 步：从宿主调用 MCP 服务器

官方 Python 客户端使用 JSON-RPC。把它与 Anthropic SDK 搭配只需十几行代码。

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

`session.list_tools()` 返回的正是 LLM 将要看到的同一份 schema。生产环境的宿主会在每一轮对话中注入这些 schema，使模型能够产出一个 `tool_use` 块，再由客户端转发给服务器。

### 第 3 步：可流式 HTTP 传输

stdio 适用于本地开发。对于远程工具，应使用可流式 HTTP（streamable HTTP）——每个请求一次 POST，可选用服务器发送事件（Server-Sent Events）来传递进度，自 2025-06-18 规范修订版起得到支持。

```python
# 在服务器入口内部
mcp.run(transport="streamable-http", host="0.0.0.0", port=8765)
```

宿主配置（Claude Desktop 的 `mcp.json` 或 Claude Code 的 `~/.mcp.json`）：

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

服务器保持相同的装饰器；只是传输方式发生了变化。

### 第 4 步：作用域与安全

一个 MCP 工具就是在他人信任边界上运行的任意代码。三种必备模式。

- **能力白名单（Capability allowlists）。** 宿主暴露一个 `roots` 能力，使服务器只能看到被允许的路径。要在工具处理函数中强制执行它；不要信任模型提供的路径。
- **变更操作的人在回路（Human-in-the-loop）。** 只读工具可以自动执行。写入/删除工具必须要求确认——当服务器在工具元数据上设置了 `destructiveHint: true` 时，宿主会弹出一个审批界面。
- **工具投毒防御（Tool poisoning defense）。** 一个恶意资源可能包含隐藏的提示词注入指令（例如“总结时也调用 `exfil`”）。要把资源内容当作不可信数据；绝不能让它越界进入系统消息的领域。参见阶段 11 · 12（护栏）。

可运行的服务器 + 客户端配对示例见 `code/main.py`，它演示了上述全部内容。

## 2026 年仍在踩的坑

- **Schema 漂移（Schema drift）。** 模型在第 1 轮看到了 `tools/list`。工具集在第 5 轮发生变化。模型调用了一个已经不存在的工具。宿主应在收到 `notifications/tools/list_changed` 时重新拉取列表。
- **过大的资源数据块。** 把一个 2MB 的文件作为资源整个倒出来会浪费上下文。应在服务器端分页或摘要化。
- **服务器过多。** 挂载 50 个 MCP 服务器会撑爆工具预算（阶段 11 · 05）。大多数前沿模型在超过约 40 个工具后表现就会下降。
- **版本错配（Version skew）。** 各规范修订版（2024-11、2025-03、2025-06、2025-12）会引入破坏性字段。在 CI 中固定协议版本。
- **Stdio 死锁。** 向 stdout 打日志的服务器会破坏 JSON-RPC 流。只能向 stderr 打日志。

## 如何选用

2026 年的 MCP 技术栈：

| 场景 | 选择 |
|-----------|------|
| 本地开发、单用户工具 | Python `FastMCP`，stdio 传输 |
| 远程团队工具 / SaaS 集成 | 可流式 HTTP，OAuth 2.1 认证 |
| TypeScript 宿主（VS Code 扩展、Web 应用） | `@modelcontextprotocol/sdk` |
| 高吞吐服务器、类型化访问 | 官方 Rust SDK（`modelcontextprotocol/rust-sdk`） |
| 探索生态系统服务器 | `modelcontextprotocol/servers` 单仓库（Filesystem、GitHub、Postgres、Slack、Puppeteer） |

经验法则：如果一个工具是只读的、可缓存的，且会被两个或更多宿主调用，就把它发布为一个 MCP 服务器。如果它只是一次性的内联逻辑，就保留为本地函数（阶段 11 · 09）。

## 交付产物

保存 `outputs/skill-mcp-server-designer.md`：

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

## 练习

1. **简单。** 为 `demo-server` 扩展一个 `subtract` 工具。从 Claude Desktop 连接它。通过发出一个 `tools/list_changed` 通知，确认宿主无需重启即可识别到新工具。
2. **中等。** 添加一个 `resource`，暴露 `/var/log/app.log` 的最后 100 行。强制实施 roots 白名单，使得即便模型主动请求，`../etc/passwd` 也会被拦截。
3. **困难。** 构建一个 MCP 代理，把三个上游服务器（Filesystem、GitHub、Postgres）多路复用成一个聚合接口。处理名称冲突，并干净地转发 `notifications/tools/list_changed`。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| MCP | “LLM 的工具协议” | 一套 JSON-RPC 2.0 规范，用于向任意 LLM 宿主暴露工具、资源和提示词。 |
| 宿主（Host） | “Claude Desktop” | LLM 应用——拥有模型和用户界面，挂载一个或多个客户端。 |
| 客户端（Client） | “连接” | 宿主内部针对单个服务器的连接，用 JSON-RPC 与恰好一个服务器对话。 |
| 服务器（Server） | “那个带工具的东西” | 你的代码；声明 tools/resources/prompts 并处理它们的调用。 |
| 工具（Tool） | “函数调用” | 模型可调用的动作，带 JSON Schema 输入和文本/JSON 结果。 |
| 资源（Resource） | “只读数据” | 由 URI 寻址的内容（文件、数据库行、API 响应），宿主可请求。 |
| 提示词（Prompt） | “保存的提示词” | 用户可调用的模板（通常带参数），以斜杠命令形式呈现。 |
| Stdio 传输 | “本地开发模式” | 父宿主把服务器作为子进程启动；JSON-RPC 经由 stdin/stdout。 |
| 可流式 HTTP | “2025-06 的远程传输” | 请求用 POST，可选 SSE 用于服务器主动发起的消息；取代了较旧的纯 SSE 传输。 |

## 延伸阅读

- [模型上下文协议规范](https://modelcontextprotocol.io/specification) —— 权威参考，按日期版本化。
- [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) —— Filesystem、GitHub、Postgres、Slack、Puppeteer 参考服务器。
- [Anthropic —— Introducing MCP（2024 年 11 月）](https://www.anthropic.com/news/model-context-protocol) —— 含设计理念的发布博文。
- [Python SDK](https://github.com/modelcontextprotocol/python-sdk) —— 本课所用的官方 SDK。
- [MCP 的安全考量](https://modelcontextprotocol.io/docs/concepts/security) —— roots、destructive hints、工具投毒。
- [Google A2A 规范](https://google.github.io/A2A/) —— Agent2Agent 协议；作为 MCP「智能体到工具」范围的姊妹标准，补充覆盖「智能体到智能体」的通信。
- [Anthropic —— Building effective agents（2024 年 12 月）](https://www.anthropic.com/research/building-effective-agents) —— MCP 在更广阔的智能体设计模式库（增强型 LLM、工作流、自主智能体）中的位置。
