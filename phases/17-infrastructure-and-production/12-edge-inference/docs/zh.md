# 12 · 边缘推理 —— Apple Neural Engine、Qualcomm Hexagon、WebGPU/WebLLM、Jetson

> 边缘推理的核心约束是「内存带宽（memory bandwidth）」，而非算力。移动端 DRAM 的带宽在 50-90 GB/s；数据中心的 HBM3 可达 2-3 TB/s —— 相差 30-50 倍。解码（decode）是受内存带宽限制的，因此这一差距起决定性作用。到 2026 年，整个格局分化为四条路线。Apple M4/A18 的 Neural Engine 峰值算力为 38 TOPS，配合「统一内存（unified memory）」（CPU↔NPU 之间无需拷贝）。Qualcomm Snapdragon X Elite / 8 Gen 4 的 Hexagon 达到 45 TOPS。WebGPU + WebLLM 在 M3 Max 上运行 Llama 3.1 8B（Q4）可达约 41 tok/s（约为原生性能的 70-80%）；GitHub 上 17.6k stars，提供与 OpenAI 兼容的 API，移动端覆盖率约 70-75%。NVIDIA Jetson Orin Nano Super（8GB）可容纳 Llama 3.2 3B / Phi-3；AGX Orin 通过 vLLM 运行 gpt-oss-20b 可达约 40 tok/s；Jetson T4000（JetPack 7.1）的性能是 AGX Orin 的 2 倍。TensorRT Edge-LLM 支持 EAGLE-3、NVFP4、分块预填充（chunked prefill）—— Bosch、ThunderSoft、MediaTek 已在 CES 2026 上展示。

**类型：** 学习
**语言：** Python（标准库，受带宽限制的玩具级解码模拟器）
**前置：** 阶段 17 · 04（vLLM 服务内部原理），阶段 17 · 09（生产环境量化）
**时长：** 约 60 分钟

## 学习目标

- 解释为什么移动端 LLM 推理是受内存带宽限制的，而算力只是次要因素。
- 列举四个边缘目标平台（Apple ANE、Qualcomm Hexagon、WebGPU/WebLLM、NVIDIA Jetson），并将每个平台对应到一种使用场景。
- 说出 2026 年的 WebGPU 覆盖率缺口（Firefox Android 正在追赶）以及 Safari iOS 26 的落地情况。
- 为每个目标平台选择一种量化格式（ANE 用 Core ML INT4 + FP16，Hexagon 用 QNN INT8/INT4，浏览器用 WebGPU Q4，Jetson Thor 用 NVFP4）。

## 问题

某客户想要一个端侧聊天机器人：语音优先、默认隐私、可离线工作。在 MacBook Pro M3 Max 上，Llama 3.1 8B Q4 运行速度约为 55 tok/s —— 没问题。在 iPhone 16 Pro 上，同一模型只能跑 3 tok/s —— 不行。在搭载 Snapdragon 8 Gen 3 的中端 Android 上是 7 tok/s。在 Chrome Android v121+ 上通过 WebGPU 运行,则视设备而定为 4-8 tok/s。

这种吞吐量差异并非移植问题。它等于带宽差距乘以量化格式，再乘以 NPU 是否能从用户态访问。2026 年的边缘推理是四个不同的问题，对应四种不同的解决方案。

## 概念

### 带宽才是真正的天花板

解码会为每个 token 读取整套权重。一个 Q4 格式的 7B 模型大小为 3.5 GB。以 50 GB/s 的速度读取 3.5 GB 需要 70 ms —— 理论天花板约为 14 tok/s。在 90 GB/s（高端移动端 DRAM）下，天花板上移到约 25 tok/s。低于这个数字时，再多的算力也无济于事。

数据中心的 HBM3 以 3 TB/s 的速度读取同样的 3.5 GB 只需 1.2 ms —— 天花板为 830 tok/s。同样的模型，同样的权重，只是内存子系统不同。

