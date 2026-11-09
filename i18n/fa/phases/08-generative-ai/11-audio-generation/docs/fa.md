# نسل صوتی

> آڈیو یک سیگنال 1-D در 16-48 kHz است. یک کلیپ پنج ثانیه 80-240k نمونه است. هیچ ترانسفورماتور به طور مستقیم به این ترتیب توجه نمی کند. راه حل برای هر مدل صوتی تولید در 2026 یکسان است: یک کدک عصبی (Encodec، SoundStream، DAC) آدیو را به توکن های متمایز در 50-75 Hz فشرده می کند و یک ترانسفورماتور یا مدل انتشار توکن ها را تولید می کند.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Audio Features), Phase 6 · 04 (ASR), Phase 8 · 06 (DDPM)
**Time:** ~45 minutes

## مشکل

سه وظیفه تولید صوتی:

1. **Text-to-speech.**متن داده شده، صحبت را تولید کنید. صحبت پاک دارای باند تنگ است و ساختار صوتی قوی دارد.
2. **Music generation.**با توجه به یک پرامپ (متن، ملودی، پیشرفت آکورد، ژانر) ، موسیقی تولید کنید. توزیع بسیار گسترده تر. MusicGen (Meta) ، Stable Audio 2.5 ، Suno v4 ، Udio ، Riffusion.
3. **Audio effects / sound design.**در صورت درخواست، صداهای محیطی یا فولی تولید کنید.

سه تا از آنها روی یک زیربنای اجرا می شوند: کدک صوتی عصبی + توکن-AR یا ژنراتور انتشار.

## مفهوم

![Audio generation: codec tokens + transformer or diffusion](../assets/audio-generation.svg)

### کدک های صوتی عصبی

Encodec (Meta, 2022), SoundStream (Google, 2021), Descript Audio Codec (DAC, 2023) . یک کدگر کنولوشن شکل امواج را به یک ویکتور در هر مرحله زمان فشرده می کند؛ مقدار گیری ویکتور باقیمانده (RVQ) هر ویکتور را به یک کاسکاد شاخص های کد بوک تبدیل می کند. کدگر آن را معکوس می کند. آدیو 24 kHz با 2 kbps با استفاده از 8 کد بوک RVQ با 75 Hz = 600 توکن / ثانیه.

```
waveform (16000 samples/sec)
    └─ encoder conv ─┐
                     ├─ RVQ layer 1 → indices at 75 Hz
                     ├─ RVQ layer 2 → indices at 75 Hz
                     ├─ ...
                     └─ RVQ layer 8
```

### دو پارادایم تولید کننده در بالا

**Token-autoregressive.**توکن های RVQ را به یک دنباله صاف کنید، یک ترانسفورماتور فقط برای کادر بازساز اجرا کنید. MusicGen از "موازم تأخیر شده" برای انتشار جریان های کد بوک K به طور موازی با تعویضات در هر جریان استفاده می کند. VALL-E توکن های سخنرانی را از یک پیامک متن + نمونه صدای 3 ثانیه تولید می کند.

**Latent diffusion.**توکن های کودک را به عنوان خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط خط

روند 2024-2026: تطابق جریان برای موسیقی (تخميل سریع تر، نمونه های تمیز تر) برنده است در حالی که token-AR هنوز بر گفتار تسلط دارد زیرا به طور طبیعی علت و جزییات خوب است.

## منظره تولید

| System | Task | Backbone | Latency |
|--------|------|----------|---------|
| ElevenLabs V3 | TTS | Token-AR + neural vocoder | ~300ms first token |
| OpenAI GPT-4o audio | Full-duplex speech | End-to-end multimodal AR | ~200ms |
| NaturalSpeech 3 | TTS | Latent flow matching | Non-streaming |
| Stable Audio 2.5 | Music / SFX | DiT + flow matching on audio latents | ~10s for 1-minute clip |
| Suno v4 | Full songs | Undisclosed; token-AR suspected | ~30s per song |
| Udio v1.5 | Full songs | Undisclosed | ~30s per song |
| MusicGen 3.3B | Music | Token-AR on Encodec 32kHz | Real-time |
| AudioCraft 2 | Music + SFX | Flow matching | ~5s for 5s clip |
| Riffusion v2 | Music | Spectrogram diffusion | ~10s |

