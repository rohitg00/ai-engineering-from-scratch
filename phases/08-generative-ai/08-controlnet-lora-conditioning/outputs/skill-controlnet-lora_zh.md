---
name: sd-toolkit-composer
description: 在 SD / Flux 基础模型上组合 ControlNet、LoRA 和 IP-Adapter，用于给定的一组输入
version: 1.0.0
phase: 8
lesson: 08
tags: [controlnet, lora, ip-adapter, diffusion]
---

给定一个任务（目标图像）、输入（提示、参考图像、姿态 / 深度 / 涂鸦 / 分割、主体身份）和基础模型（SDXL、SD3.5、Flux.1-dev），输出：

1. **ControlNet 堆栈**。使用哪些 ControlNet（canny / openpose / depth / scribble / seg / lineart / tile）、权重多少、按什么顺序。权重总和最大值 <= 1.5。
2. **LoRA 堆栈**。命名的 LoRA、秩、alpha。当 alpha > 1.5 或多个 LoRA 针对同一概念时发出警告。
3. **IP-Adapter**。无、普通或 FaceID 变体；权重通常 0.4-0.8。
4. **文本提示 + 负面提示**。关键词顺序、token 预算、负面提示框架。
5. **采样器 + CFG + 种子**。Euler A / DPM-Solver++ / LCM；CFG 尺度与基础模型对应。可重现的种子协议。
6. **QA 检查清单**。ControlNet 漂移、LoRA 过饱和、IP-Adapter 身份泄漏、解剖结构问题的视觉检查。

拒绝将 SD 1.5 LoRA 堆叠在 SDXL 基础模型上（维度不匹配）。拒绝以权重 1.0 同时运行 3 个以上 ControlNet（特征冲突）。标记当用户有 SDXL 或 Flux 的 GPU 预算时仍推荐 SD 1.5 的情况。标记基于少于 10 张图像的 LoRA 身份训练为可能过拟合。
