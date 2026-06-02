# MCP 基础——原语、生命周期与 JSON-RPC 底座

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> MCP 出现之前，每一次集成都是一次性的。Model Context Protocol（模型上下文协议）由 Anthropic 于 2024 年 11 月首次发布，目前由 Linux 基金会的 Agentic AI Foundation 托管。它把发现（discovery）和调用（invocation）标准化，于是任何 client 都能跟任何 server 对话。2025-11-25 版本规范定义了六种原语（server 三种、client 三种）、三阶段生命周期，以及 JSON-RPC 2.0 的传输格式。学会这些，本阶段 MCP 章节剩下的内容就只是阅读了。

**Type:** Learn
**Languages:** Python (stdlib, JSON-RPC parser)
**Prerequisites:** Phase 13 · 01 through 05 (the tool interface and function calling)
**Time:** ~45 minutes

## 学习目标（Learning Objectives）

- 说出全部六种 MCP 原语（server 端的 tools、resources、prompts；client 端的 roots、sampling、elicitation），并各举一个用例。
- 走一遍三阶段生命周期（initialize、operation、shutdown），说清每一阶段哪一方发哪种消息。
- 解析并构造 JSON-RPC 2.0 的 request、response、notification 信封。
- 解释 `initialize` 阶段的能力协商（capability negotiation）是什么，以及没有它会出什么问题。

## 问题（The Problem）

MCP 出现之前，每个会用工具的 agent 都有自己一套协议。Cursor 有一套形似 MCP 但不兼容的工具系统。Claude Desktop 出货时带的是另一套。VS Code 的 Copilot 扩展又是第三套。一个团队写一个「Postgres 查询」工具，要把同一个工具写三遍，分别对接三个 host 的 API。想复用？只能复制代码。

结果就是大量一次性集成的寒武纪大爆发，整个生态的演进速度被卡死。

MCP 通过统一传输格式解决了这件事。同一个 MCP server 可以在所有 MCP client 上跑：Claude Desktop、ChatGPT、Cursor、VS Code、Gemini、Goose、Zed、Windsurf——到 2026 年 4 月已超过 300 个 client。SDK 月下载量 1.1 亿。公开 server 超过 1 万个。Linux 基金会于 2025 年 12 月接手托管，挂在新成立的 Agentic AI Foundation 名下。

本阶段使用的规范修订版本是 **2025-11-25**。它新增了异步 Tasks（SEP-1686）、URL 模式 elicitation（SEP-1036）、可调用 tool 的 sampling（SEP-1577）、增量 scope 同意（SEP-835），以及 OAuth 2.1 的 resource-indicator 语义。Phase 13 · 09 到 16 会覆盖这些扩展。本课只到底座为止。

## 概念（The Concept）

### 三种 server 原语（Three server primitives）

1. **Tools.** 可调用动作。和 Phase 13 · 01 中讲的四步循环一样。
2. **Resources.** 暴露数据。只读内容，按 URI 寻址：`file:///path`、`db://query/...`，或自定义 scheme。
3. **Prompts.** 可复用模板。在 host UI 里以 slash 命令出现；server 提供模板，client 填充参数。

### 三种 client 原语（Three client primitives）

4. **Roots.** server 被允许触碰的 URI 集合。client 声明，server 遵守。
5. **Sampling.** server 请求 client 的模型完成一次补全。这让 server 可以托管 agent loop，而不需要 server 端自己持有 API key。
6. **Elicitation.** server 在执行过程中向 client 的用户索取结构化输入。表单或 URL（SEP-1036）。

MCP 里的每个能力都恰好属于这六种之一。Phase 13 · 10 到 14 会逐个深入。

### 传输格式：JSON-RPC 2.0（Wire format: JSON-RPC 2.0）

每条消息都是一个 JSON 对象，包含以下字段：

