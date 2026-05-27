# Transfusion：在一个Transformer中实现自回归文本与扩散图像

> Chameleon 和 Emu3 将所有赌注押在了离散 Token 上。它们能工作，但量化瓶颈显而易见——图像质量低于连续空间扩散模型。Transfusion（Meta，Zhou 等人，2024 年 8 月）则反向押注：保持图像的连续性，完全放弃 VQ-VAE，用一个 Transformer 同时训练两个损失。文本 Token 使用下一个 Token 预测（Next-Token Prediction）。图像 Patch 使用流匹配（Flow Matching）/扩散损失。两个目标优化同一组权重。Stable Diffusion 3（MMDiT）的架构与它非常相似。本节课将解读 Transfusion 论文，构建一个简单的双损失训练器，并追踪让一个 Transformer 同时完成两项任务的注意力掩码。

**类型：** 构建
**语言：** Python（标准库，基于 MNIST 规模的玩具双损失训练器）
**先修知识：** 第 12 阶段 · 第 11 课（Chameleon），第 8 阶段（生成式 AI）
**时长：** 约 180 分钟

## 学习目标

- 搭建一个在一个主干网络（Backbone）上运行两个损失（文本 Token 的 NTP 损失，图像 Patch 的扩散均方误差损失）的 Transformer。
- 解释为什么图像 Patch 间的双向注意力加上文本 Token 间的因果注意力是正确的掩码选择。
- 比较 Transfusion 风格（连续图像，扩散损失）与 Chameleon 风格（离散图像，NTP）在计算量、质量和代码复杂度上的差异。
- 说出 MMDiT 的贡献：每个 Block 中特定模态的权重，以及残差流（Residual Stream）上的联合注意力（Joint Attention）。

## 问题

连续图像 Token 与离散图像 Token 之争的历史比 LLM 还要久远。连续表示（原始像素、VAE 潜在变量）保留了细节。离散 Token（VQ 索引）适合 Transformer 的原生词汇表，但在量化步骤中会丢失细节。

Chameleon / Emu3 选择了离散：一个损失，一个架构，但图像保真度受限于 Tokenizer 的质量。

扩散模型选择了连续：出色的图像质量，但需要与 LLM 分离的模型、复杂的噪声调度工程，并且与文本生成没有干净的集成。

Transfusion 提出疑问：我们能否两者兼得？保持图像的连续性，仍然训练一个模型，将两个损失拼接到一个梯度步骤中。

## 概念

### 双损失架构

一个仅解码器（Decoder-only）的 Transformer 处理一个序列，该序列包含：

- 文本 Token（离散的，来自 BPE 词汇表）。
- 图像 Patch（连续的，16×16 像素块通过线性嵌入映射到隐藏维度——与 ViT 编码器的输入相同）。
- `<image>` 和 `</image>` 标签，标记连续 Patch 所在的位置。

前向传播只运行一次。损失函数为每个 Token 选择两个输出头（Head）之一：

- 对于文本 Token：在词汇表 logits 输出头上进行标准交叉熵（Cross-Entropy）。
- 对于图像 Patch：在连续 Patch 上的扩散损失——预测添加到每个 Patch 上的噪声。

梯度流经共享的 Transformer 主体。两个损失同时改善共享的权重。

### 注意力掩码：因果文本 + 双向图像

文本 Token 必须使用因果掩码——不能让一个文本 Token 注意到未来的文本，否则强制教学（Teacher Forcing）会被破坏。而图像 Patch 表示一个快照，在同一个图像块内它们应该能够相互双向注意力。

掩码如下：

```
M[i, j] = 1 如果：
  (i 是文本且 j 是文本且 j <= i)   # 文本因果
  或 (i 是图像且 j 是图像且 same_image_block(i, j))   # 图像内部双向
  或 (i 是文本且 j 是图像且 j < i_image_end)   # 文本注意之前的图像
  或 (i 是图像且 j 是文本且 j < i_image_start)   # 图像注意之前的文本
```

在训练和推理时作为块三角（Block-triangular）掩码实现。

### Transformer 内部的扩散损失

扩散损失是标准做法：向图像 Patch 添加噪声，让模型预测噪声（或等价地预测干净 Patch）。Transfusion 的版本使用流匹配——从噪声到干净数据预测速度场（Velocity Field）。

训练过程中：
1. 对于每个图像 Patch x0，采样一个随机时间步 t。
2. 采样噪声 ε，计算 xt = (1-t) * x0 + t * ε（用于流匹配的线性插值）。
3. Transformer 预测 v_θ(xt, t)；损失 = MSE(v_θ(xt, t), ε - x0)。
4. 与来自同一序列的文本 NTP 损失一起反向传播。

在推理时，生成过程为：
- 文本 Token：标准自回归采样。
- 图像 Patch：扩散采样循环（通常 10-30 步），以前面生成的文本 Token 为条件。

### MMDiT：Stable Diffusion 3 的变体

Stable Diffusion 3（Esser 等人，2024 年 3 月）在差不多同一时间发布了 MMDiT（多模态扩散 Transformer）。这两个架构是兄弟关系。

