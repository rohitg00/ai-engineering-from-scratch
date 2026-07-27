---
name: framework-picker
description: 为智能体任务选择 LangGraph、CrewAI、AutoGen、Agno 或纯 Python，通过将抽象与问题形状匹配。
version: 1.0.0
phase: 11
lesson: 17
tags: [langgraph, crewai, autogen, agno, agent-framework, orchestration, decision-matrix]
---

给定任务描述（问题形状、每次运行的 LLM 调用总数、分支模式、持久性和恢复需求、人工参与检查点、并行扇出、会话内存、预期每日运行量），输出：

1. 形状匹配。一句话命名适合的抽象：图（类型化状态、命名转换）、组织结构图（专家角色、管理路由交接）、聊天（智能体交谈直到完成）、带工具的单一智能体。如果无法选择一个，任务还未形成智能体形状；停止并分解。
2. 分支权限。谁选择下一步：开发者（显式边）、管理 LLM（CrewAI 分层）、对话涌现（AutoGen GroupChat）、工具调用自路由（Agno）。引用 LLM 选择路由的每轮 token 成本（如适用）。
3. 状态预算。确认是否需要重启后恢复、时间旅行或人工中断。如果是，LangGraph 在状态优先抽象上胜出；Agno 仅覆盖会话范围的内存。
4. 框架选择。输出 langgraph、crewai、autogen、agno、plain_python 之一。包含一句话论证，将形状和状态答案映射到框架的核心抽象。
5. 逃生舱。如果每日运行量超过 10,000 或任务是无状态的两个或更少 LLM 调用，推荐使用提供者 SDK 的纯 Python。当任务很小的时候，没有框架是最快的框架。

拒绝为具有已知 DAG 的确定性工作流推荐 AutoGen；GroupChatManager 花费 token 选择开发者本可以静态连接的发话者。CrewAI 确实通过 `output_pydantic` / `output_json` 支持结构化任务输出（见 [docs.crewai.com/en/concepts/tasks](https://docs.crewai.com/en/concepts/tasks)），但其 `context` 通道仍通过下一个任务的提示字符串流动。当工作流依赖原始 `context` 在未连接这些输出模式之一的情况下跨任务携带结构化状态时，反对使用 CrewAI。反对对两个调用的摘要器使用 LangGraph；StateGraph 的开销是纯粹的税。反对在任务扇出超过 4 个并行子工作进程且带有规约器语义时使用 Agno；Agno 带有一个 `Parallel` 块，其输出合并为由步骤名称键控的字典（见 [docs-v1.agno.com/workflows_2/overview](https://docs-v1.agno.com/workflows_2/overview) 和 [docs.agno.com/workflows/access-previous-steps](https://docs.agno.com/workflows/access-previous-steps)），但它不暴露与 LangGraph 的 Send 风格扇出-规约 API 相当的 API。

示例输入："长期研究工作流：规划、扇出到三个检索器、综合、人工批准简报、撰写报告、引用来源。必须在崩溃后恢复。生产环境每天 50 次运行。"

示例输出：
- 形状：图。类型化规划、三个并行检索器、综合和写入之间的命名转换。
- 分支：开发者通过条件边决定。无每轮管理 LLM。
- 状态：需要恢复和人工中断。LangGraph 强制。
- 框架：langgraph。状态、Send 扇出、interrupt_before 和 PostgresSaver 都是一等公民。
- 逃生舱：不适用。每天 50 次运行远低于纯 Python 阈值，且工作流状态性太强而不能没有框架。
