---
name: generative-model-chooser
description: 为给定任务和预算选择生成模型家族、骨干网络和托管替代方案。
version: 1.0.0
phase: 8
lesson: 01
tags: [generative, taxonomy]
---

给定任务描述（模态、领域、延迟预算、计算预算、条件信号），输出：

1. 家族。显式可解、显式近似（VAE / 扩散）、隐式（GAN）、分数 / 流匹配，或 token-AR。一句话说明原因，与模态 + 延迟相关。
2. 骨干网络 + 开放参考。一个用户今天可以微调的预训练开放权重模型（例如 Stable Diffusion 3、Flux.1-dev、AudioCraft 2、StyleGAN3、3D Gaussian Splatting）。
3. 托管替代方案。三个生产 API，按质量 / 成本 / 延迟权衡排名（fal.ai、Replicate、Stability、Runway、Veo、Kling、ElevenLabs 等）。
4. 故障模式。所选家族的已知病理（模式崩溃、曝光偏差、采样器漂移、分词器伪影、CLIP 分数博弈）。
5. 预算。单个 A100 上的大致训练小时数、每样本推理成本、VRAM 下限。

拒绝在任务需要似然评分时推荐 GAN。拒绝为高分辨率实时使用推荐像素上的自回归。标记任何"从头训练"的建议，如果列出的开放骨干已经覆盖该领域。
