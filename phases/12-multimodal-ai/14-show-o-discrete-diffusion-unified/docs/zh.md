# Show-o 与离散扩散统一模型（Show-o and Discrete-Diffusion Unified Models）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Transfusion 把连续表示和离散表示混在一起。Show-o（Xie 等，2024 年 8 月）走的是相反方向：文本 token 用因果式 next-token prediction，图像 token 则按 MaskGIT 的思路用 masked discrete diffusion（掩码离散扩散）。两者塞进同一个 transformer，配一张混合的 attention mask。结果是在一套 backbone、每种模态一个 tokenizer、一个统一的损失公式（把 next-token 推广到 masked prediction）下，统一了 VQA、文生图、inpainting（图像补全）和混合模态生成。本课会走一遍 Show-o 的设计——为什么 masked discrete diffusion 是一种并行、少步数的图像生成器——并把它和 Transfusion、Emu3 做对比。

**Type:** Learn
**Languages:** Python (stdlib, masked-discrete-diffusion sampler)
**Prerequisites:** Phase 12 · 13 (Transfusion)
**Time:** ~120 minutes

## 学习目标（Learning Objectives）

- 解释 masked discrete diffusion：先按调度均匀地把 token 掩掉，再让 transformer 把它们恢复出来。
- 在速度和质量两个维度，比较并行图像解码（Show-o、MaskGIT）和 autoregressive 图像解码（Chameleon、Emu3）。
- 说出 Show-o 在一个 checkpoint 里支持的三类任务：T2I、VQA、图像 inpainting。
- 选一种掩码调度（cosine、linear、truncated）并推理它对样本质量的影响。

## 问题（The Problem）

Transfusion 的双损失训练能跑，但动力学更微妙——连续 diffusion 的损失和离散 NTP 的损失数值量级不同。损失权重的平衡是个超参数搜索题。架构有效，但复杂。

Show-o 的回答：让两种模态都保持离散（像 Chameleon），但图像不再串行生成，而是通过 masked discrete diffusion 并行生成。训练目标变成单一的 masked-token-prediction，自然推广了 next-token-prediction。

## 概念（The Concept）

### 掩码离散扩散（Masked discrete diffusion / MaskGIT）

Chang 等人 2022 年最初的 MaskGIT 套路相当优雅。从一张完全被掩掉的图像开始（每个 token 都是特殊的 `<MASK>` id）。每一步都并行预测所有被掩掉的 token，然后保留置信度最高的 top-K 个预测，剩下的重新掩掉。大约 8-16 次迭代之后，所有 token 都被填好。每一步解掩多少 token 的调度是要调的——cosine 调度效果不错。

训练很简单：从 [0, 1] 中均匀采一个掩码比例，应用到图像的 VQ token 上，训练 transformer 把被掩的部分恢复出来。本质就是 BERT 在文本上做的事情，搬到图像生成上。

### Show-o：一个 transformer，混合 mask

Show-o 把 MaskGIT 塞进了一个因果语言模型 transformer。attention mask 是这样的：

- 文本 token：causal（标准 LLM）。
- 图像 token：图像块内全双向（这样被掩的 token 在预测时能看到块内任意其他图像 token）。
- Text-to-image：文本 attend 到此前的图像，图像 attend 到此前的文本。

训练在以下任务间交替：
1. 文本序列上的标准 NTP。
2. T2I 样本：文本 → 图像（图像 token 部分被掩），用 masked-token-prediction 损失。
3. VQA 样本：图像 → 文本（文本 token 部分被掩，本质就是 NTP）。

统一的损失就是 `<MASK>` token 上的交叉熵，既覆盖了文本 NTP（只有最后一个 token 被「掩」），也覆盖了图像 masked diffusion（随机子集被掩）。

### 并行采样

Show-o 生成一张图像大概只要 16 步，而不是 1000 步（每个 token 一次的 autoregressive）或 20 步（diffusion）。每一步并行预测所有被掩 token；提交 top-K 置信度最高的；重复。

对比一下：
- Chameleon / Emu3（在 token 上 autoregressive）：N_tokens 次前向传播，每张图通常 1024-4096 次。
- Transfusion（连续 diffusion）：约 20 步，每步一次完整的 transformer 前向。
- Show-o（masked discrete diffusion）：约 16 步，每步一次完整的 transformer 前向。

在同等规模的模型上 Show-o 比 Chameleon 快，步数大致和 Transfusion 持平，但每步成本更低（离散词表 logits vs 连续 MSE 损失）。

### 一个 checkpoint 里的多任务

Show-o 在 inference 阶段支持四类任务，由 prompt 格式选择：