### Apple Neural Engine（M4 / A18）

- 最高 38 TOPS。统一内存（CPU 和 ANE 共享同一内存池）—— 无拷贝开销。
- 通过 Core ML + 已编译的 `.mlmodel` 模型访问，或通过 PyTorch 经由 Metal Performance Shaders（MPS）访问。
- Llama.cpp 的 Metal 后端使用的是 MPS，而非直接使用 ANE；原生 ANE 需要进行 Core ML 转换。
- 2026 年 iOS 应用的最佳实践路径：Core ML，采用 INT4 权重 + FP16 激活。

### Qualcomm Hexagon（Snapdragon X Elite / 8 Gen 4）

- 最高 45 TOPS。与 CPU 和 GPU 集成在 SoC 中，但内存域是独立的。
- QNN（Qualcomm Neural Network）SDK 和 AI Hub 提供从 PyTorch/ONNX 的转换。
- 聊天模板、Llama 3.2、Phi-3 都作为一等公民产物在 AI Hub 上提供。

### Intel / AMD NPU（Lunar Lake、Ryzen AI 300）

- 40-50 TOPS。软件落后于 Apple/Qualcomm；OpenVINO 正在改进但仍属小众。
- 最适合 Windows ARM 上的 copilot 应用；在 AMD/Intel 桌面端原生支持本地优先（local-first）场景。

### WebGPU + WebLLM

- 通过 WebGPU 计算着色器（compute shader）在浏览器中运行模型；无需安装。
- 在 M3 Max 上 Llama 3.1 8B Q4 可达约 41 tok/s —— 由于使用同一后端，约为原生性能的 70-80%。
- WebLLM 在 GitHub 上有 17.6k stars；提供与 OpenAI 兼容的 JS API；Apache 2.0 协议。
- 2026 年覆盖情况：Chrome Android v121+、Safari iOS 26 正式版（GA），Firefox Android 仍在追赶中。整体移动端覆盖率约 70-75%。

### NVIDIA Jetson 系列

- Orin Nano Super（8GB）：能以不错的 tok/s 运行 Llama 3.2 3B、Phi-3。
- AGX Orin：通过 vLLM 运行 gpt-oss-20b 可达约 40 tok/s。
- Thor / T4000（JetPack 7.1）：性能是 AGX Orin 的 2 倍，支持 EAGLE-3 和 NVFP4。
- TensorRT Edge-LLM（2026）支持 EAGLE-3 推测解码（speculative decoding）、NVFP4 权重、分块预填充 —— 将数据中心的优化技术移植到了边缘端。

### 各目标平台的量化选择

| 目标平台 | 格式 | 说明 |
|--------|--------|-------|
| Apple ANE | INT4 权重 + FP16 激活 | Core ML 转换路径 |
| Qualcomm Hexagon | QNN INT8 / INT4 | AI Hub 转换器 |
| WebGPU / WebLLM | Q4 MLC（q4f16_1） | 使用 `mlc_llm convert_weight` + 已编译的 `.wasm`；不支持 GGUF |
| Jetson Orin Nano | Q4 GGUF 或 TRT-LLM INT4 | 受内存带宽限制 |
| Jetson AGX / Thor | NVFP4 + FP8 KV | Edge-LLM 路径 |

### 边缘端的长上下文陷阱

Llama 3.1 的 128K 上下文是一项数据中心特性。在一部 8 GB RAM 的手机上，4 GB 模型 + 32K token 的 2 GB KV 缓存 + 操作系统开销 = 内存溢出（OOM）。边缘部署会把上下文控制在 4K-8K，除非能接受激进的 KV 量化（Q4 KV）。

### 语音是杀手级应用

语音智能体对延迟敏感（首 token < 500 ms）。本地推理完全消除了网络延迟。再结合语音转文本（Whisper Turbo 的各种变体可在边缘端运行），边缘推理就成为了生产级别的语音闭环。

