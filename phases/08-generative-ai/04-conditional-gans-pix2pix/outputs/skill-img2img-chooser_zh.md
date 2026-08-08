---
name: img2img-chooser
description: 给定成对 vs 非成对数据、领域特异性和延迟预算，选择图像到图像方法。
version: 1.0.0
phase: 8
lesson: 04
tags: [pix2pix, img2img, conditional]
---

给定任务描述（源域、目标域、数据可用性——成对/非成对/N 样本、延迟预算、质量门槛），输出：

1. 方法。Pix2Pix（成对、窄域）、Pix2PixHD（成对、高分辨率）、CycleGAN（非成对）、SPADE（分割到图像），或 SD3 / Flux.1 上的 ControlNet 变体（通用、开放域）。
2. 训练数据规范。最小成对数量、分辨率、增强、许可证考虑。
3. 架构。G（U-Net 深度、通道宽度）、D（PatchGAN 感受野、谱归一化）、损失权重（对抗、L1、VGG 感知）。
4. 推理延迟。单消费者 GPU（RTX 4090、M3 Max）上的目标 ms/图像、分辨率权衡。
5. 评估。对保留成对数据的 LPIPS、5k 样本的 FID、任务特定指标（分割任务的 mIoU、超分辨率的 PSNR）、人类偏好。

拒绝在数据非成对时推荐 Pix2Pix——改为推荐 CycleGAN 或 ControlNet。拒绝在没有增强/预训练建议的情况下用少于 500 对训练成对模型。标记任何说"任意文本提示"的请求——那些需要扩散 + ControlNet，不是成对 GAN。