- 文本生成：标准 autoregressive 文本输出。
- VQA：输入图像，输出文本。
- T2I：输入文本，通过 masked discrete diffusion 输出图像。
- Inpainting：输入一张被掩掉部分 token 的图像，把缺失的填回去。

inpainting 能力是 masked-prediction 训练自带的。把 VQ-token 网格的某块区域掩掉，把剩下的部分加上文本 prompt 一起喂进去，预测被掩的那部分。

### 掩码调度

每一步解掩多少 token 的调度会影响质量。Show-o 推荐 cosine：

```
mask_ratio(t) = cos(pi * t / (2 * T))   # t = 0..T
```

第 0 步时所有 token 都被掩（比例 1.0）。第 T 步时一个都不掩。cosine 把质量集中在中段比例，那里预测信息量最大。线性调度也能用，但更快进入平台期。

### Show-o2

Show-o2（2025 年的后续工作，arXiv 2506.15564）把 Show-o 放大了：更大的 LLM 底座、更好的 tokenizer、改进的掩码调度。架构模式不变。

### Show-o 的位置

放进 2026 年的分类法：

- 离散 token + NTP：Chameleon、Emu3。简单但 inference 慢。
- 离散 token + masked diffusion：Show-o、MaskGIT、LlamaGen、Muse。并行采样，但仍受 tokenizer 的有损压缩限制。
- 连续 + diffusion：Transfusion、MMDiT、DiT。质量最高，训练更复杂。
- VLM 中的连续 + flow matching：JanusFlow、InternVL-U。最新。

按任务挑：要在一个开源模型里同时拿到 T2I + inpainting + VQA、并且速度还过得去时选 Show-o；质量优先、又愿意承担双损失工程负担时选 Transfusion。

## 用起来（Use It）

`code/main.py` 模拟了 Show-o 的采样过程：

- 一个 16 个 VQ token 的玩具网格。
- 一个 mock 版「transformer」，根据 prompt 和当前未掩的 token 预测 logits。
- 用 cosine 调度做 8 步并行掩码采样。
- 打印中间状态（mask 模式的演化）和最终 token。

跑一下，看着 mask 一步步消融。

## 上线部署（Ship It）

本课产出 `outputs/skill-unified-gen-model-picker.md`。给定一个既需要理解（VQA、caption）又需要生成（T2I、inpainting）、且要求开源权重的产品，在 Show-o 家族、Transfusion/MMDiT 家族、Emu3 / Chameleon 家族之间挑选，并给出具体的 trade-off。

## 练习（Exercises）

1. masked discrete diffusion 用约 16 步采样。为什么不能 1 步搞定？如果第 0 步就把所有 token 都解掩会怎么坏掉？

2. inpainting 在 masked diffusion 里是免费的。提一个产品用例（真实或假想），让 Show-o 的 inpainting 比专门的模型更有优势。

3. Cosine 调度 vs 线性调度：在 T=8 的情况下，画出每一步未被掩 token 的数量。哪一种更平衡？

4. 一张 512x512 的 Show-o 图像是 1024 个 token。词表 K=16384 时，模型输出 1024 * log2(16384) = 14,336 bit（约 1.75 KiB）的数据。Stable Diffusion 输出 512*512*24 bit = 6,291,456 bit（约 768 KiB）的原始像素。压缩率是多少，换来了什么质量？

5. 读一下 LlamaGen（arXiv:2406.06525）。LlamaGen 这种类条件 autoregressive 图像模型和 Show-o 的 masked 思路有什么不同？

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际意思 |
|------|-----------------|------------------------|
| Masked discrete diffusion | 「MaskGIT-style」 | 训练时预测被掩掉的 token；inference 时迭代地解掩置信度最高的预测 |
| Cosine schedule | 「解掩调度」 | 掩码比例随 inference 步数衰减；让置信度增长集中在中段 |
| Parallel decoding | 「所有 token 一次出」 | 每一步都在一次前向中预测整段被掩 token，再提交 top-K |
| Hybrid attention | 「Causal + 双向」 | 文本 token 间是 causal、图像块内是双向的混合 mask |
| Inpainting | 「补全生成」 | 以一张部分 token 被掩的图像为条件，预测缺失部分；训练目标白送的能力 |
| Commitment rate | 「每步 top-K」 | 每次迭代宣布「完成」多少 token；控制 inference 速度与质量的 trade-off |

## 延伸阅读（Further Reading）

- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
- [Show-o2 (arXiv:2506.15564)](https://arxiv.org/abs/2506.15564)
- [Chang et al. — MaskGIT (arXiv:2202.04200)](https://arxiv.org/abs/2202.04200)
- [Sun et al. — LlamaGen (arXiv:2406.06525)](https://arxiv.org/abs/2406.06525)
- [Chang et al. — Muse (arXiv:2301.00704)](https://arxiv.org/abs/2301.00704)
