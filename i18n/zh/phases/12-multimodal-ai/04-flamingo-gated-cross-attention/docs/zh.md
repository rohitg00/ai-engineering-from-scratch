# Flamingo 与门控交叉注意力用于少样本视觉语言模型

> DeepMind 的 Flamingo(2022)比所有人都早做到了两件事。它证明单个模型可以处理任意交错的图像、视频和文本序列。它还证明 VLM 可以进行上下文学习——给出一个包含三组示例(图像, 描述)对的少样本提示,模型无需任何梯度步骤就能为新图像生成描述。其机制是:门控交叉注意力层,插入在冻结 LLM 的现有层之间,并使用一个初始值为零的可学习 tanh 门控,从而在初始化时保留 LLM 的文本能力。本课程将讲解 Flamingo 的 Perceiver 重采样器和门控交叉注意力架构——它是 Gemini 交错输入和 Idefics2 视觉 token 的鼻祖。

**Type:** Learn
**Languages:** Python(标准库,门控交叉注意力 + Perceiver 重采样器演示)
**Prerequisites:** 阶段 12 · 03(BLIP-2 Q-Former)
**Time:** ~120 分钟

## 学习目标

- 解释门控交叉注意力如何通过 tanh(gate) = 0 在初始化时保留冻结 LLM 的文本能力。
- 讲解 Perceiver 重采样器:N 个图像 patch → 通过交叉注意力得到 K 个固定的"潜在"查询。
- 描述 Flamingo 如何通过遵循图像位置关系的因果掩码处理交错的图文序列。
- 复现少样本多模态提示结构(3 组图像-描述示例,然后是一张查询图像)。

## 问题

BLIP-2 将 32 个视觉 token 输入到冻结 LLM 的输入层。这对每个提示一张图像有效。但如果你想输入*多张*与文本交错的图像,比如"这是图像 A,给它写描述;这是图像 B,给它写描述;现在是图像 C,给它写描述"怎么办?LLM 的自注意力需要在单一序列中同时处理图像 token 和文本 token,而哪些位置可以关注哪些图像的问题会变得棘手。

Flamingo 的答案是:完全不改变 LLM 的输入流。在现有 LLM 模块之间插入额外的交叉注意力层。文本 token 依然像往常一样流经 LLM 的因果自注意力。在每几个 LLM 模块之间,文本 token 还会通过一个新增的门控层对图像特征进行交叉注意力。门控(初始化为零)意味着在初始时刻新层是空操作——模型的行为与预训练 LLM 完全一致。随着训练进行,门控逐渐打开,视觉信息开始流入。

Flamingo 回答的第二个问题:如何处理每个提示中数量可变的图像(0 张、1 张或多张)?答案是 Perceiver 重采样器——一个小型交叉注意力模块,接收任意数量的 patch 并产生固定数量的视觉潜在 token。无论提示中有多少张图像,LLM 的交叉注意力层看到的形状都相同。

## 核心概念

### 冻结的 LLM

Flamingo 以一个冻结的 Chinchilla 70B LLM 为基础。全部 70B 权重保持不动。现有的文本自注意力和 FFN 正常运行。

### Perceiver 重采样器

对于提示中的每张图像,ViT 产生 N 个 patch token。Perceiver 重采样器有 K 个固定的可学习潜在向量(Flamingo 使用 K=64)。每个重采样器模块包含两个子步骤:

1. 交叉注意力:K 个潜在向量对 N 个 patch token 进行注意力(Q 来自潜在向量,K/V 来自 patch)。
2. 潜在向量之间的自注意力 + FFN。

经过 6 个重采样器模块后,输出是 K=64 个维度为 1024 的视觉 token,无论 ViT 产生了多少 patch。一张 224x224 的图像(196 个 patch)和一张 480x480 的图像(900 个 patch)都输出 64 个重采样器 token。

对于视频,重采样器按时间维度应用:每帧的 patch 产生 64 个潜在向量,并通过时间位置编码让模型区分 t=0 和 t=N。完整视频变成 T * 64 个视觉 token。

### 门控交叉注意力

