# GAN — Generator 与 Discriminator

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Goodfellow 在 2014 年的妙招是：彻底跳过密度估计。两个网络。一个造假，一个抓假。它们一直对抗，直到假货和真货无法区分。这玩意按理说不该 work。它经常确实不 work。但只要 work 了，在窄域里它产出的样本至今仍是文献里最锐利的。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 3 · 08 (Optimizers), Phase 8 · 02 (VAE)
**Time:** ~75 minutes

## 问题（The Problem）

VAE 产出的样本糊，是因为它的 MSE decoder loss 在贝叶斯意义上最优的目标是「平均图像」——而许多张合理数字的平均，就是一张毛绒绒的数字。你需要的是一个奖励「合理性（plausibility）」的 loss，而不是奖励像素级靠近某个特定目标。可是「合理性」没有闭式表达，你只能学出来。

Goodfellow 的想法：训一个分类器 `D(x)` 来区分真图和假图；再训一个 generator `G(z)` 去骗过 `D`。`G` 的 loss 信号就是「`D` 当下认为某张图看起来像真的」的判据。这个信号会随着 `G` 进步而更新——`G` 一直追着一个移动的靶子。如果两个网络都收敛，`G` 就在不写下 `log p(x)` 的前提下学到了数据分布。

这就是对抗训练（adversarial training）。其数学是一个 minimax 博弈：

```
min_G max_D  E_real[log D(x)] + E_fake[log(1 - D(G(z)))]
```

到 2026 年，GAN 已经不再是 SOTA 生成模型（diffusion 和 flow matching 抢走了王冠）。但 StyleGAN 2/3 至今仍是有史以来最锐利的人脸模型；GAN 的 discriminator 被当作 *perceptual loss*（感知损失）用在 diffusion 训练里；对抗训练还驱动了那些把扩散压成 1 步的快速蒸馏（SDXL-Turbo、SD3-Turbo、LCM），让你能上线实时 diffusion。

## 概念（The Concept）

![GAN training: generator and discriminator in minimax](../assets/gan.svg)

**Generator `G(z)`。** 把噪声向量 `z ~ N(0, I)` 映射成一个样本 `x̂`。形状像 decoder 的网络（dense 或 transposed conv）。

**Discriminator `D(x)`。** 把样本映射成一个标量概率（或得分）。真 → 1，假 → 0。

**Loss。** 两次交替更新：

- **训 `D`：** `loss_D = -[ log D(x) + log(1 - D(G(z))) ]`。在「真=1、假=0」上的二元交叉熵。
- **训 `G`：** `loss_G = -log D(G(z))`。这是 Goodfellow 用的 *non-saturating*（不饱和）形式（原始的 `log(1 - D(G(z)))` 在 `D` 自信时会饱和、把梯度杀掉）。

**训练循环。** 一步 `D`，一步 `G`，重复。

**为什么能 work。** 如果 `G` 完全匹配 `p_data`，那 `D` 不会比随机猜更强、处处输出 0.5；`G` 也就拿不到更多梯度。均衡。

**为什么会崩。** Mode collapse（`G` 找到一个 `D` 分不出来的模式，就一直造同一个）、梯度消失（`D` 学得太快、`log D` 饱和）、训练不稳定（学习率、batch size，啥都可能出事）。

## 让 GAN 真正 work 起来的变体（Variants that made GANs work）

| 年份 | 创新 | 修复了什么 |
|------|------------|-----|
| 2015 | DCGAN | Conv/deconv、batch norm、LeakyReLU——第一个稳定的架构。 |
| 2017 | WGAN, WGAN-GP | 用 Wasserstein 距离 + 梯度惩罚替换 BCE。修掉梯度消失。 |
| 2017 | Spectral normalization | 给 discriminator 加 Lipschitz 约束。2026 年的 discriminator 仍在用。 |
| 2018 | Progressive GAN | 先训低分辨率，再加层。第一次做出兆像素级结果。 |
| 2019 | StyleGAN / StyleGAN2 | Mapping network + adaptive instance norm。固定域照片级写实的 SOTA。 |
| 2021 | StyleGAN3 | Alias-free、平移等变——2026 年仍是人脸黄金标杆。 |
| 2022 | StyleGAN-XL | 条件化、类感知、更大规模。 |
| 2024 | R3GAN | 用更强正则重新打包；不靠 trick 也能在 1024² 上 work。 |

## 动手实现（Build It）

`code/main.py` 在一维数据上训了一个迷你 GAN：两个高斯的混合分布。Generator 和 discriminator 都是单隐藏层 MLP。我们手写 forward、backward 和 minimax 循环。目标是亲眼看到两种典型的失败模式（mode collapse + 梯度消失）发生。

### Step 1：non-saturating loss

香草版 Goodfellow loss `log(1 - D(G(z)))` 在 D 把 G 的假货高置信度判为假时趋近 0。此时 G 拿到的梯度基本是零——G 没法继续改进。Non-saturating 形式 `-log D(G(z))` 的渐近线刚好相反：D 越自信它越大，给 G 一个强信号。

```python
def g_loss(d_fake):
    # maximize log D(G(z))  <=>  minimize -log D(G(z))
    return -sum(math.log(max(p, 1e-8)) for p in d_fake) / len(d_fake)
```

### Step 2：每一步 G 配一步 D

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

给 G 用新鲜的假样本，否则梯度就过期了。

### Step 3：盯着 mode collapse

```python
if step % 200 == 0:
    samples = [G(z) for z in sample_noise(500)]
    mode_a = sum(1 for s in samples if s < 0)
    mode_b = 500 - mode_a
    if min(mode_a, mode_b) < 50:
        print("  [!] mode collapse: one mode is starved")
```

