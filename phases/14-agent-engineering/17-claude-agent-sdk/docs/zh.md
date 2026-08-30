# 17 · Claude Agent SDK：子智能体与会话存储

> Claude Agent SDK 是 Claude Code 框架（harness）的库化形态。内置工具、用于上下文隔离的子智能体（subagents）、钩子（hooks）、W3C 链路追踪传播、与会话存储的协议对等。Claude 托管智能体（Claude Managed Agents）则是面向长时异步任务的托管替代方案。

**类型：** 学习 + 实战
**语言：** Python（标准库）
**前置：** 阶段 14 · 01（智能体循环 Agent Loop）、阶段 14 · 10（技能库 Skill Libraries）
**时长：** 约 75 分钟

## 学习目标

- 解释 Anthropic 客户端 SDK（Client SDK，原始 API）与 Claude Agent SDK（框架形态）之间的区别。
- 描述子智能体——并行化与上下文隔离——以及何时该用它们。
- 说出 Python SDK 的会话存储接口（`append`、`load`、`list_sessions`、`delete`、`list_subkeys`）及 `--session-mirror` 的作用。
- 用标准库实现一个框架：带内置工具、可生成隔离上下文的子智能体、生命周期钩子，以及会话存储。

## 问题所在

原始 LLM API 只能给你一次往返调用。而一个生产级智能体需要工具执行、MCP 服务器、生命周期钩子、子智能体生成、会话持久化与链路追踪传播。Claude Agent SDK 把这套形态以库的形式交付出来——正是 Claude Code 所用的同一套框架，开放给自定义智能体使用。

## 核心概念

### 客户端 SDK vs. Agent SDK

- **客户端 SDK（`anthropic`）。** 原始的 Messages API。循环、工具、状态都由你自己负责。
- **Agent SDK（`claude-agent-sdk`）。** 内置工具执行、MCP 连接、钩子、子智能体生成、会话存储。即 Claude Code 循环的库化形态。

### 内置工具

SDK 开箱即带 10 余种工具：文件读/写、shell、grep、glob、网页抓取等。自定义工具通过标准的工具 schema 接口注册。

### 子智能体

Anthropic 记录的两个用途：

1. **并行化。** 并发执行相互独立的工作。"为这 20 个模块各找出对应的测试文件"就是 20 个并行的子智能体任务。
2. **上下文隔离。** 子智能体使用各自独立的上下文窗口；只有结果会返回给编排者（orchestrator）。编排者的预算因而得以保留。

Python SDK 近期新增：`list_subagents()`、`get_subagent_messages()`，用于读取子智能体的对话记录（transcript）。

### 会话存储

与 TypeScript 协议对等：

- `append(session_id, message)`——追加一轮对话。
- `load(session_id)`——恢复会话。
- `list_sessions()`——枚举会话。
- `delete(session_id)`——级联删除其子智能体会话。
- `list_subkeys(session_id)`——列出子智能体键。

`--session-mirror`（CLI 标志）会在对话流式产生时，将其镜像写入一个外部文件，便于调试。

### 钩子

可注册的生命周期钩子：

- `PreToolUse`、`PostToolUse`——对工具调用做拦截或审计。
- `SessionStart`、`SessionEnd`——会话的初始化与收尾。
- `UserPromptSubmit`——在模型看到用户输入之前对其进行处理。
- `PreCompact`——在上下文压缩（compaction）之前运行。
- `Stop`——智能体退出时的清理。
- `Notification`——旁路告警。

钩子正是 pro-workflow（阶段 14 课程参考）及类似系统添加横切行为（cross-cutting behavior）的途径。

### W3C 链路追踪上下文

调用方上活跃的 OTel span 会通过 W3C 链路追踪上下文头部传播进 CLI 子进程。整条跨进程链路在你的后端中呈现为同一条 trace。

### Claude 托管智能体

托管的替代方案（beta 头 `managed-agents-2026-04-01`）。面向长时异步任务，内置提示缓存（prompt caching）、内置压缩。以让渡控制权换取托管基础设施。

### 这一模式的常见翻车点

- **子智能体过度生成。** 为 100 个琐碎任务各生成一个子智能体共 100 个。开销占主导。应改为批处理。
- **钩子蔓延。** 每个团队都往里加钩子；启动时间膨胀。每季度审查一次钩子。
- **会话膨胀。** 会话不断累积，体积持续增长。使用 `list_sessions` 配合过期策略。

## 动手实现

`code/main.py` 用标准库实现了 SDK 的形态：

- `Tool`、`ToolRegistry`，并内置 `read_file`、`write_file`、`list_dir`。
- `Subagent`——私有上下文、隔离运行、返回结果。
- `SessionStore`——append、load、list、delete、list_subkeys。
- `Hooks`——`pre_tool_use`、`post_tool_use`、`session_start`、`session_end`。
- 一个演示：主智能体并行生成 3 个子智能体（各自隔离），聚合结果，并持久化会话。

运行：

```
python3 code/main.py
```

该 trace 展示了子智能体的上下文隔离（编排者上下文大小保持有界）、钩子执行，以及会话持久化。

## 何时使用

- **Claude Agent SDK**：适用于希望采用 Claude Code 框架形态的 Claude 优先产品。
- **Claude 托管智能体**：适用于托管的长时异步任务。
- **OpenAI Agents SDK**（第 16 课）：OpenAI 优先的对应方案。
- **LangGraph + 自定义工具**：若你想要的是图状态机（graph-shaped state machine）形态。

## 交付物

`outputs/skill-claude-agent-scaffold.md` 用于脚手架式生成一个 Claude Agent SDK 应用，包含子智能体、钩子、会话存储、MCP 服务器挂载，以及 W3C 链路追踪传播。

## 练习

1. 添加一个子智能体生成器，把 20 个任务分批为每组 5 个并行子智能体。对比每任务一个子智能体时，编排者上下文大小的差异。
2. 实现一个 `PreToolUse` 钩子，对 `write_file` 调用限流（每会话每分钟 5 次）。追踪其行为。
3. 接入 `list_subkeys` 以渲染一棵子智能体树。深层嵌套看起来是什么样？
4. 把这个玩具实现移植到真实的 `claude-agent-sdk` Python 包上。工具注册有哪些变化？
5. 阅读 Claude 托管智能体文档。在什么情况下你会从自托管切换到托管？

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| Agent SDK | "库化的 Claude Code" | 框架形态：工具、MCP、钩子、子智能体、会话存储 |
| 子智能体（Subagent） | "子智能体" | 独立上下文、独立预算；结果向上冒泡返回 |
| 会话存储（Session store） | "对话数据库" | 持久化、加载、列举、删除对话轮，并级联处理子智能体 |
| 钩子（Hook） | "生命周期回调" | 工具前/后、会话、提示提交、压缩、停止 |
| W3C 链路追踪上下文 | "跨进程追踪" | 父 span 传播进 CLI 子进程 |
| 托管智能体（Managed Agents） | "托管框架" | Anthropic 托管的长时异步任务 |
| `--session-mirror` | "对话记录镜像" | 在会话轮流式产生时将其写入一个外部文件 |
| MCP 服务器 | "工具面" | 挂载到智能体上的外部工具/资源来源 |

## 延伸阅读

- [Claude Agent SDK 概览](https://platform.claude.com/docs/en/agent-sdk/overview) —— Claude Code 的库化形态
- [Anthropic，《用 Claude Agent SDK 构建智能体》](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) —— 生产模式
- [Claude 托管智能体概览](https://platform.claude.com/docs/en/managed-agents/overview) —— 托管替代方案
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) —— 对应方案
