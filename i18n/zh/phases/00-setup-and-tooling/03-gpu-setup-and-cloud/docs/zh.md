# GPU 设置与云端

> 在 CPU 上训练对于学习来说足够了。真正的训练需要 GPU。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 0, Lesson 01
**Time:** ~45 分钟

## 学习目标

- 使用 `nvidia-smi` 和 PyTorch 的 CUDA API 验证本地 GPU 是否可用
- 配置 Google Colab 的 T4 GPU,进行免费的云端实验
- 在 CPU 与 GPU 上进行矩阵乘法基准测试并测量加速比
- 使用 fp16 经验法则估算你的 VRAM 能容纳的最大模型

## 问题

第 1-3 阶段的大多数课程在 CPU 上运行良好。但一旦你开始训练 CNN、transformer 或 LLM(第 4 阶段及以后),就需要 GPU 加速。在 CPU 上需要 8 小时的训练,在 GPU 上只需 10 分钟。

你有三个选择:本地 GPU、云端 GPU 或 Google Colab(免费)。

## 概念

```
Your options:

1. Local NVIDIA GPU
   Cost: $0 (you already have it)
   Setup: Install CUDA + cuDNN
   Best for: Regular use, large datasets

2. Google Colab (free tier)
   Cost: $0
   Setup: None
   Best for: Quick experiments, no GPU at home

3. Cloud GPU (Lambda, RunPod, Vast.ai)
   Cost: $0.20-2.00/hr
   Setup: SSH + install
   Best for: Serious training, large models
```

```figure
s0-gpu-dispatch
```

## 动手实现

### 选项 1:本地 NVIDIA GPU

检查你是否有一块:

```bash
nvidia-smi
```

安装带 CUDA 的 PyTorch:

```python
import torch

print(f"CUDA available: {torch.cuda.is_available()}")
print(f"CUDA version: {torch.version.cuda}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
```

### 选项 2:Google Colab

1. 访问 [colab.research.google.com](https://colab.research.google.com)
2. Runtime > Change runtime type > T4 GPU
3. 运行 `!nvidia-smi` 进行验证

可以直接将本课程的 notebook 上传到 Colab。

### 选项 3:云端 GPU

对于 Lambda Labs、RunPod 或 Vast.ai:

```bash
ssh user@your-gpu-instance

pip install torch torchvision torchaudio
python -c "import torch; print(torch.cuda.get_device_name(0))"
```

### 没有 GPU?没问题。

大多数课程都可以在 CPU 上运行。需要 GPU 的课程会明确说明,并提供 Colab 链接。

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using: {device}")
```

## 动手实现:GPU 与 CPU 基准测试

```python
import torch
import time

size = 5000

a_cpu = torch.randn(size, size)
b_cpu = torch.randn(size, size)

start = time.time()
c_cpu = a_cpu @ b_cpu
cpu_time = time.time() - start
print(f"CPU: {cpu_time:.3f}s")

if torch.cuda.is_available():
    a_gpu = a_cpu.to("cuda")
    b_gpu = b_cpu.to("cuda")

    torch.cuda.synchronize()
    start = time.time()
    c_gpu = a_gpu @ b_gpu
    torch.cuda.synchronize()
    gpu_time = time.time() - start
    print(f"GPU: {gpu_time:.3f}s")
    print(f"Speedup: {cpu_time / gpu_time:.0f}x")
```

## 练习

1. 运行上面的基准测试,比较 CPU 与 GPU 的时间
2. 如果你没有 GPU,在 Google Colab 上运行并比较
3. 查看你有多少 GPU 显存,并估算能容纳的最大模型(经验法则:fp16 下每个参数 2 字节)

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|----------------|----------------------|
| CUDA | "GPU 编程" | NVIDIA 的并行计算平台,让你能在 GPU 上运行代码 |
| VRAM | "GPU 显存" | GPU 上的视频内存,与系统内存相互独立。它限制了模型大小。 |
| fp16 | "半精度" | 16 位浮点数,内存占用是 fp32 的一半,精度损失极小 |
| Tensor Core | "快速矩阵硬件" | 专用于矩阵乘法的 GPU 核心,比普通核心快 4-8 倍 |