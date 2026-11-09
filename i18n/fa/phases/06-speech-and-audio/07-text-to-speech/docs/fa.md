# متن به زبان (TTS)  از تاکوترون تا F5 و کوکورو

> ASR گفتار را به متن تبدیل می کند؛ TTS متن را به گفتار تبدیل می کند. استیک 2026 سه بخش است: متن → توکن ها، توکن ها → mel، mel → شکل موج. هر بخش دارای یک مدل پیش فرض است که در یک لپ تاپ قرار می گیرد.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 09 (Seq2Seq), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## مشکل

شما یک رشته دارید: "لطفا به من یادآوری کنید که ساعت 6 بعد از ظهر گیاهان را آب دهم". شما به یک کلیپ صوتی 3 ثانیه نیاز دارید که طبیعی به نظر برسد، پروسودی درست (پاز، استرس) داشته باشد، "بات ها" را با صوتی درست تلفظ کند و در زیر 300 ms در یک CPU برای یک دستیار صدا زنده اجرا شود. شما همچنین باید صدای خود را عوض کنید، ورودی های تغییر کد را اداره کنید ("به من در ساعت 6 بعد از ظهر یادآوری کنید، daijoubu؟") و خود را در مورد نام خجالت نکشید.

خطوط لوله مدرن TTS به این شکل هستند:

1. **Text frontend.**متن (تاریخ ها، اعداد، ایمیل ها) را عادی سازی کنید، به فونم ها یا توکن های زیر کلمه تبدیل کنید، ویژگی های پروسودی را پیش بینی کنید.
2. **Acoustic model.**متن → طیف سنجی میل. تاکوترون 2 (2017), FastSpeech 2 (2020), VITS (2021), F5-TTS (2024), کوکورو (2024).
3. **Vocoder.**Mel → شکل موج. WaveNet (2016), WaveRNN, HiFi-GAN (2020), BigVGAN (2022), صداهای کدک عصبی در سال 2024+.

در سال 2026، آکوستیک + vokoder با انتشار پایان به پایان و مدل های تطابق جریان تقسیم می شود. اما مدل ذهنی سه بخش هنوز برای اشکال زدایی برقرار است.

## مفهوم

![Tacotron, FastSpeech, VITS, F5/Kokoro side-by-side](../assets/tts.svg)

**Tacotron 2 (2017).**Seq2seq: Char-embedding → BiLSTM encoder → توجه حساس به محل → autoregressive LSTM decoder می فرستد mel frames. آهسته (AR) ، تکان دهنده در متن طولانی. هنوز هم به عنوان یک خط پایه ذکر شده است.

**FastSpeech 2 (2020).**بدون خودکشی. پیش بینی کننده طول مدت تولید می کند که هر فونم چه تعداد فریم mel را دریافت می کند. 1 عبور، 10x سریع تر از تاکوترون. برخی از طبیعی بودن (مسلسل یکسره) را از دست می دهد اما در همه جا می رود.

**VITS (2021).**با هم ترن های کدر + مدّت مبتنی بر جریان + vocoder HiFi-GAN پایان به پایان با نتیجه گیری متغیر. کیفیت بالا، مدل واحد. TTS منبع باز تسلط 20222024.

**F5-TTS (2024).**ترانسفورماتور پخش بر روی تطابق جریان پروسودی طبیعی، کلون صدا صفر شوت با 5 ثانیه صدا مرجع بالا از جدول رتبه بندی TTS منبع باز 2026 335M پارام

**Kokoro (2024).**کوچک (82M) ، قابل اجرا CPU، بهترین TTS انگلیسی در کلاس برای استفاده در زمان واقعی.

