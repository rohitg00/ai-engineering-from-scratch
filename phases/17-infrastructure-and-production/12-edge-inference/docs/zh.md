# 边缘推理 — Apple Neural Engine、Qualcomm Hexagon、WebGPU/WebLLM、Jetson

> 边缘计算的核心约束是内存带宽，而非算力。移动端 DRAM 带宽为 50-90 GB/s；数据中心 HBM3 可达 2-3 TB/s — 相差 30-50 倍。解码是内存密集型的，因此这一差距是决定性的。2026 年的边缘推理格局分为四大方向。Apple M4/A18 Neural Engine 峰值达 38 TOPS，采用统一内存（无需 CPU↔NPU 拷贝）。Qualcomm Snapdragon X Elite / 8 Gen 4 Hexagon 达 45 TOPS。WebGPU + WebLLM 在 M3 Max 上运行 Llama 3.1 8B（Q4）约 41 tok/s（约为原生性能的 70-80%）；GitHub 17.6k 星标，兼容 OpenAI API，移动端覆盖率约 70-75%。NVIDIA Jetson Orin Nano Super（8GB）可运行 Llama 3.2 3B / Phi-3；AGX Orin 通过 vLLM 运行 gpt-oss-20b 约 40 tok/s；Jetson T4000（JetPack 7.1）性能为 AGX Orin 的 2 倍。TensorRT Edge-LLM 支持 EAGLE-3、NVFP4、chunked prefill — 已于 CES 2026 由 Bosch、ThunderSoft、MediaTek 展示。

**类型：** 学习
**语言：** Python（标准库，简单的带宽受限解码模拟）
**前置要求：** Phase 17 · 04（vLLM 服务内部机制）、Phase 17 · 09（生产级量化）
**时长：** 约 60 分钟

## 学习目标

- 解释为什么移动端 LLM 推理受内存带宽限制，而算力是次要因素。
- 列举四大边缘目标平台（Apple ANE、Qualcomm Hexagon、WebGPU/WebLLM、NVIDIA Jetson），并将每个平台与使用场景对应。
- 了解 2026 年 WebGPU 的覆盖缺口（Firefox Android 追赶中）和 Safari iOS 26 的落地情况。
- 为每个目标平台选择合适的量化格式（ANE 使用 Core ML INT4 + FP16，Hexagon 使用 QNN INT8/INT4，浏览器使用 WebGPU Q4，Jetson Thor 使用 NVFP4）。

## 问题

客户想要一个设备端聊天机器人：语音优先、默认私密、可离线使用。在 MacBook Pro M3 Max 上，Llama 3.1 8B Q4 运行约 55 tok/s — 没问题。但在 iPhone 16 Pro 上，同样模型只能跑 3 tok/s — 不行。在搭载 Snapdragon 8 Gen 3 的中端 Android 上，7 tok/s。在浏览器中通过 Chrome Android v121+ 的 WebGPU 运行，根据设备不同为 4-8 tok/s。

吞吐量的差异并非移植问题。它是带宽差距乘以量化格式再乘以 NPU 是否可从用户空间访问共同作用的结果。2026 年的边缘推理是四个不同的问题，需要四种不同的解决方案。

## 核心概念

### 带宽才是真正的天花板

解码需要为每个 token 读取全部权重。一个 7B 模型在 Q4 量化下为 3.5 GB。以 50 GB/s 的速度读取 3.5 GB 需要 70 ms — 理论上限约为 14 tok/s。在 90 GB/s（高端移动 DRAM）下，理论上限提升至约 25 tok/s。低于此数字，再多的算力也无济于事。

数据中心 HBM3 以 3 TB/s 的速度清除同样的 3.5 GB 仅需 1.2 ms — 理论上限为 830 tok/s。相同模型，相同权重。不同的内存子系统。

### Apple Neural Engine（M4 / A18）

- 最高 38 TOPS。统一内存（CPU 和 ANE 共享同一内存池）— 无拷贝开销。
- 通过 Core ML + `.mlmodel` 编译模型访问，或通过 PyTorch 的 Metal Performance Shaders（MPS）访问。
- Llama.cpp Metal 后端使用 MPS 而非直接使用 ANE；原生 ANE 需要使用 Core ML 转换。
- 2026 年 iOS 应用的最佳实践路径：Core ML 搭配 INT4 权重 + FP16 激活。

### Qualcomm Hexagon（Snapdragon X Elite / 8 Gen 4）

- 最高 45 TOPS。在 SoC 中与 CPU 和 GPU 集成，但有独立的内存域。
- QNN（Qualcomm Neural Network）SDK 和 AI Hub 提供从 PyTorch/ONNX 的转换能力。
- Chat 模板、Llama 3.2、Phi-3 均作为一等公民在 AI Hub 上发布。

### Intel / AMD NPU（Lunar Lake、Ryzen AI 300）

- 40-50 TOPS。软件生态落后于 Apple/Qualcomm；OpenVINO 正在改进但仍属小众。
- 最适合 Windows ARM Copilot 应用；在 AMD/Intel 桌面端原生支持本地优先场景。

### WebGPU + WebLLM

- 通过 WebGPU 计算着色器在浏览器中运行模型；无需安装。
- Llama 3.1 8B Q4 在 M3 Max 上约 41 tok/s — 约为同一后端原生性能的 70-80%。
- WebLLM 在 GitHub 上拥有 17.6k 星标；兼容 OpenAI 的 JS API；Apache 2.0 许可。
- 2026 年覆盖率：Chrome Android v121+、Safari iOS 26 GA、Firefox Android 仍在追赶。整体移动端覆盖率约 70-75%。

### NVIDIA Jetson 系列

