# 02 · CLIP 与对比式图文预训练

> OpenAI 的 CLIP（2021）证明了一个足够大、能够支撑后续五年发展的想法：只用带噪声的网络图文对（image-caption pairs）和一个对比损失，就能把图像编码器与文本编码器对齐到同一个向量空间。零监督标签。4 亿个图文对。由此得到的嵌入空间能做零样本分类（zero-shot classification）、图文检索（image-text retrieval），并作为视觉塔（vision tower）插入到每一个 2026 年的 VLM 中。SigLIP 2（2025）用 sigmoid 取代 softmax，以更低的成本扩展到超越 CLIP 的规模。本课将从 InfoNCE 一路推导到 sigmoid 成对损失（sigmoid pairwise loss），并用标准库 Python 实现训练步骤。

**类型：** 实践（Build）
**语言：** Python（标准库，InfoNCE + sigmoid 损失实现）
**前置：** 第 12 阶段 · 01（ViT patches）、第 7 阶段（Transformers）
**时长：** 约 180 分钟

## 学习目标

- 从互信息（mutual information）出发推导 InfoNCE 损失，并实现一个数值稳定的向量化版本。
- 解释为什么 sigmoid 成对损失（SigLIP）能扩展到 batch 32768+ 而无需 softmax 所要求的 all-gather 开销。
- 通过构造文本模板（`a photo of a {class}`）并在余弦相似度上取 argmax，运行零样本 ImageNet 分类。
- 说出 CLIP / SigLIP 预训练给你的四个调节杆：批大小（batch size）、温度（temperature）、提示模板（prompt template）、数据质量（data quality）。

## 问题

CLIP 之前的视觉是有监督的。收集带标注的数据集（ImageNet：120 万张图像、1000 个类别），训练一个 CNN，然后上线。标签很昂贵，标签会偏向标注者能达成一致的内容，而且标签不经过微调（finetuning）就无法迁移到新任务。

而图文网络免费提供了超过十亿个松散标注的图文对。一张金毛寻回犬的照片配上 alt 文本「my dog Max in the park」就带有一个监督信号——文本描述了这张图像。问题是：你能把它转化为有用的训练吗？

CLIP 的答案：把图文对当作一个匹配任务来处理。给定一批 N 张图像和 N 条描述，学会把每张图像与它自己的描述匹配上，对抗其余 N-1 个干扰项（distractors）。监督信号是「这两个东西属于一对；这 N-1 个不是」。没有类别标签。没有人工标注。只有一个对比损失。

由此得到的嵌入空间所做的事情超出了 CLIP 的训练目标。ImageNet 零样本之所以有效，是因为「a photo of a cat」在嵌入空间中靠近那些从未被显式标注为猫的猫的照片。正是这个押注催生了每一个 2026 年的 VLM。

## 概念

### 双编码器

CLIP 有两座塔：

- 图像编码器 `f`：ViT 或 ResNet，对每张图像输出一个 D 维向量。
- 文本编码器 `g`：一个小型 transformer，对每条描述输出一个 D 维向量。

两座塔都把输出归一化为单位长度。由于两者都是单位范数（unit-norm），相似度即 `cos(f(x), g(y)) = f(x)^T g(y)`。

对于一批 N 个（图像，描述）对，构建形状为 `(N, N)` 的相似度矩阵 `S`：

```
S[i, j] = cos(f(x_i), g(y_j)) / tau
```

其中 `tau` 是一个可学习的温度（CLIP 初始化为 0.07；在对数空间中学习）。

### InfoNCE 损失

CLIP 在行和列上使用对称的交叉熵：

```
loss_i2t = CE(S, labels=identity)     # 每张图像的正样本是它自己的描述
loss_t2i = CE(S^T, labels=identity)   # 每条描述的正样本是它自己的图像
loss = (loss_i2t + loss_t2i) / 2
```

这就是 InfoNCE。CE 中的 softmax 迫使每张图像与它的描述的匹配程度高于该批次中所有其他描述。「负样本」就是该批次中所有其他项。批次越大 = 负样本越多 = 信号越强。CLIP 在 batch 32k 下训练；规模很重要。

### 温度

