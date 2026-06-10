# 03 · GPU 配置与云端方案

> 在 CPU 上训练用于学习足矣。但真正的训练需要 GPU。

**类型：** 实操构建
**语言：** Python
**前置：** 阶段 0，第 01 课
**时长：** 约 45 分钟

## 学习目标

- 使用 `nvidia-smi` 和 PyTorch 的 CUDA API 验证本地 GPU 是否可用
- 配置带 T4 GPU 的 Google Colab，用于免费的云端实验
- 在 CPU 与 GPU 上对矩阵乘法做基准测试（benchmark），并测量加速比
- 使用 fp16 经验法则估算你的显存（VRAM）能容纳的最大模型

## 问题所在

阶段 1-3 的大多数课程在 CPU 上都能正常运行。但一旦你开始训练 CNN、Transformer 或大语言模型（LLM）（阶段 4 及以后），就需要 GPU 加速。一次训练在 CPU 上要跑 8 小时，在 GPU 上只需 10 分钟。

你有三种选择：本地 GPU、云端 GPU，或 Google Colab（免费）。

## 核心概念

```
你的选项：

1. 本地 NVIDIA GPU
   成本：$0（你已经拥有）
   配置：安装 CUDA + cuDNN
   适合：日常使用、大型数据集

2. Google Colab（免费层）
   成本：$0
   配置：无需配置
   适合：快速实验、家里没有 GPU

3. 云端 GPU（Lambda、RunPod、Vast.ai）
   成本：$0.20-2.00/小时
   配置：SSH + 安装
   适合：正式训练、大型模型
```

## 动手构建

### 选项 1：本地 NVIDIA GPU

检查你是否有一块：

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

### 选项 2：Google Colab

1. 访问 [colab.research.google.com](https://colab.research.google.com)
2. Runtime > Change runtime type > T4 GPU
3. 运行 `!nvidia-smi` 进行验证

你可以把本课程的 notebook 直接上传到 Colab。

### 选项 3：云端 GPU

对于 Lambda Labs、RunPod 或 Vast.ai：

```bash
ssh user@your-gpu-instance

pip install torch torchvision torchaudio
python -c "import torch; print(torch.cuda.get_device_name(0))"
```

### 没有 GPU？没问题。

大多数课程在 CPU 上都能运行。需要 GPU 的课程会明确说明，并附上 Colab 链接。

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using: {device}")
```

## 动手构建：GPU 与 CPU 基准测试

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

1. 运行上面的基准测试，比较 CPU 与 GPU 的耗时
2. 如果你没有 GPU，就在 Google Colab 上运行并比较
3. 查看你有多少 GPU 显存，并估算你能容纳的最大模型（经验法则：fp16 下每个参数占 2 字节）

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|----------------------|
| CUDA | “GPU 编程” | NVIDIA 的并行计算平台，让你能够在 GPU 上运行代码 |
| VRAM | “GPU 内存” | GPU 上的显存（Video RAM），独立于系统内存，限制了模型大小 |
| fp16 | “半精度” | 16 位浮点数，内存占用是 fp32 的一半，精度损失极小 |
| Tensor Core | “快速矩阵硬件” | GPU 上专门用于矩阵乘法的核心，比普通核心快 4-8 倍 |