- Orin Nano Super（8GB）：可运行 Llama 3.2 3B、Phi-3，tok/s 表现良好。
- AGX Orin：通过 vLLM 运行 gpt-oss-20b 约 40 tok/s。
- Thor / T4000（JetPack 7.1）：性能为 AGX Orin 的 2 倍，支持 EAGLE-3 和 NVFP4。
- TensorRT Edge-LLM（2026）支持 EAGLE-3 推测解码、NVFP4 权重、chunked prefill — 数据中心优化移植到边缘。

### 各目标平台的量化选择

| 目标平台 | 格式 | 备注 |
|--------|--------|-------|
| Apple ANE | INT4 权重 + FP16 激活 | Core ML 转换路径 |
| Qualcomm Hexagon | QNN INT8 / INT4 | AI Hub 转换器 |
| WebGPU / WebLLM | Q4 MLC（q4f16_1） | 使用 `mlc_llm convert_weight` + 编译的 `.wasm`；不支持 GGUF |
| Jetson Orin Nano | Q4 GGUF 或 TRT-LLM INT4 | 内存受限 |
| Jetson AGX / Thor | NVFP4 + FP8 KV | Edge-LLM 路径 |

### 边缘端的长上下文陷阱

Llama 3.1 的 128K 上下文是数据中心的功能。在配备 8GB RAM 的手机上，4GB 模型 + 2GB KV 缓存（用于 32K token）+ 系统开销 = 内存溢出。边缘部署应将上下文控制在 4K-8K，除非接受激进的 KV 量化（Q4 KV）。

### 语音是杀手级应用

语音助手对延迟敏感（首 token < 500 ms）。本地推理完全消除了网络延迟。结合语音转文本（Whisper Turbo 变体可在边缘运行），边缘推理成为生产级的语音闭环。

### 需要记住的关键数据

- Apple M4 / A18 ANE：38 TOPS。
- Qualcomm Hexagon SD X Elite：45 TOPS。
- WebLLM M3 Max：Llama 3.1 8B Q4 约 41 tok/s。
- AGX Orin：通过 vLLM 运行 gpt-oss-20b 约 40 tok/s。
- 数据中心与边缘带宽差距：30-50 倍。
- WebGPU 移动端覆盖率：约 70-75%（Firefox Android 落后）。

## 实践

`code/main.py` 通过带宽受限的数学计算，计算各边缘目标平台的解码理论上限，并与实测基准进行对比，突出显示带宽（而非算力）才是瓶颈。

## 交付

本课程产出 `outputs/skill-edge-target-picker.md`。根据平台（iOS/Android/浏览器/Jetson）、模型以及延迟/内存预算，选择量化格式和转换管线。

## 练习

1. 运行 `code/main.py`。对于在 Snapdragon 8 Gen 3（约 77 GB/s 带宽）上使用 Q4 量化的 7B 模型，计算解码理论上限。与实测的 6-8 tok/s 对比 — 运行时效率如何？
2. Android 上的 WebGPU 需要 Chrome v121+。为旧版浏览器设计一个降级方案 — 通过同一兼容 OpenAI 的 API 走服务端。
3. 你的 iOS 应用需要 4K 上下文流式传输。在 iPhone 16 上，哪种模型/格式组合能使活跃内存保持在 4GB 以下？
4. Jetson AGX Orin 以 40 tok/s 运行 gpt-oss-20b。Jetson Nano 只能容纳 3B 模型。如果你的产品需要同时适配两者，如何统一推理栈？
5. 论证"WebLLM 在 2026 年是否已生产就绪"。引用覆盖率、性能表现以及 Firefox Android 的差距。

## 关键术语

| 术语 | 字面意思 | 实际含义 |
|------|----------------|------------------------|
| ANE | "Apple 神经引擎" | M 系列和 A 系列设备端 NPU；统一内存 |
| Hexagon | "Qualcomm NPU" | Snapdragon NPU；通过 QNN SDK 访问 |
| WebGPU | "浏览器 GPU" | W3C 标准化的浏览器 GPU API；Chrome/Safari 2026 |
| WebLLM | "浏览器 LLM 运行时" | MLC-LLM 项目；Apache 2.0；兼容 OpenAI 的 JS |
| Jetson | "NVIDIA 边缘平台" | Orin Nano / AGX / Thor / T4000 系列 |
| TRT Edge-LLM | "边缘 TensorRT" | 2026 年 TensorRT-LLM 的边缘移植版；EAGLE-3 + NVFP4 |
| 统一内存 | "共享内存池" | CPU 和 NPU 共享同一 RAM；无拷贝开销 |
| 带宽受限 | "内存瓶颈" | 解码受限于每秒读取权重的字节数 |
| Core ML | "Apple 转换框架" | Apple 用于 ANE 原生模型的框架 |
| QNN | "Qualcomm 软件栈" | Qualcomm Neural Network SDK |

## 延伸阅读

- [设备端 LLM 技术现状 2026](https://v-chandra.github.io/on-device-llms/) — 全景与基准测试。
- [NVIDIA Jetson 边缘 AI](https://developer.nvidia.com/blog/getting-started-with-edge-ai-on-nvidia-jetson-llms-vlms-and-foundation-models-for-robotics/) — Orin / AGX / Thor。
- [NVIDIA TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm/) — 2026 年边缘移植版发布公告。
- [WebLLM（arXiv:2412.15803）](https://arxiv.org/html/2412.15803v2) — 设计与基准测试。
- [Apple Core ML](https://developer.apple.com/documentation/coreml) — ANE 原生转换。
- [Qualcomm AI Hub](https://aihub.qualcomm.com/) — 面向 Hexagon 的预转换模型。
