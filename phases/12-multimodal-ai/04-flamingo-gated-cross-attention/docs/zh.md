# Flamingo 与门控 cross-attention：用于 few-shot VLM 的桥梁

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> DeepMind 的 Flamingo（2022）抢先做成了两件事：第一，证明单个模型可以处理任意交错排列的图像、视频与文本序列；第二，证明 VLM 也能 in-context 学习——在 prompt 里给三对 (图像, 描述) 的 few-shot 示例，模型不做任何梯度更新就能给一张新图写描述。背后的机制是 gated cross-attention（门控 cross-attention）层：插入在冻结 LLM 的现有层之间，配上一个初始为零的可学习 tanh 门控，让 LLM 的文本能力在初始化时原样保留。本课会走一遍 Flamingo 的 Perceiver resampler 与 gated cross-attention 架构——它正是 Gemini 交错输入和 Idefics2 视觉 token 的祖先。

**Type:** Learn
**Languages:** Python (stdlib, gated cross-attention + Perceiver resampler demo)
**Prerequisites:** Phase 12 · 03 (BLIP-2 Q-Former)
**Time:** ~120 minutes

## 学习目标（Learning Objectives）

- 解释 gated cross-attention 如何通过 `tanh(gate) = 0` 在初始化时保留冻结 LLM 的文本能力。
- 走一遍 Perceiver resampler：N 个图像 patch → 通过 cross-attention 变成 K 个固定的「latent」query。
- 描述 Flamingo 如何用尊重图像位置的 causal mask 处理图文交错序列。
- 复现一个 few-shot 多模态 prompt 的结构（3 对图文示例 + 1 张待查询图像）。

## 问题（The Problem）

BLIP-2 把 32 个视觉 token 喂进冻结 LLM 的输入层。每条 prompt 一张图时这套很顺。可一旦你想把*多张*图像和文本交错喂进去——比如「这是图 A，给它写描述；这是图 B，给它写描述；现在这是图 C，给它写描述」——LLM 的 self-attention 就得在一条流里同时处理图像 token 和文本 token，到底哪些位置可以 attend 到哪些图像，问题立刻变得纠结起来。

Flamingo 的答案：完全不动 LLM 的输入流。在原本 LLM 的 block 之间插进额外的 cross-attention 层。文本 token 照旧走 LLM 的 causal self-attention；每隔几个 LLM block，文本 token 还会通过一个新的门控层 cross-attend 到图像特征上。门控初始化为零，意味着第 0 步这些新层是 no-op——模型表现得跟预训练 LLM 一模一样。训练推进，门控逐渐打开，视觉信息开始流入。

Flamingo 回答的第二个问题：每条 prompt 的图像数量可变（0、1 或多张），怎么办？用 Perceiver resampler——一个小的 cross-attention 模块，不管你给它多少 patch，它都输出固定数量的视觉 latent token。LLM 的 cross-attention 层无论 prompt 里有几张图，看到的形状都一样。

## 概念（The Concept）

### 冻结的 LLM（The frozen LLM）

Flamingo 的起点是冻结的 Chinchilla 70B LLM。70B 权重一个不动。原有的文本 self-attention 与 FFN 照常工作。

### Perceiver resampler

prompt 里每张图，ViT 都会产出 N 个 patch token。Perceiver resampler 有 K 个固定可学习的 latent（Flamingo 取 K=64）。每个 resampler block 分两步：

1. Cross-attention：K 个 latent 对 N 个 patch token 做 attend（Q 来自 latent，K/V 来自 patch）。
2. 在 latent 内部做 self-attention + FFN。

经过 6 个 resampler block，输出固定是 K=64 个、维度 1024 的视觉 token，不管 ViT 给了多少 patch。224×224 的图（196 patch）和 480×480 的图（900 patch），出来都是 64 个 resampler token。

视频则在时间维上套一遍 resampler：每帧 patch 产生 64 个 latent，再加一个时间位置编码让模型分得清 t=0 和 t=N。整段视频变成 T × 64 个视觉 token。

### Gated cross-attention

每隔 M 个冻结 LLM 层（Flamingo 取 M=4），插入一个新的 gated cross-attention block：

