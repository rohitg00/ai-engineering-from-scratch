# 03 · GAN——生成器与判别器

> Goodfellow 在 2014 年的妙招是彻底绕开密度估计。两个网络：一个负责造假，一个负责抓假。它们彼此对抗，直到假货与真品再也无法区分。这套办法理论上不该奏效，实践中也常常失灵。但一旦成功，在窄域任务上，它生成的样本至今仍是文献里最锐利的。

**类型：** 实战（Build）
**语言：** Python
**前置：** 阶段 3 · 02（反向传播）、阶段 3 · 08（优化器）、阶段 8 · 02（VAE）
**时长：** 约 75 分钟

## 问题所在

「变分自编码器（VAE）」生成的样本之所以模糊，是因为它的「均方误差（MSE）」解码器损失对于*均值*图像是贝叶斯最优的——而许多看似合理的数字取均值后，得到的就是一个模糊的数字。你想要的是一个奖励*合理性（plausibility）*的损失，而不是逐像素地逼近某个特定目标。合理性没有闭式解，你只能去学习它。

Goodfellow 的思路是：训练一个分类器 `D(x)` 来区分真实图像和伪造图像；再训练一个生成器 `G(z)` 去骗过 `D`。`G` 的损失信号就是 `D` 当前认为「看起来像真的」的那套标准。随着 `G` 的进步，这个信号也会更新，于是 `G` 始终在追逐一个移动的目标。如果两个网络都收敛，那么 `G` 就在从未写下 `log p(x)` 的情况下，学到了数据分布。

这就是「对抗训练（adversarial training）」。其数学形式是一个极小极大博弈（minimax game）：

```
min_G max_D  E_real[log D(x)] + E_fake[log(1 - D(G(z)))]
```

在 2026 年，GAN 已不再是最先进（SOTA）的生成器（这顶王冠已被扩散模型和流匹配夺走）。但 StyleGAN 2/3 仍是有史以来面部生成最锐利的模型；GAN 判别器被用作扩散训练中的*感知损失（perceptual loss）*；对抗训练还为快速的单步蒸馏（SDXL-Turbo、SD3-Turbo、LCM）提供动力，让实时扩散得以落地。

## 核心概念

〔图：GAN 训练——生成器与判别器的极小极大博弈〕

**生成器 `G(z)`。** 将一个噪声向量 `z ~ N(0, I)` 映射为一个样本 `x̂`。它是一个解码器形状的网络（全连接或转置卷积）。

**判别器 `D(x)`。** 将一个样本映射为一个标量概率（或分数）。真实样本 → 1，伪造样本 → 0。

**损失。** 两次交替更新：

- **训练 `D`：** `loss_D = -[ log D(x) + log(1 - D(G(z))) ]`。在「真=1、假=0」上的二元交叉熵。
- **训练 `G`：** `loss_G = -log D(G(z))`。这是 Goodfellow 采用的*非饱和（non-saturating）*形式（原始的 `log(1 - D(G(z)))` 在 `D` 很自信时会饱和并使梯度消失）。

**训练循环。** 一步 `D`，一步 `G`，如此往复。

**为什么有效。** 如果 `G` 完美匹配了 `p_data`，那么 `D` 的表现不会优于随机猜测，处处输出 0.5；此时 `G` 再也得不到梯度。达到平衡。

**为什么会失败。** 模式坍缩（mode collapse，`G` 找到一个 `D` 无法分类的模式，便永远只造它）、梯度消失（`D` 学得太快，`log D` 饱和）、训练不稳定（学习率、批大小，任何因素都可能导致）。

## 让 GAN 真正可用的各种变体

