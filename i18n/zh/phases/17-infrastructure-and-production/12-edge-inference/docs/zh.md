# 端侧推理 — Apple Neural Engine、Qualcomm Hexagon、WebGPU/WebLLM、Jetson

> 端侧的核心约束是内存带宽，而不是算力。移动 DRAM 为 50-90 GB/s；数据中心 HBM3 可达 2-3 TB/s —— 差距达 30-50 倍。解码受内存限制，因此这一差距是决定性的。2026 年，格局分为四条路线。Apple M4/A18 Neural Engine 峰值达 38 TOPS，并采用统一内存（无需 CPU↔NPU 拷贝）。Qualcomm Snapdragon X Elite / 8 Gen 4 Hexagon 达到 45 TOPS。WebGPU + WebLLM 在 M3 Max 上运行 Llama 3.1 8B（Q4）约 41 tok/s（约为原生性能的 70-80%）；17.6k GitHub stars，提供 OpenAI 兼容 API，移动端覆盖率约 70-75%。NVIDIA Jetson Orin Nano Super（8GB）可容纳 Llama 3.2 3B / Phi-3；AGX Orin 通过 vLLM 以约 40 tok/s 运行 gpt-oss-20b；Jetson T4000（JetPack 7.1）是 AGX Orin 的 2 倍。TensorRT Edge-LLM 支持 EAGLE-3、NVFP4、chunked prefill —— Bosch、ThunderSoft、MediaTek 在 CES 2026 上进行了展示。

**Type:** Learn
**Languages:** Python（标准库，简化的带宽受限解码模拟器）
**Prerequisites:** Phase 17 · 04（Serving Engine Internals）、Phase 17 · 09（Production Quantization）
**Time:** 约 60 分钟

## 学习目标

- 解释为什么移动端 LLM 推理受内存带宽限制，而算力是次要的。
- 列举四个端侧目标（Apple ANE、Qualcomm Hexagon、WebGPU/WebLLM、NVIDIA Jetson），并为每一个匹配适用场景。
- 说出 2026 年 WebGPU 覆盖率的缺口（Firefox Android 正在追赶）以及 Safari iOS 26 的落地情况。
- 为每个目标选择量化格式（ANE 用 Core ML INT4 + FP16，Hexagon 用 QNN INT8/INT4，浏览器用 WebGPU Q4，Jetson Thor 用 NVFP4）。

## 问题

一位客户想要一个设备端聊天机器人：语音优先、默认保护隐私、可离线工作。在 MacBook Pro M3 Max 上，Llama 3.1 8B Q4 以约 55 tok/s 运行 —— 没问题。在 iPhone 16 Pro 上，同一模型只有 3 tok/s —— 不行。在搭载 Snapdragon 8 Gen 3 的中端 Android 上，7 tok/s。在浏览器中通过 WebGPU（Chrome Android v121+），4-8 tok/s，取决于设备。

这种吞吐量差异并不是移植问题。它是带宽差距 × 量化格式 × NPU 是否可从用户空间访问的综合结果。2026 年的端侧推理是四个不同的问题，对应四种不同的解决方案。

## 核心概念

### 带宽才是真正的天花板

解码每生成一个 token 都要读取全部权重。一个 7B 模型在 Q4 下是 3.5 GB。以 50 GB/s 的速度读取 3.5 GB 需要 70 ms —— 理论上限约 14 tok/s。在 90 GB/s（高端移动 DRAM）下，上限提升到约 25 tok/s。再多的算力也无法突破这个数字。

数据中心 HBM3 以 3 TB/s 的速度读取同样的 3.5 GB 只需 1.2 ms —— 上限为 830 tok/s。相同的模型，相同的权重。不同的内存子系统。

### Apple Neural Engine（M4 / A18）

- 高达 38 TOPS。统一内存（CPU 和 ANE 共享同一内存池）—— 无拷贝开销。
- 通过 Core ML + `.mlmodel` 编译后的模型访问，或通过 PyTorch 使用 Metal Performance Shaders（MPS）。
- Llama.cpp 的 Metal 后端使用 MPS，而不是直接使用 ANE；原生 ANE 需要 Core ML 转换。
- 2026 年 iOS 应用的最佳实践路径：Core ML + INT4 权重 + FP16 激活。

### Qualcomm Hexagon（Snapdragon X Elite / 8 Gen 4）

- 高达 45 TOPS。在 SoC 中与 CPU 和 GPU 集成，但内存域独立。
- QNN（Qualcomm Neural Network）SDK 和 AI Hub 提供从 PyTorch/ONNX 的转换。
- Chat templates、Llama 3.2、Phi-3 都作为一等制品在 AI Hub 上提供。

### Intel / AMD NPU（Lunar Lake、Ryzen AI 300）

- 40-50 TOPS。软件生态落后于 Apple/Qualcomm；OpenVINO 在改进但仍属小众。
- 最适合 Windows ARM copilot 应用；在 AMD/Intel 桌面上是本地优先的原生方案。

### WebGPU + WebLLM

- 通过 WebGPU 计算着色器在浏览器中运行模型；无需安装。
- Llama 3.1 8B Q4 在 M3 Max 上约 41 tok/s —— 通过相同后端约为原生性能的 70-80%。
- WebLLM 在 GitHub 上有 17.6k stars；OpenAI 兼容 JS API；Apache 2.0。
- 2026 年覆盖率：Chrome Android v121+、Safari iOS 26 GA，Firefox Android 仍在追赶。整体移动端覆盖率约 70-75%。

### NVIDIA Jetson 系列

