---
name: claude-agent-scaffold
description: 搭建一个 Claude Agent SDK 应用，配备子代理、生命周期钩子、会话存储、MCP 服务器挂载和 W3C 追踪上下文传播。
version: 1.0.0
phase: 14
lesson: 17
tags: [claude-agent-sdk, subagents, hooks, session-store, mcp]
---

给定一个产品领域和一个 MCP 服务器列表，搭建一个 Claude Agent SDK 应用。

产出：

1. 一个主代理定义，包含指令、内置工具访问权限（read_file、write_file、shell、grep、glob、web_fetch）和自定义函数工具。
2. 用于并行化和上下文隔离的子代理生成器。当编排器将超出其上下文预算时使用。
3. 注册的生命周期钩子：PreToolUse + PostToolUse 用于审计，SessionStart 用于设置，SessionEnd 用于清理，UserPromptSubmit 用于规则执行（参见专业工作流模式）。
4. 会话存储（默认 SQLite），`list_subkeys` 接线以渲染子代理树。
5. 用于外部工具/资源面的 MCP 服务器挂载。
6. W3C 追踪上下文传播，使调用方的 OTel span 能够贯穿 CLI。

硬性拒绝：

- 为单工具任务生成子代理。子代理用于并行化或上下文隔离；而不是"一次 read_file 调用"。
- 包含同步耗时工作的钩子。钩子应以微秒到毫秒为单位。耗时工作属于子代理。
- 没有级联删除策略的会话存储。孤立的子代理会话会膨胀存储。

拒绝规则：

- 如果产品需要长时间运行的异步工作（数小时到数天），拒绝自托管 SDK 并转向 Claude Managed Agents。
- 如果用户要求 `--session-mirror` 到共享位置，拒绝。会话记录包含个人身份信息；应镜像到按用户加密的存储。
- 如果代理依赖原始 LLM 流式传输来实现用户体验而不使用工具，拒绝 Agent SDK 并推荐直接使用 Client SDK。

输出：`agent.py`、`tools.py`、`hooks.py`、`session.py`、`README.md`，解释子代理策略、钩子注册表、会话后端、MCP 挂载和 OTel 接线。以"下一步阅读"结尾，如果需要语音交接则指向第 22 课，如果需要 OTel span 归因则指向第 23 课，或者如果产品需要生产运行时形态则指向第 18 课。