| 年份 | 创新 | 解决的问题 |
|------|------------|-----|
| 2015 | DCGAN | 卷积/反卷积、批归一化、LeakyReLU——第一个稳定的架构。 |
| 2017 | WGAN、WGAN-GP | 用 Wasserstein 距离 + 梯度惩罚替换 BCE。修复梯度消失。 |
| 2017 | 谱归一化（Spectral normalization） | 对判别器施加 Lipschitz 约束。2026 年的判别器中仍在使用。 |
| 2018 | Progressive GAN | 先训练低分辨率，再逐层添加。首次实现百万像素级结果。 |
| 2019 | StyleGAN / StyleGAN2 | 映射网络 + 自适应实例归一化（AdaIN）。固定域照片级真实感的最先进水平。 |
| 2021 | StyleGAN3 | 无混叠、平移等变——2026 年仍是面部生成的黄金标准。 |
| 2022 | StyleGAN-XL | 条件化、类别感知、更大规模。 |
| 2024 | R3GAN | 以更强的正则化重新打造；无需技巧即可在 1024² 上工作。 |

## 动手实现

`code/main.py` 在一维数据上训练一个微型 GAN：数据是两个高斯分布的混合。生成器和判别器都是单隐藏层的 MLP。我们手工实现前向、反向以及极小极大循环。目标是亲眼看到两种关键的失效模式（模式坍缩 + 梯度消失）是如何发生的。

### 第 1 步：非饱和损失

朴素的 Goodfellow 损失 `log(1 - D(G(z)))`，当 D 高置信地把 G 的伪造品判为假时会趋向于 0。此时 G 的梯度基本为零——G 无法改进。非饱和形式 `-log D(G(z))` 则具有相反的渐近性质：当 D 很自信时它会爆增，从而给 G 一个强信号。

```python
def g_loss(d_fake):
    # 最大化 log D(G(z))  <=>  最小化 -log D(G(z))
    return -sum(math.log(max(p, 1e-8)) for p in d_fake) / len(d_fake)
```

### 第 2 步：每训练一步生成器，就训练一步判别器

```python
for step in range(steps):
    # 训练 D
    real_batch = sample_real(batch_size)
    fake_batch = [G(z) for z in sample_noise(batch_size)]
    update_D(real_batch, fake_batch)

    # 训练 G
    fake_batch = [G(z) for z in sample_noise(batch_size)]  # 新鲜的伪造样本
    update_G(fake_batch)
```

要给 G 用新鲜的伪造样本，否则梯度就过时了。

### 第 3 步：留意模式坍缩

```python
if step % 200 == 0:
    samples = [G(z) for z in sample_noise(500)]
    mode_a = sum(1 for s in samples if s < 0)
    mode_b = 500 - mode_a
    if min(mode_a, mode_b) < 50:
        print("  [!] mode collapse: one mode is starved")
```

典型症状是：两个真实模式中的一个不再被生成。判别器停止修正它，因为它再也不会被当作伪造样本出现。

## 易踩的坑

- **判别器太强。** 把 D 的学习率降低到原来的 1/2 到 1/5，或者添加实例/层噪声。如果 D 的准确率超过 95%，G 就死了。
- **生成器记住了某个模式。** 给 D 的输入加噪声，使用 minibatch-discriminator 层，或者切换到 WGAN-GP。
- **批归一化泄漏统计量。** 真实批次和伪造批次流经同一个 BN 层会混淆它们的统计量。改用实例归一化（instance norm）或谱归一化（spectral norm）。
- **刷 Inception 分数。** FID 和 IS 在样本数较少时噪声很大。评估时使用 ≥10k 个样本。
- **「一次性采样」对条件任务是个谎言。** 你仍然需要 CFG 强度、截断技巧和重采样，才能得到可用的输出。

## 实际运用

2026 年的 GAN 技术栈：

| 场景 | 选择 |
|-----------|------|
| 照片级真实人脸、固定姿态 | StyleGAN3（最锐利、最小巧） |
| 动漫 / 风格化人脸 | StyleGAN-XL 或 Stable Diffusion LoRA |
| 图像到图像的转换 | Pix2Pix / CycleGAN（阶段 8 · 04）或 ControlNet（阶段 8 · 08） |
| 快速单步文生图 | 扩散模型的对抗蒸馏（SDXL-Turbo、SD3-Turbo） |
| 扩散训练器内部的感知损失 | 在图像裁剪块上的小型 GAN 判别器 |
| 任何多模态、开放式的任务 | 别用——改用扩散或流匹配 |

