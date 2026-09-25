# Show-o 与离散扩散统一模型

> Transfusion 混合了连续与离散表示。Show-o(Xie et al., 2024 年 8 月)反其道而行之：文本 token 使用因果的下一 token 预测，图像 token 则按照 MaskGIT 的思路使用掩码离散扩散。两者共处一个 Transformer 内，采用混合注意力掩码。其结果是：在单一骨干网络、每种模态一个 tokenizer、一种损失形式(下一 token 预测扩展为掩码预测)上，统一了 VQA、文生图、图像修补和混合模态生成。本课讲解 Show-o 的设计——为什么掩码离散扩散是一个并行的、少步数的图像生成器——并将其与 Transfusion 和 Emu3 进行对比。

**Type:** Learn
**Languages:** Python (stdlib, masked-discrete-diffusion sampler)
**Prerequisites:** Phase 12 · 13 (Transfusion)
**Time:** ~120 minutes

## 学习目标

- 解释掩码离散扩散：先均匀地掩码 token,再让 Transformer 恢复它们的时间表。
- 在速度和质量上比较并行图像解码(Show-o、MaskGIT)与自回归图像解码(Chameleon、Emu3)。
- 说出 Show-o 在单个检查点中处理的三种任务：T2I、VQA、图像修补。
- 选择一种掩码时间表(cosine、linear、truncated),并推理其对样本质量的影响。

## 问题所在

Transfusion 的双损失训练可行，但动态更难处理——连续扩散损失与离散 NTP 损失位于不同的数值尺度上。平衡损失权重是一项超参数搜索。架构有效但复杂。

Show-o 的答案是：保持两种模态都是离散的(像 Chameleon 一样)，但通过掩码离散扩散并行生成图像，而不是按顺序生成。训练目标变成单一的掩码 token 预测，它自然地泛化了下一 token 预测。

## 核心概念

### 掩码离散扩散(MaskGIT)

Chang et al. (2022) 原始的 MaskGIT 技巧非常优雅。从一张完全掩码的图像开始(每个 token 都被替换为特殊的 `<MASK>` id)。每一步并行预测所有被掩码的 token,然后保留置信度最高的 top-K 个预测，重新掩码其余部分。经过约 8–16 次迭代后，所有 token 都被填充完成。每步解除多少 token 掩码的时间表需要调优——cosine 时间表效果很好。

训练很简单：从 [0, 1] 中均匀采样一个掩码比例，应用到图像的 VQ token 上，训练 Transformer 恢复被掩码的部分。这正是 BERT 对文本所做的，扩展到了图像生成。

### Show-o:单一 Transformer,混合掩码

Show-o 将 MaskGIT 放入因果语言模型的 Transformer 中。注意力掩码为：

- 文本 token:因果(标准 LLM)。
- 图像 token:图像块内部全双向(这样被掩码的 token 在预测时能看到所有其他图像 token)。
- 文本到图像：文本关注先前的图像，图像关注先前的文本。

训练在以下之间交替：
1. 文本序列上的标准 NTP。
2. T2I 样本：文本 → 带有掩码图像 token 的图像，掩码 token 预测损失。
3. VQA 样本：图像 → 带有掩码文本 token 的文本(实际上就是 NTP)。

统一的损失是对 `<MASK>` token 的交叉熵，它同时覆盖了文本 NTP(只有最后一个 token 被“掩码”)和图像掩码扩散(随机子集被掩码)。

### 并行采样

Show-o 用约 16 步生成一张图像，而不是约 1000 步(逐 token 自回归)或约 20 步(扩散)。每一步并行预测所有被掩码的 token;提交置信度最高的 top-K 个；重复。

比较：
- Chameleon / Emu3(对 token 自回归)：N_tokens 次前向传播，每张图像通常 1024–4096 次。
- Transfusion(连续扩散)：约 20 步，每步一次完整的 Transformer 前向传播。
- Show-o(掩码离散扩散)：约 16 步，每步一次完整的 Transformer 前向传播。

在相近规模的模型上，Show-o 比 Chameleon 更快，步数与 Transfusion 大致相当，而单步成本更低(离散词表 logits 对比连续 MSE 损失)。

### 单个检查点中的多任务

Show-o 在推理时支持四种任务，由提示格式选择：

- 文本生成：标准的自回归文本输出。
- VQA:图像输入，文本输出。
- T2I:文本输入，通过掩码离散扩散输出图像。
- 修补：图像中部分 token 被掩码，填补它们。

