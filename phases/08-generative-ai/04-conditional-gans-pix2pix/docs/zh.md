# 条件 GAN 与 Pix2Pix

> 2014-2017 年的第一个重大突破是控制 GAN 生成的内容。附加一个标签、一张图像或一个句子。Pix2Pix 实现了图像版本，并且在狭窄的图像到图像任务上至今仍胜过所有通用文生图模型。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 8 · 03（GAN）、阶段 4 · 06（U-Net）、阶段 3 · 07（CNN）
**时间：** ~75 分钟

## 问题

无条件 GAN 采样任意人脸。用于演示还不错，但在生产中毫无用处。你想要的是：*将草图映射为照片*、*将地图映射为航拍图*、*将白天场景映射为夜晚*、*为灰度图像上色*。在所有这些任务中，你被给定输入图像 `x`，必须输出具有某种语义对应关系的 `y`。每个 `x` 对应许多合理的 `y`。均方误差将它们压成一团。对抗性损失不会，因为"看起来真实"是清晰的。

条件 GAN（Mirza & Osindero, 2014）将条件 `c` 作为输入添加到 `G` 和 `D` 中。Pix2Pix（Isola et al., 2017）对此进行了专门化：条件是完整输入图像，生成器是 U-Net，判别器是基于*补丁*的分类器（PatchGAN），损失是对抗性 + L1。即使在 2026 年，这个配方在狭窄的图像到图像领域也胜过从头训练的文生图模型，因为它在*配对数据*上训练——你恰好拥有所需的信号。

## 概念

![Pix2Pix：U-Net 生成器，PatchGAN 判别器](../assets/pix2pix.svg)

**条件 G。** `G(x, z) → y`。在 Pix2Pix 中，`z` 是 G 内部的 dropout（没有输入噪声——Isola 发现显式噪声被忽略了）。

**条件 D。** `D(x, y) → [0, 1]`。输入是*配对*（条件，输出）。这是关键区别：D 必须判断 `y` 是否与 `x` 一致，而不仅仅是 `y` 看起来真实。

**U-Net 生成器。** 带有跨瓶颈的跳跃连接的编码器-解码器。对于输入和输出共享底层结构（边缘、轮廓）的任务至关重要。没有跳跃连接，高频细节就会消失。

**PatchGAN 判别器。** D 不输出单一的真/假分数，而是输出一个 `N×N` 的网格，其中每个单元判断一个约 70×70 像素的感受野。取平均值。这是一个马尔可夫随机场假设：真实性是局部的。训练更快、参数更少、输出更清晰。

**损失。**

```
loss_G = -log D(x, G(x)) + λ · ||y - G(x)||_1
loss_D = -log D(x, y) - log (1 - D(x, G(x)))
```

L1 项稳定训练，将 G 推向已知目标。L1 比 L2 给出更清晰的边缘（中位数，而非均值）。`λ = 100` 是 Pix2Pix 的默认值。

## CycleGAN——当你没有配对时

Pix2Pix 需要配对 `(x, y)` 数据。CycleGAN（Zhu et al., 2017）以一个额外损失为代价放弃了这一要求：*循环一致性*损失。两个生成器 `G: X → Y` 和 `F: Y → X`。训练它们使得 `F(G(x)) ≈ x` 和 `G(F(y)) ≈ y`。这让你可以在没有配对示例的情况下将马转换为斑马、夏天转换为冬天。

到 2026 年，无配对图像到图像转换主要通过扩散（ControlNet、IP-Adapter）而不是 CycleGAN 完成，但循环一致性思想几乎存在于每一篇无配对域自适应论文中。

## 动手实现

`code/main.py` 在 1-D 数据上实现了一个微型条件 GAN。条件 `c` 是一个类别标签（0 或 1）。任务：为给定类别从条件分布中生成一个样本。

### 步骤 1：将条件附加到 G 和 D 的输入

```python
def G(z, c, params):
    return mlp(concat([z, one_hot(c)]), params)

def D(x, c, params):
    return mlp(concat([x, one_hot(c)]), params)
```

One-hot 编码是最简单的方式。更大的模型使用学习嵌入、FiLM 调制或交叉注意力。

### 步骤 2：训练条件模型

```python
for step in range(steps):
    x, c = sample_real_conditional()
    noise = sample_noise()
    update_D(x_real=x, x_fake=G(noise, c), c=c)
    update_G(noise, c)
```

生成器必须匹配*给定条件下*的真实分布，而不是边缘分布。

### 步骤 3：按类别验证输出

```python
for c in [0, 1]:
    samples = [G(noise, c) for noise in batch]
    mean_c = mean(samples)
    assert_near(mean_c, real_mean_for_class_c)
```

## 陷阱

- **条件被忽略。** G 学会边缘化，D 从不惩罚，因为条件信号弱。修复：更积极地条件化 D（早期层，不仅仅是后期），使用投影判别器（Miyato & Koyama 2018）。
- **L1 权重太低。** G 漂移到任意的看起来真实的输出，而不是忠实的结果。对于 Pix2Pix 风格的任务，从 λ≈100 开始。
- **L1 权重太高。** G 产生模糊输出，因为 L1 仍然是 L_p 范数。训练稳定后逐渐降低。
- **D 中的真实标签泄露。** 将 `(x, y)` 连接为 D 的输入，而不仅仅是 `y`。没有这个，D 无法检查一致性。
- **每类模式坍缩。** 每个类别可以独立坍缩。运行按类别的多样性检查。