**OpenAI TTS-1-HD, ElevenLabs v2.5, Google Chirp-3.**وضعیت تجاری هنر. برچسب های عاطفی ElevenLabs v2.5 ("[همسنگیده] ، "[خنده]") و صداهای شخصیت در تولید کتاب های صوتی در سال 2026 تسلط دارند.

### تکامل Vocoder

| Era | Vocoder | Latency | Quality |
|-----|---------|---------|---------|
| 2016 | WaveNet | offline only | SOTA at release |
| 2018 | WaveRNN | ~realtime | good |
| 2020 | HiFi-GAN | 100× realtime | near-human |
| 2022 | BigVGAN | 50× realtime | generalizes across speakers/langs |
| 2024 | SNAC, DAC (neural codecs) | integrated with AR models | discrete tokens, bit-efficient |

تا سال 2026 بیشتر مدل های "TTS" از متن به شکل موج پایان می یابند؛ طیف سنجی mel یک نمایش داخلی است.

### ارزیابی

- **MOS (Mean Opinion Score).**1-5 مقیاس، از طریق منابع جمعی هنوز استاندارد طلا، دردناک آهسته
- **CMOS (Comparative MOS).**ترجیح A versus B، فاصله اعتماد بیشتر در هر نوتیشن
- **UTMOS, DNSMOS.**پيش بيني هاي عصبي بدون مرجعي از MOS استفاده ميکنن
- **CER (Character Error Rate) via ASR.**از طریق Whisper TTS رو اجرا کن، CER رو با متن ورودی محاسبه کن.
- **SECS (Speaker Embedding Cosine Similarity).**کیفیت کلون صدا

شماره 2026 در آزمایش پاکسازی LibriTTS:

| Model | UTMOS | CER (via Whisper) | Size |
|-------|-------|-------------------|------|
| Ground truth | 4.08 | 1.2% | — |
| F5-TTS | 3.95 | 2.1% | 335M |
| XTTS v2 | 3.81 | 3.5% | 470M |
| VITS | 3.62 | 3.1% | 25M |
| Kokoro v0.19 | 3.87 | 1.8% | 82M |
| Parler-TTS Large | 3.76 | 2.8% | 2.3B |

```figure
sp-tts-stack
```

## آن را بسازید

### مرحله ی اول: واردات را فونمیز کنید

```python
from phonemizer import phonemize
ph = phonemize("Hello world", language="en-us", backend="espeak")
# 'həloʊ wɜːld'
```

فونم ها پل جهانی هستند. از تغذیه متن خام به چیزی که کیفیت سطح VITS پایین تر باشد اجتناب کنید.

### مرحله 2: Kokoro (2026 CPU پیش فرض) اجرا کنید

```python
from kokoro import KPipeline
tts = KPipeline(lang_code="a")  # "a" = American English
audio, sr = tts("Please remind me to water the plants at 6 pm.", voice="af_bella")
# audio: float32 tensor, sr=24000
```

غیر فعال اجرا ميشه، واحد فایل، 82 ميليون پارام

### مرحله 3: F5-TTS را با کلون صدا اجرا کنید

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="my_voice_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please remind me to water the plants.",
)
```

یک کلیپ مرجع 5 ثانیه + نقل آن را ارسال کنید. F5 پروسودی و تيمبر را کلون می کند.

### مرحله 4: Vocoder HiFi-GAN از ابتدا

خیلی بزرگ برای اینکه در یک اسکریپت آموزش قرار بگیرد، اما شکل اینه:

```python
class HiFiGAN(nn.Module):
    def __init__(self, mel_channels=80, upsample_rates=[8, 8, 2, 2]):
        super().__init__()
        # 4 upsample blocks, total 256x to go from mel-rate to audio-rate
        ...
    def forward(self, mel):
        return self.blocks(mel)  # -> waveform
