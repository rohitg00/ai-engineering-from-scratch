# 从 CLIP 到 BLIP-2 — Q-Former 作为模态桥梁

> CLIP 对齐图像和文本，但无法生成标题、回答问题或进行对话。BLIP-2（Salesforce，2023）用一个小的可训练桥梁解决了这个问题：32 个可学习的 query 向量通过 cross-attention 关注冻结 ViT 的特征，然后直接插入冻结 LLM 的输入流。1.88 亿参数的桥梁将一个 110 亿参数的 LLM 连接到 ViT-g/14。到 2026 年，每个基于适配器的 VLM——MiniGPT-4、InstructBLIP、LLaVA 的表亲——都是其后代。本课阅读 Q-Former 的架构，解释其两阶段训练，并构建一个 toy 版本，将视觉 token 喂入冻结的文本解码器。

**类型：** Build
**语言：** Python（stdlib，cross-attention + 可学习 query 演示）
**前置知识：** Phase 12 · 02（CLIP），Phase 7（Transformers）
**时间：** ~180 分钟

## 学习目标

- 解释为什么在冻结视觉编码器和冻结 LLM 之间设置可训练瓶颈，在成本和稳定性上优于端到端微调。
- 实现一个 cross-attention block，其中固定的一组可学习 query 关注外部图像特征。
- 走过 BLIP-2 的两阶段预训练：表示学习（ITC + ITM + ITG），然后生成学习（冻结解码器上的 LM 损失）。
- 将 Q-Former 与 LLaVA 使用的更简单的 MLP projector 进行比较，并论证每种选择何时获胜。

## 问题所在

你有一个冻结的 ViT，每张图像产生 256 个 dim 1408 的 patch token。你有一个冻结的 7B LLM，期望 dim 4096 的 token 嵌入。明显的桥梁——从 1408 到 4096 的线性层——有效，但将所有 256 个 patch token 喂入 LLM 的上下文每张图像消耗 256 个额外 token。在 32 张图像的 batch 中，仅视觉模态就消耗 8192 个 token。

BLIP-2 的问题：你能将 256-token 图像表示压缩成更少的 token（比如 32 个），同时保留足够的信息让 LLM 生成标题、回答问题和推理图像吗？而且你能在不触碰冻结 backbone 的情况下训练这个桥梁，将训练成本保持在仅桥梁的参数吗？

答案：Q-Former。32 个可学习的"query"向量 cross-attend 到 ViT 的 patch token，产生一个 32-token 的视觉摘要供 LLM 消费。总共 1.88 亿参数。在触碰 LLM 之前，用对比、匹配和生成目标训练。

## 核心概念

### 可学习 query

Q-Former 的核心技巧：不是让 LLM 的文本 token 关注图像 patch，而是引入一组新的 32 个可学习 query 向量 `Q`，让*它们*关注图像 patch。Query 是模型的参数——在训练期间学习，相同的 32 个 query 用于每张图像。

Cross-attention 之后，每个 query 持有图像的压缩摘要——"描述主要对象"、"描述背景"、"数对象"等。Query 不会字面专门化语义标签；它们学习任何使下游损失下降的编码。

### 架构

Q-Former 是一个小型 transformer（12 层，~1 亿参数），有两条路径：

1. Query 路径：32 个 query 向量流过 self-attention（在它们之间），然后 cross-attention 到冻结 ViT 的 patch token，然后 FFN。
2. 文本路径：BERT 风格的文本编码器与 query 路径共享 self-attention 和 FFN 权重。Cross-attention 对文本路径禁用。

训练时两条路径都运行。Query 和文本通过共享 self-attention 交互，这意味着 query 可以在需要时以文本为条件（ITM、ITG）。VLM 交接的推理时，只有 query 流过，产生 32 个视觉 token。

### 两阶段训练

BLIP-2 分两阶段预训练：

