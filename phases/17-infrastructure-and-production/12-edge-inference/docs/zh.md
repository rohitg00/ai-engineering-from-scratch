# 边缘推理 —— Apple Neural Engine、Qualcomm Hexagon、WebGPU/WebLLM、Jetson

> 核心边缘约束是内存带宽，不是计算。移动DRAM位于50-90 GB/s；数据中心HBM3清除2-3 TB/s —— 30-50倍差距。解码是内存约束的，因此差距是决定性的。2026年格局分四种方式。Apple M4/A18 Neural Engine在统一内存（无CPU↔NPU复制）下峰值38 TOPS。Qualcomm Snapdragon X Elite / 8 Gen 4 Hexagon达到45 TOPS。WebGPU + WebLLM在M3 Max上以约41 tok/s运行Llama 3.1 8B（Q4）（大致原生的70-80%）；17.6k GitHub星标、OpenAI兼容API、约70-75%移动覆盖率。NVIDIA Jetson Orin Nano Super（8GB）适合Llama 3.2 3B / Phi-3；AGX Orin通过vLLM以约40 tok/s运行gpt-oss-20b；Jetson T4000（JetPack 7.1）是2倍AGX Orin。TensorRT Edge-LLM支持EAGLE-3、NVFP4、分块预填充 —— 由Bosch、ThunderSoft、MediaTek在CES 2026展示。

**类型：** 学习
**语言：** Python（标准库，玩具带宽约束解码模拟器）
**前置知识：** 第17阶段 · 04（vLLM服务内部），第17阶段 · 09（生产量化）
**时间：** 约60分钟

## 学习目标

- 解释为什么移动LLM推理是内存带宽约束的，计算是次要的。
- 枚举四个边缘目标（Apple ANE、Qualcomm Hexagon、WebGPU/WebLLM、NVIDIA Jetson）并将每个匹配到用例。
- 命名2026年WebGPU覆盖差距（Firefox Android追赶中）和Safari iOS 26落地。
- 为每个目标选择量化格式（ANE的Core ML INT4 + FP16、Hexagon的QNN INT8/INT4、浏览器的WebGPU Q4、Jetson Thor的NVFP4）。

## 问题

客户想要一个设备上聊天机器人：语音优先、默认私有、离线工作。在MacBook Pro M3 Max上，Llama 3.1 8B Q4以约55 tok/s运行 —— 可以。在iPhone 16 Pro上，相同模型以3 tok/s运行 —— 不可以。在中端Android带Snapdragon 8 Gen 3上，7 tok/s。在Chrome Android v121+上通过WebGPU在浏览器中，4-8 tok/s，取决于设备。

吞吐量差异不是移植问题。它是带宽差距乘以量化格式乘以NPU是否可从用户空间访问。2026年边缘推理是四个不同问题的四个不同解决方案。

## 概念

### 带宽是真正的天花板

解码为每个token读取完整权重集。Q4中的一个7B模型是3.5 GB。以50 GB/s读取3.5 GB需要70毫秒 —— 理论上限约14 tok/s。在90 GB/s（高端移动DRAM）时，上限移动到约25 tok/s。低于这个数字，多少计算都无帮助。

3 TB/s的数据中心HBM3在1.2毫秒内清除相同3.5 GB —— 上限是830 tok/s。相同模型，相同权重。不同的内存子系统。

### Apple Neural Engine（M4 / A18）

- 高达38 TOPS。统一内存（CPU和ANE共享相同池） —— 无复制开销。
- 通过Core ML + `.mlmodel`编译模型访问，或通过PyTorch的Metal Performance Shaders（MPS）。
- Llama.cpp Metal后端使用MPS，不直接使用ANE；原生ANE需要Core ML转换。
- 2026年iOS应用的最佳实用路径：Core ML带INT4权重 + FP16激活。

### Qualcomm Hexagon（Snapdragon X Elite / 8 Gen 4）

- 高达45 TOPS。在SoC中与CPU和GPU集成，但独立内存域。
- QNN（Qualcomm Neural Network）SDK和AI Hub提供从PyTorch/ONNX的转换。
- 聊天模板、Llama 3.2、Phi-3都作为AI Hub上的一等工件发布。

### Intel / AMD NPU（Lunar Lake、Ryzen AI 300）

- 40-50 TOPS。软件落后于Apple/Qualcomm；OpenVINO正在改进但小众。
- 最适合Windows ARM副驾驶应用；AMD/Intel桌面上本地优先的原生。

### WebGPU + WebLLM

- 通过WebGPU计算着色器在浏览器中运行模型；无需安装。
- M3 Max上Llama 3.1 8B Q4约41 tok/s —— 大致相同后端原生的70-80%。
- WebLLM上17.6k GitHub星标；OpenAI兼容JS API；Apache 2.0。
- 2026年覆盖：Chrome Android v121+、Safari iOS 26 GA、Firefox Android仍在追赶。总体约70-75%移动覆盖。

### NVIDIA Jetson系列

