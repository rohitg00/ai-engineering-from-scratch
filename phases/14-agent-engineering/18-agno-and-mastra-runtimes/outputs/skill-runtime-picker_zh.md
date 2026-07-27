---
name: runtime-picker
description: 为给定的技术栈、延迟预算和运营形态选择生产级智能体运行时（Agno、Mastra、LangGraph、提供商 SDK）。
version: 1.0.0
phase: 14
lesson: 18
tags: [agno, mastra, langgraph, runtime, selection]
---

给定技术栈、延迟预算、所需原语和运营形态，选择一个运行时。

决策：

1. Python + FastAPI + 每秒数千个短生命周期智能体 -> **Agno**。
2. TypeScript + Next.js/Vercel + 统一多提供商 -> **Mastra**。
3. 持久状态、显式图、故障恢复 -> **LangGraph**（第 13 课）。
4. Claude 优先产品，想要 Claude Code 框架形态 -> **Claude Agent SDK**（第 17 课）。
5. OpenAI 优先产品，想要交接 + 护栏 + 追踪 -> **OpenAI Agents SDK**（第 16 课）。
6. 多智能体团队、参与者模型并发、故障隔离 -> **AutoGen v0.4** / **Microsoft Agent Framework**（第 14 课）。
7. 基于角色的协作或事件驱动的确定性工作流 -> **CrewAI** Crew 或 Flow（第 15 课）。
8. 以上都不是 -> 直接 API 调用 + 第 01 课的 stdlib 循环。

产出：

- 一个简短的决策文档：技术栈、延迟目标、所需原语、观察到的权衡。
- 所选运行时中的最小框架。
- 如果当前正在使用另一个运行时的迁移计划。

硬性拒绝：

- 仅基于"性能"选择 Agno 或 Mastra，而工作负载是每个请求一次慢速调用。性能很少是瓶颈。
- 在没有理由的情况下在 Python 单体仓库中选择 TypeScript 运行时。混合语言智能体代码是运营税。
- 为无状态短任务选择 LangGraph。检查点增加了简单工作流（第 12 课）可以避免的开销。

拒绝规则：

- 如果用户想要"全部五个运行时，以便比较"，拒绝。在你的工作负载上进行基准测试；框架供应商的基准测试只是参考方向。
- 如果用户想要自托管 Mastra 的 `ee/` 功能，拒绝并指向许可条款。
- 如果产品需要长时间运行的异步工作（数小时到数天），拒绝自托管并路由到 Claude Managed Agents 或基于队列的架构（第 29 课）。

输出：决策文档 + 框架 + README。以"下一步阅读"结尾，指向第 24 课（可观测性）和第 29 课（生产运行时）以了解框架之上的运营层。
