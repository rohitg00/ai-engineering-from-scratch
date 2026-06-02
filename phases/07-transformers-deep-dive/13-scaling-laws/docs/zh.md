# Scaling Laws（缩放定律）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2020 年的 Kaplan 那篇说：模型越大，loss 越低。2022 年的 Hoffmann 那篇说：你训得太少了。训练计算量分到两个桶里——参数量和 token 数——怎么分并不显然。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## 问题（The Problem）

当你手上有 C FLOPs 的训练算力、想训出最好的模型时，你面对两个旋钮：

1. **多少参数（N）？** 模型越大，容量越高。
2. **多少训练 token（D）？** 数据越多，越能把容量用足。

FLOPs 大致按 `6 × N × D` 缩放。你可以把 N 推高、D 压低，也可以反过来。哪种更好？

2022 年之前，答案是「狠推 N」。GPT-3（2020）有 175B 参数，训了约 300B token，每个参数大约对应 1.7 个 token。Kaplan 的 scaling laws 给这条路背书。

Hoffmann 等人（2022）训练了一个叫 Chinchilla 的小模型家族，发现了不一样的结论：最优比例其实接近 **每个参数 20 个 token**。GPT-3 训练量只有十分之一。Chinchilla（70B 参数、1.4T token）在所有 benchmark 上都打过了 GPT-3（175B、300B token），同时推理成本只有它的 1/2.5。

2026 年是 Chinchilla 的世界——但加了一个重要拐点。Llama 3 8B 用了 15 万亿 token 训练，比例是每个参数 1875 个 token。比 Chinchilla 最优值高出 94 倍。对那些会被大规模使用的模型，推理成本比训练成本更重要，所以为了更小的可部署规模而「过训练」（超过 Chinchilla 点）成了 2026 年的默认做法。

## 概念（The Concept）

![Chinchilla curves: loss vs compute at various N/D ratios](../assets/scaling-laws.svg)

### Hoffmann 定律（The Hoffmann law）

按 Chinchilla 论文的结论，loss 满足：

```
L(N, D) = A / N^α + B / D^β + E
```

- `N` = 参数量（不含 embedding）。
- `D` = 训练 token 数。
- `α ≈ 0.34`，`β ≈ 0.28`（大致对称）。
- `E ≈ 1.69`，不可约 loss 上限。
- `A ≈ 406`，`B ≈ 411`。

随着规模增长，两项相互拉扯。在算力固定（C = 6ND）下对 `N` 求导并求解：

```
N_opt ≈ 0.6 × (C/6)^0.5
D_opt ≈ 0.6 × (C/6)^0.5
D_opt / N_opt ≈ 20
```

算力最优：每个参数 20 个 token。

### 那为什么还要过训练（Why over-training anyway）

Chinchilla 最优是「每 FLOP 训练 loss 最低」。但训练成本只付一次，推理成本要付一辈子。

对于一个每月服务一万亿 token 的聊天机器人，推理主导了总成本。Llama 的做法是：训得更小、训得更久。8B 模型配 15T token 是为推理深度优化过的：

- 能装进消费级 GPU。
- 延迟只有 70B Chinchilla 最优模型的零头。
- 多数任务的质量已经够用。

DeepMind 在 2024 年的论文（《Over-training is the new optimal》）把这件事形式化了。对推理主导的工作负载，正确的比例更接近每个参数 100–500 个 token，具体取决于服务量。

### 涌现 vs 平滑（Emergence vs smoothness）

有种说法：某些能力（算术、多步推理、跟随 chain-of-thought）会在某个规模上「突然涌现」。

Schaeffer 等人（2023）反驳说这是测量伪影：涌现指标用的是不连续的打分（精确匹配、达阈值才算正确），把底层 logits 上平滑的进步给藏起来了。换成连续指标（cross-entropy）就能看到平滑曲线。

2026 年的共识是：用连续 loss 做预测是可靠的。benchmark 上的跳跃多半是打分器伪影。做预算时要盯着连续指标。

### 2026 年的图景（The 2026 picture）

scaling laws 还在生效，但是：

| 因素 | 改变了什么 |
|--------|-------------|
| 数据质量 | 精挑「优质」token（Phi 风格）能把曲线整体抬高 >2× 等效算力 |
| MoE | 总参数量与活跃 FLOPs 解耦；scaling laws 要按「每个活跃 FLOP」来算 |
| Post-training | 部分能力（指令跟随、代码）受 SFT+RLHF 的影响比预训练更大 |
| 多模态 | 图像 + 文本 token 一起缩放；每种模态有自己的曲线 |
| 合成数据 | 模型自己生成训练数据；等效算力可以叠加增长 |

Muon optimizer（Kimi Moonlight，2024）展示出在等量数据下相对 AdamW 大约 2× 的等效算力收益。一些 2026 年的训练默认就用 Muon。它改的是 scaling law 的绝对常数，不是形状。

## 动手实现（Build It）

见 `code/main.py`。我们会实现 Chinchilla 的 loss 方程，并在若干算力预算下求出算力最优的 `(N, D)`。

### Step 1: Chinchilla loss

