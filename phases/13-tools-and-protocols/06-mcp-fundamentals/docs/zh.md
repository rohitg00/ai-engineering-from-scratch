# 06 · MCP 基础 —— 原语、生命周期与 JSON-RPC 基础

> 在 MCP 之前，每一次集成都是一次性的。「模型上下文协议（Model Context Protocol，MCP）」由 Anthropic 于 2024 年 11 月首次发布，如今由 Linux 基金会旗下的 Agentic AI Foundation 托管，它对发现与调用进行了标准化，使得任何客户端都能与任何服务器通信。2025-11-25 版规范定义了六个原语（三个服务器端、三个客户端）、一个三阶段生命周期，以及一种 JSON-RPC 2.0 线格式。掌握这些，本阶段 MCP 章节余下的内容就只是阅读而已。

**类型：** 学习
**语言：** Python（标准库，JSON-RPC 解析器）
**前置：** 第 13 阶段 · 01 到 05（工具接口与函数调用）
**时长：** 约 45 分钟

## 学习目标

- 说出全部六个 MCP 原语（服务器端的 tools、resources、prompts；客户端的 roots、sampling、elicitation），并为每个给出一个用例。
- 走通三阶段生命周期（initialize、operation、shutdown），并说明每个阶段由哪一方发送哪条消息。
- 解析并生成 JSON-RPC 2.0 的请求（request）、响应（response）和通知（notification）信封。
- 解释 `initialize` 时的「能力协商（capability negotiation）」是什么，以及缺了它会出什么问题。

## 问题所在

在 MCP 之前，每一个使用工具的智能体都有自己的协议。Cursor 有一套形似 MCP 但不兼容的工具系统。Claude Desktop 自带的是另一套。VS Code 的 Copilot 扩展又有第三套。一个团队若构建了一个「Postgres 查询」工具，就得把同一个工具写三遍，每遍针对不同宿主（host）的 API。要复用它，只能复制代码。

结果便是一次性集成的「寒武纪大爆发」，以及生态发展速度的天花板。

MCP 通过标准化线格式解决了这个问题。一个 MCP 服务器在每一个 MCP 客户端中都能工作：Claude Desktop、ChatGPT、Cursor、VS Code、Gemini、Goose、Zed、Windsurf——到 2026 年 4 月已有 300 多个客户端。每月 SDK 下载量达 1.1 亿次。公开服务器超过 1 万个。2025 年 12 月，Linux 基金会在新成立的 Agentic AI Foundation 之下接管了托管工作。

本阶段所用的规范修订版为 **2025-11-25**。它新增了异步「任务（Tasks）」（SEP-1686）、URL 模式的 elicitation（SEP-1036）、带工具的 sampling（SEP-1577）、增量作用域同意（incremental scope consent，SEP-835），以及 OAuth 2.1 资源指示符（resource-indicator）语义。第 13 阶段 · 09 到 16 会讲这些扩展。本课只讲到基础部分为止。

## 核心概念

### 三个服务器端原语

1. **Tools（工具）。** 可调用的动作。与第 13 阶段 · 01 中相同的四步循环。
2. **Resources（资源）。** 暴露出来的数据。只读内容，可通过 URI 寻址：`file:///path`、`db://query/...`、自定义 scheme。
3. **Prompts（提示）。** 可复用的模板。在宿主 UI 中表现为斜杠命令（slash-command）；服务器提供模板，客户端填入参数。

### 三个客户端原语

4. **Roots（根）。** 服务器被允许触及的 URI 集合。客户端声明它们；服务器遵守它们。
5. **Sampling（采样）。** 服务器请求客户端的模型来执行一次补全（completion）。使得服务器托管的智能体循环无需服务器端 API 密钥即可运行。
6. **Elicitation（征询）。** 服务器在执行过程中向客户端的用户索取结构化输入。可以是表单或 URL（SEP-1036）。

MCP 中的每一项能力都恰好归属于这六者之一。第 13 阶段 · 10 到 14 会逐一深入讲解。

