# 生成模型 — 分类与历史

> 每一个图像模型、文本模型、视频模型和 3D 模型都归属于五大类别之一。选错类别，你会和数学公式纠缠数周；选对了，这个领域过去十二年的进展就能清晰地在你脑中层层叠加。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 2 (ML Fundamentals), Phase 3 (Deep Learning Core), Phase 7 · 14 (Transformers)
**Time:** ~45 minutes

## 问题

生成模型只做一件事：给定从某个未知分布 `p_data(x)` 中抽取的训练样本，输出看起来像来自同一分布的新样本。人脸、句子、MIDI 文件、蛋白质结构——眯起眼看，其实都是同一个问题。

麻烦在于 `p_data` 生活在数百万维的空间中（一张 512x512 RGB 图像约 78.6 万维），样本位于该空间中一个薄薄的流形上，而你可能只有 1000 万个样本。暴力估计密度是无望的。每一个生成模型都是一种妥协，用一个难题换一个稍不那么难的问题。

五个家族挺过了过去的十二年。知道每个家族做出的是哪种妥协，就能明白为什么它在某些任务上胜出，而在另一些任务上崩溃。

## 概念

![Five families of generative models — taxonomy by what they model](../assets/taxonomy.svg)

**1. 显式密度，可解。** 把 `log p(x)` 写成你真正能计算的和的形式。自回归模型（PixelCNN、WaveNet、GPT）对 `p(x) = ∏ p(x_i | x_<i)` 进行因式分解。归一化流（RealNVP、Glow）把 `p(x)` 构建为一个简单基分布的可逆变换。优点：精确似然、干净的训练损失。缺点：自回归推理是串行的（长序列很慢），流需要可逆架构（架构上受限）。

**2. 显式密度，近似。** 从下方对 `log p(x)` 进行约束（ELBO）并优化这个界。VAE（Kingma 2013）使用带变分后验的编码器-解码器。扩散模型（DDPM，Ho 2020）训练一个去噪器，隐式地优化加权 ELBO。扩散是 2026 年图像、视频和 3D 的主流骨干。

**3. 隐式密度。** 完全跳过密度；学习一个生成样本的生成器 `G(z)` 和一个区分真假样本的判别器 `D(x)`。即 GAN（Goodfellow 2014）。推理快（一次前向传播），但训练期间出了名的不稳定。即便在 2026 年，StyleGAN 1/2/3 在固定领域的照片级真实感（人脸、卧室）上仍是最先进的。

**4. 基于分数 / 连续时间。** 直接学习对数密度的梯度 `∇_x log p(x)`（即分数）。Song & Ermon（2019）证明分数匹配将扩散推广到 SDE。Flow matching（Lipman 2023）是 2024-2026 年的热点：免模拟训练、更直的路径、比 DDPM 快 4-10 倍的采样。Stable Diffusion 3、Flux、AudioCraft 2 都使用 flow matching。

**5. 基于离散码的自回归。** 用 VQ-VAE 或残差量化器将高维数据压缩为较短的离散 token 序列，然后用 Transformer 对该 token 序列建模。Parti、MuseNet、AudioLM、VALL-E、Sora 的 patch tokenizer 都用这种方法。这是类别 1 加上一个学习到的 tokenizer。

## 简史

| 年份 | 模型 | 重要性 |
|------|-------|-----------------|
| 2013 | VAE (Kingma) | 第一个拥有可用训练损失的深度生成模型。 |
| 2014 | GAN (Goodfellow) | 隐式密度，无需似然——样本出奇地锐利。 |
| 2015 | DRAW, PixelCNN | 顺序图像生成。 |
| 2017 | Glow, RealNVP | 可逆流；带深度的精确似然。 |
| 2017 | Progressive GAN | 首个兆像素级人脸。 |
| 2019 | StyleGAN / StyleGAN2 | 照片级人脸，在该领域仍难以超越。 |
| 2020 | DDPM (Ho) | 扩散变得实用。 |
| 2021 | CLIP, DALL-E 1, VQGAN | 文生图走向主流。 |
| 2022 | Imagen, Stable Diffusion 1, DALL-E 2 | 潜空间扩散 + 文本条件 = 大众化。 |
| 2022 | ControlNet, LoRA | 对预训练扩散的精细控制。 |
| 2023 | SDXL, Midjourney v5, Flow matching | 规模 + 更好的训练动态。 |
| 2024 | Sora, Stable Diffusion 3, Flux.1 | 视频扩散；flow matching 胜出。 |
| 2025 | Veo 2, Kling 1.5, Runway Gen-3, Nano Banana | 生产级视频。 |
| 2026 | Consistency + Rectified Flow | 从扩散骨干的一步采样。 |

## 五问分诊

当一篇新的生成模型论文发布时，在阅读方法部分之前，先回答这五个问题。

1. **建模的对象是什么？** 像素、潜变量、离散 token、3D 高斯、网格、波形？
2. **密度是显式还是隐式？** 他们是否写下了 `log p(x)`？
3. **采样：一次性还是迭代式？** 迭代意味着推理更慢；一次性通常意味着对抗式或蒸馏式。
4. **条件：无条件、类别、文本、图像、姿态？** 这决定了损失函数和架构脚手架。
5. **评估：FID、CLIP score、IS、人类偏好、任务准确率？** 每种都有已知的失效模式（见 Lesson 14）。

