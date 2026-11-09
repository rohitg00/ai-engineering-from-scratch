# 生成模型 类学与历史

> 每个图像模型,文本模型,视频模型和3D模型都适合五个桶之一. 选择错误的桶,你会数周战斗. 选择正确的模型,

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2 (ML Fundamentals), Phase 3 (Deep Learning Core), Phase 7 · 14 (Transformers)
**Time:** ~45 minutes

## 问题

产生型号只能做一个工作:从某种未知的分布中获取的训练样本$p_{\text{data}}(x)$面孔,句子,MIDI文件,蛋白质结构,如果你眼,所有这些都是相同的问题.

问题是,$p_{\text{data}}$它们在一个空间里存在数百万个维度 (一个512x512 RGB图像是786k维度),样本坐落在一个薄型的多元体内,你只能得到10M的例子.

知道每个家庭都会做出什么妥协,就能告诉你,为什么它在某些任务上胜利,而在其他任务上崩.

## 概念

![Five families of generative models — taxonomy by what they model](../assets/taxonomy.svg)

**1. Explicit density, tractable.**写下$\log p(x)$它们是可以实际评估的.$p(x) = \prod_i p(x_i \mid x_{<i})$正常化流量 (RealNVP,Glow) 构建$p(x)$优点:精确的可能性,清洁的训练损失. 缺点:自行降低推理是序列 (长序列的缓慢),流需要可逆的架构 (建筑限制).

**2. Explicit density, approximate.**绑定$\log p(x)$通过在下面 (ELBO) 进行优化,并优化边界.VAE (Kingma 2013) 使用一个变化后背的编码解码器. 扩散模型 (DDPM, Ho 2020) 训练一个暗示器,隐含优化一个权重的ELBO. 扩散是2026年占主导地位的图像,视频和3D脊柱.

**3. Implicit density.**完全跳过密度;学习一个发电机$G(z)$产品的样本和差异性$D(x)$简单的GAN (Goodfellow 2014). 快速推断 (一次前进通过),但在训练期间不稳定. 风格GAN 1/2/3即使在2026年仍然是固定域光现实主义的最先进状态.

**4. Score-based / continuous-time.**了解木材密度的梯度$\nabla_x \log p(x)$和埃尔蒙 (2019) 显示,分数匹配将扩散扩散到SDE.流量匹配 (Lipman 2023) 是2024-2026年的热度:无模拟训练,更直线路,比DDPM快4-10倍的样本采集.稳定扩散3,流量,音频工艺2都使用流量匹配.

**5. Token-based autoregressive over discrete codes.**通过VQ-VAE或残余量化器将高模数数据压缩到单独代币的短序列中,然后使用变压器来模拟代币序列.Parti,MuseNet,AudioLM,VALL-E,Sora的补丁代币器都使用此.这是桶1加上学习代币器.

## 简短的历史

| Year | Model | Why it mattered |
|------|-------|-----------------|
| 2013 | VAE (Kingma) | First deep generative model with a usable training loss. |
| 2014 | GAN (Goodfellow) | Implicit density, no likelihood — shockingly sharp samples. |
| 2015 | DRAW, PixelCNN | Sequential image generation. |
| 2017 | Glow, RealNVP | Invertible flows; exact likelihood with depth. |
| 2017 | Progressive GAN | First megapixel faces. |
| 2019 | StyleGAN / StyleGAN2 | Photorealistic faces still hard to beat for that one domain. |
| 2020 | DDPM (Ho) | Diffusion becomes practical. |
| 2021 | CLIP, DALL-E 1, VQGAN | Text-to-image goes mainstream. |
| 2022 | Imagen, Stable Diffusion 1, DALL-E 2 | Latent diffusion + text conditioning = commodity. |
| 2022 | ControlNet, LoRA | Fine control over pretrained diffusion. |
| 2023 | SDXL, Midjourney v5, Flow matching | Scale + better training dynamics. |
| 2024 | Sora, Stable Diffusion 3, Flux.1 | Video diffusion; flow matching wins. |
| 2025 | Veo 2, Kling 1.5, Runway Gen-3, Nano Banana | Production-grade video. |
| 2026 | Consistency + Rectified Flow | One-step sampling from diffusion backbones. |

## 五个问题分类

在阅读方法部分之前,当新生成模型纸出现时,请回答这五个问题.

1. **What is being modeled?**像素,隐藏,分离代币,3D高西安,网格,波形?
2. **Is the density explicit or implicit?**他们写下了吗?$\log p(x)$现在,我们要去.
3. **Sampling: one-shot or iterative?**反复式意味着推断速度较慢; 一次射击通常意味着反向性或蒸性.
4. **Conditioning: unconditional, class, text, image, pose?**这决定了损失和建筑架构.
5. **Evaluation: FID, CLIP score, IS, human preference, task accuracy?**每个人都知道故障模式 (见14课).

