# 01 · 生成模型——分类与历史

> 每一个图像模型、文本模型、视频模型和 3D 模型，都能归入五个类别之一。选错类别，你会和数学公式缠斗数周；选对类别，这个领域过去十二年的进展会在你脑中干净利落地层层堆叠起来。

**类型：** 学习
**语言：** Python
**前置：** 阶段 2（机器学习基础）、阶段 3（深度学习核心）、阶段 7 · 14（Transformer）
**时长：** 约 45 分钟

## 问题所在

生成模型只做一件事：给定从某个未知分布 `p_data(x)` 中抽取的训练样本，输出看起来像是来自同一分布的新样本。人脸、句子、MIDI 文件、蛋白质结构——眯起眼看，全都是同一个问题。

麻烦之处在于：`p_data` 存在于一个拥有数百万维度的空间里（一张 512x512 的 RGB 图像约有 786k 维），样本落在该空间内一层很薄的「流形（manifold）」上，而你手头可能只有约 1000 万个样本。想要硬算出密度毫无希望。每个生成模型都是一种妥协，用一个略微没那么难的问题去换掉一个很难的问题。

过去十二年里，有五个家族存活了下来。弄清每个家族各自做出了什么样的妥协，就能明白它为什么在某些任务上胜出、又在另一些任务上崩溃。

## 核心概念

〔图：生成模型的五大家族——按所建模对象划分的分类法〕

**1. 显式密度，可解析（explicit density, tractable）。** 把 `log p(x)` 写成一个你确实能计算的求和式。「自回归模型（autoregressive models）」（PixelCNN、WaveNet、GPT）将 `p(x) = ∏ p(x_i | x_<i)` 分解为条件概率连乘。「标准化流（normalizing flows）」（RealNVP、Glow）把 `p(x)` 构造为一个简单基分布的可逆变换。优点：精确的似然、干净的训练损失。缺点：自回归推理是串行的（对长序列很慢），流模型需要可逆架构（在架构上受限）。

**2. 显式密度，近似（explicit density, approximate）。** 从下方给 `log p(x)` 设一个界（ELBO），然后优化这个界。「变分自编码器（VAE）」（Kingma 2013）使用带变分后验的编码器-解码器结构。「扩散模型（diffusion models）」（DDPM，Ho 2020）训练一个去噪器，它隐式地优化一个加权的 ELBO。截至 2026 年，扩散模型是图像、视频和 3D 的主导骨干。

**3. 隐式密度（implicit density）。** 完全跳过密度；学习一个生成器 `G(z)` 来产生样本，再学习一个判别器 `D(x)` 来区分真假。「生成对抗网络（GAN）」（Goodfellow 2014）。推理快（一次前向传播即可），但训练过程出了名地不稳定。即便到了 2026 年，StyleGAN 1/2/3 在固定领域的照片级真实感（人脸、卧室）上仍然是最先进水平。

**4. 基于分数 / 连续时间（score-based / continuous-time）。** 直接学习对数密度的梯度 `∇_x log p(x)`（即「分数（score）」）。Song 与 Ermon（2019）证明了分数匹配能把扩散推广为一个 SDE。「流匹配（flow matching）」（Lipman 2023）是 2024–2026 年的热点：免模拟训练、路径更直、采样速度比 DDPM 快 4–10 倍。Stable Diffusion 3、Flux、AudioCraft 2 都采用流匹配。

**5. 基于离散码的 token 级自回归（token-based autoregressive over discrete codes）。** 用 VQ-VAE 或残差量化器把高维数据压缩成一段较短的离散 token 序列，再用 Transformer 对该 token 序列建模。Parti、MuseNet、AudioLM、VALL-E、Sora 的 patch 分词器都采用这种方式。这其实就是第 1 类，外加一个可学习的分词器。

## 简史