在冻结 LLM 的每 M 层之间(Flamingo 使用 M=4),插入一个新的门控交叉注意力模块:

```
x_after_llm_block = llm_block(x_before)
cross = cross_attn(x_after, resampler_output)
gated = tanh(alpha) * cross + x_after
x_before_next_block = gated
```

- `alpha` 是一个初始化为零的可学习标量。
- `tanh(0) = 0`,因此在初始化时门控分支的贡献为零。
- 随着 `alpha` 偏离零,交叉注意力的贡献平滑增长。
- 残差连接意味着即使门控完全打开,也不会覆盖 LLM 的文本表示;它只是在文本表示之上叠加视觉信息。

这是 Flamingo 中最重要的单一设计选择:视觉条件化是加性的、门控的、且在初始化时为零。初始时刻的 Flamingo 在纯文本输入上就是一个完美的 Chinchilla 70B。

### 用于交错输入的掩码交叉注意力

在类似"<图像 A> 描述 A <图像 B> 描述 B <图像 C> ?"的提示中,每个文本 token 只应看到序列中出现在它之前的图像。交叉注意力掩码强制规定:位置 `t` 处的文本 token 只关注图像索引为 `i < i_t` 的图像重采样器 token,其中 `i_t` 是位置 `t` 之前最近的图像。"只看到前一张最近的图像"或"看到所有之前的图像"都是合理的选择;Flamingo 选择了前者。

### 上下文少样本学习

一个 Flamingo 提示形如:

```
<image1> A photo of a cat. <image2> A photo of a dog. <image3> A photo of a
```

模型看到补全模式并输出"bird"(或 image3 显示的任何内容)。没有梯度步骤。冻结 LLM 的上下文学习能力通过门控交叉注意力传递下来——这是这篇论文的核心亮点,也是它重要的原因。

### 训练数据

Flamingo 在三个数据集上训练:

1. MultiModal MassiveWeb(M3W):4300 万个图文交错的网页,重建了阅读顺序。
2. 图像-文本对(ALIGN + LTIP):44 亿对。
3. 视频-文本对(VTP):2700 万个短视频片段。

OBELICS(2023)是交错网页语料库的开放复现,Idefics、Idefics2 以及大多数开放的"类 Flamingo"模型都在其上训练。

### OpenFlamingo 与 Otter

OpenFlamingo(2023)是开放复现版本。架构完全相同(Perceiver 重采样器 + 冻结 LLaMA 或 MPT 上的门控交叉注意力)。检查点包括 3B、4B、9B。由于基础 LLM 更小、数据更少,质量落后于 Flamingo。

Otter(2023)基于 OpenFlamingo,在 MIMIC-IT(一个多模态指令数据集)上进行了指令微调,证明门控交叉注意力同样适用于指令跟随。

### 后继者

- Idefics / Idefics2 / Idefics3:Hugging Face 的门控交叉注意力谱系,逐步简化(Idefics2 放弃了重采样器,改用带自适应池化的直接 patch token)。
- 从 Flamingo 到 Chameleon 的转变:到 2024 年,许多团队转向早期融合(第 12.11 课);Flamingo 风格的门控交叉注意力在需要冻结主干的应用中仍在生产使用。
- Gemini 的交错输入:在概念上继承了 Flamingo 交错格式的灵活性,尽管具体机制未公开。

### 与 BLIP-2 的比较

| | BLIP-2 | Flamingo |
|---|---|---|
| 视觉桥接 | 输入处的 Q-Former(一次) | 每 M 层一次门控交叉注意力 |
| 视觉 token | 每图 32 个 | 每图每交叉注意力层 64 个 |
| 冻结 LLM | 是 | 是 |
| 少样本上下文学习 | 弱 | 强——论文的核心亮点 |
| 交错输入 | 无原生支持 | 有,正是设计目标 |
| 训练数据 | 1.3 亿对 | 13 亿对 + 4300 万交错网页 |
| 参数量 | 训练 1.88 亿 | 训练约 100 亿(交叉注意力层) |
| 算力 | 8 块 A100 上数天 | 数千块 TPUv4 上数周 |