在本阶段的每一课中，你都要重新回答这五个问题。到最后，它们会成为条件反射。

```figure
autoencoder-bottleneck
```

## 动手构建

本课的代码是一个轻量级可视化：用三种玩具方法（核密度、离散直方图和一个最近样本的“类 GAN”生成器）从样本中拟合一个一维高斯混合模型，让你能在一个屏幕能显示的问题上看到显式密度与隐式密度的区别。

运行 `code/main.py`。它会从一个双峰高斯混合中抽取 2000 个样本，然后打印：

```
explicit density (histogram): p(x in [-0.5, 0.5]) ≈ 0.38
approximate density (KDE):     p(x in [-0.5, 0.5]) ≈ 0.41
implicit (nearest-sample gen): 20 new samples printed, no p(x)
```

注意：前两种方法让你可以问“这个点有多可能？”第三种不行。这就是*显式与隐式*的区别，它将在之后的每一课中都至关重要。

## 实际应用

2026 年，哪个家族适合哪个任务？

| 任务 | 最佳家族 | 原因 |
|------|-------------|-----|
| 照片级人脸，窄领域 | StyleGAN 2/3 | 依然最锐利、推理最快。 |
| 通用文生图 | 潜空间扩散 + flow matching | SD3、Flux.1、DALL-E 3。 |
| 快速文生图 | Rectified flow + 蒸馏 | SDXL-Turbo、SD3-Turbo、LCM。 |
| 文生视频 | Diffusion Transformer + flow matching | Sora、Veo 2、Kling。 |
| 语音 + 音乐 | 基于 token 的 AR（AudioLM、VALL-E、MusicGen）或 flow matching（AudioCraft 2） | 离散 token 扩展成本低。 |
| 3D 场景 | Gaussian Splatting 拟合、扩散先验 | 3D-GS 用于重建，扩散用于新视角。 |
| 密度估计（无采样） | 流 | 唯一拥有精确 `log p(x)` 的家族。 |
| 模拟 / 物理仿真 | Flow matching、score SDE | 直线路径、平滑的向量场。 |

## 落地交付

保存为 `outputs/skill-model-chooser.md`。

这个技能接收一个任务描述，并输出：(1) 应使用哪个家族，(2) 三个开源和三个托管选项的排名列表，(3) 你应该警惕的可能的失效模式，以及 (4) 计算量/时间预算。

## 练习

1. **简单。** 对于以下五个产品，分别识别其家族和骨干：ChatGPT image、Midjourney v7、Sora、Runway Gen-3、ElevenLabs。证据应来自公开的技术报告。
2. **中等。** 你明天要读的一篇论文声称其采样速度比扩散快 100 倍。写下三个问题，用于检验这个加速在有条件生成和高分辨率下是否依然成立。
3. **困难。** 选一个你关心的领域（例如蛋白质结构、CAD、分子、轨迹）。为该领域当前的 SOTA 模型回答五问分诊，并勾勒出一个更好的模型会改变什么。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 生成模型 | “它生成新东西” | 为 `p_data(x)` 学习一个采样器，可选地暴露 `log p(x)`。 |
| 显式密度 | “你可以计算它” | 模型提供闭式或可解的 `log p(x)`。 |
| 隐式密度 | “GAN 风格” | 只有采样器——无法计算给定点的 `p(x)`。 |
| ELBO | “证据下界” | `log p(x)` 的一个可解下界；VAE 和扩散都在优化它。 |
| Score | “对数密度的梯度” | `∇_x log p(x)`；扩散和 SDE 模型学习这个场。 |
| 流形假设 | “数据生活在一张曲面上” | 高维数据集中在低维流形上；这就是降维有效的原因。 |
| 自回归 | “预测下一个部分” | 将联合分布分解为条件分布的乘积。 |
| 潜变量 | “压缩后的编码” | 低维表示，解码器可以从它重建输入。 |

## 生产提示：五个家族，五种推理形态

每个家族对应不同的推理服务器成本曲线。生产推理文献将 LLM 推理拆解为 prefill + decode；同样的分解也适用于此：

- **自回归（类别 1 和 5）。** 串行解码主导延迟；KV-cache、continuous batching 和 speculative decoding 都直接适用。
- **VAE / 扩散 / flow-matching（类别 2 和 4）。** 没有严格意义上类似 LLM 的 decode。成本 = `num_steps × step_cost`，且 `step_cost` 是在全潜分辨率下的 transformer 或 U-Net 前向传播。生产中的调节旋钮是步数（DDIM / DPM-Solver / 蒸馏）、批量大小和精度（bf16 / fp8 / int4）。
- **GAN（类别 3）。** 一次前向传播。没有调度，没有 KV-cache。TTFT ≈ 总延迟。这就是 StyleGAN 在窄领域用户体验上仍然胜出的原因。

当你在论文摘要中看到“比扩散更快”时，把它翻译为“更少步数 × 相同单步成本”或“相同步数 × 更低单步成本”。其他一切都是营销话术。

## 延伸阅读

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) — GAN 原始论文。
- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) — VAE 原始论文。
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) — DDPM 原始论文。
- [Song et al. (2021). Score-Based Generative Modeling through SDEs](https://arxiv.org/abs/2011.13456) — 作为 SDE 的扩散。
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) — flow matching 原始论文。
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) — Stable Diffusion 3。