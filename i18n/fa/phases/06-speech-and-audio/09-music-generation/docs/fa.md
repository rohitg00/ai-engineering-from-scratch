# نسل موسیقی  موسیقی، صدا پایدار، سونو و زلزله مجوز

> نسل موسیقی 2026: Suno v5 و Udio v4 در تجارت غالب هستند. MusicGen، Stable Audio Open و ACE-Step منبع باز را پیش می برند. مشکل فنی عمدتاً حل شده است. مشکل حقوقی (وارنر موسیقی 500 میلیون دلاری، UMG) در سال های 2025-2026 زمینه را تغییر داد.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 4 · 10 (Diffusion Models)
**Time:** ~75 minutes

## مشکل

متن → یک کلیپ موسیقی ۳۰ ثانیه تا ۴ دقیقه ای با متن، صدا و ساختار. سه زیرمسأله:

1. **Instrumental generation.**متن مانند "لوو-فی هپ هپ دروم با کلید گرم" → صوتی. MusicGen, Stable Audio, AudioLDM.
2. **Song generation (with vocals + lyrics).**آهنگ کنترلي درباره شب هاي باراني تكساس
3. **Conditional / controllable.**یک کلیپ موجود را گسترش دهید، یک پل را بازسازی کنید، ژانر را عوض کنید، از هم جدا کنید یا رنگ کنید. رنگ گذاری + جدا کردن ستون Udio ویژگی 2026 است که مطابق است.

## مفهوم

![Music generation: token-LM vs diffusion, the 2026 model map](../assets/music-generation.svg)

### توکن LM بر روی توکن های کدک عصبی

متاس**MusicGen**(2023, MIT) و بسیاری از مشتق ها: شرط در متن / ملودی گنجانده شده، خودکشی پیش بینی EnCodec توکن (32 kHz، 4 کد کتاب) ، رمزگذاری با EnCodec. 300M - 3.3B پارام. پایه قوی؛ مبارزه بیش از 30 ثانیه.

**ACE-Step**(مواد باز، 4B XL در آوریل 2026) این را برای نسل کامل آهنگ های شیری گسترش می دهد.

### انتشار در روی ذوب یا غوطه ور

**Stable Audio (2023)**و**Stable Audio Open (2024)**: انتشار خفیه در صدا فشرده شده. در حلقه ها، طراحی صدا، بافت های محیط عالی نیست برای آهنگ های ساختاری کامل.

**AudioLDM / AudioLDM2**: از متن به صدا از طریق انتشار پنهان سبک T2I، به موسیقی، اثرات صوتی، صحبت عمومی.

### هیبرید (پیدایش)  سونو، اودیو، لیریا

وزن بسته. احتمالاً کدک AR LM + vokoder مبتنی بر انتشار با صدا / طبل / سر آهنگ تخصصی. Suno v5 (2026) رهبر کیفیت ELO 1293 است. Udio v4 اضافه می کند رنگ گذاری + جداسازی استم (باس، طبل، صداهای جداگانه دانلود).

### ارزیابی

- **FAD (Fréchet Audio Distance).**فاصله سطح ادغام بین توزیع آدی تولید شده در مقابل واقعی با استفاده از ویژگی های VGGish یا PANN. پایین تر بهتر است. MusicGen کوچک: 4.5 FAD در MusicCaps؛ SOTA ~ 3.0.
- **Musicality (subjective).**ترجیح انسان، سونو v5 ELO 1293
- **Text-audio alignment.**نمره CLAP بين prompt و output
- **Musicality artifacts.**انتقال هاي غيرمستقيم، حرکت فصلي، از دست دادن ساختار بعد از 30 ثانیه

## نقشه مدل 2026

| Model | Params | Length | Vocals | License |
|-------|--------|--------|--------|---------|
| MusicGen-large | 3.3B | 30 s | no | MIT |
| Stable Audio Open | 1.2B | 47 s | no | Stability non-commercial |
| ACE-Step XL (Apr 2026) | 4B | &gt; 2 min | yes | Apache-2.0 |
| YuE | 7B | &gt; 2 min | yes, multilingual | Apache-2.0 |
| Suno v5 (closed) | ? | 4 min | yes, ELO 1293 | commercial |
| Udio v4 (closed) | ? | 4 min | yes + stems | commercial |
| Google Lyria 3 (closed) | ? | real-time | yes | commercial |
| MiniMax Music 2.5 | ? | 4 min | yes | commercial API |

## منظره حقوقی (2025-2026)

- **Warner Music vs Suno settlement.**500 میلیون دلار. WMG اکنون نظارت بر شبیه سازی هوش مصنوعی، حقوق موسیقی و آهنگ های تولید شده توسط کاربر در Suno دارد.
- **EU AI Act**+ **California SB 942**: موسیقی تولید شده توسط هوش مصنوعی باید افشا شود.
- **Riffusion / MusicGen**در MIT هیچ بسته بندی مطابقت و همچنین هیچ صدای تجاری.

الگوهای امن برای کشتی:

1. تولید فقط ابزارک (MusicGen، Stable Audio Open، MIT/CC0 output)
2. استفاده از APIs تجاری (Suno، Udio، ElevenLabs Music) با مجوز هر نسل.
3. قطار در کتالگو مالکیت یا مجوز (زیادہ تر شرکت ها در اینجا به پایان می رسند).
4. نسل ها را با آبی نشان + متاداتا برچسب کنید.

```figure
sp-codec-tokens
```

## آن را بسازید

### مرحله اول: با MusicGen تولید کنید

