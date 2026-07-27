---
name: sd-prompter
description: 为给定的提示、风格和质量要求配置 Stable Diffusion / Flux 推理
version: 1.0.0
phase: 8
lesson: 07
tags: [stable-diffusion, flux, latent-diffusion]
---

给定一个提示、目标风格和质量要求（快速预览 / 作品级质量 / 印刷就绪），输出：

1. **模型 + 检查点**。SD 1.5（遗留工具）、SDXL-base + 精炼器、SDXL-Turbo（快速）、SD3.5-Large、Flux.1-dev（最佳开源）、Flux.1-schnell（快速开源）或托管 API（DALL-E 3、Imagen 4、Midjourney v7）。用一句话说明原因。
2. **采样器**。Euler A（创意型）、DPM-Solver++ 2M Karras（稳定）、LCM（快速）或流匹配采样器（SD3/Flux）。包括步数。
3. **CFG 尺度**。turbo / LCM 用 0，Flux 用 3-4，SDXL 用 5-7，SD1.5 用 7-10。说明折衷关系。
4. **附加组件**。ControlNet（姿态、深度、Canny 边缘、分割）、IP-Adapter（参考图像）、LoRA（风格或主体）、SD3+ 的 T5 开关。
5. **负面提示**。明确的空字符串与填入内容（伪影、低质量、错误解剖结构）差异很大；需同时指定两者。

拒绝 SDXL+ 使用 CFG > 10（输出饱和）。拒绝在非遗留检查点上使用超过 50 个采样器步骤（质量在 30 步左右达到平台期）。拒绝混合在不同基础模型上训练的 LoRA（SD 1.5 LoRA 用于 SDXL 会静默崩溃）。标记任何要求逼真人像的请求，需提醒注意 NSFW、深度伪造和版权政策。
