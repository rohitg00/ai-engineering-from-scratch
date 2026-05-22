# CLIP 与对比视觉-语言预训练

> OpenAI 的 CLIP（2021）证明了一个足以驱动未来五年的理念：仅使用嘈杂的网络图像-标题对和一个对比损失（Contrastive Loss），在同一个向量空间中对齐图像编码器和文本编码器。零监督标签。4 亿对。生成的嵌入空间能进行零样本分类（Zero-shot Classification）、图像-文本检索，并作为每一个 2026 年 VLM 的视觉塔。SigLIP 2（2025）用 Sigmoid 替换了 Softmax，以更低的成本超越了 CLIP。本课程将从 InfoNCE 讲解到 Sigmoid 逐对损失（Pairwise Loss）的数学原理，并使用标准库 Python 构建训练步骤。

**类型：** 构建
**语言：** Python（标准库，InfoNCE + Sigmoid 损失实现）
**前置知识：** 阶段 12 · 01（ViT 补丁），阶段 7（Transformer）
**时间：** 约 180 分钟

## 学习目标

- 从互信息（Mutual Information）推导 InfoNCE 损失，并实现一个数值稳定的向量化版本。
- 解释为什么 Sigmoid 逐对损失（SigLIP）能够扩展到 32768+ 的批大小，而无需 Softmax 所要求的全部收集（All-gather）开销。
- 通过构建文本模板（`一张{class}的照片`）并取余弦相似度的 argmax，运行零样本 ImageNet 分类。
- 说出 CLIP / SigLIP 预训练提供的四个杠杆：批大小、温度（Temperature）、提示模板（Prompt Template）、数据质量。

## 问题

在 CLIP 之前，视觉任务是有监督的。收集标注数据集（ImageNet：120 万张图像，1000 个类别），训练一个 CNN，然后部署。标签昂贵，标签偏向于标注者一致同意的内容，并且不加微调就无法迁移到新任务。

图像-标题网络上免费提供了超过十亿个松散标注的对。一张金毛犬的图片，alt 文本是“我的狗 Max 在公园里”，携带了监督信号——文本描述了图像。问题是：你能将其转化为有用的训练吗？

CLIP 的回答：将图像-标题对视为匹配任务。给定一个包含 N 张图像和 N 个标题的批次，学习将每张图像与其自己的标题匹配，同时排除 N-1 个干扰项。监督信号是“这两者属于一起；这 N-1 个不属于一起。”没有类别标签。没有人工标注。仅仅是一个对比损失。

生成的嵌入空间所做的超出了 CLIP 训练目标。零样本 ImageNet 之所以有效，是因为“一张猫的照片”会嵌入到从未被明确标记为猫的猫的图片附近。这是催生所有 2026 年 VLM 的赌注。

## 概念

### 双编码器（Dual Encoder）

CLIP 有两个塔：

- 图像编码器 `f`：ViT 或 ResNet，每张图像输出一个 D 维向量。
- 文本编码器 `g`：小型 Transformer，每个标题输出一个 D 维向量。

两个编码器将其输出归一化到单位长度。相似度为 `cos(f(x), g(y)) = f(x)^T g(y)`，因为两者都是单位范数。

对于一个包含 N 个（图像，标题）对的批次，构建形状为 `(N, N)` 的相似度矩阵 `S`：

```
S[i, j] = cos(f(x_i), g(y_j)) / tau
```

其中 `tau` 是一个可学习的温度（CLIP 初始化为 0.07；在对数空间中学习）。

### InfoNCE 损失

CLIP 使用对称的交叉熵（Cross-Entropy），作用于行和列：

```
loss_i2t = CE(S, labels=identity)     # 每张图像的正样本是其对应的标题
loss_t2i = CE(S^T, labels=identity)   # 每个标题的正样本是其对应的图像
loss = (loss_i2t + loss_t2i) / 2
```

这就是 InfoNCE。交叉熵中的 Softmax 迫使每张图像与其标题的相似度高于批次中所有其他标题。所有其他批次项目都是“负样本”。更大的批次 = 更多负样本 = 更强的信号。CLIP 以 32k 的批次大小训练；规模至关重要。

