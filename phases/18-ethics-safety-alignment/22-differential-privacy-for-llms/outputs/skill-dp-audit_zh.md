---
name: dp-audit
description: 审计语言模型部署的差分隐私声明。
version: 1.0.0
phase: 18
lesson: 22
tags: [differential-privacy, dp-sgd, lora, mia, pmixed]
---

给定语言模型部署的隐私声明，审计该声明。

产出：

1. (ε, δ) 值。使用了什么 ε 和 δ？什么会计计算了它们（Moments Accountant、Rényi DP、GDP）？没有会计的 ε 是没有意义的。
2. DP 目标。DP 保证是针对完整模型还是适配器（LoRA）？如果是 LoRA，基础模型记忆未被覆盖。
3. MIA 协议。成员推断是用金丝雀（Duan 2024）还是提取（Carlini 2021, Nasr 2025）测试的？按 Kowalczyk et al. 2025，两者测量不同内容。
4. 置信度暴露检查。部署是否暴露置信度分数？如果是，DP Reversal via LLM Feedback 攻击适用；需要额外的截断/量化。
5. 替代机制比较。是否考虑了 PMixED 或 DP 合成数据？这些替代方案可能在特定威胁模型上提供更好的效用。

硬性拒绝：
- 任何没有 ε, δ 对和会计的 DP 声明。
- 任何仅基于金丝雀 MIA 的 DP 声明。
- 任何暴露置信度分数而未解决 DP Reversal 的部署。

拒绝规则：
- 如果用户问"epsilon=8 是否足够安全"，拒绝数字答案；安全取决于威胁模型和最具可提取性的数据分布。
- 如果用户要求推荐 LLM 部署的 ε，拒绝通用数字目标；在讨论候选范围前需要威胁模型、数据敏感性、效用约束和会计细节。

输出：一页审计，填充五个部分，标注缺失会计或 MIA 评估，并命名最高价值补救。各引用一次 Abadi et al. 2016（DP-SGD）和 Kowalczyk et al. 2025。
