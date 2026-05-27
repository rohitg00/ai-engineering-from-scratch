# MCP 资源和提示词 — 工具之外的上下文暴露

> 工具获得了 90% 的 MCP 关注度。其他两个服务器原语解决不同的问题。资源（Resources）暴露供读取的数据；提示词（Prompts）将可重用的模板作为斜杠命令暴露。许多服务器应该使用资源而不是将读取包装在工具中，使用提示词而不是在客户端提示词中硬编码工作流。本课命名决策规则并演练 `resources/*` 和 `prompts/*` 消息。

**类型：** 构建
**语言：** Python (stdlib, 资源和提示词处理器)
**前置条件：** 阶段 13 · 07 (MCP 服务器)
**时间：** ~45 分钟

## 学习目标

- 根据给定的领域决定是将能力暴露为工具、资源还是提示词。
- 实现 `resources/list`、`resources/read`、`resources/subscribe` 并处理 `notifications/resources/updated`。
- 实现带参数模板的 `prompts/list` 和 `prompts/get`。
- 识别宿主何时将提示词作为斜杠命令暴露，何时作为自动注入的上下文。

## 问题背景

一个笔记应用的幼稚 MCP 服务器将所有内容都暴露为工具：`notes_read`、`notes_list`、`notes_search`。这将每次数据访问都包装在模型驱动的工具调用中。后果：

- 模型必须决定是否为每个可能从上下文中受益的查询调用 `notes_read`。
- 只读内容无法被订阅或流式传输到宿主的侧边栏。
- 客户端 UI（Claude Desktop 的资源附件、Cursor 的"包含文件"选择器）无法暴露数据。

正确的拆分：将数据暴露为资源，将变更或计算操作暴露为工具，将可重用的多步骤工作流暴露为提示词。每个原语都有其 UX 启示和其访问模式。

## 概念详解

### 工具 vs 资源 vs 提示词 — 决策规则

| 能力 | 原语 |
|------|------|
| 用户想要搜索、过滤或转换数据 | 工具 |
| 用户想要宿主将此数据作为上下文包含 | 资源 |
| 用户想要可以重新运行的有模板工作流 | 提示词 |

指导原则：如果模型会从在每个相关查询中调用它而受益，那就是工具。如果用户会从将会话附加到对话中而受益，那就是资源。如果整个多步骤工作流是用户想要重用的单元，那就是提示词。

### 资源

`resources/list` 返回 `{resources: [{uri, name, mimeType, description?}]}`。`resources/read` 接受 `{uri}` 并返回 `{contents: [{uri, mimeType, text | blob}]}`。

URI 可以是任何可寻址的东西：

- `file:///Users/alice/notes/mcp.md`
- `postgres://my-db/query/SELECT ...`
- `notes://note-14`（自定义方案）
- `memory://session-2026-04-22/recent`（服务器特定）

`contents[]` 支持文本和二进制。二进制使用 `blob` 作为 base64 编码的字符串加上 `mimeType`。

### 资源订阅

在能力中声明 `{resources: {subscribe: true}}`。客户端调用 `resources/subscribe {uri}`。当资源发生变化时，服务器发送 `notifications/resources/updated {uri}`。客户端重新读取。

使用案例：一个资源是磁盘文件的笔记服务器；文件监视器触发更新通知；Claude Desktop 在宿主外部编辑时重新拉取文件到上下文中。

### 资源模板（2025-11-25 新增）

`resourceTemplates` 允许你暴露参数化的 URI 模式：`notes://{id}`，其中 `id` 作为补全目标。客户端可以在资源选择器中自动补全 ID。

### 提示词

`prompts/list` 返回 `{prompts: [{name, description, arguments?}]}`。`prompts/get` 接受 `{name, arguments}` 并返回 `{description, messages: [{role, content}]}`。

提示词是一个模板，填充为宿主馈送给其模型的消息列表。例如，一个 `code_review` 提示词接受一个 `file_path` 参数并返回一个三消息序列：一个系统消息、一个包含文件主体的用户消息，以及一个带有推理模板的助手启动消息。

### 宿主和提示词

Claude Desktop、VS Code 和 Cursor 在聊天 UI 中将提示词作为斜杠命令暴露。用户键入 `/code_review` 并从表单中选择参数。服务器的提示词是"用户快捷方式"和"发送给模型的完整提示词"之间的契约。

并非每个客户端都支持提示词 — 检查能力协商。声明了提示词能力但客户端没有提示词支持的服务器将看不到斜杠命令。

### "列表已更改"通知

