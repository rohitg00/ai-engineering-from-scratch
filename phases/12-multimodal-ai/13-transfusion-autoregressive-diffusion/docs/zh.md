# Transfusion：autoregressive 文本 + diffusion 图像合一的 transformer

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Chameleon 和 Emu3 都把宝押在了离散 token 上。它们能跑通，但量化瓶颈肉眼可见——图像质量卡在连续空间 diffusion 模型之下。Transfusion（Meta，Zhou 等人，2024 年 8 月）反向下注：把图像保留在连续空间里，彻底丢掉 VQ-VAE，用一个 transformer、两套损失来训练。文本 token 用 next-token-prediction；图像 patch 用 flow-matching / diffusion 损失。两个目标共同优化同一份权重。Stable Diffusion 3 背后的 MMDiT 架构和它是近亲。本节会通读 Transfusion 论文论点、搭一个玩具版双损失训练器，并梳理那张让单一 transformer 同时干两件事的 attention mask。

**Type:** Build
**Languages:** Python (stdlib, two-loss trainer on MNIST-scale toy)
**Prerequisites:** Phase 12 · 11 (Chameleon), Phase 8 (Generative AI)
**Time:** ~180 minutes

## 学习目标（Learning Objectives）

- 接好一个跑两套损失的 transformer：文本 token 上的 NTP，和图像 patch 上的 diffusion MSE，共享同一个 backbone。
- 解释为什么图像 patch 之间用双向 attention、文本 token 之间用 causal attention 是正确的 mask 选择。
- 在算力、质量、代码复杂度三个维度上，对比 Transfusion 风格（连续图像 + diffusion 损失）和 Chameleon 风格（离散图像 + NTP）。
- 说出 MMDiT 的贡献：每个 block 内有 modality-specific（按模态分开）的权重，但在 residual stream 上做联合 attention。

## 问题（The Problem）

离散 vs 连续图像 token 的争论比 LLM 还要古老。连续表示（原始像素、VAE latent）保留细节；离散 token（VQ 索引）契合 transformer 的原生词表，但在量化这一步会丢细节。

Chameleon / Emu3 选了离散：一个损失、一个架构，但图像保真度被 tokenizer 的天花板封死。

Diffusion 模型选了连续：图像质量出色，但模型独立于 LLM、需要复杂的 noise schedule 工程，并且没法干净地和文本生成集成。

Transfusion 提了个问题：能不能两边都要？把图像保留在连续空间里，仍然只训一个模型，把两套损失缝进同一个梯度步。

## 概念（The Concept）

### 双损失架构（The two-loss architecture）

一个 decoder-only 的 transformer 处理一段序列，序列里包含：

- 文本 token（离散，来自 BPE 词表）。
- 图像 patch（连续，16x16 像素块经线性 embedding 投到 hidden 维度——和 ViT encoder 的输入完全一致）。
- `<image>` 和 `</image>` 标记，标出连续 patch 在哪儿。

前向只跑一遍。每个 token 的损失会从两个 head 里挑一个：

- 文本 token：vocab-logits head 上的标准 cross-entropy。
- 图像 patch：连续 patch 上的 diffusion 损失——预测加到这个 patch 上的噪声。

梯度会回流到共享的 transformer 主体。两套损失同时改进共享的权重。

### Attention mask：文本 causal + 图像双向（causal text + bidirectional image）

文本 token 必须 causal——不能让一个文本 token attend 到未来的文本，否则 teacher forcing 就崩了。但图像 patch 表示的是同一张快照，它们应该在同一图像 block 内部互相双向 attend。

mask 长这样：

```
M[i, j] = 1 if:
  (i is text and j is text and j <= i)   # causal for text
  OR (i is image and j is image and same_image_block(i, j))   # bidirectional within image
  OR (i is text and j is image and j < i_image_end)   # text attends to previous images
  OR (i is image and j is text and j < i_image_start)   # image attends to preceding text
```

训练和推理时都实现成 block-triangular 的 mask。

### transformer 内部的 diffusion 损失（Diffusion loss inside the transformer）

diffusion 损失是标准的：往一个图像 patch 上加噪，让模型预测这次加的噪声（或者等价地，预测干净的 patch）。Transfusion 用的是 flow matching——预测从带噪到干净的速度场。

训练阶段：
1. 对每个图像 patch x0，采一个随机时间步 t。
2. 采噪声 ε，计算 xt = (1-t) * x0 + t * ε（flow matching 的线性插值）。
3. transformer 预测 v_theta(xt, t)；loss = MSE(v_theta(xt, t), ε - x0)。
4. 和同一段序列上的文本 NTP 损失一起反向传播。

推理阶段，生成是这样：
- 文本 token：标准 autoregressive 采样。
- 图像 patch：以前文文本 token 为条件的 diffusion 采样循环（典型 10–30 步）。

### MMDiT：Stable Diffusion 3 的变体

Stable Diffusion 3（Esser 等人，2024 年 3 月）发布了 MMDiT（Multimodal Diffusion Transformer），时间和 Transfusion 几乎重合。两者是兄弟架构。

MMDiT 的关键差异：

