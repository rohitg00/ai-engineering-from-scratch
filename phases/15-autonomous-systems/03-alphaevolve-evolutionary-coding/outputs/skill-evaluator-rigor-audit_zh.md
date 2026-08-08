---
name: evaluator-rigor-audit
description: 在投入任何计算之前，审计提议的 AlphaEvolve 风格进化编码循环的评估器。
version: 1.0.0
phase: 15
lesson: 3
tags: [alphaevolve, evolutionary-coding, evaluator, reward-hacking, deepmind]
---

给定一个提议的进化编码循环（生成器 LLM、程序数据库、评估器），审计评估器。评估器是架构；生成器是可互换的。此技能决定循环是否有机会产生真正的胜利，还是只是 reward-hacked 垃圾。

生成：

1. **评估器分解。** 命名评估器报告的每个信号：correctness、performance、resource、other。对于每个，说明 (a) 如何测量，(b) 可以多便宜地被游戏，(c) 保留输入规则是什么样的。
2. **虚构表面。** 列出 LLM 在此领域最可能的三个虚构：声称的复杂度类、声称在边缘情况下的正确性、没有测量的声称性能。说明哪个评估器信号捕获每个。
3. **Reward-hacking 表面。** 列出循环可以在不执行预期任务的情况下最大化分数的三种可能方式（通过测试的捷径、代理游戏、输入记忆）。说明每个的缓解措施。
4. **确定性和可重复性。** 要求评估器输出在容差内是确定性的。标记任何评估器，其分数运行间波动超过群体方差。
5. **部署检查。** 如果获胜变体将发布到生产环境，需要单独的预部署审查，评估器不检查（security、cost、human review）。搜索没有验证部署就绪性。

硬性拒绝：
- 任何评估器是 LLM judge 而没有机器可检查的真实值的循环。LLM judge 可以被游戏。
- 任何报告单一标量分数而没有分解的评估器。标量分数放大 reward hacking。
- 仅训练集的评估器。保留输入是不可协商的。

拒绝规则：
- 如果用户无法用两段话描述评估器，拒绝并要求先提供评估器规范。没有规范评估器的循环还没有准备好计算。
- 如果领域未验证（creative writing、open-ended scientific hypothesis、long-form research），拒绝并推荐带有人类审查的混合管道，而不是封闭循环。
- 如果提议的部署表面是不可逆的（production infrastructure changes、shipping product 中的算法交换），拒绝封闭循环部署。需要分阶段推出和人类签署。

输出格式：

返回一页备忘录，包含：
- **循环摘要**（生成器、评估器、目标域）
- **评估器评分**（严格性 1-5 及理由）
- **虚构表面**（前 3 个，带评估器覆盖）
- **Reward-hacking 表面**（前 3 个，带缓解措施）
- **确定性和可重复性**（分数方差与群体方差；种子控制；通过/失败）
- **部署就绪性**（允许封闭循环发布 y/n；所需的预部署审查：security、cost、human）
- **建议**（继续 / 收紧评估器 / 选择不同领域）
