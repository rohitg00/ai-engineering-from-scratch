# 边缘推理（Edge Inference）—— Apple Neural Engine、Qualcomm Hexagon、WebGPU/WebLLM、Jetson

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 边缘推理的核心瓶颈是内存带宽，而不是算力。移动端 DRAM 带宽在 50–90 GB/s，而数据中心 HBM3 能跑到 2–3 TB/s——差了 30–50 倍。decode 是 memory-bound 的，所以这个差距是决定性的。2026 年这块版图分成四块。Apple M4/A18 Neural Engine 峰值 38 TOPS，配合 unified memory（CPU↔NPU 之间不需要拷贝）。Qualcomm Snapdragon X Elite / 8 Gen 4 的 Hexagon 跑到 45 TOPS。WebGPU + WebLLM 在 M3 Max 上跑 Llama 3.1 8B（Q4）能到约 41 tok/s（大致是原生的 70–80%）；GitHub 17.6k stars，OpenAI 兼容 API，移动端覆盖率约 70–75%。NVIDIA Jetson Orin Nano Super（8GB）能塞下 Llama 3.2 3B / Phi-3；AGX Orin 通过 vLLM 跑 gpt-oss-20b 约 40 tok/s；Jetson T4000（JetPack 7.1）是 AGX Orin 的 2 倍性能。TensorRT Edge-LLM 支持 EAGLE-3、NVFP4、chunked prefill——CES 2026 上 Bosch、ThunderSoft、MediaTek 都做了演示。

**Type:** Learn
**Languages:** Python（stdlib，玩具级 bandwidth-bound decode 模拟器）
**Prerequisites:** Phase 17 · 04（vLLM Serving Internals）、Phase 17 · 09（Production Quantization）
**Time:** ~60 分钟

## 学习目标（Learning Objectives）

- 解释为什么移动端 LLM 推理是 memory-bandwidth-bound 的，而算力是次要的。
- 列举四个边缘目标平台（Apple ANE、Qualcomm Hexagon、WebGPU/WebLLM、NVIDIA Jetson），并给每一个匹配一个使用场景。
- 说出 2026 年 WebGPU 的覆盖率缺口（Firefox Android 还在追赶）以及 Safari iOS 26 的落地。
- 为每个目标平台选一个量化格式（ANE 选 Core ML INT4 + FP16；Hexagon 选 QNN INT8/INT4；浏览器选 WebGPU Q4；Jetson Thor 选 NVFP4）。

## 问题（The Problem）

客户想要一个端侧聊天机器人：voice-first、默认隐私、能离线工作。在 MacBook Pro M3 Max 上，Llama 3.1 8B Q4 跑到约 55 tok/s——可以。在 iPhone 16 Pro 上，同一个模型跑 3 tok/s——不行。在中端 Android（Snapdragon 8 Gen 3）上是 7 tok/s。在 Chrome Android v121+ 通过 WebGPU 跑，根据设备不同是 4–8 tok/s。

吞吐差异并不是移植问题，而是「带宽差距 × 量化格式 × NPU 是否对用户态可用」三者相乘的结果。2026 年的边缘推理实际上是四个不同的问题，对应四套不同的解。

## 概念（The Concept）

### 带宽才是真正的天花板（Bandwidth is the real ceiling）

decode 阶段每生成一个 token 都要把整套权重读一遍。一个 7B 模型在 Q4 下是 3.5 GB。以 50 GB/s 读 3.5 GB 需要 70 ms——理论上限大约是 14 tok/s。把带宽提升到 90 GB/s（高端移动 DRAM），上限挪到约 25 tok/s。低于这个数，再多算力也救不了。

数据中心 HBM3 在 3 TB/s 下读完同样的 3.5 GB 只要 1.2 ms——上限是 830 tok/s。同一个模型，同一份权重。区别在内存子系统。

### Apple Neural Engine（M4 / A18）

