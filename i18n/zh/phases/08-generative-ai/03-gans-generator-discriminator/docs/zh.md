# GAN — 生成器 vs 判别器

> Goodfellow 在 2014 年的技巧是完全跳过密度。两个网络。一个造假，一个抓假。它们互相博弈，直到假样本与真实样本无法区分。这本来不该有效。它经常失效。而当它有效时，其样本在狭窄领域中仍然是文献中最锐利的。

**Type:** Build
**Languages:** Python
**Prerequisites:** 阶段 3 · 02(反向传播)、阶段 3 · 08(优化器)、阶段 8 · 02(VAE)
**Time:** ~75 分钟

## 问题

VAE 生成的样本模糊，因为其 MSE 解码器损失对*均值*图像是贝叶斯最优的——而许多合理数字的均值是一个模糊的数字。你需要一个奖励*合理性*的损失，而不是与某个目标逐像素接近的损失。合理性没有闭式解。你必须去学习它。

Goodfellow 的想法：训练一个分类器 `D(x)` 来区分真实图像和假图像。训练一个生成器 `G(z)` 来欺骗 `D`。`G` 的损失信号就是 `D` 当前认为什么看起来像真的。这个信号随着 `G` 的改进而更新，追逐一个移动的目标。如果两个网络收敛，`G` 就学会了数据分布，而从未显式写出 `log p(x)`。

这就是对抗训练。其数学是一个极小极大博弈：

```
min_G max_D  E_real[log D(x)] + E_fake[log(1 - D(G(z)))]
```

到 2026 年，GAN 已不再是 SOTA 生成器(diffusion 和 flow matching 夺走了这个桂冠)。但 StyleGAN 2/3 仍然是有史以来最锐利的人脸模型，GAN 判别器在 diffusion 训练中被用作*感知损失*，而对抗训练支撑着快速的 1 步蒸馏(SDXL-Turbo、SD3-Turbo、LCM),让你能部署实时 diffusion。

## 概念

![GAN training: generator and discriminator in minimax](../assets/gan.svg)

**生成器 `G(z)`。** 将噪声向量 `z ~ N(0, I)` 映射为样本 `x̂`。一个解码器形态的网络(全连接或转置卷积)。

**判别器 `D(x)`。** 将样本映射为一个标量概率(或分数)。真 → 1,假 → 0。

**损失。** 两个交替更新：

- **训练 `D`:** `loss_D = -[ log D(x) + log(1 - D(G(z))) ]`。对真实=1、假=0 的二元交叉熵。
- **训练 `G`:** `loss_G = -log D(G(z))`。这是 Goodfellow 使用的*非饱和*形式(原始的 `log(1 - D(G(z)))` 在 `D` 过于自信时会饱和并杀死梯度)。

**训练循环。** 一步 `D`,一步 `G`。重复。

**为什么有效。** 如果 `G` 完美匹配 `p_data`,那么 `D` 无法做得比随机猜测更好，处处输出 0.5;`G` 不再获得梯度。均衡态。

**为什么失效。** 模式崩塌(`G` 找到一个 `D` 无法分类的模式并无休止地产出它)、梯度消失(`D` 学得太快导致 `log D` 饱和)、训练不稳定(学习率、batch 大小，一切)。

## 让 GAN 真正可用的变体

| 年份 | 创新 | 修复 |
|------|------------|-----|
| 2015 | DCGAN | 卷积/反卷积、batch norm、LeakyReLU——第一个稳定的架构。 |
| 2017 | WGAN、WGAN-GP | 用 Wasserstein 距离 + 梯度惩罚取代 BCE。修复梯度消失。 |
| 2017 | 谱归一化 | 给判别器施加 Lipschitz 约束。2026 年的判别器仍在使用。 |
| 2018 | Progressive GAN | 先训练低分辨率，再逐层添加。首批兆像素结果。 |
| 2019 | StyleGAN / StyleGAN2 | 映射网络 + 自适应实例归一化。固定领域照片级真实感的最优方案。 |
| 2021 | StyleGAN3 | 无混叠、平移等变——2026 年仍是人脸的黄金标准。 |
| 2022 | StyleGAN-XL | 条件生成、类感知、更大规模。 |
| 2024 | R3GAN | 以更强的正则化重新打造；无需技巧即可在 1024² 上工作。 |

```figure
gan-minimax
```

## 动手实现

`code/main.py` 在一维数据上训练一个微型 GAN:两个高斯分布的混合。生成器和判别器都是单隐层 MLP。我们手动实现前向、反向以及极小极大循环。目标是在模式崩塌和梯度消失这两种关键失效模式发生时亲眼看到它们。

### 步骤 1:非饱和损失

原始的 Goodfellow 损失 `log(1 - D(G(z)))` 在 D 高置信度地将 G 的假样本判定为假时趋于 0。此时 G 的梯度基本为零——G 无法改进。非饱和形式 `-log D(G(z))` 的渐近行为恰好相反：它在 D 自信时爆炸，给 G 一个强信号。

```python
def g_loss(d_fake):
    # maximize log D(G(z))  <=>  minimize -log D(G(z))
    return -sum(math.log(max(p, 1e-8)) for p in d_fake) / len(d_fake)
```

### 步骤 2:每步生成器更新对应一步判别器更新

```python
for step in range(steps):
    # train D
    real_batch = sample_real(batch_size)
    fake_batch = [G(z) for z in sample_noise(batch_size)]
    update_D(real_batch, fake_batch)

    # train G
    fake_batch = [G(z) for z in sample_noise(batch_size)]  # fresh fakes
    update_G(fake_batch)
```

为 G 提供新鲜的假样本，否则梯度是陈旧的。

### 步骤 3:留意模式崩塌

