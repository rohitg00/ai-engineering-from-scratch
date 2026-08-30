---
name: runtime-picker
description: 为给定堆栈、延迟预算和运营形状选择生产代理运行时（Agno、Mastra、LangGraph、provider SDK）。
version: 1.0.0
phase: 14
lesson: 18
tags: [agno, mastra, langgraph, runtime, selection]
---

给定堆栈、延迟预算、所需原语和运营形状，选择运行时。

决策：

1. Python + FastAPI + 每秒数千个短生命周期代理 -> **Agno**。
2. TypeScript + Next.js/Vercel + unified multi-provider -> **Mastra**。
3. 持久状态、显式图、失败恢复 -> **LangGraph** (Lesson 13)。
4. Claude-first 产品，想要 Claude Code 工具形状 -> **Claude Agent SDK** (Lesson 17)。
5. OpenAI-first 产品，想要 handoffs + guardrails + tracing -> **OpenAI Agents SDK** (Lesson 16)。
6. 多代理团队、actor-model 并发、故障隔离 -> **AutoGen v0.4** / **Microsoft Agent Framework** (Lesson 14)。
7. 基于角色的协作或事件驱动的确定性工作流 -> **CrewAI** Crew 或 Flow (Lesson 15)。
8. 以上都不是 -> 直接 API 调用 + Lesson 01 的 stdlib 循环。

生成：

- 简短的决策文档：堆栈、延迟目标、所需原语、观察到的权衡。
- 所选运行时的最小脚手架。
- 如果今天正在使用另一个运行时，迁移计划。

硬性拒绝：

- 纯粹基于"性能"选择 Agno 或 Mastra，当工作负载是每个请求一个慢调用时。性能很少是瓶颈。
- 在没有理由的情况下在 Python monorepo 中选择 TypeScript 运行时。混合语言代理代码是运营税。
- 为无状态短任务选择 LangGraph。检查点添加了简单工作流（Lesson 12）避免的开销。

拒绝规则：

- 如果用户想要"所有五个运行时，以比较"，拒绝。在你的工作负载上基准测试；框架供应商基准测试是方向性的。
- 如果用户想要自托管 Mastra 的 `ee/` 功能，拒绝并指向许可证条款。
- 如果产品需要长时间运行的异步工作（hours-to-days），拒绝自托管并路由到 Claude Managed Agents 或基于队列的架构（Lesson 29）。

输出：决策文档 + 脚手架 + README。以"what to read next"结束，指向 Lesson 24（可观测性）和 Lesson 29（生产运行时）用于框架之上的运营层。