在这个阶段,你会对每一个课程都回复这些五个答案.

```figure
autoencoder-bottleneck
```

## 建立它

这一课的代码是轻量化可视化:通过使用三个玩具方法 (核密度,分离性 histogram 和最近的样本"GAN-ish"发电机) 来从样本中调整1D的Gaussians混合物,这样你就可以在一个屏幕上打印出的问题上看到明确与隐含密度之间的区别.

跑步`code/main.py`它从两种模式的高斯混合物中取出2000个样本,然后打印:

```
explicit density (histogram): p(x in [-0.5, 0.5]) ≈ 0.38
approximate density (KDE):     p(x in [-0.5, 0.5]) ≈ 0.41
implicit (nearest-sample gen): 20 new samples printed, no p(x)
```

首先,我们需要注意:第两个问题让你问"这个问题是多么可能的?"第三个问题是不能.这是*明确与隐含的*区别,这将在每一个未来的课程中都重要.

## 用它

2026年,哪个家庭,要做什么任务?

| Task | Best family | Why |
|------|-------------|-----|
| Photoreal faces, narrow domain | StyleGAN 2/3 | Still sharpest, fastest inference. |
| General text-to-image | Latent diffusion + flow matching | SD3, Flux.1, DALL-E 3. |
| Fast text-to-image | Rectified flow + distillation | SDXL-Turbo, SD3-Turbo, LCM. |
| Text-to-video | Diffusion Transformer + flow matching | Sora, Veo 2, Kling. |
| Speech + music | Token-based AR (AudioLM, VALL-E, MusicGen) or flow matching (AudioCraft 2) | Discrete tokens scale cheaply. |
| 3D scenes | Gaussian Splatting fit, diffusion prior | 3D-GS for reconstruction, diffusion for novel-view. |
| Density estimation (no sampling) | Flows | Only family with exact $\log p(x)$. |
| Simulation / physics | Flow matching, score SDE | Straight-line paths, smooth vector fields. |

## 运送它

保存如`outputs/skill-model-chooser.md`现在,我们要去.

技能需要一个任务描述和输出: (1) 使用哪个组件, (2) 排列三个开放和三个托管的选项, (3) 您应该关注的可能失败模式,以及 (4) 计算/时间预算.

## 运动

1. **Easy.**对于这五种产品,确定其家族和脊椎:ChatGPT图像,Midjourney v7,Sora,Runway Gen-3,ElevenLabs. 证据应来自公开技术报告.
2. **Medium.**报纸中,你即将读到的报纸称采样速度比扩散速度快100倍.
3. **Hard.**回答当前SOTA模型的五个问题分类,并绘制一个更好的模型将改变什么.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Generative model | "It makes new stuff" | Learns a sampler for $p_{\text{data}}(x)$, optionally exposes $\log p(x)$. |
| Explicit density | "You can evaluate it" | Model provides a closed-form or tractable $\log p(x)$. |
| Implicit density | "GAN-style" | Only a sampler — no way to evaluate $p(x)$ of a given point. |
| ELBO | "Evidence lower bound" | A tractable lower bound on $\log p(x)$; VAEs and diffusion optimize it. |
| Score | "Gradient of log-density" | $\nabla_x \log p(x)$; diffusion and SDE models learn this field. |
| Manifold hypothesis | "Data lives on a surface" | High-dim data concentrates on a low-dim manifold; why dimensionality reduction works. |
| Autoregressive | "Predict the next piece" | Factorize joint as product of conditionals. |
| Latent | "Compressed code" | Low-dim representation from which a decoder can reconstruct the input. |

## 制作说明:五个家庭,五个推断形状

每个家庭都将推断服务器成本曲线进行不同的映射.

- **Autoregressive (bucket 1 and 5).**序列解码占据延迟;KV缓存,连续批量和推测解码都直接适用于.
- **VAE / diffusion / flow-matching (buckets 2 and 4).**没有法学法学意义上的解码.`num_steps × step_cost`其他`step_cost`生产是步骤计数 (DDIM / DPM-Solver /蒸),批量大小和精度 (bf16 / fp8 / int4).
- **GAN (bucket 3).**没有时间表,没有KV缓存,TTFT ≈总延迟,这就是为什么StayGAN仍然在狭域UX中获胜的原因.

在论文摘要中,当你看到"快于传播"时,把它转化为"少步 × 同步成本"或"同步步 × 低成本".其他的都是营销.

## 进一步阅读

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661)GAN文件.
- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114)VAE论文.
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) 关于DDPM的论文.
- [Song et al. (2021). Score-Based Generative Modeling through SDEs](https://arxiv.org/abs/2011.13456)作为SDE的扩散.
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) 流量相匹配的纸.
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206)稳定扩散 3.
