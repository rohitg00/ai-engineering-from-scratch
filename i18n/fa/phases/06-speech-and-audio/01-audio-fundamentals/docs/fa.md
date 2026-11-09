# اصول صوتی  شکل موج، نمونه گیری، فرورترسفورم

> شکل موج ها سیگنال خام هستند. طیف ها نمایش هستند. ویژگی های Mel شکل دوستانه ML هستند. هر لوله ASR و TTS مدرن از این پله عبور می کند و اولین مرحله درک نمونه گیری و فوریئر است.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1 · 06 (Vectors & Matrices), Phase 1 · 14 (Probability Distributions)
**Time:** ~45 minutes

## مشکل

یک میکروفون سیگنال فشار به زمان تولید می کند. شبکه عصبی شما تنسورها را مصرف می کند. بین آنها یک دسته از کنوانسیون ها قرار دارد که هنگامی که نقض می شود، اشکال خاموش را تولید می کند: مدل به خوبی حرکت می کند اما WER دو برابر می شود، یا TTS یک سوت می فرستد، یا سیستم کلون صدا میکروفون را به جای بلندگو به یاد می آورد.

هر خطا در سیستم های گفتاری به یکی از سه سوال برمی گردد:

1. داده های ثبت شده در چه نرخ نمونه ای بوده و مدل چه انتظاراتی را دارد؟
2. سیگنال نام مستعار داره؟
3. شما روی نمونه های خام کار می کنید یا روی نمایش فرکانس؟

اينها رو درست انجام بده و بقيه مرحله 6 قابل کنترل باشه اشتباهشون رو درست انجام بده و حتي Whisper-Large-v4 هم زباله مي کنه

## مفهوم

![Waveform, sampling, DFT, and frequency bins visualized](../assets/audio-fundamentals.svg)

**Waveform.**يه دسته ي يک بعدی از شناورها در`[-1.0, 1.0]`برای تبدیل به ثانیه ها، به سرعت نمونه تقسیم کنید:`t = n / sr`. یک کلیپ 10 ثانیه با 16 کیلوهرتز یک سری از 160 هزار فلوت است

**Sampling rate (sr).**چند نمونه در ثانیه. نرخ های مشترک در سال 2026:

| Rate | Use |
|------|-----|
| 8 kHz | Telephony, legacy VOIP. Nyquist at 4 kHz kills consonants. Avoid for ASR. |
| 16 kHz | ASR standard. Whisper, Parakeet, SeamlessM4T v2 all consume 16 kHz. |
| 22.05 kHz | TTS vocoder training for older models. |
| 24 kHz | Modern TTS (Kokoro, F5-TTS, xTTS v2). |
| 44.1 kHz | CD audio, music. |
| 48 kHz | Film, pro audio, high-fidelity TTS (VALL-E 2, NaturalSpeech 3). |

**Nyquist-Shannon.**نرخ نمونه ای از`sr`می تواند به طور واضح فرکانس ها را تا `sr/2`.`sr/2`مرز فرکانس نیکیست است. انرژی بالای نیکیست * نامگذاری شده *  به فرکانس های پایین تر خم می شود و سیگنال را خراب می کند. همیشه قبل از نمونه گیری پایین فیلتر کم عبور کنید.

**Bit depth.**16-bit PCM (به عنوان int16، محدوده ±32,767) است که فرمت تبادل جهانی است. 24-bit برای موسیقی، 32-bit شناور برای DSP داخلی. کتابخانه هایی مانند `soundfile`int16 رو بخونيد ولي در `[-1, 1]`. .

**Fourier Transform.**هر سیگنال محدود، مجموعه ای از سینوسایدها در فرکانس های مختلف است.`N`نمونه ها`N`معادلات پیچیده  یک برای هر سطل فرکانس. `bin k`نقشه ها به فرکانس`k · sr / N`هرتز. بزرگي در اين فرکانس، زاويه در مرحله است.

**FFT.**فرور سریع ترانسفورم:`O(N log N)`الگوریتم DFT وقتی`N`هر کتابخانه صوتی از FFT زیر کاپ استفاده می کند. یک FFT نمونه 1024 در 16 kHz 512 سطل فرکانس قابل استفاده را در عرض 08 kHz در رزولوشن 15.6 Hz فراهم می کند.

**Framing + window.**ما یک کلپ را FFT نمی کنیم. ما آن را به *frames* (معمولا 25 ms با 10 ms hop) بر روی همپوش می کنیم، هر فریم را با یک تابع پنجره (هان، هامینگ) برای از بین بردن قطعیت های کناری، سپس هر فریم را FFT می کنیم. این است که Short-Time Fourier Transform (STFT). درس 02 از اینجا شروع می شود.

```figure
mel-scale
```

## آن را بسازید

### مرحله اول: یک کلیپ را بخوانید و شکل موج را نقشه برداری کنید

