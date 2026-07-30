# GPU 設定與雲端

> 用 CPU 訓練，學習夠用。真要訓練，就得有 GPU。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 0 · 01
**時間：** 約 45 分鐘

## 學習目標

- 用 `nvidia-smi` 與 PyTorch 的 CUDA API 確認本機有沒有可用的 GPU
- 在 Google Colab 上設定 T4 GPU，免費做雲端實驗
- 對矩陣乘法做 CPU 與 GPU 的效能測試，量測加速倍數
- 用 fp16 的經驗法則，估算你的顯示記憶體最多能塞進多大的模型

## 問題所在

階段 1 到 3 的大部分單元，用 CPU 跑就夠了。但一旦你開始訓練 CNN、Transformer 或 LLM（階段 4 以後），就需要 GPU 加速。同一次訓練在 CPU 上要跑 8 小時，在 GPU 上只要 10 分鐘。

你有三個選擇：本機 GPU、雲端 GPU，或 Google Colab（免費）。

## 核心概念

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

## 動手實作

### 選項 1：本機 NVIDIA GPU

先確認你有沒有：

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
2. 選 Runtime > Change runtime type > T4 GPU
3. 執行 `!nvidia-smi` 確認

本課程的 notebook 可以直接上傳到 Colab。

### 選項 3：雲端 GPU

若使用 Lambda Labs、RunPod 或 Vast.ai：

```bash
ssh user@your-gpu-instance

pip install torch torchvision torchaudio
python -c "import torch; print(torch.cuda.get_device_name(0))"
```

### 沒有 GPU？沒問題。

大部分單元用 CPU 都能跑。需要 GPU 的單元會特別註明，並附上 Colab 連結。

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using: {device}")
```

## 動手實作：GPU 與 CPU 的效能對比

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

## 練習

1. 執行上面的效能測試，比較 CPU 與 GPU 的時間
2. 如果你沒有 GPU，就在 Google Colab 上跑，然後比較
3. 查看你有多少顯示記憶體，估算最大能塞進多大的模型（經驗法則：fp16 每個參數 2 bytes）

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|----------------|----------------------|
| CUDA | 「GPU 程式設計」 | NVIDIA 的平行運算平台，讓你把程式碼跑在 GPU 上 |
| VRAM | 「GPU 記憶體」 | GPU 上的顯示記憶體，與系統記憶體分開。它決定了模型大小的上限。 |
| fp16 | 「半精度」 | 16 位元浮點數，記憶體用量只有 fp32 的一半，精度損失極小 |
| Tensor Core | 「矩陣運算專用硬體」 | GPU 上專為矩陣乘法設計的核心，比一般核心快 4 到 8 倍 |
