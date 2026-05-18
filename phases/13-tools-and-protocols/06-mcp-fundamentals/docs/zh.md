# MCP 基础——原语、生命周期、JSON-RPC 基础

> MCP 之前的每个集成都是一次性的。模型上下文协议由 Anthropic 于 2024 年 11 月首次发布，现由 Linux 基金会的 Agentic AI 基金会管理，它标准化了发现和调用，使任何客户端都能与任何服务器通信。2025-11-25 规范命名了六个原语（三个服务器端，三个客户端端）、一个三阶段生命周期和一个 JSON-RPC 2.0 线格式。学会这些，Phase 13 的其余 MCP 章节就变成了阅读。

**类型：** Learn
**语言：** Python（stdlib，JSON-RPC 解析器）
**前置知识：** Phase 13 · 01 到 05（工具接口和函数调用）
**时间：** ~45 分钟

## 学习目标

- 命名所有六个 MCP 原语（服务器端：工具、资源、提示；客户端端：根、采样、引导）并各给一个用例。
- 走过三阶段生命周期（初始化、操作、关闭）并说明每个阶段谁发送哪个消息。
- 解析和发出 JSON-RPC 2.0 请求、响应和通知信封。
- 解释 `initialize` 时的能力协商是什么以及没有它会破坏什么。

## 问题所在

MCP 之前，每个使用工具的代理都有自己的协议。Cursor 有一个 MCP 形状但不兼容的工具系统。Claude Desktop 发布了不同的一个。VS Code 的 Copilot 扩展有第三个。构建"Postgres 查询"工具的团队写了三次相同的工具，每次针对不同的宿主 API。重用它需要复制代码。

结果是寒武纪大爆发式的一次性集成和生态系统速度的天花板。

MCP 通过标准化线格式修复了这一点。单个 MCP 服务器在每个 MCP 客户端中工作：Claude Desktop、ChatGPT、Cursor、VS Code、Gemini、Goose、Zed、Windsurf，到 2026 年 4 月有 300+ 客户端。每月 1.1 亿次 SDK 下载。10,000+ 公共服务器。Linux 基金会于 2025 年 12 月在新 Agentic AI 基金会下接管管理。

本阶段使用的规范版本是 **2025-11-25**。它添加了异步任务（SEP-1686）、URL 模式引导（SEP-1036）、带工具的采样（SEP-1577）、增量范围同意（SEP-835）和 OAuth 2.1 资源指示符语义。Phase 13 · 09 到 16 涵盖这些扩展。本课止于基础。

## 核心概念

### 三个服务器原语

1. **工具。** 可调用动作。与 Phase 13 · 01 相同的四步循环。
2. **资源。** 暴露的数据。通过 URI 可寻址的只读内容：`file:///path`、`db://query/...`、自定义方案。
3. **提示。** 可重用模板。宿主 UI 中的斜杠命令；服务器提供模板，客户端填充参数。

### 三个客户端原语

4. **根。** 服务器允许触碰的 URI 集合。客户端声明它们；服务器尊重它们。
5. **采样。** 服务器请求客户端的模型执行补全。使服务器托管的代理循环无需服务器端 API 密钥。
6. **引导。** 服务器在飞行中请求客户端用户提供结构化输入。表单或 URL（SEP-1036）。

MCP 中的每个能力恰好属于这六个之一。Phase 13 · 10 到 14 深入涵盖每个。

### 线格式：JSON-RPC 2.0

每个消息都是带这些字段的 JSON 对象：

- 请求：`{jsonrpc: "2.0", id, method, params}`。
- 响应：`{jsonrpc: "2.0", id, result | error}`。
- 通知：`{jsonrpc: "2.0", method, params}` — 无 `id`，不期望响应。

基础规范有约 15 个方法，按原语分组。重要的：

- `initialize` / `initialized`（握手）
- `tools/list`、`tools/call`
- `resources/list`、`resources/read`、`resources/subscribe`
- `prompts/list`、`prompts/get`
- `sampling/createMessage`（服务器到客户端）
- `notifications/tools/list_changed`、`notifications/resources/updated`、`notifications/progress`

### 三阶段生命周期

**阶段 1：初始化。**

客户端发送 `initialize` 及其 `capabilities` 和 `clientInfo`。服务器用其自己的 `capabilities`、`serverInfo` 和它使用的规范版本响应。客户端在消化响应后发送 `notifications/initialized`。从此，任一方都可以按协商的能力发送请求。

**阶段 2：操作。**

双向。客户端调用 `tools/list` 发现，然后 `tools/call` 调用。如果服务器声明了该能力，它可以发送 `sampling/createMessage`。当工具集变化时，服务器可以发送 `notifications/tools/list_changed`。当用户更改根范围时，客户端可以发送 `notifications/roots/list_changed`。

**阶段 3：关闭。**

任一方关闭传输。MCP 中没有结构化关闭方法；传输（stdio 或可流式 HTTP，Phase 13 · 09）携带连接结束信号。

### 能力协商

`initialize` 握手时的 `capabilities` 是契约。来自服务器的示例：

```json
{
  "tools": {"listChanged": true},
  "resources": {"subscribe": true, "listChanged": true},
  "prompts": {"listChanged": true}
}
```

