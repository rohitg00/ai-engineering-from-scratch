# 03 · 从 CLIP 到 BLIP-2——作为模态桥梁的 Q-Former

> CLIP 能对齐图像与文本，却无法生成图像描述、回答问题或进行对话。BLIP-2（Salesforce，2023）用一个小型可训练桥梁解决了这一点：32 个可学习的查询向量通过交叉注意力（cross-attention）在一个冻结的 ViT 特征上做注意力运算，然后直接接入一个冻结大语言模型（LLM）的输入流。仅 188M 参数的桥梁，就把一个 11B 的 LLM 连到了一个 ViT-g/14 上。截至 2026 年，所有基于适配器（adapter）的视觉语言模型（VLM）——MiniGPT-4、InstructBLIP、LLaVA 的同类——都是它的后裔。本课会研读 Q-Former 的架构、讲清它的两阶段训练，并构建一个把视觉 token 喂给冻结文本解码器的玩具版本。

**类型：** 构建
**语言：** Python（标准库，交叉注意力 + 可学习查询演示）
**前置：** 阶段 12 · 02（CLIP）、阶段 7（Transformer）
**时长：** 约 180 分钟

## 学习目标

- 解释为什么在冻结视觉编码器与冻结 LLM 之间放一个可训练瓶颈，在成本和稳定性上都优于端到端微调。
- 实现一个交叉注意力模块，让一组固定的可学习查询对外部图像特征做注意力运算。
- 走通 BLIP-2 的两阶段预训练：表征学习（ITC + ITM + ITG），再到生成学习（在冻结解码器下的语言模型损失）。
- 把 Q-Former 与 LLaVA 中更简单的 MLP 投影器对比，论证各自在何种场景下胜出。

## 问题所在

你有一个冻结的 ViT，它为每张图像产出 256 个维度为 1408 的图块（patch）token。你还有一个冻结的 7B LLM，它期望输入维度为 4096 的 token 嵌入。最直白的桥梁——一个从 1408 到 4096 的线性层——能用，但把全部 256 个 patch token 喂进 LLM 的上下文，每张图像就要多消耗 256 个 token。一批 32 张图像，光视觉模态本身就吃掉 8192 个 token。

BLIP-2 提出的问题是：你能否把 256-token 的图像表征压缩成少得多的 token（比如 32 个），同时保留足够的信息，让 LLM 能够生成描述、回答问题并对图像进行推理？以及，你能否在不触碰冻结骨干网络的前提下训练这座桥，把训练成本控制在仅桥梁参数这一项上？

答案是：一个 Q-Former。32 个可学习的「查询（query）」向量对 ViT 的 patch token 做交叉注意力，产出一份 32-token 的视觉摘要供 LLM 消费。总共 188M 参数。在接触 LLM 之前，先用对比、匹配和生成三类目标训练。

## 核心概念

### 可学习查询

Q-Former 的核心戏法是：与其让 LLM 的文本 token 去注意图像 patch，不如引入一组全新的、32 个可学习的查询向量 `Q`，让*它们*去注意图像 patch。这些查询是模型的参数——它们在训练中被学习，且同样的 32 个查询用于每一张图像。

经过交叉注意力之后，每个查询都持有图像的一份压缩摘要——「描述主体物体」「描述背景」「数物体个数」等等。这些查询并不会字面意义上专门对应某些语义标签；它们学到的是任何能让下游损失下降的编码方式。

### 架构

Q-Former 是一个小型 Transformer（12 层，约 100M 参数），有两条路径：

1. 查询路径：32 个查询向量先经过自注意力（在它们彼此之间），再对冻结 ViT 的 patch token 做交叉注意力，最后过前馈网络（FFN）。
2. 文本路径：一个类 BERT 的文本编码器，与查询路径共享自注意力和 FFN 权重。文本路径禁用交叉注意力。

训练时两条路径都运行。查询与文本通过共享的自注意力相互作用，这意味着查询可以在需要时以文本为条件（用于 ITM、ITG）。在为 VLM 做交接的推理阶段，只有查询流过，产出 32 个视觉 token。

### 两阶段训练

BLIP-2 分两阶段预训练：