```

آموزش: خصومت (تفرقهگر در پنجره های کوتاه) + از دست دادن بازسازی طیف های Mel + از دست دادن مطابقت ویژگی ها.`hifi-gan`repo یا nvidia-NeMo

### مرحله 5: خط خط خط کامل (پسیدوکوید)

```python
text = "Please remind me at 6 pm."
phones = phonemize(text)
mel = acoustic_model(phones, speaker=alice)      # [T, 80]
wav = vocoder(mel)                                # [T * 256]
soundfile.write("out.wav", wav, 24000)
```

## ازش استفاده کن

دسته 2026:

| Situation | Pick |
|-----------|------|
| Real-time English voice assistant | Kokoro (CPU) or XTTS v2 (GPU) |
| Voice cloning from 5 s reference | F5-TTS |
| Commercial character voices | ElevenLabs v2.5 |
| Audiobook narration | ElevenLabs v2.5 or XTTS v2 + fine-tune |
| Low-resource language | Train VITS on 5–20 h target-lang data |
| Expressive / emotion tags | ElevenLabs v2.5 or StyleTTS 2 fine-tune |

رهبر منبع باز از سال 2026: **F5-TTS for quality, Kokoro for efficiency**تا وقتي که تاريخ شناسي نباشي به تاکوترون دست نزن

## دام ها

- **No text normalizer.**"دکتر اسمیت" به عنوان "دکتر" یا "Drive" میخواد؟ "2026" به عنوان "بیست و بیست و شش" یا "دو صفر دو شش"؟ قبل از فونمیزر عادی سازی.
- **OOV proper nouns.**"گومار" → "گيو-ماير"؟ براي توکن هاي ناشناخته مدل گرافيم به فونيم بازپسين ارسال کن
- **Clipping.**تولید Vocoder به ندرت کلیپ می شود، اما عدم مطابقت مقیاس میلم در نتیجه می تواند بیش از ±1.0 باشد. همیشه `np.clip(wav, -1, 1)`. .
- **Sample-rate mismatch.**کوکورو 24 کیلو هرتز تولید می کند؛ لوله پایین جریان شما انتظار دارد 16 کیلو هرتز → نمونه مجدد یا نامگذاری شود.

## -باده

پس از`outputs/skill-tts-designer.md`. طراحی یک خط لوله TTS برای یک هدف خاص صدا، تاخیر و زبان.

## تمرینات

1. **Easy.**فرار کن`code/main.py`. از لغات اسباب بازی لغت تلفنی ایجاد می کند، مدت زمان هر تلفنی را تخمین می زند و یک برنامه "میل" جعلی چاپ می کند.
2. **Medium.**کوکورو رو نصب کن، و همون جمله رو با صداي هم جمع کن`af_bella`و`am_adam`.مدت صدا و کیفیت ذهنی را مقایسه کنید
3. **Hard.**يه کليپ مرجعي 5 ثانيه از خودت ضبط کن با استفاده از F5-TTS کلونش کن SECS را بين مرجع و خروجي کلونش گزارش کن

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Phoneme | Sound unit | Abstract sound class; 39 in English (ARPABet). |
| Duration predictor | How long each phoneme lasts | Non-AR model output; integer frames per phoneme. |
| Vocoder | Mel → waveform | Neural net mapping mel-spec to raw samples. |
| HiFi-GAN | Standard vocoder | GAN-based; dominant 2020–2024. |
| MOS | Subjective quality | 1–5 mean opinion score from human raters. |
| SECS | Voice-clone metric | Cosine similarity between target and output speaker embedding. |
| F5-TTS | 2024 open-source SOTA | Flow-matching diffusion; zero-shot cloning. |
| Kokoro | CPU English leader | 82M-param model, Apache 2.0. |

## خواندن بیشتر

- [Shen et al. (2017). Tacotron 2](https://arxiv.org/abs/1712.05884) خط اصلی seq2seq
- [Kim, Kong, Son (2021). VITS](https://arxiv.org/abs/2106.06103) بر اساس جریان آخر به آخر.
- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) SOTA منبع باز فعلی
- [Kong, Kim, Bae (2020). HiFi-GAN](https://arxiv.org/abs/2010.05646) vocoder که هنوز در سال 2026 ارسال می شود.
- [Kokoro-82M on HuggingFace](https://huggingface.co/hexgrad/Kokoro-82M) 2024 TTS انگلیسی سازگار با پردازنده