阶段 1：表示学习（无 LLM）。三个损失：
- ITC（图像-文本对比）：pooled query token 与文本 CLS token 之间的 CLIP 风格对比。
- ITM（图像-文本匹配）：二元分类器——这个图像-文本对是匹配的吗？硬负例挖掘。
- ITG（图像 grounded 文本生成）：以 query 为条件的文本因果 LM head。迫使 query 编码可文本生成的内容。

只有 Q-Former 训练。ViT 冻结。不涉及 LLM。

阶段 2：生成学习。附加一个冻结的 LLM（OPT-2.7B 或 Flan-T5-XL 等）。通过小的线性层将 32 个 query 输出投影到 LLM 的嵌入 dim。将它们前置到文本 prompt。仅在拼接的 prompt + 图像 + 标题序列上训练线性投影和 Q-Former 的 LM 损失。

阶段 2 之后，Q-Former + 投影是完整的视觉适配器。推理时：图像 → ViT → Q-Former → 线性投影 → 前置到文本 → 冻结 LLM 输出。

### 参数经济学

BLIP-2 含 ViT-g/14（1.1B，冻结）+ OPT-6.7B（6.7B，冻结）+ Q-Former（1.88 亿，训练）= 总共 8B，训练 1.88 亿。Q-Former 仅占完整堆栈参数的 ~2.4%。训练成本反映这一点：在少量 A100 上几天 vs 端到端几周。

质量：BLIP-2 在零样本 VQA 上匹配或击败 Flamingo-80B，同时小 50 倍。桥梁有效。

### InstructBLIP 与指令感知 Q-Former

InstructBLIP（2023）用额外输入扩展 Q-Former：指令文本本身。在 cross-attention 时，query 现在可以访问图像 patch 和指令。Query 可以按指令专门化（"数汽车"、"描述情绪"），而不是学习单一固定摘要。在 held-out 任务上的基准增益。

### MiniGPT-4 与仅投影器方法

MiniGPT-4 保留了 Q-Former，但只训练输出线性投影，同时冻结其他一切。便宜，但成本是质量——query 是 BLIP-2 的，不是你的。适合快速迭代，不是最佳架构。

### 为什么 LLaVA 更简单

LLaVA（2023，第 12.05 课）用普通 2 层 MLP 替代 Q-Former，将每个 ViT patch token 投影到 LLM 空间——24x24 网格的 576 个 token，全部喂给 LLM。压缩更差，但让 LLM 关注原始 patch。当时这有争议；到 2023 年末它占主导，因为视觉指令数据（LLaVA-Instruct-150k）证明 MLP 可以被训练来保留足够信号。权衡：LLaVA 的上下文填充更快，但自然扩展到多图像和视频。

到 2026 年，领域分裂：Q-Former 在 token 预算重要的地方存活（长视频、多图像）；MLP projector 在原始质量 per token 是优先事项的地方占主导。

### 门控 cross-attention：Flamingo，祖先

Flamingo（第 12.04 课）早于 BLIP-2，使用相同的 cross-attention 思想，但在每个冻结的 LLM 层，而不是作为单一桥梁。BLIP-2 表明你可以仅压缩到输入层并仍然有效。Gemini 和 Idefics 结合两者：交错的输入 token 加可选的门控 cross-attention 用于上下文内 few-shot。

### 2026 年的后代

- Q-Former：BLIP-2、InstructBLIP、MiniGPT-4，以及大多数视频-语言模型（出于 token 预算原因）。
- Perceiver resampler：Flamingo 的变体（第 12.04 课）；Idefics 家族、Eagle、OmniMAE。
- MLP projector：LLaVA、LLaVA-NeXT、LLaVA-OneVision、Cambrian-1。
- Attention pool：VILA、PaliGemma。

四种都有效。决定性问题是你受限于 token 预算还是 quality-per-token。

## 使用它

`code/main.py` 构建一个 stdlib Q-Former 风格的 cross-attention：

1. 模拟 256 个图像 patch token（dim 128）。
2. 实例化 32 个可学习 query（dim 128）。
3. 运行缩放点积 cross-attention（Q 来自 query，K/V 来自 patch）。
4. 通过线性层投影到 LLM-dim（512）。
5. 输出 32 个 LLM-ready 视觉 token。

