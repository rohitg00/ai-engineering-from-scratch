# 生成式模型 —— 分类与历史（Generative Models — Taxonomy & History）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 任何图像模型、文本模型、视频模型和 3D 模型都能塞进五个桶里的某一个。挑错桶，你会跟数学搏斗好几周；挑对桶，过去十二年的进展会在你脑子里整整齐齐地堆叠起来。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 2 (ML Fundamentals), Phase 3 (Deep Learning Core), Phase 7 · 14 (Transformers)
**Time:** ~45 minutes

## 问题（The Problem）

生成式模型只干一件事：给定从某个未知分布 `p_data(x)` 抽取的训练样本，输出看起来像是来自同一分布的新样本。人脸、句子、MIDI 文件、蛋白质结构——眯起眼来看都是同一个问题。

麻烦在于 `p_data` 活在一个百万维的空间里（一张 512x512 的 RGB 图像就有约 78.6 万维），样本只分布在这个空间内的一片薄薄的 manifold（流形）上，而你顶多有 1000 万个样本。硬刚密度估计是没希望的。每一个生成式模型都是一种妥协：用一个稍微没那么难的问题，去换掉那个非常难的问题。

过去十二年里活下来的家族总共有五个。知道每个家族做了哪种妥协，你就能解释为什么它在某些任务上赢、在另一些任务上崩。

## 概念（The Concept）

![生成式模型的五大家族——按其建模对象划分](../assets/taxonomy.svg)

**1. 显式密度，可解析（Explicit density, tractable）。** 把 `log p(x)` 写成一个你真的能算出来的求和。autoregressive 模型（PixelCNN、WaveNet、GPT）把 `p(x) = ∏ p(x_i | x_<i)` 因子化。Normalizing flow（RealNVP、Glow）把 `p(x)` 构造成一个简单基础分布的可逆变换。优点：精确似然、训练损失干净。缺点：autoregressive 推理是顺序的（长序列很慢），flow 需要可逆架构（架构上受限）。

**2. 显式密度，近似（Explicit density, approximate）。** 用 ELBO 给 `log p(x)` 一个下界，然后优化这个下界。VAE（Kingma 2013）用一个带变分后验的 encoder-decoder。Diffusion 模型（DDPM, Ho 2020）训练一个去噪器，隐式地优化一个加权的 ELBO。在 2026 年，diffusion 是图像、视频、3D 领域占统治地位的骨干。

**3. 隐式密度（Implicit density）。** 完全跳过密度；学一个生成器 `G(z)` 产生样本，再学一个判别器 `D(x)` 区分真假。这就是 GAN（Goodfellow 2014）。推理快（一次前向传播），但训练出了名的不稳定。即便到了 2026 年，StyleGAN 1/2/3 在固定领域的写实生成上（人脸、卧室）依然是 SOTA。

**4. 基于 score 的 / 连续时间方法（Score-based / continuous-time）。** 直接学习 log 密度的梯度 `∇_x log p(x)`（即 score）。Song & Ermon（2019）证明 score matching 可以把 diffusion 推广到一个 SDE。Flow matching（Lipman 2023）是 2024–2026 的当红炸子鸡：免仿真训练、路径更直、采样比 DDPM 快 4–10 倍。Stable Diffusion 3、Flux、AudioCraft 2 全用 flow matching。

**5. 基于离散 code 的 token autoregressive（Token-based autoregressive over discrete codes）。** 用 VQ-VAE 或残差量化器把高维数据压缩成一段离散 token 短序列，再用 transformer 来建模这段 token 序列。Parti、MuseNet、AudioLM、VALL-E、Sora 的 patch tokenizer 都属于这一类。其实就是第 1 桶外加一个学到的 tokenizer。

## 简史（A brief history）

