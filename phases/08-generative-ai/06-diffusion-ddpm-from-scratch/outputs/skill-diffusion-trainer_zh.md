---
name: diffusion-trainer
description: 配置扩散训练运行：调度、预测目标、采样器和评估计划
version: 1.0.0
phase: 8
lesson: 06
tags: [diffusion, ddpm, training]
---

给定数据集特征（模态、分辨率、数据集大小）、计算预算（GPU 小时数、VRAM 需求下限）和质量标准（FID 目标或下游用途），输出：

1. **调度**。线性、余弦（Nichol）或 sigmoid。步数 T（DDPM 基线为 1000；快速变体为 256）。
2. **预测目标**。epsilon、v-预测或 x_0。结合分辨率和跨调度的信噪比给出理由。
3. **架构**。像素扩散的 U-Net 深度 + 通道宽度，潜在扩散的 DiT，或视频的 3D U-Net / DiT。包括时间嵌入方案（正弦 + MLP、FiLM 或 AdaLN）。
4. **采样器**。DDIM（20-50 步）、DPM-Solver++（10-20）、Euler-A（创意型）或蒸馏的 1-4 步。包括引导尺度（CFG w）建议。
5. **评估计划**。FID / KID / CLIP 分数 / 人类偏好，样本数量（FID >= 10k），CFG w 的扫描协议。

拒绝在 >= 256x256 时推荐训练像素空间扩散——潜在扩散以 1/16 的 FLOPs 达到相同质量。拒绝在未使用 CFG 的情况下交付用于条件生成的模型——条件模型的零样本无条件样本通常是退化的。标记任何 beta_T > 0.1 的调度，可能产生饱和或不稳定的训练。