`code/main.py`فقط از stdlib استفاده ميکنه`wave`ماژول برای نگه داشتن انحصار آزاد در نمایش. برای تولید شما می توانید استفاده کنید `soundfile`یا`torchaudio.load`(هر دو برگشت`(waveform, sr)`دوتا:

```python
import soundfile as sf
waveform, sr = sf.read("clip.wav", dtype="float32")  # shape (T,), sr=int
```

### مرحله دوم: یک موج سینوس را از اصول اول ترکیب کنید

```python
import math

def sine(freq_hz, sr, seconds, amp=0.5):
    n = int(sr * seconds)
    return [amp * math.sin(2 * math.pi * freq_hz * i / sr) for i in range(n)]
```

یک سینوس 440 هرتز (کنسرت A) در 16 کیلو هرتز برای یک ثانیه 16000 شناور است.`wave.open(..., "wb")`با استفاده از کدگذاری 16 بایت PCM.

### مرحله 3: محاسبه DFT به صورت دستی

```python
def dft(x):
    N = len(x)
    out = []
    for k in range(N):
        re = sum(x[n] * math.cos(-2 * math.pi * k * n / N) for n in range(N))
        im = sum(x[n] * math.sin(-2 * math.pi * k * n / N) for n in range(N))
        out.append((re, im))
    return out
```

`O(N²)` خوب براي `N=256`براي تایید درستي، براي صداي واقعي بي فایده`numpy.fft.rfft`یا`torch.fft.rfft`. .

### مرحله 4: تعدد غالب را پیدا کنید

شاخص اوج بُعد`k_star`نقشه ها به فرکانس`k_star * sr / N`. اينو با 440 هرتز سينوس اجرا مي کنيم بايد اوج رو به بين برگردونيم`440 * N / sr`. .

### مرحله 5: نشان دادن نامگذاری

نمونه ای از 7 kHz سینوس در 10 kHz (نیکویست = 5 kHz)`10 − 7 = 3 kHz`. اوج FFT در 3 kHz ظاهر می شود. این نام استعاره کلاسیک است و دلیل اینکه هر DAC / ADC با یک فلتر کم عبور دیوار خمیر می فرستد.

## ازش استفاده کن

اون دسته اي که در سال 2026 به دنيا مي فرستيد:

| Task | Library | Why |
|------|---------|-----|
| Read/write WAV/FLAC/OGG | `soundfile` (libsndfile wrapper) | Fastest, stable, returns float32. |
| Resample | `torchaudio.transforms.Resample` or `librosa.resample` | Correct anti-aliasing built in. |
| STFT / Mel | `torchaudio` or `librosa` | GPU-friendly; PyTorch ecosystem. |
| Real-time streaming | `sounddevice` or `pyaudio` | Cross-platform PortAudio bindings. |
| Inspect a file | `ffprobe` or `soxi` | CLI, fast, reports sr/channels/codec. |

قانون تصمیم گیری: **match sample rate before you match anything else**.سسپر انتظار داره 16 kHz mono float32 باشه. 44.1 kHz استریو بده و شما زباله هایی رو پیدا میکنی که شبیه یک مدل بگ هستن

## -باده

پس از`outputs/skill-audio-loader.md`این مهارت به شما کمک می کند تا بررسی کنید که ورودی صوتی با انتظارات مدل زیر جریان مطابقت دارد و در صورتی که اینگونه نباشد، نمونه های درست را تکرار کنید.

## تمرینات

1. **Easy.**ترکیب یک ترکیب یک ثانیه از 220 هرتز + 440 هرتز + 880 هرتز در 16 کلو هرتز. DFT اجرا کنید. سه نقطه اوج در سطل انتظار می رود را تایید کنید.
2. **Medium.**3 ثانیه WAV صداي خودتو در 48 kHz ضبط کنين`torchaudio.transforms.Resample`(با ضد جبران) ، سپس به 16 kHz با استفاده از اعشاریه ساده (هر سوم نمونه) FFT هر دو. جبران نام کجا ظاهر می شود؟
3. **Hard.**از نو ساخت STFT با استفاده از فقط `math`و DFT از مرحله 3. اندازه قاب 400، hop 160, پنجره Hann.`matplotlib.pyplot.imshow`اين اسپکتروگرام درس 2ه

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Sample rate | How many samples per second | Frequency in Hz at which the ADC measures the signal. |
| Nyquist | The max frequency you can represent | `sr/2`; energy above it aliases back down. |
| Bit depth | Resolution of each sample | `int16` = 65,536 levels; `float32` = 24-bit precision in `[-1, 1]`. |
| DFT | The Fourier transform for sequences | `N` samples → `N` complex frequency coefficients. |
| FFT | The fast DFT | `O(N log N)` algorithm requiring `N` = power of 2. |
| Bin | Frequency column | `k · sr / N` Hz; resolution = `sr / N`. |
| STFT | Spectrogram under the hood | Framed + windowed FFT over time. |
| Aliasing | Weird frequency ghosts | Energy above Nyquist mirroring down to lower bins. |

## خواندن بیشتر

- [Shannon (1949). Communication in the Presence of Noise](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf) مقاله پشت نظریه نمونه گیری
- [Smith — The Scientist and Engineer's Guide to Digital Signal Processing](https://www.dspguide.com/ch8.htm) کتاب درسی رایگان و قانونی در DSP
- [librosa docs — audio primer](https://librosa.org/doc/latest/auto_tutorials/index.html) راه رفتن عملی با کد
- [Heinrich Kuttruff — Room Acoustics (6th ed.)](https://www.taylorfrancis.com/books/mono/10.1201/9781315372150/room-acoustics-heinrich-kuttruff) اشاره به اینکه چرا صدا در دنیای واقعی یک سینوساید تمیز نیست.
- [Steve Eddins — FFT Interpretation notebook](https://blogs.mathworks.com/steve/2020/03/30/fft-spectrum-and-spectral-densities/) حس باين فرکانس در 10 دقيقه پاک شد
