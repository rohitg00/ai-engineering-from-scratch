# طیف ها، مقیاس مل و ویژگی های صوتی

> شبکه های عصبی شکل های خام امواج را به خوبی مصرف نمی کنند. آنها طیف ها را مصرف می کنند. آنها طیف های Mel را حتی بهتر مصرف می کنند. هر ASR، TTS و طبقه بندی کننده صوتی در 2026 به دلیل این انتخاب پیش پردازش زنده یا مرده است.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 01 (Audio Fundamentals)
**Time:** ~45 minutes

## مشکل

يه کليپ 10 ثانيه 16 کيلو هرتز رو بگير، اين 160 هزار تا فلوت هست`[-1, 1]`، تقریباً کاملاً با برچسب "گوزیدن سگ" یا "کلمه گربه" ارتباط ندارد. شکل موج خام اطلاعات را دارد اما در یک شکل مدل نمی تواند به راحتی استخراج شود. دو فونم یکسان که 100 ms از هم صحبت می کنند نمونه های خام کاملاً متفاوتی دارند.

یک طیف نامه این را تصحیح می کند. آن جزئیات زمانی را که درک انسان آن را نادیده می گیرد (Jitter مایکرو ثانیه) فرو می برد و ساختار را که در آن درک حضور دارد (که فرکانس های انرژی هستند، در پنجره های زمانی ~ 1025 ms) حفظ می کند.

طیف های Mel به جلوتر می روند. انسان ها ارتفاع را به صورت لوگاریتماتیک درک می کنند: 100 هرتز به مقابل 200 هرتز به "مسافت فاصله" مانند 1000 هرتز به مقابل 2000 هرتز می رسد. مقیاس mel محور فرکانس را برای مطابقت با آن منحنی می کند. طیف های مقیاس mel مهمترین ویژگی در زبان ML از سال 2010 تا 2026 است.

## مفهوم

![Waveform to STFT to mel spectrogram to MFCC ladder](../assets/mel-features.svg)

**STFT (Short-Time Fourier Transform).**شکل موج را به فریم های متداخل (معمولا: پنجره 25 ms، 10 ms hop = 400 نمونه / 160 نمونه در 16 kHz) برش دهید. هر فریم را با یک تابع پنجره ضرب کنید (هن پیش فرض است؛ Hamming کمی متفاوت است). FFT هر فریم. طیف بزرگی را به یک ماتریس شکل کنید `(n_frames, n_freq_bins)`اين اسپکتروگرام توئه

**Log-magnitude.**مقادیر خام بین ۵ تا ۶ درجه از مقادیر است.`log(|X| + 1e-6)`یا`20 * log10(|X|)`هر خط تولید از اندازه ی تراشه استفاده می کند نه اندازه ی خام

**Mel scale.**فرکانس`f`در نقشه های Hz به mel`m`از طرف$m = 2595 \cdot \log_{10}(1 + f / 700)$نقشه برداری تقریبا خطی زیر 1 kHz و تقریبا لوگاریتمیک بالاتر است. 80 mel bin که 08 kHz را پوشش می دهد ورودی استاندارد ASR است.

**Mel filterbank.**مجموعه ای از فیلترهای مثلث با فاصله مساوی در مقیاس mel. هر فیلتر مجموعه ای وزن شده از سطل های FFT در کنار هم است. ضرب مقدار STFT با ماتریس filterbank طیف mel را در یک ماتمول می دهد.

**Log-mel spectrogram.** `log(mel_spec + 1e-10)`. ورودی از Whisper . ورودی از Parakeet . ورودی از SeamlessM4T . ورودی از صدا 2026

**MFCCs.**طیف سنجی Log-mel را بگیرید، یک DCT (نوع II) را اعمال کنید، 13 معادل اول را نگه دارید. ویژگی ها را غیر مرتبط می کند و بیشتر فشرده می کند. ویژگی غالب تا حدود سال 2015 زمانی است که CNNs / Transformers در Log-Mels خام را دریافت کردند. هنوز هم در تشخیص سخنرانان استفاده می شود (وکتورهای x، ECAPA).

