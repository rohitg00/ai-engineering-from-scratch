# CLIP 与对比式视觉-语言预训练

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> OpenAI 的 CLIP（2021）证明了一个足够大的想法，能驱动接下来五年的进展：仅用噪声很大的网络图文对（image-caption pair）和一个对比损失（contrastive loss），就把图像 encoder 和文本 encoder 对齐到同一个向量空间。零监督标签。4 亿对。由此得到的 embedding 空间能做 zero-shot 分类、图文检索，并以 vision tower（视觉塔）的角色嵌入到 2026 年的每一个 VLM 中。SigLIP 2（2025）把 softmax 换成 sigmoid，以更低成本扩展到超越 CLIP 的规模。本课从 InfoNCE 推到 sigmoid pairwise loss，并用 stdlib Python 搭出训练步骤。

**Type:** Build
**Languages:** Python（stdlib，InfoNCE + sigmoid loss 实现）
**Prerequisites:** Phase 12 · 01（ViT patches）、Phase 7（Transformers）
**Time:** ~180 分钟

## 学习目标（Learning Objectives）

- 从互信息（mutual information）推导 InfoNCE loss，并实现一个数值稳定的向量化版本。
- 解释为什么 sigmoid pairwise loss（SigLIP）能扩展到 batch 32768+，而不需要 softmax 所要求的 all-gather 开销。
- 通过构造文本模板（`a photo of a {class}`）并对 cosine similarity 取 argmax，跑一次 ImageNet zero-shot 分类。
- 说出 CLIP / SigLIP 预训练给你的四个调节杆：batch size、temperature、prompt 模板、数据质量。

## 问题（The Problem）

CLIP 之前的视觉是有监督的。收集带标签的数据集（ImageNet：120 万张图、1000 类），训练一个 CNN，发布出去。标签很贵，标签会偏向标注者能达成共识的内容，而且标签若不微调（fine-tune）就无法迁移到新任务。

图文网页里有十亿级的弱标注图文对，免费。一张金毛寻回犬的照片配上 alt 文本「我的狗 Max 在公园里」就携带了监督信号——文本描述了图像。问题是：你能把这变成有用的训练吗？

CLIP 的回答：把图文对当作一个匹配任务。给一个 batch 包含 N 张图和 N 段 caption，学着把每张图与它自己的 caption 配对，对抗 N-1 个干扰项。监督信号是「这两个属于一对；那 N-1 个不是」。没有类别标签。没有人工标注。只有一个 contrastive loss。

由此得到的 embedding 空间能做的事远超 CLIP 训练所针对的范围。ImageNet zero-shot 之所以可行，是因为「a photo of a cat」会嵌入到那些从未被显式标记为猫的猫图附近。这正是孕育了 2026 年所有 VLM 的那个赌注。

## 概念（The Concept）

### 双塔 encoder（The dual encoder）

CLIP 有两座塔：

- 图像 encoder `f`：ViT 或 ResNet，每张图输出一个 D 维向量。
- 文本 encoder `g`：小型 transformer，每段 caption 输出一个 D 维向量。

两座塔都把输出归一化到单位长度。由于都是单位范数，相似度即为 `cos(f(x), g(y)) = f(x)^T g(y)`。

对一个 batch 的 N 个 (image, caption) 对，构造形状为 `(N, N)` 的相似度矩阵 `S`：

```
S[i, j] = cos(f(x_i), g(y_j)) / tau
```

其中 `tau` 是一个可学习的 temperature（CLIP 初始化为 0.07；在 log 空间里学习）。

### InfoNCE loss

CLIP 在行和列上各做一次对称的交叉熵：

```
loss_i2t = CE(S, labels=identity)     # 每张图的正样本是它自己的 caption
loss_t2i = CE(S^T, labels=identity)   # 每段 caption 的正样本是它自己的图
loss = (loss_i2t + loss_t2i) / 2
```

这就是 InfoNCE。CE 中的 softmax 强迫每张图与它的 caption 的匹配度高于 batch 中所有其他 caption。「负样本」就是 batch 里所有其他条目。Batch 越大 = 负样本越多 = 信号越强。CLIP 在 batch 32k 上训练；规模很重要。

