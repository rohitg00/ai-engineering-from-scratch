# Transfusion：自回归文本 + 扩散图像于同一 Transformer

> Chameleon 和 Emu3 将所有赌注押在离散 token 上。它们有效，但量化瓶颈可见——图像质量在连续空间扩散模型之下达到平台期。Transfusion（Meta，Zhou 等人，2024 年 8 月）采取了相反的赌注：保持图像连续，完全放弃 VQ-VAE，用两个损失训练一个 transformer。文本 token 获得 next-token-prediction。图像 patch 获得流匹配 / 扩散损失。两个目标优化相同的权重。Stable Diffusion 3（MMDiT）的底层架构是近亲。本课解读 Transfusion 的论点，构建一个玩具双损失训练器，并追踪让同一 transformer 完成两项工作的注意力掩码。

**类型：** Build
**语言：** Python（stdlib，MNIST 规模玩具上的双损失训练器）
**前置知识：** Phase 12 · 11（Chameleon），Phase 8（生成式 AI）
**时间：** ~180 分钟

## 学习目标

- 连接一个运行两个损失（文本 token 上的 NTP，图像 patch 上的扩散 MSE）的 transformer，共享一个骨干。
- 解释为什么图像 patch 上的双向注意力加文本 token 上的因果注意力是正确的掩码选择。
- 在计算、质量和代码复杂度上比较 Transfusion 风格（连续图像，扩散损失）与 Chameleon 风格（离散图像，NTP）。
- 命名 MMDiT 的贡献：每个块上的模态特定权重，残差流上的联合注意力。

## 问题所在

离散 vs 连续图像 token 的辩论比 LLM 更古老。连续表示（原始像素，VAE 潜在变量）保留细节。离散 token（VQ 索引）适合 transformer 的原生词汇，但在量化步骤丢失细节。

Chameleon / Emu3 选择了离散：一个损失，一个架构，但图像保真度受分词器质量上限限制。

扩散模型选择了连续：卓越的图像质量，但与 LLM 分离的模型，复杂的噪声调度工程，以及与文本生成没有干净的集成。

Transfusion 问道：我们能同时拥有两者吗？保持图像连续，仍然训练一个模型，将两个损失缝合到一个梯度步骤中。

## 核心概念

### 双损失架构

单个仅解码器 transformer 处理包含以下内容的序列：

- 文本 token（离散的，来自 BPE 词汇）。
- 图像 patch（连续的，16x16 像素块通过线性嵌入投影到隐藏维度——与 ViT 编码器的输入相同）。
- `<image>` 和 `</image>` 标签标记连续 patch 所在位置。

前向传播运行一次。损失为每个 token 选择两个头之一：

- 对于文本 token：词汇 logits 头上的标准交叉熵。
- 对于图像 patch：连续 patch 上的扩散损失——预测添加到每个 patch 的噪声。

梯度流经共享的 transformer 主体。两个损失同时改善共享权重。

### 注意力掩码：因果文本 + 双向图像

文本 token 必须是因果的——你不能让文本 token 关注未来的文本，否则教师强制会崩溃。然而，图像 patch 代表一个快照；它们应该在同一图像块内双向相互关注。

掩码：

```
M[i, j] = 1 如果：
  (i 是文本且 j 是文本且 j <= i)   # 文本的因果性
  或 (i 是图像且 j 是图像且 same_image_block(i, j))   # 图像内的双向性
  或 (i 是文本且 j 是图像且 j < i_image_end)   # 文本关注之前的图像
  或 (i 是图像且 j 是文本且 j < i_image_start)   # 图像关注前面的文本
```

在训练和推理时实现为块三角掩码。

### Transformer 内的扩散损失

扩散损失是标准的：向图像 patch 添加噪声，要求模型预测噪声（或等效地，干净的 patch）。Transfusion 的版本使用流匹配——预测从噪声到干净的流速场。

训练期间：
1. 对于每个图像 patch x0，采样随机时间步 t。
2. 采样噪声 ε，计算 xt = (1-t) * x0 + t * ε（流匹配的线性插值）。
3. Transformer 预测 v_theta(xt, t)；损失 = MSE(v_theta(xt, t), ε - x0)。
4. 与同一序列中的文本 NTP 损失一起反向传播。

推理时，生成是：
- 文本 token：标准自回归采样。
- 图像 patch：以先前文本 token 为条件的扩散采样循环（典型 10-30 步）。

### MMDiT：Stable Diffusion 3 的变体

Stable Diffusion 3（Esser 等人，2024 年 3 月）与 Transfusion 大约同时发布了 MMDiT（多模态扩散 Transformer）。架构是兄弟关系。

MMDiT 的关键差异：

