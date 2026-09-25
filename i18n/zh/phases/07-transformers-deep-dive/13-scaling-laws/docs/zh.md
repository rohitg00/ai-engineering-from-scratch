# 缩放定律

> 2020 年 Kaplan 的论文说：模型越大，损失越低。2022 年 Hoffmann 的论文说：你们一直训练不足。计算量分为两个部分——参数和 token——如何分配并不显而易见。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~45 分钟

## 问题所在

当你有 C FLOPs 的训练计算量并想要最佳模型时，你面临两个旋钮：

1. **参数量（N）取多少？** 模型越大，容量越高。
2. **训练 token 数（D）取多少？** 数据越多，容量利用越充分。

FLOPs 近似按 `6 × N × D` 缩放。你可以增大 N、减小 D，或增大 D、减小 N。哪种更好？

2022 年之前，答案是“大力推高 N”。GPT-3（2020）有 175B 参数，训练于约 300B token，大约每参数 1.7 个 token 的比例。Kaplan 缩放定律支持这一做法。

Hoffmann 等人（2022）训练了一个名为 Chinchilla 的小型模型家族，发现了不同的结论：最优比例更接近**每参数 20 个 token**。GPT-3 训练不足达 10 倍。Chinchilla（70B 参数，1.4T token）在所有基准上都击败了 GPT-3（175B，300B token），且推理成本只有其 1/2.5。

2026 年是 Chinchilla 的世界——但有一个重要转折。Llama 3 8B 训练于 15 万亿 token，每参数 1,875 个 token 的比例，达到 Chinchilla 最优值的 94 倍。对于将被大规模使用的模型，推理成本比训练成本更重要，因此对更小的可部署模型进行过度训练（超过 Chinchilla 最优值）是 2026 年的默认做法。

## 核心概念

![Chinchilla curves: loss vs compute at various N/D ratios](../assets/scaling-laws.svg)

### Hoffmann 定律

根据 Chinchilla 论文，损失遵循：

```
L(N, D) = A / N^α + B / D^β + E
```

- `N` = 参数量（非嵌入）。
- `D` = 训练 token 数。
- `α ≈ 0.34`、`β ≈ 0.28`（大致对称）。
- `E ≈ 1.69`，不可约的损失下限。
- `A ≈ 406`、`B ≈ 411`。

在缩放时，这两项相互权衡。在固定计算量（C = 6ND）下对 `N` 求导并求解：

```
N_opt ≈ 0.6 × (C/6)^0.5
D_opt ≈ 0.6 × (C/6)^0.5
D_opt / N_opt ≈ 20
```

计算最优：每参数 20 个 token。

### 为什么要过度训练

Chinchilla 最优点最小化每训练 FLOP 的损失。但训练成本只付一次；推理成本却要永远支付。

对于一个每月服务万亿 token 的聊天机器人，推理成本占总成本的主导。Llama 的做法：训练更小、更久。8B 模型训练 15T token 是深度推理优化的：

- 可装进消费级 GPU。
- 延迟只有 70B Chinchilla 最优模型的零头。
- 对大多数任务而言质量足够接近。

DeepMind 2024 年的论文（"Over-training is the new optimal"）将其形式化。对于推理主导的工作负载，合适的比例更接近每参数 100–500 个 token，取决于服务量。

### 涌现与平滑性

有一种说法：某些能力（算术、多步推理、遵循思维链）会在某个规模上突然“涌现”。

Schaeffer 等人（2023）认为这是一种测量假象：涌现类指标使用不连续的评分方式（精确匹配、阈值准确率），掩盖了底层 logits 中的平滑改进。连续指标（交叉熵）显示的是平滑曲线。

2026 年的共识是：通过连续损失进行预测是可靠的。基准测试上的跳跃往往只是评分方式的假象。应基于连续指标规划预算。

### 2026 年的图景

缩放定律依然有效，但：

| 因素 | 变化方式 |
|--------|-------------|
| 数据质量 | 策展“优质”token（Phi 风格）可使曲线等效偏移超过 2 倍计算量 |
| MoE | 总参数与活跃 FLOPs 解耦；按每活跃 FLOP 建立缩放定律 |
| 后训练 | 某些能力（指令遵循、代码）更多随 SFT+RLHF 而非预训练变化 |
| 多模态 | 图像与文本 token 共同缩放；每种模态有各自的曲线 |
| 合成数据 | 模型生成训练数据；有效计算量可以复利增长 |

Muon 优化器（Kimi Moonlight，2024）在相同数据量下相比 AdamW 展示了约 2 倍的有效计算增益。一些 2026 年的训练默认使用 Muon。这改变了缩放定律中的绝对常数，而非其形状。

```figure
scaling-laws
```

## 动手实现

参见 `code/main.py`。我们实现 Chinchilla 损失方程，并在若干计算预算下求解计算最优的 `(N, D)`。