| 年份 | 模型 | 为何重要 |
|------|------|----------|
| 2013 | VAE (Kingma) | 第一个有可用训练损失的深度生成式模型。 |
| 2014 | GAN (Goodfellow) | 隐式密度，没有似然——样本却出乎意料地清晰。 |
| 2015 | DRAW, PixelCNN | 顺序式图像生成。 |
| 2017 | Glow, RealNVP | 可逆 flow；用深度换精确似然。 |
| 2017 | Progressive GAN | 第一次做到百万像素人脸。 |
| 2019 | StyleGAN / StyleGAN2 | 在人脸这一领域，写实程度至今难以超越。 |
| 2020 | DDPM (Ho) | Diffusion 变得实用。 |
| 2021 | CLIP, DALL-E 1, VQGAN | 文生图走入主流。 |
| 2022 | Imagen, Stable Diffusion 1, DALL-E 2 | latent diffusion + 文本 conditioning = 商品化。 |
| 2022 | ControlNet, LoRA | 对预训练 diffusion 的精细控制。 |
| 2023 | SDXL, Midjourney v5, Flow matching | 规模 + 更好的训练动力学。 |
| 2024 | Sora, Stable Diffusion 3, Flux.1 | 视频 diffusion；flow matching 胜出。 |
| 2025 | Veo 2, Kling 1.5, Runway Gen-3, Nano Banana | 生产级视频。 |
| 2026 | Consistency + Rectified Flow | diffusion 骨干上的一步采样。 |

## 五问分诊法（The five-question triage）

每当一篇新的生成式模型论文掉下来，先回答这五个问题，再去读 method 部分。

1. **建模的是什么？** 像素、latent、离散 token、3D 高斯、网格，还是波形？
2. **密度是显式的还是隐式的？** 他们写下 `log p(x)` 了吗？
3. **采样：一步还是迭代？** 迭代意味着推理更慢；一步通常意味着对抗式或蒸馏。
4. **conditioning：无条件、类别、文本、图像还是姿态？** 这决定了损失和架构骨架。
5. **评估：FID、CLIP score、IS、人类偏好，还是任务准确率？** 每一种都有已知的失败模式（见第 14 课）。

本阶段的每一课你都会再回答一遍这五问。学到最后，它们会变成肌肉记忆。

## 动手实现（Build It）

本课的代码是一个轻量的可视化：用三种玩具方法（核密度、离散直方图、最近邻样本式的「GAN-ish」生成器）从样本拟合一个一维高斯混合模型，让你在一个能打印到一个屏幕上的问题上，亲眼看到显式密度 vs 隐式密度的差别。

跑 `code/main.py`。它会从一个双峰高斯混合中抽 2000 个样本，然后打印：

```
explicit density (histogram): p(x in [-0.5, 0.5]) ≈ 0.38
approximate density (KDE):     p(x in [-0.5, 0.5]) ≈ 0.41
implicit (nearest-sample gen): 20 new samples printed, no p(x)
```

注意：前两种允许你问「这个点的概率有多大？」第三种没法回答。这就是*显式 vs 隐式*的分野，它会在以后每一课里都重要。

## 用起来（Use It）

2026 年，哪个家族适合哪种任务？

| 任务 | 最佳家族 | 原因 |
|------|----------|------|
| 写实人脸，窄领域 | StyleGAN 2/3 | 仍然最锐利、推理最快。 |
| 通用文生图 | Latent diffusion + flow matching | SD3、Flux.1、DALL-E 3。 |
| 快速文生图 | Rectified flow + 蒸馏 | SDXL-Turbo、SD3-Turbo、LCM。 |
| 文生视频 | Diffusion Transformer + flow matching | Sora、Veo 2、Kling。 |
| 语音 + 音乐 | 基于 token 的 AR（AudioLM、VALL-E、MusicGen）或 flow matching（AudioCraft 2） | 离散 token 扩展成本低。 |
| 3D 场景 | Gaussian Splatting 拟合 + diffusion prior | 重建用 3D-GS，新视角用 diffusion。 |
| 密度估计（不采样） | Flow | 唯一能给出精确 `log p(x)` 的家族。 |
| 仿真 / 物理 | Flow matching、score SDE | 直线路径、平滑向量场。 |