- Orin Nano Super（8GB）：可容纳 Llama 3.2 3B、Phi-3，tok/s 表现良好。
- AGX Orin：通过 vLLM 以约 40 tok/s 运行 gpt-oss-20b。
- Thor / T4000（JetPack 7.1）：性能是 AGX Orin 的 2 倍，支持 EAGLE-3 和 NVFP4。
- TensorRT Edge-LLM（2026）支持 EAGLE-3 投机解码、NVFP4 权重、chunked prefill —— 数据中心优化移植到端侧。

### 每个目标的量化选择

| 目标 | 格式 | 说明 |
|--------|--------|-------|
| Apple ANE | INT4 权重 + FP16 激活 | Core ML 转换路径 |
| Qualcomm Hexagon | QNN INT8 / INT4 | AI Hub 转换器 |
| WebGPU / WebLLM | Q4 MLC (q4f16_1) | 使用 `mlc_llm convert_weight` + 编译后的 `.wasm`；不支持 GGUF |
| Jetson Orin Nano | Q4 GGUF 或 TRT-LLM INT4 | 受内存限制 |
| Jetson AGX / Thor | NVFP4 + FP8 KV | Edge-LLM 路径 |

### 端侧的长上下文陷阱

Llama 3.1 的 128K 上下文是数据中心特性。在 8 GB 内存的手机上，4 GB 模型 + 32K token 所需的 2 GB KV cache + 操作系统开销 = OOM。端侧部署通常将上下文保持在 4K-8K，除非接受激进的 KV 量化（Q4 KV）。

### 语音是杀手级应用

语音代理对延迟敏感（首 token < 500 ms）。本地推理完全消除了网络延迟。结合语音转文本（Whisper Turbo 变体可在端侧运行），端侧推理成为生产级的语音闭环。

### 你应该记住的数字

- Apple M4 / A18 ANE：38 TOPS。
- Qualcomm Hexagon SD X Elite：45 TOPS。
- WebLLM M3 Max：Llama 3.1 8B Q4 约 41 tok/s。
- AGX Orin：通过 vLLM 运行 gpt-oss-20b 约 40 tok/s。
- 数据中心与端侧的带宽差距：30-50 倍。
- WebGPU 移动端覆盖率：约 70-75%（Firefox Android 落后）。

```figure
edge-bandwidth-pipe
```

## 动手实践

`code/main.py` 基于带宽受限的数学模型计算各端侧目标的理论解码吞吐上限，并与实测基准进行比较，指出瓶颈在带宽而非算力的地方。

## 上线部署

本课产出 `outputs/skill-edge-target-picker.md`。给定平台（iOS/Android/浏览器/Jetson）、模型以及延迟/内存预算，它会选择量化格式和转换流水线。

## 练习

1. 运行 `code/main.py`。对于 Snapdragon 8 Gen 3（带宽约 77 GB/s）上的 7B Q4 模型，计算解码上限。与实测的 6-8 tok/s 比较 —— 运行时是否高效？
2. Android 上的 WebGPU 需要 Chrome v121+。为旧版浏览器设计一个回退方案 —— 通过相同的 OpenAI 兼容 API 走服务端。
3. 你的 iOS 应用需要 4K 上下文的流式输出。哪种模型/格式组合能让 iPhone 16 上的活动内存保持在 4 GB 以下？
4. Jetson AGX Orin 以 40 tok/s 运行 gpt-oss-20b。Jetson Nano 只能容纳 3B 模型。如果你的产品同时面向两者，如何统一推理栈？
5. 论证“WebLLM 在 2026 年是否已达到生产就绪”。引用覆盖率、性能以及 Firefox Android 的差距。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| ANE | "Apple 神经引擎" | M 系列和 A 系列中的设备端 NPU；统一内存 |
| Hexagon | "Qualcomm NPU" | Snapdragon NPU；通过 QNN SDK 访问 |
| WebGPU | "浏览器 GPU" | W3C 标准化的浏览器 GPU API；Chrome/Safari 2026 |
| WebLLM | "浏览器 LLM 运行时" | MLC-LLM 项目；Apache 2.0；OpenAI 兼容 JS |
| Jetson | "NVIDIA 端侧" | Orin Nano / AGX / Thor / T4000 系列 |
| TRT Edge-LLM | "端侧 TensorRT" | 2026 年 TensorRT-LLM 的端侧移植；EAGLE-3 + NVFP4 |
| 统一内存 | "共享内存池" | CPU 和 NPU 访问同一内存；无拷贝开销 |
| 带宽受限 | "内存受限" | 解码速度受限于每秒读取权重的字节数 |
| Core ML | "Apple 转换" | 用于 ANE 原生模型的 Apple 框架 |
| QNN | "Qualcomm 技术栈" | Qualcomm Neural Network SDK |

## 延伸阅读

- [On-Device LLMs State of the Union 2026](https://v-chandra.github.io/on-device-llms/) — 行业格局与基准测试。
- [NVIDIA Jetson Edge AI](https://developer.nvidia.com/blog/getting-started-with-edge-ai-on-nvidia-jetson-llms-vlms-and-foundation-models-for-robotics/) — Orin / AGX / Thor。
- [NVIDIA TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm/) — 2026 年端侧移植公告。
- [WebLLM (arXiv:2412.15803)](https://arxiv.org/html/2412.15803v2) — 设计与基准测试。
- [Apple Core ML](https://developer.apple.com/documentation/coreml) — ANE 原生转换。
- [Qualcomm AI Hub](https://aihub.qualcomm.com/) — 针对 Hexagon 的预转换模型。