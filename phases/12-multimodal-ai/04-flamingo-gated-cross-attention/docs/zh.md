# 04 · Flamingo 与用于少样本 VLM 的门控交叉注意力

> DeepMind 的 Flamingo（2022）做成了两件别人之前没做成的事。它证明了单一模型可以处理任意交错排列的图像、视频和文本序列；它还证明了「视觉语言模型（VLM）」可以做「上下文内学习（in-context learning）」——给出一个包含三组（图像，描述）示例的少样本提示，模型就能为一张新图像生成描述，而无需任何梯度更新步骤。其机制在于：在冻结的 LLM 已有层之间插入门控交叉注意力层，并配以一个可学习的 tanh 门控，该门控初始值为零，从而在初始化时保留了 LLM 的文本能力。本课将逐步剖析 Flamingo 的「Perceiver 重采样器（Perceiver resampler）」与门控交叉注意力架构——它是 Gemini 交错输入和 Idefics2 视觉 token 的鼻祖。

**类型：** 学习
**语言：** Python（标准库，门控交叉注意力 + Perceiver 重采样器演示）
**前置：** 第 12 阶段 · 03（BLIP-2 Q-Former）
**时长：** 约 120 分钟

## 学习目标

- 解释门控交叉注意力如何借助 tanh(gate) = 0 在初始化时保留冻结 LLM 的文本能力。
- 走通一个 Perceiver 重采样器：通过交叉注意力将 N 个图像 patch → K 个固定的「潜变量（latent）」查询。
- 描述 Flamingo 如何用尊重图像位置的因果掩码来处理交错的图文序列。
- 复现一个少样本多模态提示结构（3 组图文示例，随后接一张查询图像）。

## 问题所在

BLIP-2 把 32 个视觉 token 馈入冻结 LLM 的输入层。这对每个提示只含一张图像的情形是可行的。但如果你想馈入*多张*与文本交错的图像呢？比如「这是图像 A，给它配文；这是图像 B，给它配文；现在这是图像 C，给它配文」。LLM 的自注意力将不得不在单一流中同时处理图像 token 和文本 token，而哪些位置可以关注哪些图像的问题会变得非常棘手。

Flamingo 的答案是：完全不改动 LLM 的输入流。在已有的 LLM 块之间插入额外的交叉注意力层。文本 token 仍然像往常一样穿过 LLM 的因果自注意力。每隔几个 LLM 块，文本 token 还会通过一个新的门控层对图像特征做交叉注意力。门控（初始化为零）意味着在第零步时这些新层是恒等操作（no-op）——模型的行为与预训练 LLM 完全一致。随着训练推进，门控逐渐打开，视觉信息开始流入。

Flamingo 回答的第二个问题是：如何处理每个提示中数量可变（0 张、1 张或多张）的图像？答案是 Perceiver 重采样器——一个小型交叉注意力模块，它接收任意数量的 patch，并产出固定数量的视觉潜变量 token。无论提示中有多少张图像，LLM 的交叉注意力层看到的形状都是相同的。

## 核心概念

### 冻结的 LLM

Flamingo 以一个冻结的 Chinchilla 70B LLM 为起点。全部 70B 权重保持不变。已有的文本自注意力与 FFN 正常运作。

### Perceiver 重采样器

对于提示中的每张图像，ViT 会产出 N 个 patch token。Perceiver 重采样器拥有 K 个固定的可学习潜变量（Flamingo 取 K=64）。每个重采样器块包含两个子步骤：

1. 交叉注意力：K 个潜变量关注 N 个 patch token（Q 来自潜变量，K/V 来自 patch）。
2. 在潜变量内部做自注意力 + FFN。

经过 6 个重采样器块后，输出为 K=64 个维度为 1024 的视觉 token，无论 ViT 产出了多少个 patch。一张 224x224 的图像（196 个 patch）和一张 480x480 的图像（900 个 patch）都会以 64 个重采样器 token 的形式输出。

对于视频，重采样器在时间维度上应用：每一帧的 patch 产出 64 个潜变量，并由一个时间位置编码让模型能够区分 t=0 与 t=N。整段视频变为 T * 64 个视觉 token。

### 门控交叉注意力

在冻结 LLM 每隔 M 层（Flamingo 取 M=4）处，插入一个新的门控交叉注意力块：

