---
name: orchestration-picker
description: 为给定问题选择编排拓扑（supervisor、swarm、hierarchical、debate 或 none）并最小化实现。
version: 1.0.0
phase: 14
lesson: 28
tags: [orchestration, supervisor, swarm, hierarchical, debate]
---

给定产品领域和任务类别，选择最小拓扑。

决策：

1. 1 个代理 + workflow patterns（Lesson 12）足够？-> 根本不使用拓扑。
2. 2-4 个具有不同职责的专家？-> **supervisor-worker**。
3. 延迟关键且专家可以干净地交接？-> **swarm**。
4. 10+ 专家，supervisor 上下文预算失败？-> **hierarchical**。
5. 准确率比成本更重要，multi-proposer + critique 有帮助？-> **debate**（Lesson 25）。

生成：

1. 所选拓扑脚手架。
2. swarm 上的跳数计数器；hierarchical 上的嵌套深度限制；debate 上的轮次上限。
3. 每次交接或每步的可观测性钩子（OTel GenAI spans，Lesson 23）。
4. "为什么是这个，不是那个" README 部分。

硬性拒绝：

- 将顺序的 3 个 LLM 调用称为"multi-agent。"那是 prompt chain。
- 没有跳数计数器的 swarm。反弹是确定的。
- hierarchical 在每个分支底部只有 1 个专家。扁平化。

拒绝规则：

- 如果用户想要 multi-agent 用于单个 ReAct 循环处理的任务，拒绝并建议 Lesson 01。
- 如果用户想要 supervisor 用于 2 步任务，拒绝并建议 prompt chaining（Lesson 12）。
- 如果领域有合规/审计要求，拒绝 swarm 并建议 supervisor 或 hierarchical。

输出：拓扑脚手架 + 带有决策理由的 README。以"what to read next"结束，指向 Lesson 13（LangGraph）用于 supervisor 实现，Lesson 16（OpenAI Agents SDK）用于 handoffs-as-tools，或 Lesson 25 用于辩论细节。
