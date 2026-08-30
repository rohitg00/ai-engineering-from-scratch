---
name: edge-target-picker
description: 根据设备、模型和延迟预算选择边缘推理目标（Apple ANE、Qualcomm Hexagon、WebGPU/WebLLM、NVIDIA Jetson）和匹配的量化格式。
version: 1.0.0
phase: 17
lesson: 12
tags: [edge, ane, hexagon, webgpu, webllm, jetson, core-ml, qnn, nvfp4]
---

给定部署平台（iOS、Android、浏览器、机器人/汽车/边缘服务器）、模型和延迟/内存预算，生成边缘目标推荐。

生成：

1. 目标。命名特定 NPU/GPU（ANE、Hexagon、WebGPU、Jetson Orin Nano / AGX / Thor）。根据平台和 2026 年运行时覆盖范围证明。
2. 带宽上限。计算理论解码上限：bandwidth_GB_s / model_size_GB。与用户的 tok/s 需求比较。如果上限低于需求，拒绝或提出更小的模型 / 更紧的量化。
3. 量化格式。选择 Q4 GGUF（浏览器/边缘 CPU）、Core ML INT4 + FP16（ANE）、QNN INT8/INT4（Hexagon）或 NVFP4 + FP8 KV（Jetson Thor / Edge-LLM）。
4. 转换管道。命名精确转换器（Core ML converter、Qualcomm AI Hub、WebLLM 的 MLC-LLM、TensorRT-LLM Edge compiler）。
5. 上下文预算。声明与设备 RAM 中的权重一起容纳的最大上下文。对于长上下文用例，指定 KV 量化（Q4 KV）或拒绝。
6. 回退。当设备无法胜任或 WebGPU 不可用时（Firefox Android、旧浏览器），指定具有相同 OpenAI 兼容接口的服务器端 API 回退。

硬性拒绝：
- 承诺高于带宽上限的 tok/s。拒绝——物理限制。
- 在 2026 年通过非 Core ML 运行时直接定位 ANE。只有 Core ML 原生暴露 ANE。
- 假设每个浏览器都有 WebGPU。2026 年覆盖率约为 70-75% 移动端；始终指定回退。

拒绝规则：
- 如果模型 >6 GB 且目标是手机（4-8 GB RAM），拒绝——首先提出更小的模型或激进量化。
- 如果请求是在 iPhone 上的 7B 模型进行 128K 上下文，拒绝——设备 RAM 无法容纳，除非 Q4 KV 加滑动窗口注意力。
- 如果部署需要在 Android 上通过 WebGPU 进行长上下文流式传输，且用户需要 Firefox 支持，拒绝并要求 Chrome 或服务器回退。

输出：一页计划，命名目标、上限、量化、转换器、上下文预算、回退。以单一指标结束：目标机队中最差设备上的观察 tok/s。
