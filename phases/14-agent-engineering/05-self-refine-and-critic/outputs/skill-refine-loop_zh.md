---
name: refine-loop
description: 给定任务、验证器可用性和迭代预算，配置评估器-优化器（Self-Refine / CRITIC）循环。
version: 1.0.0
phase: 14
lesson: 05
tags: [self-refine, critic, evaluator-optimizer, guardrails, iteration]
---

给定任务、迭代预算和可用验证器（工具接地或仅自评估），发出评估器-优化器循环的提示词和停止策略。

生成：

1. 生成器提示词。首次输出的确定性生产者。明确说明任务、输出格式和约束。
2. 评估器/验证器提示词。如果工具可用（搜索、代码运行、测试、计算器、类型检查），说明如何调用它们及如何产生结构化批评（JSON 包含：pass/fail、violations[]、suggested_fixes[]）。如果仅自评估可用，明确标记 Self-Refine rubber-stamp risk，并使用结构不同的提示词风格（例如对抗性"找出至少一个缺陷"）。
3. 精炼器提示词。必须引用先前的输出和批评（历史）。声明"不重复先前迭代中标记的失败模式"是强制性的。
4. 停止策略。合取条件：验证器通过 OR（自评估说没问题 AND 迭代次数 >= 2）OR 迭代次数 >= max_iterations。永远不要使用单一条件。
5. 可观测性钩子。将每次迭代记录为 OpenTelemetry GenAI span（evaluate, optimize），按照 Lesson 23，以便完整的精炼轨迹可审计。

硬性拒绝：

- 生成器和批评者使用相同的提示词。Rubber-stamp risk —— 模型会同意自己的观点。
- 没有迭代上限。无限精炼循环会消耗 token；默认上限为 4。
- 验证器提示词要求自由格式的散文反馈。仅结构化 JSON —— pass/fail 加上逐项违规。
- 从精炼器提示词中删除历史。论文表明没有历史质量会下降。

拒绝规则：

- 如果任务没有验证器且无法构建验证器，拒绝 CRITIC 并指出 Self-Refine 是可用的较弱选项 —— 警告用户 rubber-stamp risk。
- 如果 max_iterations >= 10，拒绝并建议重新架构任务。超过 3-4 轮的 refine-to-convergence 通常是生成器提示词错误的信号。
- 如果验证器调用破坏性工具（shell、git write），拒绝并要求沙箱边界（Lesson 09）。

输出：包含所有提示词、停止策略和工具列表的单个配置块，以及一个"what to read next"注释，根据部署目标指向 Lesson 16（OpenAI Agents SDK guardrails）、Lesson 12（Anthropic evaluator-optimizer）或 Lesson 30（eval-driven agent development）。