### 步骤 1：Chinchilla 损失

```python
def chinchilla_loss(N, D, A=406.4, B=410.7, alpha=0.34, beta=0.28, E=1.69):
    return A / N ** alpha + B / D ** beta + E
```

将 `L` 作为 `(N, D)` 在固定 `C = 6ND` 下的等高线图绘制出来。找出最小值。

### 步骤 2：计算最优前沿

对从 `1e17` 到 `1e25` FLOPs 的计算预算，找出在 `6ND = C` 约束下最小化损失的 `(N, D)`。验证比值 `D/N ≈ 20`。

### 步骤 3：过度训练的代价

计算训练一个小 10 倍的模型（1/10 的最优 N，10 倍的最优 D）需要付出的额外损失。报告作为交换所节省的推理 FLOP（与 N 成正比）。

### 步骤 4：与真实模型对比

代入已知的 GPT-3、Chinchilla、Llama 3 8B、DeepSeek-V3（活跃参数）的 `(N, D)` 组合，比较预测损失与报告损失。

## 实际应用

你不太可能自己训练前沿模型。但缩放定律能告诉你：

1. **你的微调数据是否足够。** 如果你的任务专属数据低于基础模型每参数 20 个 token 的水平，预计损失会在某个下限处饱和。
2. **是否选择更大的基础模型。** 如果你的预算全部花在推理上，应选择更小、训练更久的模型。
3. **收益递减的边界在哪里。** 超过 Chinchilla 最优值 1000 倍之后，log-loss 的变化就只是噪声了。

**2026 年的研究轨迹：**

- **数据受限的情形。** 高质量 token 在网络上的数量是有限的（过滤后约 5–10 万亿英文 token）。前沿预训练正在逼近这一上限。合成数据、多语言、多模态以及经 RLHF 扩展的微调是下一个杠杆。
- **计算量倍增技巧。** Muon 优化器、MoE、更好的数据策展——每一个都只改变绝对常数，而非渐近线。
- **面向 RL 的缩放定律。** 开放问题。早期证据表明 RL 样本中存在幂律，但指数与预训练截然不同。

## 上线部署

参见 `outputs/skill-training-budget-estimator.md`。该技能在给定计算预算、部署约束和目标损失的条件下，为新训练任务选择 `(N, D, hours, GPU)`。

## 练习

1. **简单。** 运行 `code/main.py`。打印计算预算为 `1e20`、`1e22`、`1e24` 时 Chinchilla 最优的 `(N, D)`。与真实模型表格对比。
2. **中等。** 实现 Hoffmann 的损失-计算量函数曲线。绘制计算最优前沿下损失随 `log10(C)` 的变化。找出该定律预测交叉熵每再降低 0.1 所需的 `>10^28` FLOPs 何时变得不可承受。
3. **困难。** 在同一数据集上训练 5 个微型模型（100K 到 10M 参数），拟合你自己的缩放定律。估计 `α` 和 `E`。你的指数与已发表的指数匹配程度如何？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| 参数（N） | “模型大小” | 非嵌入权重数量；决定容量。 |
| Token（D） | “训练数据” | 看过的训练 token 数量；决定参数被利用的程度。 |
| 计算量（C） | “花费的 FLOPs” | 标准 transformer 约为 `6 × N × D`。 |
| Chinchilla 最优 | “D/N ≈ 20” | 使每 FLOP 预训练损失最小化的比例。 |
| 过度训练 | “超过 Chinchilla” | 额外花费训练 FLOPs 以节省推理 FLOPs；D/N >> 20。 |
| 不可约损失 | “下限” | 缩放定律中的 `E` 项；数据本身的熵。 |
| 涌现能力 | “规模上的突然跃升” | 往往是评分方式的假象；连续损失是平滑的。 |
| 有效计算量 | “训练效率倍增器” | 更好的数据 / 优化器 / 架构能让每一 FLOP 走得更远。 |

## 延伸阅读

- [Kaplan et al. (2020). Scaling Laws for Neural Language Models](https://arxiv.org/abs/2001.08361) — 第一篇缩放定律论文；训练不足。
- [Hoffmann et al. (2022). Training Compute-Optimal Large Language Models](https://arxiv.org/abs/2203.15556) — Chinchilla。
- [Schaeffer et al. (2023). Are Emergent Abilities of Large Language Models a Mirage?](https://arxiv.org/abs/2304.15004) — 涌现作为测量假象。
- [Sardana, Frankle (2024). Beyond Chinchilla-Optimal: Accounting for Inference in Language Model Scaling Laws](https://arxiv.org/abs/2401.00448) — 为什么 Llama 的过度训练对其工作负载是正确的。
- [Jordan et al. (2024). Muon: An optimizer for hidden layers in neural networks](https://kellerjordan.github.io/posts/muon/) — 2 倍计算量倍增器。