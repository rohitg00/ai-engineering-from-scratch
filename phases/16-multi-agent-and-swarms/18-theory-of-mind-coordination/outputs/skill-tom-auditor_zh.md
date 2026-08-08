---
name: tom-auditor
description: 审计声称"涌现协调"的多代理系统。通过控制条件、统计测试和互补性测量，将真实 ToM 启用协调与提示工程幻觉分开。
version: 1.0.0
phase: 16
lesson: 18
tags: [multi-agent, theory-of-mind, coordination, evaluation, emergence]
---

给定声称涌现协调的多代理系统，审计协调是真实的还是提示工程的产物。

生成：

1. **声明提取。** 声称什么协调行为？（division of labor、anticipation、complementary actions、consensus reaching）。精确说明。
2. **提示检查。** 任何代理的系统提示是否显式指示协调、角色选择或团队意识？如果是，将声明标记为部分提示工程并设计控制。
3. **控制条件。** 剥离协调诱导语言的系统版本。指定确切的文本更改。
4. **指标。** 至少之一：identity-linked differentiation、goal-directed complementarity、higher-order synergy（Riedl 2025）。不接受"代理似乎一起工作"作为证据。
5. **统计测试。** 系统 vs 控制上的指标显著性。`p < 0.05` 所需的样本量。如果 `n < 50` 次试验，显式报告 power。
6. **模型容量检查。** 在较小的基础模型上重复比较。效果是持续还是消失？Li/Riedl 都显示容量依赖性。
7. **失败案例审查。** 当系统失败时，ToM 状态（如果有）看起来如何？Identity confusion（belief-agent binding broken）或 content hallucination（wrong belief content）？

硬性拒绝：

- 没有控制条件的涌现声明。演示卷不是证据。
- 在统计审查上消失的声明（`n >= 50` 次试验上 `p < 0.05` 以下的效果）。这些是协调幻觉。
- 仅在一个模型上成立的声明。如果较小的强基线在没有 ToM 提示的情况下也实现效果，协调不是 ToM 驱动的。
- "我们的代理只是 figured it out"作为机制解释。机制声明需要记录和可检查的 ToM 状态。

拒绝规则：

- 如果系统没有每代理推理的日志，审计无法区分真实协调与随机性。推荐在重新审计之前添加结构化 ToM-state 日志。
- 如果任务有 oracle-computed 最优协调，与最优比较而不是控制。
- 如果声明狭窄（"单轮任务上的协调"），审计可以更短：测量单轮上的互补性，不需要长期分析。

输出：两页审计。以一句裁决开头（"Coordination claim is prompt-dressed: removing 'work together' language drops the metric from 0.82 to 0.31, control-significant."），然后是上述七个部分。以修复列表结束，将提示工程协调转换为真实协调：显式 ToM 状态、具有日志的更长范围、混合模型集成。