### 线格式：JSON-RPC 2.0

每条消息都是一个 JSON 对象，包含以下字段：

- 请求：`{jsonrpc: "2.0", id, method, params}`。
- 响应：`{jsonrpc: "2.0", id, result | error}`。
- 通知：`{jsonrpc: "2.0", method, params}` —— 没有 `id`，不期待响应。

基础规范约有 15 个方法，按原语分组。重要的有：

- `initialize` / `initialized`（握手）
- `tools/list`、`tools/call`
- `resources/list`、`resources/read`、`resources/subscribe`
- `prompts/list`、`prompts/get`
- `sampling/createMessage`（服务器到客户端）
- `notifications/tools/list_changed`、`notifications/resources/updated`、`notifications/progress`

### 三阶段生命周期

**阶段 1：initialize（初始化）。**

客户端发送 `initialize`，附带它的 `capabilities` 与 `clientInfo`。服务器以自己的 `capabilities`、`serverInfo` 以及它所支持的规范版本作答。客户端消化完响应后发送 `notifications/initialized`。自此之后，任意一方都可以按协商好的能力发送请求。

**阶段 2：operation（运行）。**

双向通信。客户端调用 `tools/list` 进行发现，再用 `tools/call` 进行调用。如果服务器声明了相应能力，它可以发送 `sampling/createMessage`。当工具集发生变动时，服务器可以发送 `notifications/tools/list_changed`。当用户更改根作用域时，客户端可以发送 `notifications/roots/list_changed`。

**阶段 3：shutdown（关闭）。**

任意一方关闭传输（transport）。MCP 中没有结构化的关闭方法；由传输层（stdio 或 Streamable HTTP，第 13 阶段 · 09）来承载连接结束信号。

### 能力协商

`initialize` 握手中的 `capabilities` 就是契约。来自服务器的示例：

```json
{
  "tools": {"listChanged": true},
  "resources": {"subscribe": true, "listChanged": true},
  "prompts": {"listChanged": true}
}
```

该服务器声明它能够发出 `tools/list_changed` 通知，并支持 `resources/subscribe`。客户端则通过声明自己的能力来达成约定：

```json
{
  "roots": {"listChanged": true},
  "sampling": {},
  "elicitation": {}
}
```

如果客户端没有声明 `sampling`，服务器就绝不能调用 `sampling/createMessage`。对称地：如果服务器没有声明 `resources.subscribe`，客户端就不能尝试订阅。

正是这一点防止了生态漂移。一个不支持 sampling 的客户端仍然是合法的 MCP 客户端；一个不调用 `sampling` 的服务器仍然是合法的 MCP 服务器。它们只是不在这个特性上协同使用而已。

### 结构化内容与错误形态

`tools/call` 返回一个 `content` 数组，其中是带类型的内容块：`text`、`image`、`resource`。第 13 阶段 · 14 会向该列表新增 MCP Apps（`ui://` 交互式 UI）。

错误使用 JSON-RPC 错误码。规范定义的新增项有：`-32002`「Resource not found」、`-32603`「Internal error」，外加作为 `error.data` 的 MCP 特定错误数据。

### 客户端能力 vs 工具调用细节

一个常见的混淆：`capabilities.tools` 表示的是客户端是否支持「工具列表已变更」的通知。而客户端是否会真的去调用某个特定工具，则是由它的模型驱动的运行时选择，并非一个能力标志。能力标志是规范层面的契约；模型的选择与之正交。

### 为什么用 JSON-RPC 而不是 REST？

JSON-RPC 2.0（2010 年）是一种轻量级的双向协议。REST 是由客户端发起的。MCP 需要由服务器发起的消息（sampling、通知），因此具有对称请求/响应形态的 JSON-RPC 自然契合。JSON-RPC 还能干净地叠加在 stdio 与 WebSocket/Streamable HTTP 之上，无需重新发明 HTTP 的请求形态。

## 动手用它

