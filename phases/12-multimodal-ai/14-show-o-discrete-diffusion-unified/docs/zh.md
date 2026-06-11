# Show-o 与离散扩散统一模型

> Transfusion 混合了连续和离散表示。Show-o（Xie 等人，2024 年 8 月）走了另一条路：文本 token 使用因果 next-token 预测，图像 token 使用受 MaskGIT 启发的掩码离散扩散。两者都位于一个带有混合注意力掩码的 transformer 内部。结果在一个骨干、每个模态一个分词器、一个损失公式（扩展到掩码预测的 next-token）上统一了 VQA、文本到图像、修复和混合模态生成。本课讲解 Show-o 的设计——为什么掩码离散扩散是并行、少步图像生成器——并与 Transfusion 和 Emu3 进行对比。

**类型：** Learn
**语言：** Python（stdlib，掩码离散扩散采样器）
**前置知识：** Phase 12 · 13（Transfusion）
**时间：** ~120 分钟

## 学习目标

- 解释掩码离散扩散：均匀掩码 token 然后要求 transformer 恢复它们的调度。
- 在速度和质量上比较并行图像解码（Show-o、MaskGIT）与自回归图像解码（Chameleon、Emu3）。
- 命名 Show-o 在一个检查点中处理的三个任务：T2I、VQA、图像修复。
- 选择掩码调度（余弦、线性、截断）并推理其对样本质量的影响。

## 问题所在

Transfusion 的双损失训练有效，但动态更棘手——连续扩散损失与离散 NTP 损失生活在不同的数值尺度上。平衡损失权重是超参数搜索。架构有效但复杂。

Show-o 的答案：保持两种模态离散（如 Chameleon），但通过掩码离散扩散并行生成图像，而非顺序生成。训练目标成为自然泛化 next-token-prediction 的单一掩码 token 预测。

## 核心概念

### 掩码离散扩散（MaskGIT）

原始的 Chang 等人（2022）MaskGIT 技巧很优雅。从完全掩码的图像开始（每个 token 都是特殊的 `<MASK>` id）。每一步，并行预测所有掩码 token，然后保留前 K 个最自信的预测，重新掩码其余。经过约 8-16 次迭代，所有 token 都被填充。每步解掩码多少 token 的调度经过调优——余弦调度效果很好。

训练很简单：从 [0, 1] 均匀采样掩码比率，将其应用于图像的 VQ token，训练 transformer 恢复掩码的 token。正是 BERT 对文本所做的，扩展到图像生成。

### Show-o：一个 transformer，混合掩码

Show-o 将 MaskGIT 放入因果语言模型 transformer 中。注意力掩码是：

- 文本 token：因果的（标准 LLM）。
- 图像 token：图像块内的完全双向（以便掩码 token 在预测期间可以看到每个其他图像 token）。
- 文本到图像：文本关注之前的图像，图像关注之前的文本。

训练在以下之间交替：
1. 文本序列上的标准 NTP。
2. T2I 样本：文本 → 图像，带有掩码图像 token，掩码 token 预测损失。
3. VQA 样本：图像 → 文本，带有掩码文本 token（实际上只是 NTP）。

统一损失是 `<MASK>` token 上的交叉熵，涵盖文本 NTP（只有最后一个 token 被"掩码"）和图像掩码扩散（随机子集被掩码）。

### 并行采样

Show-o 在约 16 步内生成图像，而非约 1000 步（每 token 自回归）或约 20 步（扩散）。每一步，并行预测所有掩码 token；提交前 K 个自信的；重复。

比较：
- Chameleon / Emu3（token 上的自回归）：N_tokens 次前向传播，典型每张图像 1024-4096。
- Transfusion（连续扩散）：约 20 步，每步一次完整 transformer 传播。
- Show-o（掩码离散扩散）：约 16 步，每步一次完整 transformer 传播。

Show-o 在相似规模模型上比 Chameleon 更快，大致匹配 Transfusion 的步数，但每步成本更低（离散词汇 logits vs 连续 MSE 损失）。

### 一个检查点中的任务

Show-o 在推理时支持四个任务，由提示词格式选择：

- 文本生成：标准自回归文本输出。
- VQA：图像输入，文本输出。
- T2I：文本输入，通过掩码离散扩散输出图像。
- 修复：某些 token 被掩码的图像，填充。