- 每个块的模态特定权重。每个 transformer 块为文本 token 与图像 patch 拥有独立的 Q、K、V 和 MLP 权重。注意力是联合的（跨模态）；其他一切都是模态特定的。
- 整流流训练。一种特定的流匹配变体，具有已知的采样和比 DDPM 更简单的数学。
- 规模。MMDiT 是 SD3 的骨干（2B 和 8B 参数变体）。Transfusion 的论文扩展到 7B。

两者都收敛于相同的核心思想：一个 transformer 在文本上运行 NTP，在连续图像表示上运行扩散。

### 为什么这击败 Chameleon 风格

连续扩散与离散 NTP 在图像生成上的质量差距是可测量的。Transfusion 论文报告：

- 在 7B 参数下，FID 比相同大小的 Chameleon 风格模型高 3-5 分。
- 不需要分词器训练——图像编码器更简单（线性投影到隐藏层，与 ViT 的输入层相同）。
- 推理可以并行化图像 patch 去噪，不像自回归图像 token。

缺点：Transfusion 是双损失模型，使训练动态更棘手。损失权重需要调优。NTP 和扩散之间的调度不匹配可能导致一个头主导。

### 下游是什么

Janus-Pro（第 12.15 课）通过将视觉编码器解耦为理解和生成——SigLIP 用于一个，VQ 用于另一个——同时共享 transformer 主体，来完善 Transfusion 的想法。Show-o（第 12.14 课）用离散扩散（掩码预测）替换扩散。统一生成家族在 Transfusion 之后迅速分支。

2026 年生成图像的生产 VLM——Gemini 3 Pro、GPT-5、Claude Opus 4.7 的图像生成路径——几乎肯定使用这个家族的某个后代。细节是专有的。

## 使用它

`code/main.py` 在一个微小的 MNIST 类问题上构建一个玩具 Transfusion：

- 文本描述是描述数字（0-9）的短整数序列。
- 图像是字节的 4x4 网格。
- 一对共享权重线性投影充当 transformer 替代品；文本上的 NTP 损失，噪声 patch 上的 MSE 损失。
- 训练循环交替两个损失，注意力掩码是显式的。
- 生成在一个前向传播中产生文本描述和 4x4 图像。

Transformer 是玩具。双损失管道、注意力掩码构建和推理循环是真正的产物。

## 交付它

本课产出 `outputs/skill-two-loss-trainer-designer.md`。给定一个新的多模态训练任务（文本 + 图像，文本 + 音频，文本 + 视频），它设计双损失调度（损失权重、掩码形状、共享 vs 模态特定块）并标记实现风险。

## 练习

1. 一个 Transfusion 风格模型训练 70% 文本 token 和 30% 图像 patch。图像扩散损失在幅度上约为文本 NTP 损失的 10 倍。什么损失权重平衡它们？

2. 为序列实现块三角掩码：`[T, T, <image>, P, P, P, P, </image>, T]`。将每个条目标记为 0 或 1。

3. MMDiT 有模态特定的 QKV 权重。与 Transfusion 的完全共享 transformer 相比，这增加了多少参数开销？在 7B 参数下，值得吗？

4. 生成：给定文本提示词，模型运行 50 个 token 的 NTP，然后命中 `<image>`，然后在 20 个去噪步上对 256 个 patch 运行扩散。总共多少次前向传播？

5. 阅读 SD3 论文第 3 节。描述整流流以及为什么它比 DDPM 在更少的推理步中收敛。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 双损失训练 | "NTP + 扩散" | 单个 transformer 在同一梯度步骤中优化文本 token 上的交叉熵和连续图像 patch 上的 MSE |
| 流匹配 | "整流流" | 扩散变体，预测从噪声到干净数据的流速场；数学比 DDPM 更简单 |
| MMDiT | "多模态 DiT" | Stable Diffusion 3 的架构：联合注意力，模态特定的 MLP 和归一化 |
| 块三角掩码 | "因果文本 + 双向图像" | 在文本上因果但在图像区域内双向的注意力掩码 |
| 连续图像表示 | "无 VQ" | 图像 patch 作为实值向量，而非整数码本索引 |
| 速度预测 | "v-参数化" | 网络输出是噪声和数据之间的速度场，而非噪声本身 |

## 延伸阅读

- [Zhou et al. — Transfusion (arXiv:2408.11039)](https://arxiv.org/abs/2408.11039)
- [Esser et al. — Stable Diffusion 3 / MMDiT (arXiv:2403.03206)](https://arxiv.org/abs/2403.03206)
- [Peebles & Xie — DiT (arXiv:2212.09748)](https://arxiv.org/abs/2212.09748)
- [Zhao et al. — MonoFormer (arXiv:2409.16280)](https://arxiv.org/abs/2409.16280)
- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
