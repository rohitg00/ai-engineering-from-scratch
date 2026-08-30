# GPU Setup & Cloud

> 接受中央处理器培训对于学习来说是很好的。真实训练需要一个图形处理器。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 第0阶段，第01课
** 时间：** ~45分钟

## 学习目标

- Verify local GPU availability using `nvidia-smi` and PyTorch's CUDA API
- 为Google Colab配置T4图形处理器以进行免费的云实验
- 在CPU和GPU上对矩阵乘法进行基准测试并测量加速比
- 使用fp 16经验法则估计适合VRAM的最大型号

## The Problem

阶段1-3中的大多数课程在中央处理器上运行良好。但一旦您开始训练CNN、变形器或LLM（阶段4+），您就需要图形处理器加速。在处理器上需要8小时的训练运行在处理器上需要10分钟。

您有三种选择：本地图形处理器、云图形处理器或Google Colab（免费）。

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

## Build It

### 选项1：本地NVIDIA图形处理器

检查您是否有：

```bash
nvidia-smi
```

使用CUDA安装PyTorch：

```python
import torch

print(f"CUDA available: {torch.cuda.is_available()}")
print(f"CUDA version: {torch.version.cuda}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
```

### Option 2: Google Colab

1. 转到[colab.research.google.com]（https：//colab.research.google.com）
2. >更改运行时类型> T4图形处理器
3. 快跑'！nvidia-smi“要验证

Upload notebooks from this course directly to Colab.

### 选项3：云图形处理器

对于Lambda Labs、RunPod或Vast.ai：

```bash
ssh user@your-gpu-instance

pip install torch torchvision torchaudio
python -c "import torch; print(torch.cuda.get_device_name(0))"
```

### 没有图形处理器？没问题.

大多数课程在中央处理器上工作。需要图形处理器的用户会这么说，并包括Colab链接。

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using: {device}")
```

## 构建它：图形处理器与图形处理器基准

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

## Exercises

1. 运行上面的基准测试并比较处理器与处理器的时间
2. 如果您没有图形处理器，请在Google Colab上运行它并进行比较
3. 检查您有多少图形处理器内存并估计您可以适应的最大模型（经验法则：fp 16的每个参数2个字节）

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|----------------|----------------------|
| CUDA | "GPU programming" | 英伟达的并行计算平台，可让您在图形处理器上运行代码 |
| VRAM | “GPU内存” | GPU上的视频RAM，与系统RAM分开。限制模型大小。 |
| FP16 | “半精确” | 16-bit floating point, uses half the memory of fp32 with minimal accuracy loss |
| Tensor Core | “快速矩阵硬件” | 用于矩阵相乘的专用图形处理器核心，比普通核心快4- 8倍 |
