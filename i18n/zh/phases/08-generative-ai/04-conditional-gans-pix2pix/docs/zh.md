# 条件 GAN 与 Pix2Pix

> 2014–2017 年的第一个重大突破是控制 GAN 生成的内容。附加一个标签、一张图像或一句话。Pix2Pix 实现了图像版本，并且在狭窄的图像到图像任务上至今仍胜过所有通用文本到图像模型。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 03（GAN）、Phase 4 · 06（U-Net）、Phase 3 · 07（CNN）
**Time:** 约 75 分钟

## 问题所在

无条件 GAN 采样任意人脸。适合演示，不适合生产。你想要的是：*把草图映射为照片*、*把地图映射为航拍照片*、*把白天场景映射为夜晚*、*给灰度图像上色*。在所有这些任务中，你得到一张输入图像 `x`，必须输出与之有某种语义对应关系的 `y`。每个 `x` 有许多合理的 `y`。均方误差会把它们压成模糊一团。对抗损失不会，因为“看起来真实”是锐利的判据。

条件 GAN（Mirza & Osindero, 2014）向 `G` 和 `D` 都添加了一个条件 `c` 作为输入。Pix2Pix（Isola et al., 2017）将其特化：条件是一整张输入图像，生成器是 U-Net，判别器是*基于 patch 的*分类器（PatchGAN），损失是对抗损失 + L1。即使在 2026 年，这一配方在狭窄的图像到图像领域仍然优于从零训练的文本到图像模型，因为它是在*成对数据*上训练的——你恰好拥有所需的信号。

## 核心概念

![Pix2Pix: U-Net generator, PatchGAN discriminator](../assets/pix2pix.svg)

**条件 G。** `G(x, z) → y`。在 Pix2Pix 中，`z` 是 G 内部的 dropout（不使用输入噪声——Isola 发现显式噪声会被忽略）。

**条件 D。** `D(x, y) → [0, 1]`。输入是*成对的*（条件，输出）。这是关键区别：D 必须判断 `y` 是否与 `x` 一致，而不仅仅是判断 `y` 是否看起来真实。

**U-Net 生成器。** 在瓶颈处带有跳跃连接的编码器-解码器结构。对于输入和输出共享低层结构（边缘、轮廓）的任务至关重要。没有这些跳跃连接，高频细节会消失。

**PatchGAN 判别器。** D 不输出单一的真实/伪造分数，而是输出一个 `N×N` 网格，其中每个单元格判断约 70×70 像素的感受野。取平均值。这基于马尔可夫随机场假设：真实性是局部的。训练快得多，参数更少，输出更锐利。

**损失。**

```
loss_G = -log D(x, G(x)) + λ · ||y - G(x)||_1
loss_D = -log D(x, y) - log (1 - D(x, G(x)))
```

L1 项稳定训练，并把 G 推向已知目标。L1 比 L2 给出更锐利的边缘（中位数而非均值）。`λ = 100` 是 Pix2Pix 的默认设置。

## CycleGAN——当你没有成对数据时

Pix2Pix 需要成对的 `(x, y)` 数据。CycleGAN（Zhu et al., 2017）去掉了这一要求，代价是增加一个损失：*循环一致性*损失。两个生成器 `G: X → Y` 和 `F: Y → X`。训练它们使得 `F(G(x)) ≈ x` 且 `G(F(y)) ≈ y`。这让你无需成对样本就能把马翻译成斑马、把夏天翻译成冬天。

在 2026 年，非成对的图像到图像转换大多通过扩散模型（ControlNet、IP-Adapter）而非 CycleGAN 实现，但循环一致性的思想几乎存在于每一篇非成对域自适应论文中。

```figure
gx-patchgan
```

## 动手实现

`code/main.py` 在一维数据上实现一个微型的条件 GAN。条件 `c` 是类别标签（0 或 1）。任务：针对给定类别，从条件分布中产生一个样本。

### 步骤 1：将条件拼接到 G 和 D 的输入

```python
def G(z, c, params):
    return mlp(concat([z, one_hot(c)]), params)

def D(x, c, params):
    return mlp(concat([x, one_hot(c)]), params)
```

One-hot 编码是最简单的方式。更大的模型使用可学习的嵌入、FiLM 调制或交叉注意力。

### 步骤 2：训练条件模型

```python
for step in range(steps):
    x, c = sample_real_conditional()
    noise = sample_noise()
    update_D(x_real=x, x_fake=G(noise, c), c=c)
    update_G(noise, c)
```

生成器必须匹配*给定条件下的*真实分布，而不是边缘分布。

### 步骤 3：验证每个类别的输出

```python
for c in [0, 1]:
    samples = [G(noise, c) for noise in batch]
    mean_c = mean(samples)
    assert_near(mean_c, real_mean_for_class_c)
```

## 常见陷阱

- **条件被忽略。** G 学会边缘化，而 D 从不惩罚，因为条件信号太弱。修复：更激进地将条件输入 D（在早期层，而不仅仅是后期层），使用投影判别器（projection discriminator，Miyato & Koyama 2018）。
- **L1 权重过低。** G 漂移到任意看起来真实的输出，而非忠实于输入的输出。Pix2Pix 风格的任务从 λ≈100 开始。
- **L1 权重过高。** G 产出模糊的输出，因为 L1 仍是 L_p 范数。训练稳定后逐步退火降低。
- **D 中的真值泄漏。** 将 `(x, y)` 拼接为 D 的输入，而不仅仅是 `y`。否则 D 无法检查一致性。
- **每个类别的模式坍塌。** 各个类别可能独立坍塌。运行类别条件下的多样性检查。