修补能力来自掩码预测训练，无需额外代价。掩码 VQ token 网格的一个区域，输入其余部分加文本提示，预测被掩码的 token。

### 掩码时间表

每步解除多少 token 掩码的时间表决定了质量。Show-o 推荐 cosine:

```
mask_ratio(t) = cos(pi * t / (2 * T))   # t = 0..T
```

在第 0 步，所有 token 被掩码(比例 1.0)。在第 T 步，没有 token 被掩码。cosine 把质量集中在中间比例区间，那里的预测信息量最大。linear 时间表也可行，但更早进入平台期。

### Show-o2

Show-o2(2025 年后续工作，arXiv 2506.15564)对 Show-o 进行了扩展：更大的 LLM 基座、更好的 tokenizer、改进的掩码时间表。架构模式相同。

### Show-o 的定位

在 2026 年的分类体系中：

- 离散 token + NTP:Chameleon、Emu3。简单但推理慢。
- 离散 token + 掩码扩散：Show-o、MaskGIT、LlamaGen、Muse。并行采样，但仍受 tokenizer 限制而有损。
- 连续 + 扩散：Transfusion、MMDiT、DiT。质量最高，训练更复杂。
- VLM 中的连续 + flow matching:JanusFlow、InternVL-U。最新。

按任务选择：当你想在一个开源模型中以合理速度获得 T2I + 修补 + VQA 时，选 Show-o;当质量至上且你能承受双损失的工程负担时，选 Transfusion。

```figure
masked-diffusion-unmask
```

## 动手实践

`code/main.py` 模拟了 Show-o 的采样：

- 一个 16 个 VQ token 的玩具网格。
- 一个根据提示和当前未掩码 token 预测 logits 的模拟"Transformer"。
- 在 cosine 时间表下进行 8 步并行掩码采样。
- 打印中间状态(掩码模式的演化)和最终 token。

运行它，观察掩码一步步消散。

## 发布应用

本课产出 `outputs/skill-unified-gen-model-picker.md`。对于一个既需要理解能力(VQA、字幕生成)又需要生成能力(T2I、修补)，且受开源权重约束的产品，在 Show-o 系、Transfusion/MMDiT 系与 Emu3 / Chameleon 系之间做出选择，并给出具体的权衡分析。

## 练习

1. 掩码离散扩散用约 16 步采样。为什么不用 1 步？如果在第 0 步解除所有掩码，会出什么问题？

2. 掩码扩散下修补是免费的。提出一个(真实的或假设的)产品用例，使 Show-o 的修补能力胜过专用模型。

3. cosine 时间表对比 linear 时间表：追踪 T=8 时每步未掩码 token 的数量。哪个更均衡？

4. 一张 512x512 的 Show-o 图像是 1024 个 token。在词表 K=16384 时，模型输出 1024 * log2(16384) = 14,336 位(约 1.75 KiB)的数据。Stable Diffusion 输出 512*512*24 位 = 6,291,456 位(约 768 KiB)的原始像素。压缩比是多少，换来了什么质量？

5. 阅读 LlamaGen(arXiv:2406.06525)。LlamaGen 的类条件自回归图像模型与 Show-o 的掩码方法有何不同？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 掩码离散扩散 | "MaskGIT 风格" | 训练以预测被掩码的 token;推理时迭代地解除置信度最高预测的掩码 |
| Cosine 时间表 | "解掩码时间表" | 掩码比例在推理步中的衰减；将置信度增长集中在中间区间 |
| 并行解码 | "一次性处理所有 token" | 每步通过一次前向传播预测全部被掩码 token 的序列，然后提交 top-K |
| 混合注意力 | "因果 + 双向" | 对文本 token 为因果，在图像块内为双向的掩码 |
| 修补 | "填补式生成" | 以部分 token 被掩码的图像为条件，预测缺失部分；从训练目标中免费获得 |
| 提交比例 | "每步 top-K" | 每次迭代有多少 token 被判定为"完成"；控制推理速度与质量的权衡 |

## 延伸阅读

- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
- [Show-o2 (arXiv:2506.15564)](https://arxiv.org/abs/2506.15564)
- [Chang et al. — MaskGIT (arXiv:2202.04200)](https://arxiv.org/abs/2202.04200)
- [Sun et al. — LlamaGen (arXiv:2406.06525)](https://arxiv.org/abs/2406.06525)
- [Chang et al. — Muse (arXiv:2301.00704)](https://arxiv.org/abs/2301.00704)