**Resolution trade.**FFT بزرگتر = رزولوشن فرکانس بهتر اما رزولوشن زمان بدتر. 25 ms / 10 ms پیش فرض آڈیو-ML است؛ 50 ms / 12.5 ms برای موسیقی؛ 5 ms / 2 ms برای تشخیص انتقالی (درب ها، پلوسیو).

```figure
spectrogram-window
```

## آن را بسازید

### مرحله اول: شکل موج را قابل کنید

```python
def frame(signal, frame_len, hop):
    n = 1 + (len(signal) - frame_len) // hop
    return [signal[i * hop : i * hop + frame_len] for i in range(n)]
```

یک کلیپ 10 ثانیه 16 کیلو هرتز با `frame_len=400, hop=160`998 قاب می دهد.

### مرحله دوم: پنجره هان

```python
import math

def hann(N):
    return [0.5 * (1 - math.cos(2 * math.pi * n / (N - 1))) for n in range(N)]
```

قبل از FFT، بر اساس عناصر ضرب کنید. از بین می رود که از طریق کوتاه کردن در نقاط آخر غیر صفر ناشی می شود.

### مرحله سوم: شدت STFT

```python
def stft_magnitude(signal, frame_len=400, hop=160):
    win = hann(frame_len)
    frames = frame(signal, frame_len, hop)
    return [magnitudes(dft([w * s for w, s in zip(win, f)])) for f in frames]
```

استفاده در تولید`torch.stft`یا`librosa.stft`این حلقه در اینجا آموزشی است؛ روی کلیپ های کوتاه در `code/main.py`. .

### مرحله 4: فلتر بنک

```python
def hz_to_mel(f):
    return 2595.0 * math.log10(1.0 + f / 700.0)

def mel_to_hz(m):
    return 700.0 * (10 ** (m / 2595.0) - 1)

def mel_filterbank(n_mels, n_fft, sr, fmin=0, fmax=None):
    fmax = fmax or sr / 2
    mels = [hz_to_mel(fmin) + (hz_to_mel(fmax) - hz_to_mel(fmin)) * i / (n_mels + 1)
            for i in range(n_mels + 2)]
    hzs = [mel_to_hz(m) for m in mels]
    bins = [int(h * n_fft / sr) for h in hzs]
    fb = [[0.0] * (n_fft // 2 + 1) for _ in range(n_mels)]
    for m in range(n_mels):
        for k in range(bins[m], bins[m + 1]):
            fb[m][k] = (k - bins[m]) / max(1, bins[m + 1] - bins[m])
        for k in range(bins[m + 1], bins[m + 2]):
            fb[m][k] = (bins[m + 2] - k) / max(1, bins[m + 2] - bins[m + 1])
    return fb
```

80 میلیمتر که 08 kHz را پوشش می دهد`n_fft=400`بهشون میگه`(80, 201)`ماتریکس. ضرب کنید`(n_frames, 201)`اندازه STFT توسط انتقال به دست آوردن `(n_frames, 80)`طیف سنجی میله

### مرحله 5: ثبت نام

```python
def log_mel(mel_spec, eps=1e-10):
    return [[math.log(max(v, eps)) for v in frame] for frame in mel_spec]
```