| 年份 | 模型 | 重要性 |
|------|-------|-----------------|
| 2013 | VAE（Kingma） | 第一个带有可用训练损失的深度生成模型。 |
| 2014 | GAN（Goodfellow） | 隐式密度、无需似然——样本清晰得惊人。 |
| 2015 | DRAW、PixelCNN | 序列化的图像生成。 |
| 2017 | Glow、RealNVP | 可逆流；以深度换取精确似然。 |
| 2017 | Progressive GAN | 首次实现百万像素人脸。 |
| 2019 | StyleGAN / StyleGAN2 | 照片级真实感人脸，在该单一领域至今难以超越。 |
| 2020 | DDPM（Ho） | 扩散模型变得实用。 |
| 2021 | CLIP、DALL-E 1、VQGAN | 文本生成图像走向主流。 |
| 2022 | Imagen、Stable Diffusion 1、DALL-E 2 | 潜空间扩散 + 文本条件 = 大众化商品。 |
| 2022 | ControlNet、LoRA | 对预训练扩散模型的精细控制。 |
| 2023 | SDXL、Midjourney v5、流匹配 | 规模化 + 更优的训练动力学。 |
| 2024 | Sora、Stable Diffusion 3、Flux.1 | 视频扩散；流匹配胜出。 |
| 2025 | Veo 2、Kling 1.5、Runway Gen-3、Nano Banana | 生产级视频。 |
| 2026 | 一致性模型 + 修正流（Consistency + Rectified Flow） | 从扩散骨干实现单步采样。 |

## 五问分诊法

当一篇新的生成模型论文出现时，先回答以下五个问题，再去读它的方法章节。

1. **建模的对象是什么？** 像素、潜变量、离散 token、3D 高斯、网格，还是波形？
2. **密度是显式还是隐式？** 他们有没有把 `log p(x)` 写出来？
3. **采样：一步到位还是迭代？** 迭代意味着推理更慢；一步到位通常意味着对抗式训练或蒸馏。
4. **条件：无条件、类别、文本、图像，还是姿态？** 这决定了损失函数和架构搭建方式。
5. **评估：FID、CLIP 分数、IS、人类偏好，还是任务准确率？** 每种指标都有已知的失效模式（见第 14 课）。

本阶段的每一课，你都会重新回答这五个问题。到本阶段结束时，它们会成为你的本能反应。

## 动手构建

本课的代码是一个轻量级可视化：用三种玩具式方法（核密度、离散直方图，以及一个取最近样本的「类 GAN」生成器）从样本中拟合一个一维高斯混合分布，让你能在一个可以打印到一屏内的问题上，看清显式密度与隐式密度之间的区别。

运行 `code/main.py`。它会从一个双峰高斯混合分布中抽取 2000 个样本，然后打印：

```
explicit density (histogram): p(x in [-0.5, 0.5]) ≈ 0.38
approximate density (KDE):     p(x in [-0.5, 0.5]) ≈ 0.41
implicit (nearest-sample gen): 20 new samples printed, no p(x)
```

注意：前两种方法让你能够发问「这个点出现的可能性有多大？」第三种则不能。这就是「显式 vs 隐式」的区别，它将在今后每一课中至关重要。

## 实战运用

在 2026 年，哪个家族适合哪类任务？

| 任务 | 最佳家族 | 原因 |
|------|-------------|-----|
| 照片级真实人脸，窄领域 | StyleGAN 2/3 | 仍然最清晰、推理最快。 |
| 通用文本生成图像 | 潜空间扩散 + 流匹配 | SD3、Flux.1、DALL-E 3。 |
| 快速文本生成图像 | 修正流 + 蒸馏 | SDXL-Turbo、SD3-Turbo、LCM。 |
| 文本生成视频 | 扩散 Transformer + 流匹配 | Sora、Veo 2、Kling。 |
| 语音 + 音乐 | 基于 token 的自回归（AudioLM、VALL-E、MusicGen）或流匹配（AudioCraft 2） | 离散 token 的规模化成本低。 |
| 3D 场景 | 高斯泼溅拟合、扩散先验 | 3D-GS 用于重建，扩散用于新视角合成。 |
| 密度估计（无需采样） | 流模型 | 唯一能给出精确 `log p(x)` 的家族。 |
| 仿真 / 物理 | 流匹配、分数 SDE | 直线路径、平滑向量场。 |

