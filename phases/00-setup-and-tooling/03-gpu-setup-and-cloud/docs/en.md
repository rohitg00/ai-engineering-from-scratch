# GPUセットアップとクラウド

> 学習目的ならCPUで十分です。本格的に学習させるならGPUが必要です。

**タイプ:** 作ってみる
**言語:** Python
**前提条件:** フェーズ0、レッスン01
**時間:** 約45分

## 学習目標

- `nvidia-smi` とPyTorchのCUDA APIを使って、ローカルGPUが利用可能か確認する
- 無料のクラウド実験用に、T4 GPU付きGoogle Colabを設定する
- CPUとGPUで行列積をベンチマークし、速度向上を測定する
- fp16の経験則を使って、VRAMに収まる最大モデルを見積もる

## 課題

フェーズ1から3のほとんどのレッスンはCPUで問題なく動きます。しかしCNN、transformer、LLM（フェーズ4以降）を学習し始めると、GPUによる高速化が必要になります。CPUで8時間かかる学習が、GPUなら10分で終わります。

選択肢は3つです。ローカルGPU、クラウドGPU、またはGoogle Colab（無料）です。

## 考え方

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

## 作ってみる

### 選択肢1: ローカルNVIDIA GPU

GPUがあるか確認します。

```bash
nvidia-smi
```

CUDA対応のPyTorchをインストールします。

```python
import torch

print(f"CUDA available: {torch.cuda.is_available()}")
print(f"CUDA version: {torch.version.cuda}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
```

### 選択肢2: Google Colab

1. [colab.research.google.com](https://colab.research.google.com) を開く
2. Runtime > Change runtime type > T4 GPU
3. `!nvidia-smi` を実行して確認する

このコースのnotebookは、そのままColabへアップロードできます。

### 選択肢3: クラウドGPU

Lambda Labs、RunPod、Vast.aiの場合:

```bash
ssh user@your-gpu-instance

pip install torch torchvision torchaudio
python -c "import torch; print(torch.cuda.get_device_name(0))"
```

### GPUがなくても大丈夫

ほとんどのレッスンはCPUで動きます。GPUが必要なレッスンではその旨を明記し、Colabリンクを用意します。

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using: {device}")
```

## 作ってみる: GPU vs CPUベンチマーク

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

## 演習

1. 上のベンチマークを実行し、CPUとGPUの時間を比較する
2. GPUがない場合はGoogle Colabで実行して比較する
3. GPUメモリの容量を確認し、収まる最大モデルを見積もる（経験則: fp16では1パラメータあたり2バイト）

## 重要用語

| 用語 | よくある言い方 | 実際の意味 |
|------|----------------|----------------------|
| CUDA | 「GPUプログラミング」 | GPU上でコードを実行できるNVIDIAの並列計算プラットフォーム |
| VRAM | 「GPUメモリ」 | システムRAMとは別にGPU上にあるVideo RAM。モデルサイズを制限する。 |
| fp16 | 「半精度」 | 16ビット浮動小数点。精度低下を最小限に抑えながら、fp32の半分のメモリを使う |
| Tensor Core | 「高速な行列用ハードウェア」 | 行列積用の専用GPUコア。通常のコアより4〜8倍高速 |
