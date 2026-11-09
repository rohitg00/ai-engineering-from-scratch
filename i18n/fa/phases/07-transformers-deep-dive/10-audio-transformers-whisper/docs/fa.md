# ترانسفورماتور های صوتی  معماری همس

> صداي يک تصويري از ترديد در طول زمان است و همسنگي يک وي تي است که طیف هاي ميل را مي خورد و به شما پاسخ مي دهد

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 08 (Encoder-Decoder), Phase 7 · 09 (ViT)
**Time:** ~45 minutes

## مشکل

قبل از Whisper (OpenAI، Radford و همکاران 2022) ، تشخیص خودکار صدا (ASR) پیشرفته به معنی wav2vec 2.0 و HuBERT  استخراج کننده های ویژگی خود نظارت شده به علاوه یک سر دقیق. لوله های داده با کیفیت بالا و گران قیمت، دامنه شکننده. تشخیص صدا چند زبانی به مدل های جداگانه برای هر خانواده زبان نیاز داشت.

ويشپر سه تا شرط گذاشت:

1. **Train on everything.**680,000 ساعت صداي با برچسب ضعيف از اينترنت در 97 زبان حذف شده بدون ادغام دانشگاهي پاک و بدون برچسب صوتي
2. **Multi-task single model.**یک دیکودر به طور مشترک در نقل، ترجمه، تشخیص فعالیت صوتی، شناسه زبان و زمانبندی از طریق توکن های کار آموزش دیده است.
3. **Standard encoder-decoder transformer.**کدگر طیف های نوار می کند. کدگر توکن های متن را به صورت خودکار تولید می کند. بدون vocoder، بدون CTC، بدون HMM.

نتیجه: Whisper large-v3 در میان تلفظ ها، صدا و زبان هایی که دارای داده های صفر پاک است، قوی است. این پیش فرض خطاطی است برای هر دستیار صوتی منبع باز و بیشتر موارد تجاری در سال 2026.

## مفهوم

![Whisper pipeline: audio → mel → encoder → decoder → text](../assets/whisper.svg)

### مرحله 1  نمونه مجدد + پنجره

صدا در 16 kHz. کلیپ / پد تا 30 ثانیه. طیف سنجی لاگ میل را محاسبه کنید: 80 mel bin، 10 ms قدم → ~ 3000 فریم × 80 ویژگی. این "تصاویر ورودی" است که Whisper می بیند.

### مرحله 2  ستون خمینی

دو لایه Conv1D با هسته 3 و مرحله 2 3000 فریم را به 1500 کاهش می دهد. طول دنباله را بدون اضافه کردن پارامترهای زیادی نصف می کند.

### مرحله 3  کدگر

یک کدگر ترانسفورماتور 24 لایه (برای بزرگ) بیش از 1500 مرحله زمانی. کدگذاری موقعیت سینوسوائید، خود توجه، GELU FFN. تولید می کند 1,500 × 1,280 حالت پنهان.

### مرحله 4  decoder

یک دیکوتر ترانسفارمر ۲۴ لایه است. این به صورت خودکار از یک لغت BPE که یک سوپر مجموعه از GPT-2 با چند توکن خاص صوتی است، توکن ها را تولید می کند.

### مرحله 5  توکن های وظیفه

دستور کار دیکودر با توکن های کنترل شروع می شود که به مدل می گویند چه کاری باید انجام دهد:

```
<|startoftranscript|>  <|en|>  <|transcribe|>  <|0.00|>
```

یا

```
<|startoftranscript|>  <|fr|>  <|translate|>   <|0.00|>
```

مدل رو بر اساس این کنوانسیون آموزش داده بود. شما با پیشگویی کنترل وظیفه می کنید. معادل 2026 از تنظیم دستورالعمل، اما برای گفتار اعمال می شود.

### مرحله 6  output

جستجوی شعاع (بایت 5) با یک حد لقب-سپرود.`<|notimestamps|>`توکن از دست رفته

### اندازه های همس