- Orin Nano Super（8GB）：适合Llama 3.2 3B、Phi-3，tok/s良好。
- AGX Orin：通过vLLM以约40 tok/s运行gpt-oss-20b。
- Thor / T4000（JetPack 7.1）：2倍AGX Orin性能，支持EAGLE-3和NVFP4。
- TensorRT Edge-LLM（2026）支持EAGLE-3投机解码、NVFP4权重、分块预填充 —— 数据中心优化移植到边缘。

### 每个目标的量化选择

| 目标 | 格式 | 备注 |
|------|------|------|
| Apple ANE | INT4权重 + FP16激活 | Core ML转换路径 |
| Qualcomm Hexagon | QNN INT8 / INT4 | AI Hub转换器 |
| WebGPU / WebLLM | Q4 MLC（q4f16_1） | 使用`mlc_llm convert_weight` + 编译的`.wasm`；不支持GGUF |
| Jetson Orin Nano | Q4 GGUF或TRT-LLM INT4 | 内存约束 |
| Jetson AGX / Thor | NVFP4 + FP8 KV | Edge-LLM路径 |

### 边缘上的长上下文陷阱

Llama 3.1的128K上下文是数据中心功能。在8 GB RAM的手机上，4 GB模型 + 32K token的2 GB KV缓存 + OS开销 = OOM。边缘部署保持上下文在4K-8K，除非接受激进KV量化（Q4 KV）。

### 语音是杀手级应用

语音代理是延迟敏感的（首token < 500毫秒）。本地推理完全消除网络延迟。与语音转文本（Whisper Turbo变体在边缘运行）结合，边缘推理成为生产质量语音循环。

### 你应该记住的数字

- Apple M4 / A18 ANE：38 TOPS。
- Qualcomm Hexagon SD X Elite：45 TOPS。
- WebLLM M3 Max：Llama 3.1 8B Q4上约41 tok/s。
- AGX Orin：通过vLLM在gpt-oss-20b上约40 tok/s。
- 数据中心-边缘带宽差距：30-50倍。
- WebGPU移动覆盖：约70-75%（Firefox Android落后）。

## 使用它

`code/main.py`从跨边缘目标的带宽约束数学计算理论解码吞吐量上限。与观察到的基准测试比较，并突出显示带宽（而非计算）是瓶颈的地方。

## 交付它

本课程产出`outputs/skill-edge-target-picker.md`。给定平台（iOS/Android/浏览器/Jetson）、模型和延迟/内存预算，选择量化格式和转换管道。

## 练习

1. 运行`code/main.py`。对于Snapdragon 8 Gen 3（约77 GB/s带宽）上的Q4 7B模型，计算解码上限。与观察到的6-8 tok/s比较 —— 运行时高效吗？
2. Android上的WebGPU需要Chrome v121+。为旧浏览器设计回退 —— 通过相同OpenAI兼容API的服务器端。
3. 你的iOS应用需要4K上下文流。哪种模型/格式组合让你在iPhone 16上保持在4 GB活动内存以下？
4. Jetson AGX Orin以40 tok/s运行gpt-oss-20b。Jetson Nano仅适合3B。如果你的产品针对两者，如何统一推理栈？
5. 争论"WebLLM在2026年是否生产就绪"。引用覆盖、性能和Firefox Android差距。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| ANE | "Apple神经引擎" | M系列和A系列中的设备上NPU；统一内存 |
| Hexagon | "Qualcomm NPU" | Snapdragon NPU；QNN SDK用于访问 |
| WebGPU | "浏览器GPU" | W3C标准化浏览器GPU API；Chrome/Safari 2026 |
| WebLLM | "浏览器LLM运行时" | MLC-LLM项目；Apache 2.0；OpenAI兼容JS |
| Jetson | "NVIDIA边缘" | Orin Nano / AGX / Thor / T4000系列 |
| TRT Edge-LLM | "边缘TensorRT" | 2026年TensorRT-LLM的边缘移植；EAGLE-3 + NVFP4 |
| 统一内存 | "共享池" | CPU和NPU看到相同RAM；无复制开销 |
| 带宽约束 | "内存限制" | 解码受读取权重的字节/秒限制 |
| Core ML | "Apple转换" | ANE原生模型的Apple框架 |
| QNN | "Qualcomm栈" | Qualcomm Neural Network SDK |

## 延伸阅读

- [设备上LLM 2026年现状](https://v-chandra.github.io/on-device-llms/) —— 格局和基准测试。
- [NVIDIA Jetson边缘AI](https://developer.nvidia.com/blog/getting-started-with-edge-ai-on-nvidia-jetson-llms-vlms-and-foundation-models-for-robotics/) —— Orin / AGX / Thor。
- [NVIDIA TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm/) —— 2026年边缘移植公告。
- [WebLLM (arXiv:2412.15803)](https://arxiv.org/html/2412.15803v2) —— 设计和基准测试。
- [Apple Core ML](https://developer.apple.com/documentation/coreml) —— ANE原生转换。
- [Qualcomm AI Hub](https://aihub.qualcomm.com/) —— Hexagon的预转换模型。