`code/main.py` 提供了一个极简的 JSON-RPC 2.0 解析器与生成器，然后手工走一遍 `initialize` → `tools/list` → `tools/call` → `shutdown` 的序列，打印出每一条消息。没有真实的传输；只有消息形态。请与「延伸阅读」中链接的规范对照，校验每个信封。

需要重点看的：

- `initialize` 在两个方向上都声明能力；响应中含有 `serverInfo` 和 `protocolVersion: "2025-11-25"`。
- `tools/list` 返回一个 `tools` 数组；每一项含有 `name`、`description`、`inputSchema`。
- `tools/call` 使用 `params.name` 和 `params.arguments`。
- 响应中的 `content` 是一个由 `{type, text}` 块组成的数组。

## 交付它

本课产出 `outputs/skill-mcp-handshake-tracer.md`。给定一份 pcap 风格的 MCP 客户端—服务器交互记录，该技能（skill）会为每条消息标注它属于哪个原语、处于哪个生命周期阶段，以及它依赖于哪项能力。

## 练习

1. 运行 `code/main.py`。找出能力协商发生的那一行，并描述如果服务器没有声明 `tools.listChanged` 会有什么不同。

2. 扩展解析器以处理 `notifications/progress`。消息形态为：`{method: "notifications/progress", params: {progressToken, progress, total}}`。在一个长时间运行的 `tools/call` 进行过程中发出它，并确认客户端处理逻辑能够显示进度条。

3. 从头到尾通读 MCP 2025-11-25 规范——整份文档约 80 页。找出大多数服务器都不需要的那一个能力标志。提示：它与资源订阅有关。

4. 在纸上勾画一下，一个假设的「定时任务（cron job）」特性会归属于哪个原语。（提示：服务器希望客户端在某个预定时间调用它。今天的六个原语都不契合。）MCP 的 2026 年路线图中有一份针对此问题的草案 SEP。

5. 解析 GitHub 上某个开源 MCP 服务器的一份会话日志。统计请求、响应、通知三类消息各有多少条。计算流量中有多大比例属于生命周期，又有多大比例属于运行阶段。

## 关键术语

| 术语 | 人们怎么说 | 它实际是什么 |
|------|----------------|------------------------|
| MCP | 「模型上下文协议」 | 用于模型到工具的发现与调用的开放协议 |
| 服务器端原语 | 「服务器暴露的东西」 | tools（动作）、resources（数据）、prompts（模板） |
| 客户端原语 | 「客户端让服务器使用的东西」 | roots（作用域）、sampling（LLM 回调）、elicitation（用户输入） |
| JSON-RPC 2.0 | 「线格式」 | 对称的请求/响应/通知信封 |
| `initialize` 握手 | 「能力协商」 | 第一对消息；服务器与客户端声明各自支持的特性 |
| `tools/list` | 「发现」 | 客户端向服务器索取其当前的工具集 |
| `tools/call` | 「调用」 | 客户端请求服务器带参数执行某个工具 |
| `notifications/*_changed` | 「变动事件」 | 服务器告知客户端其原语列表已发生变化 |
| 内容块（Content block） | 「带类型的结果」 | 工具结果中的 `{type: "text" \| "image" \| "resource" \| "ui_resource"}` |
| SEP | 「规范演进提案（Spec Evolution Proposal）」 | 具名的草案提案（例如用于异步 Tasks 的 SEP-1686） |

## 延伸阅读

- [Model Context Protocol — Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) —— 权威规范文档
- [Model Context Protocol — Architecture concepts](https://modelcontextprotocol.io/docs/concepts/architecture) —— 六原语思维模型
- [Anthropic — Introducing the Model Context Protocol](https://www.anthropic.com/news/model-context-protocol) —— 2024 年 11 月的发布文章
- [MCP blog — First MCP anniversary](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/) —— 一周年回顾与 2025-11-25 规范变更
- [WorkOS — MCP 2025-11-25 spec update](https://workos.com/blog/mcp-2025-11-25-spec-update) —— SEP-1686、1036、1577、835 与 1724 的摘要
