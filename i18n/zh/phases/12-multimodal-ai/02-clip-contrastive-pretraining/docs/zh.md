# CLIP 与对比式视觉-语言预训练

> OpenAI 的 CLIP(2021)证明了一个足以支撑此后五年发展的核心思想:仅使用嘈杂的网络图文对和对比损失,将图像编码器与文本编码器对齐到同一向量空间。零监督标签。4 亿对数据。由此得到的嵌入空间可以完成零样本分类、图文检索,并作为视觉塔接入每一个 2026 年的 VLM。SigLIP 2(2025)用 sigmoid 替换了 softmax,以更低的成本超越了 CLIP。本课从 InfoNCE 讲到 sigmoid 成对损失的数学原理,并用标准库 Python 构建训练步骤。

**Type:** Build
**Languages:** Python(标准库,InfoNCE + sigmoid 损失实现)
**Prerequisites:** Phase 12 · 01(ViT patches),Phase 7(Transformers)
**Time:** 约 180 分钟

## 学习目标

- 从互信息推导 InfoNCE 损失,并实现一个数值稳定、向量化的版本。
- 解释为什么 sigmoid 成对损失(SigLIP)可以在 batch 32768+ 的规模上扩展,而无需 softmax 所要求的全收集(all-gather)开销。
- 通过构建文本模板(`a photo of a {class}`)并对余弦相似度取 argmax,运行零样本 ImageNet 分类。
- 说出 CLIP / SigLIP 预训练带给你的四个调节杠杆:batch size、温度、prompt 模板、数据质量。

## 问题

CLIP 之前的视觉是监督式的。收集带标注的数据集(ImageNet:120 万张图像,1000 个类别),训练一个 CNN,然后交付。标注成本高昂,标注偏向于标注者能达成共识的内容,而且标签在不做微调的情况下无法迁移到新任务。

网络上的图文数据免费提供了超过十亿条粗略标注的配对。一张金毛寻回犬的照片配上替代文本"my dog Max in the park",就带有监督信号——文本描述了图像。问题是:你能否把它转化为有用的训练?

CLIP 的答案:把图文对当作一个匹配任务。给定一批 N 张图像和 N 条说明,学习将每张图像与它自己的说明相匹配,并与 N-1 个干扰项对抗。监督信号是"这两样东西属于一起;这 N-1 样不属于"。没有类别标签。没有人工标注。只有一个对比损失。

得到的嵌入空间能做到超出 CLIP 训练目标的事。ImageNet 零样本分类有效,是因为"a photo of a cat"的嵌入靠近那些从未被明确标注为猫的猫的图片。正是这一押注催生了每一个 2026 年的 VLM。

## 概念

### 双塔编码器

CLIP 有两个塔:

- 图像编码器 `f`:ViT 或 ResNet,为每张图像输出一个 D 维向量。
- 文本编码器 `g`:小型 transformer,为每条说明输出一个 D 维向量。

两个塔都将其输出归一化为单位长度。相似度即 `cos(f(x), g(y)) = f(x)^T g(y)`,因为两者都是单位范数。

对一个包含 N 对(图像, 说明)的 batch,构建形状为 `(N, N)` 的相似度矩阵 `S`:

```
S[i, j] = cos(f(x_i), g(y_j)) / tau
```

其中 `tau` 是一个可学习的温度(CLIP 初始化为 0.07;在对数空间中学习)。

### InfoNCE 损失

CLIP 对行和列使用对称的交叉熵:

```
loss_i2t = CE(S, labels=identity)     # each image's positive is its own caption
loss_t2i = CE(S^T, labels=identity)   # each caption's positive is its own image
loss = (loss_i2t + loss_t2i) / 2
```

这就是 InfoNCE。交叉熵中的 softmax 迫使每张图像与它的说明的匹配程度高于 batch 中其他所有说明。"负样本"是 batch 中的所有其他条目。更大的 batch = 更多负样本 = 更强的信号。CLIP 以 batch 32k 训练;规模很重要。

### 温度

