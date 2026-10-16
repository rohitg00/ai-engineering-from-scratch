# GPU 設定與雲端運算

> 在 CPU 上訓練（training）足以用來學習；正式訓練則需要 GPU。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 0, Lesson 01
**Time:** ~45 minutes

## Learning Objectives｜學習目標

- 使用 `nvidia-smi` 和 PyTorch 的 CUDA API，確認本機 GPU 是否可用
- 在 Google Colab 設定 T4 GPU，免費執行雲端實驗
- 執行矩陣乘法（matrix multiplication）效能基準測試（benchmark），比較 CPU 和 GPU，並測量加速比（speedup）
- 依據 fp16 經驗法則，估算 VRAM 可容納的最大模型（model）

## The Problem｜問題

第 1–3 階段的大多數課程都能在 CPU 上順利執行。不過，從第 4 階段開始，若要訓練 CNN、transformer 或 LLM，就需要 GPU 加速。一次訓練在 CPU 上要花 8 小時，在 GPU 上則只需 10 分鐘。

你有三種選擇：本機 GPU、雲端 GPU（cloud GPU），或 Google Colab（免費）。

## The Concept｜核心概念

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

## Build It｜動手實作

### 選項 1：本機 NVIDIA GPU

先確認系統是否偵測到 GPU：

```bash
nvidia-smi
```

安裝支援 CUDA 的 PyTorch：

```python
import torch

print(f"CUDA available: {torch.cuda.is_available()}")
print(f"CUDA version: {torch.version.cuda}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
```

### 選項 2：Google Colab

1. 前往 [colab.research.google.com](https://colab.research.google.com)
2. 選取 Runtime > Change runtime type > T4 GPU
3. 執行 `!nvidia-smi` 確認 GPU 是否可用

你也可以直接將本課程的 notebook 上傳到 Colab。

### 選項 3：雲端 GPU

如果使用 Lambda Labs、RunPod 或 Vast.ai：

```bash
ssh user@your-gpu-instance

pip install torch torchvision torchaudio
python -c "import torch; print(torch.cuda.get_device_name(0))"
```

### 沒有 GPU？也沒問題。

大多數課程都能在 CPU 上執行。需要 GPU 的課程會明確說明，並附上 Colab 連結。

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using: {device}")
```

## Build It｜動手實作：GPU 與 CPU 效能基準測試

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

## Exercises｜練習

1. 執行上方的效能基準測試，比較 CPU 和 GPU 的執行時間
2. 如果你沒有 GPU，可以在 Google Colab 上執行測試並比較結果
3. 查看 GPU 記憶體（memory）容量，並估算能容納的最大模型。依據 fp16 經驗法則，每個參數（parameter）使用 2 位元組（bytes）。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際含義 |
|------|----------------|----------------------|
| CUDA | 「GPU 程式設計」 | NVIDIA 的平行運算平台（parallel computing platform），可讓你在 GPU 上執行程式碼 |
| VRAM | 「GPU 記憶體」 | GPU 上的顯示記憶體（Video RAM），與系統記憶體分開，容量會限制模型大小 |
| fp16 | 「半精度（half precision）」 | 16-bit 浮點數（floating point）格式，使用的記憶體是 fp32 的一半，準確率（accuracy）只會略微下降 |
| Tensor Core | 「快速矩陣運算硬體」 | 專為矩陣乘法設計的 GPU 核心，速度是一般核心的 4–8 倍 |
