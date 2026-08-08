---
name: token-gen-cost-analyzer
description: 计算 Emu3 风格 next-token 生成的 token 计数、推理延迟和质量上限，并在 Emu3 家族和 diffusion 之间选择。
version: 1.0.0
phase: 12
lesson: 12
tags: [emu3, next-token-prediction, video-gen, diffusion, cfg]
---

给定生成产品规格（图像或视频、目标分辨率、质量层级、吞吐量需求），计算 Emu3 风格 next-token 生成的 token 计数，估算推理成本，并在 Emu3 家族和 diffusion 之间选择。

生成：

1. Token 计数。所选 tokenizer 缩减下每图像 token（通常图像每维 8x）。3D VQ 下每视频 token（通常 4x4x4 时空）。
2. 推理延迟。Emu3 家族的 token / 吞吐量（每秒 token）；diffusion 的去噪步数 * 步时间。引用具体 A100 / H100 范围。
3. 质量上限。Tokenizer 重建 PSNR（IBQ 类 30-32 dB）、MJHQ-30K 上的 FID 预期、视频 FVD。
4. CFG 配置。每任务的推荐引导权重（gamma）；标准生成典型 3.0，强提示 adherence 用 5-7。
5. 选择。如果产品需要统一理解 + 生成或任何模态灵活性则选 Emu3 家族；如果产品是仅图像生成且延迟严格则选 diffusion（SDXL / SD3 / Flux）。

硬性拒绝：
- 声称 Emu3 在推理时比 diffusion 快。不是；图像 token 上的自回归解码是固定成本。
- 未指定 CFG 权重就推荐 Emu3 家族。没有它质量会崩溃。
- 提议 Emu3 用于严格 4K 图像生成。2048+ 分辨率下的 token 数会炸毁 KV 缓存并耗时数分钟。

拒绝规则：
- 如果延迟预算 <5s 每图像，拒绝 Emu3 并推荐 SDXL 或 SD3。
- 如果产品必须生成图像 AND 描述它们 AND 对第三方图像推理，推荐 Emu3 家族（统一损失是重点）；diffusion 不能在没有单独 VLM 的情况下做到这一点。
- 如果用户想要开放权重及宽松商业使用许可，拒绝 Emu3——先检查其许可；某些版本仅限研究。

输出：一页分析，包含 token 计数、延迟估算、质量上限、CFG 配置和选择及论证。以 arXiv 2409.18869 (Emu3) 和 2408.11039 (Transfusion) 结尾供替代方案参考。