`tau` 控制 softmax 的锐度（sharpness）。tau 低 → 分布尖锐，产生难负样本挖掘（hard negative mining）的效果。tau 高 → 平缓，所有样本都有贡献。CLIP 学习 log(1/tau)，并做截断（clip）以防止坍塌（collapse）。SigLIP 2 固定初始 tau，改用一个可学习的偏置（bias）。

### 为什么 sigmoid 扩展性更好（SigLIP）

softmax 需要整个相似度矩阵保持同步。在分布式训练中，你必须把每个嵌入向量 all-gather 到每个副本（replica），然后再做 softmax。这在通信上随 world size 呈二次方增长。

SigLIP 用逐元素的 sigmoid 取代 softmax：对每个对 `(i, j)`，损失是一个二分类——「这是不是匹配的一对？」正类标签在对角线上，其余都是负类。损失为：

```
L = -1/N sum over (i, j) [ y_ij log sigmoid(S[i,j]) + (1-y_ij) log sigmoid(-S[i,j]) ]
```

`y_ij = 1` 当 `i == j`，否则为 0。每个对的损失是独立的。不需要 all-gather。每个 GPU 计算它本地的块并求和。SigLIP 2 能廉价地扩展到 batch 32k–512k，而 CLIP 则需要成比例增长的通信量。

### 零样本分类

给定 N 个类别名称，为每个类别构建一个文本模板：

```
"a photo of a {class}"
```

用文本编码器嵌入每个模板。用图像编码器嵌入你的图像。余弦相似度的 argmax = 预测类别。无需在目标类别上做任何训练。

提示模板很重要。CLIP 原始论文为每个类别使用 80 个模板（普通、艺术、照片、绘画等）并对嵌入取平均。ImageNet 提升 +3 个点。现代用法通常只挑一两个模板。

### 线性探针与微调

零样本是一条基线。线性探针（linear probe，在冻结的 CLIP 特征之上为你的目标类别训练一个线性层）在同分布（in-domain）任务上胜过零样本。全量微调（full finetuning）在同分布任务上胜过线性探针，但可能损害零样本迁移能力。三种方案，三种权衡。

### SigLIP 2：NaFlex 与稠密特征

SigLIP 2（2025）新增了：
- NaFlex：单个模型处理可变的长宽比和分辨率。
- 更好的稠密特征（dense features），用于分割和深度估计，目标是作为 VLM 中的冻结骨干（frozen backbone）使用。
- 多语言：在 100+ 种语言上训练，而 CLIP 只支持英语。
- 10 亿参数规模，而 CLIP 上限为 4 亿。

在 2026 年的开源 VLM 中，SigLIP 2 SO400m/14 是默认的视觉塔。CLIP 仍然是纯图文检索的默认选择——当其特定的 LAION-2B 训练分布与你的查询模式相匹配时。

### ALIGN、BASIC、OpenCLIP、EVA-CLIP

ALIGN（Google，2021）：与 CLIP 想法相同，18 亿对的规模，90% 带噪声。证明了带噪声的数据能够扩展。OpenCLIP（LAION）：在 LAION-400M / 2B 上对 CLIP 的开源复现，提供多种规模，是首选的开源检查点（checkpoint）。EVA-CLIP：从掩码图像建模（masked image modeling）初始化；是 VLM 的强力骨干。BASIC：Google 的 CLIP+ALIGN 混合体。都属于同一家族，只是数据和调优不同。

### 零样本天花板

CLIP 类模型的 ImageNet 零样本约在 76% 封顶（CLIP-G、OpenCLIP-G）。要更进一步，要么需要大得多的数据（SigLIP 2 达到 80%+），要么需要架构改动（有监督头、更多参数）。这个基准正在饱和；真正的价值在于供下游 VLM 消费的嵌入空间。

## 动手用它

`code/main.py` 实现了：

1. 一个玩具版双编码器（基于哈希的图像特征、文本字符特征），让你不用 numpy 就能看到 InfoNCE 的形态。
2. 纯 Python 的 InfoNCE 损失（通过 log-sum-exp 实现数值稳定性）。
3. 用于对比的 sigmoid 成对损失。
4. 一个零样本分类例程：对一组文本提示计算余弦相似度，取 argmax 作为预测。

