---
id: edge-inference
title: Edge Inference Targets
code: EI
subtitle: Pick an edge target and a quantization format. Bandwidth ceilings, formats, export steps and on-device measurement.
hue: 262
sources: phases/17-infrastructure-and-production/12-edge-inference, phases/04-computer-vision/15-real-time-edge, phases/10-llms-from-scratch/11-quantization
source_hash: a5869cfd5f78f468
---

## Four edge targets side by side
type: comparison
span: 2
from: phases/17-infrastructure-and-production/12-edge-inference/docs/en.md, phases/17-infrastructure-and-production/12-edge-inference/code/main.py

| Factor | Apple ANE | Qualcomm Hexagon | WebGPU / WebLLM | NVIDIA Jetson |
|---|---|---|---|---|
| Peak | 38 TOPS, M4 / A18 | 45 TOPS, X Elite / 8 Gen 4 | Browser GPU, no install | Orin Nano Super, AGX Orin, Thor |
| Memory | Unified, no copy | Separate memory domain | Browser penalty ~25% | Memory-bound on Nano |
| Access | Core ML or MPS | QNN SDK, AI Hub | WebGPU compute shaders | vLLM, TensorRT Edge-LLM |
| Format | INT4 weights + FP16 activations | QNN INT8 / INT4 | Q4 MLC (`q4f16_1`) | Q4 GGUF, TRT-LLM INT4, NVFP4 |
| Observed | 8 tok/s estimate, A18, 8B Q4 | 7 tok/s, 8 Gen 3, 8B Q4 | ~41 tok/s, M3 Max, 8B Q4 | ~40 tok/s, AGX Orin, gpt-oss-20b |
| Limit | Native ANE needs Core ML | Convert from PyTorch or ONNX | ~70-75% mobile coverage | Nano fits 3B models |

## Use each target when
type: concepts
from: phases/17-infrastructure-and-production/12-edge-inference/docs/en.md, phases/10-llms-from-scratch/11-quantization/docs/en.md

- **Apple ANE**: an iOS app. Convert with Core ML. INT4 weights plus FP16 activations.
- **Qualcomm Hexagon**: Snapdragon phones and Windows ARM laptops. Convert with QNN or AI Hub.
- **WebGPU / WebLLM**: a browser app with no install. Keep a server fallback on the same OpenAI-compatible API.
- **Jetson Orin Nano Super**: Llama 3.2 3B or Phi-3 on 8GB.
- **Jetson AGX / Thor**: larger models, NVFP4 plus FP8 KV, EAGLE-3.
- **GGUF Q4_K_M**: CPU and Apple Silicon laptops.
- **GPTQ or AWQ INT4**: GPU inference with CUDA or ROCm.

## Decode ceiling
type: annotated-code
lang: python
from: phases/17-infrastructure-and-production/12-edge-inference/code/main.py

```python
def ceiling(target: Target, model_gb: float) -> float:
    seconds_per_token = model_gb / target.bandwidth_gb_s  # all weights per token
    return 1 / seconds_per_token  # tok/s upper bound
model_gb = 4.7  # Llama 3.1 8B Q4
Target("Apple A18 (iPhone 16)",   60,   8,  "phone with ANE")  # GB/s, observed tok/s
Target("Snapdragon 8 Gen 3",      77,   7,  "mid/high Android")
Target("WebGPU on M3 Max",       400,  41,  "browser penalty ~25%")
Target("Jetson AGX Orin",        205,  45,  "edge-datacenter bridge")
```

## Bandwidth math
type: concepts
from: phases/17-infrastructure-and-production/12-edge-inference/docs/en.md

- **Rule**: decode reads the full set of weights for every token.
- **7B Q4**: 3.5 GB. At 50 GB/s one token takes 70 ms, ~14 tok/s.
- **High-end mobile**: 90 GB/s gives ~25 tok/s.
- **HBM3 at 3 TB/s**: 1.2 ms per token, ceiling 830 tok/s.
- **Gap**: 30-50x between datacenter and mobile DRAM.
- **Long context**: 4 GB model plus 2 GB KV at 32K on an 8 GB phone is OOM.
- **Context on edge**: keep 4K-8K unless you accept Q4 KV.

## Quantization formats, Llama 3 70B
type: comparison
from: phases/10-llms-from-scratch/11-quantization/docs/en.md

| Factor | FP16 | FP8 | AWQ INT4 | GGUF Q4_K_M |
|---|---|---|---|---|
| Size | 140GB | 70GB | 35GB | 40GB |
| Perplexity | 3.12 | 3.14 | 4.18 | 4.25 |
| MMLU | 79.5% | 79.3% | 78.1% | 77.9% |
| Tokens/sec | 38, A100 | 55, A100 | 75, A100 | 28, CPU |
| Best for | Baseline | H100 deploys | GPU inference | CPU, Metal |

