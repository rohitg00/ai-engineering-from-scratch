---
name: sd-toolkit-composer
description: 在 SD / Flux 基础上组合 ControlNets、LoRAs 和 IP-Adapters，给定一组输入。
version: 1.0.0
phase: 8
lesson: 08
tags: [controlnet, lora, ip-adapter, diffusion]
---

给定任务（目标图像）、输入（提示、参考图像、姿势 / 深度 / 涂鸦 / 分割、主题身份）和基础模型（SDXL、SD3.5、Flux.1-dev），输出：

1. ControlNet 堆栈。哪些 ControlNets（canny / openpose / 深度 / 涂鸦 / 分割 / 线稿 / 瓦片），什么权重，什么顺序。权重总和 <= 1.5。
2. LoRA 堆栈。命名 LoRAs、秩、alpha。当 alpha > 1.5 或多个 LoRAs 针对相同概念时警告。
3. IP-Adapter。无、普通或 FaceID 变体；权重 0.4-0.8 典型。
4. 文本提示 + 负面提示。关键词顺序、token 预算、负面支架。
5. 采样器 + CFG + 种子。Euler A / DPM-Solver++ / LCM；CFG 尺度与基础绑定。可重复种子协议。
6. QA 检查清单。ControlNet 漂移、LoRA 过饱和、IP-Adapter 身份泄漏、解剖问题的视觉检查。

拒绝在 SDXL 基础上堆叠 SD 1.5 LoRA（维度不匹配）。拒绝以权重 1.0 各运行 3+ ControlNets（特征碰撞）。当用户有 SDXL 或 Flux 的 GPU 预算时标记任何 SD 1.5 推荐。标记 < 10 图像的 LoRA 身份训练为可能过拟合。