- 请求（Requests）：`{jsonrpc: "2.0", id, method, params}`。
- 响应（Responses）：`{jsonrpc: "2.0", id, result | error}`。
- 通知（Notifications）：`{jsonrpc: "2.0", method, params}`——没有 `id`，也不期待响应。

底座规范大概有 15 个方法，按原语分组。重点的几个：

- `initialize` / `initialized`（握手）
- `tools/list`、`tools/call`
- `resources/list`、`resources/read`、`resources/subscribe`
- `prompts/list`、`prompts/get`
- `sampling/createMessage`（server 发给 client）
- `notifications/tools/list_changed`、`notifications/resources/updated`、`notifications/progress`

### 三阶段生命周期（Three-phase lifecycle）

**阶段 1：initialize。**

client 发送 `initialize`，带上自己的 `capabilities` 和 `clientInfo`。server 回复自己的 `capabilities`、`serverInfo`，以及它所支持的规范版本。client 消化完响应后再发一个 `notifications/initialized`。从此以后，双方都可以按照协商出来的能力发起请求。

**阶段 2：operation。**

双向。client 调 `tools/list` 做发现，再用 `tools/call` 调用。server 如果声明了 sampling 能力，就可以发 `sampling/createMessage`。server 的 tool 集合发生变化时可以发 `notifications/tools/list_changed`。当用户改动 root 范围时，client 可以发 `notifications/roots/list_changed`。

**阶段 3：shutdown。**

任意一方关闭传输层。MCP 没有结构化的 shutdown 方法；连接结束信号由传输层（stdio 或 Streamable HTTP，见 Phase 13 · 09）负责传递。

### 能力协商（Capability negotiation）

`initialize` 握手中的 `capabilities` 就是契约。server 端的例子：

```json
{
  "tools": {"listChanged": true},
  "resources": {"subscribe": true, "listChanged": true},
  "prompts": {"listChanged": true}
}
```

server 声明自己可以发 `tools/list_changed` 通知，并支持 `resources/subscribe`。client 声明自己的能力作为回应：

```json
{
  "roots": {"listChanged": true},
  "sampling": {},
  "elicitation": {}
}
```

如果 client 没声明 `sampling`，那么 server 就不能调 `sampling/createMessage`。对称地：如果 server 没声明 `resources.subscribe`，client 也不能尝试订阅。

这就是防止生态漂移的关键。一个不支持 sampling 的 client 仍是合法的 MCP client；一个不调 `sampling` 的 server 仍是合法的 MCP server。它们只是不在那个特性上协作而已。

### 结构化内容与错误形态（Structured content and error shapes）

`tools/call` 返回一个 `content` 数组，里面是带类型的块：`text`、`image`、`resource`。Phase 13 · 14 会把 MCP Apps（`ui://` 交互式 UI）也加进这个列表。

错误使用 JSON-RPC 错误码。规范新增的几条：`-32002`「Resource not found」、`-32603`「Internal error」，再加上 MCP 特有的错误数据放在 `error.data` 里。

### Client 能力 vs 具体的 tool 调用细节（Client capabilities vs tool call details）

一个常见的混淆：`capabilities.tools` 表示的是 client 是否支持 tool-list-changed 通知。至于 client 「是否会」调用某个具体的 tool，那是它模型驱动的运行时选择，不是能力标志。能力标志是规范层面的契约，模型的选择则是另一回事，两者正交。

### 为什么是 JSON-RPC 而不是 REST？（Why JSON-RPC and not REST?）

JSON-RPC 2.0（2010 年）是一种轻量的双向协议。REST 是 client 发起的。MCP 需要 server 主动发起的消息（sampling、通知），所以拥有对称 request/response 形态的 JSON-RPC 自然合适。JSON-RPC 也能干净地架在 stdio 和 WebSocket / Streamable HTTP 之上，无需重新发明 HTTP 的请求结构。

## 用起来（Use It）

