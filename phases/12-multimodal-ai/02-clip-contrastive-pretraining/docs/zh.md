# CLIP 与对比式视觉-语言预训练

> OpenAI 的 CLIP（2021）证明了一个足够宏大的单一思想，能够驱动接下来五年：仅使用嘈杂的网络图像-标题对和对比损失，将图像编码器和文本编码器对齐到同一向量空间。零监督标签。4 亿对。生成的嵌入空间能够执行零样本分类、图像-文本检索，并作为视觉塔接入每一个 2026 年的 VLM。SigLIP 2（2025）用 sigmoid 替代了 softmax，并以更低成本超越了 CLIP。本课将从 InfoNCE 的数学原理一路推导到 sigmoid 成对损失，并用 stdlib Python 构建训练步骤。

**类型：** Build
**语言：** Python（stdlib，InfoNCE + sigmoid 损失实现）
**前置知识：** Phase 12 · 01（ViT patch），Phase 7（Transformers）
**时间：** ~180 分钟

## 学习目标

- 从互信息推导 InfoNCE 损失，并实现一个数值稳定的向量化版本。
- 解释为什么 sigmoid 成对损失（SigLIP）能在无需 softmax 所需 all-gather 开销的情况下，将 batch 规模扩展到 32768+。
- 通过构建文本模板（`a photo of a {class}`）并在余弦相似度上取 argmax，运行零样本 ImageNet 分类。
- 说出 CLIP / SigLIP 预训练给你的四个杠杆：batch size、温度、prompt 模板、数据质量。

## 问题所在

CLIP 之前的视觉是监督式的。收集标注数据集（ImageNet：120 万张图像，1000 个类别），训练 CNN，发布。标签昂贵，标签偏向于标注者能达成一致的内容，且标签不经过微调就无法迁移到新任务。

网络图像-标题拥有十亿级别的松散标注对，免费获取。一张金毛寻回犬的照片，alt 文本为"我的狗 Max 在公园里"，携带了一个监督信号——文本描述了图像。问题是：你能将其转化为有用的训练吗？

CLIP 的答案：将图像-标题对视为匹配任务。给定一批 N 张图像和 N 个标题，学习将每张图像与其自身的标题匹配，对抗 N-1 个干扰项。监督信号是"这两个东西属于一起；那 N-1 个不属于"。没有类别标签。没有人工标注。只有对比损失。

生成的嵌入空间所做的远超 CLIP 的训练目标。ImageNet 零样本有效，是因为"a photo of a cat"嵌入在从未被明确标注为猫的图片附近。这个赌注催生了每一个 2026 年的 VLM。

## 核心概念

### 双编码器

CLIP 有两个塔：

- 图像编码器 `f`：ViT 或 ResNet，每张图像输出一个 D 维向量。
- 文本编码器 `g`：小型 transformer，每个标题输出一个 D 维向量。

两个塔都将输出归一化为单位长度。相似度为 `cos(f(x), g(y)) = f(x)^T g(y)`，因为两者都是单位范数。

对于一批 N 个（图像，标题）对，构建形状为 `(N, N)` 的相似度矩阵 `S`：

```
S[i, j] = cos(f(x_i), g(y_j)) / tau
```

其中 `tau` 是一个可学习的温度（CLIP 初始化为 0.07；在 log 空间中学习）。

### InfoNCE 损失

CLIP 使用对行和列的对称交叉熵：

```
loss_i2t = CE(S, labels=identity)     # 每张图像的正例是其自身的标题
loss_t2i = CE(S^T, labels=identity)   # 每个标题的正例是其自身的图像
loss = (loss_i2t + loss_t2i) / 2
```

这就是 InfoNCE。CE 中的 softmax 迫使每张图像比批次中所有其他标题更匹配其标题。"负例"是批次中所有其他项目。更大的 batch = 更多负例 = 更强的信号。CLIP 在 batch 32k 下训练；规模很重要。

