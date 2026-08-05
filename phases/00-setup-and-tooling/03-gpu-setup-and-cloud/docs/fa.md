# GPU Setup & Cloud

> آموزش روی CPU برای یادگیری کاملاً مناسب است؛ اما برای آموزش واقعی، GPU لازم دارید.

**Type:** ساخت
**Languages:** Python
**Prerequisites:** مرحله‌ی 0، درس 01
**Time:** حدود 45 دقیقه

## اهداف یادگیری

- با استفاده از `nvidia-smi` و CUDA API در PyTorch، در دسترس بودن GPU محلی را بررسی کنید
- Google Colab را با یک GPU مدل T4 برای آزمایش‌های ابری رایگان تنظیم کنید
- ضرب ماتریسی را روی CPU و GPU با benchmark (معیارسنجی) بررسی کنید و speedup (افزایش سرعت) را اندازه بگیرید
- با استفاده از قاعده‌ی سرانگشتی fp16، بزرگ‌ترین مدلی را که در VRAM (حافظه‌ی ویدیویی) جا می‌شود تخمین بزنید

## مسئله

بیشتر درس‌های مرحله‌های 1 تا 3 روی CPU به‌خوبی اجرا می‌شوند. اما وقتی آموزش CNNs، transformers یا LLMs را شروع می‌کنید (از مرحله‌ی 4 به بعد)، به شتاب‌دهی با GPU نیاز دارید. اجرای آموزشی که روی CPU هشت ساعت طول می‌کشد، روی GPU فقط 10 دقیقه زمان می‌برد.

سه گزینه دارید: GPU محلی، cloud GPU (سرویس ابری) یا Google Colab (رایگان).

## مفهوم

```
گزینه‌های شما:

1. GPU محلی NVIDIA
   هزینه: $0 (اگر از قبل آن را دارید)
   راه‌اندازی: نصب CUDA + cuDNN
   مناسب برای: استفاده‌ی منظم، مجموعه‌داده‌های بزرگ

2. Google Colab (سطح رایگان)
   هزینه: $0
   راه‌اندازی: ندارد
   مناسب برای: آزمایش‌های سریع، وقتی در خانه GPU ندارید

3. cloud GPU (سرویس ابری) (Lambda، RunPod، Vast.ai)
   هزینه: $0.20-2.00/hr
   راه‌اندازی: SSH + نصب
   مناسب برای: آموزش جدی، مدل‌های بزرگ
```

```figure
s0-gpu-dispatch
```

## آن را بسازید

### گزینه 1: GPU محلی NVIDIA

در دسترس بودن آن را بررسی کنید:

```bash
nvidia-smi
```

PyTorch را با CUDA نصب کنید:

```python
import torch

print(f"CUDA available: {torch.cuda.is_available()}")
print(f"CUDA version: {torch.version.cuda}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
```

### گزینه 2: Google Colab

1. به [colab.research.google.com](https://colab.research.google.com) بروید
2. `Runtime > Change runtime type > T4 GPU` را انتخاب کنید
3. برای بررسی، `!nvidia-smi` را اجرا کنید

فایل‌های notebook این دوره را مستقیماً در Colab بارگذاری کنید.

### گزینه 3: GPU ابری

برای Lambda Labs، RunPod یا Vast.ai:

```bash
ssh user@your-gpu-instance

pip install torch torchvision torchaudio
python -c "import torch; print(torch.cuda.get_device_name(0))"
```

### GPU ندارید؟ مشکلی نیست.

بیشتر درس‌ها روی CPU اجرا می‌شوند. درس‌هایی که به GPU نیاز دارند، این موضوع را اعلام می‌کنند و لینک‌های Colab را هم در اختیارتان می‌گذارند.

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using: {device}")
```

## آن را بسازید: benchmark (معیارسنجی) GPU در برابر CPU

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

## تمرین‌ها

1. benchmark بالا را اجرا کنید و مدت اجرای CPU و GPU را با هم مقایسه کنید
2. اگر GPU ندارید، آن را در Google Colab اجرا و نتیجه را مقایسه کنید
3. بررسی کنید چه مقدار حافظه‌ی GPU دارید و تخمین بزنید بزرگ‌ترین مدلی که می‌توانید در آن جا دهید چقدر است (قاعده‌ی سرانگشتی: برای هر parameter در fp16، 2 bytes)

## اصطلاحات کلیدی

| اصطلاح | چیزی که مردم می‌گویند | معنای واقعی |
|------|----------------------|------|
| CUDA | «برنامه‌نویسی GPU» | پلتفرم محاسبات موازی NVIDIA که اجازه می‌دهد code را روی GPU اجرا کنید |
| VRAM | «حافظه‌ی GPU» | Video RAM روی GPU، جدا از system RAM. اندازه‌ی model را محدود می‌کند. |
| fp16 | «دقت نصف» | 16-bit floating point که با افت دقت ناچیز، نصف حافظه‌ی fp32 را مصرف می‌کند |
| Tensor Core | «سخت‌افزار سریع matrix» | هسته‌های تخصصی GPU برای ضرب ماتریسی که 4-8x سریع‌تر از هسته‌های معمولی‌اند |