```python
if step % 200 == 0:
    samples = [G(z) for z in sample_noise(500)]
    mode_a = sum(1 for s in samples if s < 0)
    mode_b = 500 - mode_a
    if min(mode_a, mode_b) < 50:
        print("  [!] mode collapse: one mode is starved")
```

典型症状：两个真实模式之一不再被生成。判别器停止纠正它，因为它从未被当作假样本看到。

## 常见陷阱

- **判别器太强。** 将 D 的学习率降低 2-5 倍，或添加 instance/layer 噪声。如果 D 的准确率超过 95%,G 就死了。
- **生成器记住了一个模式。** 给 D 的输入添加噪声，使用 minibatch-discriminator 层，或切换到 WGAN-GP。
- **Batch norm 泄漏统计量。** 真实 batch 和假 batch 流过同一个 BN 层会混合它们的统计量。改用 instance norm 或谱归一化。
- **Inception 分数作弊。** FID 和 IS 在低样本量下噪声很大。评估时使用 ≥10k 个样本。
- **一次性采样对条件任务是个谎言。** 你仍然需要 CFG scale、截断技巧和重采样才能获得可用的输出。

## 使用它

2026 年的 GAN 技术栈：

| 场景 | 选择 |
|-----------|------|
| 照片级真实人脸，固定姿态 | StyleGAN3(最锐利、最小) |
| 动漫 / 风格化人脸 | StyleGAN-XL 或 Stable Diffusion LoRA |
| 图像到图像翻译 | Pix2Pix / CycleGAN(阶段 8 · 04)或 ControlNet(阶段 8 · 08) |
| 快速 1 步文生图 | diffusion 的对抗蒸馏(SDXL-Turbo、SD3-Turbo) |
| diffusion 训练器内的感知损失 | 图像裁块上的小型 GAN 判别器 |
| 任何多模态、开放式任务 | 别用——改用 diffusion 或 flow matching |

GAN 锐利但狭窄。一旦你的领域变得开放——照片、任意文本提示、视频——就切换到 diffusion。对抗技巧作为组件(感知损失、蒸馏)延续下来，而不是作为独立的生成器。

## 发布它

保存 `outputs/skill-gan-debugger.md`。Skill 接收一次失败的 GAN 运行(损失曲线、样本网格、数据集大小)，输出一个按可能性排序的列表：可能原因、单行修复方案和重跑协议。

## 练习

1. **简单。** 用默认设置运行 `code/main.py`。然后设置 `D_LR = 5 * G_LR` 并重跑。G 的损失多快会塌缩为一个常数？
2. **中等。** 将 Goodfellow BCE 损失替换为 WGAN 损失：`loss_D = E[D(fake)] - E[D(real)]`、`loss_G = -E[D(fake)]`,并将 D 的权重裁剪到 `[-0.01, 0.01]`。训练是否更稳定？比较实际耗时收敛速度。
3. **困难。** 将一维示例扩展到二维数据(环上的 8 个高斯混合)。追踪在 1k、5k、10k 步时生成器捕获了 8 个模式中的多少个。实现 minibatch discrimination 并重新测量。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 生成器 | "G" | 噪声到样本的网络，`G: z → x̂`。 |
| 判别器 | "D" | 分类器 `D: x → [0, 1]`,真 vs 假。 |
| 极小极大 | “那个博弈” | 联合目标的 `min_G max_D`。 |
| 非饱和损失 | “那个修复” | 对 G 使用 `-log D(G(z))` 而不是 `log(1 - D(G(z)))`。 |
| 模式崩塌 | “G 记住了一件事” | 尽管数据多样，生成器只产出少数几种不同的输出。 |
| WGAN | "Wasserstein" | 用 Earth-Mover 距离 + 梯度惩罚取代 BCE;梯度更平滑。 |
| 谱归一化 | "Lipschitz 技巧" | 约束 D 的权重范数以限制其斜率；稳定训练。 |
| StyleGAN | “那个真正有效的” | 映射网络 + AdaIN;人脸任务的最佳方案，2026 年仍然如此。 |

## 生产环境备注：一次性推理是 GAN 持久的优势

GAN 在开放域生成的样本质量上已不再领先，但在推理成本上仍然领先。用生产推理文献的词汇来说，一个 GAN 具有：

- **无 prefill、无 decode 阶段。** 单次 `G(z)` 前向传播。TTFT ≈ 总延迟。
- **无 KV-cache 压力。** 唯一的状态就是权重。batch 大小只受激活内存限制，而非缓存。
- **简单的连续批处理。** 由于每个请求消耗相同的固定 FLOPs,服务器目标占用率下的静态 batch 通常就是最优的。无需在途调度器。

这就是为什么 GAN 蒸馏(SDXL-Turbo、SD3-Turbo、ADD、LCM)是 2026 年快速文生图的主流技术：它将 20-50 步的 diffusion 流水线压缩为 1-4 次 GAN 风格的前向传播，同时保留 diffusion 基模型的分布。对抗损失作为训练时旋钮延续下来，用于把慢生成器变成快生成器。

## 延伸阅读

- [Goodfellow 等人 (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) — GAN 的原始论文。
- [Radford 等人 (2015). Unsupervised Representation Learning with DCGAN](https://arxiv.org/abs/1511.06434) — 第一个稳定的架构。
- [Arjovsky、Chintala、Bottou (2017). Wasserstein GAN](https://arxiv.org/abs/1701.07875) — WGAN。
- [Miyato 等人 (2018). Spectral Normalization for GANs](https://arxiv.org/abs/1802.05957) — SN。
- [Karras 等人 (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) — StyleGAN2。
- [Karras 等人 (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) — StyleGAN3。
- [Sauer 等人 (2023). Adversarial Diffusion Distillation](https://arxiv.org/abs/2311.17042) — SDXL-Turbo。