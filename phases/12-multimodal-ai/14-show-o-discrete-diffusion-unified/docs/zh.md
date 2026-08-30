# 14 · Show-o 与离散扩散统一模型

> Transfusion 把连续表示与离散表示混合在一起。Show-o（Xie 等人，2024 年 8 月）则走了相反的方向：文本 token 采用因果式的下一 token 预测，图像 token 采用 MaskGIT 风格的「掩码离散扩散（masked discrete diffusion）」。两者都置于同一个 Transformer 中，依靠一种「混合注意力掩码（hybrid attention mask）」协同工作。其结果是在同一个骨干网络、每个模态一个分词器、一套损失公式（从下一 token 预测扩展到掩码预测）上统一了视觉问答（VQA）、文生图（text-to-image）、图像补全（inpainting）和混合模态生成。本课讲解 Show-o 的设计——为什么掩码离散扩散是一个并行的、少步数的图像生成器——并与 Transfusion 和 Emu3 进行对比。

**类型：** 学习
**语言：** Python（标准库，掩码离散扩散采样器）
**前置：** 阶段 12 · 13（Transfusion）
**时长：** 约 120 分钟

## 学习目标

- 解释掩码离散扩散：先按某种调度均匀地掩盖 token，再要求 Transformer 将其恢复。
- 在速度与质量两方面，对比并行图像解码（Show-o、MaskGIT）与自回归图像解码（Chameleon、Emu3）。
- 说出 Show-o 在单个检查点（checkpoint）内处理的三类任务：T2I、VQA、图像补全。
- 选择一种掩码调度（余弦、线性、截断），并推理其对采样质量的影响。

## 问题所在

Transfusion 的双损失训练确实可行，但其动力学更为棘手——连续扩散损失与离散下一 token 预测（NTP）损失处于不同的数值量级。平衡损失权重本身就是一场超参数搜索。该架构有效，但复杂。

Show-o 的答案是：让两个模态都保持离散（与 Chameleon 一样），但通过掩码离散扩散并行地生成图像，而非顺序生成。训练目标因此变成单一的掩码 token 预测，它自然地泛化了下一 token 预测。

## 核心概念

### 掩码离散扩散（MaskGIT）

Chang 等人（2022）最初提出的 MaskGIT 技巧十分优雅。从一张完全被掩盖的图像出发（每个 token 都是特殊的 `<MASK>` id）。在每一步中，并行预测所有被掩盖的 token，然后保留置信度最高的前 K 个预测，并将其余的重新掩盖。经过约 8 至 16 次迭代后，所有 token 都被填充完毕。每步要解掩多少个 token 的调度是可调的——余弦调度效果良好。

训练很简单：从 [0, 1] 区间均匀采样一个掩码比例，将其应用于图像的 VQ token，训练 Transformer 恢复被掩盖的那些 token。这正是 BERT 对文本所做的事，只是扩展到了图像生成。

### Show-o：一个 Transformer，混合掩码

Show-o 把 MaskGIT 放进了一个因果语言模型 Transformer 中。其注意力掩码为：

- 文本 token：因果式（标准 LLM）。
- 图像 token：在图像块内部为全双向（这样被掩盖的 token 在预测时能看到其他每一个图像 token）。
- 文生图：文本关注先前的图像，图像关注先前的文本。

训练在以下几种方式之间交替进行：
1. 在文本序列上进行标准的 NTP。
2. T2I 样本：文本 → 带被掩盖图像 token 的图像，采用掩码 token 预测损失。
3. VQA 样本：图像 → 带被掩盖文本 token 的文本（本质上就是 NTP）。

统一的损失是在 `<MASK>` token 上的交叉熵，它既覆盖了文本 NTP（只有最后一个 token 被「掩盖」），也覆盖了图像掩码扩散（随机子集被掩盖）。

### 并行采样

Show-o 生成一张图像约需 16 步，而不是约 1000 步（逐 token 自回归）或约 20 步（扩散）。在每一步中，并行预测所有被掩盖的 token；提交置信度最高的前 K 个；重复。

对比一下：
- Chameleon / Emu3（在 token 上自回归）：N_tokens 次前向传播，每张图像通常 1024 至 4096 次。
- Transfusion（连续扩散）：约 20 步，每步一次完整的 Transformer 传播。
- Show-o（掩码离散扩散）：约 16 步，每步一次完整的 Transformer 传播。

在规模相近的模型上，Show-o 比 Chameleon 更快；其步数与 Transfusion 大致相当，但每步成本更低（离散词表 logits 相比连续 MSE 损失）。

### 一个检查点内的多任务

Show-o 在推理时支持四类任务，通过提示词格式来选择：