### Temperature

`tau` 控制 softmax 的锐度。低 tau → 分布尖锐，类似 hard negative mining 的效果。高 tau → 平滑，所有样本都贡献。CLIP 学习 log(1/tau)，并裁剪以防止崩塌。SigLIP 2 固定初始 tau，转而用一个可学习的偏置（bias）。

### 为什么 sigmoid 扩展更好（SigLIP）

Softmax 需要把整个相似度矩阵同步起来。在分布式训练里，你必须把每个 embedding all-gather 到每个 replica，再做 softmax。这在通信上是 world size 的二次复杂度。

SigLIP 把 softmax 替换为 element-wise 的 sigmoid：对每对 `(i, j)`，loss 是一个二分类「这两个是匹配对吗？」——正类标签是对角线，其他全部是负类。损失为：

```
L = -1/N sum over (i, j) [ y_ij log sigmoid(S[i,j]) + (1-y_ij) log sigmoid(-S[i,j]) ]
```

`y_ij = 1` 当 `i == j`，否则为 0。每对的 loss 互相独立。不需要 all-gather。每张 GPU 计算它本地的块再求和。SigLIP 2 能廉价地扩展到 batch 32k–512k，而 CLIP 在同等规模下需要成比例增加的通信。

### Zero-shot 分类

给定 N 个类名，为每个类构造一个文本模板：

```
"a photo of a {class}"
```

用文本 encoder 嵌入每个模板。用图像 encoder 嵌入你的图。Argmax cosine similarity = 预测类别。完全不在目标类上训练。

Prompt 模板很关键。CLIP 原论文每个类用了 80 个模板（普通、艺术、照片、绘画等）并平均其 embeddings。ImageNet 提升 +3 分。现代用法通常只挑一两个模板。

### Linear probe 与微调

Zero-shot 是一个 baseline。Linear probe（在冻结的 CLIP 特征上训练一个线性层用于目标类）在域内任务上胜过 zero-shot。完整微调在域内胜过 linear probe，但可能损害 zero-shot 迁移。三种范式，三种取舍。

### SigLIP 2：NaFlex 与稠密特征

SigLIP 2（2025）新增：
- NaFlex：单一模型可处理可变宽高比和分辨率。
- 更好的稠密特征，用于分割与深度估计，目标是作为 VLM 的冻结 backbone。
- 多语言：在 100+ 种语言上训练，而 CLIP 仅英文。
- 1B 参数规模，CLIP 上限是 400M。

在 2026 年的开源 VLM 中，SigLIP 2 SO400m/14 是默认的 vision tower。在纯图文检索场景里，如果具体的 LAION-2B 训练分布与你的查询模式相符，CLIP 仍是默认选择。

### ALIGN、BASIC、OpenCLIP、EVA-CLIP

ALIGN（Google，2021）：与 CLIP 同样的想法，1.8B 对的规模，90% 是噪声。证明了噪声数据可以扩展。OpenCLIP（LAION）：在 LAION-400M / 2B 上对 CLIP 的开源复现，多种规模，是首选的开源 checkpoint。EVA-CLIP：从 masked image modeling 初始化；作为 VLM 的 backbone 表现强。BASIC：Google 的 CLIP+ALIGN 混合。都是同一家族，差别在数据和调参。

### Zero-shot 天花板

CLIP 类模型在 ImageNet zero-shot 上大致顶到 76%（CLIP-G、OpenCLIP-G）。再往上要么需要大得多的数据（SigLIP 2 拿到 80%+），要么需要架构变更（监督头、更多参数）。这个基准（benchmark）正在饱和；真正的价值是下游 VLM 消费的那个 embedding 空间。

## 用起来（Use It）

`code/main.py` 实现了：

1. 一个玩具版双塔 encoder（基于 hash 的图像特征、字符级文本特征），让你在不依赖 numpy 的情况下看清 InfoNCE 的形状。
2. 纯 Python 的 InfoNCE loss（通过 log-sum-exp 保证数值稳定）。
3. 对照用的 sigmoid pairwise loss。
4. 一个 zero-shot 分类例程：对一组文本 prompt 计算 cosine similarity，取 argmax 作为预测。

