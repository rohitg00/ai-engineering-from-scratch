---
id: vision-edge-deployment
title: Vision Pipelines and Edge Deployment
code: VP
subtitle: Measure, quantise, export and serve a vision pipeline. Size LLM decode on edge targets by memory bandwidth.
hue: 25
sources: phases/04-computer-vision/15-real-time-edge, phases/04-computer-vision/16-vision-pipeline-capstone, phases/17-infrastructure-and-production/12-edge-inference
source_hash: bbe79d292f291682
---

## Vision pipeline stages
type: architecture
from: phases/04-computer-vision/16-vision-pipeline-capstone/docs/en.md

```arch
node | req | 1,1 | HTTP request | image bytes | client
node | load | 2,1 | Decode | preprocess | process
node | det | 3,1 | Detector | YOLO or Mask R-CNN | gpu
node | crop | 4,1 | Crop and resize | each detection | process
node | cls | 4,2 | Classifier | ConvNeXt-Tiny | gpu
node | agg | 3,2 | Aggregate | detections and classes | process
node | schema | 2,2 | Pydantic | validation | process
node | resp | 1,2 | JSON response | | client
edge | req | load |
edge | load | det |
edge | det | crop |
edge | crop | cls |
edge | cls | agg |
edge | agg | schema |
edge | schema | resp |
```

## Tasks in code
type: task-table
from: phases/04-computer-vision/15-real-time-edge/docs/en.md, phases/04-computer-vision/15-real-time-edge/code/main.py, phases/04-computer-vision/16-vision-pipeline-capstone/code/main.py

| Task | Code |
|---|---|
| Latency percentiles | `measure_latency(model, input_shape)` |
| Count parameters | `parameter_count(model)` |
| Estimate FLOPs | `flops_estimate(model, input_shape)` |
| INT8 static quantisation | `quantise_ptq(model, calibration_loader)` |
| Export to ONNX | `export_onnx(model, sample_input)` |
| Compare 4 backbones | `compare_backbones(resolution=160)` |
| Run the pipeline | `pipe.run(img, image_id="demo")` |
| Time each stage | `benchmark(pipe, num_runs=10)` |

## Measure latency correctly
type: annotated-code
lang: python
from: phases/04-computer-vision/15-real-time-edge/code/main.py, phases/04-computer-vision/15-real-time-edge/docs/en.md

```python
model = model.to(device).eval()
with torch.no_grad():
    for _ in range(warmup):                 # 5 in code, 10 in the docs
        model(x)
    torch.cuda.synchronize()                # before and after, on cuda only
    t0 = time.perf_counter()
    model(x)
    times.append((time.perf_counter() - t0) * 1000)  # milliseconds
times.sort()
p50 = times[len(times) // 2]
p95 = times[int(len(times) * 0.95)]         # report percentiles, not the mean
```

## Quantise and export
type: annotated-code
lang: python
from: phases/04-computer-vision/15-real-time-edge/docs/en.md

```python
import torch.ao.quantization as tq
model.qconfig = tq.get_default_qconfig(backend)  # backend="x86"
tq.prepare(model, inplace=True)                  # inserts observers
for x, _ in calibration_loader:
    model(x)                                     # calibrate with real data
tq.convert(model, inplace=True)                  # fuse and quantise
torch.onnx.export(model, sample_input, path,
    input_names=["input"], output_names=["output"],
    dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},  # any batch size
    opset_version=17)                            # safe default in 2026
```

## Serve and run
type: command-table
from: phases/04-computer-vision/16-vision-pipeline-capstone/docs/en.md, phases/04-computer-vision/15-real-time-edge/docs/en.md, phases/04-computer-vision/15-real-time-edge/code/main.rs, phases/17-infrastructure-and-production/12-edge-inference/docs/en.md

| Command | What it does |
|---|---|
| `uvicorn main:app --host 0.0.0.0 --port 8000` | Starts the FastAPI service |
| `curl -F 'file=@dog.jpg' http://localhost:8000/detect` | Sends one image upload |
| `rustc --edition 2021 -O code/main.rs` | Builds the Rust edge benchmark |
| `code/main.py` (lesson 17.12) | Prints decode ceilings per edge target |
| `trtexec` | TensorRT standalone CLI numbers |
| `benchmark_app` | OpenVINO standalone CLI numbers |

## Measurement discipline
type: flow
from: phases/04-computer-vision/15-real-time-edge/docs/en.md

1. **Warm up**: run 5-10 dummy forward passes. Ignore them.
2. **Synchronise**: call `torch.cuda.synchronize()` before and after the timed block.
3. **Fix input size**: use the production resolution. 224x224 is not 512x512.
4. **Time**: use `time.perf_counter()` around each pass.
5. **Report**: give p50, p95 and p99. The mean hides the tail.
6. **Decide**: use FLOPs for architecture search. Use on-device latency to ship.

## Defaults and numbers
type: defaults
from: phases/04-computer-vision/15-real-time-edge/docs/en.md, phases/04-computer-vision/15-real-time-edge/code/main.py, phases/04-computer-vision/16-vision-pipeline-capstone/docs/en.md, phases/04-computer-vision/16-vision-pipeline-capstone/code/main.py