- 最高 38 TOPS。Unified memory（CPU 和 ANE 共享同一片内存池）——没有拷贝开销。
- 通过 Core ML + 编译好的 `.mlmodel` 访问，或者通过 PyTorch 走 Metal Performance Shaders（MPS）。
- Llama.cpp 的 Metal 后端走的是 MPS，不是直接走 ANE；要走原生 ANE 必须做 Core ML 转换。
- 2026 年 iOS app 最实用的路径：Core ML，配 INT4 权重 + FP16 激活。

### Qualcomm Hexagon（Snapdragon X Elite / 8 Gen 4）

- 最高 45 TOPS。和 SoC 中的 CPU、GPU 集成在一起，但内存域是分开的。
- QNN（Qualcomm Neural Network）SDK 与 AI Hub 提供从 PyTorch/ONNX 的转换。
- chat 模板、Llama 3.2、Phi-3 都作为一等公民产物在 AI Hub 上发布。

### Intel / AMD NPUs（Lunar Lake、Ryzen AI 300）

- 40–50 TOPS。软件生态落后于 Apple/Qualcomm；OpenVINO 在改进，但比较小众。
- 适合 Windows ARM 上的 copilot 类 app；在 AMD/Intel 桌面端做 local-first 也是原生选择。

### WebGPU + WebLLM

- 通过 WebGPU 的 compute shader 在浏览器里跑模型；免安装。
- M3 Max 上 Llama 3.1 8B Q4 约 41 tok/s——通过同一后端，大致是原生的 70–80%。
- WebLLM GitHub 17.6k stars；OpenAI 兼容的 JS API；Apache 2.0 协议。
- 2026 年覆盖率：Chrome Android v121+、Safari iOS 26 GA、Firefox Android 还在追赶。整体移动端覆盖率约 70–75%。

### NVIDIA Jetson 系列

- Orin Nano Super（8GB）：能塞下 Llama 3.2 3B、Phi-3，tok/s 表现不错。
- AGX Orin：通过 vLLM 跑 gpt-oss-20b 约 40 tok/s。
- Thor / T4000（JetPack 7.1）：AGX Orin 的 2 倍性能，支持 EAGLE-3 与 NVFP4。
- TensorRT Edge-LLM（2026）支持 EAGLE-3 推测解码（speculative decoding）、NVFP4 权重、chunked prefill——把数据中心的优化移植到边缘。

### 每个目标平台的量化选择（Quantization choice per target）

| 目标平台 | 格式 | 备注 |
|--------|--------|-------|
| Apple ANE | INT4 权重 + FP16 激活 | Core ML 转换路径 |
| Qualcomm Hexagon | QNN INT8 / INT4 | AI Hub 转换器 |
| WebGPU / WebLLM | Q4 MLC（q4f16_1） | 用 `mlc_llm convert_weight` + 编译好的 `.wasm`；不支持 GGUF |
| Jetson Orin Nano | Q4 GGUF 或 TRT-LLM INT4 | memory-bound |
| Jetson AGX / Thor | NVFP4 + FP8 KV | Edge-LLM 路径 |

### 边缘上的长上下文陷阱（The long-context trap on edge）

Llama 3.1 的 128K context window（上下文窗口）是数据中心特性。在一台 8 GB RAM 的手机上，4 GB 模型 + 32K token 的 KV cache 占 2 GB + 操作系统开销 = OOM。边缘部署一般把上下文压在 4K–8K，除非可以接受激进的 KV 量化（Q4 KV）。

### 语音才是杀手级应用（Voice is the killer app）

语音 agent 对延迟非常敏感（首 token < 500 ms）。本地推理直接消除了网络延迟。再叠加语音转文本（Whisper Turbo 变体能在边缘跑），边缘推理就成了产品级的语音回路。

### 应该记住的几个数字（Numbers you should remember）