修复能力来自掩码预测训练。掩码 VQ-token 网格的一个区域，喂入其余部分加文本提示词，预测掩码 token。

### 掩码调度

每步解掩码多少 token 的调度塑造质量。Show-o 推荐余弦：

```
mask_ratio(t) = cos(pi * t / (2 * T))   # t = 0..T
```

在第 0 步，所有 token 被掩码（比率 1.0）。在第 T 步，没有掩码。余弦将质量集中在预测最丰富的中范围比率上。线性调度也有效但更快达到平台期。

### Show-o2

Show-o2（2025 年后续，arXiv 2506.15564）扩展了 Show-o：更大的 LLM 基础，更好的分词器，改进的掩码调度。相同的架构模式。

### Show-o 的位置

在 2026 年分类中：

- 离散 token + NTP：Chameleon、Emu3。简单但推理慢。
- 离散 token + 掩码扩散：Show-o、MaskGIT、LlamaGen、Muse。并行采样，仍然受分词器损失。
- 连续 + 扩散：Transfusion、MMDiT、DiT。最高质量，训练更复杂。
- VLM 中的连续 + 流匹配：JanusFlow、InternVL-U。最新。

按任务选择：当你想要 T2I + 修复 + VQA 在一个开放模型中且速度合理时选 Show-o；当质量至关重要且你能负担双损失管道时选 Transfusion。

## 使用它

`code/main.py` 模拟 Show-o 采样：

- 16 个 VQ token 的玩具网格。
- 一个模拟"transformer"，基于提示词和当前未掩码 token 预测 logits。
- 余弦调度下 8 步的并行掩码采样。
- 打印中间状态（掩码模式演变）和最终 token。

运行它，观察掩码逐步溶解。

## 交付它

本课产出 `outputs/skill-unified-gen-model-picker.md`。给定一个需要理解（VQA、描述）和生成（T2I、修复）且受开放权重约束的产品，在 Show-o 家族、Transfusion/MMDiT 家族和 Emu3 / Chameleon 家族之间选择，并给出具体权衡。

## 练习

1. 掩码离散扩散在约 16 步内采样。为什么不是 1 步？如果在第 0 步解掩码所有内容，什么会崩溃？

2. 修复随掩码扩散免费获得。提出一个产品用例（真实的或假设的），其中 Show-o 的修复击败专业模型。

3. 余弦调度 vs 线性调度：为 T=8 追踪每步解掩码 token 的数量。哪个更平衡？

4. 一张 512x512 的 Show-o 图像是 1024 个 token。在词汇 K=16384 下，模型发出 1024 * log2(16384) = 14,336 位（约 1.75 KiB）的数据。Stable Diffusion 输出 512*512*24 位 = 6,291,456 位（约 768 KiB）的原始像素。压缩比是多少，它买到什么质量？

5. 阅读 LlamaGen（arXiv:2406.06525）。LlamaGen 的类条件自回归图像模型与 Show-o 的掩码方法有何不同？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 掩码离散扩散 | "MaskGIT 风格" | 训练预测掩码 token；推理时，迭代解掩码最自信的预测 |
| 余弦调度 | "解掩码调度" | 推理步中掩码比率的衰减；将置信增长集中在中范围 |
| 并行解码 | "一次所有 token" | 每一步在一个前向传播中预测完整掩码 token 序列，然后提交前 K 个 |
| 混合注意力 | "因果 + 双向" | 在文本 token 上因果但在图像块内双向的掩码 |
| 修复 | "填充生成" | 以某些 token 被掩码的图像为条件，预测缺失的 token；从训练目标免费获得 |
| 承诺率 | "每步前 K" | 每迭代声明"完成"的 token 数量；控制推理与质量的权衡 |

## 延伸阅读

- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
- [Show-o2 (arXiv:2506.15564)](https://arxiv.org/abs/2506.15564)
- [Chang et al. — MaskGIT (arXiv:2202.04200)](https://arxiv.org/abs/2202.04200)
- [Sun et al. — LlamaGen (arXiv:2406.06525)](https://arxiv.org/abs/2406.06525)
- [Chang et al. — Muse (arXiv:2301.00704)](https://arxiv.org/abs/2301.00704)