## 应用

2026 年图像到图像任务的现状：

| 任务 | 最佳方法 |
|------|---------------|
| 草图 → 照片，同域，配对数据 | Pix2Pix / Pix2PixHD（仍然快速，仍然清晰） |
| 草图 → 照片，无配对 | 带有 Scribble 条件模型的 ControlNet |
| 语义分割 → 照片 | SPADE / GauGAN2 或 SD + ControlNet-Seg |
| 风格迁移 | 带有 IP-Adapter 或 LoRA 的扩散；GAN 方法是遗留方案 |
| 深度 → 照片 | 基于 Stable Diffusion 的 ControlNet-Depth |
| 超分辨率 | Real-ESRGAN（GAN）、ESRGAN-Plus 或 SD-Upscale（扩散） |
| 上色 | ColTran、基于扩散的上色器或 Pix2Pix-color |
| 白天 → 夜晚、季节、天气 | CycleGAN 或基于 ControlNet 的方法 |

Pix2Pix 在以下情况下仍然是正确的工具：（a）你有数千个配对示例，（b）任务是狭窄且可重复的，以及（c）你需要快速推理。在通用开放域任务上，扩散胜出。

## 交付

保存为 `outputs/skill-img2img-chooser.md`。技能接受任务描述、数据可用性（配对 vs 无配对、N 个样本）和延迟/质量预算，然后输出：方法（Pix2Pix、CycleGAN、ControlNet 变体、SDXL + IP-Adapter）、训练数据需求、推理成本以及评估方案（LPIPS、FID、任务特定）。

## 练习

1. **简单。** 修改 `code/main.py` 添加第三类。确认 G 仍然将每个类别的噪声映射到正确的模式。
2. **中等。** 在 1-D 设置中将 L1 替换为感知风格损失（例如一个小的冻结 D 作为特征提取器）。它会改变条件分布的清晰度吗？
3. **困难。** 在 1-D 设置中勾勒一个 CycleGAN：两个分布、两个生成器、循环损失。展示它学习在无配对数据的情况下在两者之间映射。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|-----------------|-----------------------|
| Conditional GAN | "带标签的 GAN" | G(z, c)，D(x, c)。两个网络都看到条件。 |
| Pix2Pix | "图像到图像 GAN" | 配对的 cGAN，带 U-Net G 和 PatchGAN D + L1 损失。 |
| U-Net | "带跳跃连接的编码器-解码器" | 对称卷积网络；跳跃连接保留高频信息。 |
| PatchGAN | "局部真实性分类器" | D 输出每个补丁的分数而不是全局分数。 |
| CycleGAN | "无配对图像转换" | 两个 G + 循环一致性损失；无配对数据。 |
| SPADE | "GauGAN" | 用语义图归一化中间激活；分割到图像。 |
| FiLM | "特征级线性调制" | 来自条件的逐特征仿射变换；廉价的条件化。 |

## 生产说明：作为延迟受限基线的 Pix2Pix

当你拥有配对数据和狭窄任务（草图 → 渲染、语义图 → 照片、白天 → 夜晚）时，Pix2Pix 的一次性推理在延迟上比扩散快一个数量级。生产比较通常是：

| 路径 | 步数 | 单个 L4 上 512² 的典型延迟 |
|------|-------|----------------------------------------|
| Pix2Pix（U-Net 前向） | 1 | ~30 ms |
| SD-Inpaint 或 SD-Img2Img | 20 | ~1.2 s |
| SDXL-Turbo Img2Img | 1-4 | ~0.15-0.35 s |
| ControlNet + SDXL base | 20-30 | ~3-5 s |

Pix2Pix 在静态批处理中胜出（每个请求的 FLOPs 相同）。扩散在质量和泛化上胜出。现代做法通常是针对狭窄任务部署 Pix2Pix 风格的蒸馏模型，并为尾部输入提供扩散后备方案。

## 延伸阅读

- [Mirza & Osindero (2014). Conditional Generative Adversarial Nets](https://arxiv.org/abs/1411.1784) — cGAN 论文。
- [Isola et al. (2017). Image-to-Image Translation with Conditional Adversarial Networks](https://arxiv.org/abs/1611.07004) — Pix2Pix。
- [Zhu et al. (2017). Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks](https://arxiv.org/abs/1703.10593) — CycleGAN。
- [Wang et al. (2018). High-Resolution Image Synthesis with Conditional GANs](https://arxiv.org/abs/1711.11585) — Pix2PixHD。
- [Park et al. (2019). Semantic Image Synthesis with Spatially-Adaptive Normalization](https://arxiv.org/abs/1903.07291) — SPADE / GauGAN。
- [Miyato & Koyama (2018). cGANs with Projection Discriminator](https://arxiv.org/abs/1802.05637) — 投影 D。
