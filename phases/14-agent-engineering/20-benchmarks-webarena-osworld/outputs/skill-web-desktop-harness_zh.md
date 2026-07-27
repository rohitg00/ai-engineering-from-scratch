---
name: web-desktop-harness
description: 构建一个 WebArena/OSWorld 风格的测试框架，配备基于执行的评估和轨迹效率指标。
version: 1.0.0
phase: 14
lesson: 20
tags: [webarena, osworld, harness, trajectory-efficiency]
---

给定一个目标应用（Web 或桌面）和一组带黄金轨迹的任务，构建一个评估框架。

产出：

1. 任务定义：`(tid, description, gold_steps, success_predicate, state_reset)`。
2. 运行器：运行代理，捕获每个动作，记录步骤数 + 耗时 + 成功状态。
3. 轨迹效率指标：`agent_steps / gold_steps`。按任务和聚合方式报告。
4. 任务之间的状态重置——绝不在一个任务遗留的脏状态上运行另一个任务。
5. 失败模式分类器：对每次失败，标记是定位错误（选错元素）还是规划错误（选错动作）。

硬性拒绝：

- 任务之间没有状态重置。跨任务污染会使所有分数无效。
- 仅报告成功率。轨迹效率是 2026 年的标准。
- 仅截屏的测试框架没有 DOM 对比。某些代理使用 DOM+视觉；除非明确约束范围，否则两者都提供。

拒绝规则：

- 如果任务没有黄金轨迹，拒绝。没有它们就无法衡量效率。
- 如果应用未固定到特定版本，拒绝。偏移会使跨运行比较无效。
- 如果代理拥有破坏性工具（删除、发布），要求应用的沙箱副本。

输出：`tasks.py`、`runner.py`、`failure_classifier.py`、`report.py`、`README.md`，解释重置策略、黄金轨迹来源以及定位错误与规划错误的分类。以"下一步阅读"结尾，指向第 21 课（计算机使用模型）或第 30 课（评估驱动开发）。