预算有限的单图 VQA 选择 BLIP-2。交错、少样本或多图推理选择 Flamingo/Idefics2。

```figure
cross-attention-fusion
```

## 动手实践

`code/main.py` 演示了:

1. 一个在 36 个模拟 patch token 上使用 8 个可学习潜在向量的 Perceiver 重采样器(纯 Python 交叉注意力)。
2. 一个门控交叉注意力步骤:`alpha = 0` → 输出等于输入(LLM 不变),然后 `alpha = 2.0` → 视觉贡献被混入。
3. 一个交错掩码构建器,为"(图像 1)(文本 1)(图像 2)(文本 2)"序列生成二维注意力掩码。

## 上线检验

本课程产出 `outputs/skill-gated-bridge-diagnostic.md`。给定一个开放 VLM 的配置(是否有重采样器、交叉注意力频率、门控方案),它会识别其中的 Flamingo 谱系元素并解释冻结策略。对于调试微调为何导致文本性能下降很有用(答案:门控开得太快、太宽)。

## 练习

1. 计算 Flamingo-9B 的视觉参数量:9B LLM + 1.4B 门控交叉注意力层 + 64M 重采样器。训练的参数占总参数的比例是多少?

2. 在 PyTorch 中实现门控残差 `y = tanh(alpha) * cross + x`。通过实验证明在 `alpha=0` 时,初始化时 `y==x` 精确成立。

3. 阅读 OpenFlamingo 第 3.2 节(arXiv:2308.01390),了解当批处理中每个提示的图像数量不同时,他们如何处理多张图像。描述其填充(padding)策略。

4. 为什么 Flamingo 的交叉注意力掩码让文本 token 只关注*最近一张*之前的图像,而不是所有之前的图像?阅读 Flamingo 论文第 2.4 节并解释其中的权衡。

5. 上下文少样本:为一个新的 Flamingo 变体构建一个包含 4 个"图像 → 主体颜色"示例的提示。描述当示例数量从 0 变到 8 时预期的准确率模式。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| Perceiver 重采样器 | "固定潜在交叉注意力" | 从可变数量的输入 patch 产生 K 个固定 token 的模块 |
| 门控交叉注意力 | "Tanh 门控桥接" | 残差层 `y = tanh(alpha)*cross + x`,可学习 alpha,初始值为 0 |
| 交错输入 | "混合序列" | 图像和文本按阅读顺序自由混合的提示格式 |
| 冻结 LLM | "无 LLM 梯度" | 文本 LLM 的权重不更新;只有重采样器 + 交叉注意力层被训练 |
| 少样本 | "上下文示例" | 在提示中给出几组(图像, 答案)对;模型无需微调即可泛化 |
| OBELICS | "交错网页语料库" | 包含 1.41 亿个按阅读顺序排列图文网页的开放数据集 |
| Chinchilla | "70B 冻结基础" | Flamingo 的冻结文本 LLM,来自 DeepMind 的 Chinchilla 论文 |
| 门控调度 | "alpha 如何变化" | 训练期间交叉注意力门控打开的速率 |
| 交叉注意力频率 | "每 M 层一次" | 插入门控交叉注意力模块的频率;Flamingo 使用 M=4 |
| OpenFlamingo | "开放复现" | MosaicML/LAION 的 3-9B 开放检查点;架构与 Flamingo 完全相同 |

## 延伸阅读

- [Alayrac et al. — Flamingo (arXiv:2204.14198)](https://arxiv.org/abs/2204.14198) — 原始论文。
- [Awadalla et al. — OpenFlamingo (arXiv:2308.01390)](https://arxiv.org/abs/2308.01390) — 开放复现。
- [Laurençon et al. — OBELICS (arXiv:2306.16527)](https://arxiv.org/abs/2306.16527) — 交错网页语料库。
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) — 通用的 Perceiver 架构。
- [Li et al. — Otter (arXiv:2305.03726)](https://arxiv.org/abs/2305.03726) — 指令微调的 Flamingo 后继者。
- [Laurençon et al. — Idefics2 (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246) — 对 Flamingo 方法的现代简化。