```
x_after_llm_block = llm_block(x_before)
cross = cross_attn(x_after, resampler_output)
gated = tanh(alpha) * cross + x_after
x_before_next_block = gated
```

- `alpha` 是可学习的标量，初始化为零。
- `tanh(0) = 0`，所以初始化时门控分支贡献为零。
- `alpha` 离开零之后，cross-attention 的贡献平滑增大。
- 残差连接意味着：哪怕门控开到最大，也只是在 LLM 的文本表征上*叠加*视觉信息，而不会覆盖它。

这是 Flamingo 最重要的设计抉择：视觉条件以加性、门控、初始化为零的方式注入。第 0 步的 Flamingo 在纯文本输入上等于一个完美的 Chinchilla 70B。

### 交错输入的 masked cross-attention

一条 prompt 形如 `<image A> caption A <image B> caption B <image C> ?`，每个文本 token 只应看到序列里出现在它*之前*的图像。cross-attention 的 mask 强制：位置 `t` 的文本 token 只 attend 到图像索引 `i < i_t` 的 resampler token，其中 `i_t` 是位置 `t` 之前最近的那张图像。「只看最近的前一张图」或「看所有前面的图」都是合法选择；Flamingo 选了前者。

### In-context few-shot 学习

一条 Flamingo prompt 长这样：

```
<image1> A photo of a cat. <image2> A photo of a dog. <image3> A photo of a
```

模型识别出这套补全模式，输出 "bird"（或者 image3 实际是什么就输出什么）。没有梯度更新。冻结 LLM 的 in-context learning 能力穿过 gated cross-attention 一路保留下来——这正是论文的点睛之笔，也是它重要的原因。

### 训练数据

Flamingo 在三类数据集上训练：

1. MultiModal MassiveWeb (M3W)：4300 万张网页，图文交错，按阅读顺序还原。
2. Image-Text Pairs (ALIGN + LTIP)：44 亿对图文。
3. Video-Text Pairs (VTP)：2700 万条短视频。

OBELICS（2023）是这套交错网页语料的开源复刻，Idefics、Idefics2 以及大多数开源「Flamingo-like」模型都在它上面训练。

### OpenFlamingo 与 Otter

OpenFlamingo（2023）是开源复刻。架构完全相同（Perceiver resampler + 在冻结的 LLaMA 或 MPT 上做 gated cross-attention），checkpoint 有 3B、4B、9B 三档。质量比 Flamingo 弱，因为 base LLM 更小、数据更少。

Otter（2023）在 OpenFlamingo 之上用 MIMIC-IT（一个多模态指令数据集）做指令微调，证明 gated cross-attention 同样能搞定 instruction following。

### 后裔（The descendants）

- Idefics / Idefics2 / Idefics3：Hugging Face 这条 gated cross-attention 路线，逐步简化（Idefics2 干脆抛掉 resampler，改用 patch token 直接喂 + 自适应 pooling）。
- Flamingo 到 Chameleon 的过渡：到 2024 年，许多团队转向 early-fusion（见 Lesson 12.11）；Flamingo 风格的 gated cross-attention 仍在「必须冻结 backbone」的生产环境里活着。
- Gemini 的交错输入：在概念上继承了 Flamingo 的交错格式灵活性，尽管确切机制是闭源的。

### 与 BLIP-2 的对比

| | BLIP-2 | Flamingo |
|---|---|---|
| 视觉桥梁 | Q-Former 仅在输入处接入一次 | 每隔 M 层插入 gated cross-attention |
| 视觉 token | 每张图 32 个 | 每张图、每个 cross-attn 层 64 个 |
| 冻结 LLM | 是 | 是 |
| Few-shot in-context | 弱 | 强——论文的核心卖点 |
| 交错输入 | 原生不支持 | 支持，本就是设计目标 |
| 训练数据 | 1.3 亿对 | 13 亿对 + 4300 万张交错网页 |
| 训练参数量 | 1.88 亿 | 约 100 亿（cross-attn 层） |
| 算力 | 8 张 A100 几天 | 数千张 TPUv4 几周 |

预算紧、单图 VQA 选 BLIP-2。要交错、要 few-shot、要多图推理选 Flamingo / Idefics2。

