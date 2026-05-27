# 条件GAN与Pix2Pix

> 2014-2017 年的第一个重大突破是控制 GAN 的生成内容。可以附加一个标签、一张图像或一个句子。Pix2Pix 实现了图像版本，并且在狭窄的图像到图像任务上至今仍优于所有通用的文生图模型。

**类型：** 构建
**语言：** Python
**先决条件：** 阶段 8 · 03（生成对抗网络 GAN），阶段 4 · 06（U-Net），阶段 3 · 07（卷积神经网络 CNN）
**时间：** 约 75 分钟

## 问题

无条件 GAN 生成任意人脸。用于演示还可以，但在生产中毫无用处。你想要的是：*将草图映射为照片*、*将地图映射为航拍图*、*将白天的场景映射为夜晚*、*为灰度图像着色*。在所有这些任务中，你都会获得一个输入图像 `x`，并且必须输出具有某种语义对应关系的 `y`。对于每个 `x`，有许多可能的 `y`。均方误差（Mean-squared error）会将它们模糊成一团。对抗损失不会这样，因为“看起来真实”是清晰的。

条件生成对抗网络（Conditional GAN，Mirza & Osindero，2014）将条件 `c` 作为输入添加到 `G` 和 `D` 中。Pix2Pix（Isola 等，2017）进一步专门化：条件是一张完整的输入图像，生成器是 U-Net，判别器是基于*块*的分类器（PatchGAN），损失是对抗损失 + L1 损失。即使在 2026 年，这一组合在狭窄的图像到图像领域仍然优于从头训练的文生图模型，因为它是在*配对数据*上训练的——你恰好拥有所需的信号。

## 概念

![Pix2Pix：U-Net 生成器，PatchGAN 判别器](../assets/pix2pix.svg)

**条件 G。** `G(x, z) → y`。在 Pix2Pix 中，`z` 是 G 内部的 dropout（没有输入噪声——Isola 发现显式噪声会被忽略）。

**条件 D。** `D(x, y) → [0, 1]`。输入是*一对*（条件，输出）。这是关键区别：D 必须判断 `y` 是否与 `x` 一致，而不仅仅是 `y` 看起来真实。

**U-Net 生成器。** 带有跨瓶颈跳跃连接（skip connections）的编码器-解码器。对于输入和输出共享低级结构（边缘、轮廓）的任务至关重要。没有跳跃连接，高频细节就会消失。

**PatchGAN 判别器。** 不输出单一的真假分数，而是输出一个 `N×N` 的网格，其中每个单元格判断约 70×70 像素的感受野。然后取平均。这是一种马尔可夫随机场假设：真实性是局部的。训练速度更快，参数更少，输出更锐利。

**损失。**

```
loss_G = -log D(x, G(x)) + λ · ||y - G(x)||_1
loss_D = -log D(x, y) - log (1 - D(x, G(x)))
```

L1 项稳定训练并推动 G 向已知目标靠近。L1 比 L2 产生更锐利的边缘（中位数而非均值）。`λ = 100` 是 Pix2Pix 的默认值。

## CycleGAN——当你没有配对数据时

Pix2Pix 需要配对的 `(x, y)` 数据。CycleGAN（Zhu 等，2017）去除了这一要求，但增加了一个额外损失：*循环一致性*损失。两个生成器 `G: X → Y` 和 `F: Y → X`。训练它们使得 `F(G(x)) ≈ x` 且 `G(F(y)) ≈ y`。这让你无需配对示例即可将马翻译为斑马、夏天翻译为冬天。

在 2026 年，非配对的图像到图像任务主要通过扩散模型（ControlNet、IP-Adapter）完成，而非 CycleGAN，但循环一致性的思想几乎存在于每一篇非配对领域自适应论文中。

## 构建它

`code/main.py` 在 1-D 数据上实现了一个小型条件 GAN。条件 `c` 是一个类别标签（0 或 1）。任务：针对给定类别从条件分布中生成样本。

### 步骤 1：将条件附加到 G 和 D 的输入

```python
def G(z, c, params):
    return mlp(concat([z, one_hot(c)]), params)

def D(x, c, params):
    return mlp(concat([x, one_hot(c)]), params)
```

独热编码（One-hot encoding）是最简单的方式。更大的模型使用学习到的嵌入（learned embeddings）、FiLM 调制或交叉注意力（cross-attention）。

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

## 陷阱

- **条件被忽略。** G 学会了边缘化，D 从未惩罚，因为条件信号太弱。解决方法：更积极地使用条件（早期层，不仅仅是后期层），使用投影判别器（Projection Discriminator，Miyato & Koyama 2018）。
- **L1 权重太低。** G 漂移到任意看似真实的输出，而不是忠实的输出。对于 Pix2Pix 风格的任务，从 λ≈100 开始。
- **L1 权重太高。** G 产生模糊的输出，因为 L1 仍然是一个 L_p 范数。训练稳定后逐渐降低。
- **D 中的真实标签泄漏。** 将 `(x, y)` 拼接作为 D 的输入，而不仅仅是 `y`。没有这个，D 无法检查一致性。
- **每个类别的模式崩溃。** 每个类别可能独立崩溃。运行类别条件多样性检查。

