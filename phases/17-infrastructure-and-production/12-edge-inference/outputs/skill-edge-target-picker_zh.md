---
name: edge-target-picker
description: 根据设备、模型和延迟预算，选择边缘推理目标（Apple ANE、Qualcomm Hexagon、WebGPU/WebLLM、NVIDIA Jetson）及匹配的量化格式。
version: 1.0.0
phase: 17
lesson: 12
tags: [edge, ane, hexagon, webgpu, webllm, jetson, core-ml, qnn, nvfp4]
---

给定部署平台（iOS、Android、浏览器、机器人/汽车/边缘服务器）、模型和延迟/内存预算，生成边缘目标推荐。

输出：

1. **目标**。指明具体的 NPU/GPU（ANE、Hexagon、WebGPU、Jetson Orin Nano/AGX/Thor）。根据平台和 2026 年运行时覆盖范围论证。
2. **带宽上限**。计算理论解码上限：带宽_GB_s / 模型大小_GB。与用户的 tok/s 需求比较。如果上限低于需求，拒绝或提出更小的模型/更紧的量化。
3. **量化格式**。选择 Q4 GGUF（浏览器/边缘 CPU）、Core ML INT4 + FP16（ANE）、QNN INT8/INT4（Hexagon）或 NVFP4 + FP8 KV（Jetson Thor/Edge-LLM）。
4. **转换管道**。指明确切的转换器（Core ML converter、Qualcomm AI Hub、MLC-LLM 用于 WebLLM、TensorRT-LLM Edge compiler）。
5. **上下文预算**。声明在设备 RAM 中与权重一起容纳的最大上下文长度。对于长上下文用例，指定 KV 量化（Q4 KV）或拒绝。
6. **回退方案**。当设备不支持或 WebGPU 不可用时（Firefox Android、旧版浏览器），指定具有相同 OpenAI 兼容接口的服务端 API 回退方案。

**硬性拒绝条件：**
- 承诺高于带宽上限的 tok/s。拒绝——物理限制。
- 在 2026 年通过非 Core ML 运行时直接定位 ANE。只有 Core ML 原生暴露 ANE。
- 假设 WebGPU 在每台浏览器上都可用。2026 年移动端覆盖率约 70-75%；始终指定回退方案。

**拒绝规则：**
- 如果模型 >6 GB 且目标为手机（4-8 GB RAM），拒绝——先提出更小的模型或激进的量化。
- 如果请求是在 iPhone 上的 7B 模型上使用 128K 上下文，拒绝——没有 Q4 KV 加滑动窗口注意力，设备 RAM 无法容纳。
- 如果部署需要通过 Android 上的 WebGPU 进行长上下文流式传输且用户要求 Firefox 支持，拒绝并要求 Chrome 或服务端回退方案。

**输出**：一页方案，指明目标、上限、量化、转换器、上下文预算、回退方案。最后给出单一指标：目标舰队中最差设备上观察到的 tok/s。
