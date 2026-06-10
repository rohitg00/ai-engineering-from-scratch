# 04 · 条件式 GAN 与 Pix2Pix

> 2014–2017 年的第一个重大突破，是让人能够控制 GAN 生成什么。可以挂一个标签、一张图像，或一句话。Pix2Pix 做的是图像版本，时至今日它在窄域的图到图任务上仍然胜过任何通用的文生图模型。

**类型：** 构建
**语言：** Python
**前置：** 阶段 8 · 03（GAN）、阶段 4 · 06（U-Net）、阶段 3 · 07（CNN）
**时长：** 约 75 分钟

## 问题所在

一个无条件 GAN 采样出的是任意人脸。这对演示有用，但在生产中毫无价值。你真正想要的是：*把草图映射成照片*、*把地图映射成航拍照片*、*把白天场景映射成夜晚*、*给灰度图上色*。在所有这些任务里，你都被给定一张输入图像 `x`，必须输出一张与之存在某种语义对应关系的 `y`。对于每个 `x`，都存在许多看似合理的 `y`。「均方误差（mean-squared error）」会把它们压平成一团糊。而「对抗损失（adversarial loss）」不会，因为「看起来真实」这个判据是锐利的。

「条件式 GAN（Conditional GAN）」（Mirza & Osindero, 2014）给 `G` 和 `D` 都额外加入一个条件 `c` 作为输入。Pix2Pix（Isola et al., 2017）把这一思想专门化：条件是一整张输入图像，生成器是一个 U-Net，判别器是一个*基于图块（patch）*的分类器（PatchGAN），损失则是对抗损失 + L1。即使到了 2026 年，这套配方在窄域的图到图领域上仍然胜过从零训练的文生图模型，原因在于它是在*成对数据（paired data）*上训练的——你拥有的恰好就是你需要的那个信号。

## 核心概念

〔图：Pix2Pix —— U-Net 生成器与 PatchGAN 判别器〕

**条件式 G。** `G(x, z) → y`。在 Pix2Pix 中，`z` 是 G 内部的「丢弃（dropout）」（没有输入噪声——Isola 发现显式噪声会被忽略）。

**条件式 D。** `D(x, y) → [0, 1]`。输入是*成对*的（条件，输出）。这是关键区别：D 必须判断 `y` 是否与 `x` 一致，而不只是判断 `y` 看起来是否真实。

**U-Net 生成器。** 一个带「跳跃连接（skip connection）」跨越瓶颈层的编码器-解码器结构。对于输入与输出共享底层结构（边缘、轮廓）的任务至关重要。没有跳跃连接，高频细节就会消失。

**PatchGAN 判别器。** D 不输出单一的真/假分数，而是输出一个 `N×N` 的网格，其中每个单元判断一个约 70×70 像素的「感受野（receptive field）」，再取平均。这背后是一个「马尔可夫随机场（Markov random field）」假设：真实性是局部的。它训练起来快得多、参数更少、输出更锐利。

**损失。**

```
loss_G = -log D(x, G(x)) + λ · ||y - G(x)||_1
loss_D = -log D(x, y) - log (1 - D(x, G(x)))
```

L1 项稳定训练，并把 G 推向已知的目标。L1 比 L2 给出更锐利的边缘（中位数，而非均值）。`λ = 100` 是 Pix2Pix 的默认值。

## CycleGAN —— 当你没有成对数据时

Pix2Pix 需要成对的 `(x, y)` 数据。CycleGAN（Zhu et al., 2017）以增加一项损失为代价摆脱了这个要求，这项损失就是*循环一致性（cycle consistency）*损失。它有两个生成器 `G: X → Y` 和 `F: Y → X`。训练它们使得 `F(G(x)) ≈ x` 且 `G(F(y)) ≈ y`。这让你无需成对样例就能把马变成斑马、把夏天变成冬天。

到了 2026 年，无配对的图到图任务大多通过扩散模型（ControlNet、IP-Adapter）完成，而非 CycleGAN，但循环一致性这一思想几乎在每一篇无配对领域自适应论文中都得以延续。

## 动手构建

`code/main.py` 在一维数据上实现了一个极小的条件式 GAN。条件 `c` 是一个类别标签（0 或 1）。任务是：对给定类别，从其条件分布中产生一个样本。

### 第 1 步：把条件拼接到 G 和 D 两者的输入上

```python
def G(z, c, params):
    return mlp(concat([z, one_hot(c)]), params)

def D(x, c, params):
    return mlp(concat([x, one_hot(c)]), params)
```

「独热编码（one-hot encoding）」是最简单的方式。更大的模型会使用学习得到的嵌入、FiLM 调制或交叉注意力。

### 第 2 步：进行条件式训练

```python
for step in range(steps):
    x, c = sample_real_conditional()
    noise = sample_noise()
    update_D(x_real=x, x_fake=G(noise, c), c=c)
    update_G(noise, c)
```

生成器必须匹配*给定条件下*的真实分布，而不是边缘分布。

### 第 3 步：逐类别验证输出

```python
for c in [0, 1]:
    samples = [G(noise, c) for noise in batch]
    mean_c = mean(samples)
    assert_near(mean_c, real_mean_for_class_c)
```

## 常见陷阱