当集合发生变更时，资源和提示词都会发出 `notifications/list_changed`。刚导入 20 个新笔记的笔记服务器发出 `notifications/resources/list_changed`；客户端重新调用 `resources/list` 以获取新增内容。

### 内容类型约定

对于文本：`mimeType: "text/plain"`、`text/markdown`、`application/json`。
对于二进制：`image/png`、`application/pdf`，加上 `blob` 字段。
对于 MCP 应用（第 14 课）：`text/html;profile=mcp-app` 在 `ui://` URI 中。

### 动态资源

资源 URI 不必对应于静态文件。`notes://recent` 可以在每次读取时返回最新的五条笔记。`db://query/users/active` 可以执行参数化查询。服务器可以自由地动态计算内容。

规则：如果客户端可以按 URI 缓存，URI 必须稳定。如果计算是一次性的，URI 应该包含时间戳或随机数，以便客户端缓存不会过时。

### 订阅 vs 轮询

支持订阅的客户端通过 `notifications/resources/updated` 获得服务器推送。不支持它的预订阅客户端或宿主通过重新读取来轮询。两者都符合规范。服务器的能力声明告诉客户端它支持哪种。

订阅的成本：服务器上的每会话状态（谁订阅了什么）。保持订阅集合有界；断开连接的客户端应该超时。

### 提示词 vs 系统提示词

MCP 中的提示词不是系统提示词。宿主的系统提示词（它自己的操作指令）和 MCP 提示词（由用户调用的服务器提供的模板）并排存在。行为良好的客户端永远不会让服务器提示词覆盖它自己的系统提示词；它分层它们。

## 使用示例

`code/main.py` 从第 07 课的笔记服务器扩展而来，包含：

- 每笔记资源（`notes://note-1` 等），支持 `resources/subscribe`。
- 一个渲染为三消息模板的 `review_note` 提示词。
- 当笔记被修改时发出 `notifications/resources/updated` 的文件监视器模拟。
- 一个始终返回最新五条笔记的 `notes://recent` 动态资源。

运行演示以查看完整流程。

## 实战输出

本课生成 `outputs/skill-primitive-splitter.md`。给定一个提议的 MCP 服务器，该技能将每个能力分类为工具/资源/提示词，并附上理由。

## 练习

1. 运行 `code/main.py`。观察初始资源列表，然后触发笔记编辑并验证 `notifications/resources/updated` 事件被触发。

2. 添加 `resources/list_changed` 发射器：当创建新笔记时，发送通知以便客户端重新发现。

3. 为 GitHub MCP 服务器设计三个提示词：`summarize_pr`、`triage_issue`、`release_notes`。每个都带参数模式。提示词主体应该可以在不进一步编辑的情况下运行。

4. 取第 07 课服务器中的一个现有工具，并分类它应该保持为工具还是拆分为资源加工具对。用一句话证明。

5. 阅读规范的 `server/resources` 和 `server/prompts` 部分。识别 `resources/read` 中一个很少被填充但规范支持的字段。提示：查看资源内容上的 `_meta`。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| 资源 | "暴露的数据" | 宿主可以读取的 URI 可寻址内容 |
| 资源 URI | "数据指针" | 带方案前缀的标识符（`file://`、`notes://` 等） |
| `resources/subscribe` | "监视变更" | 客户端选择加入的特定 URI 的服务器推送更新 |
| `notifications/resources/updated` | "资源已更改" | 向客户端发出订阅资源有新内容的信号 |
| 资源模板 | "参数化 URI" | 带宿主选择器的补全提示的 URI 模式 |
| 提示词 | "斜杠命令模板" | 带参数槽的命名多消息模板 |
| 提示词参数 | "模板输入" | 宿主在渲染之前收集的类型化参数 |
| `prompts/get` | "渲染模板" | 服务器返回填充的消息列表 |
| 内容块 | "类型化块" | `{type: text | image | resource | ui_resource}` |
| 斜杠命令 UX | "用户快捷方式" | 宿主将提示词作为以 `/` 开头的命令暴露 |

## 延伸阅读

- [MCP — 概念：资源](https://modelcontextprotocol.io/docs/concepts/resources) — 资源 URI、订阅和模板
- [MCP — 概念：提示词](https://modelcontextprotocol.io/docs/concepts/prompts) — 提示词模板和斜杠命令集成
- [MCP — 服务器资源规范 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/resources) — 完整的 `resources/*` 消息参考
- [MCP — 服务器提示词规范 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/prompts) — 完整的 `prompts/*` 消息参考
- [MCP — 协议信息站点：资源](https://modelcontextprotocol.info/docs/concepts/resources/) — 扩展官方文档的社区指南