```figure
score-matching
```

## آن را بسازید

`code/main.py`شبیه سازی ایده اصلی: آموزش یک ترانسفارمر کوچک next-token بر روی سنتتیکی "آدیو توکن" دنباله های تولید شده از دو "طریقه" متمایز (تدوبل توکن های پایین و بالا برای سبک A، رمپ یکسره برای سبک B). شرایط در سبک و نمونه.

### مرحله اول: توکن های صوتی مصنوعی

```python
def make_tokens(style, length, vocab_size, rng):
    if style == 0:  # "speech-like": alternating
        return [i % vocab_size for i in range(length)]
    # "music-like": ramp
    return [(i * 3) % vocab_size for i in range(length)]
```

### مرحله دوم: آموزش یک پیش بینی کننده کوچک

یک پیش بینی کننده سبک بیگرام که به سبک بستگی دارد. نکته این است که الگوی: توکن های کدک → آموزش های کراس انترپی → نمونه گیری خودکار.

### مرحله سوم: نمونه مشروط

با توجه به نماد سبک و نماد شروع، نماد بعدی از توزیع پیش بینی شده را انتخاب کنید. برای 20-40 نماد ادامه دهید.

## دام ها

- **Codec quality caps output quality.**اگر کدک نمی تواند صدا را به طور وفادار نشان دهد، هیچ مقدار کیفیت ژنراتور کمک نمی کند. DAC بهترین جریان باز است.
- **RVQ error accumulation.**هر لایه RVQ باقی مانده از لایه قبلی را مدل می کند. خطاهای لایه 1 گسترش می یابد. نمونه گیری با دمای 0 در لایه های بالاتر کمک می کند.
- **Musical structure.**30 ثانیه از توکن ها 20k + توکن ها در 75 هرتز است. سخت برای ترانسفورماتورها. MusicGen از پنجره سلایدی + ادامه سریع استفاده می کند؛ Stable Audio از کلیپ های کوتاه تر + کراس فید استفاده می کند.
- **Artifacts at boundaries.**تعویض بین کلیپ های تولید شده نیاز به اضافه کردن احتیاط دارد.
- **Clean-data appetite.**تولید کنندگان موسیقی به ده ها هزار ساعت موسیقی مجوز نیاز دارند. دعوی Suno / Udio RIAA (2024) این موضوع را به سطح آورد.
- **Voice cloning ethics.**یک نمونه سه ثانیه و یک پیام پیامک برای کلون کردن یک صدا کافی است. هر مدل تولید نیاز به تشخیص سوء استفاده + لیست های اختیاری دارد.

## ازش استفاده کن

| Task | 2026 stack |
|------|------------|
| Commercial TTS | ElevenLabs, OpenAI TTS, or Azure Neural |
| Voice cloning (consent-verified) | XTTS v2 (open) or ElevenLabs Pro |
| Background music, fast | Stable Audio 2.5 API, Suno, or Udio |
| Music with lyrics | Suno v4 or Udio v1.5 |
| Sound effects / Foley | AudioCraft 2, ElevenLabs SFX, or Stable Audio Open |
| Real-time voice agent | GPT-4o realtime or Gemini Live |
| Open-weights music research | MusicGen 3.3B, Stable Audio Open 1.0, AudioLDM 2 |
| Dubbing / translation | HeyGen, ElevenLabs Dubbing |

## -باده

نگه دار`outputs/skill-audio-brief.md`. مهارت یک خلاصه صوتی (کار، مدت زمان، سبک، صدا، مجوز) و خروجی را می گیرد: مدل + میزبانی، فرمت فوری (تگ های ژانر، توصیف کننده های سبک، مارکرهای ساختاری) ، کدک + ژنراتور + زنجیره vokoder، پروتکل تخم، و برنامه ارزیابی (MOS / CLAP score / CER برای TTS / کاربر A / B).