### 温度

`tau` 控制 Softmax 的尖锐程度。低 `tau` → 尖锐分布，产生难负样本挖掘效应。高 `tau` → 柔和，所有样本都有贡献。CLIP 学习 `log(1/tau)`，并进行裁剪以防止崩溃。SigLIP 2 固定了初始温度，转而使用一个可学习的偏置（Bias）。

### 为什么 Sigmoid 扩展性更好（SigLIP）

Softmax 需要整个相似度矩阵同步。在分布式训练中，你必须将每个嵌入全部收集（All-gather）到每个副本，然后执行 Softmax。这在通信量上是二次方于世界大小。

SigLIP 用逐元素 Sigmoid 替换了 Softmax：对于每一对 `(i, j)`，损失是对“这些是匹配对吗？”的二分类。正类标签是对角线，其他一切都是负数。损失为：

```
L = -1/N sum over (i, j) [ y_ij log sigmoid(S[i,j]) + (1-y_ij) log sigmoid(-S[i,j]) ]
```

`y_ij = 1` 如果 `i == j`，否则为 0。每一对的损失是独立的。不需要全部收集。每个 GPU 计算其本地块并求和。SigLIP 2 能以较低成本扩展到批大小 32k-512k，而 CLIP 则需要成比例的更多通信。

### 零样本分类

给定 N 个类别名称，为每个类别构建一个文本模板：

```
"一张{class}的照片"
```

用文本编码器嵌入每个模板。用图像编码器嵌入图像。取余弦相似度的 argmax = 预测类别。不对目标类别进行训练。

提示模板很重要。CLIP 原始论文每个类别使用了 80 个模板（普通、艺术、照片、绘画等），并平均了嵌入。提高了 3 个 ImageNet 点。现代使用通常选择一个或两个模板。

### 线性探测（Linear Probe）与微调

零样本是一个基线。线性探测（在冻结的 CLIP 特征之上为目标类别训练一个线性层）在领域内任务上优于零样本。全微调在领域内优于线性探测，但可能损害零样本迁移。三种模式各有三种权衡。

### SigLIP 2：NaFlex 与密集特征

SigLIP 2（2025）增加了：
- NaFlex：单一模型处理可变宽高比和分辨率。
- 更好的密集特征，用于分割和深度估计，旨在用作 VLM 中的冻结骨干网络。
- 多语言：在 100+ 种语言上训练，而 CLIP 仅支持英语。
- 10 亿参数规模，而 CLIP 最多为 4 亿。

在 2026 年的开源 VLM 中，SigLIP 2 SO400m/14 是默认的视觉塔。对于纯图像-文本检索，如果特定 LAION-2B 训练分布与查询模式匹配，CLIP 仍然是默认选择。

### ALIGN、BASIC、OpenCLIP、EVA-CLIP

- ALIGN（Google，2021）：与 CLIP 相同的思路，18 亿对规模，90% 嘈杂。证明了嘈杂数据的可扩展性。
- OpenCLIP（LAION）：在 LAION-400M / 2B 上对 CLIP 的开源复现，多种规模，是首选的开源检查点。
- EVA-CLIP：从掩码图像建模初始化；VLM 的强大骨干网络。
- BASIC：Google 的 CLIP+ALIGN 混合模型。都属于同一家族，不同的数据和调优。

### 零样本天花板

CLIP 类模型在 ImageNet 零样本上上限约为 76%（CLIP-G、OpenCLIP-G）。要进一步超越需要更大的数据（SigLIP 2 达到 80%+）或架构更改（监督头、更多参数）。该基准正在饱和；真正的价值在于下游 VLM 消费的嵌入空间。

## 使用它

`code/main.py` 实现了：

1. 一个玩具双编码器（基于哈希的图像特征、文本字符特征），这样你无需 numpy 就能看到 InfoNCE 的形状。
2. 纯 Python 的 InfoNCE 损失（通过 log-sum-exp 实现数值稳定性）。
3. 用于对比的 Sigmoid 逐对损失。
4. 一个零样本分类例程：计算与一组文本提示的余弦相似度，取 argmax 进行预测。