## 交付落地

保存为 `outputs/skill-model-chooser.md`。

该技能接收一段任务描述，并输出：(1) 应使用哪个家族；(2) 一份排名列表，含三个开源选项和三个托管选项；(3) 你应当警惕的潜在失效模式；(4) 一份算力 / 时间预算。

## 练习

1. **简单。** 针对以下五款产品，识别其家族与骨干：ChatGPT 图像、Midjourney v7、Sora、Runway Gen-3、ElevenLabs。证据应来自公开的技术报告。
2. **中等。** 你明天将要读的那篇论文声称采样速度比扩散快 100 倍。写下三个问题，用来检验这个加速能否在引入条件和高分辨率后仍然成立。
3. **困难。** 选一个你关心的领域（例如蛋白质结构、CAD、分子、轨迹）。针对该领域当前的 SOTA 模型回答五问分诊法，并勾勒出一个更优的模型会改变什么。

## 关键术语

| 术语 | 人们怎么说 | 它实际的含义 |
|------|-----------------|-----------------------|
| 生成模型（Generative model） | 「它能造出新东西」 | 学习一个针对 `p_data(x)` 的采样器，可选地暴露 `log p(x)`。 |
| 显式密度（Explicit density） | 「你能对它求值」 | 模型提供一个闭式或可解析的 `log p(x)`。 |
| 隐式密度（Implicit density） | 「GAN 风格」 | 只有采样器——无法对给定点求 `p(x)`。 |
| ELBO | 「证据下界」 | `log p(x)` 的一个可解析下界；VAE 和扩散模型都优化它。 |
| 分数（Score） | 「对数密度的梯度」 | `∇_x log p(x)`；扩散模型和 SDE 模型学习这个场。 |
| 流形假设（Manifold hypothesis） | 「数据存在于一个曲面上」 | 高维数据集中在一个低维流形上；这是降维有效的原因。 |
| 自回归（Autoregressive） | 「预测下一块」 | 把联合分布分解为条件概率的连乘。 |
| 潜变量（Latent） | 「压缩后的码」 | 一种低维表示，解码器可由它重建输入。 |

## 生产笔记：五个家族，五种推理形态

每个家族对应一条不同的推理服务器成本曲线。生产推理领域的文献把 LLM 推理拆解为「预填充（prefill）+ 解码（decode）」；同样的分解在这里也适用：

- **自回归（第 1 类和第 5 类）。** 串行解码主导延迟；KV-cache、连续批处理和投机解码都可直接套用。
- **VAE / 扩散 / 流匹配（第 2 类和第 4 类）。** 这里没有 LLM 意义上的解码。成本 = `num_steps × step_cost`，而 `step_cost` 是在完整潜空间分辨率下做一次 Transformer 或 U-Net 前向。生产层面的调节旋钮是步数（DDIM / DPM-Solver / 蒸馏）、批大小，以及精度（bf16 / fp8 / int4）。
- **GAN（第 3 类）。** 一次前向传播。没有调度表，没有 KV-cache。TTFT ≈ 总延迟。这就是为什么 StyleGAN 在窄领域的用户体验上仍然胜出。

当你在论文摘要里看到「比扩散更快」时，请把它翻译成「步数更少 × 同样的单步成本」或「同样的步数 × 更便宜的单步成本」。其余的都是营销话术。

## 延伸阅读

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) —— GAN 论文。
- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) —— VAE 论文。
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) —— DDPM 论文。
- [Song et al. (2021). Score-Based Generative Modeling through SDEs](https://arxiv.org/abs/2011.13456) —— 作为 SDE 的扩散模型。
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) —— 流匹配论文。
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) —— Stable Diffusion 3。