## 上线部署（Ship It）

存为 `outputs/skill-model-chooser.md`。

该 skill 接收一段任务描述，输出：(1) 应使用哪个家族，(2) 三个开源选项与三个托管选项的排名，(3) 你应当警惕的可能失败模式，(4) 算力 / 时间预算。

## 练习（Exercises）

1. **Easy.** 对下列五个产品，分别指出它们属于哪个家族、骨干是什么：ChatGPT image、Midjourney v7、Sora、Runway Gen-3、ElevenLabs。证据应来自公开技术报告。
2. **Medium.** 你明天要读的那篇论文宣称「比 diffusion 快 100 倍」。写下三个问题，用来检查这个加速在加上 conditioning 和高分辨率之后是否还成立。
3. **Hard.** 挑一个你关心的领域（如蛋白质结构、CAD、分子、轨迹）。对该领域当前 SOTA 模型回答五问分诊，并勾勒一个「更好的模型」会改变什么。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际是什么意思 |
|------|----------------|----------------|
| Generative model | 「能造新东西的」 | 学一个 `p_data(x)` 的采样器，可选地暴露 `log p(x)`。 |
| Explicit density | 「能算出来的」 | 模型给出闭式或可解析的 `log p(x)`。 |
| Implicit density | 「GAN 那种」 | 只给采样器——无法对一个给定点算出 `p(x)`。 |
| ELBO | 「证据下界（Evidence lower bound）」 | `log p(x)` 的一个可解析下界；VAE 和 diffusion 都优化它。 |
| Score | 「log 密度的梯度」 | `∇_x log p(x)`；diffusion 和 SDE 模型学习的就是这个场。 |
| Manifold hypothesis | 「数据活在一张曲面上」 | 高维数据集中在一个低维 manifold 上；这也是降维之所以有效的原因。 |
| Autoregressive | 「预测下一块」 | 把联合分布因子化为条件分布的乘积。 |
| Latent | 「压缩后的 code」 | 低维表示，decoder 可以从中重建输入。 |

## 生产线注记：五个家族，五种推理形态（Production note: five families, five inference shapes）

每个家族都对应一条不同的推理服务器成本曲线。生产推理的文献把 LLM 推理拆成 prefill + decode；同样的拆解也适用于这里：

- **Autoregressive（第 1 桶和第 5 桶）。** 顺序 decode 主导延迟；KV cache、continuous batching、speculative decoding 全都直接适用。
- **VAE / diffusion / flow-matching（第 2 桶和第 4 桶）。** 这里没有 LLM 意义上的 decode。成本 = `num_steps × step_cost`，而 `step_cost` 是一个在完整 latent 分辨率上跑的 transformer 或 U-Net 前向传播。生产侧的旋钮是步数（DDIM / DPM-Solver / 蒸馏）、batch size 和精度（bf16 / fp8 / int4）。
- **GAN（第 3 桶）。** 一次前向传播。没有 schedule，没有 KV cache。TTFT ≈ 总延迟。这就是为什么 StyleGAN 在窄领域 UX 上依然能赢。

当你在某篇论文摘要里看到「比 diffusion 快」时，把它翻译成「步数更少 × 同样的单步成本」或「同样的步数 × 更便宜的单步成本」。其余的都是营销。

## 延伸阅读（Further Reading）

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) —— GAN 论文。
- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) —— VAE 论文。
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) —— DDPM 论文。
- [Song et al. (2021). Score-Based Generative Modeling through SDEs](https://arxiv.org/abs/2011.13456) —— 把 diffusion 当作 SDE。
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) —— flow matching 论文。
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) —— Stable Diffusion 3。
