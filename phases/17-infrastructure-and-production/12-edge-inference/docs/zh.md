# 边缘推理 — Apple Neural Engine、Qualcomm Hexagon、WebGPU/WebLLM、Jetson

> 核心边缘约束是内存带宽，而不是计算。移动 DRAM 位于 50-90 GB/s；数据中心 HBM3 清除 2-3 TB/s——30-50 倍差距。Decode 是内存绑定的，因此差距是决定性的。在 2026 年，格局分为四种方式。Apple M4/A18 Neural Engine 在统一内存（无 CPU↔NPU 复制）下峰值达到 38 TOPS。Qualcomm Snapdragon X Elite / 8 Gen 4 Hexagon 达到 45 TOPS。WebGPU + WebLLM 在 M3 Max 上运行 Llama 3.1 8B (Q4) 约 41 tok/s（大约本机的 70-80%）；17.6k GitHub 星标，OpenAI 兼容 API，约 70-75% 移动覆盖率。NVIDIA Jetson Orin Nano Super (8GB) 适合 Llama 3.2 3B / Phi-3；AGX Orin 通过 vLLM 以约 40 tok/s 运行 gpt-oss-20b；Jetson T4000 (JetPack 7.1) 是 AGX Orin 的 2 倍。TensorRT Edge-LLM 支持 EAGLE-3、NVFP4、chunked prefill——在 CES 2026 由 Bosch、ThunderSoft、MediaTek 展示。

**类型：** 学习
**语言：** Python（标准库，简单的带宽绑定解码模拟器）
**先修要求：** 阶段 17 · 04（vLLM 服务内部原理）、阶段 17 · 09（生产量化）
**时间：** 约 60 分钟

## 学习目标

- 解释为什么移动 LLM 推理是内存带宽绑定的，而计算是次要的。
- 列举四个边缘目标（Apple ANE、Qualcomm Hexagon、WebGPU/WebLLM、NVIDIA Jetson）并将每个匹配到用例。
- 说出 2026 年 WebGPU 覆盖差距（Firefox Android 追赶）和 Safari iOS 26 落地。
- 为每个目标选择量化格式（ANE 用 Core ML INT4 + FP16，Hexagon 用 QNN INT8/INT4，浏览器用 WebGPU Q4，Jetson Thor 用 NVFP4）。

## 问题

客户想要一个设备上的聊天机器人：语音优先、默认隐私、离线工作。在 MacBook Pro M3 Max 上，Llama 3.1 8B Q4 以约 55 tok/s 运行——很好。在 iPhone 16 Pro 上，相同模型以 3 tok/s 运行——不好。在带有 Snapdragon 8 Gen 3 的中档 Android 上，7 tok/s。在通过 Chrome Android v121+ 上的 WebGPU 在浏览器中，根据设备 4-8 tok/s。

吞吐量差异不是移植问题。它是带宽差距乘以量化格式乘以 NPU 是否可从用户空间访问。2026 年的边缘推理是四个不同的问题，有四个不同的解决方案。

## 概念

### 带宽是真正的天花板

解码为每个 token 读取完整的权重集。Q4 中的一个 7B 模型是 3.5 GB。以 50 GB/s 读取 3.5 GB 需要 70 ms——约 14 tok/s 的理论天花板。在 90 GB/s（高端移动 DRAM）下，天花板移动到约 25 tok/s。低于此数字，再多的计算也没有帮助。

数据中心 HBM3 在 3 TB/s 下在 1.2 ms 内清除相同的 3.5 GB——天花板是 830 tok/s。相同模型，相同权重。不同的内存子系统。

### Apple Neural Engine (M4 / A18)

- 高达 38 TOPS。统一内存（CPU 和 ANE 共享同一池）——无复制开销。
- 通过 Core ML + `.mlmodel` 编译模型和通过 PyTorch 的 Metal Performance Shaders (MPS) 访问。
- Llama.cpp Metal 后端使用 MPS，而不是直接使用 ANE；原生 ANE 需要 Core ML 转换。
- 2026 年 iOS 应用的最佳实用路径：带有 INT4 权重 + FP16 激活的 Core ML。

### Qualcomm Hexagon (Snapdragon X Elite / 8 Gen 4)

- 高达 45 TOPS。在 SoC 中与 CPU 和 GPU 集成，但内存域分离。
- QNN (Qualcomm Neural Network) SDK 和 AI Hub 提供从 PyTorch/ONNX 的转换。
- 聊天模板、Llama 3.2、Phi-3 都作为一等工件在 AI Hub 上发布。

### Intel / AMD NPUs (Lunar Lake, Ryzen AI 300)

- 40-50 TOPS。软件落后于 Apple/Qualcomm；OpenVINO 正在改进但是小众。
- 最适合 Windows ARM copilot 应用；用于本地优先的 AMD/Intel 台式机原生。

### WebGPU + WebLLM

- 通过 WebGPU 计算着色器在浏览器中运行模型；无需安装。
- 在 M3 Max 上 Llama 3.1 8B Q4 约 41 tok/s——通过相同后端约 70-80% 的本机速度。
- WebLLM 上 17.6k GitHub 星标；OpenAI 兼容 JS API；Apache 2.0。
- 2026 年覆盖率：Chrome Android v121+、Safari iOS 26 GA、Firefox Android 仍在追赶。总计约 70-75% 移动覆盖率。

### NVIDIA Jetson 系列

