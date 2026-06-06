---
name: skill-latency-profiler
description: Write a complete latency-benchmarking script with warmup, synchronisation, percentiles, and memory tracking
version: 1.0.0
phase: 4
lesson: 15
tags: [edge, deployment, profiling, benchmarking]
---

# Latency Profiler

Produce a disciplined latency benchmark for any PyTorch model. Reports that anyone downstream can actually trust.

## When to use

- Comparing multiple candidate backbones before picking one to deploy.
- Before and after quantisation or pruning.
- After a runtime change (eager vs ONNX vs TensorRT).
- Generating a deployment-readiness report.

## Inputs

- `model`: PyTorch `nn.Module`.
- `input_shape`: tuple like `(1, 3, 224, 224)`.
- `device`: `cpu` | `cuda` | `mps`.
- `warmup`: default 10.
- `iters`: default 100.

## Checks

### 1. Warmup
Run the model `warmup` times without timing. Catches first-forward JIT compilation and cold cache effects.

### 2. Synchronisation
For `cuda`, call `torch.cuda.synchronize()` before and after each timed forward pass.
For `mps`, call `torch.mps.synchronize()`.

### 3. Timer
Use `time.perf_counter()` for wall-clock measurement. Convert to milliseconds.

### 4. Percentiles
Sort the full list of timings. Report `p50, p90, p95, p99, mean, std`.

### 5. Memory
For `cuda`, call `torch.cuda.max_memory_allocated()` after the run and subtract any baseline.
For `cpu`, use `tracemalloc` or `psutil.Process().memory_info().rss` before and after.

### 6. Batch-size sweep
Optionally repeat the benchmark for `batch_size in [1, 4, 16, 32]` to reveal throughput vs latency tradeoffs.

## Output template

```python
import time
import torch
import psutil, os

def profile(model, input_shape, device="cpu", warmup=10, iters=100):
    proc = psutil.Process(os.getpid())
    baseline_rss = proc.memory_info().rss / 1e6

    model = model.to(device).eval()
    x = torch.randn(input_shape, device=device)

    def sync():
        if device == "cuda":
            torch.cuda.synchronize()
        elif device == "mps":
            torch.mps.synchronize()

    with torch.no_grad():
        for _ in range(warmup):
            model(x)
        sync()
        if device == "cuda":
            torch.cuda.reset_peak_memory_stats()

        times = []
        for _ in range(iters):
            sync()
            t0 = time.perf_counter()
            model(x)
            sync()
            times.append((time.perf_counter() - t0) * 1000)

    times.sort()
    mean = sum(times) / len(times)
    std  = (sum((t - mean) ** 2 for t in times) / len(times)) ** 0.5

    def pct(p):
        idx = max(0, min(len(times) - 1, int(len(times) * p) - 1))
        return times[idx]

    report = {
        "p50_ms":  pct(0.50),
        "p90_ms":  pct(0.90),
        "p95_ms":  pct(0.95),
        "p99_ms":  pct(0.99),
        "mean_ms": mean,
        "std_ms":  std,
        "rss_mb":  proc.memory_info().rss / 1e6 - baseline_rss,
    }
    if device == "cuda":
        report["peak_cuda_mb"] = torch.cuda.max_memory_allocated() / 1e6

    return report
```

## Rules

- Always run warmup; never trust a first-forward timing.
- Percentiles, not mean — a single outlier can double the mean but barely move p50.
- Use the same input_shape as production; latency on 224x224 is not latency on 384x384.
- For CUDA, never omit `torch.cuda.synchronize()`; the numbers are meaningless without it.
- Log the torch version, CUDA version, and device name alongside the numbers — they stop being comparable otherwise.