服务器声明它可以发出 `tools/list_changed` 通知并支持 `resources/subscribe`。客户端通过声明自己的来同意：

```json
{
  "roots": {"listChanged": true},
  "sampling": {},
  "elicitation": {}
}
```

如果客户端不声明 `sampling`，服务器不得调用 `sampling/createMessage`。对称地：如果服务器不声明 `resources.subscribe`，客户端不得尝试订阅。

这就是防止生态系统漂移的原因。不支持采样的客户端仍然是有效的 MCP 客户端；不调用 `sampling` 的服务器仍然是有效的 MCP 服务器。它们只是不一起使用该功能。

### 结构化内容和错误形状

`tools/call` 返回 `content` 数组，包含类型化块：`text`、`image`、`resource`。Phase 13 · 14 将 MCP 应用（`ui://` 交互式 UI）添加到该列表。

错误使用 JSON-RPC 错误代码。规范定义的附加项：`-32002` "资源未找到"、`-32603` "内部错误"，加上 MCP 特定的错误数据作为 `error.data`。

### 客户端能力 vs 工具调用细节

常见混淆：`capabilities.tools` 是客户端是否支持工具列表更改通知。客户端是否会调用特定工具是由其模型驱动的运行时选择，而非能力标志。能力标志是规范级契约。模型的选择是正交的。

### 为什么用 JSON-RPC 而非 REST？

JSON-RPC 2.0（2010）是一个轻量级双向协议。REST 是客户端发起的。MCP 需要服务器发起的消息（采样、通知），因此 JSON-RPC 及其对称的请求/响应形状是自然选择。JSON-RPC 也可以在 stdio 和 WebSocket/可流式 HTTP 上干净组合，无需重新发明 HTTP 的请求形状。

## 使用它

`code/main.py` 发布一个最小 JSON-RPC 2.0 解析器和发出器，然后手动走过 `initialize` → `tools/list` → `tools/call` → `shutdown` 序列，打印每个消息。无真实传输；只有消息形状。与延伸阅读中链接的规范比较以验证每个信封。

看点：

- `initialize` 双向声明能力；响应有 `serverInfo` 和 `protocolVersion: "2025-11-25"`。
- `tools/list` 返回 `tools` 数组；每个条目有 `name`、`description`、`inputSchema`。
- `tools/call` 使用 `params.name` 和 `params.arguments`。
- 响应 `content` 是 `{type, text}` 块的数组。

## 交付它

本课产出 `outputs/skill-mcp-handshake-tracer.md`。给定 MCP 客户端-服务器交互的 pcap 风格转录，该技能用每个消息属于哪个原语、哪个生命周期阶段以及依赖哪个能力来注释它。

## 练习

1. 运行 `code/main.py`。识别能力协商发生的行并描述如果服务器不声明 `tools.listChanged` 会发生什么变化。

2. 扩展解析器以处理 `notifications/progress`。消息形状：`{method: "notifications/progress", params: {progressToken, progress, total}}`。在长时间运行的 `tools/call` 进行中发出它并确认客户端处理程序会显示进度条。

3. 从头到尾阅读 MCP 2025-11-25 规范——整个文档约 80 页。识别大多数服务器不需要的一个能力标志。提示：它与资源订阅有关。

4. 在纸上草拟一个假设"cron 作业"功能所属的原语。（提示：服务器希望客户端在预定时间调用它。今天的六个原语都不适合。）MCP 的 2026 年路线图对此有一个草案 SEP。

5. 解析 GitHub 上一个开放 MCP 服务器的会话日志。统计请求 vs 响应 vs 通知消息。计算生命周期流量占总流量的比例。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| MCP | "模型上下文协议" | 模型到工具发现和调用的开放协议 |
| 服务器原语 | "服务器暴露的内容" | 工具（动作）、资源（数据）、提示（模板） |
| 客户端原语 | "客户端让服务器使用的内容" | 根（范围）、采样（LLM 回调）、引导（用户输入） |
| JSON-RPC 2.0 | "线格式" | 对称的请求/响应/通知信封 |
| `initialize` 握手 | "能力协商" | 第一条消息对；服务器和客户端声明它们支持的功能 |
| `tools/list` | "发现" | 客户端询问服务器当前工具集 |
| `tools/call` | "调用" | 客户端要求服务器用参数执行工具 |
| `notifications/*_changed` | "变更事件" | 服务器告诉客户端其原语列表已更改 |
| 内容块 | "类型化结果" | 工具结果中的 `{type: "text" \| "image" \| "resource" \| "ui_resource"}` |
| SEP | "规范演进提案" | 命名草案提案（例如 SEP-1686 用于异步任务） |

## 延伸阅读

- [模型上下文协议 — 规范 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — 规范文档
- [模型上下文协议 — 架构概念](https://modelcontextprotocol.io/docs/concepts/architecture) — 六个原语的心智模型
- [Anthropic — 引入模型上下文协议](https://www.anthropic.com/news/model-context-protocol) — 2024 年 11 月发布帖子
- [MCP 博客 — 第一个 MCP 周年](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/) — 一周年回顾和 2025-11-25 规范变更
- [WorkOS — MCP 2025-11-25 规范更新](https://workos.com/blog/mcp-2025-11-25-spec-update) — SEP-1686、1036、1577、835 和 1724 的摘要
