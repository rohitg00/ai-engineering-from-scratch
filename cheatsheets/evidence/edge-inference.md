# Evidence: cheatsheets/edge-inference.md

Abbreviations: E12 = phases/17-infrastructure-and-production/12-edge-inference. CV15 = phases/04-computer-vision/15-real-time-edge. Q11 = phases/10-llms-from-scratch/11-quantization.

## Four edge targets side by side (comparison)
- Peak 38 TOPS ANE, 45 TOPS Hexagon, WebGPU no install, Jetson family: E12/docs/en.md:33, 39-40, 51, 58-60
- Memory unified no copy, separate domain, browser penalty ~25%, Nano memory-bound: E12/docs/en.md:33, 40, E12/code/main.py:29, E12/docs/en.md:70
- Access Core ML or MPS, QNN SDK and AI Hub, WebGPU compute shaders, vLLM and TensorRT Edge-LLM: E12/docs/en.md:34, 41, 51, 59, 61
- Formats INT4 + FP16, QNN INT8/INT4, Q4 MLC q4f16_1, Q4 GGUF / TRT-LLM INT4 / NVFP4: E12/docs/en.md:67-71
- Observed A18 8, 8 Gen 3 7, WebGPU M3 Max 41, AGX Orin ~40 gpt-oss-20b: E12/code/main.py:26, 27, 29, E12/docs/en.md:59
- Limits: native ANE needs Core ML, conversion from PyTorch/ONNX, ~70-75% coverage, Nano fits 3B: E12/docs/en.md:35, 41, 54, 58

## Use each target when (concepts)
- iOS Core ML INT4 + FP16: E12/docs/en.md:36
- Hexagon QNN / AI Hub, Windows ARM laptop: E12/docs/en.md:41, E12/code/main.py:28
- WebGPU no install, server fallback same OpenAI-compatible API: E12/docs/en.md:51, 105
- Orin Nano Super 8GB, Llama 3.2 3B, Phi-3: E12/docs/en.md:58
- AGX / Thor NVFP4 + FP8 KV, EAGLE-3: E12/docs/en.md:60, 71
- GGUF Q4_K_M CPU and Apple Silicon: Q11/docs/en.md:163, 181
- GPTQ/AWQ GPU inference CUDA, ROCm: Q11/docs/en.md:175-180

## Decode ceiling (annotated-code)
- ceiling function: E12/code/main.py:34-36
- model_gb 4.7 Llama 3.1 8B Q4: E12/code/main.py:46-47
- Target rows A18, 8 Gen 3, WebGPU M3 Max, AGX Orin: E12/code/main.py:26, 27, 29, 23

## Bandwidth math (concepts)
- Decode reads full weights per token: E12/docs/en.md:27
- 3.5 GB, 50 GB/s, 70 ms, ~14 tok/s: E12/docs/en.md:27
- 90 GB/s ~25 tok/s: E12/docs/en.md:27
- HBM3 3 TB/s 1.2 ms 830 tok/s: E12/docs/en.md:29
- 30-50x gap: E12/docs/en.md:3, 87
- 8 GB phone, 4 GB model + 2 GB KV at 32K = OOM: E12/docs/en.md:75
- 4K-8K unless Q4 KV: E12/docs/en.md:75

## Quantization formats, Llama 3 70B (comparison)
- Size row 140GB, 70GB, 35GB, 40GB: Q11/docs/en.md:202-206
- Perplexity row 3.12, 3.14, 4.18, 4.25: Q11/docs/en.md:202-206
- MMLU row 79.5, 79.3, 78.1, 77.9: Q11/docs/en.md:202-206
- Tokens/sec row 38, 55, 75 on A100, 28 on CPU: Q11/docs/en.md:202-206
- Best for: FP8 H100 Q11/docs/en.md:71, 212. AWQ/GPTQ GPU: Q11/docs/en.md:179-180. GGUF CPU + Metal: Q11/docs/en.md:171, 181

## Quantize and dequantize (annotated-code)
- scale / 127, clamp round -128 127: Q11/docs/en.md:100-101
- reconstructed = quantized * scale, error scale / 2: Q11/docs/en.md:95, 104
- zero_point asymmetric, ReLU: Q11/docs/en.md:108

## Tasks (task-table)
- code/main.py ceilings: E12/docs/en.md:96
- measure_latency(model, input_shape, device="cpu", warmup=10, iters=50): CV15/docs/en.md:117
- torch.cuda.synchronize() before and after: CV15/docs/en.md:55
- model.qconfig = tq.get_default_qconfig(backend): CV15/docs/en.md:186
- torch.onnx.export, opset_version=17: CV15/docs/en.md:202, 209, 214
- GPTQConfig(bits=4, group_size=128): Q11/docs/en.md:783
- llama-quantize Q4_K_M: Q11/docs/en.md:829
- mlc_llm convert_weight + compiled .wasm: E12/docs/en.md:69

## Vision deployment path (flow)
- < 3M MobileNetV3-Small, 3-10M EfficientNet-Lite-B0: CV15/docs/en.md:97-98
- Warm up 5-10, fix input size: CV15/docs/en.md:54, 56
- PTQ static INT8, accuracy loss < 1%: CV15/docs/en.md:13, 74
- ONNX export, dynamic_axes any batch size: CV15/docs/en.md:91, 214
- TensorRT Jetson, Core ML iOS, TFLite Android: CV15/docs/en.md:238-239
- Decision table measured on device: CV15/docs/en.md:48

## Troubleshooting (troubleshooting)
- iPhone 16 Pro 3 tok/s, bandwidth gap: E12/docs/en.md:19, 21
- KV 2 GB at 32K OOM, keep 4K-8K or Q4 KV: E12/docs/en.md:75
- GGUF not supported in WebLLM, q4f16_1: E12/docs/en.md:69
- llama.cpp Metal uses MPS, not ANE: E12/docs/en.md:35
- Chrome Android v121+, server fallback: E12/docs/en.md:54, 105
- Cold caches and JIT, warm up 5-10: CV15/docs/en.md:54
- Naive INT4 rounding errors, GPTQ/AWQ calibration: Q11/docs/en.md:144
- Perplexity delta > 2.0 wrong, < 0.5 excellent: Q11/docs/en.md:192

## Format glossary (glossary)
- BF16 8 exponent, 7 mantissa, FP32 range: Q11/docs/en.md:49, 865
- FP8 E4M3 inference: Q11/docs/en.md:51
- FP8 E5M2 training: Q11/docs/en.md:51
- INT8 256 values -128 to 127, scale factor: Q11/docs/en.md:53
- INT4 16 levels, GPTQ/AWQ: Q11/docs/en.md:55, 868
- GGUF llama.cpp mixed precision: Q11/docs/en.md:163
- PTQ 128-1024 calibration examples: Q11/docs/en.md:154
- QAT fake quantization, better INT4/INT2: Q11/docs/en.md:146

## Q&A (qa)
- Memory-bound decode: E12/docs/en.md:3, 62 (E12/code/main.py:62)
- WebLLM 70-80% of native: E12/docs/en.md:52
- FLOPs for search, latency for deployment: CV15/docs/en.md:62
- PTQ 95% benefit 5% effort: CV15/docs/en.md:74
- FP8 H100 30-50% faster, < 0.1% loss: Q11/docs/en.md:212
