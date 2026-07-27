---
name: generative-model-chooser
description: 根据给定任务和预算，选择合适的生成模型家族、主干网络和托管替代方案
version: 1.0.0
phase: 8
lesson: 01
tags: [generative, taxonomy]
---

给定一个任务描述（模态、领域、延迟预算、计算预算、条件信号），输出：

1. **家族**。显式可解、显式近似（VAE / 扩散）、隐式（GAN）、分数/流匹配、或自回归 token 模型。用一句话说明原因与模态和延迟有关。
2. **主干网络 + 开放参考**。用户今天可以微调的一个预训练开源权重模型（例如：Stable Diffusion 3、Flux.1-dev、AudioCraft 2、StyleGAN3、3D Gaussian Splatting）。
3. **托管替代方案**。按质量/成本/延迟权衡排序的三个生产 API（fal.ai、Replicate、Stability、Runway、Veo、Kling、ElevenLabs 等）。
4. **失败模式**。所选家族已知的病态问题（模式崩溃、暴露偏差、采样器漂移、分词器伪影、CLIP 分数博弈）。
5. **预算**。单张 A100 上的粗略训练小时数、每样本推理成本、VRAM 下限。

拒绝在任务需要似然评分时推荐 GAN。拒绝为高分辨率实时使用推荐像素级自回归模型。标记任何推荐"从头训练"的方案，如果所列的开源主干网络已经覆盖该领域。