- Apple M4 / A18 ANE：38 TOPS。
- Qualcomm Hexagon SD X Elite：45 TOPS。
- WebLLM 在 M3 Max 上：Llama 3.1 8B Q4 约 41 tok/s。
- AGX Orin：通过 vLLM 跑 gpt-oss-20b 约 40 tok/s。
- 数据中心 vs 边缘的带宽差距：30–50 倍。
- WebGPU 移动端覆盖率：约 70–75%（Firefox Android 拖后腿）。

## 用起来（Use It）

`code/main.py` 在多个边缘目标平台上，用 bandwidth-bound 的算式计算 decode 的理论吞吐上限。再和实测基准做对比，凸显出瓶颈是带宽而不是算力。

## 上线部署（Ship It）

本课产出 `outputs/skill-edge-target-picker.md`。给定平台（iOS/Android/浏览器/Jetson）、模型、以及延迟/内存预算，挑出一个量化格式和转换流水线。

## 练习（Exercises）

1. 跑一下 `code/main.py`。在 Snapdragon 8 Gen 3（带宽约 77 GB/s）上对一个 7B Q4 模型，算一下 decode 上限。和实测的 6–8 tok/s 比一比——runtime 是否高效？
2. WebGPU 在 Android 上要求 Chrome v121+。给老浏览器设计一个 fallback 方案——通过同一套 OpenAI 兼容 API 走服务端。
3. 你的 iOS app 需要 4K 上下文的流式输出。哪种「模型 / 格式」组合能让你在 iPhone 16 上活动内存控制在 4 GB 以下？
4. Jetson AGX Orin 跑 gpt-oss-20b 是 40 tok/s。Jetson Nano 只能塞下一个 3B。如果你的产品两端都要支持，怎么统一推理栈？
5. 论证一下「WebLLM 在 2026 年是不是 production-ready」。从覆盖率、性能、Firefox Android 缺口三方面引证。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|----------------|------------------------|
| ANE | 「Apple 神经引擎」 | M 系列和 A 系列上的端侧 NPU；unified memory |
| Hexagon | 「Qualcomm NPU」 | Snapdragon 上的 NPU；通过 QNN SDK 访问 |
| WebGPU | 「浏览器 GPU」 | W3C 标准化的浏览器 GPU API；2026 年 Chrome/Safari 都支持 |
| WebLLM | 「浏览器 LLM 运行时」 | MLC-LLM 项目；Apache 2.0；OpenAI 兼容的 JS |
| Jetson | 「NVIDIA 边缘」 | Orin Nano / AGX / Thor / T4000 系列 |
| TRT Edge-LLM | 「边缘版 TensorRT」 | 2026 年 TensorRT-LLM 的边缘移植版；支持 EAGLE-3 + NVFP4 |
| Unified memory | 「共享内存池」 | CPU 和 NPU 看到同一片 RAM；没有拷贝开销 |
| Bandwidth-bound | 「内存受限」 | decode 被「每秒能读多少字节权重」卡住 |
| Core ML | 「Apple 的转换框架」 | 把模型转成 ANE 原生模型的 Apple 框架 |
| QNN | 「Qualcomm 那一套」 | Qualcomm Neural Network SDK |

## 延伸阅读（Further Reading）

- [On-Device LLMs State of the Union 2026](https://v-chandra.github.io/on-device-llms/) —— 全景与基准测试。
- [NVIDIA Jetson Edge AI](https://developer.nvidia.com/blog/getting-started-with-edge-ai-on-nvidia-jetson-llms-vlms-and-foundation-models-for-robotics/) —— Orin / AGX / Thor。
- [NVIDIA TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm/) —— 2026 边缘移植版的发布公告。
- [WebLLM (arXiv:2412.15803)](https://arxiv.org/html/2412.15803v2) —— 设计与基准。
- [Apple Core ML](https://developer.apple.com/documentation/coreml) —— ANE 原生转换。
- [Qualcomm AI Hub](https://aihub.qualcomm.com/) —— 为 Hexagon 预转换好的模型。
