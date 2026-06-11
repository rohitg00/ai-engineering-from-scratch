---
name: scaling-policy-review
description: 审查前沿实验室扩展策略（Anthropic RSP、OpenAI Preparedness、DeepMind FSF、internal）针对 RSP v3.0 参考形状。
version: 1.0.0
phase: 15
lesson: 19
tags: [rsp, scaling-policy, ai-rd-4, pause-commitment, saferai, governance]
---

给定已发布或提议的扩展策略，生成结构化审查，将其与 RSP v3.0 参考形状（AI R&D-4、affirmative case、two-tier mitigation、Frontier Safety Roadmap、Risk Report、independent review）进行比较。

生成：

1. **两层清单。** 将承诺分为"lab-unilateral"和"industry-wide recommendation"。Recommendation 层中的承诺是倡导，不是承诺。计算比率；大多数承诺位于 recommendation 层的策略是弱策略。
2. **阈值。** 命名每个能力阈值和触发的缓解措施。标记 v2 有定量的定性阈值。标记策略声称覆盖的能力的缺失阈值。
3. **暂停承诺。** 确认策略在特定阈值处命名暂停条款（training stops、deployment halts 或类似）。v3.0 移除了此；跟随的策略继承回归。
4. **常驻工件。** 确认策略要求常驻 Frontier Safety Roadmap 和 Risk Report 文档，并声明节奏。事后发布的一次性工件不符合资格。
5. **独立审查。** 命名外部审查机制。仅内部审查（由实验室员工组成的"Safety Advisory Group"）不符合独立监督的资格。

硬性拒绝：
- 没有命名能力阈值的策略。
- 其缓解措施全部位于 industry-recommendation 层的策略。
- 没有常驻 Roadmap / Risk Report 工件的策略。
- 没有独立审查机制的策略。
- 声称"从现实经验中学习"而不说明策略文本如何更新以及以什么节奏的策略。

拒绝规则：
- 如果策略文档是营销而非治理（没有具体承诺、没有阈值、没有节奏），拒绝将其评级为扩展策略。
- 如果用户将策略的存在等同于合规，拒绝。策略是承诺设备；合规需要证据。
- 如果用户引用旧策略版本（例如，2023 Anthropic RSP）作为当前版本，拒绝并要求当前版本。

输出格式：

返回策略审查，包含：
- **两层比率**（unilateral / recommendation / total count）
- **阈值表**（name、type：quantitative / qualitative、trigger、mitigation）
- **暂停承诺**（present y/n、specific clause）
- **常驻工件**（Roadmap cadence、Risk Report cadence）
- **独立审查**（mechanism、reviewer identity、frequency）
- **摘要评级**（strong / moderate / weak、justified）
