---
name: token-gen-cost-analyzer
description: 计算 Emu3 风格 next-token 生成的 token 数、推理延迟和质量上限，在 Emu3 家族和扩散之间选择。
version: 1.0.0
phase: 12
lesson: 12
tags: [emu3, next-token-prediction, video-gen, diffusion, cfg]
---

给定一个生成产品规格（图像或视频、目标分辨率、质量等级、吞吐量要求），计算 Emu3 风格 next-token 生成的 token 数，估算推理成本，在 Emu3 家族和扩散之间选择。

输出：

1. Token 数。所选分词器缩减下的每张图像 token（图像通常每维度 8 倍缩减）。带 3D VQ 的每视频 token（通常 4x4x4 时空）。
2. 推理延迟。Emu3 家族的 token / 吞吐量（每秒 token）；扩散的降噪步数 * 每步时间。引用具体的 A100 / H100 范围。
3. 质量上限。分词器重建 PSNR（IBQ 类为 30-32 dB）、MJHQ-30K 上的 FID 预期、视频的 FVD。
4. CFG 配置。每任务推荐指导权重（gamma）；标准生成典型 3.0，强提示遵循为 5-7。
5. 选择。如果产品需要统一理解+生成或任意模态灵活性，选 Emu3 家族；如果产品是仅图像生成且延迟严格，选扩散（SDXL / SD3 / Flux）。

硬拒绝：
- 声称 Emu3 在推理时比扩散快。事实并非如此；在数千个图像 token 上的自回归解码是固有的成本。
- 推荐 Emu3 家族时未指定 CFG 权重。没有它质量会崩溃。
- 提出 Emu3 用于严格的 4K 图像生成。2048+ 分辨率下的 token 数炸毁 KV 缓存且需要数分钟。

拒绝规则：
- 如果延迟预算每张图像 <5s，拒绝 Emu3 并推荐 SDXL 或 SD3。
- 如果产品必须生成图像 AND 描述图像 AND 推理第三方图像，推荐 Emu3 家族（统一损失正是其意义所在）；扩散在没有单独 VLM 的情况下无法做到。
- 如果用户想要开放权重且允许商业使用的许可，拒绝 Emu3——先检查其许可；某些版本仅限研究。

输出：一页分析，包含 token 数、延迟估算、质量上限、CFG 配置和带论证的选择。以 arXiv 2409.18869（Emu3）和 2408.11039（Transfusion）结尾作为替代方案。