所有数学用纯 Python（向量上的嵌套循环）。Toy 但形状正确。注意力权重矩阵被打印，以便你可以看到每个 query 从哪些 patch 拉取。

## 交付它

本课产出 `outputs/skill-modality-bridge-picker.md`。给定目标 VLM 配置（视觉编码器 token 数量、LLM 上下文预算、部署约束、质量目标），它推荐 Q-Former vs MLP vs Perceiver resampler，并附简短理由和每种桥梁的参数量估计。

## 练习

1. 在 PyTorch 中实现 cross-attention block。验证在 32 个 query 和 256 个 key/value 下，注意力权重矩阵是 32 x 256，且 softmax 后每行和为 1。

2. 在 BLIP-2 阶段 1 中，Q-Former 同时运行三个损失：ITC、ITM、ITG。用伪代码写出每个的前向签名。哪个需要文本编码器路径激活？

3. 比较参数量：Q-Former（12 层，768 hidden）vs 2 层 MLP projector（1408 → 4096，两层）。在什么 LLM 规模下，1.88 亿 Q-Former 成本在训练效率上回本？

4. 阅读 BLIP-2 论文（arXiv:2301.12597）第 3.2 节关于 Q-Former 如何初始化。解释为什么从 BERT-base（而非随机）初始化加速收敛。

5. 对于 10 分钟视频，以 1 FPS 采样到 60 帧，计算每帧 token 成本（Q-Former → 32 token/帧）vs（MLP projector → 576 token/帧）。哪个能放入 128k-token LLM 上下文窗口？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Q-Former | "Querying transformer" | 小型 transformer，32 个可学习 query 向量 cross-attend 到冻结 ViT 特征 |
| 可学习 query | "视觉软提示" | 作为 cross-attention query 侧的固定参数集；每个模型学习，跨所有输入共享 |
| Cross-attention | "Q 来自这里，K/V 来自那里" | Query、key 和 value 来自不同来源的注意力；query 如何从 ViT patch 拉取 |
| ITC | "图像-文本对比" | 应用于 Q-Former pooled query vs 文本 CLS 的 CLIP 风格损失 |
| ITM | "图像-文本匹配" | 硬负例挖掘对上的二元分类器；迫使 query 区分细粒度不匹配 |
| ITG | "图像 grounded 文本生成" | 以 query 为条件的文本因果 LM 损失；迫使 query 编码可文本解码的内容 |
| 两阶段预训练 | "表示然后生成" | 阶段 1 单独训练 Q-Former（ITC/ITM/ITG）；阶段 2 附加冻结 LLM，仅训练投影 + Q-Former |
| 冻结 backbone | "不要微调" | 视觉编码器和 LLM 权重固定；只有桥梁训练 |
| 投影头 | "到 LLM dim 的线性层" | 将 Q-Former 输出映射到 LLM 嵌入维度的最终线性层 |
| Perceiver resampler | "Flamingo 的版本" | 类似的可学习 query cross-attention，Flamingo 在每层使用而非作为单一桥梁 |

## 延伸阅读

- [Li et al. — BLIP-2 (arXiv:2301.12597)](https://arxiv.org/abs/2301.12597)——核心论文。
- [Li et al. — BLIP (arXiv:2201.12086)](https://arxiv.org/abs/2201.12086)——前身，带有 ITC/ITM/ITG 三重奏。
- [Li et al. — ALBEF (arXiv:2107.07651)](https://arxiv.org/abs/2107.07651)——"先对齐再融合"——阶段 1 训练的概念祖先。
- [Dai et al. — InstructBLIP (arXiv:2305.06500)](https://arxiv.org/abs/2305.06500)——指令感知 Q-Former。
- [Zhu et al. — MiniGPT-4 (arXiv:2304.10592)](https://arxiv.org/abs/2304.10592)——仅投影器方法。
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795)——可学习 query cross-attention 的通用架构。
