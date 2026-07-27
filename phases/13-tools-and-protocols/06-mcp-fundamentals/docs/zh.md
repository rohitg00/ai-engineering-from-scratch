# MCP 基础 — 原语、生命周期、JSON-RPC 基础

> 在 MCP 之前，每一次集成都是定制方案。Model Context Protocol 最初由 Anthropic 于 2024 年 11 月推出，现由 Linux 基金会旗下的 Agentic AI 基金会管理，它标准化了发现与调用机制，使任何客户端都能与任何服务器通信。2025-11-25 版本的规范定义了六种原语（三种服务端、三种客户端）、一个三阶段生命周期以及 JSON-RPC 2.0 的线格式。掌握这些内容后，本阶段剩下的 MCP 章节便只需阅读即可理解。

**类型：** 学习  
**语言：** Python（标准库，JSON-RPC 解析器）  
**前置知识：** 阶段 13 · 01 至 05（工具接口与函数调用）  
**预计时间：** ~45 分钟

## 学习目标

- 列举全部六种 MCP 原语（服务端：工具、资源、提示词；客户端：根集、采样、引导）并各给出一个使用场景。
- 梳理三阶段生命周期（初始化、运行、关闭），说明每个阶段由谁发送哪类消息。
- 解析并生成 JSON-RPC 2.0 的请求、响应和通知信封。
- 解释 `initialize` 阶段的"能力协商"是什么，以及缺少它会出什么问题。

## 问题背景

在 MCP 出现之前，每个使用工具的智能体都有自己的协议。Cursor 有一套类似 MCP 但不兼容的工具系统。Claude Desktop 使用另一种协议。VS Code 的 Copilot 扩展又是一种。一个团队编写"Postgres 查询"工具时，需要针对三种不同的宿主 API 编写三次。想要复用就得复制代码。

其结果是"寒武纪大爆发"般的大量定制集成，生态发展速度受到了限制。

MCP 通过标准化线格式解决了这个问题。一个 MCP 服务器可以在所有 MCP 客户端中使用：Claude Desktop、ChatGPT、Cursor、VS Code、Gemini、Goose、Zed、Windsurf……截至 2026 年 4 月已有 300 多个客户端。月 SDK 下载量达 1.1 亿。公开服务器超过 10,000 个。Linux 基金会于 2025 年 12 月在新成立的 Agentic AI 基金会下接管了项目的管理。

本阶段使用的规范版本为 **2025-11-25**。该版本新增了异步任务（SEP-1686）、URL 模式的引导（SEP-1036）、结合工具的采样（SEP-1577）、增量范围授权（SEP-835）以及 OAuth 2.1 资源指示语义。阶段 13 · 09 至 16 将涵盖这些扩展。本课仅止于基础内容。

## 核心概念

### 三种服务端原语

1. **工具（Tools）。** 可调用的操作。与阶段 13 · 01 相同的四步循环。
2. **资源（Resources）。** 暴露的数据。通过 URI 可寻址的只读内容：`file:///path`、`db://query/...`、自定义协议。
3. **提示词（Prompts）。** 可复用的模板。在宿主 UI 中以斜杠命令形式呈现；服务器提供模板，客户端填入参数。

### 三种客户端原语

4. **根集（Roots）。** 允许服务器接触的 URI 集合。由客户端声明，服务器遵守。
5. **采样（Sampling）。** 服务器请求客户端的模型执行一次补全。使服务器无需自己的 API 密钥即可运行智能体循环。
6. **引导（Elicitation）。** 服务器在运行过程中请求客户端的用户提供结构化输入。表单或 URL（SEP-1036）。

MCP 中的每一项能力都归属于这六种原语之一。阶段 13 · 10 至 14 将分别深入介绍每种原语。

### 线格式：JSON-RPC 2.0

每条消息都是一个 JSON 对象，包含以下字段：

- 请求：`{jsonrpc: "2.0", id, method, params}`。
- 响应：`{jsonrpc: "2.0", id, result | error}`。
- 通知：`{jsonrpc: "2.0", method, params}`——无 `id`，不期望响应。

基础规范约有 15 个方法，按原语分组。重要的有：

- `initialize` / `initialized`（握手）
- `tools/list`、`tools/call`
- `resources/list`、`resources/read`、`resources/subscribe`
- `prompts/list`、`prompts/get`
- `sampling/createMessage`（服务器到客户端）
- `notifications/tools/list_changed`、`notifications/resources/updated`、`notifications/progress`

### 三阶段生命周期

**阶段 1：初始化（initialize）。**

客户端发送带有其 `capabilities` 和 `clientInfo` 的 `initialize` 请求。服务器以自身的 `capabilities`、`serverInfo` 以及它所支持的规范版本号作为响应。客户端消化完响应后发送 `notifications/initialized` 通知。此后，双方可根据协商好的能力互相发送请求。

**阶段 2：运行（operation）。**

双向通信。客户端调用 `tools/list` 进行发现，然后调用 `tools/call` 执行调用。如果服务器声明了采样能力，它可以发送 `sampling/createMessage` 请求。当工具集发生变化时，服务器可以发送 `notifications/tools/list_changed` 通知。当用户更改根集范围时，客户端可以发送 `notifications/roots/list_changed` 通知。

**阶段 3：关闭（shutdown）。**

任一方关闭传输层。MCP 中没有结构化的关闭方法；传输层（stdio 或 Streamable HTTP，见阶段 13 · 09）负责承载连接终止信号。

### 能力协商

`initialize` 握手中的 `capabilities` 就是协议契约。服务器示例：

```json
{
  "tools": {"listChanged": true},
  "resources": {"subscribe": true, "listChanged": true},
  "prompts": {"listChanged": true}
}
```

