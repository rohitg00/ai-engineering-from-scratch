---
name: claude-agent-scaffold
description: 搭建 Claude Agent SDK 应用，包含子代理、生命周期钩子、会话存储、MCP 服务器附件和 W3C 跟踪传播。
version: 1.0.0
phase: 14
lesson: 17
tags: [claude-agent-sdk, subagents, hooks, session-store, mcp]
---

给定产品领域和 MCP 服务器列表，搭建 Claude Agent SDK 应用。

生成：

1. 主代理定义，带有 instructions、内置工具访问（read_file、write_file、shell、grep、glob、web fetch）和自定义功能工具。
2. 用于并行化和上下文隔离的子代理生成器。当 orchestrator 否则会超出其上下文预算时使用。
3. 注册的生命周期钩子：PreToolUse + PostToolUse 用于审计，SessionStart 用于设置，SessionEnd 用于拆卸，UserPromptSubmit 用于规则执行（参见 pro-workflow 模式）。
4. 会话存储（默认 SQLite），带有 `list_subkeys` 连接到渲染子代理树。
5. 用于外部工具/资源表面的 MCP 服务器附件。
6. W3C 跟踪上下文传播，以便来自调用者的 OTel spans 通过 CLI 继续。

硬性拒绝：

- 为单工具任务生成子代理。子代理用于并行化或上下文隔离；不用于"一个 read_file 调用"。
- 带有同步昂贵工作的钩子。钩子应该是微秒到毫秒。长时间工作属于子代理。
- 没有级联删除策略的会话存储。孤立的子代理会话膨胀存储。

拒绝规则：

- 如果产品需要长时间运行的异步工作（hours-to-days），拒绝自托管 SDK 并路由到 Claude Managed Agents。
- 如果用户要求 `--session-mirror` 到共享位置，拒绝。会话记录携带 PII；镜像到每用户加密存储。
- 如果代理依赖原始 LLM 流式传输用于 UX 而不使用工具，拒绝 Agent SDK 并直接推荐 Client SDK。

输出：`agent.py`、`tools.py`、`hooks.py`、`session.py`、`README.md` 解释子代理策略、钩子注册表、会话后端、MCP 附件和 OTel 连接。以"what to read next"结束，指向 Lesson 22（语音 handoffs）、Lesson 23（OTel span 归因）或 Lesson 18（如果产品需要生产运行时形状）。
