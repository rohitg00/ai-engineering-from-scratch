# Conditional GAN 与 Pix2Pix

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2014–2017 年最大的一次解锁，是让人能控制 GAN 生成什么。挂个标签、挂张图、挂句话都行。Pix2Pix 做的就是图像那条线，直到今天它在窄域 image-to-image 任务上仍然能吊打通用的 text-to-image 模型。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 06 (U-Net), Phase 3 · 07 (CNNs)
**Time:** ~75 minutes

## 问题（The Problem）

无条件 GAN 采样的是任意人脸。做 demo 还行，上生产毫无用处。你想要的是：*把草图映射成照片*、*把地图映射成航拍图*、*把白天场景映射成夜景*、*把灰度图上色*。这些任务里，你拿到一张输入图 `x`，要输出一张和它有语义对应的 `y`。同一个 `x` 对应着许多看起来都合理的 `y`。均方误差（MSE）会把它们全糊成一团，而对抗 loss 不会，因为「看起来真」这件事是锐利的。

Conditional GAN（Mirza & Osindero, 2014）在 `G` 和 `D` 的输入里都加上一个条件 `c`。Pix2Pix（Isola et al., 2017）把这个思路具体化了：条件是一整张输入图，generator 是 U-Net，discriminator 是一个 *基于 patch* 的分类器（PatchGAN），loss 是对抗损失加 L1。这个配方（recipe，配方）即便到 2026 年，在窄域 image-to-image 上仍然能压过从零训练的 text-to-image 模型——因为它训在 *配对数据* 上，你拿到的就是任务真正需要的那种监督信号。

## 概念（The Concept）

![Pix2Pix：U-Net generator，PatchGAN discriminator](../assets/pix2pix.svg)

**条件 G。** `G(x, z) → y`。Pix2Pix 里的 `z` 是 G 内部的 dropout（不显式喂噪声——Isola 发现显式噪声会被 G 直接忽略）。

**条件 D。** `D(x, y) → [0, 1]`。输入是 *(条件, 输出)* 这一对。这是关键差别：D 必须判断 `y` 是否和 `x` 在语义上一致，而不只是判断 `y` 看起来像不像真。

**U-Net generator。** encoder-decoder 结构，跨过 bottleneck 拉一组 skip connection。这对输入和输出共享底层结构（边、轮廓）的任务至关重要。没有 skip，高频细节就消失了。

**PatchGAN discriminator。** D 不输出一个 real/fake 标量分数，而是输出一个 `N×N` 的网格，每个格子负责判断大约 70×70 像素的感受野，再取平均。这其实是一个 Markov 随机场假设：真实性是局部的。这样训练快得多，参数更少，输出也更锐利。

**Loss。**

```
loss_G = -log D(x, G(x)) + λ · ||y - G(x)||_1
loss_D = -log D(x, y) - log (1 - D(x, G(x)))
```

L1 项稳定了训练，并且把 G 拉向已知目标。L1 比 L2 边缘更锐（L1 求的是中位数，不是均值）。Pix2Pix 默认 `λ = 100`。

## CycleGAN——没有配对数据怎么办（CycleGAN — when you don't have pairs）

Pix2Pix 需要成对的 `(x, y)` 数据。CycleGAN（Zhu et al., 2017）放弃了这个要求，代价是多加一项 loss：*循环一致性*（cycle consistency）loss。两个 generator：`G: X → Y` 和 `F: Y → X`，训练它们使 `F(G(x)) ≈ x` 且 `G(F(y)) ≈ y`。这样你就能把马翻译成斑马、夏天翻译成冬天，全程不需要配对样本。

到 2026 年，无配对的 image-to-image 大多走 diffusion 路线（ControlNet、IP-Adapter），而不是 CycleGAN，但循环一致性这个 idea 几乎在每一篇无配对域适应论文里都还活着。

## 动手实现（Build It）

`code/main.py` 在 1-D 数据上实现了一个迷你 conditional GAN。条件 `c` 是类标签（0 或 1）。任务是：在给定类的条件下，从对应的条件分布里采一个样本。

### 第 1 步：把条件拼到 G 和 D 的输入里

```python
def G(z, c, params):
    return mlp(concat([z, one_hot(c)]), params)

def D(x, c, params):
    return mlp(concat([x, one_hot(c)]), params)
```

One-hot 是最简单的做法。更大的模型会用学习得到的 embedding、FiLM 调制、或者 cross-attention。

### 第 2 步：条件训练

```python
for step in range(steps):
    x, c = sample_real_conditional()
    noise = sample_noise()
    update_D(x_real=x, x_fake=G(noise, c), c=c)
    update_G(noise, c)
```

generator 必须匹配 *给定条件下* 的真实分布，而不是边缘分布。

### 第 3 步：逐类验证输出

```python
for c in [0, 1]:
    samples = [G(noise, c) for noise in batch]
    mean_c = mean(samples)
    assert_near(mean_c, real_mean_for_class_c)
```

## 坑（Pitfalls）

- **条件被忽略。** G 学成边缘分布，D 又因为条件信号太弱而懒得罚。修法：把 D 的条件注入做得更激进（早层就喂，而不是只在末端喂），或者用 projection discriminator（Miyato & Koyama 2018）。
- **L1 权重太低。** G 漂向「看起来真但不忠于输入」的输出。Pix2Pix 风格任务从 λ≈100 起步。
- **L1 权重太高。** 输出变模糊，因为 L1 终归还是 L_p 范数。训练稳了之后退火往下降。
- **D 只看 ground-truth。** 把 `(x, y)` 拼起来作为 D 的输入，而不是只喂 `y`。否则 D 没法检查一致性。
- **逐类 mode collapse。** 每个类都可能独立 collapse。要做按类的多样性检查。

