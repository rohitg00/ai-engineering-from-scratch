# Flamingo 与门控 Cross-Attention 用于 Few-Shot VLM

> DeepMind 的 Flamingo（2022）在别人之前做了两件事。它表明单个模型可以处理任意交错的图像、视频和文本序列。它表明 VLM 可以上下文学习——给一个包含三个示例（图像，标题）对的 few-shot prompt，模型无需任何梯度步骤就能为新图像生成标题。机制：门控 cross-attention 层，插入在冻结 LLM 的现有层之间，带一个可学习的 tanh 门，从零开始初始化，因此 LLM 的文本能力在初始化时得以保留。本课走过 Flamingo 的 Perceiver resampler 和门控 cross-attention 架构——Gemini 交错输入和 Idefics2 视觉 token 的祖先。

**类型：** Learn
**语言：** Python（stdlib，门控 cross-attention + Perceiver resampler 演示）
**前置知识：** Phase 12 · 03（BLIP-2 Q-Former）
**时间：** ~120 分钟

## 学习目标

- 解释门控 cross-attention 如何通过 tanh(gate) = 0 在初始化时保留冻结 LLM 的文本能力。
- 走过 Perceiver resampler：N 个图像 patch → K 个固定"潜在"query 通过 cross-attention。
- 描述 Flamingo 如何处理交错图像-文本序列，使用尊重图像放置的因果掩码。
- 复现一个 few-shot 多模态 prompt 结构（3 个图像-标题示例，然后一个查询图像）。

## 问题所在

BLIP-2 将 32 个视觉 token 喂入冻结 LLM 的输入层。对每张图像一个 prompt 有效。但如果你想喂*许多*与文本交错的图像，比如"这是图像 A，给它生成标题；这是图像 B，给它生成标题；现在这是图像 C，给它生成标题"呢？LLM 的自注意力需要处理单一流中的图像 token 和文本 token，而哪些位置可以关注哪些图像的问题变得棘手。

Flamingo 的答案：根本不改变 LLM 的输入流。在现有 LLM block 之间插入额外的 cross-attention 层。文本 token 仍然像往常一样流过 LLM 的因果自注意力。在每几个 LLM block 之间，文本 token 也通过新的门控层 cross-attend 到图像特征。门（初始化为零）意味着在步骤零时新层是 no-op——模型表现得与预训练 LLM 完全相同。随着训练进行，门打开，视觉信息开始流动。

Flamingo 回答的第二个问题：如何处理每个 prompt 中可变数量的图像（0、1 或许多）？Perceiver resampler——一个小的 cross-attention 模块，接收你拥有的任何数量的 patch 并产生固定数量的视觉潜在 token。LLM cross-attention 层无论 prompt 中有多少图像都看到相同的形状。

## 核心概念

### 冻结 LLM

Flamingo 从冻结的 Chinchilla 70B LLM 开始。所有 700 亿权重未触碰。现有的文本自注意力和 FFN 正常操作。

### Perceiver resampler

对于 prompt 中的每张图像，ViT 产生 N 个 patch token。Perceiver resampler 有 K 个固定的可学习潜在向量（Flamingo 使用 K=64）。每个 resampler block 是两个子步骤：

1. Cross-attention：K 个潜在向量关注 N 个 patch token（Q 来自潜在向量，K/V 来自 patch）。
2. 潜在向量内的 Self-attention + FFN。

6 个 resampler block 后，输出是 K=64 个 dim 1024 的视觉 token，无论 ViT 产生了多少 patch。224x224 图像（196 个 patch）和 480x480 图像（900 个 patch）都退出为 64 个 resampler token。

对于视频，resampler 在时间维度上应用：每帧的 patch 产生 64 个潜在向量，时间位置编码让模型区分 t=0 和 t=N。完整视频变成 T * 64 个视觉 token。

### 门控 cross-attention

在冻结 LLM 的每 M 层之间（Flamingo 使用 M=4），插入一个新的门控 cross-attention block：