```
x_after_llm_block = llm_block(x_before)
cross = cross_attn(x_after, resampler_output)
gated = tanh(alpha) * cross + x_after
x_before_next_block = gated
```

- `alpha` 是一个初始化为零的可学习标量。
- `tanh(0) = 0`，因此在初始化时门控分支的贡献为零。
- 当 `alpha` 偏离零时，交叉注意力的贡献会平滑增长。
- 残差连接意味着即便门控完全打开，也不会覆盖 LLM 的文本表示；它只是在其之上叠加视觉信息。

这是 Flamingo 中最重要的单一设计抉择：视觉条件化是叠加式的、门控的、且在初始化时为零。第 0 步的 Flamingo 在纯文本输入上就是一个完美的 Chinchilla 70B。

### 用于交错输入的掩码交叉注意力

在形如 "<image A> caption A <image B> caption B <image C> ?" 的提示中，每个文本 token 应当只能看到序列中位于它之前的图像。交叉注意力掩码强制如下规则：位置 `t` 处的文本 token 只关注那些图像索引 `i < i_t` 的图像重采样器 token，其中 `i_t` 是位置 `t` 之前最近的那张图像。「只看到紧邻其前的那张图像」与「看到前面所有图像」都是有效的选择；Flamingo 选择了前者。

### 上下文内少样本学习

一个 Flamingo 提示看起来是这样的：

```
<image1> A photo of a cat. <image2> A photo of a dog. <image3> A photo of a
```

模型看出这种补全模式，并输出 "bird"（或 image3 所展示的任何内容）。无需任何梯度更新步骤。冻结 LLM 的上下文内学习能力贯穿了门控交叉注意力——这正是该论文的点睛之处，也是它意义重大的原因。

### 训练数据

Flamingo 在三个数据集上训练：

1. MultiModal MassiveWeb（M3W）：4300 万个图文交错的网页，重建了阅读顺序。
2. 图文对（ALIGN + LTIP）：44 亿个图文对。
3. 视频文本对（VTP）：2700 万个短视频片段。

OBELICS（2023）是交错网页语料的开源复现，Idefics、Idefics2 以及大多数开源的「类 Flamingo」模型都在其上训练。

### OpenFlamingo 与 Otter

OpenFlamingo（2023）是开源复现版本。架构完全相同（在冻结的 LLaMA 或 MPT 之上使用 Perceiver 重采样器 + 门控交叉注意力）。提供 3B、4B、9B 的检查点。由于基座 LLM 更小、数据更少，其质量逊于 Flamingo。

Otter（2023）在 OpenFlamingo 基础上，使用 MIMIC-IT（一个多模态指令数据集）做指令微调，证明了门控交叉注意力同样适用于指令跟随。

### 后裔谱系

- Idefics / Idefics2 / Idefics3：Hugging Face 的门控交叉注意力血脉，逐代趋于更简单（Idefics2 弃用了重采样器，转而采用配以自适应池化的直接 patch token）。
- Flamingo 到 Chameleon 的转变：到 2024 年，许多团队转向了「早融合（early-fusion）」（见第 12.11 课）；在需要冻结骨干网络的生产场景中，Flamingo 风格的门控交叉注意力依然存在。
- Gemini 的交错输入：在概念上继承了 Flamingo 交错格式的灵活性，尽管其确切机制是专有的。

### 与 BLIP-2 的对比

| | BLIP-2 | Flamingo |
|---|---|---|
| 视觉桥接 | 在输入处使用一次 Q-Former | 每隔 M 层使用门控交叉注意力 |
| 视觉 token | 每张图像 32 个 | 每张图像每个交叉注意力层 64 个 |
| 冻结 LLM | 是 | 是 |
| 少样本上下文内学习 | 弱 | 强——论文的核心亮点 |
| 交错输入 | 无原生支持 | 是，正是其设计目标 |
| 训练数据 | 1.3 亿个图文对 | 13 亿个图文对 + 4300 万个交错网页 |
| 参数量 | 训练 188M | 训练约 10B（交叉注意力层） |
| 算力 | 8 张 A100 上数天 | 数千张 TPUv4 上数周 |

预算有限的单图像 VQA 选 BLIP-2。需要交错、少样本或多图像推理则选 Flamingo/Idefics2。

## 动手用

`code/main.py` 演示了：

