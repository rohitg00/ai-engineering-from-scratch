# Evidence: cheatsheets/vision-edge-deployment.md

Abbreviations: L15 = phases/04-computer-vision/15-real-time-edge, L16 = phases/04-computer-vision/16-vision-pipeline-capstone, L1712 = phases/17-infrastructure-and-production/12-edge-inference. d = docs/en.md, c = code/main.py, r = code/main.rs.

## Vision pipeline stages (architecture, 8 nodes, 7 edges)
- HTTP request + image bytes: L16/d:31
- Decode + preprocess: L16/d:31
- Detector (YOLO / Mask R-CNN): L16/d:32
- Crop + resize each detection: L16/d:33
- Classifier (ConvNeXt-Tiny): L16/d:34
- Aggregate detections + classes: L16/d:35
- Pydantic validation: L16/d:36
- JSON response: L16/d:37
- Seven stages in order: L16/d:31-37, 46

## Tasks in code (task-table, 8 rows)
- measure_latency(model, input_shape, ...): L15/c:6, L15/d:117
- parameter_count(model): L15/c:32
- flops_estimate(model, input_shape): L15/c:36
- quantise_ptq(model, calibration_loader, backend="x86"): L15/d:183
- export_onnx(model, sample_input, path="model.onnx"): L15/d:200
- compare_backbones(resolution=160), four candidates: L15/c:64-73, 95
- pipe.run(img, image_id="demo"): L16/c:200
- benchmark(pipe, num_runs=10): L16/c:206

## Measure latency correctly (annotated-code, 11 lines)
- model.to(device).eval(): L15/c:7
- torch.no_grad and warmup loop: L15/c:9-11
- warmup=5 in code: L15/c:6. warmup=10 in docs: L15/d:117
- torch.cuda.synchronize on cuda: L15/c:12-21
- time.perf_counter and ms: L15/c:18-22
- times.sort, p50, p95: L15/c:23-26
- report percentiles, not just mean: L15/d:143

## Quantise and export (annotated-code, 11 lines)
- import torch.ao.quantization as tq: L15/d:184
- model.qconfig = tq.get_default_qconfig(backend), backend="x86": L15/d:183, 186
- tq.prepare(model, inplace=True), insert observers: L15/d:187, 195
- calibration loop: L15/d:188-190, calibrate with real data: L15/d:195
- tq.convert(model, inplace=True), fuse + quantise: L15/d:191, 195
- torch.onnx.export with input_names, output_names, dynamic_axes: L15/d:202-208
- dynamic_axes gives arbitrary batch size: L15/d:214
- opset_version=17, safe default in 2026: L15/d:209, 214

## Serve and run (command-table, 6 rows)
- uvicorn main:app --host 0.0.0.0 --port 8000: L16/d:268
- curl -F 'file=@dog.jpg' http://localhost:8000/detect: L16/d:268
- rustc --edition 2021 -O code/main.rs: L15/r:9
- code/main.py computes decode ceilings per target: L1712/d:96
- trtexec (TensorRT) standalone CLI numbers: L15/d:241
- benchmark_app (OpenVINO) standalone CLI numbers: L15/d:241

## Measurement discipline (flow, 6 steps)
1. Warm up 5-10 dummy passes: L15/d:54
2. torch.cuda.synchronize() before and after: L15/d:55
3. Fix input sizes, 224x224 is not 512x512: L15/d:56
4. time.perf_counter(): L15/d:143
5. p50, p95, p99, mean hides tail: L15/d:44, 143
6. FLOPs for architecture search, on-device latency for deployment: L15/d:62

## Defaults and numbers (defaults, 8 rows)
- opset_version 17: L15/d:209, 214
- warmup=10, iters=50 in docs, 5 and 20 in code: L15/d:117, L15/c:6
- min_crop 32 in docs, 16 in code: L16/d:139, L16/c:71. Skip small boxes: L16/d:84
- crop resize 224 in docs, 64 in code: L16/d:192, L16/c:128
- backend x86: L15/d:183
- micro-batch window 20ms: L16/d:92
- INT8 accuracy loss 0.1-1 percentage points: L15/d:66
- CPU detect 300-500 ms, preprocess ~3 ms: L16/d:309

## Edge targets and formats (concepts, 6 bullets)
- Apple ANE 38 TOPS, unified memory, INT4 weights + FP16 activations, Core ML: L1712/d:33, 36, 67
- Qualcomm Hexagon 45 TOPS, QNN INT8 / INT4, AI Hub converters: L1712/d:40, 68
- WebGPU / WebLLM Q4 MLC (q4f16_1), mlc_llm convert_weight, GGUF not supported: L1712/d:69
- Jetson Orin Nano Q4 GGUF or TRT-LLM INT4, memory-bound: L1712/d:70
- Jetson AGX / Thor NVFP4 + FP8 KV, Edge-LLM path: L1712/d:71
- PyTorch to ONNX, then pick the runtime: L15/d:91, 237-239

## Bandwidth sets the decode ceiling (concepts, 7 bullets)
- ceiling = bandwidth / model size, decode reads full weights per token: L1712/d:27, L1712/c:34-36
- 3.5 GB at 50 GB/s takes 70 ms, ~14 tok/s: L1712/d:27
- HBM3 3 TB/s, 1.2 ms, 830 tok/s: L1712/d:29
- 30-50x gap: L1712/d:87
- 4 GB model + 2 GB KV for 32K on 8 GB = OOM, keep 4K-8K: L1712/d:75
- conv FLOPs 2 * c_in * c_out * kh * kw * h * w: L15/d:160
- INT8 size and bandwidth drop 4x, compute 2-4x: L15/d:66

## Troubleshooting (troubleshooting, 8 rows)
- Cold caches and JIT, warm up 5-10: L15/d:54
- Without synchronize you measure dispatch: L15/d:55
- (cx, cy, w, h) boxes fail Pydantic at the boundary, empty crops: L16/d:68
- Out-of-bounds boxes, clamp: L16/d:83
- Corrupt upload, 400 with specific code, not 500: L16/d:85
- Model load failure, fail at startup: L16/d:86
- Phone OOM on long context, keep 4K-8K: L1712/d:75
- QAT when PTQ loss is unacceptable, needs labelled data: L15/d:72, 74

## Abbreviations (glossary, 7 bullets)
- PTQ: L15/d:263
- QAT: L15/d:264
- ONNX: L15/d:265
- FLOPs: L15/d:261
- ANE: L1712/d:114
- QNN: L1712/d:123
- Unified memory: L1712/d:120

## Questions (qa, 5 bullets)
- < 3M params MobileNetV3-Small, compiles everywhere: L15/d:97
- 10-20M ConvNeXt-Tiny, CPU-friendly: L15/d:99
- More FLOPs can be faster, depthwise vs 7x7: L15/d:60
- Preprocessing biggest block, detector 70-90% of GPU time: L16/d:74-75
- Decode memory-bound, compute secondary: L1712/d:12, 3

## Tips (tips, 5 bullets)
- Quantise all to INT8 unless specific reason: L15/d:103
- Measure every cell on the target device: L15/d:48
- Log model name and weights hash: L16/d:315
- Per-request trace IDs with stage timings: L16/d:316
- Classifier timeout fallback: L16/d:317