```
x_after_llm_block = llm_block(x_before)
cross = cross_attn(x_after, resampler_output)
gated = tanh(alpha) * cross + x_after
x_before_next_block = gated
```

- `alpha` 是初始化为零的可学习标量。
- `tanh(0) = 0`，因此在 init 时门控分支贡献为零。
- 随着 `alpha` 偏离零，cross-attention 贡献平滑增长。
- 残差连接意味着即使完全打开的门也不会覆盖 LLM 的文本表示；它只是在其上添加视觉信息。

这是 Flamingo 中最重要的单一设计选择：视觉条件是加性的、门控的、在初始化时为零。步骤 0 的 Flamingo 在纯文本输入上是完美的 Chinchilla 70B。

### 交错输入的掩码 cross-attention

在类似 "<image A> caption A <image B> caption B <image C> ?" 的 prompt 中，每个文本 token 应该只看到序列中在它之前的图像。Cross-attention 掩码强制执行：位置 `t` 的文本 token 只关注图像索引 `i < i_t` 的图像 resampler token，其中 `i_t` 是位置 `t` 之前最近的图像。"只看最近的前一张图像"或"看所有前面的图像"都是有效选择；Flamingo 选择了前者。

### 上下文 few-shot 学习

Flamingo prompt 看起来像这样：

```
<image1> A photo of a cat. <image2> A photo of a dog. <image3> A photo of a
```

模型看到完成模式并输出"bird"（或 image3 显示的任何内容）。无需梯度步骤。冻结 LLM 的上下文学习能力通过门控 cross-attention 传递——这是论文的 punchline 和为什么它重要。

### 训练数据

Flamingo 在三个数据集上训练：

1. MultiModal MassiveWeb (M3W)：4300 万个交错图像和文本的网页，重建阅读顺序。
2. 图像-文本对（ALIGN + LTIP）：44 亿对。
3. 视频-文本对（VTP）：2700 万个短视频剪辑。

OBELICS（2023）是交错网页语料库的开源复现，Idefics、Idefics2 和大多数开源"Flamingo 风格"模型在其上训练。

### OpenFlamingo 和 Otter

OpenFlamingo（2023）是开源复现。架构相同（Perceiver resampler + 冻结 LLaMA 或 MPT 上的门控 cross-attention）。Checkpoint 在 3B、4B、9B。由于较小的基础 LLM 和较少数据，质量落后于 Flamingo。

Otter（2023）在 MIMIC-IT（多模态指令数据集）上对 OpenFlamingo 进行指令微调，表明门控 cross-attention 也适用于指令遵循。

### 后代

- Idefics / Idefics2 / Idefics3：Hugging Face 的门控 cross-attention 谱系，逐步简化（Idefics2 放弃 resampler，改用直接 patch token 加自适应池化）。
- Flamingo 到 Chameleon 的过渡：到 2024 年，许多团队转向早期融合（第 12.11 课）；在需要冻结 backbone 的生产中，Flamingo 风格的门控 cross-attention 仍然存在。
- Gemini 的交错输入：概念上继承 Flamingo 的交错格式灵活性，尽管确切机制是专有的。

### 与 BLIP-2 比较

| | BLIP-2 | Flamingo |
|---|---|---|
| 视觉桥梁 | 输入层一次 Q-Former | 每 M 层的门控 cross-attention |
| 视觉 token | 每张图像 32 个 | 每张图像每层 cross-attn 64 个 |
| 冻结 LLM | 是 | 是 |
| Few-shot 上下文 | 弱 | 强——论文的核心 |
| 交错输入 | 无原生支持 | 是，设计目标 |
| 训练数据 | 1.3 亿对 | 13 亿对 + 4300 万交错页面 |
| 参数量 | 1.88 亿训练 | ~100 亿训练（cross-attn 层） |
| 计算 | 8 个 A100 上几天 | 数千个 TPUv4 上几周 |