## تمرینات

1. **Easy.**فرار کن`code/main.py`و سبک را به طور صریح تنظیم کنید. ردیف های تولید شده را با الگوی سبک مطابقت دهید.
2. **Medium.**اضافه کردن رمزگذاری متوازی تاخیر شده: شبیه سازی 2 جریان از توکن ها که باید با 1 مرحله تعویض شده باشند. تمرین یک پیش بینی مشترک.
3. **Hard.**از ترانسفارمر های HuggingFace برای اجرا MusicGen-small به صورت محلی استفاده کنید. یک کلیپ 10 ثانیه ای با سه دستور مختلف تولید کنید؛ A / B برای رعایت سبک.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Codec | "Neural compression" | Encoder / decoder for audio; typical output is 50-75 Hz tokens. |
| RVQ | "Residual VQ" | Cascade of K quantizers; each models the residual of the previous. |
| Token | "One codec symbol" | Discrete index into a codebook; 1024 or 2048 typical. |
| Delayed parallel | "Offset codebooks" | Emit K token streams with staggered offsets to reduce sequence length. |
| Flow matching | "The 2024 win for audio" | Straighter-path alternative to diffusion; faster sampling. |
| Voice prompt | "3-second sample" | Speaker embedding or token prefix that steers the cloned voice. |
| Mel spectrogram | "The visual" | Log-magnitude perceptual spectrogram; used by many TTS systems. |
| Vocoder | "Mel to wave" | Neural component that converts mel spectrograms back to audio. |

## يادداشت تولیدی: صدا مشکل پخش است

آڈیو یکی از راه های خروجی است که کاربران انتظار دارند * به عنوان تولید شود * ، نه همه یکبار. در شرایط تولید این بدان معنی است که TPOT مهم است (زمان به هر نماد خروجی) زیرا سرعت گوش دادن کاربر سرعت هدف است  نه سرعت خواندن آنها. برای 16kHz آڈیو که به ~ 75 نماد / ثانیه (Encodec) نشان داده می شود ، سرور باید ≥75 نماد / ثانیه در هر کاربر تولید کند تا پخش را صاف نگه دارد.

دو پیامد معماری:

- **Flow-matching audio models cannot stream trivially.**Stable Audio 2.5 و AudioCraft 2 در یک گذر یک طول کلیپ ثابت را ارائه می دهند. برای جریان، شما کلیپ را کوچک می کنید و مرزهای همپوشانی را  فکر کنید انتشار پنجره های شیفت  اضافه کردن 100-300ms از تاخیر در مقایسه با مدل AR کدک.

اگر محصول "چات صدا زنده" یا "موسيقی در زمان واقعی" باشد، مسیر AR کدک را انتخاب کنید. اگر "در ارسال یک کلیپ 30 ثانیه ای ارائه کنید"، مطابقت جریان در کیفیت و تمام تاخیر برنده می شود.

## خواندن بیشتر

- [Défossez et al. (2022). Encodec: High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) استاندارد کدک
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) اولین کدک صوتی عصبی به طور گسترده ای استفاده می شود.
- [Kumar et al. (2023). High-Fidelity Audio Compression with Improved RVQGAN (DAC)](https://arxiv.org/abs/2306.06546) DAC
- [Wang et al. (2023). Neural Codec Language Models are Zero-Shot Text to Speech Synthesizers (VALL-E)](https://arxiv.org/abs/2301.02111) وال-ای
- [Copet et al. (2023). Simple and Controllable Music Generation (MusicGen)](https://arxiv.org/abs/2306.05284) موسیقیGen.
- [Liu et al. (2023). AudioLDM 2: Learning Holistic Audio Generation with Self-supervised Pretraining](https://arxiv.org/abs/2308.05734) آدیوایل دی ام ۲
- [Stability AI (2025). Stable Audio 2.5](https://stability.ai/news-updates/stability-ai-introduces-stable-audio-25-the-first-audio-model-built-for-enterprise-sound-production-at-scale) 2025 متن به موسیقی با تطابق جریان