阶段 1：表征学习（不涉及 LLM）。三个损失：
- ITC（图文对比，image-text contrastive）：在池化后的查询 token 与文本 CLS token 之间做 CLIP 式对比。
- ITM（图文匹配，image-text matching）：二分类器——这对图文是匹配的吗？采用难负样本挖掘（hard-negative-mined）。
- ITG（图像引导的文本生成，image-grounded text generation）：以查询为条件，在文本上接一个因果语言模型头。强制查询编码可被文本生成的内容。

只有 Q-Former 训练。ViT 冻结。不涉及 LLM。

阶段 2：生成学习。接上一个冻结的 LLM（OPT-2.7B 或 Flan-T5-XL 等）。通过一个小型线性层把 32 个查询输出投影到 LLM 的嵌入维度。把它们前置（prepend）到文本提示前面。仅在拼接后的「提示 + 图像 + 描述」序列上，用语言模型损失训练这个线性投影和 Q-Former。

阶段 2 之后，Q-Former + 投影就是完整的视觉适配器。推理时：图像 → ViT → Q-Former → 线性投影 → 前置到文本 → 冻结 LLM 输出结果。

### 参数经济学

BLIP-2 = ViT-g/14（1.1B，冻结）+ OPT-6.7B（6.7B，冻结）+ Q-Former（188M，训练）= 共 8B，训练 188M。仅 Q-Former 就约占整个栈参数的 2.4%。训练成本也反映了这一点：在少数几块 A100 上训练数天，对比端到端训练所需的数周。

质量：BLIP-2 在零样本 VQA（视觉问答）上达到或超越 Flamingo-80B，而体量只有它的 1/50。这座桥行得通。

### InstructBLIP 与指令感知的 Q-Former

InstructBLIP（2023）为 Q-Former 增加了一个额外输入：指令文本本身。在做交叉注意力时，查询现在可以同时访问图像 patch 和指令。查询可以按指令做专门化（「数车的数量」「描述氛围」），而不再只学一份固定的摘要。在留出（held-out）任务上取得了基准提升。

### MiniGPT-4 与仅投影器方案

MiniGPT-4 保留了 Q-Former，但只训练输出线性投影，其余一切冻结。便宜，但代价是质量——那些查询是 BLIP-2 的，不是你的。适合快速迭代，但不是最佳架构。

### 为什么 LLaVA 走了更简单的路

LLaVA（2023，第 12.05 课）把 Q-Former 换成了一个朴素的 2 层 MLP，将每个 ViT patch token 投影到 LLM 空间——对于 24x24 网格就是每张图像 576 个 token，全部喂给 LLM。压缩更差，但让 LLM 能在原始 patch 上做注意力。当时这是有争议的；到 2023 年底它已占据主导，因为视觉指令数据（LLaVA-Instruct-150k）证明了 MLP 可以被训练到保留足够的信号。代价是：LLaVA 的上下文填得更快，但它能自然扩展到多图和视频。

到 2026 年，这一领域分化了：在 token 预算重要的场景（长视频、多图）Q-Former 存活下来；在以每 token 原始质量为优先的场景，MLP 投影器占主导。

### 门控交叉注意力：Flamingo，那位先祖

Flamingo（第 12.04 课）早于 BLIP-2，使用了相同的交叉注意力思想，但作用于冻结 LLM 的*每一层*，而非作为单一桥梁。BLIP-2 表明你可以只压缩到输入层、依然行得通。Gemini 和 Idefics 两者兼用：交错的输入 token，加上可选的门控交叉注意力以支持上下文内少样本（few-shot）。

### 2026 年的后裔

- Q-Former：BLIP-2、InstructBLIP、MiniGPT-4，以及出于 token 预算考虑的大多数视频-语言模型。
- Perceiver 重采样器（Perceiver resampler）：Flamingo 的变体（第 12.04 课）；Idefics 家族、Eagle、OmniMAE。
- MLP 投影器：LLaVA、LLaVA-NeXT、LLaVA-OneVision、Cambrian-1。
- 注意力池化（Attention pool）：VILA、PaliGemma。

四者都成立。决定性的问题是：你受限于 token 预算，还是受限于每 token 的质量。

## 动手用

`code/main.py` 用标准库构建一个 Q-Former 风格的交叉注意力：

1. 模拟 256 个图像 patch token（维度 128）。
2. 实例化 32 个可学习查询（维度 128）。
3. 运行缩放点积交叉注意力（Q 来自查询，K/V 来自 patch）。
4. 通过一个线性层投影到 LLM 维度（512）。
5. 输出这 32 个可供 LLM 使用的视觉 token。

