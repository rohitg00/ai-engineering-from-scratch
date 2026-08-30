# 10 · MCP 资源与提示——超越工具的上下文暴露

> 工具（Tools）占据了 MCP 90% 的关注度。然而另外两个服务端原语解决的是不同的问题：资源（Resources）暴露供读取的数据；提示（Prompts）将可复用的模板暴露为斜杠命令（slash-command）。许多服务器应当用资源来取代「把读取操作包装进工具」的做法，用提示来取代「在客户端提示里硬编码工作流」的做法。本课将给出这一决策规则，并逐一讲解 `resources/*` 与 `prompts/*` 消息。

**类型：** 构建
**语言：** Python（标准库，资源 + 提示处理器）
**前置：** 第 13 阶段 · 07（MCP 服务器）
**时长：** 约 45 分钟

## 学习目标

- 针对给定领域，在「将能力暴露为工具、资源还是提示」之间做出决策。
- 实现 `resources/list`、`resources/read`、`resources/subscribe`，并处理 `notifications/resources/updated`。
- 实现带参数模板的 `prompts/list` 与 `prompts/get`。
- 识别宿主（host）何时将提示呈现为斜杠命令、何时将其作为自动注入的上下文。

## 问题所在

一个朴素的笔记应用 MCP 服务器会把所有东西都暴露为工具：`notes_read`、`notes_list`、`notes_search`。这等于把每一次数据访问都包装成由模型驱动的工具调用。其后果是：

- 模型必须自己判断：对每一个可能受益于上下文的查询，是否要调用 `notes_read`。
- 只读内容无法被订阅，也无法流式推送到宿主的侧边面板。
- 客户端 UI（Claude Desktop 的资源附加面板、Cursor 的「Include file」选择器）无法呈现这些数据。

正确的切分方式是：把数据暴露为资源，把会产生变更或需要计算的动作暴露为工具，把可复用的多步骤工作流暴露为提示。每种原语都有其专属的 UX 表现形式与访问模式。

## 核心概念

### 工具 vs 资源 vs 提示——决策规则

| 能力 | 原语 |
|------|------|
| 用户想要搜索、过滤或转换数据 | tool |
| 用户想让宿主把这份数据作为上下文纳入 | resource |
| 用户想要一个可反复运行的模板化工作流 | prompt |

经验法则：如果模型在每个相关查询中调用它都能受益，那它是工具。如果用户把它附加到一段对话中能受益，那它是资源。如果用户想复用的单元是一整套多步骤工作流，那它是提示。

### 资源

`resources/list` 返回 `{resources: [{uri, name, mimeType, description?}]}`。`resources/read` 接收 `{uri}`，返回 `{contents: [{uri, mimeType, text | blob}]}`。

URI 可以是任何可寻址的东西：

- `file:///Users/alice/notes/mcp.md`
- `postgres://my-db/query/SELECT ...`
- `notes://note-14`（自定义 scheme）
- `memory://session-2026-04-22/recent`（服务器专有）

`contents[]` 同时支持文本与二进制。二进制使用 `blob`（一个 base64 编码的字符串）外加一个 `mimeType`。

### 资源订阅

在能力声明（capabilities）中声明 `{resources: {subscribe: true}}`。客户端调用 `resources/subscribe {uri}`。当资源发生变化时，服务器发送 `notifications/resources/updated {uri}`。客户端随即重新读取。

应用场景：一个笔记服务器，其资源是磁盘上的文件；文件监视器（file watcher）触发更新通知；当文件在宿主之外被编辑时，Claude Desktop 重新把该文件拉入上下文。

### 资源模板（2025-11-25 新增）

`resourceTemplates` 让你能暴露一个参数化的 URI 模式：`notes://{id}`，其中 `id` 是补全（completion）目标。客户端可在资源选择器中对 id 进行自动补全。

### 提示

`prompts/list` 返回 `{prompts: [{name, description, arguments?}]}`。`prompts/get` 接收 `{name, arguments}`，返回 `{description, messages: [{role, content}]}`。

提示是一个模板，它会被填充成一组消息，由宿主喂给它的模型。例如，一个 `code_review` 提示接收一个 `file_path` 参数，返回一个三条消息的序列：一条 system 消息、一条带文件正文的 user 消息，以及一条带推理模板的 assistant 起头消息。

### 宿主与提示

Claude Desktop、VS Code 和 Cursor 在聊天 UI 中把提示呈现为斜杠命令。用户输入 `/code_review`，并从一个表单中选择参数。服务器的提示就是「用户快捷方式」与「发送给模型的完整提示」之间的契约。

并非每个客户端都已支持提示——请检查能力协商（capability negotiation）。一个声明了提示能力、但客户端不支持提示的服务器，结果就是用户根本看不到这些斜杠命令。

### 「列表已变更」通知

当资源集合或提示集合发生变动时，两者都会发出 `notifications/list_changed`。一个刚刚导入了 20 条新笔记的笔记服务器会发出 `notifications/resources/list_changed`；客户端随即重新调用 `resources/list` 来纳入这些新增内容。