## Quantize and dequantize
type: annotated-code
lang: python
from: phases/10-llms-from-scratch/11-quantization/docs/en.md

```python
scale = max(abs(tensor)) / 127  # symmetric INT8
quantized = clamp(round(tensor / scale), -128, 127)
reconstructed = quantized * scale  # error at most scale / 2
quantized = round(tensor / scale) + zero_point  # asymmetric, for ReLU outputs
```

## Tasks
type: task-table
span: 2
from: phases/17-infrastructure-and-production/12-edge-inference/docs/en.md, phases/04-computer-vision/15-real-time-edge/docs/en.md, phases/04-computer-vision/15-real-time-edge/code/main.py, phases/10-llms-from-scratch/11-quantization/docs/en.md

| Task | Code |
|---|---|
| Edge decode ceilings, lesson 12 | `code/main.py` |
| Measure p50, p95, p99 on the device | `measure_latency(model, input_shape, device="cpu", warmup=10, iters=50)` |
| Time GPU work correctly | `torch.cuda.synchronize()` before and after the timed block |
| Static INT8 PTQ config | `model.qconfig = tq.get_default_qconfig(backend)` |
| Export to ONNX | `torch.onnx.export(model, sample_input, path, opset_version=17)` |
| GPTQ INT4 | `GPTQConfig(bits=4, group_size=128)` |
| GGUF Q4_K_M | `llama.cpp/build/bin/llama-quantize llama-8b-f16.gguf llama-8b-q4km.gguf Q4_K_M` |
| WebLLM weights | `mlc_llm convert_weight` plus a compiled `.wasm` |

## Vision deployment path
type: flow
from: phases/04-computer-vision/15-real-time-edge/docs/en.md

1. **Pick a backbone**: under 3M params, MobileNetV3-Small. 3-10M, EfficientNet-Lite-B0.
2. **Measure**: warm up 5-10 passes. Fix the input size to production resolution.
3. **Quantise**: post-training static INT8. Verify accuracy loss under 1%.
4. **Export**: PyTorch to ONNX. `dynamic_axes` allows any batch size.
5. **Runtime**: TensorRT on Jetson. Core ML on iOS. TFLite on Android.
6. **Decide**: from a table of model, latency, memory and accuracy measured on the device.

## Troubleshooting
type: troubleshooting
from: phases/17-infrastructure-and-production/12-edge-inference/docs/en.md, phases/04-computer-vision/15-real-time-edge/docs/en.md, phases/10-llms-from-scratch/11-quantization/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| 8B Q4 at 3 tok/s on iPhone 16 Pro | Mobile bandwidth gap | Smaller model or fewer bits |
| OOM at long context on a phone | KV cache for 32K is 2 GB | Keep context at 4K-8K or use Q4 KV |
| WebLLM rejects a GGUF file | GGUF is not supported | Convert to Q4 MLC (`q4f16_1`) |
| llama.cpp on iOS skips the ANE | Metal backend uses MPS | Convert with Core ML |
| No WebGPU on an old Android browser | Needs Chrome v121+ | Fall back to the server API |
| First latency numbers too high | Cold caches and JIT | Warm up with 5-10 dummy passes |
| Naive INT4 output is garbage | Rounding errors accumulate | GPTQ or AWQ with calibration data |
| Perplexity delta above 2.0 | Something went wrong | Recheck. Under 0.5 is excellent |

## Format glossary
type: glossary
from: phases/10-llms-from-scratch/11-quantization/docs/en.md

- **BF16**: 8 exponent bits, 7 mantissa bits. Same range as FP32.
- **FP8 E4M3**: weights and activations for inference.
- **FP8 E5M2**: gradients in training. More range.
- **INT8**: 256 values from -128 to 127. Needs a scale factor.
- **INT4**: 16 levels. Needs GPTQ or AWQ for quality.
- **GGUF**: llama.cpp file with mixed precision layers.
- **PTQ**: quantize after training. 128-1024 calibration examples.
- **QAT**: fake quantization in training. Better at INT4 and INT2.

## Q&A
type: qa
from: phases/17-infrastructure-and-production/12-edge-inference/docs/en.md, phases/04-computer-vision/15-real-time-edge/docs/en.md, phases/10-llms-from-scratch/11-quantization/docs/en.md

- **Why is compute secondary on edge?** Decode is memory-bound. Bandwidth sets the ceiling.
- **How fast is WebLLM against native?** About 70-80% of native on the same backend.
- **FLOPs or latency?** FLOPs for architecture search. On-device latency for deployment.
- **PTQ or QAT for vision?** PTQ static gives 95% of the benefit with 5% of the effort.
- **Is FP8 safe?** Yes on H100. 30-50% faster with under 0.1% quality loss.
