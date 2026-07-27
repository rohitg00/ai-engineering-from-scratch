# Claude Agent SDK：子代理与会话存储

> Claude Agent SDK 是 Claude Code 框架的库形式。内置工具、用于上下文隔离的子代理、钩子、W3C 追踪传播、会话存储功能对等。Claude Managed Agents 是用于长时间运行异步工作的托管替代方案。

**类型：** 学习 + 构建
**语言：** Python（标准库）
**前置条件：** 阶段 14 · 01（代理循环），阶段 14 · 10（技能库）
**时间：** 约 75 分钟

## 学习目标

- 解释 Anthropic Client SDK（原始 API）与 Claude Agent SDK（框架形态）之间的区别。
- 描述子代理——并行化和上下文隔离——以及何时使用它们。
- 列举 Python SDK 的会话存储接口（`append`、`load`、`list_sessions`、`delete`、`list_subkeys`）以及 `--session-mirror` 的作用。
- 实现一个包含内置工具、子代理生成（带隔离上下文）、生命周期钩子和会话存储的标准库框架。

## 问题

原始的 LLM API 只提供一次往返。生产级代理需要工具执行、MCP 服务器、生命周期钩子、子代理生成、会话持久化和追踪传播。Claude Agent SDK 以库的形式提供了这种框架——即 Claude Code 使用的同一框架，并对外暴露给自定义代理使用。

## 概念

### Client SDK vs Agent SDK

- **Client SDK（`anthropic`）。** 原始 Messages API。循环、工具、状态都由你掌控。
- **Agent SDK（`claude-agent-sdk`）。** 内置工具执行、MCP 连接、钩子、子代理生成、会话存储。Claude Code 循环以库的形式呈现。

### 内置工具

SDK 自带 10 多种开箱即用的工具：文件读写、shell、grep、glob、网页抓取等。自定义工具通过标准工具模式接口注册。

### 子代理

Anthropic 记录了两个用途：

1. **并行化。** 并发运行独立工作。"为这 20 个模块各找测试文件"就是 20 个并行子代理任务。
2. **上下文隔离。** 子代理使用自己的上下文窗口；只有结果返回给编排器。编排器的预算得以保留。

Python SDK 近期新增：`list_subagents()`、`get_subagent_messages()` 用于读取子代理的对话记录。

### 会话存储

与 TypeScript 协议对等：

- `append(session_id, message)` — 添加一轮对话。
- `load(session_id)` — 恢复对话。
- `list_sessions()` — 列举所有会话。
- `delete(session_id)` — 级联删除子代理会话。
- `list_subkeys(session_id)` — 列出子代理键。

`--session-mirror`（CLI 标志）在流式输出时将对话记录镜像到外部文件，用于调试。

### 钩子

可注册的生命周期钩子：

- `PreToolUse`、`PostToolUse` — 门控或审计工具调用。
- `SessionStart`、`SessionEnd` — 设置和清理。
- `UserPromptSubmit` — 在模型看到用户输入之前对其执行操作。
- `PreCompact` — 在上下文压缩之前运行。
- `Stop` — 代理退出时的清理工作。
- `Notification` — 侧信道警报。

钩子是 pro-workflow（阶段 14 课程参考）及类似系统添加横切行为的方式。

### W3C 追踪上下文

调用方上的 OTel 跨度通过 W3C 追踪上下文标头传播到 CLI 子进程中。整个多进程追踪在后端中显示为一个追踪。

### Claude Managed Agents

托管替代方案（beta 标头 `managed-agents-2026-04-01`）。长时间运行的异步工作、内置提示缓存、内置压缩。用控制权换取托管基础设施。

### 这种模式可能出错的地方

- **子代理过度生成。** 为 100 个小任务生成 100 个子代理。开销占主导。应进行批处理。
- **钩子蔓延。** 每个团队都添加钩子；启动时间膨胀。每季度审查一次钩子。
- **会话膨胀。** 会话不断累积；体积增长。使用 `list_sessions` + 过期策略。

## 构建

`code/main.py` 在标准库中实现了 SDK 形态：

- `Tool`、`ToolRegistry` 包含内置的 `read_file`、`write_file`、`list_dir`。
- `Subagent` — 私有上下文、隔离运行、返回结果。
- `SessionStore` — append、load、list、delete、list_subkeys。
- `Hooks` — `pre_tool_use`、`post_tool_use`、`session_start`、`session_end`。
- 一个演示：主代理并行生成 3 个子代理（各自隔离），汇总结果，持久化会话。

运行方式：

```
python3 code/main.py
```

追踪过程会展示子代理上下文隔离（编排器上下文大小保持有界）、钩子执行和会话持久化。

## 使用

- **Claude Agent SDK** 用于希望采用 Claude Code 框架形态的 Claude 优先产品。
- **Claude Managed Agents** 用于托管式的长时间运行异步工作。
- **OpenAI Agents SDK**（第 16 课）用于 OpenAI 优先的对应方案。
- **LangGraph + 自定义工具** 用于希望使用图状状态机的情况。

## 交付

`outputs/skill-claude-agent-scaffold.md` 构建了一个 Claude Agent SDK 应用框架，包含子代理、钩子、会话存储、MCP 服务器连接和 W3C 追踪传播。

## 练习

1. 添加一个子代理生成器，将 20 个任务分批为每组 5 个并行子代理。测量编排器上下文大小与每个任务一个子代理的对比。
2. 实现一个 `PreToolUse` 钩子，对 `write_file` 调用进行限速（每会话每分钟 5 次）。追踪该行为。
3. 使用 `list_subkeys` 渲染子代理树。深层嵌套看起来是什么样的？
4. 将玩具示例移植到真实的 `claude-agent-sdk` Python 包。工具注册有什么变化？
5. 阅读 Claude Managed Agents 文档。什么时候你会从自托管切换到托管？

## 关键术语

| 术语 | 人们说的意思 | 实际含义 |
|------|----------------|------------------------|
| Agent SDK | "Claude Code 以库的形式" | 框架形态：工具、MCP、钩子、子代理、会话存储 |
| Subagent | "子代理" | 独立的上下文，自己的预算；结果向上传递 |
| Session store | "对话数据库" | 持久化、加载、列举、删除对话轮次，支持子代理级联 |
| Hook | "生命周期回调" | 工具前后、会话、提示提交、压缩、停止 |
| W3C trace context | "跨进程追踪" | 父跨度传播到 CLI 子进程 |
| Managed Agents | "托管框架" | Anthropic 托管的长时间运行异步工作 |
| `--session-mirror` | "对话镜像" | 会话轮次流式输出时写入外部文件 |
| MCP server | "工具接口" | 附加到代理的外部工具/资源源 |

## 扩展阅读

- [Claude Agent SDK 概述](https://platform.claude.com/docs/en/agent-sdk/overview) — Claude Code 的库形式
- [Anthropic, 使用 Claude Agent SDK 构建代理](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) — 生产模式
- [Claude Managed Agents 概述](https://platform.claude.com/docs/en/managed-agents/overview) — 托管替代方案
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) — 对应方案
