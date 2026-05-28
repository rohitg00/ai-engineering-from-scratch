# Edge Inference — Apple Neural Engine、Qualcomm Hexagon、WebGPU/WebLLM、Jetson

> Edge の中核制約は compute ではなく memory bandwidth です。Mobile DRAM は 50-90 GB/s、datacenter HBM3 は 2-3 TB/s に達します。30-50x の差です。Decode は memory-bound なので、この差が決定的です。2026 年の landscape は 4 つに分かれます。Apple M4/A18 Neural Engine は unified memory（CPU↔NPU copy なし）で最大 38 TOPS。Qualcomm Snapdragon X Elite / 8 Gen 4 Hexagon は 45 TOPS。WebGPU + WebLLM は M3 Max 上で Llama 3.1 8B（Q4）を約 41 tok/s で走らせます（native のおよそ 70-80%）。GitHub stars は 17.6k、OpenAI-compatible API、mobile coverage は約 70-75%。NVIDIA Jetson Orin Nano Super（8GB）は Llama 3.2 3B / Phi-3 を収めます。AGX Orin は vLLM 経由で gpt-oss-20b を約 40 tok/s で動かします。Jetson T4000（JetPack 7.1）は AGX Orin の 2x。TensorRT Edge-LLM は EAGLE-3、NVFP4、chunked prefill をサポートし、Bosch、ThunderSoft、MediaTek によって CES 2026 で示されました。

**種別:** 学習
**言語:** Python (stdlib、toy bandwidth-bound decode simulator)
**前提条件:** Phase 17 · 04 (vLLM Serving Internals), Phase 17 · 09 (Production Quantization)
**所要時間:** 約 60 分

## 学習目標

- Mobile LLM inference が memory-bandwidth-bound であり、compute が二次的である理由を説明できる。
- 4 つの edge target（Apple ANE、Qualcomm Hexagon、WebGPU/WebLLM、NVIDIA Jetson）を列挙し、それぞれを use case に対応付けられる。
- 2026 年の WebGPU coverage gap（Firefox Android が追いついている途中）と Safari iOS 26 の landing を説明できる。
- Target ごとに quantization format を選べる（ANE には Core ML INT4 + FP16、Hexagon には QNN INT8/INT4、browser には WebGPU Q4、Jetson Thor には NVFP4）。

## 問題

Customer が on-device chatbot を求めています。Voice-first、private-by-default、offline で動作します。MacBook Pro M3 Max では Llama 3.1 8B Q4 が約 55 tok/s で動き、問題ありません。iPhone 16 Pro では同じ model が 3 tok/s で、問題です。Snapdragon 8 Gen 3 の mid-range Android では 7 tok/s。Chrome Android v121+ の WebGPU 経由の browser では device により 4-8 tok/s です。

Throughput variance は porting issue ではありません。Bandwidth gap、quantization format、NPU が user-space から使えるかどうかの積です。2026 年の edge inference は、4 つの異なる問題であり、4 つの異なる解決策を持ちます。

## コンセプト

### Bandwidth が本当の ceiling

Decode は token ごとに weights 全体を読みます。Q4 の 7B model は 3.5 GB です。50 GB/s で 3.5 GB を読むと 70 ms かかり、理論上の ceiling は約 14 tok/s です。90 GB/s（high-end mobile DRAM）では ceiling は約 25 tok/s に上がります。この数値を下回る領域では compute を増やしても助けになりません。

Datacenter HBM3 の 3 TB/s では、同じ 3.5 GB を 1.2 ms で読み切り、ceiling は 830 tok/s になります。同じ model、同じ weights です。違うのは memory subsystem です。

### Apple Neural Engine（M4 / A18）

- 最大 38 TOPS。Unified memory（CPU と ANE が同じ pool を共有）なので copy overhead がありません。
- Core ML + compiled `.mlmodel`、または PyTorch 経由の Metal Performance Shaders（MPS）で access。
- Llama.cpp Metal backend は MPS を使い、ANE を直接使うわけではありません。Native ANE には Core ML conversion が必要です。
- 2026 年の iOS apps における実用 path: INT4 weights + FP16 activations の Core ML。

### Qualcomm Hexagon（Snapdragon X Elite / 8 Gen 4）

- 最大 45 TOPS。SoC 内で CPU/GPU と統合されていますが、separate memory domain です。
- QNN（Qualcomm Neural Network）SDK と AI Hub が PyTorch/ONNX からの conversion を提供します。
- Chat templates、Llama 3.2、Phi-3 は AI Hub で first-class artifacts として提供されます。

### Intel / AMD NPUs（Lunar Lake、Ryzen AI 300）

- 40-50 TOPS。Software は Apple/Qualcomm より遅れています。OpenVINO は改善中ですが niche です。
- Windows ARM copilot apps と、local-first な AMD/Intel desktops に向いています。

### WebGPU + WebLLM

- WebGPU compute shaders 経由で browser 内で models を実行します。Install は不要です。
- M3 Max で Llama 3.1 8B Q4 は約 41 tok/s。同じ backend で native のおよそ 70-80% です。
- WebLLM は GitHub stars 17.6k、OpenAI-compatible JS API、Apache 2.0。
- 2026 年の coverage: Chrome Android v121+、Safari iOS 26 GA、Firefox Android はまだ追いついている途中。全体では mobile coverage 約 70-75%。

### NVIDIA Jetson family