GAN 锐利但狭窄。一旦你的领域开放起来——照片、任意文本提示、视频——就切换到扩散模型。对抗这个妙招会以组件的形式延续下去（感知损失、蒸馏），而不再是一个独立的生成器。

## 交付物

保存 `outputs/skill-gan-debugger.md`。该技能接收一次失败的 GAN 运行（损失曲线、样本网格、数据集大小），并输出一份按可能性排序的成因列表、一行式修复方案，以及一套重跑流程。

## 练习

1. **简单。** 用默认设置运行 `code/main.py`。然后设置 `D_LR = 5 * G_LR` 并重跑。G 的损失多快会坍缩为一个常数？
2. **中等。** 把 Goodfellow 的 BCE 损失替换为 WGAN 损失：`loss_D = E[D(fake)] - E[D(real)]`、`loss_G = -E[D(fake)]`，并把 D 的权重裁剪到 `[-0.01, 0.01]`。训练是否更稳定？对比一下挂钟时间下的收敛速度。
3. **困难。** 把这个一维示例扩展到二维数据（环形排列的 8 个高斯分布的混合）。跟踪在第 1k、5k、10k 步时，生成器捕获了 8 个模式中的几个。实现 minibatch discrimination 并重新测量。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| 生成器（Generator） | "G" | 噪声到样本的网络，`G: z → x̂`。 |
| 判别器（Discriminator） | "D" | 分类器 `D: x → [0, 1]`，真 vs 假。 |
| 极小极大（Minimax） | "那个博弈" | 一个联合目标的 `min_G max_D`。 |
| 非饱和损失（Non-saturating loss） | "那个修复" | 给 G 用 `-log D(G(z))` 而不是 `log(1 - D(G(z)))`。 |
| 模式坍缩（Mode collapse） | "G 只记住了一样东西" | 尽管数据多样，生成器却只产出少数几种不同的输出。 |
| WGAN | "Wasserstein" | 用推土机距离（Earth-Mover distance）+ 梯度惩罚替换 BCE；梯度更平滑。 |
| 谱归一化（Spectral norm） | "Lipschitz 技巧" | 约束 D 的权重范数以限定其斜率；稳定训练。 |
| StyleGAN | "那个真正管用的" | 映射网络 + AdaIN；面部生成的同类最佳，2026 年依然如此。 |

## 生产笔记：单次推理是 GAN 持久的优势

在开放域生成上，GAN 已不再以样本质量取胜，但它在推理成本上仍然胜出。用生产推理文献的术语来说，一个 GAN 具有：

- **没有预填充（prefill）、没有解码（decode）阶段。** 只有单次 `G(z)` 前向传播。TTFT ≈ 总延迟。
- **没有 KV-cache 压力。** 唯一的状态就是权重。批大小受限于激活内存，而非缓存。
- **连续批处理（continuous batching）极其简单。** 由于每个请求消耗相同的固定 FLOPs，一个在服务器目标占用率下的静态批次通常就是最优的。无需在途（in-flight）调度器。

这就是为什么在 2026 年，GAN 蒸馏（SDXL-Turbo、SD3-Turbo、ADD、LCM）成为快速文生图的主导技术：它把一条 20-50 步的扩散流水线压缩成 1-4 次 GAN 风格的前向传播，同时保留扩散基座的分布。对抗损失作为一个训练期的旋钮存活下来，用于把慢速生成器变成快速生成器。

## 延伸阅读

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) —— 最初的 GAN 论文。
- [Radford et al. (2015). Unsupervised Representation Learning with DCGAN](https://arxiv.org/abs/1511.06434) —— 第一个稳定的架构。
- [Arjovsky, Chintala, Bottou (2017). Wasserstein GAN](https://arxiv.org/abs/1701.07875) —— WGAN。
- [Miyato et al. (2018). Spectral Normalization for GANs](https://arxiv.org/abs/1802.05957) —— SN。
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) —— StyleGAN2。
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) —— StyleGAN3。
- [Sauer et al. (2023). Adversarial Diffusion Distillation](https://arxiv.org/abs/2311.17042) —— SDXL-Turbo。