- Orin Nano Super (8GB)：适合 Llama 3.2 3B、Phi-3，具有良好的 tok/s。
- AGX Orin：通过 vLLM 以约 40 tok/s 运行 gpt-oss-20b。
- Thor / T4000 (JetPack 7.1)：AGX Orin 性能的 2 倍，支持 EAGLE-3 和 NVFP4。
- TensorRT Edge-LLM (2026) 支持 EAGLE-3 speculative decoding、NVFP4 权重、chunked prefill——数据中心优化移植到边缘。

### 每个目标的量化选择

| 目标 | 格式 | 备注 |
|--------|--------|-------|
| Apple ANE | INT4 权重 + FP16 激活 | Core ML 转换路径 |
| Qualcomm Hexagon | QNN INT8 / INT4 | AI Hub 转换器 |
| WebGPU / WebLLM | Q4 MLC (q4f16_1) | 使用 `mlc_llm convert_weight` + 编译的 `.wasm`；不支持 GGUF |
| Jetson Orin Nano | Q4 GGUF 或 TRT-LLM INT4 | 内存绑定 |
| Jetson AGX / Thor | NVFP4 + FP8 KV | Edge-LLM 路径 |

### 边缘上的长上下文陷阱

Llama 3.1 的 128K 上下文是数据中心功能。在具有 8 GB RAM 的手机上，4 GB 模型 + 32K token 的 2 GB KV 缓存 + OS 开销 = OOM。边缘部署将上下文保持在 4K-8K，除非接受激进的 KV 量化（Q4 KV）。

### 语音是杀手级应用

语音代理对延迟敏感（第一个 token < 500 ms）。本地推理完全消除网络延迟。与语音转文本（Whisper Turbo 变体在边缘运行）结合，边缘推理成为生产质量的语音循环。

### 你应该记住的数字

- Apple M4 / A18 ANE：38 TOPS。
- Qualcomm Hexagon SD X Elite：45 TOPS。
- WebLLM M3 Max：Llama 3.1 8B Q4 上约 41 tok/s。
- AGX Orin：通过 vLLM 在 gpt-oss-20b 上约 40 tok/s。
- 数据中心-边缘带宽差距：30-50 倍。
- WebGPU 移动覆盖率：约 70-75%（Firefox Android 滞后）。

## 使用它

`code/main.py` 从跨边缘目标的带宽绑定数学计算理论解码吞吐量天花板。与观察到的基准测试进行比较，并突出显示带宽是瓶颈，而不是计算。

## 交付它

本课生成 `outputs/skill-edge-target-picker.md`。给定平台（iOS/Android/浏览器/Jetson）、模型以及延迟/内存预算，选择量化格式和转换管道。

## 练习

1. 运行 `code/main.py`。对于在 Snapdragon 8 Gen 3（约 77 GB/s 带宽）上的 Q4 中的 7B 模型，计算解码天花板。与观察到的 6-8 tok/s 进行比较——运行时是否有效？
2. Android 上的 WebGPU 需要 Chrome v121+。为旧浏览器设计回退——通过相同的 OpenAI 兼容 API 在服务器端。
3. 你的 iOS 应用需要 4K 上下文流式传输。哪种模型/格式组合让你保持在 iPhone 16 上的 4 GB 活跃内存以下？
4. Jetson AGX Orin 以 40 tok/s 运行 gpt-oss-20b。Jetson Nano 仅适合 3B。如果你的产品同时针对两者，你如何统一推理栈？
5. 论证"WebLLM 在 2026 年生产就绪。"引用覆盖率、性能和 Firefox Android 差距。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| ANE | "Apple neural engine" | M 系列和 A 系列中的设备上 NPU；统一内存 |
| Hexagon | "Qualcomm NPU" | Snapdragon NPU；用于访问的 QNN SDK |
| WebGPU | "浏览器 GPU" | W3C 标准化浏览器 GPU API；Chrome/Safari 2026 |
| WebLLM | "浏览器 LLM 运行时" | MLC-LLM 项目；Apache 2.0；OpenAI 兼容 JS |
| Jetson | "NVIDIA 边缘" | Orin Nano / AGX / Thor / T4000 系列 |
| TRT Edge-LLM | "edge TensorRT" | TensorRT-LLM 的 2026 边缘移植；EAGLE-3 + NVFP4 |
| Unified memory | "共享池" | CPU 和 NPU 看到相同的 RAM；无复制开销 |
| Bandwidth-bound | "内存限制" | 通过读取权重的字节数/秒进行解码限制 |
| Core ML | "Apple 转换" | 用于 ANE 原生模型的 Apple 框架 |
| QNN | "Qualcomm 栈" | Qualcomm Neural Network SDK |

## 延伸阅读

- [设备上 LLM 2026 年联盟状况](https://v-chandra.github.io/on-device-llms/)——格局和基准测试。
- [NVIDIA Jetson 边缘 AI](https://developer.nvidia.com/blog/getting-started-with-edge-ai-on-nvidia-jetson-llms-vlms-and-foundation-models-for-robotics/)——Orin / AGX / Thor。
- [NVIDIA TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm/)——2026 年边缘移植公告。
- [WebLLM (arXiv:2412.15803)](https://arxiv.org/html/2412.15803v2)——设计和基准测试。
- [Apple Core ML](https://developer.apple.com/documentation/coreml)——ANE 原生转换。
- [Qualcomm AI Hub](https://aihub.qualcomm.com/)——用于 Hexagon 的预转换模型。
