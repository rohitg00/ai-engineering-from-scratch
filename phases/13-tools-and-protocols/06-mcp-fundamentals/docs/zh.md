# MCP 基础——原语、生命周期、JSON-RPC 基础

> 在 MCP 之前，每一次集成都是孤立的。由 Anthropic 于 2024 年 11 月首次推出，现由 Linux 基金会代理式 AI 基金会（Agentic AI Foundation）管理的模型上下文协议（Model Context Protocol，MCP）标准化了发现和调用过程，使得任何客户端都能与任何服务器通信。2025-11-25 规范定义了六种原语（三种服务器端、三种客户端）、一个三阶段生命周期以及一种 JSON-RPC 2.0 线格式。掌握这些内容，本阶段余下的 MCP 章节便如同阅读。

**类型：** 学习
**语言：** Python（标准库，JSON-RPC 解析器）
**前置条件：** 阶段 13 · 01 至 05（工具接口与函数调用）
**时间：** 约 45 分钟

## 学习目标

- 列举全部六种 MCP 原语（服务器端：工具、资源、提示；客户端：根节点、采样、引导），并为每种原语给出一个用例。
- 梳理三阶段生命周期（初始化、运行、关闭），并说明每个阶段由谁发送哪条消息。
- 解析并生成 JSON-RPC 2.0 请求、响应和通知信封。
- 解释 `initialize` 阶段中“能力协商（capability negotiation）”的含义，以及缺少它将导致什么问题。

## 问题所在

在 MCP 之前，每个使用工具的智能体都有自己的协议。Cursor 拥有一种类似 MCP 但互不兼容的工具系统。Claude Desktop 采用另一种。VS Code 的 Copilot 扩展使用第三种。一个团队构建了一个“Postgres 查询”工具，却需要针对不同宿主的 API 分别编写三遍相同的代码。重用该工具需要复制代码。

其结果是出现了大量孤立的集成，导致生态发展速度受限。

MCP 通过标准化线格式解决了这个问题。一个 MCP 服务器可在所有 MCP 客户端中正常工作：Claude Desktop、ChatGPT、Cursor、VS Code、Gemini、Goose、Zed、Windsurf，截至 2026 年 4 月已有超过 300 个客户端。月度 SDK 下载量达 1.1 亿次。公开服务器超过 10000 个。Linux 基金会于 2025 年 12 月在新成立的代理式 AI 基金会下接管了该项目。

本阶段使用的规范版本为 **2025-11-25**。它增加了异步任务（SEP-1686）、URL 模式引导（SEP-1036）、带工具的采样（SEP-1577）、增量范围许可（SEP-835）以及 OAuth 2.1 资源指示器语义。阶段 13 · 09 至 16 将涵盖这些扩展。本课止步于基础部分。

## 概念

### 三种服务器端原语

1. **工具（Tools）。** 可调用的动作。与阶段 13 · 01 中相同的四步循环。
2. **资源（Resources）。** 暴露的数据。通过 URI 可寻址的只读内容：`file:///path`、`db://query/...` 及自定义协议。
3. **提示（Prompts）。** 可复用的模板。宿主 UI 中的斜杠命令；服务器提供模板，客户端填充参数。

### 三种客户端原语

4. **根节点（Roots）。** 服务器允许访问的 URI 集合。客户端声明根节点，服务器遵循其约束。
5. **采样（Sampling）。** 服务器请求客户端的模型执行一次补全。支持在无服务器端 API 密钥的情况下运行服务器托管的智能体循环。
6. **引导（Elicitation）。** 服务器在运行过程中请求客户端的用户提供结构化输入。可以是表单或 URL（SEP-1036）。

MCP 中的每一项能力恰好属于这六种原语之一。阶段 13 · 10 至 14 将对每种原语进行深入介绍。

### 线格式：JSON-RPC 2.0

每条消息都是一个 JSON 对象，包含以下字段：

- 请求：`{jsonrpc: "2.0", id, method, params}`
- 响应：`{jsonrpc: "2.0", id, result | error}`
- 通知：`{jsonrpc: "2.0", method, params}`——无 `id`，不期望响应。

基础规范约有 15 个方法，按原语分组。重要的方法包括：

- `initialize` / `initialized`（握手）
- `tools/list`、`tools/call`
- `resources/list`、`resources/read`、`resources/subscribe`
- `prompts/list`、`prompts/get`
- `sampling/createMessage`（服务器到客户端）
- `notifications/tools/list_changed`、`notifications/resources/updated`、`notifications/progress`

### 三阶段生命周期

**阶段 1：初始化（initialize）。**

客户端发送 `initialize`，包含其 `capabilities` 和 `clientInfo`。服务器返回其自身的 `capabilities`、`serverInfo` 以及它所支持的规范版本。客户端在消化响应后发送 `notifications/initialized`。自此之后，双方均可根据协商后的能力发送请求。

**阶段 2：运行（operation）。**

双向通信。客户端调用 `tools/list` 进行发现，然后调用 `tools/call` 执行调用。如果服务器声明了采样能力，它可以发送 `sampling/createMessage`。当其工具集发生变化时，服务器可发送 `notifications/tools/list_changed`。当用户更改根节点范围时，客户端可发送 `notifications/roots/list_changed`。

**阶段 3：关闭（shutdown）。**

任一方关闭传输层。MCP 中没有结构化的关闭方法；传输层（stdio 或 Streamable HTTP，阶段 13 · 09）承载连接结束信号。

### 能力协商

`initialize` 握手中的 `capabilities` 即为契约。服务器示例：

