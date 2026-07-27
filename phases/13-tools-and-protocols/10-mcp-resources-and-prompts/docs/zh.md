# MCP 资源与提示 — 超越工具的上下文暴露

> 工具获得了 MCP 90% 的关注度。另外两种服务器原语解决不同的问题。资源暴露数据供读取；提示将可复用的模板暴露为斜杠命令。许多服务器应当使用资源而非将读取操作包裹在工具中，使用提示而非将工作流硬编码在客户端提示里。本课给出了决策规则，并详解 `resources/*` 和 `prompts/*` 消息。

**类型：** 构建
**语言：** Python（标准库，资源 + 提示处理器）
**前置条件：** 阶段 13 · 07（MCP 服务器）
**时长：** 约 45 分钟

## 学习目标

- 针对某个领域，判断应将一项能力暴露为工具、资源还是提示。
- 实现 `resources/list`、`resources/read`、`resources/subscribe` 并处理 `notifications/resources/updated`。
- 实现 `prompts/list` 和 `prompts/get`，支持带参数的模板。
- 识别宿主是将提示作为斜杠命令还是自动注入的上下文呈现。

## 问题

一个为笔记应用设计的简陋 MCP 服务器将所有功能都暴露为工具：`notes_read`、`notes_list`、`notes_search`。这将每次数据访问都包裹在由模型驱动的工具调用中。后果：

- 对于每个可能受益于上下文的查询，模型都必须决定是否调用 `notes_read`。
- 只读内容无法被订阅或被推送到宿主的侧面板。
- 客户端 UI（Claude Desktop 的资源附件面板、Cursor 的"包含文件"选择器）无法展示数据。

正确的划分：将数据暴露为**资源**，将可变操作或计算操作暴露为**工具**，将可复用的多步骤工作流暴露为**提示**。每种原语都有自己的 UX 交互方式和访问模式。

## 概念

### 工具 vs 资源 vs 提示 — 决策规则

| 能力 | 原语 |
|------------|-----------|
| 用户想要搜索、筛选或转换数据 | 工具 |
| 用户希望宿主将这些数据作为上下文包含进来 | 资源 |
| 用户想要一个可重复运行的模板化工作流 | 提示 |

指南：如果模型在每个相关查询上都可能受益于调用它，那就是工具。如果用户会受益于将某个内容附加到对话中，那就是资源。如果整个多步骤工作流是用户希望复用的单元，那就是提示。

### 资源

`resources/list` 返回 `{resources: [{uri, name, mimeType, description?}]}`。`resources/read` 接收 `{uri}` 并返回 `{contents: [{uri, mimeType, text \| blob}]}`。

URI 可以是任何可寻址的内容：

- `file:///Users/alice/notes/mcp.md`
- `postgres://my-db/query/SELECT ...`
- `notes://note-14`（自定义协议）
- `memory://session-2026-04-22/recent`（服务器特定）

`contents[]` 同时支持文本和二进制。二进制使用 `blob` 作为 Base64 编码的字符串，外加 `mimeType`。

### 资源订阅

在 capabilities 中声明 `{resources: {subscribe: true}}`。客户端调用 `resources/subscribe {uri}`。当资源发生变化时，服务器发送 `notifications/resources/updated {uri}`。客户端重新读取。

使用场景：一个资源是磁盘上文件的笔记服务器，文件监控器触发更新通知；当在宿主之外编辑文件时，Claude Desktop 会将文件重新拉入上下文。

### 资源模板（2025-11-25 新增）

`resourceTemplates` 允许你暴露参数化的 URI 模式：`notes://{id}`，其中 `id` 是补全目标。客户端可以在资源选择器中自动补全 id。

### 提示

`prompts/list` 返回 `{prompts: [{name, description, arguments?}]}`。`prompts/get` 接收 `{name, arguments}` 并返回 `{description, messages: [{role, content}]}`。

提示是一个模板，它会填充成宿主提供给模型的消息列表。例如，`code_review` 提示接收一个 `file_path` 参数，返回一个三条消息的序列：一条系统消息、一条包含文件正文的用户消息，以及一条带有推理模板的助手开场消息。

### 宿主与提示

Claude Desktop、VS Code 和 Cursor 将提示作为斜杠命令暴露在聊天 UI 中。用户输入 `/code_review` 然后从表单中选择参数。服务器的提示是"用户快捷方式"与"发送给模型的完整提示"之间的契约。

并非所有客户端都支持提示——请检查能力协商。如果服务器声明了提示能力但客户端不支持，斜杠命令将不会显示。

### "列表已更改"通知

资源和提示在集合发生变更时都会发送 `notifications/list_changed`。刚导入了 20 条新笔记的笔记服务器会发送 `notifications/resources/list_changed`，然后客户端重新调用 `resources/list` 来获取新增内容。