运行它并观察损失曲线。绝对数值是玩具级别的；但其形状与真实 CLIP 训练器输出的一致。

## 交付物

本课程产出 `outputs/skill-clip-zero-shot.md`。给定一组图像（通过路径）和一个目标类别列表，它使用 CLIP 模板构建文本提示，用指定的检查点（例如 `openai/clip-vit-large-patch14`）嵌入两侧，并返回 top-1 / top-5 预测及相似度分数。该技能拒绝声称提示列表中未包含类别的能力。

## 练习

1. 手动为一个包含 4 对的批次实现 InfoNCE。构建 4x4 相似度矩阵，执行 Softmax，取出对角线，计算交叉熵。用此手工计算验证你的 Python 实现。

2. SigLIP 除了温度外还使用一个偏置参数 `b`：`S'[i,j] = S[i,j]/tau + b`。当批次中存在严重的类别不平衡（每行负样本远多于正样本）时，`b` 起什么作用？阅读 SigLIP 第 3 节（arXiv:2303.15343）。

3. 为猫 vs 狗构建一个零样本分类器。尝试两种提示模板：`一张{class}的照片` 和 `一张{class}的图片`。在 100 张测试图像上测量准确率。模板集成是否优于单个模板？

4. 计算在 512 个 GPU、批大小 32k 运行下，Softmax InfoNCE 与 Sigmoid 逐对损失的通信成本。哪一个在 O(N) 规模，哪一个在 O(N^2)？引用 SigLIP 第 4 节。

5. 阅读 OpenCLIP 扩展定律论文（arXiv:2212.07143，Cherti 等人）。从图中复现他们关于数据扩展的结论：在固定模型大小下，ImageNet 零样本准确率与训练数据大小之间呈什么对数线性关系？

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| InfoNCE | "对比损失" | 对批次相似度矩阵的交叉熵；每个项目的正样本是其配对项，负样本是其余所有项 |
| Sigmoid 损失 | "SigLIP 损失" | 逐对二元交叉熵；无 Softmax，无全部收集，在分布式训练中扩展成本低 |
| 温度（Temperature） | "tau" | 在 Softmax/Sigmoid 之前缩放 logits 的标量；控制分布的尖锐程度 |
| 零样本（Zero-shot） | "无微调分类" | 使用文本提示构造类别嵌入，并通过余弦相似度进行分类；不对目标类别进行训练 |
| 提示模板（Prompt Template） | "一张 ... 的照片" | 围绕类别名称的文本框架；影响零样本准确率 1-5 个点 |
| 双编码器（Dual Encoder） | "双塔" | 一个图像编码器 + 一个文本编码器，输出在共享 D 维空间中 |
| 难负样本（Hard Negative） | "困难的干扰项" | 与正样本足够相似的负样本，模型需要努力才能区分它们 |
| 线性探测（Linear Probe） | "冻结 + 一层" | 仅在冻结特征之上训练一个线性分类器；衡量特征质量 |
| NaFlex | "原生灵活分辨率" | SigLIP 2 的能力，可输入任意宽高比和分辨率的图像，无需调整大小 |
| 温度缩放（Temperature Scaling） | "对数参数化的 tau" | CLIP 参数化 `log(1/tau)` 以保证梯度正常；裁剪以防止温度趋近于零导致的崩溃 |

## 进一步阅读

- [Radford et al. — Learning Transferable Visual Models From Natural Language Supervision (arXiv:2103.00020)](https://arxiv.org/abs/2103.00020) — CLIP 论文。
- [Zhai et al. — Sigmoid Loss for Language Image Pre-Training (arXiv:2303.15343)](https://arxiv.org/abs/2303.15343) — SigLIP。
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) — 多语言 + NaFlex。
- [Jia et al. — ALIGN (arXiv:2102.05918)](https://arxiv.org/abs/2102.05918) — 利用嘈杂网络数据扩展。
- [Cherti et al. — Reproducible scaling laws for contrastive language-image learning (arXiv:2212.07143)](https://arxiv.org/abs/2212.07143) — OpenCLIP 扩展定律。