`tau` 控制 softmax 的锐度。低 tau → 分布尖锐,产生难负样本挖掘效果。高 tau → 平滑,所有样本都有贡献。CLIP 学习 log(1/tau),并做截断以防止坍缩。SigLIP 2 固定了初始 tau,改为使用一个可学习的偏置。

### 为什么 sigmoid 扩展性更好(SigLIP)

Softmax 需要整个相似度矩阵保持同步。在分布式训练中,你必须把每个嵌入全收集(all-gather)到每个副本,然后再做 softmax。通信开销在世界大小上是平方级的。

SigLIP 用逐元素 sigmoid 替换 softmax:对每一对 `(i, j)`,损失是一个二元分类:"这是不是匹配的一对?"正类标签是对角线,其余全是负样本。损失为:

```
L = -1/N sum over (i, j) [ y_ij log sigmoid(S[i,j]) + (1-y_ij) log sigmoid(-S[i,j]) ]
```

匹配时 `y_ij = 1` 为 `i == j`,否则为 0。每一对的损失相互独立。无需 all-gather。每块 GPU 计算自己的局部块并求和。SigLIP 2 以低廉的成本扩展到 batch 32k-512k,而 CLIP 则需要成比例增加通信量。

### 零样本分类

给定 N 个类别名,为每个类别构建一个文本模板:

```
"a photo of a {class}"
```

用文本编码器嵌入每个模板。用图像编码器嵌入你的图像。对余弦相似度取 argmax = 预测类别。无需在目标类别上训练。

Prompt 模板很重要。CLIP 的原始论文为每个类别使用了 80 个模板(普通、艺术、照片、绘画等),并对嵌入取平均。ImageNet 提升 3 个点。现代用法通常只选一两个模板。

### 线性探针与微调

零样本是一个基线。线性探针(在冻结的 CLIP 特征之上为你的目标类别训练一层线性层)在域内任务上优于零样本。完整微调在域内优于线性探针,但可能损害零样本迁移能力。三种模式,三种权衡。

### SigLIP 2:NaFlex 与稠密特征

SigLIP 2(2025)增加了:
- NaFlex:单一模型处理任意长宽比和分辨率。
- 更好的稠密特征,用于分割和深度估计,目标是作为 VLM 中的冻结骨干。
- 多语言:在 100 多种语言上训练,而 CLIP 仅支持英语。
- 10 亿参数规模,而 CLIP 的上限是 4 亿。

在 2026 年的开源 VLM 中,SigLIP 2 SO400m/14 是默认的视觉塔。在纯图文检索场景中,若特定的 LAION-2B 训练分布与你的查询模式匹配,CLIP 仍是默认选择。

### ALIGN、BASIC、OpenCLIP、EVA-CLIP

ALIGN(Google,2021):与 CLIP 相同的思想,18 亿对规模,90% 是噪声数据。证明了噪声数据可以规模化。OpenCLIP(LAION):CLIP 在 LAION-400M / 2B 上的开源复现,多种规模,是首选的开源检查点。EVA-CLIP:从掩码图像建模初始化;是 VLM 的强大骨干。BASIC:Google 的 CLIP+ALIGN 混合体。都属于同一家族,只是数据和调参不同。

### 零样本天花板

CLIP 类模型的 ImageNet 零样本精度上限在 76% 左右(CLIP-G、OpenCLIP-G)。突破需要更大的数据(SigLIP 2 达到 80%+)或架构改动(监督头、更多参数)。该基准正在饱和;真正的价值在于下游 VLM 所消费的嵌入空间。

```figure
multimodal-fusion
```

## 动手使用

`code/main.py` 实现了:

1. 一个玩具双塔编码器(基于哈希的图像特征、文本字符特征),让你在没有 numpy 的情况下也能看到 InfoNCE 的形态。
2. 纯 Python 的 InfoNCE 损失(通过 log-sum-exp 保证数值稳定性)。
3. 用于对比的 sigmoid 成对损失。
4. 一个零样本分类流程:对一组文本提示计算余弦相似度,取 argmax 作预测。