### 温度

`tau` 控制 softmax 的锐度。低 tau → 尖锐分布，硬负例挖掘效果。高 tau → 柔和，所有样本都贡献。CLIP 学习 log(1/tau)，并进行裁剪以防止崩溃。SigLIP 2 固定初始 tau，改用可学习的偏置。

### 为什么 sigmoid 扩展性更好（SigLIP）

Softmax 需要整个相似度矩阵同步。在分布式训练中，你必须 all-gather 每个嵌入到每个副本，然后执行 softmax。这在通信上与世界规模呈二次方关系。

SigLIP 用逐元素 sigmoid 替代 softmax：对于每对 `(i, j)`，损失是对"这是匹配对吗？"的二元分类。正类标签是对角线，其他一切都是负例。损失为：

```
L = -1/N sum over (i, j) [ y_ij log sigmoid(S[i,j]) + (1-y_ij) log sigmoid(-S[i,j]) ]
```

`y_ij = 1` 如果 `i == j`，否则为 0。每对的损失是独立的。不需要 all-gather。每个 GPU 计算其本地块并求和。SigLIP 2 在 batch 32k-512k 下廉价扩展，而 CLIP 需要成比例更多的通信。

### 零样本分类

给定 N 个类别名称，为每个类别构建一个文本模板：

```
"a photo of a {class}"
```

用文本编码器嵌入每个模板。用图像编码器嵌入你的图像。Argmax 余弦相似度 = 预测类别。无需在目标类别上训练。

Prompt 模板很重要。CLIP 的原始论文每个类别使用 80 个模板（普通、艺术、照片、绘画等）并平均嵌入。+3 ImageNet 分。现代使用通常选择一两个模板。

### 线性探测与微调

零样本是基线。线性探测（在冻结的 CLIP 特征上为你的目标类别训练一个线性层）在域内任务上优于零样本。完整微调在域内优于线性探测，但可能损害零样本迁移。三种机制，三种权衡。

### SigLIP 2：NaFlex 与密集特征

SigLIP 2（2025）添加了：
- NaFlex：单个模型处理可变纵横比和分辨率。
- 更好的密集特征用于分割和深度估计，目标是在 VLM 中作为冻结 backbone 使用。
- 多语言：在 100+ 语言上训练，而 CLIP 仅限英语。
- 1B 参数规模，而 CLIP 最高为 400M。

在 2026 年开源 VLM 中，SigLIP 2 SO400m/14 是默认视觉塔。CLIP 仍然是纯图像-文本检索的默认选择，其中特定的 LAION-2B 训练分布与你的查询模式匹配。

### ALIGN、BASIC、OpenCLIP、EVA-CLIP

ALIGN（Google，2021）：与 CLIP 相同思路，18 亿对规模，90% 嘈杂。证明嘈杂数据可以扩展。OpenCLIP（LAION）：在 LAION-400M / 2B 上开源复现 CLIP，多种规模，首选开源 checkpoint。EVA-CLIP：从掩码图像建模初始化；VLM 的强 backbone。BASIC：Google 的 CLIP+ALIGN 混合。都是同一家族，不同的数据和调优。

### 零样本天花板

CLIP 类模型的 ImageNet 零样本上限约为 76%（CLIP-G，OpenCLIP-G）。超越需要更大的数据（SigLIP 2 达到 80%+）或架构改变（监督头、更多参数）。基准正在饱和；真正的价值是下游 VLM 消费的嵌入空间。

## 使用它

`code/main.py` 实现：

1. 一个 toy 双编码器（基于哈希的图像特征，文本字符特征），让你无需 numpy 即可看到 InfoNCE 的形状。
2. 纯 Python 中的 InfoNCE 损失（通过 log-sum-exp 实现数值稳定性）。
3. 用于比较的 sigmoid 成对损失。
4. 零样本分类例程：计算与一组文本 prompt 的余弦相似度，argmax 预测。