| Setting | Default | Note |
|---|---|---|
| `opset_version` | 17 | ONNX export |
| Latency loop | `warmup=10, iters=50` | Docs. Code uses 5 and 20 |
| `min_crop` | 32 | Docs. Code uses 16. Smaller boxes skip the classifier |
| Crop resize | 224 | Docs. Code uses 64 |
| `backend` | x86 | PTQ qconfig |
| Micro-batch window | 20ms | Collect requests, then batch |
| INT8 accuracy loss | 0.1-1 | Percentage points with static PTQ |
| CPU stage times | 300-500 ms | Detect. Preprocess about 3 ms |

## Edge targets and formats
type: concepts
from: phases/17-infrastructure-and-production/12-edge-inference/docs/en.md

- **Apple ANE**: 38 TOPS, unified memory. INT4 weights + FP16 activations through Core ML.
- **Qualcomm Hexagon**: 45 TOPS. QNN INT8 / INT4 through AI Hub converters.
- **WebGPU / WebLLM**: Q4 MLC (`q4f16_1`) with `mlc_llm convert_weight`. GGUF is not supported.
- **Jetson Orin Nano**: Q4 GGUF or TRT-LLM INT4. Memory-bound.
- **Jetson AGX / Thor**: NVFP4 + FP8 KV on the Edge-LLM path.
- **Vision runtimes**: export PyTorch to ONNX, then pick ONNX Runtime, TensorRT, Core ML or TFLite.

## Bandwidth sets the decode ceiling
type: concepts
from: phases/17-infrastructure-and-production/12-edge-inference/docs/en.md, phases/17-infrastructure-and-production/12-edge-inference/code/main.py, phases/04-computer-vision/15-real-time-edge/docs/en.md

- **Ceiling**: $\text{tok/s} = \frac{\text{bandwidth (GB/s)}}{\text{model size (GB)}}$. Decode reads all weights per token.
- **Mobile**: 3.5 GB at 50 GB/s takes 70 ms. The ceiling is ~14 tok/s.
- **Datacenter**: HBM3 at 3 TB/s clears 3.5 GB in 1.2 ms. The ceiling is 830 tok/s.
- **Gap**: datacenter to edge bandwidth is 30-50x.
- **Phone context**: 4 GB model + 2 GB KV cache for 32K tokens on 8 GB RAM = OOM. Keep 4K-8K.
- **Conv FLOPs**: $2 \, c_{in} \, c_{out} \, k_h \, k_w \, h \, w$ for one conv layer.
- **INT8**: model size and memory bandwidth drop 4x. Compute drops 2-4x.

## Troubleshooting
type: troubleshooting
from: phases/04-computer-vision/15-real-time-edge/docs/en.md, phases/04-computer-vision/16-vision-pipeline-capstone/docs/en.md, phases/17-infrastructure-and-production/12-edge-inference/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| First timings are slow | Cold caches and JIT compilation | Warm up 5-10 passes |
| GPU latency looks tiny | You measure kernel dispatch | Synchronise around the timed block |
| Crops come back empty | Boxes in (cx, cy, w, h) | Validate (x1, y1, x2, y2) with Pydantic |
| Crop fails at the edge | Out-of-bounds boxes | Clamp to the image size |
| Corrupt upload gives 500 | No decode check | Return 400 with a named error |
| First request fails | Model loads late | Load at service startup |
| Phone OOM on long context | KV cache for 32K tokens | Keep context at 4K-8K |
| PTQ accuracy loss too high | Static PTQ is not enough | Use QAT with labelled data |

## Abbreviations
type: glossary
from: phases/04-computer-vision/15-real-time-edge/docs/en.md, phases/17-infrastructure-and-production/12-edge-inference/docs/en.md

- **PTQ**: post-training quantisation. Quantise a trained model without retraining.
- **QAT**: quantisation-aware training. Best accuracy. Needs labelled data.
- **ONNX**: the neutral model format. Every mainstream runtime reads it.
- **FLOPs**: floating-point operations per forward pass. A rough proxy for compute.
- **ANE**: Apple Neural Engine. On-device NPU with unified memory.
- **QNN**: Qualcomm Neural Network SDK. Gives access to Hexagon.
- **Unified memory**: CPU and NPU see the same RAM. No copy overhead.

## Questions
type: qa
from: phases/04-computer-vision/15-real-time-edge/docs/en.md, phases/04-computer-vision/16-vision-pipeline-capstone/docs/en.md, phases/17-infrastructure-and-production/12-edge-inference/docs/en.md

- **Which model for under 3M params?** MobileNetV3-Small. It compiles everywhere.
- **Which model for 10-20M params?** ConvNeXt-Tiny. It is CPU-friendly.
- **Why can more FLOPs run faster?** Depthwise convs compile well. Large 7x7 convs do not.
- **Where does pipeline latency go?** Preprocessing on CPU. The detector takes 70-90% of GPU time.
- **Why is edge decode slow?** Decode is memory-bound. Compute is secondary.

## Tips
type: tips
from: phases/04-computer-vision/15-real-time-edge/docs/en.md, phases/04-computer-vision/16-vision-pipeline-capstone/docs/en.md

- Quantise every edge model to INT8 unless you have a specific reason not to.
- Measure every table cell on the target device, not the workstation.
- Log the model name and weights hash in each response.
- Log every stage timing with a per-request trace ID.
- If the classifier times out, return detections without classifications.
