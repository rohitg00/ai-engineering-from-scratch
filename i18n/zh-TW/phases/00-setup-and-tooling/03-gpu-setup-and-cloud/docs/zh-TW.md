# GPU 設定與雲端運算

> 用 CPU 學習沒有問題；實際訓練模型則需要 GPU。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 0, Lesson 01
**Time:** ~45 minutes

## Learning Objectives

- 使用 `nvidia-smi` 和 PyTorch 的 CUDA API，確認本機 GPU 是否可用
- 在 Google Colab 設定 T4 GPU，免費進行雲端實驗
- 比較 CPU 與 GPU 執行矩陣乘法的速度，測量加速幅度
- 使用 fp16 經驗法則，估算 VRAM 可容納的最大模型

## The Problem｜問題

第 1 到第 3 階段的大多數課程都能在 CPU 上順利執行。但開始訓練 CNN、Transformer 或 LLM（第 4 階段起）時，就需要 GPU 加速。原本在 CPU 上要跑 8 小時的訓練，在 GPU 上只要 10 分鐘。

你有三種選擇：本機 GPU、雲端 GPU，或免費的 Google Colab。

## The Concept｜核心概念

```text
你有以下選項：

1. 本機 NVIDIA GPU
   費用：$0（你已經有 GPU）
   設定：安裝 CUDA + cuDNN
   適合：經常使用、處理大型資料集

2. Google Colab（免費方案）
   費用：$0
   設定：無需設定
   適合：快速實驗、家裡沒有 GPU

3. 雲端 GPU（Lambda、RunPod、Vast.ai）
   費用：每小時 $0.20 到 $2.00
   設定：使用 SSH 連線後安裝
   適合：正式訓練、大型模型
```

```figure
s0-gpu-dispatch
```

## Build It｜動手打造

### 選項 1：本機 NVIDIA GPU

先確認電腦是否有 NVIDIA GPU：

```bash
nvidia-smi
```

安裝支援 CUDA 的 PyTorch，並確認 GPU 狀態：

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
2. 選取 `Runtime > Change runtime type > T4 GPU`
3. 執行 `!nvidia-smi` 確認 GPU 狀態

你也可以把本課程的 Notebook 直接上傳到 Colab。

### 選項 3：雲端 GPU

若使用 Lambda Labs、RunPod 或 Vast.ai：

```bash
ssh user@your-gpu-instance

pip install torch torchvision torchaudio
python -c "import torch; print(torch.cuda.get_device_name(0))"
```

### 沒有 GPU 也沒關係

大多數課程都能在 CPU 上執行。需要 GPU 的課程會特別標示，並附上 Colab 連結。

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using: {device}")
```

## Build It: GPU 與 CPU 效能比較

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

1. 執行上面的效能測試，比較 CPU 與 GPU 的執行時間
2. 如果沒有 GPU，就在 Google Colab 執行並比較結果
3. 查看 GPU 記憶體容量，估算可容納的最大模型（經驗法則：fp16 每個參數需要 2 bytes）

## Key Terms｜重要詞彙

| 詞彙 | 常見說法 | 實際意義 |
|------|----------|----------|
| CUDA |「GPU 程式設計」| NVIDIA 的平行運算平台，讓程式能在 GPU 上執行 |
| VRAM |「GPU 記憶體」| GPU 上的視訊記憶體，與系統 RAM 分開；容量會限制模型大小 |
| fp16 |「半精度」| 16 位元浮點數；相較 fp32 只需一半記憶體，準確度影響很小 |
| Tensor Core |「快速矩陣運算硬體」| GPU 上專門執行矩陣乘法的核心，速度比一般核心快 4 到 8 倍 |
