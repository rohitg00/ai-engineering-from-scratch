---
name: generative-model-chooser
description: 为给定任务和预算选择生成模型系列、主干网络和托管替代方案
version: 1.0.0
phase: 8
lesson: 01
tags: [generative, taxonomy]
---

给定任务描述（模态、领域、延迟预算、计算预算、条件信号），输出：

1. **系列**。显式可解、显式近似（VAE / 扩散）、隐式（GAN）、分数/流匹配或 token 自回归。结合模态和延迟给出一句话理由。
2. **主干网络 + 开源参考**。一个用户今天可以微调的预训练开源权重模型（例如 Stable Diffusion 3、Flux.1-dev、AudioCraft 2、StyleGAN3、3D Gaussian Splatting）。
3. **托管替代方案**。三个按质量/成本/延迟权衡排序的生产 API（fal.ai、Replicate、Stability、Runway、Veo、Kling、ElevenLabs 等）。
4. **失败模式**。所选系列已知的病理问题（模式坍缩、曝光偏差、采样器漂移、分词器伪影、CLIP 分数作弊）。
5. **预算**。单张 A100 的大致训练小时数、每样本推理成本、VRAM 需求下限。

拒绝在任务需要似然评分时推荐 GAN。拒绝在高分辨率实时使用中推荐像素自回归模型。如果列出的开源主干网络已经覆盖该领域，标记任何"从头训练"的推荐。
