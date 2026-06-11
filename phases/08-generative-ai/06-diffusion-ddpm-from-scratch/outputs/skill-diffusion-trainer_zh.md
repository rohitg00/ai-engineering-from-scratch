---
name: diffusion-trainer
description: 配置扩散训练运行：计划、预测目标、采样器和评估计划。
version: 1.0.0
phase: 8
lesson: 06
tags: [diffusion, ddpm, training]
---

给定数据集概况（模态、分辨率、数据集大小）、计算预算（GPU 小时、VRAM 下限）和质量门槛（FID 目标或下游用途），输出：

1. 计划。线性、余弦（Nichol）或 sigmoid。步数 T（DDPM 基线 1000；更快变体 256）。
2. 预测目标。epsilon、v-prediction 或 x_0。原因与分辨率和计划中的信噪比相关。
3. 架构。像素扩散的 U-Net 深度 + 通道宽度、潜在扩散的 DiT，或视频的 3D U-Net / DiT。包含时间嵌入方案（正弦 + MLP、FiLM 或 AdaLN）。
4. 采样器。DDIM（20-50 步）、DPM-Solver++（10-20）、Euler-A（创意）或蒸馏 1-4 步。包含引导尺度（CFG w）推荐。
5. 评估计划。FID / KID / CLIP 分数 / 人类偏好，样本数（FID >=10k）、CFG w 的扫描协议。

拒绝在潜在扩散以 1/16 的 FLOP 达到相同质量时推荐训练像素空间扩散 >=256x256。拒绝交付没有 CFG 的条件生成模型——条件模型的零样本无条件样本通常退化。标记任何 beta_T > 0.1 的计划为可能产生饱和或不稳定训练。