- Orin Nano Super（8GB）: Llama 3.2 3B、Phi-3 を良好な tok/s で収めます。
- AGX Orin: vLLM 経由で gpt-oss-20b を約 40 tok/s で実行します。
- Thor / T4000（JetPack 7.1）: AGX Orin の 2x performance、EAGLE-3 と NVFP4 をサポート。
- TensorRT Edge-LLM（2026）は EAGLE-3 speculative decoding、NVFP4 weights、chunked prefill をサポートします。Datacenter optimizations が edge に port されています。

### Target ごとの quantization choice

| Target | Format | Notes |
|--------|--------|-------|
| Apple ANE | INT4 weights + FP16 activations | Core ML conversion path |
| Qualcomm Hexagon | QNN INT8 / INT4 | AI Hub converters |
| WebGPU / WebLLM | Q4 MLC (q4f16_1) | `mlc_llm convert_weight` + compiled `.wasm` を使う。GGUF は unsupported |
| Jetson Orin Nano | Q4 GGUF or TRT-LLM INT4 | Memory-bound |
| Jetson AGX / Thor | NVFP4 + FP8 KV | Edge-LLM path |

### Edge の long-context trap

Llama 3.1 の 128K context は datacenter feature です。8 GB RAM の phone では、4 GB model + 32K tokens 用 2 GB KV cache + OS overhead = OOM です。Edge deployments では、aggressive KV quantization（Q4 KV）を受け入れない限り context を 4K-8K に抑えます。

### Voice は killer app

Voice agents は latency-sensitive（first token < 500 ms）です。Local inference は network latency を完全になくします。Speech-to-text（Whisper Turbo variants は edge で動く）と組み合わせると、edge inference は production-quality voice loop になります。

### 覚えておくべき数値

- Apple M4 / A18 ANE: 38 TOPS。
- Qualcomm Hexagon SD X Elite: 45 TOPS。
- WebLLM M3 Max: Llama 3.1 8B Q4 で約 41 tok/s。
- AGX Orin: vLLM 経由の gpt-oss-20b で約 40 tok/s。
- Datacenter-edge bandwidth gap: 30-50x。
- WebGPU mobile coverage: 約 70-75%（Firefox Android は遅れ）。

## 使ってみる

`code/main.py` は、edge targets 全体で bandwidth-bound math に基づく theoretical decode throughput ceilings を計算します。Observed benchmarks と比較し、compute ではなく bandwidth が bottleneck になる場所を示します。

## Ship It

このレッスンは `outputs/skill-edge-target-picker.md` を生成します。Platform（iOS/Android/browser/Jetson）、model、latency/memory budget を与えると、quantization format と conversion pipeline を選びます。

## 演習

1. `code/main.py` を実行してください。Snapdragon 8 Gen 3（約 77 GB/s bandwidth）上の Q4 7B model で decode ceiling を計算します。Observed 6-8 tok/s と比較してください。Runtime は効率的ですか。
2. Android の WebGPU は Chrome v121+ が必要です。古い browser の fallback を設計してください。同じ OpenAI-compatible API を使った server-side fallback です。
3. iOS app が 4K-context streaming を必要としています。iPhone 16 上で active memory を 4 GB 未満に保てる model/format combination はどれですか。
4. Jetson AGX Orin は gpt-oss-20b を 40 tok/s で実行します。Jetson Nano は 3B しか入りません。Product が両方を target にする場合、inference stack をどう統一しますか。
5. 「WebLLM は 2026 年に production-ready か」を論じてください。Coverage、performance、Firefox Android gap を引用してください。

## 重要用語

| Term | よく言われること | 実際の意味 |
|------|----------------|------------|
| ANE | "Apple neural engine" | M-series/A-series の on-device NPU。unified memory |
| Hexagon | "Qualcomm NPU" | Snapdragon NPU。access には QNN SDK |
| WebGPU | "browser GPU" | W3C-standardized browser GPU API。Chrome/Safari 2026 |
| WebLLM | "browser LLM runtime" | MLC-LLM project。Apache 2.0。OpenAI-compatible JS |
| Jetson | "NVIDIA edge" | Orin Nano / AGX / Thor / T4000 family |
| TRT Edge-LLM | "edge TensorRT" | TensorRT-LLM の 2026 edge port。EAGLE-3 + NVFP4 |
| Unified memory | "shared pool" | CPU と NPU が同じ RAM を見る。copy overhead なし |
| Bandwidth-bound | "memory limited" | Weights を読む bytes/sec に decode が制限される |
| Core ML | "Apple conversion" | ANE-native models 向け Apple framework |
| QNN | "Qualcomm stack" | Qualcomm Neural Network SDK |

## 参考資料

- [On-Device LLMs State of the Union 2026](https://v-chandra.github.io/on-device-llms/) — landscape と benchmarks。
- [NVIDIA Jetson Edge AI](https://developer.nvidia.com/blog/getting-started-with-edge-ai-on-nvidia-jetson-llms-vlms-and-foundation-models-for-robotics/) — Orin / AGX / Thor。
- [NVIDIA TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm/) — 2026 edge port announcement。
- [WebLLM (arXiv:2412.15803)](https://arxiv.org/html/2412.15803v2) — design and benchmarks。
- [Apple Core ML](https://developer.apple.com/documentation/coreml) — ANE-native conversion。
- [Qualcomm AI Hub](https://aihub.qualcomm.com/) — Hexagon 向け pre-converted models。
