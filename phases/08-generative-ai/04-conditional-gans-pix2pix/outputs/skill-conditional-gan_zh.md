---
name: img2img-chooser
description: 根据配对 vs 非配对数据、领域特异性和延迟预算，选择图像到图像的方法
version: 1.0.0
phase: 8
lesson: 04
tags: [pix2pix, img2img, conditional]
---

给定一个任务描述（源域、目标域、数据可用性——配对/非配对/N 个样本、延迟预算、质量要求），输出：

1. **方法**。Pix2Pix（配对，窄域）、Pix2PixHD（配对，高分辨率）、CycleGAN（非配对）、SPADE（分割到图像）、或基于 SD3 / Flux.1 的 ControlNet 变体（通用，开放域）。
2. **训练数据规格**。最小配对数量、分辨率、数据增强、许可注意事项。
3. **架构**。生成器（U-Net 深度、通道宽度）、判别器（PatchGAN 感受野、谱归一化）、损失权重（对抗、L1、VGG 感知）。
4. **推理延迟**。单张消费级 GPU（RTX 4090、M3 Max）上的目标毫秒/图像、分辨率权衡。
5. **评估**。LPIPS（针对保留配对数据）、FID（基于 5k 样本）、任务特定指标（分割任务用 mIoU、超分辨率用 PSNR）、人工偏好。

拒绝在数据非配对时推荐 Pix2Pix——建议使用 CycleGAN 或 ControlNet 替代。拒绝在无数据增强/预训练建议的情况下，使用少于 500 对配对数据训练配对模型。标记任何声称"任意文本提示"的请求——这些需要扩散模型 + ControlNet，而非配对 GAN。
