---
name: skill-latency-profiler
description: warmup、synchronisation、percentiles、memory trackingを備えた完全なlatency benchmarking scriptを書く
version: 1.0.0
phase: 4
lesson: 15
tags: [edge, deployment, profiling, benchmarking]
---

# Latency Profiler

任意のPyTorch modelについて、規律あるlatency benchmarkを作ります。下流の誰もが実際に信頼できるreportを出します。

## 使う場面

- デプロイ先を決める前に、複数の候補backboneを比較するとき。
- 量子化またはpruningの前後。
- runtime変更後（eager vs ONNX vs TensorRT）。
- deployment-readiness reportを生成するとき。

## 入力

- `model`: PyTorch `nn.Module`。
- `input_shape`: `(1, 3, 224, 224)` のようなtuple。
- `device`: `cpu` | `cuda` | `mps`。
- `warmup`: default 10。
- `iters`: default 100。

## チェック

### 1. Warmup
時間計測せずにmodelを `warmup` 回実行する。初回forwardのJIT compilationやcold cacheの影響を吸収する。

### 2. Synchronisation
`cuda` では、各forward passの計測前後に `torch.cuda.synchronize()` を呼ぶ。
`mps` では `torch.mps.synchronize()` を呼ぶ。

### 3. Timer
wall-clock計測には `time.perf_counter()` を使う。ミリ秒へ変換する。

### 4. Percentiles
timingの全リストをsortする。`p50, p90, p95, p99, mean, std` を報告する。

### 5. Memory
`cuda` では実行後に `torch.cuda.max_memory_allocated()` を呼び、baselineを差し引く。
`cpu` では前後で `tracemalloc` または `psutil.Process().memory_info().rss` を使う。

### 6. Batch-size sweep
任意で `batch_size in [1, 4, 16, 32]` のbenchmarkを繰り返し、throughputとlatencyのトレードオフを見える化する。

## 出力テンプレート

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

## ルール

- 必ずwarmupを実行する。初回forwardのtimingを信じない。
- meanではなくpercentiles。単一の外れ値はmeanを倍にすることがあるが、p50はほとんど動かない。
- 本番と同じ `input_shape` を使う。224x224のlatencyは384x384のlatencyではない。
- CUDAでは `torch.cuda.synchronize()` を省略しない。省略した数値は意味がない。
- 数値と一緒にtorch version、CUDA version、device nameをlogする。そうしないと比較可能性が失われる。
