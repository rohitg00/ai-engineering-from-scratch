---
name: stategraph-designer
description: 将智能体任务转换为具有命名节点、类型化状态、规约器、检查点器和人工中断的 LangGraph StateGraph。
version: 1.0.0
phase: 11
lesson: 16
tags: [langgraph, stategraph, checkpointer, interrupt, time-travel, react-agent, human-in-the-loop]
---

给定智能体任务（面向用户的目标、可用工具、预期轮次数、带安全影响范围的副作用、持久性要求、目标延迟预算），输出：

1. 节点列表。命名每个离散步骤：LLM 思考者、每个工具运行器、每个人工审查步骤、任何摘要器或批评器、任何检索器。如果任何节点涉及多个关注点则拒绝设计；将其拆分。
2. 状态模式。TypedDict（或 Pydantic）字段，每个列表带一个规约器。消息日志始终使用 Annotated[list, add_messages]。将任何任务特定列表从消息中提升出来（计划、预算计数器、检索到的文档列表），以便规约器在并行更新下保持正确。
3. 边映射。下一步确定性的静态边。仅当模型选择下一步时使用带有命名路由函数的条件边。拒绝任何路由函数依赖于尚未在先前的节点中进行的全新 LLM 调用的图。
4. 中断放置。在每个具有不可逆副作用的节点上使用 interrupt_before（写入、删除、支付、有成本的外部 API 调用）。当输出验证在单独的进程中运行时，在模型节点上使用 interrupt_after。拒绝在任何有副作用的节点上使用 interrupt_after；到那时副作用已经发生。
5. 检查点器。MemorySaver 仅用于测试。对于必须能在重启后存活的任何环境，从 PostgresSaver、SQLiteSaver、RedisSaver 中选择。确认 thread_id 策略（每用户、每会话、每对话）和检查点 TTL。

拒绝发布没有检查点器的 LangGraph。没有检查点器意味着没有恢复、没有时间旅行、没有人工参与的复播。拒绝没有 add_messages 的 messages 字段；第二次写入静默覆盖第一次，对话的一半会消失。拒绝每个转换都是由规划器 LLM 路由的条件边的图；那是带额外步骤的 AutoGen，每轮烧 token。

示例输入："基于 Anthropic Claude 的退款处理智能体，三个工具（lookup_order、issue_refund、send_email），任何超过 100 美元的退款必须暂停等待人工，必须在服务器重启后恢复，p95 延迟预算 8 秒。"

示例输出：
- 节点：agent（LLM 调用）、lookup_tool、refund_tool、email_tool、human_review。
- 状态：messages 带 add_messages，order_context（覆盖），refund_amount（覆盖），reviewer_decision（覆盖）。
- 边：agent 到 should_continue 路由器，分支 lookup_tool、refund_tool、email_tool、human_review、END。工具节点返回 agent。
- 中断：当 refund_amount > 100 时 interrupt_before 在 refund_tool 上。lookup_tool 或 email_tool 上无中断。
- 检查点器：PostgresSaver，thread_id "user:{user_id}:case:{case_id}"，30 天 TTL。