```json
{
  "tools": {"listChanged": true},
  "resources": {"subscribe": true, "listChanged": true},
  "prompts": {"listChanged": true}
}
```

服务器声明它可以发送 `tools/list_changed` 通知并支持 `resources/subscribe`。客户端通过声明自身能力来表示同意：

```json
{
  "roots": {"listChanged": true},
  "sampling": {},
  "elicitation": {}
}
```

如果客户端未声明 `sampling`，则服务器不得调用 `sampling/createMessage`。对称地：如果服务器未声明 `resources.subscribe`，则客户端不得尝试订阅。

这正是防止生态分化的关键。不支持采样的客户端仍然是有效的 MCP 客户端；不调用 `sampling` 的服务器仍然是有效的 MCP 服务器。它们只是不会共同使用该功能。

### 结构化内容与错误形状

`tools/call` 返回一个 `content` 数组，包含类型化的块：`text`、`image`、`resource`。阶段 13 · 14 将 MCP 应用（`ui://` 交互式 UI）添加到该列表中。

错误使用 JSON-RPC 错误码。规范定义的新增内容：`-32002`“资源未找到”、`-32603`“内部错误”，以及 MCP 特定的错误数据作为 `error.data`。

### 客户端能力与工具调用细节

一个常见的混淆点：`capabilities.tools` 表示客户端是否支持工具列表变化的通知。客户端是否会调用特定的工具，是由其模型在运行时决定的，而不是一个能力标志。能力标志是规范层面的契约，模型的选择是正交的。

### 为何选择 JSON-RPC 而非 REST？

JSON-RPC 2.0（2010）是一个轻量级的双向协议。REST 是客户端发起的。MCP 需要服务器发起的消息（采样、通知），因此具有对称请求/响应形状的 JSON-RPC 是自然的选择。JSON-RPC 还能干净地组合在 stdio 和 WebSocket/Streamable HTTP 之上，而无需重新发明 HTTP 的请求形状。

## 使用

`code/main.py` 提供了一个极简的 JSON-RPC 2.0 解析器和生成器，然后手动执行 `initialize` → `tools/list` → `tools/call` → `shutdown` 序列，并打印每条消息。没有真实的传输层；只是消息的形状。可与“进一步阅读”中链接的规范进行比对，验证每个信封。

观察重点：

- `initialize` 双向声明能力；响应中包含 `serverInfo` 和 `protocolVersion: "2025-11-25"`。
- `tools/list` 返回一个 `tools` 数组；每个条目包含 `name`、`description`、`inputSchema`。
- `tools/call` 使用 `params.name` 和 `params.arguments`。
- 响应 `content` 是一个包含 `{type, text}` 块的数组。

## 产出

本课生成 `outputs/skill-mcp-handshake-tracer.md`。给定一段 MCP 客户端-服务器交互的 pcap 风格转录，该技能将为每条消息标注其所属的原语、生命周期阶段以及依赖的能力。

## 练习

1. 运行 `code/main.py`。找出能力协商发生的行，并描述如果服务器未声明 `tools.listChanged` 将会发生什么变化。

2. 扩展解析器以处理 `notifications/proprogress`。消息形状：`{method: "notifications/progress", params: {progressToken, progress, total}}`。在长时间运行的 `tools/call` 执行过程中发出该通知，并确认客户端处理器能够显示进度条。

3. 从头到尾阅读 MCP 2025-11-25 规范——整个文档约 80 页。找出大多数服务器不需要的一个能力标志。（提示：与资源订阅有关。）

4. 在纸上画出假设的“定时任务”功能属于哪种原语。（提示：服务器希望客户端在预定时间调用它。目前的六种原语均不适用。）MCP 的 2026 路线图中有一个关于此功能的草案 SEP。

5. 从 GitHub 上的一个开源 MCP 服务器解析一段会话日志。统计请求、响应和通知消息的数量。计算生命周期消息与运行消息的流量占比。

## 关键术语

| 术语 | 通常说法 | 实际含义 |
|------|----------|----------|
| MCP | “模型上下文协议” | 用于模型与工具之间发现和调用的开放协议 |
| 服务器原语 | “服务器暴露的内容” | 工具（动作）、资源（数据）、提示（模板） |
| 客户端原语 | “客户端允许服务器使用的内容” | 根节点（范围）、采样（LLM 回调）、引导（用户输入） |
| JSON-RPC 2.0 | “线格式” | 对称的请求/响应/通知信封 |
| `initialize` 握手 | “能力协商” | 第一条消息对；服务器和客户端声明其支持的功能 |
| `tools/list` | “发现” | 客户端询问服务器当前的工具集 |
| `tools/call` | “调用” | 客户端请求服务器使用参数执行某个工具 |
| `notifications/*_changed` | “变更事件” | 服务器告知客户端其原语列表已变化 |
| 内容块 | “类型化结果” | 工具结果中的 `{type: "text" \| "image" \| "resource" \| "ui_resource"}` |
| SEP | “规范演进提案” | 命名草案提议（例如用于异步任务的 SEP-1686） |

## 进一步阅读

- [模型上下文协议——规范 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) —— 权威规范文档
- [模型上下文协议——架构概念](https://modelcontextprotocol.io/docs/concepts/architecture) —— 六原语心智模型
- [Anthropic——介绍模型上下文协议](https://www.anthropic.com/news/model-context-protocol) —— 2024 年 11 月发布博文
- [MCP 博客——MCP 一周年](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/) —— 一周年回顾及 2025-11-25 规范变更
- [WorkOS——MCP 2025-11-25 规范更新](https://workos.com/blog/mcp-2025-11-25-spec-update) —— SEP-1686、1036、1577、835 和 1724 的总结