# GPU 配置与云端（GPU Setup & Cloud）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 在 CPU 上训练用来学习够用了，但要真刀真枪地训练，就必须上 GPU。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 0, Lesson 01
**Time:** ~45 分钟

## 学习目标（Learning Objectives）

- 用 `nvidia-smi` 和 PyTorch 的 CUDA API 验证本地 GPU 是否可用
- 在 Google Colab 上配置 T4 GPU，免费跑云端实验
- 在 CPU 与 GPU 上对矩阵乘法做基准测试，量化加速比
- 用 fp16 经验法则估算你的 VRAM 能装下的最大模型规模

## 问题（The Problem）

phases 1-3 的大部分课程在 CPU 上就能跑得很顺。但一旦你开始训练 CNN、transformer 或 LLM（phases 4 之后），就必须靠 GPU 加速。在 CPU 上要跑 8 小时的训练任务，GPU 上 10 分钟就搞定。

你有三种选择：本地 GPU、云端 GPU，或 Google Colab（免费）。

## 概念（The Concept）

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

## 动手实现（Build It）

### 方案 1：本地 NVIDIA GPU（Option 1: Local NVIDIA GPU）

先看你有没有 GPU：

```bash
nvidia-smi
```

安装带 CUDA 的 PyTorch：

```python
import torch

print(f"CUDA available: {torch.cuda.is_available()}")
print(f"CUDA version: {torch.version.cuda}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
```

### 方案 2：Google Colab（Option 2: Google Colab）

1. 打开 [colab.research.google.com](https://colab.research.google.com)
2. Runtime > Change runtime type > T4 GPU
3. 运行 `!nvidia-smi` 验证一下

本课程的 notebook 可以直接上传到 Colab 跑。

### 方案 3：云端 GPU（Option 3: Cloud GPU）

对于 Lambda Labs、RunPod 或 Vast.ai：

```bash
ssh user@your-gpu-instance

pip install torch torchvision torchaudio
python -c "import torch; print(torch.cuda.get_device_name(0))"
```

### 没有 GPU？没问题。（No GPU? No problem.）

大部分课程在 CPU 上都能跑。需要 GPU 的课程会明确标出来，并附带 Colab 链接。

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using: {device}")
```

## 动手实现：GPU vs CPU 基准测试（Build It: GPU vs CPU benchmark）

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

## 练习（Exercises）

1. 跑一遍上面的基准测试，对比 CPU 和 GPU 的耗时
2. 如果你没有 GPU，就在 Google Colab 上跑，再对比
3. 看看你的 GPU 有多少显存，估算能装下的最大模型规模（经验法则：fp16 下每个参数 2 字节）

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| CUDA | “GPU 编程” | NVIDIA 的并行计算平台，让你能把代码跑在 GPU 上 |
| VRAM | “GPU 显存” | GPU 上的显存，和系统内存是分开的，决定了模型规模上限 |
| fp16 | “半精度” | 16 位浮点，相比 fp32 占用一半内存，精度损失很小 |
| Tensor Core | “专跑矩阵的硬件” | GPU 上专门做矩阵乘法的核心，比常规核心快 4-8 倍 |
