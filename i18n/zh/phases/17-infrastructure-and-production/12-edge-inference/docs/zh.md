# 果神经引擎,高通六角形,WebGPU/WebLLM,Jetson

> 核心边缘限制是内存带宽,而不是计算. 移动DRAM处于50-90GB/s;数据中心HBM3清除2-3TB/s30-50x差距. 解码是记忆的,所以差距是决定性的. 在2026年,这个景观分为四个部分. 果M4/A18神经引擎最高值为38TOPS,具有统一内存 (没有CPUNPU副本). 龙X精英/8代4六合集体达到45. 网络GPU + WebLLM 在M3 Max上运行Llama 3.1 8B (Q4) 速度为 ~ 41 tok/s (约为 70-80%的本土); 17.6k GitHub 星,OpenAI兼容的 API, ~ 70-75%的移动覆盖率. 飞机机的机器人是NVIDIA Jetson Orin Nano Super (8GB) 兼容Llama 3.2 3B / Phi-3; AGX Orin 通过vLLM 运行gpt-oss-20b 速度约为40个通/秒;Jetson T4000 (JetPack 7.1) 是2x AGX Orin. 讯RT Edge-LLM支持EAGLE-3,NVFP4,在2026年CES展览会上由博什,ThunderSoft,MediaTek展示的零碎预填料.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy bandwidth-bound decode simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 09 (Production Quantization)
**Time:** ~60 minutes

## 学习目标

- 解释为什么移动LLM推断是基于存储带宽的,计算是次要的.
- 列出四个边缘目标 (果ANE,高通六合,WebGPU/WebLLM,NVIDIA Jetson) 并将每个目标匹配一个使用情况.
- 举个2026 WebGPU 覆盖率差距 (Firefox Android 追赶) 和 Safari iOS 26 登陆的名称.
- 选择每个目标的量化格式 (ANE的核心ML INT4 + FP16,六角形的QNN INT8/INT4,浏览器的WebGPU Q4,Jetson Thor的NVFP4).

## 问题

客户想要一个设备上的聊天机器人:语音先,默认私人,在线上工作.在MacBook Pro M3 Max上,Llama 3.1 8B Q4运行在55个通/秒的速度上.在iPhone 16 Pro上,同样的模型运行在3个通/秒的速度上.在中端的Android上,Snapdragon 8 Gen 3,7个通/秒.在浏览器中通过WebGPU在Chrome Android v121+,4-8个通/秒,取决于设备.

输出差异不是一个移植问题.这是带宽差距乘以量化格式乘以NPU是否可访问用户空间.2026年边缘推断是四个不同的解决方案的四个不同的问题.

## 概念

### 带宽是真正的天花板

解码读取每个代币的全部权重.Q4中的一个7B模型为3.5GB.在50GB/s时读取3.5GB需要70ms ,理论上限为14tok/s.在90GB/s (高端移动DRAM) 时,限额移动到25tok/s.没有计算量帮助低于这个数量.

数据中心HBM3在3TB/s时清除相同的3.5GB在1.2ms 天花板是830tc/s.同样的模型,相同的重量.不同的内存子系统.

### 果神经引擎 (M4 / A18)

- 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器: 存储器:
- 通过核心ML+ 访问`.mlmodel`通过 PyTorch 进行编译的模型或通过金属性能遮光器 (MPS).
- 金属后端使用MPS,而不是直接使用ANE;本土ANE需要Core ML转换.
- 2026年iOS应用程序的最佳实用途径:核心ML与INT4权重+FP16激活.

### 高通六合 (Snapdragon X Elite / 8 Gen 4)

- 集成到CPU和GPU,但分开存储域.
- 基于QNN (Qualcomm神经网络) SDK和AI Hub, PyTorch/ONNX的转换功能可实现.
- 聊天模板,Llama 3.2,Fhi-3都作为AI中心的第一类文物.

### 智能/AMD NPU (月球湖,瑞森AI300)

- 软件落后于果/电,OpenVINO正在改善,但其实是个位.
- 最适合Windows ARM副驾驶应用程序;本地使用AMD/Intel桌面.

### 网络GPU + 网络LLM

- 通过WebGPU计算模块,在浏览器中运行模型;没有安装.
- 3 Max 的Llama 3.1 8B Q4在M3 Max上以 ~ 41 个时/秒的速度,大约是70~80%的原生通过相同的后端.
- 17.6k GitHub 星星在 WebLLM;OpenAI兼容的JS API;Apache 2.0.
- 2026年覆盖率:Chrome Android v121+,Safari iOS 26 GA,Firefox Android仍在追赶.

### 杰特森家族