运行它并观察损失曲线。绝对数值是 toy 的；形状与真实 CLIP 训练器输出匹配。

## 交付它

本课产出 `outputs/skill-clip-zero-shot.md`。给定一组图像（通过路径）和一个目标类别列表，它用 CLIP 模板构建文本 prompt，用声明的 checkpoint（例如 `openai/clip-vit-large-patch14`）嵌入两边，并返回 top-1 / top-5 预测及相似度分数。该技能拒绝对不在 prompt 列表中的类别做出声明。

## 练习

1. 手工实现一批 4 对的 InfoNCE。构建 4x4 相似度矩阵，运行 softmax，挑出对角线，计算交叉熵。验证你的 Python 实现与这个手工计算。

2. SigLIP 使用一个额外的偏置参数 `b`：`S'[i,j] = S[i,j]/tau + b`。当 batch 存在严重的类别不平衡（每行负例远多于正例）时，`b` 起什么作用？阅读 SigLIP 第 3 节（arXiv:2303.15343）。

3. 为猫 vs 狗构建零样本分类器。尝试两个 prompt 模板：`a photo of a {class}` 和 `a picture of a {class}`。在 100 张测试图像上测量准确率。模板集成是否优于单个？

4. 计算在 512-GPU 运行、batch 32k 下，softmax InfoNCE 与 sigmoid 成对的通信成本。哪个按 O(N) 扩展，哪个按 O(N²) 扩展？引用 SigLIP 第 4 节。

5. 阅读 OpenCLIP 缩放定律论文（arXiv:2212.07143，Cherti 等人）。从图中复现他们关于数据缩放的结论：在固定模型大小下，ImageNet 零样本准确率与训练数据大小之间的对数线性关系是什么？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| InfoNCE | "对比损失" | 在 batch 的相似度矩阵上的交叉熵；每个项目的正例是其配对项目，负例是其他一切 |
| Sigmoid 损失 | "SigLIP 损失" | 每对的二元交叉熵；无 softmax，无 all-gather，在分布式训练中廉价扩展 |
| 温度 | "tau" | 在 softmax/sigmoid 之前缩放 logits 的标量；控制分布的锐度 |
| 零样本 | "无需微调分类" | 使用文本 prompt 构建类别嵌入，并通过余弦相似度分类；无需在目标类别上训练 |
| Prompt 模板 | "a photo of a ..." | 类别名称周围的文本支架；影响零样本准确率 1-5 分 |
| 双编码器 | "双塔" | 一个图像编码器 + 一个文本编码器，在共享 D 维空间中输出 |
| 硬负例 | "难干扰项" | 与正例足够相似的负例，模型必须努力才能将它们分开 |
| 线性探测 | "冻结 + 一层" | 仅在冻结特征上训练线性分类器；衡量特征质量 |
| NaFlex | "原生灵活分辨率" | SigLIP 2 能力：无需调整大小即可摄入任意纵横比和分辨率的图像 |
| 温度缩放 | "log 参数化 tau" | CLIP 参数化 `log(1/tau)` 以使梯度表现良好；裁剪以防止崩溃到接近零的 tau |

## 延伸阅读

- [Radford et al. — Learning Transferable Visual Models From Natural Language Supervision (arXiv:2103.00020)](https://arxiv.org/abs/2103.00020)——CLIP 论文。
- [Zhai et al. — Sigmoid Loss for Language Image Pre-Training (arXiv:2303.15343)](https://arxiv.org/abs/2303.15343)——SigLIP。
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786)——多语言 + NaFlex。
- [Jia et al. — ALIGN (arXiv:2102.05918)](https://arxiv.org/abs/2102.05918)——用嘈杂网络数据扩展。
- [Cherti et al. — Reproducible scaling laws for contrastive language-image learning (arXiv:2212.07143)](https://arxiv.org/abs/2212.07143)——OpenCLIP 缩放定律。
