---
name: rollback-rehearsal
description: 为提议的自主工作流设计 rollback-rehearsal 测试，并审计 checkpoint 后端以确保持久的审计跟踪。
version: 1.0.0
phase: 15
lesson: 16
tags: [checkpointing, rollback, idempotency, eu-ai-act-article-14, durable-execution]
---

给定提议的长期自主工作流，设计 rollback-rehearsal 测试，证明 idempotency + precondition + verify + rollback 栈实际端到端工作，并审计 checkpoint 后端以确保 regulator-readiness。

生成：

1. **排练脚本。** 具体测试，(a) 启动工作流，(b) 在提交中崩溃，(c) 恢复，(d) 断言动作恰好触发一次，(e) 注入验证失败，(f) 断言回滚触发且状态恢复。没有生产工作流应在没有此测试至少通过一次的情况下运行。
2. **幂等性审计。** 确认幂等键源自提案内容（Lesson 15），提交逻辑使用显式执行状态（`pending` -> `executing` -> `committed`/`failed`）。在副作用之前通过幂等键保留/锁定，并仅在副作用验证后标记 `committed`。
3. **前置条件清单。** 列出工作流在提交时必须重新检查的每个前置条件。Time-of-check vs time-of-use 差距是最常见的生产 bug；前置条件必须在提交时评估，不是在提案时。
4. **验证清单。** 对于每个 consequential 动作，命名确认副作用发生的特定读取。"返回 200"不可接受。
5. **回滚清单。** 对于每个 consequential 动作，将回滚分类为 in-band、compensating transaction 或 out-of-band alert。No-op 回滚（"我们无法撤销此操作"）必须在提案中明确命名（Lesson 15 元数据）。

硬性拒绝：
- 没有排练回滚的工作流。
- 在部署时丢失数据的 Checkpoint 后端。
- 状态在执行后而不是之前写入的提交路径。
- 仅检查工具调用返回码的"已验证"状态。
- 仅在提案时运行而不是提交时运行的前置条件检查。

拒绝规则：
- 如果用户尚未在暂存中至少运行一次排练脚本，拒绝生产推出。
- 如果用户无法生成 checkpoint store schema，拒绝并要求先进行 schema 文档。Regulators 需要可查询状态。
- 如果工作流依赖于内存 checkpoint（没有持久性），拒绝。

输出格式：

返回排练计划，包含：
- **测试脚本大纲**（带断言的步骤）
- **幂等性表**（key composition、status-write order）
- **前置条件表**（check、when evaluated、consequence）
- **验证表**（action、read that confirms）
- **回滚表**（action、type、target state）
- **后端证明**（store、survives-deploy y/n、query-ready y/n）
- **准备度**（production / staging / research-only）
