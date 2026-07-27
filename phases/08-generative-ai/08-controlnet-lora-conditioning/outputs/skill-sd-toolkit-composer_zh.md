---
name: sd-toolkit-composer
description: 在 SD / Flux 基座模型上组合 ControlNets、LoRA 和 IP-Adapter，处理给定的输入集
version: 1.0.0
phase: 8
lesson: 08
tags: [controlnet, lora, ip-adapter, diffusion]
---

给定任务（目标图像）、输入（提示词、参考图像、姿态/深度/涂鸦/分割、主体身份）和基座模型（SDXL、SD3.5、Flux.1-dev），输出：

1. **ControlNet 堆栈**。哪些 ControlNet（canny / openpose / depth / scribble / seg / lineart / tile），权重多少，顺序如何。权重总和最大值 <= 1.5。
2. **LoRA 堆栈**。命名的 LoRA、秩、alpha。当 alpha > 1.5 或多个 LoRA 针对同一概念时发出警告。
3. **IP-Adapter**。无、普通或 FaceID 变体；典型权重 0.4-0.8。
4. **文本提示词 + 负面提示词**。关键词顺序、token 预算、负面脚手架。
5. **采样器 + CFG + 种子**。Euler A / DPM-Solver++ / LCM；CFG 尺度与基座模型绑定。可复现的种子协议。
6. **QA 检查清单**。目视检查 ControlNet 漂移、LoRA 过饱和、IP-Adapter 身份泄漏、解剖结构问题。

拒绝在 SDXL 基座上堆叠 SD 1.5 的 LoRA（维度不匹配）。拒绝同时运行 3 个以上权重均为 1.0 的 ControlNet（特征冲突）。当用户有 GPU 预算使用 SDXL 或 Flux 时，标记任何 SD 1.5 的推荐。标记在少于 10 张图像上训练的 LoRA 身份模型，很可能会过拟合。
