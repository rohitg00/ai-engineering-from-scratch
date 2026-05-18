---
name: agent-budget-audit
description: 审计代理部署的成本治理栈，并在启用无人值守运行之前标记缺失的层。
version: 1.0.0
phase: 15
lesson: 13
tags: [cost-governors, denial-of-wallet, budgets, claude-code-sdk, agent-governance]
---

给定提议的代理部署，针对十二层参考审计其成本治理栈，并标记哪些层缺失、欠调或过调。

生成：

1. **层清单。** 对于十二层参考层中的每一层（per-request cap、per-task token budget、per-task dollar budget、per-tool cap、iteration cap、per-minute/hour/day/month rolling caps、velocity limit、tiered routing、prompt caching、context windowing、HITL checkpoints、kill switch），说明是否已配置及其值。
2. **失败模式映射。** 对于每个时间尺度失败（runaway loop、slow leak、bad release、legitimate surge），命名捕获它的特定层及其速度。
3. **工具特定上限。** 列出代理可以调用的每个工具。对于每个，命名每会话上限和原因。任何没有显式上限的工具都是开放循环。
4. **警报阈值。** 与上限分开：在什么花费率人类会收到分页？观察到的电子商务案例（$1,200 → $4,800）是周环比增长问题，不是月度上限问题。
5. **Kill-switch 路径。** 当上限触发时，会发生什么？Clean abort、rollback、alert、re-enable procedure。确认 kill switch 在代理外部（代理无法编辑自己的上限）。

硬性拒绝：
- 任何没有 per-task dollar budget 的自主部署。
- 任何没有 velocity limit 的无人值守长期运行。
- 新工具（<30 天）添加没有 per-tool cap 的工具表面。
- 代理本身可以修改的 kill switches。
- 月度上限作为唯一上限（每个其他时间尺度未受保护）。

拒绝规则：
- 如果用户无法以今天的模型价格为最坏情况运行定价，拒绝并要求成本估算。
- 如果提议的预算超过组织在单一错误上的可接受损失，拒绝并要求更低的上限。
- 如果用户将 Auto Mode 分类器（Lesson 10）视为预算的替代品，拒绝。分类器与成本正交；两者都需要。

输出格式：

返回成本治理审计，包含：
- **层表**（layer name、configured y/n、value）
- **失败模式覆盖**（4 行：loop / leak / release / surge）
- **每工具上限**（tool、cap、reason）
- **警报阈值**（rate、owner、channel）
- **Kill-switch 路径**（trigger、action、re-enable procedure）
- **准备度**（production / staging / research-only）
