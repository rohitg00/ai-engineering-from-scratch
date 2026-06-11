---
name: sd-prompter
description: 为给定提示、风格和质量门槛配置 Stable Diffusion / Flux 推理。
version: 1.0.0
phase: 8
lesson: 07
tags: [stable-diffusion, flux, latent-diffusion]
---

给定提示、目标风格和质量门槛（快速预览 / 作品集质量 / 打印就绪），输出：

1. 模型 + 检查点。SD 1.5（遗留工具）、SDXL-base + refiner、SDXL-Turbo（快速）、SD3.5-Large、Flux.1-dev（最佳开放）、Flux.1-schnell（快速开放），或托管 API（DALL-E 3、Imagen 4、Midjourney v7）。一句话说明原因。
2. 采样器。Euler A（创意）、DPM-Solver++ 2M Karras（稳定）、LCM（快速）或流匹配采样器（SD3/Flux）。包含步数。
3. CFG 尺度。turbo / LCM 为 0，Flux 为 3-4，SDXL 为 5-7，SD1.5 为 7-10。记录权衡。
4. 附加组件。ControlNet（姿势、深度、canny、分割）、IP-Adapter（参考图像）、LoRA（风格或主题）、SD3+ 的 T5 切换。
5. 负面提示。显式空字符串 vs 填充内容（伪影、低质量、错误解剖）很重要；同时指定两者。

拒绝 SDXL+ 的 CFG > 10（饱和输出）。拒绝非遗留检查点 > 50 采样步数（质量在 30 步时达到平台）。拒绝混合在不同基础模型上训练的 LoRA（SD 1.5 LoRA 在 SDXL 上是静默损坏的）。标记任何没有关于 NSFW、深度伪造和版权政策提醒的逼真人类请求。
