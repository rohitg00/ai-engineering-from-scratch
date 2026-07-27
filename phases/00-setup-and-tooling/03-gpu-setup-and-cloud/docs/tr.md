# GPU Kurulumu ve Bulut

> CPU eğitimi öğrenmek için iyidir. Gerçek anlamda eğitim bir GPU'ya ihtiyaç duyar.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 0, Ders 01
**Süre:** ~45 dakika

## Öğrenme Hedefleri

- `nvidia-smi` ve PyTorch'un CUDA API'sini kullanarak yerel GPU kullanılabilirliğini doğrulayın
- Ücretsiz bulut tabanlı deneyler için Google Colab'ı T4 GPU ile yapılandırın
- CPU ve GPU'da Benchmark matris çarpımı ve hızı ölçme
- Fp16 temel kuralını kullanarak VRAM'inize uyan en büyük modeli tahmin edin

## Sorun

Aşama 1-3'teki derslerin çoğu CPU'da sorunsuz çalışır. Ancak CNN'leri, transformer'leri veya LLM'leri (aşama 4+) eğitmeye başladığınızda GPU hızlandırmaya ihtiyacınız vardır. CPU'da 8 saat süren bir eğitim çalışması GPU'da 10 dakika sürer.

Üç seçeneğiniz var: yerel GPU, bulut GPU veya Google Colab (ücretsiz).

## Konsept

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

## İnşa Et

### Seçenek 1: Yerel NVIDIA GPU

Bir tane olup olmadığını kontrol edin:

```bash
nvidia-smi
```

PyTorch'u CUDA ile yükleyin:

```python
import torch

print(f"CUDA available: {torch.cuda.is_available()}")
print(f"CUDA version: {torch.version.cuda}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
```

### 2. Seçenek: Google Colab

1. [colab.research.google.com](https://colab.research.google.com)'ye gidin
2. Çalışma zamanı > Çalışma zamanı türünü değiştir > T4 GPU
3. Doğrulamak için `!nvidia-smi` komutunu çalıştırın

Bu kurstaki not defterlerini doğrudan Colab'a yükleyin.

### Seçenek 3: Bulut GPU

Lambda Labs, RunPod veya Vast.ai için:

```bash
ssh user@your-gpu-instance

pip install torch torchvision torchaudio
python -c "import torch; print(torch.cuda.get_device_name(0))"
```

### GPU yok mu? Sorun değil.

Derslerin çoğu CPU üzerinde çalışır. GPU'ya ihtiyaç duyanlar bunu söyleyecek ve Colab bağlantılarını içerecektir.

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using: {device}")
```

## Oluşturun: GPU ve CPU benchmark

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

## Egzersizler

1. Yukarıdaki benchmark'yi çalıştırın ve CPU ile GPU sürelerini karşılaştırın
2. GPU'nuz yoksa Google Colab'da çalıştırın ve karşılaştırın
3. Ne kadar GPU belleğiniz olduğunu kontrol edin ve sığdırabileceğiniz en büyük modeli tahmin edin (temel kural: fp16 için parametre başına 2 bayt)

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|----------------------|
| CUDA | "GPU programlama" | NVIDIA'nın GPU'da kod çalıştırmanıza olanak tanıyan paralel bilgi işlem platformu |
| VRAM | "GPU belleği" | GPU'daki video RAM'i, sistem RAM'inden ayrıdır. Model boyutunu sınırlar. |
| fp16 | "Yarı hassasiyet" | 16 bit kayan nokta, minimum doğruluk kaybıyla FP32 belleğinin yarısını kullanır |
| Tensör Çekirdeği | "Hızlı matris donanımı" | Matris çoğaltımı için özel GPU çekirdekleri, normal çekirdeklerden 4-8 kat daha hızlı |
