# MCP Resources 与 Prompts —— 工具之外的上下文暴露方式

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> MCP 的关注点 90% 都落在 tools 上，但服务端另外两种 primitive（原语）解决的是不同的问题。Resources 把数据暴露出来供读取；prompts 把可复用模板以 slash-command 的形式暴露出来。很多服务器本应该用 resource 而不是把读操作包成 tool，本应该用 prompt 而不是把工作流硬编码进客户端 prompt。本课讲清楚这条决策规则，并走一遍 `resources/*` 和 `prompts/*` 消息。

**Type:** Build
**Languages:** Python (stdlib, resource + prompt handler)
**Prerequisites:** Phase 13 · 07 (MCP server)
**Time:** ~45 minutes

## 学习目标（Learning Objectives）

- 给定一个领域的能力，能够判断它该作为 tool、resource 还是 prompt 暴露。
- 实现 `resources/list`、`resources/read`、`resources/subscribe`，并处理 `notifications/resources/updated`。
- 实现带参数模板的 `prompts/list` 和 `prompts/get`。
- 识别 host 把 prompt 暴露为 slash-command 还是自动注入上下文这两种不同形态。

## 问题（The Problem）

一个朴素的笔记应用 MCP 服务器，会把所有东西都暴露成 tool：`notes_read`、`notes_list`、`notes_search`。这意味着每一次数据访问都得包成一次模型驱动的 tool 调用。后果是：

- 模型每次遇到可能需要上下文的查询，都得自己决定要不要去调 `notes_read`。
- 只读内容没法被订阅，也没法被推送到 host 的侧边栏。
- 客户端 UI（Claude Desktop 的资源附件面板、Cursor 的 “Include file” 选择器）无法把这些数据呈现出来。

正确的拆分方式是：把数据暴露为 resource，把会改状态或要计算的动作暴露为 tool，把可复用的多步工作流暴露为 prompt。每种 primitive 都有自己的 UX 用法和访问模式。

## 概念（The Concept）

### Tools、resources、prompts —— 决策规则

| 能力 | 用哪种 primitive |
|------|-----------|
| 用户想搜索、过滤或转换数据 | tool |
| 用户希望 host 把这份数据当作上下文带进来 | resource |
| 用户想要一个可以反复运行的模板化工作流 | prompt |

经验法则：如果模型在每个相关查询里都该调一下它，那它是 tool。如果用户想把它附加到一段对话里，那它是 resource。如果用户想复用的单元是一整段多步工作流，那它是 prompt。

### Resources

`resources/list` 返回 `{resources: [{uri, name, mimeType, description?}]}`。`resources/read` 接收 `{uri}`，返回 `{contents: [{uri, mimeType, text | blob}]}`。

URI 可以是任何可寻址的东西：

- `file:///Users/alice/notes/mcp.md`
- `postgres://my-db/query/SELECT ...`
- `notes://note-14`（自定义 scheme）
- `memory://session-2026-04-22/recent`（服务器特定）

`contents[]` 同时支持文本和二进制。二进制用 `blob` 字段（base64 编码字符串）外加 `mimeType`。

### Resource 订阅

在 capability 中声明 `{resources: {subscribe: true}}`。客户端调用 `resources/subscribe {uri}`。资源变化时服务器发 `notifications/resources/updated {uri}`。客户端再去重新读取。

典型场景：一个把磁盘文件当 resource 的笔记服务器；文件监听器触发更新通知；当文件在 host 之外被改动时，Claude Desktop 把它重新拉回上下文。

### Resource 模板（2025-11-25 新增）

`resourceTemplates` 让你能暴露一个参数化的 URI 模式：`notes://{id}`，其中 `id` 是 completion 目标。客户端可以在资源选择器里对 id 做自动补全。

### Prompts

`prompts/list` 返回 `{prompts: [{name, description, arguments?}]}`。`prompts/get` 接收 `{name, arguments}`，返回 `{description, messages: [{role, content}]}`。

一个 prompt 就是一个模板，会渲染成 host 喂给模型的那一串消息。比如一个 `code_review` prompt 接收 `file_path` 参数，返回三条消息组成的序列：一条 system message、一条带文件正文的 user message、一条带推理模板的 assistant 起手消息。

### Host 与 prompts

Claude Desktop、VS Code、Cursor 都会把 prompt 暴露成聊天 UI 里的 slash-command。用户敲 `/code_review`，再从一个表单里选参数。服务器的 prompt 就是 “用户快捷方式” 与 “最终送给模型的完整 prompt” 之间的契约。

并不是每个客户端都已经支持 prompt —— 看 capability 协商。如果服务器声明了 prompt 能力但客户端不支持，那这些 slash-command 就不会显示出来。

### “list changed” 通知

