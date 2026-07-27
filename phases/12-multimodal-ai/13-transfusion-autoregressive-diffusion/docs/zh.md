# Transfusion：在一个Transformer中融合自回归文本与扩散图像

> Chameleon 和 Emu3 把一切都押注在离散 token 上。它们能工作，但量化瓶颈显而易见——图像质量停滞在连续空间扩散模型之下。Transfusion（Meta，Zhou 等人，2024年8月）选择了相反的路径：保持图像为连续表示，完全抛弃 VQ-VAE，用一个 Transformer 配合两个损失函数进行训练。文本 token 使用下一个 token 预测（next-token-prediction）。图像 patch 使用流匹配/扩散损失（flow-matching / diffusion loss）。两个目标优化同一套权重。Stable Diffusion 3（MMDiT）的架构是它的近亲。本课程解读 Transfusion 论文，构建一个 toy 级别的双损失训练器，并剖析让一个 Transformer 同时完成两项任务的注意力掩码。

**类型：** 构建
**语言：** Python（标准库，在 MNIST 级别 toy 数据上的双损失训练器）
**前置知识：** 阶段 12 · 11（Chameleon），阶段 8（生成式 AI）
**时长：** ~180 分钟

## 学习目标

- 搭建一个在单一主干网络上同时运行两个损失（文本 token 的 NTP 和图像 patch 的扩散 MSE）的 Transformer。
- 解释为什么图像 patch 上的双向注意力加上文本 token 上的因果注意力是正确的掩码选择。
- 从计算量、质量和代码复杂度三个维度比较 Transfusion 风格（连续图像，扩散损失）与 Chameleon 风格（离散图像，NTP）。
- 说出 MMDiT 的贡献：每个 block 使用模态特定权重，残差流上进行联合注意力。

## 问题

离散 vs 连续图像 token 的争论比 LLM 出现得更早。连续表示（原始像素、VAE 潜变量）保留了更多细节。离散 token（VQ 索引）适合 Transformer 的原生词表，但在量化步骤中丢失了细节。

Chameleon / Emu3 选择了离散路线：一个损失、一个架构，但图像 fidelity 受限于分词器质量。

扩散模型选择了连续路线：图像质量卓越，但却是与 LLM 分离的独立模型，需要复杂的噪声调度工程，并且无法与文本生成干净地集成。

Transfusion 提出的问题是：能否两者兼得？保持图像的连续性，仍然训练一个模型，将两个损失拼接到一个梯度步骤中。

## 概念

### 双损失架构

单个仅解码器（decoder-only）的 Transformer 处理一个包含以下内容的序列：

- 文本 token（离散值，来自 BPE 词表）。
- 图像 patch（连续值，16×16 像素块通过线性嵌入投影到隐藏维度——与 ViT 编码器的输入相同）。
- `<image>` 和 `</image>` 标签，标记连续 patch 所在的位置。

前向传播只执行一次。每个 token 的损失从两个 head 中选择一个：

- 对于文本 token：在词表 logits head 上使用标准交叉熵损失。
- 对于图像 patch：在连续 patch 上使用扩散损失——预测被添加到每个 patch 上的噪声。

梯度流经共享的 Transformer 主体。两个损失同时优化共享的权重。

### 注意力掩码：文本因果 + 图像双向

文本 token 必须是因果的——你不能让一个文本 token 关注未来的文本，否则 teacher forcing 会失效。然而，图像 patch 代表的是同一时刻的快照；它们应该在同一个图像块内相互双向关注。

掩码：

```
M[i, j] = 1 当且仅当：
  (i 是文本 且 j 是文本 且 j <= i)                    # 文本的因果掩码
  或 (i 是图像 且 j 是图像 且 same_image_block(i, j))  # 图像内部双向
  或 (i 是文本 且 j 是图像 且 j < i_image_end)        # 文本关注之前的图像
  或 (i 是图像 且 j 是文本 且 j < i_image_start)      # 图像关注前面的文本
```

在训练和推理时实现为一个块三角掩码（block-triangular mask）。

### Transformer 内部的扩散损失

扩散损失是标准的：向图像 patch 添加噪声，让模型预测噪声（或等价地预测干净的 patch）。Transfusion 的版本使用流匹配——预测从噪声到干净数据的速度场。

训练过程中：
1. 对每个图像 patch x₀，采样一个随机时间步 t。
2. 采样噪声 ε，计算 xₜ = (1-t) * x₀ + t * ε（流匹配的线性插值）。
3. Transformer 预测 v_θ(xₜ, t)；损失 = MSE(v_θ(xₜ, t), ε - x₀)。
4. 与来自同一序列的文本 NTP 损失一起反向传播。

推理时，生成过程是：
- 文本 token：标准自回归采样。
- 图像 patch：以前面的文本 token 为条件，运行扩散采样循环（通常 10-30 步）。

### MMDiT：Stable Diffusion 3 的变体

Stable Diffusion 3（Esser 等人，2024年3月）大约在同一时间推出了 MMDiT（多模态扩散 Transformer）。这两种架构是近亲。

MMDiT 的关键区别：