MMDiT 的关键区别：

- 每个 Block 中具有模态特定的权重。每个 Transformer Block 为文本 Token 和图像 Patch 分别使用独立的 Q、K、V 和 MLP 权重。注意力是联合的（跨模态）；其余所有部分都是模态特定的。
- 整流流（Rectified Flow）训练。一种特定的流匹配变体，具有已知的采样方法和比 DDPM 更简单的数学形式。
- 规模。MMDiT 是 SD3 的主干网络（2B 和 8B 参数变体）。Transfusion 的论文扩展到 7B。

两者都收敛到同一个核心思想：一个 Transformer 对文本运行 NTP，对连续图像表示运行扩散。

### 为什么这比 Chameleon 风格更好

连续扩散与离散 NTP 在图像生成上的质量差距是可衡量的。Transfusion 论文报告：

- 在 7B 参数规模下，FID 比相同规模的 Chameleon 风格模型好 3-5 个点。
- 无需训练 Tokenizer——图像编码器更简单（线性投影到隐藏维度，与 ViT 的输入层相同）。
- 推理时可以并行去噪图像 Patch，而自回归图像 Token 则不行。

缺点：Transfusion 是一个双损失模型，训练动态更棘手。损失权重需要调整。NTP 和扩散之间的调度不匹配可能导致一个头主导另一个头。

### 后续发展

Janus-Pro（第 12.15 课）通过解耦视觉编码器（理解用 SigLIP，生成用 VQ）来完善 Transfusion 的想法，同时共享 Transformer 主体。Show-o（第 12.14 课）将扩散替换为离散扩散（掩码预测）。统一生成（Unified-Generation）家族在 Transfusion 之后迅速分支。

2026 年能够生成图像的生产级 VLM——Gemini 3 Pro、GPT-5、Claude Opus 4.7 的图像生成路径——几乎肯定使用该家族的某个后代。细节是专有的。

## 使用

`code/main.py` 在一个类似 MNIST 的微型问题上构建了一个玩具 Transfusion：

- 文本说明是描述数字（0-9）的短整数序列。
- 图像是 4×4 的字节网格。
- 一对共享权重的线性投影充当 Transformer 的替代；文本部分使用 NTP 损失，带噪声 Patch 使用 MSE 损失。
- 训练循环交替进行两个损失，注意力掩码是显式的。
- 生成过程在一次前向传播中产生一段文本说明和一幅 4×4 图像。

Transformer 只是玩具。双损失管道、注意力掩码构建和推理循环才是真正要掌握的内容。

## 交付

本节课产出 `outputs/skill-two-loss-trainer-designer.md`。对于一个新的多模态训练任务（文本 + 图像，文本 + 音频，文本 + 视频），它将设计双损失调度（损失权重、掩码形状、共享 vs 模态特定 Block），并标记实现风险。

## 练习

1. 一个 Transfusion 风格模型训练了 70% 的文本 Token 和 30% 的图像 Patch。图像扩散损失的大小大约是文本 NTP 损失的 10 倍。什么损失权重可以平衡它们？

2. 为序列 `[T, T, <image>, P, P, P, P, </image>, T]` 实现块三角掩码。将每个条目标记为 0 或 1。

3. MMDiT 具有模态特定的 QKV 权重。相比 Transfusion 的完全共享 Transformer，这会增加多少参数开销？在 7B 参数规模下，这值得吗？

4. 生成过程：给定一个文本提示，模型对 50 个 Token 运行 NTP，然后遇到 `<image>`，然后在 256 个 Patch 上运行扩散（20 步去噪）。总共需要多少次前向传播？

5. 阅读 SD3 论文第 3 节。描述整流流（Rectified Flow）以及为什么它能在比 DDPM 更少的推理步骤中收敛。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| 双损失训练 | "NTP + 扩散" | 单个 Transformer 在同一梯度步骤中同时优化文本 Token 的交叉熵和连续图像 Patch 的均方误差 |
| 流匹配 | "整流流" | 扩散变体，预测从噪声到干净数据的速度场；数学比 DDPM 更简单 |
| MMDiT | "多模态 DiT" | Stable Diffusion 3 的架构：联合注意力，模态特定的 MLP 和归一化 |
| 块三角掩码 | "因果文本 + 双向图像" | 在文本区域内因果但在图像区域内双向的注意力掩码 |
| 连续图像表示 | "无 VQ" | 图像 Patch 作为实值向量，而不是整数码本索引 |
| 速度预测 | "v-参数化" | 网络输出是噪声与数据之间的速度场，而不是噪声本身 |

## 进一步阅读

- [Zhou 等人 — Transfusion (arXiv:2408.11039)](https://arxiv.org/abs/2408.11039)
- [Esser 等人 — Stable Diffusion 3 / MMDiT (arXiv:2403.03206)](https://arxiv.org/abs/2403.03206)
- [Peebles & Xie — DiT (arXiv:2212.09748)](https://arxiv.org/abs/2212.09748)
- [Zhao 等人 — MonoFormer (arXiv:2409.16280)](https://arxiv.org/abs/2409.16280)
- [Xie 等人 — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)