### 内容类型约定

文本：`mimeType: "text/plain"`、`text/markdown`、`application/json`。
二进制：`image/png`、`application/pdf`，外加 `blob` 字段。
MCP Apps（第 14 课）：在 `ui://` URI 中使用 `text/html;profile=mcp-app`。

### 动态资源

资源 URI 不必对应一个静态文件。`notes://recent` 可以在每次读取时返回最新的五条笔记。`db://query/users/active` 可以执行一个参数化查询。服务器可以自由地动态计算内容。

规则：如果客户端可以按 URI 缓存，那 URI 必须是稳定的。如果计算是一次性的，那 URI 应当包含一个时间戳或随机数（nonce），以免客户端缓存变陈旧。

### 订阅 vs 轮询

支持订阅的客户端通过 `notifications/resources/updated` 获得服务器推送。不支持订阅的客户端、或不支持该机制的宿主，则通过重新读取来轮询。两种方式都符合规范。服务器的能力声明会告诉客户端它支持哪一种。

订阅的成本：服务器上每个会话的状态（谁订阅了什么）。要把订阅集合保持在有限范围内；断开连接的客户端应当超时清除。

### 提示 vs 系统提示

MCP 中的提示不是系统提示。宿主的系统提示（它自己的操作指令）与 MCP 提示（服务器提供、由用户调用的模板）并存。行为良好的客户端绝不会让服务器提示覆盖它自己的系统提示；它会把两者分层叠加。

## 动手用

`code/main.py` 在第 07 课的笔记服务器基础上扩展了以下内容：

- 逐条笔记的资源（`notes://note-1` 等），并支持 `resources/subscribe`。
- 一个 `review_note` 提示，它会渲染成一个三条消息的模板。
- 一个文件监视器模拟程序，当某条笔记被修改时发出 `notifications/resources/updated`。
- 一个 `notes://recent` 动态资源，始终返回最新的五条笔记。

运行该演示以查看完整流程。

## 交付物

本课产出 `outputs/skill-primitive-splitter.md`。给定一个拟建的 MCP 服务器，该技能会把每项能力归类为 tool / resource / prompt，并给出理由。

## 练习

1. 运行 `code/main.py`。观察初始的资源列表，然后触发一次笔记编辑，验证 `notifications/resources/updated` 事件会被触发。

2. 添加一个 `resources/list_changed` 发射器：当创建一条新笔记时，发送该通知，让客户端重新发现资源。

3. 为一个 GitHub MCP 服务器设计三个提示：`summarize_pr`、`triage_issue`、`release_notes`。每个都带参数 schema。提示正文应当无需进一步编辑即可运行。

4. 取第 07 课服务器中现有的一个工具，判断它应当保持为工具，还是应当拆分成「资源 + 工具」的一对。用一句话说明理由。

5. 阅读规范的 `server/resources` 与 `server/prompts` 章节。找出 `resources/read` 中那个很少被填充、但规范支持的字段。提示：看一下资源内容上的 `_meta`。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------|----------|
| 资源（Resource） | 「暴露出来的数据」 | 宿主可读取的、可按 URI 寻址的内容 |
| 资源 URI（Resource URI） | 「指向数据的指针」 | 带 scheme 前缀的标识符（`file://`、`notes://` 等） |
| `resources/subscribe` | 「监听变化」 | 由客户端选择开启的、针对特定 URI 的服务器推送更新 |
| `notifications/resources/updated` | 「资源变了」 | 通知客户端某个已订阅资源有了新内容的信号 |
| 资源模板（Resource template） | 「参数化 URI」 | 带补全提示、供宿主选择器使用的 URI 模式 |
| 提示（Prompt） | 「斜杠命令模板」 | 带参数槽的具名多消息模板 |
| 提示参数（Prompt arguments） | 「模板输入」 | 宿主在渲染前收集的带类型参数 |
| `prompts/get` | 「渲染模板」 | 服务器返回填充好的消息列表 |
| 内容块（Content block） | 「带类型的块」 | `{type: text \| image \| resource \| ui_resource}` |
| 斜杠命令 UX（Slash-command UX） | 「用户快捷方式」 | 宿主把提示呈现为以 `/` 开头的命令 |

## 延伸阅读

- [MCP — Concepts: Resources](https://modelcontextprotocol.io/docs/concepts/resources) — 资源 URI、订阅与模板
- [MCP — Concepts: Prompts](https://modelcontextprotocol.io/docs/concepts/prompts) — 提示模板与斜杠命令集成
- [MCP — Server resources spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/resources) — 完整的 `resources/*` 消息参考
- [MCP — Server prompts spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/prompts) — 完整的 `prompts/*` 消息参考
- [MCP — Protocol info site: resources](https://modelcontextprotocol.info/docs/concepts/resources/) — 在官方文档基础上扩展的社区指南
