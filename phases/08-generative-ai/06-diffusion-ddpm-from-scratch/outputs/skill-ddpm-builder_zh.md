---
name: diffusion-trainer
description: 配置扩散训练运行：调度、预测目标、采样器和评估计划
version: 1.0.0
phase: 8
lesson: 06
tags: [diffusion, ddpm, training]
---

给定一个数据集画像（模态、分辨率、数据集大小）、计算预算（GPU 小时数、VRAM 下限）和质量要求（目标 FID 或下游用途），输出：

1. **调度**。线性、余弦（Nichol）或 sigmoid。步数 T（DDPM 基线用 1000；快速变体用 256）。
2. **预测目标**。epsilon、v-预测或 x_0。原因与分辨率和整个调度中信噪比有关。
3. **架构**。像素扩散用 U-Net 深度 + 通道宽度、潜在扩散用 DiT、视频用 3D U-Net / DiT。包括时间嵌入方案（正弦 + MLP、FiLM 或 AdaLN）。
4. **采样器**。DDIM（20-50 步）、DPM-Solver++（10-20）、Euler-A（创意型）或蒸馏的 1-4 步。包括引导尺度（CFG w）建议。
5. **评估计划**。FID / KID / CLIP 分数 / 人工偏好，带样本计数（FID 需 >= 1 万）、CFG w 的扫描协议。

拒绝在潜在扩散能以 1/16 的 FLOPs 达到相同质量时，推荐在 >= 256x256 分辨率下训练像素空间扩散。拒绝发布没有 CFG 的条件生成模型——条件模型零样本无条件样本通常是退化的。标记任何 beta_T > 0.1 的调度可能导致饱和或不稳定的训练。
