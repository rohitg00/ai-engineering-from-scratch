# LLM 的差分隐私（Differential Privacy for LLMs）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> DP-SGD 仍然是标准做法——在梯度更新中注入噪声，提供形式化的 (epsilon, delta) 保证。代价是显著的算力、显存和效用开销；参数高效的 DP fine-tune（LoRA + DP-SGD）是 2025 年的常见配置（ACM 2025）。两条相互拉扯的证据线：基于 canary 的成员推理（Duan et al., 2024）报告称对语言模型的攻击成功有限；而训练数据抽取（Carlini et al., 2021；Nasr et al., 2025）则能恢复出大量逐字记忆内容。化解（arXiv:2503.06808，2025 年 3 月）：差距在于度量对象不同——人为插入的 canary vs「最容易抽取」的真实数据。新的 canary 设计支持在没有 shadow model 的情况下做基于 loss 的 MIA，并首次给出了在真实数据上、具备真实可用 DP 保证的 LLM 的非平凡 DP 审计。替代方案：PMixED（arXiv:2403.15638）——在推理时通过对 next-token 分布做混合专家来实现私有预测；DP 合成数据生成（Google Research 2024）。新兴攻击：通过 LLM 反馈实现差分隐私反演——置信度分数泄露。

**Type:** Build
**Languages:** Python (stdlib, DP-SGD noise-injection and ε-δ accountant demonstration)
**Prerequisites:** Phase 01 · 09 (information theory), Phase 10 · 01 (large-model training)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 给出 (epsilon, delta)-差分隐私的定义，并陈述 DP-SGD 配方。
- 解释 2024–2025 年的张力：canary MIA 与训练数据抽取给出的图景并不一致。
- 描述 PMixED，以及为什么推理时的私有预测可作为 DP 训练的替代方案。
- 描述「通过 LLM 反馈实现差分隐私反演」攻击。

## 问题（The Problem）

LLM 会记忆。Carlini et al. 2021 表明生产级语言模型可以按需逐字复现训练文本。DP（差分隐私）就是与之对应的形式化防御：训练出的模型，其输出对任意一条训练样本都可证明地不敏感。2024–2025 年的证据显示，DP-SGD 是必要的，但实际部署中所用的 ε 值未必匹配真实威胁模型。

## 概念（The Concept）

### (ε, δ)-差分隐私（(ε, δ)-differential privacy）