预算内单图像 VQA 选 BLIP-2。交错、few-shot 或多图像推理选 Flamingo/Idefics2。

## 使用它

`code/main.py` 演示：

1. 在 36 个假 patch token 上的 Perceiver resampler，带 8 个可学习潜在向量（纯 Python cross-attention）。
2. `alpha = 0` 的门控 cross-attention 步骤 → 输出等于输入（LLM 不变），然后 `alpha = 2.0` → 视觉贡献混合进来。
3. 交错掩码构建器，为"(image 1) (text 1) (image 2) (text 2)"序列产生 2D 注意力掩码。

## 交付它

本课产出 `outputs/skill-gated-bridge-diagnostic.md`。给定开源 VLM 的配置（resampler 有/无、cross-attn 频率、门方案），它识别 Flamingo 谱系元素并解释冻结策略。对调试为什么微调 degraded 文本性能有用（答案：门开得太快太宽）。

## 练习

1. 计算 Flamingo-9B 的视觉参数量：9B LLM + 1.4B 门控 cross-attention 层 + 64M resampler。总参数中训练的比例是多少？

2. 在 PyTorch 中实现门控残差 `y = tanh(alpha) * cross + x`。实验证明 `alpha=0` 时，`y==x` 在 init 时精确成立。

3. 阅读 OpenFlamingo 第 3.2 节（arXiv:2308.01390）关于当每个 prompt 有不同图像数量时如何处理 batch 中的多张图像。描述填充策略。

4. 为什么 Flamingo 的 cross-attention 掩码让文本 token 只关注*最近的*前一张图像，而不是所有前面的图像？阅读 Flamingo 论文第 2.4 节并解释权衡。

5. 上下文 few-shot：为一个新的 Flamingo 变体构建一个包含 4 个"图像 → 主要对象颜色"示例的 prompt。描述当你将示例数量从 0 变到 8 时的预期准确率模式。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Perceiver resampler | "固定潜在 cross-attention" | 从可变数量输入 patch 产生 K 个固定 token 的模块 |
| 门控 cross-attention | "Tanh 门控桥梁" | 残差层 `y = tanh(alpha)*cross + x`，可学习 alpha，init 0 |
| 交错输入 | "混合序列" | 图像和文本按阅读顺序自由混合的 prompt 格式 |
| 冻结 LLM | "无 LLM 梯度" | 文本 LLM 的权重不更新；只有 resampler + cross-attn 层训练 |
| Few-shot | "上下文示例" | 在 prompt 中给几个（图像，答案）对；模型无需微调即可泛化 |
| OBELICS | "交错网页语料库" | 1.41 亿个图像和文本按阅读顺序排列的网页的开源数据集 |
| Chinchilla | "70B 冻结基础" | Flamingo 的冻结文本 LLM，来自 DeepMind 的 Chinchilla 论文 |
| 门调度 | "alpha 如何移动" | Cross-attention 门在训练期间打开的速度 |
| Cross-attn 频率 | "每 M 层" | 门控 cross-attention block 插入的频率；Flamingo 使用 M=4 |
| OpenFlamingo | "开源复现" | MosaicML/LAION 在 3-9B 的开源 checkpoint；架构与 Flamingo 相同 |

## 延伸阅读

- [Alayrac et al. — Flamingo (arXiv:2204.14198)](https://arxiv.org/abs/2204.14198)——原始论文。
- [Awadalla et al. — OpenFlamingo (arXiv:2308.01390)](https://arxiv.org/abs/2308.01390)——开源复现。
- [Laurençon et al. — OBELICS (arXiv:2306.16527)](https://arxiv.org/abs/2306.16527)——交错网页语料库。
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795)——通用 Perceiver 架构。
- [Li et al. — Otter (arXiv:2305.03726)](https://arxiv.org/abs/2305.03726)——指令微调的 Flamingo 后代。
- [Laurençon et al. — Idefics2 (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)——Flamingo 方法的现代简化。
