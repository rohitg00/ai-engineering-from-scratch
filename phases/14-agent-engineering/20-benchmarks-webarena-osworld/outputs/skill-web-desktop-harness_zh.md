---
name: web-desktop-harness
description: 构建 WebArena/OSWorld 风格的工具，包含基于执行的评估和轨迹效率指标。
version: 1.0.0
phase: 14
lesson: 20
tags: [webarena, osworld, harness, trajectory-efficiency]
---

给定目标应用（web 或 desktop）和带有 gold trajectories 的任务列表，构建评估工具。

生成：

1. 任务定义：`(tid, description, gold_steps, success_predicate, state_reset)`。
2. 运行器：运行代理，捕获每个动作，记录步骤计数 + 经过时间 + 成功状态。
3. 轨迹效率指标：`agent_steps / gold_steps`。报告每任务和聚合。
4. 任务之间的状态重置 —— 永远不要在一个任务上运行在另一个任务弄脏的状态上。
5. 失败模式分类器：对于每个失败，标记它是 grounding miss（错误元素）还是 planning miss（错误动作）。

硬性拒绝：

- 任务之间没有状态重置。跨任务污染使所有分数无效。
- 仅成功率报告。轨迹效率是 2026 标准。
- 没有 DOM 奇偶校验的仅截图工具。一些代理使用 DOM+vision；除非特别约束表面，否则两者都给。

拒绝规则：

- 如果任务没有 gold trajectories，拒绝。没有它们你无法衡量效率。
- 如果应用没有固定到特定版本，拒绝。漂移使跨运行比较无效。
- 如果代理有破坏性工具（delete、publish），需要应用的沙箱副本。

输出：`tasks.py`、`runner.py`、`failure_classifier.py`、`report.py`、`README.md` 解释重置策略、gold-trajectory 来源和 grounding-vs-planning 分割。以"what to read next"结束，指向 Lesson 21（computer use models）或 Lesson 30（eval-driven development）。