一个随机化算法 M 是 (ε, δ)-DP，当且仅当对任意两个仅相差一条样本的数据集和任意事件 S：
P(M(D) in S) <= e^ε * P(M(D') in S) + δ。

直觉：输出分布足够接近（由 ε 参数化），以至于无法可靠推断任何单个个体的贡献，例外概率不超过 δ。

### DP-SGD

Abadi et al. 2016。标准配方：
1. 采样一个 mini-batch。
2. 计算逐样本梯度（per-example gradients）。
3. 将每条逐样本梯度按阈值 C 做 clip。
4. 把 clip 过的梯度求和，再加入标准差为 σ * C 的高斯噪声。
5. 用这个含噪声的和去更新参数。

隐私代价由 accountant（Moments Accountant、Rényi DP accountant）来追踪。LLM 文献里报告的 ε 值随威胁模型、数据敏感度和效用目标差异极大；并不存在一个普适的「安全」默认 ε。已发表的 LLM 训练设置中，ε ≈ 1–10 大致是常见区间，但这只是举例——并非推荐默认值。一般而言，ε 越小所需的噪声越多，效用损失也越大。

### LoRA + DP-SGD

对前沿模型整体跑 DP-SGD 代价过高。LoRA（Hu et al. 2022）把梯度更新限制在一个小 adapter 上，从而降低逐样本梯度的存储开销。LoRA + DP-SGD 是 2025 年的常见配置。DP 保证作用于 adapter；base model 保持冻结。

### 2024–2025 的张力（The 2024-2025 tension）

两条证据线：

- **Canary MIA（Duan et al. 2024）。** 在训练数据中插入唯一的 canary，然后测量成员推理（membership-inference）攻击者能否识别出它们。报告称对语言模型成功率有限。暗示 MIA 很难。
- **训练数据抽取（Carlini 2021，Nasr et al. 2025）。** 用一个前缀去 prompt 模型，测量它能否逐字恢复出训练中的文本。报告称存在大量记忆。暗示在相关意义上 MIA 很容易。

2025 年 3 月的化解（arXiv:2503.06808）：两者度量的根本不是同一件事。MIA 在插入的 canary 上问的是「样本 e 是否在 D 中？」；抽取问的是「我能从 D 中恢复多少东西？」对隐私来说真正要紧的是「最容易被抽取」的样本；canary 会低估这一点，因为它们并未被优化成易被抽取的样子。

新的 canary 设计；无需 shadow model 的基于 loss 的 MIA；首次在真实数据、具备真实可用 DP 保证的 LLM 上完成的非平凡 DP 审计。

### DP 训练的替代方案（Alternatives to DP training）

- **PMixED（arXiv:2403.15638）。** 推理时的私有预测。在 next-token 分布上做混合专家；每个专家只看训练数据的一个分片；聚合时加入噪声以满足 DP。完全绕过 DP 训练。
- **DP 合成数据生成（Google Research 2024）。** 用 DP-SGD 做 LoRA fine-tune，再采样出合成数据，然后在合成数据上训练下游分类器。

两者都规避了完整 DP 训练的效用代价，但代价是切换到另一个威胁模型。

### 通过 LLM 反馈实现差分隐私反演（Differential Privacy Reversal via LLM Feedback）

2025 年新兴攻击。把一个 DP 训练过的模型的置信度分数当作 oracle，用来重新识别个体。即使输出本身不泄露，置信度分布也可能泄露。

防御：不暴露置信度，或在暴露前对它做截断 / 量化。这是在 (ε, δ)-DP 训练之外的额外要求。

### 在 Phase 18 中的位置（Where this fits in Phase 18）

第 20–21 课讲偏见 / 公平性。第 22 课讲隐私。第 23 课讲基于水印的来源（provenance）。第 27 课覆盖监管层面的数据 provenance。

## 用起来（Use It）

`code/main.py` 在一个玩具二分类数据集上模拟 DP-SGD。你可以扫描噪声乘子 σ 和 clip 范数 C，跟踪 (ε, δ) 预算和准确率代价。一个「canary 攻击」会插入一条唯一的训练样本，并在 DP 前后用 log-loss 检验来测量是否能检测到它。

## 上线部署（Ship It）

这一课产出 `outputs/skill-dp-audit.md`。给定一个语言模型部署的 DP 声明，它会审计：(ε, δ) 数值、所用 accountant、MIA 评估协议，以及是否评估了置信度暴露这条攻击向量。

## 练习（Exercises）

1. 跑 `code/main.py`。在 σ ∈ {0.5, 1.0, 2.0} 范围内扫描，并报告 (ε, δ)-准确率的取舍。指出效用崩塌的临界点。

2. 实现一次 canary 插入和一次 log-loss 检验。测量在 σ = 1.0 的 DP-SGD 之前和之后的检测率。

3. 阅读 Nasr et al. 2025 关于训练数据抽取的工作。为什么在中等 ε 下抽取成功率并未崩塌？这对「以 MIA 作为评估手段」意味着什么？

4. 设计一个完全在推理时运行的、基于 PMixED（arXiv:2403.15638）的部署。PMixED 处理的是怎样一种 DP-SGD 处理不了的威胁模型？

5. 勾画一下「通过 LLM 反馈实现 DP 反演」攻击。设计一种限制置信度分数泄露的对策，并估算其部署代价。

## 关键术语（Key Terms）

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|------------------------|
| DP | 「(ε, δ)-差分隐私」 | 形式化隐私：在邻接数据集变化下输出分布足够接近 |
| DP-SGD | 「注入噪声的 SGD」 | 梯度 clip + 加高斯噪声；标准的 DP 训练 |
| LoRA + DP-SGD | 「高效的私有 fine-tune」 | 在低秩 adapter 上跑 DP-SGD；2025 年的标准配置 |
| MIA | 「成员推理」 | 判断某条样本是否在训练数据里的攻击 |
| Canary | 「插入的水印样本」 | 用来度量 DP 泄露的唯一训练样本 |
| PMixED | 「私有推理混合」 | 在 next-token 分布上做混合专家的推理时 DP |
| DP Reversal | 「置信度泄露攻击」 | 利用模型置信度作为 oracle 进行重识别的攻击 |

## 延伸阅读（Further Reading）

- [Abadi et al. — DP-SGD (arXiv:1607.00133)](https://arxiv.org/abs/1607.00133) — 标准 DP 训练算法
- [Carlini et al. — Extracting Training Data (arXiv:2012.07805)](https://arxiv.org/abs/2012.07805) — 抽取攻击的奠基论文
- [Duan et al. — Canary MIA on LLMs (arXiv:2402.07841, 2024)](https://arxiv.org/abs/2402.07841) — 成功率有限的 MIA
- [Kowalczyk et al. — Auditing DP for LLMs (arXiv:2503.06808, March 2025)](https://arxiv.org/abs/2503.06808) — 化解上述张力
- [PMixED (arXiv:2403.15638)](https://arxiv.org/abs/2403.15638) — 推理时的私有预测