## 用起来（Use It）

`code/main.py` 演示：

1. 一个 Perceiver resampler，输入 36 个伪 patch token，配 8 个可学习 latent（纯 Python 写的 cross-attention）。
2. 一步 gated cross-attention：`alpha = 0` → 输出等于输入（LLM 没变），`alpha = 2.0` → 视觉贡献被混进来。
3. 一个交错 mask 构造器，给 `(image 1) (text 1) (image 2) (text 2)` 序列产出 2D attention mask。

## 上线部署（Ship It）

本课产出 `outputs/skill-gated-bridge-diagnostic.md`。给定一个开源 VLM 的配置（resampler 有/无、cross-attn 频率、gate 方案），它会识别出哪些是 Flamingo 血统的元素，并解释 freezing 策略。用来调试「微调把文本能力搞掉了」一类问题（答案通常是：门控开得太快太大）。

## 练习（Exercises）

1. 算一下 Flamingo-9B 的视觉参数量：9B LLM + 1.4B gated cross-attention 层 + 6400 万 resampler。被训练的部分占总参数多少？

2. 在 PyTorch 里实现门控残差 `y = tanh(alpha) * cross + x`。实验证明：初始化时 `alpha=0` 下 `y==x` 严格成立。

3. 读 OpenFlamingo 第 3.2 节（arXiv:2308.01390），看他们如何在 batch 里处理「每条 prompt 图像数量不同」的问题。描述他们的 padding 策略。

4. 为什么 Flamingo 的 cross-attention mask 让一个文本 token 只 attend 到*最近的前一张*图，而不是所有前面的图？读 Flamingo 论文 2.4 节，解释这个 trade-off。

5. In-context few-shot：为一个新的 Flamingo 变体构造 4 个「图像 → 主体颜色」的示例 prompt。描述把示例数从 0 加到 8 时，准确率应该呈现什么样的变化模式。

## 关键术语（Key Terms）

| 术语 | 大家口中的样子 | 它实际是什么 |
|------|----------------|------------------------|
| Perceiver resampler | 「固定 latent 的 cross-attention」 | 把不定数量的输入 patch 变成 K 个固定 token 的模块 |
| Gated cross-attention | 「tanh 门控的桥」 | 残差层 `y = tanh(alpha)*cross + x`，alpha 可学，初始为 0 |
| Interleaved input（交错输入） | 「混合序列」 | 图像与文本按阅读顺序自由交错的 prompt 格式 |
| Frozen LLM（冻结 LLM） | 「LLM 没有梯度」 | 文本 LLM 权重不更新；只训练 resampler + cross-attn 层 |
| Few-shot | 「上下文里的示例」 | 在 prompt 里给几对 (图像, 答案)；模型不微调就能泛化 |
| OBELICS | 「交错网页语料」 | 1.41 亿张按阅读顺序保留图文的开源网页数据集 |
| Chinchilla | 「70B 冻结 base」 | Flamingo 用的冻结文本 LLM，出自 DeepMind 的 Chinchilla 论文 |
| Gate schedule（门控排程） | 「alpha 怎么变」 | 训练过程中 cross-attention 门控打开的速率 |
| Cross-attn frequency | 「每 M 层」 | 多久插入一个 gated cross-attention block；Flamingo 取 M=4 |
| OpenFlamingo | 「开源复刻」 | MosaicML / LAION 在 3-9B 段的开源 checkpoint；架构与 Flamingo 一致 |

## 延伸阅读（Further Reading）

- [Alayrac et al. — Flamingo (arXiv:2204.14198)](https://arxiv.org/abs/2204.14198) — 原始论文。
- [Awadalla et al. — OpenFlamingo (arXiv:2308.01390)](https://arxiv.org/abs/2308.01390) — 开源复刻。
- [Laurençon et al. — OBELICS (arXiv:2306.16527)](https://arxiv.org/abs/2306.16527) — 交错网页语料。
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) — 通用 Perceiver 架构。
- [Li et al. — Otter (arXiv:2305.03726)](https://arxiv.org/abs/2305.03726) — Flamingo 后裔的指令微调版。
- [Laurençon et al. — Idefics2 (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246) — Flamingo 思路的现代简化版。