| Model | Params | Layers | d_model | Heads | VRAM (fp16) |
|-------|--------|--------|---------|-------|-------------|
| Tiny | 39M | 4 | 384 | 6 | ~1 GB |
| Base | 74M | 6 | 512 | 8 | ~1 GB |
| Small | 244M | 12 | 768 | 12 | ~2 GB |
| Medium | 769M | 24 | 1024 | 16 | ~5 GB |
| Large | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3 | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3-turbo | 809M | 32 | 1280 | 20 | ~6 GB (4-layer decoder) |

در سال 2024, Whisper-turbo به طور پیش فرض برای نمایندگان صدا در زمان واقعی در سال 2026 است.

### چه کاري که "سسسپر" انجام نميده

- بدون روزنامه سازی (که حرف می زند) ، برای این کار با پیانوت جفت کنید.
- هیچ پخش در زمان واقعی به صورت بومی  پنجره 30 ثانیه ثابت نیست.`faster-whisper`،`WhisperX`) برقی در جریان از طریق VAD + همپوشانی.
- بدون قالب طولانی بیش از 30 ثانیه بدون شکستن خارجی. در عمل به خوبی کار می کند زیرا صحبت های انسانی به ندرت به زمینه های طولانی مدت برای نقل نیاز دارند.

### 2026 منظره

| Task | Model | Notes |
|------|-------|-------|
| English ASR | Whisper-turbo, Moonshine | Moonshine is 4× faster on edge |
| Multilingual ASR | Whisper-large-v3 | 97 languages |
| Streaming ASR | faster-whisper + VAD | 150 ms latency targets achievable |
| TTS | Piper, XTTS-v2, Kokoro | Encoder-decoder pattern, but Whisper-shaped |
| Audio + language | AudioLM, SeamlessM4T | Text tokens + audio tokens in one transformer |

```figure
n5-mel-decode
```

## آن را بسازید

ببین`code/main.py`ما Whisper را آموزش نداریم، ما لوله ی طیف نامه ی Log-mail + قالب دهنده ی پیامک های تکنیک را می سازیم. این قطعاتی هستند که در تولید به آنها دست می دهید.

### مرحله اول: ترکیب صدا

یک موج سینوس یک ثانیه در 440 هرتز تولید کنید نمونه 16 کیلو هرتز 16000 نمونه

### مرحله دوم: طیف سنجی log-mel (تضعیف شده)

طیف کامل میلم نیاز به FFT. ما یک فریم ساده + هر فریم انرژی نسخه را انجام می دهیم که بدون نیاز به پیپ لاین را نشان می دهد`librosa`:

```python
def frame_signal(x, frame_size=400, hop=160):
    frames = []
    for start in range(0, len(x) - frame_size + 1, hop):
        frames.append(x[start:start + frame_size])
    return frames
```

فدراسیون = 25 ms، hop = 10 ms. با پنجره Whisper مطابقت دارد. انرژی هر فدراسیون جایگزین میله های آموزشی است.

### مرحله 3: تا 30 ثانیه

ویسپر همیشه 30 ثانیه قطعات را پردازش می کند.

### مرحله 4: ایجاد توکن های فوری

```python
def whisper_prompt(lang="en", task="transcribe", timestamps=True):
    tokens = ["<|startoftranscript|>", f"<|{lang}|>", f"<|{task}|>"]
    if not timestamps:
        tokens.append("<|notimestamps|>")
    return tokens
```

این کل سطح کنترل کار است. یک پیشگویی 4 توکن.

## ازش استفاده کن

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("meeting.wav", language="en", task="transcribe")
print(result["text"])
print(result["segments"][0]["start"], result["segments"][0]["end"])
```

سریعتر، سازگار با OpenAI:

```python
from faster_whisper import WhisperModel
model = WhisperModel("large-v3-turbo", compute_type="int8_float16")
segments, info = model.transcribe("meeting.wav", vad_filter=True)
for s in segments:
    print(f"{s.start:.2f} - {s.end:.2f}: {s.text}")
