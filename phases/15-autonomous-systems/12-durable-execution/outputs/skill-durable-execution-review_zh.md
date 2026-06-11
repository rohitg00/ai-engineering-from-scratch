---
name: durable-execution-review
description: 审查提议的长期运行代理部署的正确 durable-execution 形状（activities、determinism、checkpoint backend、human-input state、HITL-on-resume）。
version: 1.0.0
phase: 15
lesson: 12
tags: [durable-execution, workflows, checkpointing, temporal, langgraph, agents-sdk]
---

给定提议的长期运行代理部署（Temporal + OpenAI Agents SDK、带 PostgreSQL checkpointer 的 LangGraph、Microsoft Agent Framework、Claude Code Routines、Cloudflare Durable Objects 或等效内部构建），针对 durable-execution 模式审计设计。

生成：

1. **活动清单。** 列出每个活动（LLM call、tool call、HTTP request、file write）。对于每个，确认它包装为具有 retry policy、timeout 和 idempotency key 的活动。活动信封外的原始 LLM 调用是可靠性漏洞。
2. **工作流确定性。** 识别工作流代码内的每个非确定性读取（wall clock、random、external state）。每个必须注册为 side-effect 活动，以便 replay 返回相同值。隐藏的非确定性是 replay drift 的最常见原因。
3. **Checkpoint 后端。** 命名后端（PostgreSQL、SQLite、Redis、Durable Objects）。确认它在部署中存活。SQLite 仅用于开发。Redis 需要 AOF 或 snapshot 配置。Cloudflare Durable Objects 是透明的，但需要唯一键规则。
4. **人类输入状态。** 确认 HITL 暂停是工作流的一等状态，而不是轮询循环。工作流应阻塞在外部信号（approval queue、webhook、`interrupt()` 原语）上，该信号在批准到达时准确恢复。
5. **恢复时 HITL 策略。** 对于崩溃后的任何恢复，说明在执行下一个活动之前是否需要新的 HITL。没有此，durable execution 加上崩溃前授予的批准可能会在上下文更改时重新触发批准的动作。对于长期范围至关重要。

硬性拒绝：
- LLM 调用未包装为活动的 Agent SDK 使用。
- 在部署中无法存活的 Checkpoint 后端。
- 嵌入 wall clock 或 random 而没有活动包装的工作流。
- 建模为轮询循环而不是信号的人类输入。
- 没有恢复时 HITL 策略的长期运行（超过一小时）。
- 没有预算 kill switch（Lesson 13）叠加在 durability 上的运行。

拒绝规则：
- 如果用户提议没有 side-effect 活动上显式幂等性的 durable 工作流，拒绝并要求先进行幂等键。否则 retries 将双重执行。
- 如果用户无法显示 replay 测试（运行工作流、崩溃中运行、replay、assert no double side effects），拒绝并要求在生产之前进行该测试。
- 如果用户提议没有 HITL checkpoint 的 24 小时无人值守运行，拒绝。35 分钟降级（Lesson 12 注释）使其成为可靠性问题，即使 durability 正确。

输出格式：

返回设计审查备忘录，包含：
- **活动表**（activity、retry policy、timeout、idempotency key）
- **确定性审计**（非确定性读取及每个如何处理）
- **Checkpoint 后端**（name、survives-deploy y/n、replay-test status）
- **HITL 状态形状**（first-class state / polling / missing）
- **恢复时 HITL 策略**（显式，附理由）
- **准备度**（production / staging / research-only）
