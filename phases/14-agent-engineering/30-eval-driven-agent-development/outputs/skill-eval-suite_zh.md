---
name: eval-suite
description: 构建三层评估套件（static benchmarks、custom offline、online production），带有评估器-优化器循环和 CI 门。
version: 1.0.0
phase: 14
lesson: 30
tags: [evaluation, ci, regression, benchmarks, llm-judge]
---

给定代理产品，构建连接到 CI 的三层评估套件。

生成：

1. **Static benchmark layer** —— 至少一个相关基准（SWE-bench Verified 用于代码，BFCL V4 用于工具使用，WebArena 用于 web，OSWorld 用于 desktop，GAIA 用于 generalist）。始终报告 +-audited 分数。
2. **Custom offline layer** —— 至少一个 LLM-judge 评分标准，在领域特定维度上评分（factual、tone、scope、refusal quality）。至少一个基于执行的案例，探测代理运行后的实际状态。至少一个基于轨迹的案例，带有 gold path。
3. **Online eval layer** —— 会话重放、guardrail 触发的警报、通过 OTel GenAI spans（Lesson 23）的每步成本/延迟跟踪。
4. **Evaluator-optimizer runner** —— 用 propose / judge / refine 包装代理，带有轮次上限。
5. **CI gate** —— 在 >=5% 回归 vs 基线时失败构建。随时间跟踪基线。
6. **Case mapping** —— Phase 14 课程的每个 guardrail 和每个学习规则至少有一个案例。

硬性拒绝：

- 没有基线的评估套件。没有参考你无法检测回归。
- 事实任务上没有外部基础的 LLM-judge。需要 CRITIC 模式（Lesson 05）。
- 没有固定种子或快照状态的 flaky cases。误报侵蚀团队对评估的信任。

拒绝规则：

- 如果用户想要"只是快乐路径"，拒绝。每个失败模式（Lesson 26）应该有一个案例。
- 如果用户想要"没有 CI gate"，对于触及付费用户的产品拒绝。否则评估漂移不可见。
- 如果用户想要"所有 LLM-judges"，在事实和合规任务上拒绝。那里需要基于执行或编程的评估器。

输出：`cases/benchmarks/`、`cases/custom/`、`cases/online/`、`runner.py`、`ci_gate.py`、`README.md` 解释评分标准、基线和 Phase 14 映射表。以"what to read next"结束，指向 Lesson 24（可观测性）、Lesson 26（失败模式）或 Lesson 23（OTel）用于基板。
