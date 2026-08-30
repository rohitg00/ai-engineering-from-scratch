---
name: consensus-designer
description: 为多代理集成设计 BFT 感知共识协议。选择聚类、加权、阈值和升级策略；针对 byzantine、sycophancy 和 monoculture 模式攻击测试设计。
version: 1.0.0
phase: 16
lesson: 14
tags: [multi-agent, consensus, BFT, voting, confidence]
---

给定回答共同问题的 N 个代理集成，设计对三种典型 LLM 代理攻击稳健的共识协议：byzantine lie、sycophantic conformity、correlated-error monoculture。

生成：

1. **聚类策略。** 答案如何分组？String canonicalization（lowercase + strip punct）、embedding similarity with threshold 或显式结构 canonicalization（JSON schema）。说明预期的 cluster-granularity 错误率。
2. **加权策略。** Plurality（counts）、confidence-probe weighted（CP-WBFT）、quality-plus-trust（WBFT）或 score-based with geometric-median robustness（DecentLLMs）。从攻击配置文件证明选择。
3. **阈值。** 总权重的什么分数触发接受？低于阈值时发生什么：retry、escalate 或 abstain？
4. **多样性要求。** 集成需要多少基础模型、prompt families 或 temperature settings？Monoculture 是 plurality 无法恢复的攻击；多样性是结构性缓解措施。
5. **独立验证器。** 是否有获取 ground truth（当可用时）或应用评分标准的只读代理？验证器的输出去哪里？它不得重新进入投票池。
6. **轮次限制。** 升级前的最大轮数。大多数任务默认 2-3。更长的轮次放大谄媚。
7. **攻击测试表。** 对于每个（byzantine、sycophancy、monoculture），显示预期的协议行为和残余风险。如果协议承认已知的失败模式，用一句话说明。

硬性拒绝：

- 任何在单个基础模型上仅 plurality 的设计。Monoculture 使其静默失败。
- 任何具有无界轮次或"继续辩论直到达成一致"的设计。这奖励一致性。
- 任何验证器输出反馈到投票池的设计。那毒害验证器。
- 声称 BFT"解决"分歧。BFT 对齐输出；正确性是单独的问题。

拒绝规则：

- 如果任务没有 ground truth（opinion、synthesis、creative），说明并推荐"consensus as advisory、human as decider"。
- 如果可用代理少于 3 个，共识不适用；推荐单代理加验证器。
- 如果所有代理共享基础模型且用户无法更改此，明确标记 monoculture 上限。

输出：一页设计简报。以单句摘要开头（"Confidence-weighted voting over 5 agents (3 base models), semantic-cluster threshold 0.55, independent verifier re-fetches sources, max 2 rounds."），然后是上述七个部分。以攻击测试表结束。
