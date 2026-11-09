# 语和视觉语言预训

> 开放AI的CLIP (2021) 证明了一个足够大的想法,可以在未来五年内实现:将图像编码器和文本编码器在同一向量空间中, 没有监督标签. 两千万个. 结果的嵌入空间进行零射击分类,图像文本检索,并作为其视觉塔插入每一个2026 VLM. siglip 2 (2025) 取代软max 通过sigmoid,以更低的成本扩展到CLIP之后. 这一课将从InfoNCE到sigmoid对式损失的数学进行,并建立了在 stdlib Python 中的训练步骤.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, InfoNCE + sigmoid loss implementations)
**Prerequisites:** Phase 12 · 01 (ViT patches), Phase 7 (Transformers)
**Time:** ~180 minutes

## 学习目标

- 通过互通信息来推导InfoNCE损失,并实现数量稳定的向量化版本.
- 解释为什么sigmoid对式损失 (SigLIP) 达到32768+批量,而没有全集的上空软max要求.
- 通过构建文本模板来运行零截图的 ImageNet 分类 (`a photo of a {class}`) 和使用 argmax 与 cosine 类似性相比.
- 列出CLIP/SigLIP预训练给你提供的四个杆:批量大小,温度,提示模板,数据质量.

## 问题

监督CLIP前的视觉.收集标记数据集 (ImageNet: 1.2M图像, 1000 类),训练一个CNN,运输它.标签昂贵,标签偏向标签商可以同意,标签不会转移到新的任务没有细节调整.

图像标题网有超过10亿个宽松标签的双色球免费.一个带有"我的狗马克斯在公园"的黄金回归器的图片带有监督信号.

根据Clip的答案:把图像标题对应当作匹配任务. 鉴于一批N图像和N标题,学会与N-1分散注意力的标题匹配. 监督是"这两件事相应,这些N-1不. "没有类标签.没有人注释.只是一个反驳的损失.

图像网的零射击效果是因为"一张猫的照片"嵌入了没有明确标记的猫的照片附近.这是每2026年VLM产生的一项投注.

## 概念

### 双码码器

克利普有两个塔楼:

- 图像编码器`f`视频或ResNet,输出每张图像的D-dim向量.
- 文字编码器`g`转换器,每字幕输出一个D-dim向量.

两座塔都将输出正常化到单位长度.`cos(f(x), g(y)) = f(x)^T g(y)`由于它们都是单位标准.

为了一批$N$它们是对的,构建类似性矩阵.`S`形状`(N, N)`其他:

```math
S[i, j] = \cos(f(x_i), g(y_j)) / \tau
```

在哪里`tau`是学习温度 (CLIP初始化为0.07;在日记空间中学习).

### 信息NCE损失

通过Clip,在行列和列中使用对称的交叉透:

```
loss_i2t = CE(S, labels=identity)     # each image's positive is its own caption
loss_t2i = CE(S^T, labels=identity)   # each caption's positive is its own image
loss = (loss_i2t + loss_t2i) / 2
```

这就是InfoNCE.CE中软max强迫每个图像比批次中的其他所有标题更符合其标题."负"是所有其他批次的项目.较大的批次 =更多负面 =更强的信号.Clip训练在批次32k;规模是重要的.

### 温度

`tau`低 低 低 低 低 低$\tau$矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业的矿产业$\tau$,所有样本都会有所贡献.$\log(1/\tau)$缩后,将其切断,以防止崩.$\tau$而是使用一种学会的偏见.

### 为什么sigmoid 尺度更好 (SigLIP)

在分布式训练中,你必须把每个嵌入到每个复制品中,然后做软max.这是世界尺寸的方形.

siglip取代 softmax 用元素智能sigmoid:为每对 `(i, j)`输出是"这些是匹配的对吗?"正数类标签是对角,其他的一切都是负数.

```math
L = -\frac{1}{N} \sum_{(i, j)} \Big[ y_{ij} \log \mathop{\mathrm{sigmoid}}(S[i,j]) + (1-y_{ij}) \log \mathop{\mathrm{sigmoid}}(-S[i,j]) \Big]
```

`y_ij = 1`如果`i == j`任何 GPU 都需要一个全集. 每个 GPU 都计算出其本地块和数量. SigLIP 2 量化为 32k-512k 批量便宜, CLIP 需要比较多的通信.

### 零射分类

给给N类名称,为每个类构建一个文本模板:

```
"a photo of a {class}"
```

嵌入每个模板与文本编码器. 嵌入图像与图像编码器. Argmax cosine 类似性 = 预测类. 没有对目标类进行培训.

快速模板是重要的.CLIP的原始论文每类使用80个模板 (平坦,艺术,照片,绘画等) 并平均嵌入. +3 图像网点.现代使用通常选择一个或两个模板.

### 线性探测器和细调

零射线是基线.线性探测器 (为目标类的CIP功能加上一个线性层) 在域内任务中比零射线更好.完整的细节调整在域内探测器比线性探测器更好,但可以损害零射线转移.三个模式具有三个折扣.

### 标LIP 2: NaFlex 和密集的特征

