---
name: skill-latency-profiler
description: 编写完整的延迟基准测试脚本，包含预热、同步、百分位数和内存跟踪
version: 1.0.0
phase: 4
lesson: 15
tags: [edge, deployment, profiling, benchmarking]
---

# 延迟分析器

为任何 PyTorch 模型生成规范的延迟基准测试。输出下游任何人都可以信任的报告。

## 使用时机

- 在挑选部署模型之前比较多个候选骨干网络。
- 量化和剪枝前后。
- 运行时变更后（eager vs ONNX vs TensorRT）。
- 生成部署就绪报告。

## 输入

- `model`：PyTorch `nn.Module`。
- `input_shape`：元组如 `(1, 3, 224, 224)`。
- `device`：`cpu` | `cuda` | `mps`。
- `warmup`：默认为 10。
- `iters`：默认为 100。

## 检查项

### 1. 预热
在不计时代的情况下运行模型 `warmup` 次。捕获首次前向 JIT 编译和冷缓存效应。

### 2. 同步
对于 `cuda`，在每次计时前向传播前后调用 `torch.cuda.synchronize()`。
对于 `mps`，调用 `torch.mps.synchronize()`。

### 3. 计时器
使用 `time.perf_counter()` 进行挂钟时间测量。转换为毫秒。

### 4. 百分位数
对所有计时结果排序。报告 `p50, p90, p95, p99, mean, std`。

### 5. 内存
对于 `cuda`，运行后调用 `torch.cuda.max_memory_allocated()` 并减去基线。
对于 `cpu`，使用 `tracemalloc` 或在运行前后使用 `psutil.Process().memory_info().rss`。

### 6. 批量大小扫描
可选地对 `batch_size in [1, 4, 16, 32]` 重复基准测试，以揭示吞吐量与延迟的权衡。

## 输出模板

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

## 规则

- 始终运行预热；绝不相信首次前向的计时结果。
- 使用百分位数而非平均值——单个异常值可以使平均值翻倍但对 p50 影响甚微。
- 使用与生产环境相同的 input_shape；224x224 上的延迟不等于 384x384 上的延迟。
- 对于 CUDA，绝不能省略 `torch.cuda.synchronize()`；没有它数据毫无意义。
- 在输出数据的同时记录 torch 版本、CUDA 版本和设备名称——否则数据无法进行比较。