### 内容类型约定

对于文本：`mimeType: "text/plain"`、`text/markdown`、`application/json`。
对于二进制：`image/png`、`application/pdf`，加上 `blob` 字段。
对于 MCP 应用（第 14 课）：在 `ui://` URI 中使用 `text/html;profile=mcp-app`。

### 动态资源

资源 URI 不必对应静态文件。`notes://recent` 可以在每次读取时返回最新的五条笔记。`db://query/users/active` 可以执行带参数的查询。服务器可以自由地动态计算内容。

规则：如果客户端可以按 URI 缓存，那么 URI 必须是稳定的。如果计算是一次性的，URI 应包含时间戳或随机值，以防止客户端缓存过期。

### 订阅 vs 轮询

支持订阅的客户端通过 `notifications/resources/updated` 获得服务器推送。不支持订阅的客户端或宿主通过重新读取来轮询。两者都符合规范。服务器的能力声明告诉客户端它支持哪种方式。

订阅的成本：服务器上维护每个会话的状态（谁订阅了什么）。保持订阅集合在可控范围内；断开的客户端应超时。

### 提示 vs 系统提示

MCP 中的提示不是系统提示。宿主的系统提示（其自身的操作指令）与 MCP 提示（由服务器提供、用户调用的模板）并存。一个好的客户端永远不会让服务器提示覆盖其自身的系统提示，而是将它们分层组合。

## 使用它

`code/main.py` 在第 07 课的笔记服务器基础上扩展了以下功能：

- 每条笔记的资源（`notes://note-1` 等），支持 `resources/subscribe`。
- 一个 `review_note` 提示，渲染为三条消息的模板。
- 一个文件监控器模拟，当笔记被修改时发送 `notifications/resources/updated`。
- 一个 `notes://recent` 动态资源，始终返回最新的五条笔记。

运行演示以查看完整流程。

## 输出产物

本课产出 `outputs/skill-primitive-splitter.md`。给定一个提议的 MCP 服务器，该技能将每项能力分类为工具/资源/提示，并附上理由。

## 练习

1. 运行 `code/main.py`。观察初始资源列表，然后触发一次笔记编辑，验证 `notifications/resources/updated` 事件被触发。

2. 添加一个 `resources/list_changed` 发送器：当创建新笔记时，发送通知以便客户端重新发现资源。

3. 为 GitHub MCP 服务器设计三个提示：`summarize_pr`、`triage_issue`、`release_notes`。每个提示都带参数模式。提示正文应无需进一步编辑即可运行。

4. 为第 07 课服务器中的一个现有工具进行分类，判断它应保持为工具还是拆分为资源加工具的组合。用一句话说明理由。

5. 阅读规范中的 `server/resources` 和 `server/prompts` 部分。找出 `resources/read` 中很少被填充但规范支持的一个字段。提示：查看资源内容上的 `_meta`。

## 关键术语

| 术语 | 常被说成 | 实际含义 |
|------|----------------|------------------------|
| Resource（资源） | "暴露的数据" | 宿主可以读取的、可通过 URI 寻址的内容 |
| Resource URI（资源 URI） | "指向数据的指针" | 带协议前缀的标识符（`file://`、`notes://` 等） |
| `resources/subscribe` | "监听变化" | 客户端自愿加入的、针对特定 URI 的服务器推送更新 |
| `notifications/resources/updated` | "资源已更改" | 通知客户端某个已订阅的资源有新内容 |
| Resource template（资源模板） | "参数化 URI" | 带有补全提示的 URI 模式，供宿主选择器使用 |
| Prompt（提示） | "斜杠命令模板" | 带有参数槽位的命名多消息模板 |
| Prompt arguments（提示参数） | "模板输入" | 宿主在渲染前收集的带类型参数 |
| `prompts/get` | "渲染模板" | 服务器返回填充好的消息列表 |
| Content block（内容块） | "带类型的数据块" | `{type: text \| image \| resource \| ui_resource}` |
| Slash-command UX（斜杠命令 UX） | "用户快捷方式" | 宿主将提示展示为以 `/` 开头的命令 |

## 延伸阅读

- [MCP — 概念：资源](https://modelcontextprotocol.io/docs/concepts/resources) — 资源 URI、订阅和模板
- [MCP — 概念：提示](https://modelcontextprotocol.io/docs/concepts/prompts) — 提示模板和斜杠命令集成
- [MCP — 服务器资源规范 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/resources) — `resources/*` 消息完整参考
- [MCP — 服务器提示规范 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/prompts) — `prompts/*` 消息完整参考
- [MCP — 协议信息站：资源](https://modelcontextprotocol.info/docs/concepts/resources/) — 基于官方文档扩展的社区指南