## 使用场景

2026 年图像到图像任务的现状：

| 任务 | 最佳方法 |
|------|---------------|
| 草图 → 照片，同域，成对数据 | Pix2Pix / Pix2PixHD（依然快速，依然锐利） |
| 草图 → 照片，非成对 | ControlNet 配合 Scribble 条件模型 |
| 语义分割 → 照片 | SPADE / GauGAN2 或 SD + ControlNet-Seg |
| 风格迁移 | 扩散模型配合 IP-Adapter 或 LoRA；GAN 方法已属遗留技术 |
| 深度图 → 照片 | 在 Stable Diffusion 之上使用 ControlNet-Depth |
| 超分辨率 | Real-ESRGAN（GAN）、ESRGAN-Plus 或 SD-Upscale（扩散） |
| 上色 | ColTran、基于扩散的上色器或 Pix2Pix-color |
| 白天 → 夜晚、季节、天气 | CycleGAN 或基于 ControlNet 的方法 |

当满足以下条件时，Pix2Pix 仍是正确的工具：(a) 你拥有数千个成对样本，(b) 任务狭窄且可重复，(c) 你需要快速推理。在通用的开放域任务上，扩散模型胜出。

## 上线部署

保存 `outputs/skill-img2img-chooser.md`。该技能接收任务描述、数据可用性（成对 vs 非成对、样本数 N）和延迟/质量预算，然后输出：方法（Pix2Pix、CycleGAN、ControlNet 变体、SDXL + IP-Adapter）、训练数据需求、推理成本以及评估协议（LPIPS、FID、任务特定指标）。

## 练习

1. **简单。** 修改 `code/main.py` 以添加第三个类别。确认 G 仍将每个类别的噪声映射到正确的模式。
2. **中等。** 在一维场景中用感知风格损失替代 L1（例如用一个小的冻结 D 作为特征提取器）。它会改变条件分布的锐利程度吗？
3. **困难。** 在一维场景中勾勒 CycleGAN：两个分布、两个生成器、循环损失。证明它能在没有成对数据的情况下学会在两者之间映射。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Conditional GAN | “带标签的 GAN” | G(z, c)、D(x, c)。两个网络都看到条件。 |
| Pix2Pix | “图像到图像的 GAN” | 使用 U-Net G 和 PatchGAN D + L1 损失的成对 cGAN。 |
| U-Net | “带跳跃连接的编码器-解码器” | 对称卷积网络；跳跃连接保留高频信息。 |
| PatchGAN | “局部真实性分类器” | D 输出每个 patch 的分数而非全局分数。 |
| CycleGAN | “非成对图像翻译” | 两个 G + 循环一致性损失；无需成对数据。 |
| SPADE | “GauGAN” | 用语义图对中间激活进行归一化；分割到图像。 |
| FiLM | “特征级线性调制” | 由条件得到的逐特征仿射变换；廉价的条件机制。 |

## 生产提示：Pix2Pix 作为延迟受限的基线

当你拥有成对数据且任务狭窄（草图 → 渲染、语义图 → 照片、白天 → 夜晚）时，Pix2Pix 的一次性推理在延迟上比扩散模型快一个数量级。生产环境的对比通常是：

| 路径 | 步数 | 单张 L4 上 512² 的典型延迟 |
|------|-------|----------------------------------------|
| Pix2Pix（U-Net 前向） | 1 | ~30 ms |
| SD-Inpaint 或 SD-Img2Img | 20 | ~1.2 s |
| SDXL-Turbo Img2Img | 1-4 | ~0.15-0.35 s |
| ControlNet + SDXL base | 20-30 | ~3-5 s |

Pix2Pix 在静态批处理中的吞吐量上胜出（每个请求的 FLOPs 相同）。扩散模型在质量和泛化上胜出。现代的常见做法是为狭窄任务部署一个 Pix2Pix 风格的蒸馏模型，并为长尾输入准备一个扩散模型作为后备。

## 延伸阅读

- [Mirza & Osindero (2014). Conditional Generative Adversarial Nets](https://arxiv.org/abs/1411.1784) —— cGAN 论文。
- [Isola et al. (2017). Image-to-Image Translation with Conditional Adversarial Networks](https://arxiv.org/abs/1611.07004) —— Pix2Pix。
- [Zhu et al. (2017). Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks](https://arxiv.org/abs/1703.10593) —— CycleGAN。
- [Wang et al. (2018). High-Resolution Image Synthesis with Conditional GANs](https://arxiv.org/abs/1711.11585) —— Pix2PixHD。
- [Park et al. (2019). Semantic Image Synthesis with Spatially-Adaptive Normalization](https://arxiv.org/abs/1903.07291) —— SPADE / GauGAN。
- [Miyato & Koyama (2018). cGANs with Projection Discriminator](https://arxiv.org/abs/1802.05637) —— 投影判别器。