- 文本生成：标准的自回归文本输出。
- VQA：输入图像，输出文本。
- T2I：输入文本，通过掩码离散扩散输出图像。
- 补全（inpainting）：图像中部分 token 被掩盖，将其填充。

补全能力是从掩码预测训练中免费获得的。掩盖 VQ token 网格中的某个区域，将其余部分连同文本提示一起输入，预测被掩盖的 token。

### 掩码调度

每步解掩多少个 token 的调度决定了质量。Show-o 推荐余弦调度：

```
mask_ratio(t) = cos(pi * t / (2 * T))   # t = 0..T
```

在第 0 步，所有 token 被掩盖（比例为 1.0）。在第 T 步，无 token 被掩盖。余弦调度把权重集中在中间区间的比例上，而这正是预测信息量最大之处。线性调度也可行，但更快进入平台期。

### Show-o2

Show-o2（2025 年的后续工作，arXiv 2506.15564）扩展了 Show-o：更大的 LLM 基座、更好的分词器、改进的掩码调度。架构模式相同。

### Show-o 的定位

在 2026 年的分类法中：

- 离散 token + NTP：Chameleon、Emu3。简单但推理慢。
- 离散 token + 掩码扩散：Show-o、MaskGIT、LlamaGen、Muse。并行采样，但仍受分词器有损的限制。
- 连续 + 扩散：Transfusion、MMDiT、DiT。质量最高，训练更复杂。
- 连续 + VLM 中的流匹配（flow matching）：JanusFlow、InternVL-U。最新方案。

按任务选择：当你想在一个开放模型中以合理速度同时获得 T2I + 补全 + VQA 时，选 Show-o；当质量至上且你能承受双损失的管线工程时，选 Transfusion。

## 动手用它

`code/main.py` 模拟了 Show-o 的采样：

- 一个含 16 个 VQ token 的玩具网格。
- 一个模拟「Transformer」，它基于提示词和当前已解掩的 token 来预测 logits。
- 在 8 步内、采用余弦调度的并行掩码采样。
- 打印中间状态（掩码模式的演变）和最终的 token。

运行它，观察掩码如何一步步消解。

## 交付它

本课产出 `outputs/skill-unified-gen-model-picker.md`。给定一个既需要理解能力（VQA、图像描述）又需要生成能力（T2I、补全），且有开放权重约束的产品，在 Show-o 系列、Transfusion/MMDiT 系列和 Emu3 / Chameleon 系列之间做出选择，并给出具体的取舍权衡。

## 练习

1. 掩码离散扩散采样约需 16 步。为什么不是 1 步？如果在第 0 步就解掩所有 token，会出什么问题？

2. 掩码扩散让补全成为免费能力。提出一个产品用例（真实或假设的），使得 Show-o 的补全能力胜过某个专用模型。

3. 余弦调度 vs 线性调度：在 T=8 时，追踪每步解掩的 token 数量。哪一个更均衡？

4. 一张 512x512 的 Show-o 图像是 1024 个 token。在词表 K=16384 时，模型输出 1024 * log2(16384) = 14,336 比特（约 1.75 KiB）数据。Stable Diffusion 输出 512*512*24 比特 = 6,291,456 比特（约 768 KiB）的原始像素。压缩比是多少？它换来了怎样的质量？

5. 阅读 LlamaGen（arXiv:2406.06525）。LlamaGen 的类别条件自回归图像模型与 Show-o 的掩码方法有何不同？

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|------------------------|
| 掩码离散扩散 | 「MaskGIT 风格」 | 训练时预测被掩盖的 token；推理时迭代地解掩置信度最高的预测 |
| 余弦调度 | 「解掩调度」 | 掩码比例随推理步数的衰减方式；把置信度的增长集中在中间区间 |
| 并行解码 | 「所有 token 一次到位」 | 每一步在一次前向传播中预测被掩盖 token 的整个序列，然后提交前 K 个 |
| 混合注意力 | 「因果 + 双向」 | 对文本 token 为因果式、在图像块内部为双向的掩码 |
| 补全（inpainting） | 「填空式生成」 | 以部分 token 被掩盖的图像为条件，预测缺失的 token；从训练目标中免费获得 |
| 提交率（commitment rate） | 「每步前 K 个」 | 每次迭代中被宣告「完成」的 token 数量；控制推理速度与质量的取舍 |

## 延伸阅读

- [Xie 等人 — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
- [Show-o2 (arXiv:2506.15564)](https://arxiv.org/abs/2506.15564)
- [Chang 等人 — MaskGIT (arXiv:2202.04200)](https://arxiv.org/abs/2202.04200)
- [Sun 等人 — LlamaGen (arXiv:2406.06525)](https://arxiv.org/abs/2406.06525)
- [Chang 等人 — Muse (arXiv:2301.00704)](https://arxiv.org/abs/2301.00704)