服务器声明它能发出 `tools/list_changed` 通知并支持 `resources/subscribe`。客户端通过声明自身能力来同意：

```json
{
  "roots": {"listChanged": true},
  "sampling": {},
  "elicitation": {}
}
```

如果客户端未声明 `sampling`，服务器绝不能调用 `sampling/createMessage`。对称地：如果服务器未声明 `resources.subscribe`，客户端绝不能尝试订阅。

这正是防止生态分化的关键。不支持采样的客户端仍然是合法的 MCP 客户端；不调用 `sampling` 的服务器也仍然是合法的 MCP 服务器。它们只是不在一起使用那个特性而已。

### 结构化内容与错误格式

`tools/call` 返回一个由类型化块组成的 `content` 数组：`text`、`image`、`resource`。阶段 13 · 14 将在此基础上增加 MCP 应用（`ui://` 交互式 UI）。

错误使用 JSON-RPC 错误码。规范新增的定义包括：`-32002`"资源未找到"、`-32603`"内部错误"，以及通过 `error.data` 提供的 MCP 特定错误数据。

### 客户端能力与工具调用细节

一个常见的混淆点：`capabilities.tools` 表示客户端是否支持工具列表变更通知。客户端是否会调用特定工具是运行时的模型决策，而非能力标志。能力标志是规范层面的契约。模型的决策是正交的。

### 为什么用 JSON-RPC 而不是 REST？

JSON-RPC 2.0（2010）是一个轻量级的双向协议。REST 是客户端发起的。MCP 需要服务器主动发起的消息（采样、通知），因此 JSON-RPC 及其对称的请求/响应结构是自然而然的选择。JSON-RPC 还能干净地运行在 stdio 和 WebSocket/Streamable HTTP 之上，无需重新发明 HTTP 的请求结构。

```figure
mcp-tool-call
```

## 动手实践

`code/main.py` 提供了一个极简的 JSON-RPC 2.0 解析与发射器，然后手动执行 `initialize` → `tools/list` → `tools/call` → `shutdown` 序列，打印每条消息。没有真实的传输层；只关注消息结构。请与"延伸阅读"中链接的规范对照，验证每个信封的格式。

观察要点：

- `initialize` 双向声明能力；响应中包含 `serverInfo` 和 `protocolVersion: "2025-11-25"`。
- `tools/list` 返回一个 `tools` 数组；每个条目包含 `name`、`description`、`inputSchema`。
- `tools/call` 使用 `params.name` 和 `params.arguments`。
- 响应的 `content` 是一个由 `{type, text}` 块组成的数组。

## 交付成果

本课产出 `outputs/skill-mcp-handshake-tracer.md`。给定一份类似 pcap 格式的 MCP 客户端-服务器交互记录，该技能会对每条消息进行标注，说明它属于哪种原语、哪个生命周期阶段以及依赖哪项能力。

## 练习题

1. 运行 `code/main.py`。找出能力协商发生在哪一行，并描述如果服务器未声明 `tools.listChanged` 会有什么变化。

2. 扩展解析器以处理 `notifications/progress`。消息结构：`{method: "notifications/progress", params: {progressToken, progress, total}}`。在长时间运行的 `tools/call` 执行过程中发射该消息，并确认客户端处理器能够显示进度条。

3. 从头到尾阅读 MCP 2025-11-25 规范——整份文档约 80 页。找出大多数服务器**不需要**的一项能力标志。提示：与资源订阅有关。

4. 在纸上画出假设的"定时任务"功能应归属哪种原语。（提示：服务器希望客户端在预定时间调用它。目前六种原语都不适合。）MCP 2026 路线图中已有一份草案 SEP 涉及此功能。

5. 解析 GitHub 上一个开源 MCP 服务器的会话日志。统计请求、响应和通知消息的数量。计算生命周期流量与运行时流量各占总量的比例。

## 关键术语

| 术语 | 通常说法 | 实际含义 |
|------|----------|----------|
| MCP | "Model Context Protocol" | 模型与工具之间发现和调用的开放协议 |
| 服务端原语 | "服务器暴露的内容" | 工具（操作）、资源（数据）、提示词（模板） |
| 客户端原语 | "客户端让服务器使用的功能" | 根集（范围）、采样（LLM 回调）、引导（用户输入） |
| JSON-RPC 2.0 | "线格式" | 对称的请求/响应/通知信封 |
| `initialize` 握手 | "能力协商" | 第一对消息；服务器和客户端声明各自支持的特性 |
| `tools/list` | "发现" | 客户端向服务器查询当前工具集 |
| `tools/call` | "调用" | 客户端请求服务器使用指定参数执行某个工具 |
| `notifications/*_changed` | "变更事件" | 服务器通知客户端其原语列表已发生变化 |
| 内容块 | "类型化结果" | 工具结果中的 `{type: "text" \| "image" \| "resource" \| "ui_resource"}` |
| SEP | "规范演进提案" | 已命名的草案提案（例如异步任务的 SEP-1686） |

## 延伸阅读

- [Model Context Protocol — 规范 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — 官方规范文档
- [Model Context Protocol — 架构概念](https://modelcontextprotocol.io/docs/concepts/architecture) — 六种原语的思维模型
- [Anthropic — 介绍 Model Context Protocol](https://www.anthropic.com/news/model-context-protocol) — 2024 年 11 月发布文章
- [MCP 博客 — MCP 一周年](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/) — 一周年回顾及 2025-11-25 规范变更
- [WorkOS — MCP 2025-11-25 规范更新](https://workos.com/blog/mcp-2025-11-25-spec-update) — SEP-1686、1036、1577、835 和 1724 的总结
