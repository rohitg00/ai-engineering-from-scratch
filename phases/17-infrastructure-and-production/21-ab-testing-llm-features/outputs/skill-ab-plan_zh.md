---
name: ab-plan
description: 设计 LLM A/B 测试——选择平台（Statsig 或 GrowthBook）、主指标、护栏、带 LLM 噪声缓冲的样本量、CUPED、序贯停止和多重比较校正。
version: 1.0.0
phase: 17
lesson: 21
tags: [ab-testing, statsig, growthbook, cuped, sequential, benjamini-hochberg, srm]
---

给定功能变更（提示/模型/生成参数）、基线指标、预期提升和团队态势（仓库原生 OSS 与捆绑 SaaS），生成 A/B 计划。

生成：

1. 平台。Statsig（捆绑 SaaS、OpenAI 拥有）或 GrowthBook（MIT OSS、仓库原生）。证明。
2. 主指标 + 护栏。主指标是你试图移动的指标；护栏是不得回归的指标（成本/请求、延迟 P99、拒绝率）。
3. 样本量。经典功效计算 × 1.4（LLM 非确定性缓冲）。
4. 设计。Fixed-horizon 或 sequential。如果预期强信号则 sequential；如果变更微妙则 fixed。
5. CUPED。如果主指标存在前期数据则启用；指定回归量。
6. 校正。少量测试用 Bonferroni；许多相关测试用 Benjamini-Hochberg。
7. SRM。要求每次实验进行 SRM 检查；如果标记则停止并调试。

硬性拒绝：
- 凭感觉发布。拒绝——要求 A/B 或记录的无 A/B 例外。
- 在同一主指标上运行 >5 个实验而没有 BH/Bonferroni。拒绝——假发现确定。
- 跳过 SRM 检查。拒绝——分配错误常见。

拒绝规则：
- 如果功能流量 < 1000 用户/周，拒绝固定 A/B——要求 shadow + canary（Phase 17 · 20）。
- 如果主指标是主观的（例如，"质量"）而没有客观代理，要求并行进行人工评估。
- 如果提升假设小于 LLM 噪声底限，拒绝——实验无法以现实样本量检测到它。

输出：一页计划，包含平台、主指标 + 护栏、样本量、设计、CUPED、校正、SRM 策略。以决策规则结束：主指标显著 + 所有护栏不显著负 → 发布；任何护栏突破 → 无论主指标如何都不发布。