```python
from audiocraft.models import MusicGen
import torchaudio

model = MusicGen.get_pretrained("facebook/musicgen-small")
model.set_generation_params(duration=10)
wav = model.generate(["upbeat synthwave with driving drums, 128 BPM"])
torchaudio.save("out.wav", wav[0].cpu(), 32000)
```

سه اندازه:`small`(300م، سریع)`medium`(1.5B)`large`(3.3 ب) کوچک برای "آیا ایده زمین است" کافی است.

### مرحله دوم: تنظیم آهنگ

```python
melody, sr = torchaudio.load("humming.wav")
wav = model.generate_with_chroma(
    ["jazz piano cover"],
    melody.squeeze(),
    sr,
)
```

موسیقی ژن-ملودی یک کرومگرام را می گیرد و در حالی که تابلو را تغییر می دهد، آهنگ را حفظ می کند. مفید برای "این ملودی را به عنوان یک کوارته رشته ای به من بدهید".

### مرحله سوم: ارزیابی FAD

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()

fad.get_fad_score("generated_folder/", "reference_folder/")
```

فاصله تعویض VGGish را محاسبه می کند. برای تست های بازپسین در سطح ژانر مفید است؛ جایگزین برای شنوندهای انسانی نیست.

### مرحله 4: اضافه کردن به جریان کار موسيقی LLM

با ایده های درس ۷-۸ ترکیب کنید:

```python
prompt = "Write a 30-second jazz loop. Describe the drums, bass, and piano voicing."
description = llm.complete(prompt)
music = musicgen.generate([description], duration=30)
```

## ازش استفاده کن

| Goal | Stack |
|------|-------|
| Instrumental sound design | Stable Audio Open |
| Game / adaptive music | Google Lyria RealTime (closed) |
| Full songs with vocals (commercial) | Suno v5 or Udio v4 with explicit license |
| Full songs with vocals (open) | ACE-Step XL or YuE |
| Short ad jingle | MusicGen melody-conditioned on a hummed reference |
| Music-video background | MusicGen + Stable Video Diffusion |

## خطرهایی که هنوز در سال 2026 وجود دارند

- **Copyright-laundering prompts.**" آهنگ به سبک تيلور سويفت "  سونو / آڊيو تجارتي اينها را در حال حاضر، مدل باز انجام نمی دهند. لیست فیلتر خود را اضافه کنید.
- **Repetition / drift past 30 s.**مدل های AR حلقه ای. چندین نسل را متقاطع کنید، یا از ACE-Step برای هماهنگی ساختاری استفاده کنید.
- **Tempo drift.**مدل ها از BPM خارج می شوند. از برچسب های BPM در پرامپ و پس از فیلتر با کتابچه استفاده کنید `beat_track`. .
- **Vocal intelligibility.**سونو عالی است؛ مدل های باز اغلب در کلمات مبهم هستند. اگر متن مهم است، از یک API تجاری یا تنظیم دقیق استفاده کنید.
- **Mono output.**مدل های باز تولید مونو یا استریو ساختگی. با بازسازی استریو مناسب ارتقا دهید (به عنوان مثال، پخش استریو کارتزیا).

## -باده

پس از`outputs/skill-music-designer.md`. انتخاب مدل، استراتژی مجوز، طول / طرح ساخت و افشا کردن متاداتا برای یک انتشار موسیقی-جن.

## تمرینات

1. **Easy.**فرار کن`code/main.py`. این یک پیشرفت آکورد "پدرنده" + الگوی طبل را به عنوان نمادهای ASCII  یک کارتون موسیقی تولید می کند. اگر می خواهید از طریق هر رندر MIDI بازی کنید.
2. **Medium.**نصب کنید`audiocraft`، کلیپ های 10 ثانیه ای را در 4 نوع از پیام های موسیقی با MusicGen کوچک تولید کنید، FAD را در برابر یک مجموعه ژانر مرجع اندازه گیری کنید.
3. **Hard.**با استفاده از ACE-Step (یا MusicGen-melody) ، سه نوع از یک آهنگ را با پیام های مختلف تولید کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| FAD | Audio FID | Fréchet distance between embedding distributions of real vs generated. |
| Chromagram | Melody as pitches | 12-dim per-frame vector; input to melody conditioning. |
| Stems | Instrument tracks | Separated bass / drums / vocals / melody as WAV. |
| Inpainting | Regen a section | Mask a time window; model regenerates just that. |
| CLAP | Text-audio CLIP | Contrastive audio-text embedding; eval text-audio alignment. |
| EnCodec | Music codec | Meta's neural codec used by MusicGen; 32 kHz, 4 codebooks. |

## خواندن بیشتر

- [Copet et al. (2023). MusicGen](https://arxiv.org/abs/2306.05284) شاخص باز باز بازگرفتگی.
- [Evans et al. (2024). Stable Audio Open](https://arxiv.org/abs/2407.14358) پیش فرض طراحی صدا
- [ACE-Step](https://github.com/ace-step/ACE-Step) ژنراتور 4B کامل آهنگ باز، آوریل 2026.
- [Suno v5 platform docs](https://suno.com) رهبر کیفیت تجاری
- [AudioLDM2](https://arxiv.org/abs/2308.05734) انتشار پنهان برای موسیقی + اثرات صوتی.
- [WMG-Suno settlement coverage](https://www.musicbusinessworldwide.com/warner-music-group-settles-with-suno-strikes-first-of-its-kind-deal-with-ai-song-generator/) نوامبر 2025 سابقه