## 使用它

2026 年图像到图像任务的状态：

| 任务 | 最佳方案 |
|------|----------|
| 草图→照片，同领域，配对数据 | Pix2Pix / Pix2PixHD（仍然快速，仍然锐利） |
| 草图→照片，非配对 | 使用潦草涂鸦（Scribble）条件模型的 ControlNet |
| 语义分割→照片 | SPADE / GauGAN2 或 SD + ControlNet-Seg |
| 风格迁移 | 使用 IP-Adapter 或 LoRA 的扩散模型；GAN 方法已过时 |
| 深度图→照片 | 基于 Stable Diffusion 的 ControlNet-Depth |
| 超分辨率 | Real-ESRGAN（GAN）、ESRGAN-Plus 或 SD-Upscale（扩散模型） |
| 着色 | ColTran、基于扩散模型的着色器或 Pix2Pix-color |
| 白天→夜晚、季节、天气 | CycleGAN 或基于 ControlNet 的方法 |

Pix2Pix 仍然是正确的工具，当 (a) 你有数千个配对示例，(b) 任务狭窄且可重复，(c) 你需要快速推理时。在通用的开放领域任务中，扩散模型获胜。

## 部署它

保存 `outputs/skill-img2img-chooser.md`。技能接受任务描述、数据可用性（配对 vs 非配对、N 个样本）和延迟/质量预算，然后输出：方法（Pix2Pix、CycleGAN、ControlNet 变体、SDXL + IP-Adapter）、训练数据需求、推理成本和评估协议（LPIPS、FID、任务特定指标）。

## 练习

1. **简单。** 修改 `code/main.py` 添加第三个类别。确认 G 仍然将每个类别的噪声映射到正确的模式。
2. **中等。** 在 1-D 设置中将 L1 替换为感知风格损失（例如一个小型冻结的 D 作为特征提取器）。它是否改变了条件分布的锐利度？
3. **困难。** 在 1-D 设置中勾勒出 CycleGAN：两个分布、两个生成器、循环损失。展示它如何在没有配对数据的情况下学习两者之间的映射。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|----------|
| 条件GAN（Conditional GAN） | "带标签的GAN" | G(z, c)，D(x, c)。两个网络都看到条件。 |
| Pix2Pix | "图像到图像GAN" | 带配对数据的cGAN，使用U-Net G、PatchGAN D和L1损失。 |
| U-Net | "带跳跃连接的编码器-解码器" | 对称卷积网络；跳跃连接保留高频信息。 |
| PatchGAN | "局部真实性分类器" | D输出每个块的分数而非全局分数。 |
| CycleGAN | "非配对图像翻译" | 两个G + 循环一致性损失；无需配对数据。 |
| SPADE | "GauGAN" | 用语义图归一化中间激活；从分割生成图像。 |
| FiLM | "特征级线性调制" | 基于条件的逐特征仿射变换；低成本的条件注入方式。 |

## 生产说明：Pix2Pix 作为延迟受限的基线

当你拥有配对数据和一个狭窄的任务（草图→渲染、语义图→照片、白天→夜晚）时，Pix2Pix 的单次推理在延迟上比扩散模型快一个数量级。生产中的比较通常是：

| 路径 | 步数 | 单块L4上512²分辨率下的典型延迟 |
|------|------|--------------------------------|
| Pix2Pix（U-Net前向） | 1 | ~30 ms |
| SD-Inpaint 或 SD-Img2Img | 20 | ~1.2 s |
| SDXL-Turbo Img2Img | 1-4 | ~0.15-0.35 s |
| ControlNet + SDXL base | 20-30 | ~3-5 s |

Pix2Pix 在静态批量处理中胜出（每个请求的FLOPs相同）。扩散模型在质量和泛化性上胜出。现代的常见做法是：为狭窄任务部署一个 Pix2Pix 风格的蒸馏模型，并为尾部输入提供扩散模型后备。

## 进一步阅读

- [Mirza & Osindero (2014). Conditional Generative Adversarial Nets](https://arxiv.org/abs/1411.1784) — cGAN 论文。
- [Isola et al. (2017). Image-to-Image Translation with Conditional Adversarial Networks](https://arxiv.org/abs/1611.07004) — Pix2Pix。
- [Zhu et al. (2017). Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks](https://arxiv.org/abs/1703.10593) — CycleGAN。
- [Wang et al. (2018). High-Resolution Image Synthesis with Conditional GANs](https://arxiv.org/abs/1711.11585) — Pix2PixHD。
- [Park et al. (2019). Semantic Image Synthesis with Spatially-Adaptive Normalization](https://arxiv.org/abs/1903.07291) — SPADE / GauGAN。
- [Miyato & Koyama (2018). cGANs with Projection Discriminator](https://arxiv.org/abs/1802.05637) — 投影判别器。