`code/main.py` 提供了一个最小的 JSON-RPC 2.0 解析器与构造器，然后手工走一遍 `initialize` → `tools/list` → `tools/call` → `shutdown` 序列，把每条消息打印出来。没有真实传输层；只看消息形态。结合「Further Reading」里链接的规范文档逐一对照每个信封。

可以重点看的几处：

- `initialize` 双向声明 capabilities；响应里含有 `serverInfo` 与 `protocolVersion: "2025-11-25"`。
- `tools/list` 返回一个 `tools` 数组；每项含 `name`、`description`、`inputSchema`。
- `tools/call` 使用 `params.name` 和 `params.arguments`。
- 响应中的 `content` 是一个 `{type, text}` 块的数组。

## 上线部署（Ship It）

本课产出 `outputs/skill-mcp-handshake-tracer.md`。给定一段 pcap 风格的 MCP client–server 交互记录，这个 skill 会为每条消息标注：属于哪种原语、处于哪个生命周期阶段、依赖哪个 capability。

## 练习（Exercises）

1. 跑 `code/main.py`。找出能力协商发生的那一行，并描述：如果 server 没声明 `tools.listChanged`，会有什么变化。

2. 扩展解析器以处理 `notifications/progress`。消息形态：`{method: "notifications/progress", params: {progressToken, progress, total}}`。在一个长耗时的 `tools/call` 进行中发出它，并确认 client 处理函数能展示一个进度条。

3. 把 MCP 2025-11-25 规范从头到尾读一遍——整份文档大约 80 页。找出大多数 server 都「不需要」的那一个 capability flag。提示：跟 resource 订阅有关。

4. 在纸上勾画一下：假设有一个「cron job」特性，它应该归到哪种原语？（提示：server 想让 client 在某个预定时间触发它。今天这六种原语都不合适。）MCP 2026 路线图里有一个对应的 SEP 草案。

5. 找一个 GitHub 上公开的 MCP server，解析它的一段会话日志。统计 request、response、notification 三种消息的数量。算一下 lifecycle 流量与 operation 流量各占多少。

## 关键术语（Key Terms）

| 术语 | 大家平时怎么说 | 实际含义 |
|------|----------------|----------|
| MCP | 「Model Context Protocol」 | 用于「模型 ↔ 工具」发现与调用的开放协议 |
| Server primitive | 「server 暴露什么」 | tools（动作）、resources（数据）、prompts（模板） |
| Client primitive | 「client 让 server 用什么」 | roots（范围）、sampling（LLM 回调）、elicitation（用户输入） |
| JSON-RPC 2.0 | 「传输格式」 | 对称的 request / response / notification 信封 |
| `initialize` handshake | 「能力协商」 | 第一对消息；server 与 client 互相声明各自支持的特性 |
| `tools/list` | 「发现」 | client 向 server 询问当前的 tool 集合 |
| `tools/call` | 「调用」 | client 让 server 用一组参数执行某个 tool |
| `notifications/*_changed` | 「变更事件」 | server 告知 client 它的某个原语列表发生了变动 |
| Content block | 「带类型的结果」 | tool 结果中的 `{type: "text" \| "image" \| "resource" \| "ui_resource"}` |
| SEP | 「Spec Evolution Proposal」 | 命名的草案提案（如异步 Tasks 的 SEP-1686） |

## 延伸阅读（Further Reading）

- [Model Context Protocol — Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — 规范的权威原文
- [Model Context Protocol — Architecture concepts](https://modelcontextprotocol.io/docs/concepts/architecture) — 六原语的心智模型
- [Anthropic — Introducing the Model Context Protocol](https://www.anthropic.com/news/model-context-protocol) — 2024 年 11 月发布博文
- [MCP blog — First MCP anniversary](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/) — 一周年回顾以及 2025-11-25 版本变化
- [WorkOS — MCP 2025-11-25 spec update](https://workos.com/blog/mcp-2025-11-25-spec-update) — SEP-1686、1036、1577、835、1724 的摘要