resources 和 prompts 在集合发生变化时都会发 `notifications/list_changed`。一个刚导入了 20 条新笔记的笔记服务器会发 `notifications/resources/list_changed`，客户端就会重新调用 `resources/list` 把新增的拉过来。

### 内容类型约定

文本类：`mimeType: "text/plain"`、`text/markdown`、`application/json`。
二进制类：`image/png`、`application/pdf`，搭配 `blob` 字段。
MCP Apps（第 14 课）：`ui://` URI 配合 `text/html;profile=mcp-app`。

### 动态 resource

一个 resource URI 不一定要对应静态文件。`notes://recent` 可以在每次读取时返回最近的五条笔记。`db://query/users/active` 可以执行一条参数化查询。服务器完全可以动态计算内容。

规则：如果客户端会按 URI 缓存，那 URI 必须稳定。如果计算是一次性的，URI 里就该带上时间戳或 nonce，避免客户端缓存陈旧。

### 订阅 vs 轮询

支持订阅的客户端通过 `notifications/resources/updated` 接收服务器推送。不支持订阅的客户端或 host 则通过反复读取来轮询。两种都是合规的。服务器的 capability 声明会告诉客户端自己支持哪一种。

订阅的代价：服务器要保存每个 session 的状态（谁订阅了什么）。订阅集合要有上限；断连的客户端应该有超时机制。

### Prompts 与 system prompt

MCP 里的 prompt 不是 system prompt。host 自己的 system prompt（host 自身的运行指令）和 MCP prompt（用户调用的服务器模板）是并列共存的。一个守规矩的客户端绝不会让服务器的 prompt 覆盖自己的 system prompt；而是把它们叠加起来。

## 用起来（Use It）

`code/main.py` 在第 07 课的笔记服务器基础上扩展出：

- 每条笔记一个 resource（`notes://note-1` 等），并支持 `resources/subscribe`。
- 一个 `review_note` prompt，渲染成三条消息的模板。
- 一个文件监听器模拟，笔记被修改时发出 `notifications/resources/updated`。
- 一个 `notes://recent` 动态 resource，永远返回最近五条笔记。

跑一下 demo 看完整流程。

## 上线部署（Ship It）

本课产出 `outputs/skill-primitive-splitter.md`。给定一个待设计的 MCP 服务器，这个 skill 会把每个能力分类为 tool / resource / prompt，并附上理由。

## 练习（Exercises）

1. 跑 `code/main.py`。先看初始的 resource list，然后触发一次笔记编辑，确认 `notifications/resources/updated` 事件被发出来。

2. 增加一个 `resources/list_changed` emitter：当新笔记被创建时，发出该通知，让客户端重新发现。

3. 为一个 GitHub MCP 服务器设计三个 prompt：`summarize_pr`、`triage_issue`、`release_notes`。每个都要带参数 schema。prompt 正文应当不需要再编辑就能直接运行。

4. 拿第 07 课服务器里现有的一个 tool，分析它是该继续作为 tool，还是应该拆成 resource 加 tool 的组合。用一句话说明理由。

5. 读 spec 的 `server/resources` 和 `server/prompts` 章节。找出 `resources/read` 中那个虽然 spec 支持但很少被填充的字段。提示：看一下 resource content 上的 `_meta`。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际是什么 |
|------|----------------|------------------------|
| Resource | “暴露的数据” | host 可读取的、URI 可寻址的内容 |
| Resource URI | “指向数据的指针” | 带 scheme 前缀的标识符（`file://`、`notes://` 等） |
| `resources/subscribe` | “监听变化” | 客户端 opt-in、服务器对特定 URI 主动推送更新 |
| `notifications/resources/updated` | “Resource 变了” | 通知客户端：被订阅的 resource 有新内容 |
| Resource 模板 | “参数化 URI” | 带 completion 提示的 URI 模式，供 host 选择器使用 |
| Prompt | “Slash-command 模板” | 命名的、带参数槽的多消息模板 |
| Prompt arguments | “模板输入” | host 在渲染前收集的、有类型的参数 |
| `prompts/get` | “渲染模板” | 服务器返回填充好的消息列表 |
| Content block | “带类型的内容块” | `{type: text \| image \| resource \| ui_resource}` |
| Slash-command UX | “用户快捷方式” | host 把 prompt 呈现为以 `/` 开头的命令 |

## 延伸阅读（Further Reading）

- [MCP — Concepts: Resources](https://modelcontextprotocol.io/docs/concepts/resources) —— resource URI、订阅与模板
- [MCP — Concepts: Prompts](https://modelcontextprotocol.io/docs/concepts/prompts) —— prompt 模板与 slash-command 集成
- [MCP — Server resources spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/resources) —— `resources/*` 完整消息参考
- [MCP — Server prompts spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/prompts) —— `prompts/*` 完整消息参考
- [MCP — Protocol info site: resources](https://modelcontextprotocol.info/docs/concepts/resources/) —— 在官方文档之上的社区指南