## 用起来（Use It）

2026 年 image-to-image 任务的现状：

| 任务 | 最优做法 |
|------|---------------|
| Sketch → photo，同域，配对数据 | Pix2Pix / Pix2PixHD（依然快、依然锐） |
| Sketch → photo，无配对 | ControlNet + Scribble 条件模型 |
| 语义分割 → 照片 | SPADE / GauGAN2，或 SD + ControlNet-Seg |
| 风格迁移 | Diffusion + IP-Adapter 或 LoRA；GAN 路线已是 legacy |
| Depth → photo | ControlNet-Depth on Stable Diffusion |
| 超分（super-resolution） | Real-ESRGAN（GAN）、ESRGAN-Plus，或 SD-Upscale（diffusion） |
| 上色 | ColTran、基于 diffusion 的上色器，或 Pix2Pix-color |
| 白天 → 夜晚、四季、天气 | CycleGAN 或基于 ControlNet 的方案 |

Pix2Pix 仍然是合适工具的场景：(a) 你有上千个配对样本，(b) 任务窄而重复，(c) 你需要快速推理（inference）。在通用开放域任务上，diffusion 才是赢家。

## 上线部署（Ship It）

保存到 `outputs/skill-img2img-chooser.md`。这个 skill 接收一个任务描述、数据可用性（配对 vs 无配对、样本数 N）和延迟/质量预算，然后输出：方案选择（Pix2Pix、CycleGAN、某种 ControlNet 变体、SDXL + IP-Adapter）、训练数据需求、推理成本、以及评估协议（LPIPS、FID、任务专属指标）。

## 练习（Exercises）

1. **Easy。** 改 `code/main.py`，加第三个类。确认 G 仍然能把每个类的噪声映射到正确的 mode。
2. **Medium。** 在 1-D 设置里把 L1 换成感知风格的 loss（比如让一个小的冻结 D 当 feature extractor）。条件分布的锐度会变吗？
3. **Hard。** 在 1-D 设置里把 CycleGAN 草拟出来：两个分布、两个 generator、cycle loss。证明在没有配对数据的情况下它能学会两边互译。

## 关键术语（Key Terms）

| Term | 大家怎么说 | 实际是什么 |
|------|-----------------|-----------------------|
| Conditional GAN | "带标签的 GAN" | G(z, c)、D(x, c)，两个网络都看到条件。 |
| Pix2Pix | "图到图 GAN" | 配对数据上的 cGAN，U-Net G + PatchGAN D + L1 loss。 |
| U-Net | "带 skip 的 encoder-decoder" | 对称卷积网络；skip 保住高频。 |
| PatchGAN | "局部真实性分类器" | D 输出按 patch 的分数而不是全局分数。 |
| CycleGAN | "无配对图像翻译" | 两个 G + 循环一致性 loss；不需要配对数据。 |
| SPADE | "GauGAN" | 用语义图归一化中间激活；语义图到照片。 |
| FiLM | "feature-wise linear modulation" | 由条件给出的逐特征仿射变换；廉价的条件注入。 |

## 生产备忘：Pix2Pix 作为延迟敏感场景的 baseline（Production note: Pix2Pix as a latency-bound baseline）

当你手上有配对数据，且任务很窄（sketch → render、语义图 → 照片、day → night），Pix2Pix 的一次性推理在延迟上比 diffusion 快一个量级。生产里典型的对比是这样：

| 路径 | 步数 | 单张 L4 上 512² 的典型延迟 |
|------|-------|----------------------------------------|
| Pix2Pix（U-Net 前向传播一次） | 1 | ~30 ms |
| SD-Inpaint 或 SD-Img2Img | 20 | ~1.2 s |
| SDXL-Turbo Img2Img | 1-4 | ~0.15-0.35 s |
| ControlNet + SDXL base | 20-30 | ~3-5 s |

在静态批次场景下 Pix2Pix 吞吐占优（每个请求的 FLOPs 都一样）。Diffusion 在质量和泛化上占优。现在常见的打法是：把窄任务用一个 Pix2Pix 风格的蒸馏模型上线，再保留一个 diffusion 兜底通道用于长尾输入。

## 延伸阅读（Further Reading）

- [Mirza & Osindero (2014). Conditional Generative Adversarial Nets](https://arxiv.org/abs/1411.1784) — cGAN 原论文。
- [Isola et al. (2017). Image-to-Image Translation with Conditional Adversarial Networks](https://arxiv.org/abs/1611.07004) — Pix2Pix。
- [Zhu et al. (2017). Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks](https://arxiv.org/abs/1703.10593) — CycleGAN。
- [Wang et al. (2018). High-Resolution Image Synthesis with Conditional GANs](https://arxiv.org/abs/1711.11585) — Pix2PixHD。
- [Park et al. (2019). Semantic Image Synthesis with Spatially-Adaptive Normalization](https://arxiv.org/abs/1903.07291) — SPADE / GauGAN。
- [Miyato & Koyama (2018). cGANs with Projection Discriminator](https://arxiv.org/abs/1802.05637) — projection D。