siglip 2 (2025) 补充:
- 纳弗莱克斯:单个模型处理可变的面积比和分辨率.
- 较好的密度功能用于细分和深度估计, 针对于VLM中作为结的脊柱.
- 多语言:在CIP仅使用英语的100多种语言上接受培训.
- 升到400米的1B参数尺度.

在2026年开放的VLM中,SigLIP 2 SO400m/14是默认的视觉塔.Clip仍然是纯图像文本检索的默认,其中特定的LAION-2B训练分布与查询模式匹配.

### 其他技术: 技术技术

简单的数据量度:CLIP (Google, 2021):与CLIP相同的想法,1.8B双尺度,90%的噪音. 已证明的噪音数据量度.OpenCLIP (LAION):在LAION-400M/2B上CLIP的开放复制,多个尺度,开放检查点.EVA-CLIP:从面具图像建模开始;VLM的强大脊柱.BASIC:谷歌的CLIP+ALIGN混合动力.所有相同的家族,不同的数据和调整.

### 零射击的天花板

CLIP类型的模型约占76%的ImageNet零射 (CLIP-G,OpenCLIP-G).此外需要更大的数据 (SigLIP 2获得80%+) 或结构变化 (监督头部,更多参数).基准值是和;实际值是下游VLM所消耗的嵌入空间.

```figure
multimodal-fusion
```

## 用它

`code/main.py`执行:

1. 玩具双码码器 (基于hash的图像功能,文字图表功能),以便您可以在无的情况下看到InfoNCE形状.
2. 在纯Python中输入InfoNCE (通过 log-sum-exp进行数字稳定).
3. 形双向损失比较.
4. 零射分类例程:计算与一组文本提示相似的共数,预测的 argmax.

运行它,看输法曲线.绝对数字是玩具;形状与真正的Clip训练师的排放相匹配.

## 运送它

这一课产生了`outputs/skill-clip-zero-shot.md`鉴于图像集 (通过路径) 和目标类的列表,它使用CLIP模板构建文本提示,并将两个侧面嵌入到指定检查点 (例如,`openai/clip-vit-large-patch14`),并返回与相似度分数的前1/前5预测.技能拒绝对未列入提示列表的类别提出索赔.

## 运动

1. 通过手动实现4对的InfoNCE. 构建4x4相似度矩阵,运行软max,选择对角,计算交叉. 根据手动计算验证您的Python实现.

2. siglip使用偏差参数`b`除了温度: `S'[i,j] = S[i,j]/tau + b`什么角色?`b`对于一轮的负数比正数多得多,请参阅SigLIP第3节 (arXiv:2303.15343).

3. 建立一个零射击分类器, 试试两个提示模板:`a photo of a {class}`其他`a picture of a {class}`测量100个试图图的精度. 模板组单击吗?

4. 计算软max InfoNCE 与 sigmoid 的通信成本,为512GPU运行,在32k批量.$O(N)$作为一个$O(N^2)$引用西格利普第4节.

5. 根据数据量化结果,再现他们对数据量化的结论:在固定模型尺寸下,ImageNet零截图精度和训练数据尺寸之间的日志线性关系是什么?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| InfoNCE | "Contrastive loss" | Cross-entropy over a batch's similarity matrix; each item's positive is its paired item, negatives are everything else |
| Sigmoid loss | "SigLIP loss" | Per-pair binary cross-entropy; no softmax, no all-gather, scales cheaply in distributed training |
| Temperature | "tau" | Scalar that scales logits before softmax/sigmoid; controls sharpness of the distribution |
| Zero-shot | "no-finetune classification" | Use text prompts to construct class embeddings and classify by cosine similarity; no training on target classes |
| Prompt template | "a photo of a ..." | Text scaffold around a class name; affects zero-shot accuracy by 1-5 points |
| Dual encoder | "Two-tower" | One image encoder + one text encoder, outputs in shared D-dim space |
| Hard negative | "Tough distractor" | A negative similar enough to the positive that the model has to work to separate them |
| Linear probe | "Frozen + one layer" | Train only a linear classifier on top of frozen features; measures feature quality |
| NaFlex | "Native flexible resolution" | SigLIP 2 capability to ingest images at any aspect ratio and resolution without resizing |
| Temperature scaling | "log-parametrized tau" | CLIP parametrizes `log(1/tau)` so gradients behave; clips to prevent collapse to near-zero tau |

## 进一步阅读

- [Radford et al. — Learning Transferable Visual Models From Natural Language Supervision (arXiv:2103.00020)](https://arxiv.org/abs/2103.00020)Clip文件.
- [Zhai et al. — Sigmoid Loss for Language Image Pre-Training (arXiv:2303.15343)](https://arxiv.org/abs/2303.15343)   
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786)多语言 + NaFlex.
- [Jia et al. — ALIGN (arXiv:2102.05918)](https://arxiv.org/abs/2102.05918)使用噪音的网页数据进行扩展.
- [Cherti et al. — Reproducible scaling laws for contrastive language-image learning (arXiv:2212.07143)](https://arxiv.org/abs/2212.07143)开放CLIP扩展法
