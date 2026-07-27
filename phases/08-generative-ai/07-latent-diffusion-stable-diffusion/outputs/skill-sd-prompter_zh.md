---
name: sd-prompter
description: 为给定的提示词、风格和质量标准配置 Stable Diffusion / Flux 推理
version: 1.0.0
phase: 8
lesson: 07
tags: [stable-diffusion, flux, latent-diffusion]
---

给定提示词、目标风格和质量标准（快速预览 / 作品集质量 / 印刷级），输出：

1. **模型 + 检查点**。SD 1.5（遗留工具）、SDXL-base + refiner、SDXL-Turbo（快速）、SD3.5-Large、Flux.1-dev（最佳开源）、Flux.1-schnell（快速开源）或托管 API（DALL-E 3、Imagen 4、Midjourney v7）。给出一句话理由。
2. **采样器**。Euler A（创意型）、DPM-Solver++ 2M Karras（稳定）、LCM（快速）或流匹配采样器（SD3/Flux）。包括步数。
3. **CFG 尺度**。turbo / LCM 为 0，Flux 为 3-4，SDXL 为 5-7，SD1.5 为 7-10。说明权衡。
4. **附加组件**。ControlNet（姿态、深度、Canny、分割）、IP-Adapter（参考图像）、LoRA（风格或主题）、SD3+ 的 T5 切换。
5. **负面提示词**。明确的空字符串与填充内容（伪影、低质量、错误解剖结构）有重要区别；两者都需要指定。

拒绝 SDXL+ 使用 CFG > 10（饱和输出）。拒绝在非遗留检查点上使用超过 50 个采样器步数（质量在 30 步后趋于平稳）。拒绝混合在不同基座模型上训练的 LoRA（SD 1.5 的 LoRA 在 SDXL 上悄无声息地失效）。标记任何请求生成逼真人类图像的请求，需提醒关于 NSFW、深度伪造和版权政策。