经典症状：两个真实模式中的一个不再被生成。Discriminator 没法纠正，因为它再也没把它当成假样本见过。

## 坑（Pitfalls）

- **Discriminator 太强。** 把 D 的学习率砍 2-5 倍，或者给 D 输入加 instance/layer 噪声。如果 D 准确率超过 95%，G 就死了。
- **Generator 记住了某个模式。** 给 D 输入加噪声、加一层 minibatch-discriminator，或者切到 WGAN-GP。
- **Batch norm 漏统计量。** 真 batch 和假 batch 流过同一个 BN 层时，会把双方的统计量混进彼此。换成 instance norm 或 spectral norm。
- **Inception-score 刷分。** FID 和 IS 在样本量小时噪声大。评估时用 ≥10k 样本。
- **「一次采样」对条件任务是个谎。** 你照样需要 CFG 缩放、截断 trick、重新采样才能拿到能用的输出。

## 用起来（Use It）

2026 年的 GAN 选型表：

| 场景 | 选 |
|-----------|------|
| 照片级写实人脸，固定姿态 | StyleGAN3（最锐、最小） |
| 二次元 / 风格化人脸 | StyleGAN-XL 或 Stable Diffusion LoRA |
| 图到图翻译 | Pix2Pix / CycleGAN（Phase 8 · 04）或 ControlNet（Phase 8 · 08） |
| 极速 1 步文生图 | 对扩散做对抗蒸馏（SDXL-Turbo、SD3-Turbo） |
| 在 diffusion 训练里当 perceptual loss | 在图像 crop 上跑一个小 GAN discriminator |
| 任何多模态、开放式任务 | 别用——上 diffusion 或 flow matching |

GAN 锐利但窄。一旦你的领域打开了——照片、任意文本提示、视频——切到 diffusion。对抗这一招以「组件」的形式存活下来（perceptual loss、蒸馏），而不是作为一个独立 generator。

## 上线部署（Ship It）

存到 `outputs/skill-gan-debugger.md`。这个 skill 接收一次失败的 GAN 训练（loss 曲线、样本网格、数据集大小），输出按可能性排序的根因清单、一行修复建议和重跑预案。

## 练习（Exercises）

1. **简单。** 用默认设置跑 `code/main.py`。然后设 `D_LR = 5 * G_LR` 再跑一遍。G 的 loss 多快塌成一个常数？
2. **中等。** 把 Goodfellow 的 BCE loss 换成 WGAN loss：`loss_D = E[D(fake)] - E[D(real)]`、`loss_G = -E[D(fake)]`，并把 D 的权重 clip 到 `[-0.01, 0.01]`。训练更稳了吗？比较墙钟收敛速度。
3. **困难。** 把一维例子扩展到二维数据（一个圆环上的 8 个高斯混合）。在 1k、5k、10k 步时分别记录 generator 抓到了 8 个模式中的几个。实现 minibatch discrimination，再测一次。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际意思 |
|------|-----------------|-----------------------|
| Generator | "G" | 噪声到样本的网络，`G: z → x̂`。 |
| Discriminator | "D" | 分类器 `D: x → [0, 1]`，真 vs 假。 |
| Minimax | "博弈" | 联合目标的 `min_G max_D`。 |
| Non-saturating loss | "那个修复" | 给 G 用 `-log D(G(z))`，而不是 `log(1 - D(G(z)))`。 |
| Mode collapse | "G 只记住了一个东西" | 数据多样，但 generator 只产几种不同输出。 |
| WGAN | "Wasserstein" | 用推土机距离 + 梯度惩罚替换 BCE；梯度更平滑。 |
| Spectral norm | "Lipschitz trick" | 约束 D 权重的范数以限制其斜率；让训练更稳。 |
| StyleGAN | "那个真 work 的" | Mapping network + AdaIN；2026 年人脸领域仍是同类最佳。 |

## 工程提醒：一次推理仍然是 GAN 的长期优势

在开放域生成上 GAN 已经不再赢样本质量了，但它仍然赢推理成本。用生产推理文献的词汇说，GAN 的特点是：

- **没有 prefill 和 decode 阶段。** 单次 `G(z)` 前向传播。TTFT ≈ 总延迟。
- **没有 KV cache 压力。** 唯一的状态就是权重。Batch size 由激活值显存决定，不是 cache。
- **continuous batching 平凡。** 因为每个请求的 FLOPs 完全一样，按服务端目标占用率切一个静态 batch 通常就最优。不需要 in-flight 调度器。

这就是为什么 2026 年 GAN 蒸馏（SDXL-Turbo、SD3-Turbo、ADD、LCM）成了快速文生图的主流技术：它把一个 20-50 步的 diffusion 流水线压成 1-4 次 GAN 风格的前向传播，同时保留 diffusion 基模型的分布。对抗 loss 以「训练时的旋钮」形式存活下来，专门用来把慢 generator 变成快 generator。

## 延伸阅读（Further Reading）

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) — 原始 GAN 论文。
- [Radford et al. (2015). Unsupervised Representation Learning with DCGAN](https://arxiv.org/abs/1511.06434) — 第一个稳定的架构。
- [Arjovsky, Chintala, Bottou (2017). Wasserstein GAN](https://arxiv.org/abs/1701.07875) — WGAN。
- [Miyato et al. (2018). Spectral Normalization for GANs](https://arxiv.org/abs/1802.05957) — SN。
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) — StyleGAN2。
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) — StyleGAN3。
- [Sauer et al. (2023). Adversarial Diffusion Distillation](https://arxiv.org/abs/2311.17042) — SDXL-Turbo。