```

**When to pick Whisper in 2026:**

- ASR چند زبانی با یک مدل
- نقل قوي از صداي هاي شور و متنوع
- تحقیق / نمونه اولیه ASR  سریع ترین نقطه شروع

**When to pick something else:**

- پخش دیرینتی فوق العاده پایین در کناری Moonshine Whisper را با کیفیت مشابه می پرشد.
- هوش مصنوعی مکالمه ای در زمان واقعی که نیاز به <200 ms  اختصاصی جریان ASR دارد.
- ژورنالیزاسیون سخنران  همس نمی کند این کار را انجام دهد؛ بولت روی پیانوت.

## -باده

ببین`outputs/skill-asr-configurator.md`مهارت انتخاب یک مدل ASR، پارامترهای رمزگذاری و پیش پردازش برای یک برنامه جدید صحبت می کند.

## تمرینات

1. **Easy.**فرار کن`code/main.py`. تعداد فریم ها را برای سیگنال یک ثانیه ای در 16 kHz با 10 ms hop تایید کنید ~ 100 فریم است. برای 30 ثانیه: ~ 3000 فریم.
2. **Medium.**از طریق استفاده از `numpy.fft`. بررسي 80 ميله با هم مطابقت داشته باشه`librosa.feature.melspectrogram(n_mels=80)`در خطای عددی
3. **Hard.**نتیجه گیری جریان را پیاده سازی کنید: بخش صوتی به پنجره های 10 ثانیه با 2 ثانیه تعویض، Whisper را در هر بخش اجرا کنید، نقل نامه ها را ترکیب کنید. نرخ خطای کلمه را در مقایسه با یک گذرگاه یکبار در یک نمونه پادکست 5 دقیقه اندازه گیری کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mel spectrogram | "Audio image" | 2D representation: frequency bins on one axis, time frames on the other; log-scaled energy per cell. |
| Log-mel | "What Whisper sees" | Mel spectrogram passed through log; approximates human perception of loudness. |
| Frame | "One time slice" | A 25 ms window of samples; overlapping at 10 ms stride. |
| Task token | "Prompt prefix for speech" | Special tokens like `<\|transcribe\|>` / `<\|translate\|>` in the decoder prompt. |
| Voice activity detection (VAD) | "Find the speech" | Gate that removes silence before ASR; cuts cost massively. |
| CTC | "Connectionist Temporal Classification" | Classic ASR loss for alignment-free training; Whisper does NOT use it. |
| Whisper-turbo | "Small decoder, full encoder" | large-v3 encoder + 4-layer decoder; 8× faster decoding. |
| Faster-whisper | "The production wrapper" | CTranslate2 reimplementation; int8 quantization; 4× faster than OpenAI's reference. |

## خواندن بیشتر

- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) کاغذ همس
- [OpenAI Whisper repo](https://github.com/openai/whisper) کد مرجع + وزن مدل.`whisper/model.py`برای دیدن ستون Conv1D + کدگر + کدگر از بالا تا پایین در حدود 400 خط.
- [OpenAI Whisper — `whisper/decoding.py`](https://github.com/openai/whisper/blob/main/whisper/decoding.py) منطق جستجوی شعاع + نشانه کار در مراحل 56 در اینجا توضیح داده شده است؛ 500 خط، کاملا قابل خواندن است.
- [Baevski et al. (2020). wav2vec 2.0: A Framework for Self-Supervised Learning of Speech Representations](https://arxiv.org/abs/2006.11477) پیشگام؛ هنوز ویژگی های SOTA در برخی تنظیمات.
- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) بسته بندی تولید، 4x سریعتر از مرجع.
- [Jia et al. (2024). Moonshine: Speech Recognition for Live Transcription and Voice Commands](https://arxiv.org/abs/2410.15608) 2024 ASR دوستانه حاشیه، شکل همسری اما کوچکتر.
- [HuggingFace blog — "Fine-Tune Whisper For Multilingual ASR with 🤗 Transformers"](https://huggingface.co/blog/fine-tune-whisper) دستورالعملی دقیق تر از جمله فرایندهای طیف های Mel و مدیریت نشان زمان.
- [HuggingFace `modeling_whisper.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/whisper/modeling_whisper.py) پیاده سازی کامل (کودر، decoder، توجه متقابل، تولید) که منعکس نمودار معماری درس است.