- 每个 block 有模态特定的权重。每个 Transformer block 对文本 token 和图像 patch 有独立的 Q、K、V 和 MLP 权重。注意力是联合的（跨模态）；其他所有部分都是模态特定的。
- 使用矫正流（Rectified flow）训练。一种特定的流匹配变体，具有已知的采样方法且数学比 DDPM 更简洁。
- 规模。MMDiT 是 SD3（2B 和 8B 参数变体）的骨干网络。Transfusion 论文扩展到了 7B。

两者都收敛到了同一个核心思想：一个 Transformer 对文本运行 NTP，对连续图像表示运行扩散。

### 为什么这击败了 Chameleon 风格

连续扩散与离散 NTP 在图像生成上的质量差距是可测量的。Transfusion 论文报告：

- 在 7B 参数规模下，在 FID 上比同规模的 Chameleon 风格模型高出 3-5 个点。
- 不需要训练分词器——图像编码器更简单（线性投影到隐藏维度，与 ViT 的输入层相同）。
- 推理时可以并行化解噪图像 patch，这与自回归的图像 token 不同。

缺点：Transfusion 是一个双损失模型，训练动态更复杂。损失权重需要调优。NTP 和扩散之间的调度不匹配可能导致其中一个 head 主导训练。

### 后续发展

Janus-Pro（课程 12.15）通过将视觉编码器解耦为理解和生成两部分来改进 Transfusion 的想法——一部分用 SigLIP，另一部分用 VQ——同时共享 Transformer 主体。Show-o（课程 12.14）将扩散替换为离散扩散（掩码预测）。统一生成家族在 Transfusion 之后迅速分支发展。

2026 年能够生成图像的商用 VLM——Gemini 3 Pro、GPT-5、Claude Opus 4.7 的图像生成通路——几乎肯定使用了这个家族的某种后代。具体细节是专有的。

## 使用它

`code/main.py` 在一个微型 MNIST 风格问题上构建了一个 toy 级别的 Transfusion：

- 文本描述是描述一个数字（0-9）的短整数序列。
- 图像是 4×4 的字节网格。
- 一对共享权重的线性投影作为 Transformer 的替代品；文本使用 NTP 损失，噪声 patch 使用 MSE 损失。
- 训练循环交替两个损失，注意力掩码是显式构造的。
- 生成过程在一次前向传播中产生一个文本描述和一个 4×4 图像。

这个 Transformer 是 toy 级别的。双损失管道、注意力掩码构造和推理循环才是真正的核心成果。

## 输出成果

本课程生成 `outputs/skill-two-loss-trainer-designer.md`。给定一个新的多模态训练任务（文本+图像、文本+音频、文本+视频），它将设计双损失调度方案（损失权重、掩码形状、共享 vs 模态特定 block）并标记实现风险。

## 练习

1. 一个 Transfusion 风格的模型训练时包含 70% 的文本 token 和 30% 的图像 patch。图像扩散损失的量级大约是文本 NTP 损失的 10 倍。需要什么样的损失权重来平衡它们？

2. 为一个序列 `[T, T, <image>, P, P, P, P, </image>, T]` 实现块三角掩码。将每个条目标记为 0 或 1。

3. MMDiT 有模态特定的 QKV 权重。与 Transfusion 的完全共享 Transformer 相比，这会增加多少参数开销？在 7B 参数规模下，这值得吗？

4. 生成过程：给定一个文本提示，模型运行 NTP 生成 50 个 token，然后遇到 `<image>`，然后对 256 个 patch 运行 20 步去噪扩散。总共需要多少次前向传播？

5. 阅读 SD3 论文第 3 节。描述矫正流（Rectified flow）以及为什么它比 DDPM 用更少的推理步数就能收敛。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| 双损失训练 | "NTP + 扩散" | 单个 Transformer 在同一个梯度步骤中同时优化文本 token 上的交叉熵损失和连续图像 patch 上的 MSE 损失 |
| 流匹配 | "矫正流" | 扩散变体，预测从噪声到干净数据的速度场；数学比 DDPM 更简洁 |
| MMDiT | "多模态 DiT" | Stable Diffusion 3 的架构：联合注意力，模态特定的 MLP 和归一化层 |
| 块三角掩码 | "文本因果 + 图像双向" | 文本区域因果、图像区域内部双向的注意力掩码 |
| 连续图像表示 | "无 VQ" | 图像 patch 作为实值向量，而非整数码本索引 |
| 速度预测 | "v-参数化" | 网络输出是噪声与数据之间的速度场，而非噪声本身 |

## 延伸阅读

- [Zhou 等人 — Transfusion (arXiv:2408.11039)](https://arxiv.org/abs/2408.11039)
- [Esser 等人 — Stable Diffusion 3 / MMDiT (arXiv:2403.03206)](https://arxiv.org/abs/2403.03206)
- [Peebles & Xie — DiT (arXiv:2212.09748)](https://arxiv.org/abs/2212.09748)
- [Zhao 等人 — MonoFormer (arXiv:2409.16280)](https://arxiv.org/abs/2409.16280)
- [Xie 等人 — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
