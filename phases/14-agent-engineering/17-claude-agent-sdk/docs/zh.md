# Claude Agent SDK：subagent 与 session store

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Claude Agent SDK 是 Claude Code 这套 harness 的库形态。自带工具、用于上下文隔离的 subagent、hook、W3C trace 传播、与 session store 的协议对齐。Claude Managed Agents 则是托管版本，用于跑长时间的异步任务。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 10 (Skill Libraries)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 解释 Anthropic Client SDK（裸 API）和 Claude Agent SDK（harness 形态）的区别。
- 描述 subagent —— 并行化与上下文隔离 —— 以及什么时候该用它们。
- 说出 Python SDK 的 session store 接口（`append`、`load`、`list_sessions`、`delete`、`list_subkeys`）以及 `--session-mirror` 的作用。
- 用 stdlib 实现一个 harness：包含自带工具、带隔离上下文的 subagent 派生、生命周期 hook 和 session store。

## 问题（The Problem）

裸 LLM API 只能给你跑一个 round-trip。生产级 agent 需要的是：工具执行、MCP server、生命周期 hook、subagent 派生、session 持久化、trace 传播。Claude Agent SDK 把这套形态做成了库 —— 和 Claude Code 用的是同一套 harness，开放给你写自定义 agent。

## 概念（The Concept）

### Client SDK 与 Agent SDK 的区别（Client SDK vs Agent SDK）

- **Client SDK（`anthropic`）。** 裸 Messages API。loop、工具、状态都你自己管。
- **Agent SDK（`claude-agent-sdk`）。** 自带工具执行、MCP 连接、hook、subagent 派生、session store。Claude Code 的 loop 以库的形式开放出来。

### 自带工具（Built-in tools）

SDK 开箱就带 10+ 个工具：文件读写、shell、grep、glob、web fetch 等等。自定义工具通过标准的 tool-schema 接口注册。

### Subagent（Subagents）

Anthropic 文档里写了两个用途：

1. **并行化（Parallelization）。** 把彼此独立的工作并发跑。"给这 20 个模块各找一份测试文件" 就是 20 个并行 subagent 任务。
2. **上下文隔离（Context isolation）。** 每个 subagent 用自己的 context window，只把结果返回给 orchestrator。orchestrator 自己的预算被保住了。

Python SDK 最近新增了：`list_subagents()`、`get_subagent_messages()`，用来读 subagent 的 transcript。

### Session store（Session store）

与 TypeScript 协议对齐：

- `append(session_id, message)` —— 追加一轮对话。
- `load(session_id)` —— 恢复会话。
- `list_sessions()` —— 列出全部 session。
- `delete(session_id)` —— 级联删除 subagent 的 session。
- `list_subkeys(session_id)` —— 列出 subagent 的 key。

`--session-mirror`（CLI flag）会把 transcript 在流式过程中同步写到一个外部文件，方便调试。

### Hook（Hooks）

可注册的生命周期 hook：

- `PreToolUse`、`PostToolUse` —— 拦截或审计工具调用。
- `SessionStart`、`SessionEnd` —— 启动和收尾。
- `UserPromptSubmit` —— 在模型看到用户输入之前先做点处理。
- `PreCompact` —— 在 context 做 compaction（压缩）之前跑。
- `Stop` —— agent 退出时清理。
- `Notification` —— 旁路提醒通道。

Hook 就是 pro-workflow（Phase 14 课程引用过）这类系统加横切行为的方式。

### W3C trace context（W3C trace context）

调用方激活的 OTel span 通过 W3C trace context header 传到 CLI 子进程里。整条跨进程的 trace 在你的后端会显示成一条 trace。

### Claude Managed Agents（Claude Managed Agents）

托管版本（beta header `managed-agents-2026-04-01`）。长时间异步任务、自带 prompt caching、自带 compaction。用控制权换托管基建。

### 这套模式什么时候会跑歪（Where this pattern goes wrong）

- **Subagent 过度派生。** 100 个小任务派 100 个 subagent，开销直接吃掉收益。批起来跑。
- **Hook 蔓延。** 每个团队都往里加 hook，启动时间开始膨胀。每季度复审一次 hook。
- **Session 膨胀。** session 越攒越多、体积越来越大。用 `list_sessions` 配合过期策略来管。

## 动手实现（Build It）

`code/main.py` 用 stdlib 把 SDK 的形态实现了一遍：

- `Tool`、`ToolRegistry`，自带 `read_file`、`write_file`、`list_dir`。
- `Subagent` —— 私有 context、隔离运行、把结果返回。
- `SessionStore` —— append、load、list、delete、list_subkeys。
- `Hooks` —— `pre_tool_use`、`post_tool_use`、`session_start`、`session_end`。
- 一个 demo：主 agent 并行派 3 个 subagent（各自隔离），聚合结果，把 session 持久化。

跑一下：

```
python3 code/main.py
```

trace 里会看到 subagent 的上下文隔离（orchestrator 的 context 大小被限定住）、hook 的执行、以及 session 的持久化。

## 用起来（Use It）

- **Claude Agent SDK** 适合那些想要 Claude Code harness 形态、并以 Claude 为主的产品。
- **Claude Managed Agents** 适合托管的长时异步任务。
- **OpenAI Agents SDK**（Lesson 16）是 OpenAI 那一侧的对应物。
- **LangGraph + 自定义工具** 如果你想要图状态机那种形态。

## 上线部署（Ship It）

`outputs/skill-claude-agent-scaffold.md` 脚手架出一个 Claude Agent SDK app，包含 subagent、hook、session store、MCP server 接入、以及 W3C trace 传播。

## 练习（Exercises）

1. 写一个 subagent spawner，把 20 个任务分成 5 个一组的并行 subagent 跑。对比一对一派 subagent 和这种批处理方式下 orchestrator 的 context 大小。
2. 实现一个 `PreToolUse` hook，对 `write_file` 调用做限流（每个 session 每分钟 5 次）。把行为 trace 出来。
3. 把 `list_subkeys` 接到一个 subagent 树的渲染上。深度嵌套长什么样？
4. 把这个 toy 移植到真正的 `claude-agent-sdk` Python 包。工具注册的方式有什么变化？
5. 读 Claude Managed Agents 的文档。什么场景下你会从自托管切到托管？

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent SDK | "Claude Code as a library" | Harness 形态：工具、MCP、hook、subagent、session store |
| Subagent | "Child agent" | 独立 context、自己的预算；结果向上冒泡 |
| Session store | "Conversation DB" | 持久化、加载、列出、删除对话轮，含 subagent 级联 |
| Hook | "Lifecycle callback" | tool 前后、session、prompt 提交、compact、stop |
| W3C trace context | "Cross-process trace" | 父 span 传播到 CLI 子进程 |
| Managed Agents | "Hosted harness" | Anthropic 托管的长时异步任务 |
| `--session-mirror` | "Transcript mirror" | 在 session 流式进行时把每轮写到外部文件 |
| MCP server | "Tool surface" | 接到 agent 上的外部工具 / 资源源 |

## 延伸阅读（Further Reading）

- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) —— Claude Code 的库形态
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) —— 生产模式
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) —— 托管版本
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) —— 对应物
