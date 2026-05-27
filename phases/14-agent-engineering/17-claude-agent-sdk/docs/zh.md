# Claude Agent SDK：子 Agent 与会话存储

> Claude Agent SDK 是 Claude Code 框架的库形式。内置工具、用于上下文隔离的子 Agent、钩子、W3C 追踪传播、会话存储对等。Claude Managed Agents 是长时间运行异步工作的托管替代方案。

**类型：** 学习与构建
**语言：** Python（标准库）
**前置要求：** 阶段 14 · 01（Agent 循环）、阶段 14 · 10（技能库）
**时长：** 约 75 分钟

## 学习目标

- 解释 Anthropic Client SDK（原始 API）与 Claude Agent SDK（框架形态）之间的区别。
- 描述子 Agent——并行化和上下文隔离——以及何时使用它们。
- 说出 Python SDK 的会话存储表面（`append`、`load`、`list_sessions`、`delete`、`list_subkeys`）以及 `--session-mirror` 的作用。
- 实现一个带有内置工具、带有隔离上下文的子 Agent 生成、生命周期钩子和会话存储的标准库框架。

## 问题背景

原始 LLM API 只能让你进行一次往返。生产 Agent 需要工具执行、MCP 服务器、生命周期钩子、子 Agent 生成、会话持久化、追踪传播。Claude Agent SDK 以库的形式提供这种形态——Claude Code 使用的同一框架，为自定义 Agent 公开。

## 核心概念

### Client SDK vs Agent SDK

- **Client SDK（`anthropic`）。** 原始 Messages API。你拥有循环、工具、状态。
- **Agent SDK（`claude-agent-sdk`）。** 内置工具执行、MCP 连接、钩子、子 Agent 生成、会话存储。作为库的 Claude Code 循环。

### 内置工具

SDK 开箱即用地提供 10+ 工具：文件读/写、shell、grep、glob、网页获取等。自定义工具通过标准工具模式接口注册。

### 子 Agent

Anthropic 记录了两个目的：

1. **并行化。** 并发运行独立工作。"为这 20 个模块中的每个找到测试文件"是 20 个并行子 Agent 任务。
2. **上下文隔离。** 子 Agent 使用自己的上下文窗口；只有结果返回给编排器。编排器的预算得以保留。

Python SDK 最近的添加：`list_subagents()`、`get_subagent_messages()` 用于读取子 Agent 转录。

### 会话存储

与 TypeScript 的协议对等：

- `append(session_id, message)`——添加回合。
- `load(session_id)`——恢复对话。
- `list_sessions()`——枚举。
- `delete(session_id)`——级联到子 Agent 会话。
- `list_subkeys(session_id)`——列出子 Agent 密钥。

`--session-mirror`（CLI 标志）在流式传输时将转录镜像到外部文件，用于调试。

### 钩子

你可以注册的生命周期钩子：

- `PreToolUse`、`PostToolUse`——门控或审计工具调用。
- `SessionStart`、`SessionEnd`——设置和拆解。
- `UserPromptSubmit`——在模型看到之前对用户收入进行操作。
- `PreCompact`——在上下文压缩之前运行。
- `Stop`——Agent 退出时的清理。
- `Notification`——旁路警报。

钩子是 pro-workflow（阶段 14 课程参考）和类似系统添加横切行为的方式。

### W3C 追踪上下文

在调用者上活动的 OTel span 通过 W3C 追踪上下文标头传播到 CLI 子进程。整个多进程追踪在你的后端中显示为一条追踪。

### Claude Managed Agents

托管替代方案（beta 标头 `managed-agents-2026-04-01`）。长时间运行的异步工作、内置提示缓存、内置压缩。用控制换取托管基础设施。

### 这种模式哪里会出错

- **子 Agent 过度生成（Subagent over-spawn）。** 为 100 个微小任务生成 100 个子 Agent。开销占主导。改为批处理。
- **钩子蠕变（Hook creep）。** 每个团队都添加钩子；启动时间膨胀。每季度审查钩子。
- **会话膨胀（Session bloat）。** 会话积累；大小增长。使用 `list_sessions` + 到期策略。

## 构建它

`code/main.py` 在标准库中实现 SDK 形态：

- `Tool`、`ToolRegistry` 带有内置的 `read_file`、`write_file`、`list_dir`。
- `Subagent`——私有上下文、隔离运行、返回结果。
- `SessionStore`——append、load、list、delete、list_subkeys。
- `Hooks`——`pre_tool_use`、`post_tool_use`、`session_start`、`session_end`。
- 一个演示：主 Agent 并行生成 3 个子 Agent（每个隔离），聚合结果，持久化会话。

运行它：

```
python3 code/main.py
```

追踪显示子 Agent 上下文隔离（编排器上下文大小保持有界）、钩子执行和会话持久化。

## 使用它

- **Claude Agent SDK** 用于想要 Claude Code 框架形态的 Claude 优先产品。
- **Claude Managed Agents** 用于托管的长时间运行异步工作。
- **OpenAI Agents SDK**（第 16 课）用于 OpenAI 优先的对应产品。
- **LangGraph + 自定义工具** 如果你想要图形状的状态机。

## 部署它

`outputs/skill-claude-agent-scaffold.md` 搭建一个带有子 Agent、钩子、会话存储、MCP 服务器附加和 W3C 追踪传播的 Claude Agent SDK 应用程序。

## 练习

1. 添加一个子 Agent 生成器，将 20 个任务分批为 5 个并行子 Agent 的组。测量编排器上下文大小与每任务一个的比较。
2. 实现一个 `PreToolUse` 钩子，对 `write_file` 调用进行速率限制（每会话每分钟 5 次）。追踪行为。
3. 将 `list_subkeys` 接入以渲染子 Agent 树。深度嵌套看起来像什么？
4. 将玩具移植到真实的 `claude-agent-sdk` Python 包。工具注册发生了什么变化？
5. 阅读 Claude Managed Agents 文档。你什么时候会从自托管切换到托管？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| Agent SDK | "作为库的 Claude Code" | 框架形态：工具、MCP、钩子、子 Agent、会话存储 |
| Subagent | "子 Agent" | 独立上下文，自己的预算；结果冒泡 |
| Session store | "对话数据库" | 持久化、加载、列出、删除带子 Agent 级联的回合 |
| Hook | "生命周期回调" | 工具前后、会话、提示提交、压缩、停止 |
| W3C trace context | "跨进程追踪" | 父 span 传播到 CLI 子进程 |
| Managed Agents | "托管框架" | Anthropic 托管的长时间运行异步工作 |
| `--session-mirror` | "转录镜像" | 在流式传输时将会话回合写入外部文件 |
| MCP server | "工具表面" | 附加到 Agent 的外部工具/资源源 |

## 延伸阅读

- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview)——Claude Code 的库形式
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)——生产模式
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)——托管替代方案
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/)——对应产品
