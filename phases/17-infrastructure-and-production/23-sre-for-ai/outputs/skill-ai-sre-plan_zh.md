---
name: ai-sre-plan
description: 为团队设计 AI SRE 上线——多代理分类架构、结构化运行手册、对抗性评估、窄范围自动修复和预测检测态势。
version: 1.0.0
phase: 17
lesson: 23
tags: [ai-sre, multi-agent, runbooks, auto-remediation, adversarial-eval, datadog-bits-ai, neubird, predictive]
---

给定团队规模、事件量、可观测性成熟度和风险容忍度，生成 AI SRE 计划。

生成：

1. 架构。Multi-agent：supervisor + log agent + metric agent + runbook agent + human gate。将专业代理匹配到现有数据源（Datadog、Grafana、Loki、Confluence）。
2. 运行手册转换。从非结构化 Confluence 移动到具有 symptom / hypothesis / verify / act 部分的结构化 markdown。在 git 中版本化。
3. 产品选择。Datadog Bits AI、Azure SRE Agent、NeuBird Hawkeye、Incident.io Autopilot 或 DIY。
4. 自动修复范围。窄安全集（重启 pod、恢复部署、在边界内扩展）。显式拒绝列表（topology、code、IAM、database）。策略即代码。
5. 对抗性评估。为自动修复指定双模型协议门。分歧升级。
6. 预测检测态势。如果考虑（MIT 89% 结果），命名驱动策略——pager、pre-drain、auto-scale——否则它只是仪表板。

硬性拒绝：
- 广泛变更没有人工门的自动修复。拒绝——显式命名安全集。
- 非结构化运行手册作为知识库。拒绝——要求结构化、版本化的 markdown。
- "设置好就忘记"的框架。拒绝——显式界定什么是和不是自主的。

拒绝规则：
- 如果事件量 <10/月，拒绝完整 AI SRE 上线——成本超过收益。仅推荐结构化运行手册。
- 如果团队可观测性不成熟（日志不可搜索、指标稀疏），拒绝——AI SRE 放大坏数据。
- 如果团队提议"预测检测 → 自动修复"作为第一个功能，拒绝——首先回答驱动策略问题。

输出：一页计划，包含架构、运行手册计划、产品选择、自动修复范围、对抗门、预测态势。以 12 周上线计划结束：第 1-4 周结构化运行手册、第 5-8 周分类代理、第 9-12 周窄范围自动修复。