- **条件被忽略。** G 学会了去做边缘化，而 D 从不施加惩罚，因为条件信号太弱。修复方法：更激进地对 D 施加条件（在早期层，而不只是后期层），使用「投影判别器（projection discriminator）」（Miyato & Koyama 2018）。
- **L1 权重过低。** G 漂移到任意看起来真实但并不忠实的输出。对 Pix2Pix 风格的任务，从 λ≈100 起步。
- **L1 权重过高。** G 产生模糊的输出，因为 L1 终究还是一个 L_p 范数。训练稳定后再退火降低它。
- **D 中的真值泄漏。** 把 `(x, y)` 拼接起来作为 D 的输入，而不只是 `y`。否则 D 无法检验一致性。
- **逐类别的模式坍缩。** 每个类别都可能独立地坍缩。运行逐类别的条件多样性检查。

## 实际运用

2026 年图到图任务的现状：

| 任务 | 最佳方案 |
|------|---------------|
| 草图 → 照片，同域，成对数据 | Pix2Pix / Pix2PixHD（仍然快、仍然锐利） |
| 草图 → 照片，无配对 | 配合 Scribble 条件模型的 ControlNet |
| 语义分割 → 照片 | SPADE / GauGAN2 或 SD + ControlNet-Seg |
| 风格迁移 | 配合 IP-Adapter 或 LoRA 的扩散模型；GAN 方法已属遗留方案 |
| 深度图 → 照片 | 基于 Stable Diffusion 的 ControlNet-Depth |
| 超分辨率 | Real-ESRGAN（GAN）、ESRGAN-Plus，或 SD-Upscale（扩散） |
| 上色 | ColTran、基于扩散的上色器，或 Pix2Pix-color |
| 白天 → 夜晚、季节、天气 | CycleGAN 或基于 ControlNet 的方案 |

当满足以下条件时，Pix2Pix 仍是正确的工具：(a) 你拥有数千个成对样例，(b) 任务窄而可重复，以及 (c) 你需要快速推理。在通用的开放域任务上，扩散模型胜出。

## 交付上线

保存 `outputs/skill-img2img-chooser.md`。这个技能接收一段任务描述、数据可用情况（成对还是无配对、N 个样本），以及延迟/质量预算，然后输出：方案（Pix2Pix、CycleGAN、ControlNet 变体、SDXL + IP-Adapter）、训练数据需求、推理成本，以及评估协议（LPIPS、FID、任务特定指标）。

## 练习

1. **简单。** 修改 `code/main.py`，增加第三个类别。确认 G 仍然把每个类别的噪声映射到正确的模式。
2. **中等。** 在一维设定下，用一种感知风格的损失替换 L1（例如用一个小的冻结 D 充当特征提取器）。它会改变条件分布的锐度吗？
3. **困难。** 在一维设定下勾勒一个 CycleGAN：两个分布、两个生成器、循环损失。证明它能在没有成对数据的情况下学会在两者之间映射。

## 关键术语

| 术语 | 人们怎么说 | 它实际的含义 |
|------|-----------------|-----------------------|
| 条件式 GAN（Conditional GAN） | 「带标签的 GAN」 | G(z, c)、D(x, c)。两个网络都看到条件。 |
| Pix2Pix | 「图到图的 GAN」 | 配对的 cGAN，G 用 U-Net、D 用 PatchGAN，外加 L1 损失。 |
| U-Net | 「带跳跃连接的编码器-解码器」 | 对称的卷积网络；跳跃连接保留高频信息。 |
| PatchGAN | 「局部真实性分类器」 | D 输出逐图块的分数，而非全局分数。 |
| CycleGAN | 「无配对图像翻译」 | 两个 G + 循环一致性损失；无需成对数据。 |
| SPADE | 「GauGAN」 | 用语义图来归一化中间激活；分割到图像。 |
| FiLM | 「逐特征线性调制」 | 由条件给出的逐特征仿射变换；低成本的条件化方式。 |

## 生产笔记：把 Pix2Pix 作为延迟受限的基线

当你拥有成对数据且任务窄（草图 → 渲染、语义图 → 照片、白天 → 夜晚）时，Pix2Pix 的一次性（one-shot）推理在延迟上比扩散模型快一个数量级。生产中的对比通常是：

| 路径 | 步数 | 单卡 L4 上 512² 的典型延迟 |
|------|-------|----------------------------------------|
| Pix2Pix（U-Net 前向） | 1 | ~30 ms |
| SD-Inpaint 或 SD-Img2Img | 20 | ~1.2 s |
| SDXL-Turbo Img2Img | 1-4 | ~0.15-0.35 s |
| ControlNet + SDXL base | 20-30 | ~3-5 s |

在静态批处理中，Pix2Pix 在吞吐量上胜出（每个请求的 FLOPs 相同）。扩散模型在质量和泛化上胜出。现代的做法往往是：为窄任务上线一个 Pix2Pix 风格的蒸馏模型，再用一个扩散模型作为兜底，处理长尾输入。

## 延伸阅读

- [Mirza & Osindero (2014). Conditional Generative Adversarial Nets](https://arxiv.org/abs/1411.1784) —— cGAN 论文。
- [Isola et al. (2017). Image-to-Image Translation with Conditional Adversarial Networks](https://arxiv.org/abs/1611.07004) —— Pix2Pix。
- [Zhu et al. (2017). Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks](https://arxiv.org/abs/1703.10593) —— CycleGAN。
- [Wang et al. (2018). High-Resolution Image Synthesis with Conditional GANs](https://arxiv.org/abs/1711.11585) —— Pix2PixHD。
- [Park et al. (2019). Semantic Image Synthesis with Spatially-Adaptive Normalization](https://arxiv.org/abs/1903.07291) —— SPADE / GauGAN。
- [Miyato & Koyama (2018). cGANs with Projection Discriminator](https://arxiv.org/abs/1802.05637) —— 投影判别器 D。
