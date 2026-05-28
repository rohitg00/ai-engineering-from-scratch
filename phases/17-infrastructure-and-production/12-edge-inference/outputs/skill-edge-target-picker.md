---
name: edge-target-picker
description: Device、model、latency budget に基づいて edge inference target（Apple ANE、Qualcomm Hexagon、WebGPU/WebLLM、NVIDIA Jetson）と対応する quantization format を選びます。
version: 1.0.0
phase: 17
lesson: 12
tags: [edge, ane, hexagon, webgpu, webllm, jetson, core-ml, qnn, nvfp4]
---

Deployment platform（iOS、Android、browser、robotics/automotive/edge server）、model、latency/memory budget を受け取り、edge target recommendation を作成します。

作成するもの:

1. Target。Specific NPU/GPU（ANE、Hexagon、WebGPU、Jetson Orin Nano / AGX / Thor）を指定する。Platform と 2026 runtime coverage に基づいて正当化する。
2. Bandwidth ceiling。Theoretical decode ceiling を計算する: bandwidth_GB_s / model_size_GB。User の tok/s requirement と比較する。Ceiling が requirement より低い場合は拒否するか、smaller model / tighter quantization を提案する。
3. Quantization format。Q4 GGUF（browser/edge CPU）、Core ML INT4 + FP16（ANE）、QNN INT8/INT4（Hexagon）、NVFP4 + FP8 KV（Jetson Thor / Edge-LLM）のいずれかを選ぶ。
4. Conversion pipeline。Exact converter（Core ML converter、Qualcomm AI Hub、WebLLM 用 MLC-LLM、TensorRT-LLM Edge compiler）を挙げる。
5. Context budget。Weights と一緒に device RAM に収まる max context を示す。Long-context use cases では KV quantization（Q4 KV）を指定するか拒否する。
6. Fallback。Device が対応不能、または WebGPU が使えない場合（Firefox Android、older browsers）、同じ OpenAI-compatible interface を持つ server-side API fallback を指定する。

Hard rejects:
- Bandwidth ceiling を超える tok/s を約束すること。拒否する。Physics の問題。
- 2026 年に non-Core ML runtime から ANE を直接 target すること。ANE を native に expose するのは Core ML のみ。
- WebGPU がすべての browser にあると仮定すること。2026 coverage は mobile 約 70-75%。常に fallback を指定する。

Refusal rules:
- Model が >6 GB で target が phone（4-8 GB RAM）の場合は拒否する。まず smaller model または aggressive quantization を提案する。
- Request が iPhone 上の 7B model で 128K context の場合は拒否する。Q4 KV と sliding-window attention なしでは device RAM に収まらない。
- Deployment が Android via WebGPU の long-context streaming を必要とし、user が Firefox support を要求する場合は拒否し、Chrome または server fallback を要求する。

Output: target、ceiling、quantization、converter、context budget、fallback を示す 1-page plan。最後に単一 metric、target fleet の worst-case device での observed tok/s、で締めます。
