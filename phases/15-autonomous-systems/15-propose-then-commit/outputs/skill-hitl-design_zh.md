---
name: hitl-design
description: 审查提议的 Human-in-the-Loop 工作流，针对 propose-then-commit 形状，并标记缺失的 metadata、idempotency、verification 或 challenge-and-response 层。
version: 1.0.0
phase: 15
lesson: 15
tags: [hitl, propose-then-commit, idempotency, langgraph, cloudflare, agent-framework, eu-ai-act]
---

给定提议的 HITL 工作流，针对 propose-then-commit 参考进行审计，并标记缺失、欠指定或 regulator-incompatible 的内容。

生成：

1. **提案元数据。** 确认每个提案表面：intent（why）、data lineage（source content）、permissions touched、blast radius（worst case）、rollback plan。缺失字段是阻塞项；"代理想要 X"不是提案。
2. **幂等性。** 命名幂等键组合。它必须可从提案内容派生，以便 retries 返回相同记录。包含 wall-clock time 的键不是幂等键；它们是日志时间戳。
3. **持久性。** 命名存储（PostgreSQL、Redis、Durable Object、带完整性检查的对象存储）。确认批准在代理重启、主机重启和部署中存活。内存队列不符合资格。
4. **批准表面。** Rubber-stamp 批准（单个 Approve 按钮）未通过此审计。必需：challenge-and-response 清单，带有对 intent understanding、blast-radius verification 和 rollback readiness 的积极确认。确认清单针对特定动作类定制，不是通用的。
5. **提交后验证。** 确认工作流在执行后重新读取目标资源，并在验证失败时发出警报。"工具返回 200"不是验证。

硬性拒绝：
- 不持久保存提案的 HITL 表面。
- 审查者是代理本身的批准流。
- 任何没有 challenge-and-response 的不可逆生产动作。
- 带有 wall-clock 组件的幂等键。
- 在 consequential 动作上缺少 post-commit verify 的工作流。

拒绝规则：
- 如果用户命名批准 UI 但无法命名其背后的持久存储，拒绝并要求先进行存储。
- 如果用户将"max_budget_usd 和确认对话框"视为足够的 HITL，拒绝。预算限制成本，不是正确性。
- 如果部署触及高风险 EU 范围且 rubber-stamp 模式仍然存在，拒绝基于 Article 14 的理由。

输出格式：

返回 propose-then-commit 审计，包含：
- **提案字段表**（intent / lineage / blast / rollback / permissions —— 全部五个必需）
- **幂等性注释**（key composition、retry test result）
- **持久性行**（store、survives-restart y/n）
- **批准表面**（rubber-stamp / checklist；如果是 checklist，列出问题）
- **提交后验证**（present y/n、what it re-reads）
- **准备度**（production / staging / research-only）
