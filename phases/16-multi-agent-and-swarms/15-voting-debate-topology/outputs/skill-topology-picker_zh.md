---
name: topology-picker
description: 为多代理辩论选择拓扑（star / chain / tree / graph）、代理数量 N、异质性配置文件和给定任务的轮次限制。
version: 1.0.0
phase: 16
lesson: 15
tags: [multi-agent, debate, topology, voting, self-consistency]
---

给定任务描述，推荐多代理拓扑和大小。

生成：

1. **任务指纹。** Research（long-horizon、open-ended）、fast-factual（closed-form answer）、stepwise-refinement（staged pipeline）或 opinion（no ground truth）。选择一个；如果跨越两个，选择主导形状。
2. **拓扑。** Star、chain、tree 或 graph。从指纹证明：
   - research → graph（any-to-any critique）
   - fast-factual → star（hub aggregates）
   - stepwise-refinement → chain（或 tree if divide-and-conquer）
   - opinion → 以上都不是；推荐单代理 + 人类决策
3. **代理数量 N。** 3 是最便宜的有用集成；5 是常见的最佳点；7+ 是专业。在 graph 拓扑上超过 5，警告协调税。
4. **异质性配置文件。** 如果 monoculture 重要（research、reasoning），至少一个代理必须来自不同的基础模型家族。在 N=5 时首选 3 个不同的基础模型。
5. **轮次限制。** 1 轮 = 投票。2 轮 = 一次细化。3 轮 = 一致性主导前的最大值。永远不要无界。
6. **聚合。** Plurality（便宜）、confidence-weighted（Lesson 14 的 CP-WBFT）、geometric median（DecentLLMs）或 judge-scored。除非成本限制要求 plurality，否则默认 confidence-weighted。
7. **升级。** 低于阈值的共识 → 升级到哪里？Human、具有不同基础模型的另一个集成或 abstention？

硬性拒绝：

- 任何在 graph 拓扑上推荐 10+ 代理的建议。协调税占主导；先测量。
- 用于开放研究问题的 star 拓扑。Star 失去了 any-to-any critique 的好处。
- 任何将相同基础模型运行 N 次并称之为多代理的建议。那是伪装的 self-consistency；正确标记它。
- 无界轮次。奖励一致性；辩论运行时间越长，代理通过压力而不是逻辑达成一致越多。

拒绝规则：

- 如果任务没有 ground truth（opinion、synthesis、creative），说明投票是建议性的。推荐单代理 + 人类决策。
- 如果用户缺乏访问多个基础模型的权限，标记 monoculture 上限并推荐 temperature variation 的 self-consistency 作为回退。
- 如果任务简单（单个事实查找、< 100 token 的推理），推荐具有 self-consistency N=5 的单代理。

输出：一页简报。以单句推荐开头（"Graph topology, N=5 agents from 3 different base models, 2 rounds, confidence-weighted aggregation, escalate to human on below-threshold."），然后是上述七个部分。以预算估计结束：每查询的预期 token 和预期延迟（秒）。