- 每个 block 有 modality-specific 权重。每个 transformer block 对文本 token 和图像 patch 各自有独立的 Q、K、V 和 MLP 权重。attention 是联合的（跨模态），其余部分都按模态分开。
- Rectified flow 训练。一种特定的 flow-matching 变体，采样过程已知，数学也比 DDPM 简单。
- 规模。MMDiT 是 SD3（2B 和 8B 参数版本）的 backbone。Transfusion 论文里的规模是 7B。

两者在核心思路上殊途同归：一个 transformer，文本上跑 NTP、连续图像表示上跑 diffusion。

### 为什么它能压过 Chameleon 风格（Why this beats Chameleon-style）

在图像生成上，连续 diffusion 和离散 NTP 之间的质量差距是可以被测量出来的。Transfusion 论文报告：

- 在 7B 参数下，FID 比同尺寸的 Chameleon 风格模型好 3–5 个点。
- 不需要训 tokenizer——图像 encoder 更简单（线性投影到 hidden，和 ViT 的输入层一样）。
- 推理时图像 patch 的去噪可以并行，autoregressive 图像 token 做不到这一点。

代价：Transfusion 是双损失模型，训练动力学更难拿捏。loss 权重需要调；NTP 和 diffusion 之间的 schedule 不匹配可能让某一个 head 占优。

### 下游延伸（What sits downstream）

Janus-Pro（Lesson 12.15）在 Transfusion 的思路上做了细化——把理解和生成各自的视觉 encoder 解耦：理解走 SigLIP、生成走 VQ，但 transformer 主体共享。Show-o（Lesson 12.14）则把 diffusion 换成了 discrete-diffusion（masked prediction）。Transfusion 之后，统一生成（unified-generation）这一支系迅速分叉。

2026 年生产环境里能吐图的 VLM——Gemini 3 Pro、GPT-5、Claude Opus 4.7 的图像生成路径——几乎一定用了这一族的某个后裔。细节是私有的。

## 用起来（Use It）

`code/main.py` 在一个 MNIST 大小的玩具问题上搭了一个 toy Transfusion：

- 文本 caption 是描述某个数字（0-9）的短整数序列。
- 图像是 4x4 的字节网格。
- 一对共享权重的线性投影充当 transformer 替身；文本上跑 NTP 损失，带噪 patch 上跑 MSE 损失。
- 训练循环交替这两个损失，attention mask 是显式的。
- 生成时一次前向就同时产出文本 caption 和一张 4x4 图像。

transformer 是玩具版。真正的产物是双损失的接线、attention mask 的构造、以及推理循环。

## 上线部署（Ship It）

本节产出 `outputs/skill-two-loss-trainer-designer.md`。给定一个新的多模态训练任务（文本 + 图像、文本 + 音频、文本 + 视频），它会设计双损失的 schedule（loss 权重、mask 形状、共享 vs modality-specific 的 block），并标出实现风险。

## 练习（Exercises）

1. 一个 Transfusion 风格的模型训练时 70% 是文本 token、30% 是图像 patch。图像 diffusion 损失在数量级上大约是文本 NTP 损失的 10 倍。怎么设 loss 权重才能让两边平衡？

2. 给序列 `[T, T, <image>, P, P, P, P, </image>, T]` 实现 block-triangular mask。把每个位置标 0 或 1。

3. MMDiT 用了 modality-specific 的 QKV 权重。相对于 Transfusion 完全共享的 transformer，这会增加多少参数量开销？在 7B 参数下，值不值？

4. 生成场景：给一个文本 prompt，模型先跑 50 个 token 的 NTP，然后碰到 `<image>`，然后在 256 个 patch 上跑 20 步去噪 diffusion。一共多少次前向？

5. 读 SD3 论文第 3 节。描述 rectified flow，并说明为什么它在更少的推理步数下就能收敛、好过 DDPM。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 它实际指的是 |
|------|-----------------|------------------------|
| 双损失训练（Two-loss training） | "NTP + diffusion" | 一个 transformer 在同一个梯度步里同时优化文本 token 上的 cross-entropy 和连续图像 patch 上的 MSE |
| Flow matching | "Rectified flow" | diffusion 的一个变体，预测从噪声到干净数据的速度场；数学比 DDPM 简单 |
| MMDiT | "Multimodal DiT" | Stable Diffusion 3 的架构：联合 attention，按模态分开的 MLP 和 norm |
| Block-triangular mask | "文本 causal + 图像双向" | 在文本上 causal、在图像区域内双向的 attention mask |
| 连续图像表示（Continuous image representation） | "No VQ" | 图像 patch 是实数向量，不是整数 codebook 索引 |
| 速度预测（Velocity prediction） | "v-parameterization" | 网络输出的是噪声和数据之间的速度场，而不是噪声本身 |

## 延伸阅读（Further Reading）

- [Zhou et al. — Transfusion (arXiv:2408.11039)](https://arxiv.org/abs/2408.11039)
- [Esser et al. — Stable Diffusion 3 / MMDiT (arXiv:2403.03206)](https://arxiv.org/abs/2403.03206)
- [Peebles & Xie — DiT (arXiv:2212.09748)](https://arxiv.org/abs/2212.09748)
- [Zhao et al. — MonoFormer (arXiv:2409.16280)](https://arxiv.org/abs/2409.16280)
- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
