# Transfusion：单个 Transformer 同时实现自回归文本 + 扩散图像

> Chameleon 和 Emu3 把一切都押在了离散 token 上。它们能工作，但量化瓶颈显而易见——图像质量在低于连续空间扩散模型的水平上趋于停滞。Transfusion(Meta，Zhou et al., 2024 年 8 月)采取了相反的押注：保持图像连续，完全去掉 VQ-VAE，用两个损失训练一个 transformer。文本 token 使用下一个 token 预测。图像 patch 使用 flow-matching / 扩散损失。两个目标优化同一组权重。Stable Diffusion 3 背后的架构(MMDiT)是它的近亲。本课阅读 Transfusion 论文，构建一个玩具级的双损失训练器，并梳理让一个 transformer 同时胜任两种任务的注意力掩码。

**Type:** Build
**Languages:** Python (stdlib，MNIST 规模玩具上的双损失训练器)
**Prerequisites:** Phase 12 · 11 (Chameleon)、Phase 8 (Generative AI)
**Time:** 约 180 分钟

## 学习目标

- 在同一骨干上连接一个运行两个损失（文本 token 上的 NTP、图像 patch 上的扩散 MSE）的 transformer。
- 解释为什么图像 patch 之间的双向注意力加上文本 token 之上的因果注意力是正确的掩码选择。
- 在算力、质量和代码复杂度方面，比较 Transfusion 风格（连续图像、扩散损失）与 Chameleon 风格（离散图像、NTP）。
- 说出 MMDiT 的贡献：每个 block 使用模态专属权重，在残差流上进行联合注意力。

## 问题

离散与连续图像 token 的争论比 LLM 更早。连续表示（原始像素、VAE latent）保留细节。离散 token（VQ 索引）适配 transformer 的原生词表，但在量化步骤中丢失细节。

Chameleon / Emu3 走了离散路线：一个损失、一个架构，但图像保真度受限于 tokenizer 的质量。

扩散模型走了连续路线：图像质量极佳，但它是与 LLM 分离的模型，需要复杂的噪声调度工程，且无法与文本生成干净地集成。

Transfusion 提问：能否兼得？保持图像连续，仍然只训练一个模型，把两个损失缝合成一次梯度步。

## 概念

### 双损失架构

一个 decoder-only transformer 处理一个包含以下内容的序列：

- 文本 token（离散，来自 BPE 词表）。
- 图像 patch（连续，16x16 像素块通过线性嵌入投影到隐藏维度——与 ViT 编码器的输入相同）。
- `<image>` 和 `</image>` 标记连续 patch 所在的位置。

前向传播运行一次。损失为每个 token 选择两个头之一：

- 对文本 token：在词表 logits 头上做标准交叉熵。
- 对图像 patch：对连续 patch 做扩散损失——预测加到每个 patch 上的噪声。

梯度流经共享的 transformer 主体。两个损失同时改进共享权重。

### 注意力掩码：因果文本 + 双向图像

文本 token 必须是因果的——不能让文本 token 注意到未来的文本，否则 teacher forcing 会被破坏。而图像 patch 代表同一快照；它们应在同一图像块内相互双向注意。

掩码为：

```
M[i, j] = 1 if:
  (i is text and j is text and j <= i)   # causal for text
  OR (i is image and j is image and same_image_block(i, j))   # bidirectional within image
  OR (i is text and j is image and j < i_image_end)   # text attends to previous images
  OR (i is image and j is text and j < i_image_start)   # image attends to preceding text
```

在训练和推理时实现为块三角掩码。

### transformer 内部的扩散损失

扩散损失是标准的：给图像 patch 加噪，让模型预测噪声（或等价地，预测干净 patch）。Transfusion 的版本使用 flow matching——预测从噪声到干净数据的速度场。

训练时：
1. 对每个图像 patch x0，采样一个随机时间步 t。
2. 采样噪声 ε，计算 xt = (1-t) * x0 + t * ε（flow matching 的线性插值）。
3. transformer 预测 v_theta(xt, t)；loss = MSE(v_theta(xt, t), ε - x0)。
4. 与同一序列的文本 NTP 损失一起反向传播。

推理时，生成为：
- 文本 token：标准自回归采样。
- 图像 patch：以前面的文本 token 为条件的扩散采样循环（典型为 10-30 步）。

### MMDiT：Stable Diffusion 3 的变体

Stable Diffusion 3 (Esser et al., 2024 年 3 月) 在与 Transfusion 大致同时期发布了 MMDiT (Multimodal Diffusion Transformer)。这两个架构是兄弟。

MMDiT 的关键区别：