运行它并观察损失曲线。绝对数值是玩具级别的;但曲线形态与真实 CLIP 训练器的输出一致。

## 发布技能

本课产出 `outputs/skill-clip-zero-shot.md`。给定一组图像(通过路径)和目标类别列表,它使用 CLIP 模板构建文本提示,用指定的检查点(例如 `openai/clip-vit-large-patch14`)嵌入两侧,并返回带相似度得分的 top-1 / top-5 预测。该技能拒绝对不在提示列表中的类别做出断言。

## 练习

1. 手工为一个 4 对的 batch 实现 InfoNCE。构建 4x4 相似度矩阵,运行 softmax,取对角线,计算交叉熵。用此手算结果验证你的 Python 实现。

2. SigLIP 在温度之外还使用偏置参数 `b`:`S'[i,j] = S[i,j]/tau + b`。当 batch 存在严重的类别不平衡时(每行中负样本远多于正样本),`b` 起什么作用?阅读 SigLIP 第 3 节(arXiv:2303.15343)。

3. 构建一个猫狗零样本分类器。尝试两个 prompt 模板:`a photo of a {class}` 和 `a picture of a {class}`。在 100 张测试图像上测量准确率。模板集成是否优于单个?

4. 计算在 512 块 GPU、batch 32k 的运行中,softmax InfoNCE 与 sigmoid 成对损失的通信开销。哪个是 O(N),哪个是 O(N^2)?引用 SigLIP 第 4 节。

5. 阅读 OpenCLIP 缩放定律论文(arXiv:2212.07143,Cherti et al.)。根据图中的数据复现其数据缩放结论:在模型规模固定时,ImageNet 零样本准确率与训练数据规模之间的对数线性关系是什么?

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|------------------------|
| InfoNCE | "对比损失" | 在一个 batch 的相似度矩阵上做交叉熵;每个条目的正样本是它的配对条目,负样本是其余全部 |
| Sigmoid 损失 | "SigLIP 损失" | 逐对二元交叉熵;无 softmax、无 all-gather,在分布式训练中低成本扩展 |
| 温度 | "tau" | 在 softmax/sigmoid 之前缩放 logits 的标量;控制分布的锐度 |
| 零样本 | "无需微调的分类" | 用文本提示构造类别嵌入,按余弦相似度分类;不在目标类别上训练 |
| Prompt 模板 | "a photo of a ..." | 围绕类别名的文本骨架;影响零样本准确率 1-5 个点 |
| 双塔编码器 | "Two-tower" | 一个图像编码器 + 一个文本编码器,输出到共享的 D 维空间 |
| 难负样本 | "难缠的干扰项" | 与正样本足够相似的负样本,模型必须努力才能把它们区分开 |
| 线性探针 | "冻结 + 一层" | 仅在冻结特征之上训练一个线性分类器;衡量特征质量 |
| NaFlex | "原生灵活分辨率" | SigLIP 2 的能力,可摄入任意长宽比和分辨率的图像而无需缩放 |
| 温度缩放 | "对数参数化的 tau" | CLIP 将 `log(1/tau)` 参数化以使梯度表现良好;做截断以防止 tau 坍缩到接近零 |

## 延伸阅读

- [Radford et al. — Learning Transferable Visual Models From Natural Language Supervision (arXiv:2103.00020)](https://arxiv.org/abs/2103.00020) — CLIP 论文。
- [Zhai et al. — Sigmoid Loss for Language Image Pre-Training (arXiv:2303.15343)](https://arxiv.org/abs/2303.15343) — SigLIP。
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) — 多语言 + NaFlex。
- [Jia et al. — ALIGN (arXiv:2102.05918)](https://arxiv.org/abs/2102.05918) — 用噪声网络数据扩展规模。
- [Cherti et al. — Reproducible scaling laws for contrastive language-image learning (arXiv:2212.07143)](https://arxiv.org/abs/2212.07143) — OpenCLIP 缩放定律。