跑起来看 loss 曲线。绝对数值是玩具级的；曲线形状与真实 CLIP 训练器吐出来的一致。

## 上线部署（Ship It）

本课产出 `outputs/skill-clip-zero-shot.md`。给定一组图像（通过路径）和一组目标类，它会用 CLIP 模板构造文本 prompt，用一个明示的 checkpoint（例如 `openai/clip-vit-large-patch14`）对两侧分别 embed，并返回 top-1 / top-5 预测以及相似度分数。该 skill 拒绝对不在 prompt 列表中的类别下结论。

## 练习（Exercises）

1. 手算实现一个 batch 大小为 4 对的 InfoNCE。构造 4x4 相似度矩阵，做 softmax，取出对角线，算交叉熵。把你的 Python 实现与这一手算结果对照验证。

2. SigLIP 在 temperature 之外还引入一个偏置参数 `b`：`S'[i,j] = S[i,j]/tau + b`。当 batch 存在很大的类别不平衡（每行负样本远多于正样本）时，`b` 起什么作用？阅读 SigLIP 第 3 节（arXiv:2303.15343）。

3. 为 cats vs dogs 构建一个 zero-shot 分类器。试两个 prompt 模板：`a photo of a {class}` 和 `a picture of a {class}`。在 100 张测试图上测准确率。模板集成是否优于单模板？

4. 计算在 512-GPU、batch 32k 的训练中，softmax InfoNCE 与 sigmoid pairwise 的通信成本。哪个是 O(N)，哪个是 O(N^2)？引用 SigLIP 第 4 节。

5. 阅读 OpenCLIP scaling-laws 论文（arXiv:2212.07143，Cherti 等人）。从图中复现他们关于数据规模的结论：在固定模型规模下，ImageNet zero-shot 准确率与训练数据量之间是怎样的对数线性关系？

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 它实际是什么 |
|------|----------------|------------------------|
| InfoNCE | "Contrastive loss" | 在一个 batch 的相似度矩阵上做交叉熵；每个条目的正样本是与之配对的另一项，负样本是其余所有 |
| Sigmoid loss | "SigLIP loss" | 逐对的二元交叉熵；无 softmax、无 all-gather，在分布式训练中扩展成本低 |
| Temperature | "tau" | 在 softmax/sigmoid 之前对 logits 缩放的标量；控制分布的锐度 |
| Zero-shot | "no-finetune classification" | 用文本 prompt 构造类别 embedding，并按 cosine similarity 分类；不在目标类上训练 |
| Prompt template | "a photo of a ..." | 围绕类名的文本支架；对 zero-shot 准确率影响 1–5 个点 |
| Dual encoder | "Two-tower" | 一个图像 encoder + 一个文本 encoder，输出在共享的 D 维空间里 |
| Hard negative | "Tough distractor" | 一个与正样本相似到模型必须使劲才能分开的负样本 |
| Linear probe | "Frozen + one layer" | 仅在冻结特征上训练一个线性分类器；衡量特征质量 |
| NaFlex | "Native flexible resolution" | SigLIP 2 在不缩放的前提下吸收任意宽高比与分辨率图像的能力 |
| Temperature scaling | "log-parametrized tau" | CLIP 用 `log(1/tau)` 参数化以使梯度行为良好；并裁剪以防 tau 崩塌到接近 0 |

## 延伸阅读（Further Reading）

- [Radford et al. — Learning Transferable Visual Models From Natural Language Supervision (arXiv:2103.00020)](https://arxiv.org/abs/2103.00020) —— CLIP 论文。
- [Zhai et al. — Sigmoid Loss for Language Image Pre-Training (arXiv:2303.15343)](https://arxiv.org/abs/2303.15343) —— SigLIP。
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) —— 多语言 + NaFlex。
- [Jia et al. — ALIGN (arXiv:2102.05918)](https://arxiv.org/abs/2102.05918) —— 用噪声网络数据扩展规模。
- [Cherti et al. — Reproducible scaling laws for contrastive language-image learning (arXiv:2212.07143)](https://arxiv.org/abs/2212.07143) —— OpenCLIP scaling laws。
