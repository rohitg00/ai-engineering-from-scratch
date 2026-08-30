---
name: horizon-interpretation
description: 审查供应商的时间范围声明，并生成基准声明与部署现实之间的差距分析。
version: 1.0.0
phase: 15
lesson: 21
tags: [metr, time-horizon, hcast, re-bench, eval-vs-deploy, external-evaluation]
---

给定供应商发布的时间范围声明（例如，"我们的模型以 50% 可靠性完成 14 小时任务"），生成差距分析，量化部署现实增量并标记任何方法论弱点。

生成：

1. **方法论审计。** 识别任务套件（HCAST、RE-Bench、SWAA 或专有）。确认 logistic fit 已披露（slope、sample size、confidence interval）。没有方法论披露的时间范围是营销声明。
2. **任务分布拟合。** 将供应商的基准任务分布映射到用户的生产任务分布。如果它们 materially 分歧（供应商测量 SWE 任务，生产是 customer-support flows），数字不会转移。
3. **评估上下文差距。** 在基准时间范围和部署现实之间应用 10-40% 差距。引用 Anthropic 2024 alignment-faking study 和 2026 International AI Safety Report on eval-context gaming。实际差距取决于评估协议；非结构化任务上的游戏更高。
4. **工具差距。** 基准工具是干净且良好仪器的。生产工具更混乱。估计额外的 5-30% 可靠性折扣。
5. **人类在环假设。** 基准假设没有 HITL。带有 HITL 的生产代理以更高可靠性但更低自主性运行。相应调整时间范围解释。

硬性拒绝：
- 没有源方法论或样本量的时间范围声明。
- 基准时间范围预测部署可靠性的声明。
- 引用 2025 或更早时间范围数字作为当前的供应商（倍增时间约为 7 个月；2025 数字在一年内过时）。
- 将 50% 时间范围视为"大部分时间会工作"——50% 可靠性是抛硬币。

拒绝规则：
- 如果供应商不披露方法论，拒绝并要求源论文或博客文章。
- 如果基准分布与生产分布不重叠，拒绝并要求内部评估。
- 如果供应商引用时间范围而没有对其特定评估管道进行游戏审计，拒绝将数字引用为可靠性预测。

输出格式：

返回时间范围解释备忘录，包含：
- **源方法论**（suite、fit method、sample size、CI）
- **分布重叠**（benchmark vs production；% mapping）
- **评估上下文差距估计**（low / med / high with rationale）
- **工具差距估计**（low / med / high）
- **HITL 假设**（benchmark-style autonomous vs production HITL）
- **部署调整时间范围**（差距和工具折扣后的时间范围）
- **准备裁决**（production / staging / research-only）
