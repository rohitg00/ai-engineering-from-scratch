---
name: router-plan
description: 设计 LLM 模型路由计划——选择模式（预路由、级联、集成）、信号（任务、长度、嵌入、置信度）和在线质量门。
version: 1.0.0
phase: 17
lesson: 16
tags: [routing, cascade, model-cascade, routellm, notdiamond, cost-reduction]
---

给定工作负载混合（任务分类样本）、质量底线、延迟容忍度和当前月度支出，生成路由计划。

生成：

1. 模式。Pre-route（最快、分类器依赖）、cascade（最佳质量底线）或 ensemble（仅样本 A/B）。根据质量容忍度 + 延迟预算证明。
2. 信号。从以下选择：task classification、prompt length、embedding similarity to known-hard、self-confidence。声明哪些组合（通常 2-3）和组合规则。
3. 廉价/前沿对。命名具体模型。示例：Claude Haiku 3.5 + GPT-5。根据成本曲线 + 能力证明。
4. 预期节省。计算推荐分割的混合成本；声明与当前的预期月度 $。
5. 在线质量门。指定实时流量判断器：每路由采样 5% 由前沿判断器评估；如果 Δ quality > 2% 则告警。跟踪升级率；如果一个月内攀升 >10 个百分点则告警。
6. 上线。Shadow（路由但忽略；离线比较）、canary 10% 按用户队列、通过门后扩展。

硬性拒绝：
- 没有在线质量门的路由。拒绝——漂移是 #1 失败。
- 仅使用任务分类作为信号。拒绝——错过任务内的难度。
- 将 frontier-eligible 任务（代码、数学、多步骤）路由到廉价而没有级联回退。拒绝——质量底线将突破。

拒绝规则：
- 如果质量容忍度声明为"零回归"，拒绝 pre-route 并提议具有高升级率的 cascade。
- 如果廉价模型是非 Anthropic/非 OpenAI/非前沿且具有已知拒绝模式（例如，用于代理工具使用的未审查模型），拒绝该对——它将静默破坏工具调用。
- 如果路由到不同提供商以获取廉价（跨提供商级联），需要 AI 网关层（Phase 17 · 19）来统一 API。

输出：一页计划，命名模式、信号、模型对、预期节省、在线门、上线计划。以单一指标结束：过去 7 天的升级率；如果变化 > 10 个百分点则触发漂移。