```python
def chinchilla_loss(N, D, A=406.4, B=410.7, alpha=0.34, beta=0.28, E=1.69):
    return A / N ** alpha + B / D ** beta + E
```

在固定 `C = 6ND` 下，把 `L` 当作 `(N, D)` 的等高线画出来，找最小值。

### Step 2: 算力最优前沿（compute-optimal frontier）

让算力预算从 `1e17` 跑到 `1e25` FLOPs，在约束 `6ND = C` 下求最小化 loss 的 `(N, D)`。验证比例 `D/N ≈ 20`。

### Step 3: 过训练成本（over-training cost）

计算把模型缩小 10×（参数量为最优 N 的 1/10、token 数为最优 D 的 10×）需要多付多少 loss。同时报告作为交换得到的推理 FLOP 节省（与 N 成正比）。

### Step 4: 对照真实模型（compare to real models）

代入已知的 GPT-3、Chinchilla、Llama 3 8B、DeepSeek-V3（活跃参数）的 `(N, D)`，比较预测 loss 与论文报告的 loss。

## 用起来（Use It）

你大概率不会自己训一个前沿模型。但 scaling laws 能告诉你：

1. **你的微调数据够不够。** 如果你任务相关数据低于基础模型「每个参数 20 个 token」，预期会在某个 loss 下界处饱和。
2. **要不要换一个更大的基础模型。** 如果预算几乎都花在推理上，优先选一个更小、训得更久的模型。
3. **回报在哪儿见底。** 超过 Chinchilla 最优 1000× 之后，log-loss 的变化已经淹没在噪声里。

**2026 年的研究方向：**

- **数据受限态势。** Web 上高质量 token 数量有限（过滤后约 5–10 万亿英文 token）。前沿预训练正在逼近这个天花板。合成数据、多语言、多模态、以及 RLHF 规模的微调，是接下来的杠杆。
- **算力乘数技巧。** Muon optimizer、MoE、更精细的数据筛选——每个都在改绝对常数，不动渐近线。
- **RL 的 scaling laws。** 仍是开放问题。早期证据指向 RL 样本上的幂律，但指数与预训练差别很大。

## 上线部署（Ship It）

见 `outputs/skill-training-budget-estimator.md`。这个 skill 在给定算力预算、部署约束、目标 loss 的条件下，挑选 `(N, D, hours, GPU)` 用于新的训练。

## 练习（Exercises）

1. **Easy.** 跑 `code/main.py`。打印算力预算 `1e20`、`1e22`、`1e24` 下的 Chinchilla 最优 `(N, D)`，与真实模型表对照。
2. **Medium.** 实现 Hoffmann 的「loss 关于算力」的曲线。把算力最优前沿上的 loss 对 `log10(C)` 画出来。找出该定律预测下，下一次让 cross-entropy 再降 0.1 需要 `>10^28` FLOPs 的位置。
3. **Hard.** 在同一份数据集上训练 5 个小模型（100K 到 10M 参数），自己拟合一条 scaling law。估计 `α` 和 `E`。你算出的指数与已发表值吻合度如何？

## 关键术语（Key Terms）

| Term | 大家是怎么说的 | 它实际是什么 |
|------|-----------------|-----------------------|
| Parameters (N) | 「模型大小」 | 非 embedding 权重数；决定容量。 |
| Tokens (D) | 「训练数据」 | 看过的训练 token 数；决定参数被用得多好。 |
| Compute (C) | 「花掉的 FLOPs」 | 标准 transformer 大约是 `6 × N × D`。 |
| Chinchilla-optimal | 「D/N ≈ 20」 | 让预训练每 FLOP loss 最低的比例。 |
| Over-training | 「超过 Chinchilla」 | 多花训练 FLOPs 来省推理 FLOPs；D/N >> 20。 |
| Irreducible loss | 「下界」 | scaling law 中的 `E` 项；数据本身的熵。 |
| Emergent capability | 「在某规模处突然跳跃」 | 多半是打分器伪影；连续 loss 是平滑的。 |
| Effective compute | 「训练效率乘数」 | 更好的数据 / optimizer / 架构能让一个 FLOP 走得更远。 |

## 延伸阅读（Further Reading）

- [Kaplan et al. (2020). Scaling Laws for Neural Language Models](https://arxiv.org/abs/2001.08361) — 第一篇 scaling law 论文；训练量不足。
- [Hoffmann et al. (2022). Training Compute-Optimal Large Language Models](https://arxiv.org/abs/2203.15556) — Chinchilla。
- [Schaeffer et al. (2023). Are Emergent Abilities of Large Language Models a Mirage?](https://arxiv.org/abs/2304.15004) — 涌现作为测量伪影。
- [Sardana, Frankle (2024). Beyond Chinchilla-Optimal: Accounting for Inference in Language Model Scaling Laws](https://arxiv.org/abs/2401.00448) — 为什么 Llama 的过训练对它的工作负载是对的。
- [Jordan et al. (2024). Muon: An optimizer for hidden layers in neural networks](https://kellerjordan.github.io/posts/muon/) — 2× 算力乘数。