### 你应该记住的数字

- Apple M4 / A18 ANE：38 TOPS。
- Qualcomm Hexagon SD X Elite：45 TOPS。
- WebLLM M3 Max：Llama 3.1 8B Q4 约 41 tok/s。
- AGX Orin：通过 vLLM 运行 gpt-oss-20b 约 40 tok/s。
- 数据中心与边缘的带宽差距：30-50 倍。
- WebGPU 移动端覆盖率：约 70-75%（Firefox Android 落后）。

## 动手用

`code/main.py` 基于受带宽限制的数学计算，得出各边缘目标平台的理论解码吞吐量天花板。它会与实测基准对比，并指出在哪些场景中瓶颈是带宽而非算力。

## 交付它

本课会产出 `outputs/skill-edge-target-picker.md`。给定平台（iOS/Android/浏览器/Jetson）、模型，以及延迟/内存预算，它会选出一种量化格式和转换管线。

## 练习

1. 运行 `code/main.py`。对于一个在 Snapdragon 8 Gen 3（带宽约 77 GB/s）上以 Q4 运行的 7B 模型，计算其解码天花板。与实测的 6-8 tok/s 对比 —— 该运行时是否高效？
2. Android 上的 WebGPU 要求 Chrome v121+。为更老的浏览器设计一个回退方案 —— 通过同一套与 OpenAI 兼容的 API 在服务端运行。
3. 你的 iOS 应用需要 4K 上下文的流式输出。哪种模型/格式组合能让你在 iPhone 16 上把活跃内存控制在 4 GB 以下？
4. Jetson AGX Orin 以 40 tok/s 运行 gpt-oss-20b。Jetson Nano 只能容纳 3B 模型。如果你的产品两者都要支持，你如何统一推理技术栈？
5. 论证「WebLLM 在 2026 年是否已达到生产可用」。引用覆盖率、性能以及 Firefox Android 缺口加以论述。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| ANE | “苹果神经引擎” | M 系列和 A 系列芯片中的端侧 NPU；统一内存 |
| Hexagon | “高通 NPU” | Snapdragon 的 NPU；通过 QNN SDK 访问 |
| WebGPU | “浏览器 GPU” | W3C 标准化的浏览器 GPU API；2026 年的 Chrome/Safari |
| WebLLM | “浏览器 LLM 运行时” | MLC-LLM 项目；Apache 2.0；与 OpenAI 兼容的 JS |
| Jetson | “NVIDIA 边缘” | Orin Nano / AGX / Thor / T4000 系列 |
| TRT Edge-LLM | “边缘版 TensorRT” | TensorRT-LLM 的 2026 边缘移植版；EAGLE-3 + NVFP4 |
| Unified memory | “共享内存池” | CPU 与 NPU 看到同一块 RAM；无拷贝开销 |
| Bandwidth-bound | “内存受限” | 解码受限于读取权重的字节/秒速率 |
| Core ML | “苹果转换” | Apple 用于 ANE 原生模型的框架 |
| QNN | “高通技术栈” | Qualcomm Neural Network SDK |

## 延伸阅读

- [On-Device LLMs State of the Union 2026](https://v-chandra.github.io/on-device-llms/) —— 全景格局与基准测试。
- [NVIDIA Jetson Edge AI](https://developer.nvidia.com/blog/getting-started-with-edge-ai-on-nvidia-jetson-llms-vlms-and-foundation-models-for-robotics/) —— Orin / AGX / Thor。
- [NVIDIA TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm/) —— 2026 边缘移植版发布。
- [WebLLM (arXiv:2412.15803)](https://arxiv.org/html/2412.15803v2) —— 设计与基准测试。
- [Apple Core ML](https://developer.apple.com/documentation/coreml) —— ANE 原生转换。
- [Qualcomm AI Hub](https://aihub.qualcomm.com/) —— 为 Hexagon 预转换好的模型。