1. 一个 Perceiver 重采样器，在 36 个伪造的 patch token 上使用 8 个可学习潜变量（纯 Python 实现的交叉注意力）。
2. 一个门控交叉注意力步骤：`alpha = 0` → 输出等于输入（LLM 不变），然后 `alpha = 2.0` → 视觉贡献被混入。
3. 一个交错掩码构造器，为 "(image 1) (text 1) (image 2) (text 2)" 序列产出对应的 2D 注意力掩码。

## 上线交付

本课产出 `outputs/skill-gated-bridge-diagnostic.md`。给定一个开源 VLM 的配置（是否有重采样器、交叉注意力频率、门控方案），它会识别出其中的 Flamingo 血脉要素，并解释冻结策略。这对于排查为何某次微调反而降低了文本性能很有用（答案：门控开得太快、太宽）。

## 练习

1. 计算 Flamingo-9B 的视觉参数量：9B LLM + 1.4B 门控交叉注意力层 + 64M 重采样器。被训练的参数占总参数的多少？

2. 在 PyTorch 中实现门控残差 `y = tanh(alpha) * cross + x`。用实验证明：当 `alpha=0` 时，初始化阶段 `y==x` 严格成立。

3. 阅读 OpenFlamingo 的 3.2 节（arXiv:2308.01390），了解当一个批次中每个提示的图像数量不同时，他们如何处理批内的多张图像。描述其填充（padding）策略。

4. 为什么 Flamingo 的交叉注意力掩码让一个文本 token *只*关注紧邻其前的那张图像，而不是前面所有图像？阅读 Flamingo 论文 2.4 节并解释这一权衡。

5. 上下文内少样本：为一个新的 Flamingo 变体构造一个包含 4 个「图像 → 主体物的颜色」示例的提示。描述当你把示例数量从 0 变到 8 时，预期的准确率变化模式。

## 关键术语

| 术语 | 人们常说 | 实际含义 |
|------|----------------|------------------------|
| Perceiver 重采样器（Perceiver resampler） | 「固定潜变量交叉注意力」 | 从数量可变的输入 patch 产出 K 个固定 token 的模块 |
| 门控交叉注意力（Gated cross-attention） | 「Tanh 门控桥」 | 残差层 `y = tanh(alpha)*cross + x`，alpha 可学习，初始为 0 |
| 交错输入（Interleaved input） | 「混合序列」 | 图像与文本按阅读顺序自由混合的提示格式 |
| 冻结 LLM（Frozen LLM） | 「LLM 无梯度」 | 文本 LLM 的权重不更新；只训练重采样器 + 交叉注意力层 |
| 少样本（Few-shot） | 「上下文内示例」 | 在提示中给出少量（图像，答案）对；模型无需微调即可泛化 |
| OBELICS | 「交错网页语料」 | 一个开源数据集，含 1.41 亿个按阅读顺序排列图文的网页 |
| Chinchilla | 「70B 冻结基座」 | Flamingo 的冻结文本 LLM，源自 DeepMind 的 Chinchilla 论文 |
| 门控调度（Gate schedule） | 「alpha 如何变化」 | 训练过程中交叉注意力门控打开的速率 |
| 交叉注意力频率（Cross-attn frequency） | 「每 M 层」 | 多久插入一个门控交叉注意力块；Flamingo 取 M=4 |
| OpenFlamingo | 「开源复现」 | MosaicML/LAION 在 3-9B 规模的开源检查点；架构与 Flamingo 完全一致 |

## 延伸阅读

- [Alayrac 等 — Flamingo（arXiv:2204.14198）](https://arxiv.org/abs/2204.14198) — 原始论文。
- [Awadalla 等 — OpenFlamingo（arXiv:2308.01390）](https://arxiv.org/abs/2308.01390) — 开源复现。
- [Laurençon 等 — OBELICS（arXiv:2306.16527）](https://arxiv.org/abs/2306.16527) — 交错网页语料。
- [Jaegle 等 — Perceiver IO（arXiv:2107.14795）](https://arxiv.org/abs/2107.14795) — 通用 Perceiver 架构。
- [Li 等 — Otter（arXiv:2305.03726）](https://arxiv.org/abs/2305.03726) — 经指令微调的 Flamingo 后裔。
- [Laurençon 等 — Idefics2（arXiv:2405.02246）](https://arxiv.org/abs/2405.02246) — Flamingo 方法的现代简化版。
