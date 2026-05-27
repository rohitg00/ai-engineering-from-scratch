# GPU 设置与云

> 在 CPU 上训练适合学习。实际训练需要 GPU。

**类型：** 构建  
**语言：** Python  
**前置条件：** 阶段 0，第 01 课  
**时间：** ~45 分钟

## 学习目标

- 使用 `nvidia-smi` 和 PyTorch 的 CUDA API 验证本地 GPU 是否可用
- 配置带有 T4 GPU 的 Google Colab，用于免费的云端实验
- 对 CPU 和 GPU 上的矩阵乘法进行基准测试，并测量加速比
- 使用 fp16 经验法则估算适合你显存的最大模型

## 问题

阶段 1–3 中的大部分课程在 CPU 上运行良好。但一旦开始训练 CNN、Transformer 或 LLM（阶段 4+），就需要 GPU 加速。在 CPU 上需要 8 小时的训练，在 GPU 上只需 10 分钟。

你有三种选择：本地 GPU、云端 GPU 或 Google Colab（免费）。

## 概念

```
你的选择：

1. 本地 NVIDIA GPU  
   成本：$0（你已经拥有）  
   设置：安装 CUDA + cuDNN  
   最适合：日常使用、大数据集

2. Google Colab（免费版）  
   成本：$0  
   设置：无需  
   最适合：快速实验、本地没有 GPU

3. 云端 GPU（Lambda、RunPod、Vast.ai）  
   成本：$0.20–2.00/小时  
   设置：SSH + 安装  
   最适合：严肃训练、大模型
```

## 构建

### 选项 1：本地 NVIDIA GPU

检查你是否拥有：

```bash
nvidia-smi
```

安装带 CUDA 的 PyTorch：

```python
import torch

print(f"CUDA 可用: {torch.cuda.is_available()}")
print(f"CUDA 版本: {torch.version.cuda}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"显存: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
```

### 选项 2：Google Colab

1. 前往 [colab.research.google.com](https://colab.research.google.com)
2. 运行时 > 更改运行时类型 > T4 GPU
3. 运行 `!nvidia-smi` 以验证

将本课程的笔记本直接上传到 Colab。

### 选项 3：云端 GPU

对于 Lambda Labs、RunPod 或 Vast.ai：

```bash
ssh user@your-gpu-instance

pip install torch torchvision torchaudio
python -c "import torch; print(torch.cuda.get_device_name(0))"
```

### 没有 GPU？没问题。

大部分课程在 CPU 上也能工作。需要 GPU 的课程会明确说明并附上 Colab 链接。

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"使用: {device}")
```

## 构建：GPU 与 CPU 基准测试

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
    print(f"加速比: {cpu_time / gpu_time:.0f}x")
```

## 练习

1. 运行上述基准测试，比较 CPU 和 GPU 的时间
2. 如果你没有 GPU，在 Google Colab 上运行并进行比较
3. 检查你拥有的 GPU 显存，并估算适合的最大模型（经验法则：fp16 每个参数占用 2 字节）

## 关键术语

| 术语 | 人们常说 | 实际含义 |
|------|---------|--------|
| CUDA | "GPU 编程" | NVIDIA 的并行计算平台，让你在 GPU 上运行代码 |
| VRAM | "GPU 内存" | GPU 上的视频 RAM，与系统 RAM 分开，限制了模型大小 |
| fp16 | "半精度" | 16 位浮点数，内存占用为 fp32 的一半，精度损失极小 |
| Tensor Core | "快速矩阵硬件" | 专门用于矩阵乘法的高性能 GPU 核心，速度是普通核心的 4–8 倍 |