全部数学运算用纯 Python（对向量做嵌套循环）。是玩具版，但形状正确。会打印出注意力权重矩阵，让你看到每个查询分别从哪些 patch 取了信息。

## 交付物

本课产出 `outputs/skill-modality-bridge-picker.md`。给定一个目标 VLM 配置（视觉编码器 token 数、LLM 上下文预算、部署约束、质量目标），它会在 Q-Former、MLP、Perceiver 重采样器之间给出推荐，并附上简短理由和每种桥梁的参数量估计。

## 练习

1. 用 PyTorch 实现交叉注意力模块。验证在 32 个查询、256 个键/值的情况下，注意力权重矩阵为 32 x 256，且经过 softmax 后每行之和为 1。

2. 在 BLIP-2 的阶段 1 中，Q-Former 同时运行三个损失：ITC、ITM、ITG。用伪代码写出每个损失的前向签名。哪一个需要文本编码器路径处于激活状态？

3. 对比参数量：Q-Former（12 层，768 隐藏维）对比一个 2 层 MLP 投影器（1408 → 4096，两层）。在多大的 LLM 规模下，188M 的 Q-Former 开销能在训练效率上回本？

4. 阅读 BLIP-2 论文（arXiv:2301.12597）第 3.2 节关于 Q-Former 如何初始化的内容。解释为什么从 BERT-base 初始化（而非随机初始化）能加速收敛。

5. 对于一段 10 分钟、以 1 FPS 采样为 60 帧的视频，计算每帧的 token 成本：（Q-Former → 32 token/帧）对比（MLP 投影器 → 576 token/帧）。哪一个能塞进 128k-token 的 LLM 上下文窗口？

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| Q-Former | 「查询式 Transformer（Querying transformer）」 | 一个带 32 个可学习查询向量的小型 Transformer，对冻结 ViT 特征做交叉注意力 |
| 可学习查询（Learnable queries） | 「视觉的软提示（soft prompt）」 | 一组固定参数，充当交叉注意力的查询侧；逐模型学习，在所有输入间共享 |
| 交叉注意力（Cross-attention） | 「Q 来自这边，K/V 来自那边」 | 查询、键、值来自不同来源的注意力；即查询从 ViT patch 取信息的方式 |
| ITC | 「图文对比」 | 应用于 Q-Former 池化查询与文本 CLS 之间的 CLIP 式损失 |
| ITM | 「图文匹配」 | 在难负样本挖掘的配对上做二分类；强制查询去辨别细粒度的不匹配 |
| ITG | 「图像引导的文本生成」 | 以查询为条件生成文本的因果语言模型损失；强制查询编码可被文本解码的内容 |
| 两阶段预训练 | 「先表征再生成」 | 阶段 1 单独训练 Q-Former（ITC/ITM/ITG）；阶段 2 接上冻结 LLM，仅训练投影 + Q-Former |
| 冻结骨干（Frozen backbone） | 「不要微调」 | 视觉编码器和 LLM 权重固定不变；只有桥梁训练 |
| 投影头（Projection head） | 「线性到 LLM 维度」 | 把 Q-Former 输出映射到 LLM 嵌入维度的最后一个线性层 |
| Perceiver 重采样器（Perceiver resampler） | 「Flamingo 的版本」 | 类似的可学习查询交叉注意力，被 Flamingo 用在每一层而非作为单一桥梁 |

## 延伸阅读

- [Li et al. — BLIP-2（arXiv:2301.12597）](https://arxiv.org/abs/2301.12597)——核心论文。
- [Li et al. — BLIP（arXiv:2201.12086）](https://arxiv.org/abs/2201.12086)——带有 ITC/ITM/ITG 三件套的前身。
- [Li et al. — ALBEF（arXiv:2107.07651）](https://arxiv.org/abs/2107.07651)——「先对齐再融合（align before fuse）」——阶段 1 训练的概念先祖。
- [Dai et al. — InstructBLIP（arXiv:2305.06500）](https://arxiv.org/abs/2305.06500)——指令感知的 Q-Former。
- [Zhu et al. — MiniGPT-4（arXiv:2304.10592）](https://arxiv.org/abs/2304.10592)——仅投影器方案。
- [Jaegle et al. — Perceiver IO（arXiv:2107.14795）](https://arxiv.org/abs/2107.14795)——可学习查询交叉注意力的通用架构。