گزینه های مشترک: `librosa.power_to_db`(دبای استاندارد شده مرجع)`10 * log10(power + eps)`.Whisper از یک کلیپ بیشتر درگیر + معمول معمول استفاده می کند (به Whisper's `log_mel_spectrogram`)

### مرحله 6: MFCC ها

```python
def dct_ii(x, n_coeffs):
    N = len(x)
    return [
        sum(x[n] * math.cos(math.pi * k * (2 * n + 1) / (2 * N)) for n in range(N))
        for k in range(n_coeffs)
    ]
```

DCT را به هر فریم لوق میل اعمال کنید، اولین 13 معادل را نگه دارید. این ماتریس MFCC شما است. معادل اول معمولاً کاهش می یابد (این کل انرژی را رمزگذاری می کند).

## ازش استفاده کن

دسته 2026:

| Task | Features |
|------|----------|
| ASR (Whisper, Parakeet, SeamlessM4T) | 80 log-mels, 10 ms hop, 25 ms window |
| TTS acoustic model (VITS, F5-TTS, Kokoro) | 80 mels, 5–12 ms hop for fine temporal control |
| Audio classification (AST, PANNs, BEATs) | 128 log-mels, 10 ms hop |
| Speaker embedding (ECAPA-TDNN, WavLM) | 80 log-mels or raw-waveform SSL |
| Music (MusicGen, Stable Audio 2) | EnCodec discrete tokens (not mels) |
| Keyword spotting | 40 MFCCs for tiny devices |

قانون عمومي:**if you are not working on music, start with 80 log-mels.**بار اثبات بر هر انحراف است

## خطرهایی که هنوز در سال 2026 وجود دارند

- **Mel count mismatch.**آموزش با 80 ميل، نتیجه گیری با 128 ميل، شکست خاموش، شکل ویژگی در هر دو پای ثبت
- **Sample-rate mismatch upstream.**ميل هاي محاسبه شده در 22.05 kHz از 16 kHz فرق ميکنه
- **dB vs log.**ويشپر انتظار مي رود تا "لگ ميل" باشه نه "دبيل ميل". بعضي خطوط لوله هاي HF خودآگاه مي شوند، اما کد سفارشي شما نميکنه.
- **Normalization drift.**نرمال شدن در طول آموزش، نرمال شدن جهانی در طول نتیجه گیری، خطا تولید که WER را دو برابر می کند.
- **Leakage from padding.**بسته بندی صفر پایان یک کلیپ طیف مسطح در فریم های عقب را تولید می کند.

## -باده

پس از`outputs/skill-feature-extractor.md`مهارت انتخاب ویژگی نوع، تعداد mel، فریم/ هپ و عادی سازی برای یک مدل داده شده هدف.

## تمرینات

1. **Easy.**فرار کن`code/main.py`. این یک چیرپ (فرکانس 200 → 4000 هرتز) را ترکیب می کند و آرگ ماکس mel bin را در هر فریم چاپ می کند.
2. **Medium.**دوباره با `n_mels`در`{40, 80, 128}`و`frame_len`در`{200, 400, 800}`.بعد از محور زمان، عرض باند اوج رو اندازه گیری کن کدام ترکیب بهتر حل می کنه؟
3. **Hard.**اجرا`power_to_db`و دقت ASR یک طبقه بندی کوچک CNN در AudioMNIST را با استفاده از (a) log-mel خام، (b) dB-mel با `ref=max`, (ج) MFCC-13 + دلتا + دلتا-دلتا .

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Frame | A slice | 25 ms chunk of waveform fed to one FFT. |
| Hop | Stride | Samples between consecutive frames; 10 ms is ASR default. |
| Window | Hann/Hamming thing | Point-wise multiplier that tapers the frame edges to zero. |
| STFT | Spectrogram generator | Framed + windowed FFT; yields time × frequency matrix. |
| Mel | Warped frequency | Log-perception scale; `m = 2595·log10(1 + f/700)`. |
| Filterbank | The matrix | Triangular filters that project STFT onto mel bins. |
| Log-mel | Whisper's input | `log(mel_spec + eps)`; standardized in 2026. |
| MFCC | Old-school feature | DCT of log-mel; 13 coeffs, decorrelated. |

## خواندن بیشتر

- [Davis, Mermelstein (1980). Comparison of parametric representations for monosyllabic word recognition](https://ieeexplore.ieee.org/document/1163420) مقاله MFCC
- [Stevens, Volkmann, Newman (1937). A Scale for the Measurement of the Psychological Magnitude Pitch](https://pubs.aip.org/asa/jasa/article-abstract/8/3/185/735757/) مقیاس اصلی مِل
- [OpenAI — Whisper source, log_mel_spectrogram](https://github.com/openai/whisper/blob/main/whisper/audio.py) اجرای مرجع را بخوانید.
- [librosa feature extraction docs](https://librosa.org/doc/latest/api/feature.html) اشاره به `mfcc`،`melspectrogram`، و هپ/ پنجره
- [NVIDIA NeMo — audio preprocessing](https://docs.nvidia.com/deeplearning/nemo/user-guide/docs/en/main/asr/asr_all.html#featurizers) خط لوله در مقیاس تولید برای مدل های Parakeet + Canary.