运行它并观察损失曲线。绝对数值只是玩具级的；其形态与真实 CLIP 训练器输出的一致。

## 交付它

本课产出 `outputs/skill-clip-zero-shot.md`。给定一组图像（通过路径）和一个目标类别列表，它用 CLIP 模板构建文本提示，用指定的检查点（例如 `openai/clip-vit-large-patch14`）嵌入两侧，并返回带相似度分数的 top-1 / top-5 预测。该技能拒绝对提示列表之外的类别做出任何断言。

## 练习

1. 手算一批 4 个对的 InfoNCE。构造 4x4 的相似度矩阵，运行 softmax，挑出对角线，计算交叉熵。用这个手算结果验证你的 Python 实现。

2. SigLIP 除温度外还使用一个偏置参数 `b`：`S'[i,j] = S[i,j]/tau + b`。当批次存在严重类别不平衡（每行的负样本远多于正样本）时，`b` 起什么作用？阅读 SigLIP 第 3 节（arXiv:2303.15343）。

3. 构建一个猫 vs 狗的零样本分类器。尝试两个提示模板：`a photo of a {class}` 和 `a picture of a {class}`。在 100 张测试图像上测量准确率。模板的集成（ensemble）是否胜过单个模板？

4. 计算在 512-GPU、batch 32k 的运行中，softmax InfoNCE 与 sigmoid 成对损失各自的通信成本。哪个是 O(N) 扩展，哪个是 O(N^2)？引用 SigLIP 第 4 节。

5. 阅读 OpenCLIP 扩展定律论文（arXiv:2212.07143，Cherti et al.）。从图表中复现他们关于数据扩展的结论：在固定模型规模下，ImageNet 零样本准确率与训练数据规模之间的对数线性（log-linear）关系是什么？

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| InfoNCE | 「对比损失」 | 在一个批次的相似度矩阵上做交叉熵；每一项的正样本是它配对的项，负样本是其余所有项 |
| Sigmoid 损失 | 「SigLIP 损失」 | 逐对的二元交叉熵；无 softmax，无 all-gather，在分布式训练中扩展成本低 |
| 温度（Temperature） | 「tau」 | 在 softmax/sigmoid 之前缩放 logits 的标量；控制分布的锐度 |
| 零样本（Zero-shot） | 「免微调分类」 | 用文本提示构造类别嵌入，并按余弦相似度分类；不在目标类别上训练 |
| 提示模板（Prompt template） | 「a photo of a ...」 | 围绕类别名称搭建的文本脚手架；影响零样本准确率 1-5 个点 |
| 双编码器（Dual encoder） | 「双塔（Two-tower）」 | 一个图像编码器 + 一个文本编码器，输出在共享的 D 维空间中 |
| 难负样本（Hard negative） | 「棘手的干扰项」 | 一个与正样本相似到模型必须费力才能区分的负样本 |
| 线性探针（Linear probe） | 「冻结 + 一层」 | 仅在冻结特征之上训练一个线性分类器；衡量特征质量 |
| NaFlex | 「原生灵活分辨率」 | SigLIP 2 的能力，可在任意长宽比和分辨率下摄入图像而无需缩放 |
| 温度缩放（Temperature scaling） | 「对数参数化的 tau」 | CLIP 参数化 `log(1/tau)` 以使梯度表现良好；做截断以防止坍塌到近零的 tau |

## 延伸阅读

- [Radford et al. — Learning Transferable Visual Models From Natural Language Supervision (arXiv:2103.00020)](https://arxiv.org/abs/2103.00020) —— CLIP 论文。
- [Zhai et al. — Sigmoid Loss for Language Image Pre-Training (arXiv:2303.15343)](https://arxiv.org/abs/2303.15343) —— SigLIP。
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) —— 多语言 + NaFlex。
- [Jia et al. — ALIGN (arXiv:2102.05918)](https://arxiv.org/abs/2102.05918) —— 用带噪声的网络数据扩展。
- [Cherti et al. — Reproducible scaling laws for contrastive language-image learning (arXiv:2212.07143)](https://arxiv.org/abs/2212.07143) —— OpenCLIP 扩展定律。