- 每个 block 使用模态专属权重。每个 transformer block 对文本 token 与图像 patch 有独立的 Q、K、V 和 MLP 权重。注意力是联合的（跨模态）；其余一切都是模态专属的。
- Rectified flow 训练。一种特定的 flow-matching 变体，采样方式已知，数学比 DDPM 更简单。
- 规模。MMDiT 是 SD3（2B 和 8B 参数版本）的骨干。Transfusion 论文扩展到 7B。

两者都汇聚到同一个核心思想：一个 transformer 在文本上运行 NTP，在连续图像表示上运行扩散。

### 为什么它胜过 Chameleon 风格

连续扩散与离散 NTP 在图像生成上的质量差距是可测量的。Transfusion 论文报告：

- 在 7B 参数下，在 FID 上比同规模 Chameleon 风格的模型好 3-5 个点。
- 不需要训练 tokenizer——图像编码器更简单（到隐藏层的线性投影，与 ViT 的输入层相同）。
- 推理可以并行化图像 patch 去噪，不像自回归图像 token。

缺点：Transfusion 是双损失模型，训练动态更棘手。损失权重需要调优。NTP 与扩散之间的调度不匹配可能导致某一个头占主导。

### 下游发展

Janus-Pro（第 12.15 课）改进了 Transfusion 的思想，将用于理解和生成的视觉编码器解耦——一个用 SigLIP，另一个用 VQ——同时共享 transformer 主体。Show-o（第 12.14 课）将扩散换成离散扩散（掩码预测）。在 Transfusion 之后，统一生成家族迅速分化。

2026 年能输出图像的生产级 VLM——Gemini 3 Pro、GPT-5、Claude Opus 4.7 的图像生成路径——几乎可以肯定使用了该家族的某种后裔。细节属于专有信息。

```figure
cfg-guidance-scale
```

## 使用它

`code/main.py` 在一个微小的类 MNIST 问题上构建玩具级 Transfusion：

- 文本标题是描述数字（0-9）的短整数序列。
- 图像是 4x4 的字节网格。
- 一对共享权重的线性投影充当 transformer 替身；文本上做 NTP 损失，带噪 patch 上做 MSE 损失。
- 训练循环交替两个损失，注意力掩码是显式的。
- 生成在一次前向传播中产出一个文本标题和一张 4x4 图像。

transformer 是玩具。双损失管道、注意力掩码构造和推理循环才是真正的产物。

## 发布它

本课产出 `outputs/skill-two-loss-trainer-designer.md`。给定一个新的多模态训练任务（文本+图像、文本+音频、文本+视频），它设计双损失调度（损失权重、掩码形状、共享 vs 模态专属 block），并标记实现风险。

## 练习

1. 一个 Transfusion 风格的模型以 70% 文本 token 和 30% 图像 patch 训练。图像扩散损失在数量级上约为文本 NTP 损失的 10 倍。什么损失权重能平衡它们？

2. 为序列 `[T, T, <image>, P, P, P, P, </image>, T]` 实现块三角掩码。将每个条目标记为 0 或 1。

3. MMDiT 有模态专属的 QKV 权重。相比 Transfusion 的全共享 transformer，这增加了多少参数量开销？在 7B 参数下，值得吗？

4. 生成：给定文本提示，模型运行 NTP 生成 50 个 token，然后遇到 `<image>`，接着对 256 个 patch 进行 20 步去噪的扩散。总共需要多少次前向传播？

5. 阅读 SD3 论文第 3 节。描述 rectified flow，以及为什么它的收敛推理步数少于 DDPM。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 双损失训练 | "NTP + diffusion" | 单个 transformer 在同一梯度步中同时优化文本 token 上的交叉熵和连续图像 patch 上的 MSE |
| Flow matching | "Rectified flow" | 预测从噪声到干净数据的速度场的扩散变体；数学比 DDPM 简单 |
| MMDiT | "Multimodal DiT" | Stable Diffusion 3 的架构：联合注意力，模态专属的 MLP 和 norm |
| 块三角掩码 | "Causal text + bidirectional image" | 在文本上因果、在图像区域内双向的注意力掩码 |
| 连续图像表示 | "No VQ" | 图像 patch 作为实值向量，而非整数码本索引 |
| 速度预测 | "v-parameterization" | 网络输出是噪声与数据之间的速度场，而非噪声本身 |

## 延伸阅读

- [Zhou et al. — Transfusion (arXiv:2408.11039)](https://arxiv.org/abs/2408.11039)
- [Esser et al. — Stable Diffusion 3 / MMDiT (arXiv:2403.03206)](https://arxiv.org/abs/2403.03206)
- [Peebles & Xie — DiT (arXiv:2212.09748)](https://arxiv.org/abs/2212.09748)
- [Zhao et al. — MonoFormer (arXiv:2409.16280)](https://arxiv.org/abs/2409.16280)
- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)