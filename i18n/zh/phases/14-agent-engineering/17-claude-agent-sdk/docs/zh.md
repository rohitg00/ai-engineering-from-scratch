# 作为库的 Harness —— 子代理与会话存储

> 一个可导入的 harness:内置工具、用于上下文隔离的子代理、钩子、W3C trace 传播、会话持久化。Claude Agent SDK 是参考示例——即 Claude Code harness 的库形态——而 Claude Managed Agents 是面向长时间运行异步任务的托管替代方案。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop)、Phase 14 · 10 (Skill Libraries)
**Time:** 约 75 分钟

## 学习目标

- 解释 Anthropic Client SDK(原始 API)与 Claude Agent SDK(harness 形态)之间的区别。
- 描述子代理——并行化与上下文隔离——以及何时应该使用它们。
- 说出 Python SDK 的会话存储接口(`append`、`load`、`list_sessions`、`delete`、`list_subkeys`)以及 `--session-mirror` 的作用。
- 用标准库实现一个 harness,包含内置工具、上下文隔离的子代理生成、生命周期钩子以及会话存储。

## 问题

原始 LLM API 只能提供一次往返调用。生产级 agent 需要工具执行、MCP 服务器、生命周期钩子、子代理生成、会话持久化、trace 传播。Claude Agent SDK 将这一整套形态作为库交付——与 Claude Code 所用相同的 harness,开放用于自定义 agent。

## 概念

### Client SDK vs Agent SDK

- **Client SDK(`anthropic`)。** 原始 Messages API。循环、工具、状态都由你自己管理。
- **Agent SDK(`claude-agent-sdk`)。** 内置工具执行、MCP 连接、钩子、子代理生成、会话存储。即以库形式呈现的 Claude Code 循环。

### 内置工具

SDK 开箱即提供 10+ 个工具:文件读写、shell、grep、glob、web fetch 等。自定义工具通过标准 tool-schema 接口注册。

### 子代理

Anthropic 文档中记录了两个用途:

1. **并行化。** 并发运行独立任务。“找出这 20 个模块各自的测试文件”就是 20 个并行的子代理任务。
2. **上下文隔离。** 子代理使用自己的上下文窗口;只有结果返回给编排器。编排器的上下文预算得以保留。

Python SDK 近期新增:`list_subagents()`、`get_subagent_messages()`,用于读取子代理 transcript。

### 会话存储

与 TypeScript 协议对齐:

- `append(session_id, message)` —— 添加一轮对话。
- `load(session_id)` —— 恢复对话。
- `list_sessions()` —— 枚举。
- `delete(session_id)` —— 级联删除子代理会话。
- `list_subkeys(session_id)` —— 列出子代理键。

`--session-mirror`(CLI 标志)在流式输出时将 transcript 同步镜像到外部文件,便于调试。

### 钩子

可注册的生命周期钩子:

- `PreToolUse`、`PostToolUse` —— 审查或审计工具调用。
- `SessionStart`、`SessionEnd` —— 建立与清理。
- `UserPromptSubmit` —— 在模型看到用户输入之前对其进行处理。
- `PreCompact` —— 在上下文压缩之前执行。
- `Stop` —— agent 退出时的清理。
- `Notification` —— 旁路告警。

钩子是 pro-workflow(Phase 14 课程参考)及类似系统添加横切行为的方式。

### W3C trace context

调用方活跃的 OTel span 通过 W3C trace context 头部传播到 CLI 子进程。整个多进程 trace 在你的后端中显示为一条 trace。

### Claude Managed Agents

托管替代方案(beta header `managed-agents-2026-04-01`)。长时间运行的异步任务、内置提示缓存、内置压缩。以控制权换取托管基础设施。

### 这种模式的常见误区

- **子代理过度生成。** 为 100 个小任务生成 100 个子代理。开销占主导。应改为批量处理。
- **钩子蔓延。** 每个团队都加钩子;启动时间暴涨。应每季度评审钩子。
- **会话膨胀。** 会话不断累积;体积增长。使用 `list_sessions` + 过期策略。

```figure
ae-subagent-isolation
```

## 动手构建

`code/main.py` 用标准库实现 SDK 形态:

- `Tool`、`ToolRegistry`,内置 `read_file`、`write_file`、`list_dir`。
- `Subagent` —— 私有上下文、隔离运行、返回结果。
- `SessionStore` —— append、load、list、delete、list_subkeys。
- `Hooks` —— `pre_tool_use`、`post_tool_use`、`session_start`、`session_end`。
- 一个演示:主 agent 并行生成 3 个子代理(各自隔离),聚合结果,并持久化会话。

运行它:

```
python3 code/main.py
```

trace 会展示子代理上下文隔离(编排器上下文大小保持有界)、钩子执行以及会话持久化。

## 使用场景

- **Claude Agent SDK** —— 适用于希望获得 Claude Code harness 形态的 Claude 优先产品。
- **Claude Managed Agents** —— 适用于托管的长时间运行异步任务。
- **OpenAI Agents SDK**(Lesson 16)—— OpenAI 优先的对应方案。
- **LangGraph + 自定义工具** —— 如果你想要图结构的状态机。

## 上线部署

`outputs/skill-claude-agent-scaffold.md` 脚手架可搭建一个带子代理、钩子、会话存储、MCP 服务器挂载以及 W3C trace 传播的 Claude Agent SDK 应用。

## 练习

1. 添加一个子代理生成器,将 20 个任务分批为每组 5 个并行子代理。对比编排器上下文大小与每任务一个子代理的方案。
2. 实现一个 `PreToolUse` 钩子,对 `write_file` 调用做速率限制(每个会话每分钟 5 次)。追踪该行为。
3. 接入 `list_subkeys` 来渲染子代理树。深层嵌套看起来是什么样的?
4. 将这个玩具实现移植到真正的 `claude-agent-sdk` Python 包。工具注册会有什么变化?
5. 阅读 Claude Managed Agents 文档。什么时候你会从自托管切换到托管?

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| Agent SDK | “作为库的 Claude Code” | Harness 形态:工具、MCP、钩子、子代理、会话存储 |
| Subagent | “子 agent” | 独立上下文、独立预算;结果向上冒泡 |
| Session store | “对话数据库” | 持久化、加载、列出、删除对话轮次,并支持子代理级联 |
| Hook | “生命周期回调” | 工具前/后、会话、提示提交、压缩、停止 |
| W3C trace context | “跨进程 trace” | 父 span 传播到 CLI 子进程 |
| Managed Agents | “托管的 harness” | Anthropic 托管的长时间运行异步任务 |
| `--session-mirror` | “transcript 镜像” | 在会话轮次流式输出时将其写入外部文件 |
| MCP server | “工具接口” | 挂载到 agent 上的外部工具/资源来源 |

## 延伸阅读

- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) —— Claude Code 的库形态
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) —— 生产级模式
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) —— 托管替代方案
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) —— 对应方案