- 机 Nano Super (8GB):适合Llama 3.2 3B,Fi-3在好时速.
- AGX Orin:通过vLLM以 ~ 40 个时/秒运行gpt-oss-20b.
- /T4000 (JetPack 7.1): 2x AGX Orin性能,支持EAGLE-3和NVFP4.
- 讯RT Edge-LLM (2026) 支持EAGLE-3推测解码,NVFP4重量,零碎预填数据中心优化移植到边缘.

### 目标量化选择

| Target | Format | Notes |
|--------|--------|-------|
| Apple ANE | INT4 weights + FP16 activations | Core ML conversion path |
| Qualcomm Hexagon | QNN INT8 / INT4 | AI Hub converters |
| WebGPU / WebLLM | Q4 MLC (q4f16_1) | Use `mlc_llm convert_weight` + compiled `.wasm`; GGUF is not supported |
| Jetson Orin Nano | Q4 GGUF or TRT-LLM INT4 | Memory-bound |
| Jetson AGX / Thor | NVFP4 + FP8 KV | Edge-LLM path |

### 长文本陷在边缘

拉马 3.1 的 128K 语境是一个数据中心功能.在具有 8 GB RAM 的手机上, 4 GB 模型 + 32K 代币的 2 GB KV 缓存 + OS 开销 = OOM. 除非接受积极的 KV 量化 (Q4 KV) 否则,边缘部署保持 4K-8K 语境.

### 声音是杀手的应用程序

语音代理是延迟敏感的 (第一代标 <500 ms).本地推理完全消除了网络延迟.与语音到文本 (Whisper Turbo变体在边缘运行) 结合,边缘推理成为生产质量的语音循环.

### 你应该记住的数字

- 果M4 / A18 ANE: 38 个顶部.
- 通六合式SDX精英:45TOPS.
- 网络LLM M3 Max:在Llama 3.1 8B Q4上使用的速度为41个时/秒.
- 通过vLLM,在gpt-oss-20b上使用40个通话/秒.
- 数据中心边缘带宽差距:30-50倍.
- 网络GPU移动覆盖率: ~ 70-75% (Firefox Android 滞后).

```figure
edge-bandwidth-pipe
```

## 用它

`code/main.py`计算理论解码吞吐量上限从带宽限制的数学跨边缘目标. 与观察到的基准和突出点相比,带宽而不是计算是瓶.

## 运送它

这一课产生了`outputs/skill-edge-target-picker.md`根据平台 (iOS/Android/浏览器/Jetson),模型和延迟/内存预算,选择量化格式和转换管道.

## 运动

1. 跑步`code/main.py`对于4Q7B模型,在Snapdragon 8 Gen 3 (~77GB/s带宽) 上,计算解码天花板.
2. 在安卓上,WebGPU需要Chrome v121+.通过相同的OpenAI兼容API设计旧浏览器的服务器侧.
3. 您的iOS应用程序需要4K文本流媒体. 哪种模式/格式组合允许您在iPhone 16上保持4GB的活跃内存以下?
4. 如果你的产品是针对两者,你如何统一推断堆?
5. 讨论"WebLLM是否2026年准备生产". 提及覆盖率,性能和Firefox Android差距.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| ANE | "Apple neural engine" | On-device NPU in M-series and A-series; unified memory |
| Hexagon | "Qualcomm NPU" | Snapdragon NPU; QNN SDK for access |
| WebGPU | "browser GPU" | W3C-standardized browser GPU API; Chrome/Safari 2026 |
| WebLLM | "browser LLM runtime" | MLC-LLM project; Apache 2.0; OpenAI-compatible JS |
| Jetson | "NVIDIA edge" | Orin Nano / AGX / Thor / T4000 family |
| TRT Edge-LLM | "edge TensorRT" | 2026 edge port of TensorRT-LLM; EAGLE-3 + NVFP4 |
| Unified memory | "shared pool" | CPU and NPU see same RAM; no copy overhead |
| Bandwidth-bound | "memory limited" | Decode gated by bytes/sec reading weights |
| Core ML | "Apple conversion" | Apple framework for ANE-native models |
| QNN | "Qualcomm stack" | Qualcomm Neural Network SDK |

## 进一步阅读

- [On-Device LLMs State of the Union 2026](https://v-chandra.github.io/on-device-llms/)景观和基准
- [NVIDIA Jetson Edge AI](https://developer.nvidia.com/blog/getting-started-with-edge-ai-on-nvidia-jetson-llms-vlms-and-foundation-models-for-robotics/)        
- [NVIDIA TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm/)2026年边缘端口公告.
- [WebLLM (arXiv:2412.15803)](https://arxiv.org/html/2412.15803v2)设计和基准.
- [Apple Core ML](https://developer.apple.com/documentation/coreml)           
- [Qualcomm AI Hub](https://aihub.qualcomm.com/)前转换的六角形模型.
