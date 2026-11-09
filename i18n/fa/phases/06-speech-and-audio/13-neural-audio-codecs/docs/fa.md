# کدک های صوتی عصبی  EnCodec، SNAC، Mimi، DAC و تقسیم سیمانیک-آکوستیک

> نسل صوتی 2026 تقریباً همه توکن ها است. EnCodec، SNAC، Mimi و DAC شکل های موج مستمر را به دنباله های متمایز تبدیل می کنند که یک ترانسفورماتور می تواند پیش بینی کند. تقسیم توکن معنوی به نسبت صوتی  اولین کد بوک به عنوان معنوی، استراحت به عنوان صوتی  مهمترین تغییر معماری از زمان ترانسفورماتور برای صوتی است.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 10 · 11 (Quantization), Phase 5 · 19 (Subword Tokenization)
**Time:** ~60 minutes

## مشکل

مدل های زبان بر روی توکن های متمایز کار می کنند. آدیو مداوم است. اگر شما می خواهید یک مدل سبک LLM برای سخنرانی / موسیقی  MusicGen, Moshi, Sesame CSM, VibeVoice, Orpheus  شما ابتدا نیاز به یک **neural audio codec**: یک کدگر آموخته که صدا را به یک لغت کوچک از توکن ها تقسیم می کند و یک کدگر مطابقت پذیر که شکل موج را بازسازی می کند.

دو خانواده بوجود اومدن:

1. **Reconstruction-first codecs** EnCodec، DAC. کیفیت صوتی درک را بهینه سازی کنید. توکن ها "آکوستیک" هستند  آنها همه چیز را از جمله هویت سخنران، تابلو، صدا پس زمینه را ضبط می کنند.
2. **Semantic-first codecs** میمی (کیوتای) ، SpeechTokenizer. اولین کد بوک را برای کدگذاری محتوای زبانی / صوتی (معمولا با تزریق از WavLM) مجبور کنید. کد بوک های بعدی جزئیات صوتی هستند.

بینش سال 2024 تا 2026: **a pure reconstruction codec gives you blurry speech when you try to generate from text.**LLM بر روی توکن های کدک باید ساختار زبان و ساختار صوتی را در همان کد بوک یاد بگیرد که مقیاس ندارد. جدا کردن آنها  کد بوک معنوی 0 ، کد بوک صوتی 1-N  چیزی است که باعث می شود Moshi و Sesame CSM کار کنند.

## مفهوم

![Four codec landscape: EnCodec, DAC, SNAC (multi-scale), Mimi (semantic+acoustic)](../assets/codec-comparison.svg)

### ترفند اصلی: کوانتزیزاسیون ویکتور باقیمانده (RVQ)

به جای یک کتاب کد بزرگ (که برای کیفیت خوب به میلیون ها کد نیاز دارد) ، تمام کدک های صوتی مدرن استفاده می کنند **RVQ**: یک دسته از کتاب های کد کوچک. کتاب کد اول تولید کد را مقداری می کند؛ دوم باقیمانده را مقداری می کند؛ و غیره. هر کتاب کد 1024 کد است. 8 کتاب کد = ذخایر مؤثر لغات $1024^8 = 10^{24}$. .

در زمان نتیجه گیری، کدگر تمام کد های انتخاب شده را در هر فریم برای بازسازی جمع می کند.

### چهار کدک که در سال 2026 مهم هستند

**EnCodec (Meta, 2022).**خط پایه. کدگر-دکودر بر روی شکل موج، گوشه بطری RVQ. 24 kHz، 32 کد بوک ممکن، پیش فرض 4 کد بوک @ 1.5 kbps. استفاده `1D conv + transformer + 1D conv`معماری. از طرف MusicGen استفاده می شود.

**DAC (Descript, 2023).**RVQ با کد بوک L2 عادی شده، عملکردهای فعال سازی دوره ای، از دست دادن بهبود یافته. بالاترین وفاداری بازسازی هر کدک باز  گاهی اوقات از سخنرانی اصلی با 12 کد بوک قابل تشخیص است. 44.1 kHz باند کامل.

**SNAC (Hubert Siuzdak, 2024).**RVQ در مقیاس های متعدد، کد بوک های خشن با نرخ فریم پایین تر از کد های خوب کار می کنند. به طور موثر از نظر سلسله مراتبی، یک "سکوت" خشن در ~ 12 هرتز و جزئیات در 50 هرتز استفاده می شود. توسط Orpheus-3B استفاده می شود زیرا ساختار سلسله مراتبی به خوبی بر روی تولید مبتنی بر LM نقشه می کشد.

**Mimi (Kyutai, 2024).**بازی 2026 تغییر دهنده. 12.5 هرتز فریم ریت (خیرترین) ، 8 کد بوک @ 4.4 kbps. کد بوک 0 است **distilled from WavLM** آموزش دیده برای پیش بینی ویژگی های محتوای گفتار WavLM. کد بوک 1-7 بقایای صوتی هستند. این تقسیم قدرت Moshi (درسی 15) و سسم CSM.

### نرخ فریم برای مدل سازی زبان مهم است

سرعت فریم پایین تر = دنباله کوتاهتر = LM سریعتر

| Codec | Frame rate | 1 s = N frames | Good for |
|-------|-----------|----------------|---------|
| EnCodec-24k | 75 Hz | 75 | music, general audio |
| DAC-44.1k | 86 Hz | 86 | high-fidelity music |
| SNAC-24k (coarse) | ~12 Hz | 12 | AR-LM efficient |
| Mimi | 12.5 Hz | 12.5 | streaming speech |

در 12.5 هرتز، یک 10 ثانیه بیان فقط 125 فریم کدک است  یک ترانسفورماتور می تواند آنها را به راحتی پیش بینی کند.

### نشانه های معنوی در مقابل آکوستیک

```
frame_t → [semantic_token_t, acoustic_token_0_t, acoustic_token_1_t, ..., acoustic_token_6_t]
```

- **Semantic token (codebook 0 in Mimi).**این کد آنچه گفته شده است را رمزگذاری می کند  فونم ها، کلمات، محتوا. از طریق یک ضایعات پیش بینی کمک کننده از WavLM مستقیم شده است.
- **Acoustic tokens (codebooks 1-7).**ترمز رمزگذاری، هویت بلندگو، پروسودی، صدا پس زمینه، جزئیات خوب

یک AR LM اولین نشانه معنوی را پیش بینی می کند (به متن شرط بندی شده) ، سپس نشانه های صوتی را پیش بینی می کند (به معنای معنوی + مرجع سخنران). این فاکتورسازی دلیل این است که TTS مدرن می تواند صداهای کلون صفر را انجام دهد: مدل معنوی محتوا را اداره می کند؛ مدل صوتی تابل را اداره می کند.

### 2026 کیفیت بازسازی (بیت ها در ثانیه، سرعت بیت پایین تر بهتر است)

| Codec | Bitrate | PESQ | ViSQOL |
|-------|---------|------|--------|
| Opus-20kbps | 20 kbps | 4.0 | 4.3 |
| EnCodec-6kbps | 6 kbps | 3.2 | 3.8 |
| DAC-6kbps | 6 kbps | 3.5 | 4.0 |
| SNAC-3kbps | 3 kbps | 3.3 | 3.8 |
| Mimi-4.4kbps | 4.4 kbps | 3.1 | 3.7 |

کدک های سنتی مثل Opus هنوز هم در کیفیت درک به طور قطعی برنده می شوند. کدک های عصبی به طور قطعی برنده می شوند.**discrete tokens**(که Opus تولید نمی کند) و**generative-model quality**(چه کاری می تواند با این توکن ها انجام دهد).

```figure
rvq-codec-cascade
```

## آن را بسازید

### مرحله اول: با EnCodec کدگذاری کنید

```python
from encodec import EncodecModel
import torch

model = EncodecModel.encodec_model_24khz()
model.set_target_bandwidth(6.0)  # kbps

wav = torch.randn(1, 1, 24000)
with torch.no_grad():
    encoded = model.encode(wav)
codes, scale = encoded[0]
# codes: (1, n_codebooks, n_frames), dtype=int64
```

`n_codebooks=8`هر کد 0-1023 (10 بایت) است.

### مرحله دوم: رمزگذاری و اندازه گیری بازسازی

```python
with torch.no_grad():
    wav_recon = model.decode([(codes, scale)])

from torchaudio.functional import compute_deltas
import torch.nn.functional as F

mse = F.mse_loss(wav_recon[:, :, :wav.shape[-1]], wav).item()
```

### مرحله 3: تقسیم معنوی-آکوستیک (به سبک میمی)

```python
from moshi.models import loaders
mimi = loaders.get_mimi()

with torch.no_grad():
    codes = mimi.encode(wav)  # shape (1, 8, frames@12.5Hz)

semantic = codes[:, 0]
acoustic = codes[:, 1:]
```

کد بوک معنوی 0 با WavLM هماهنگ است. شما می توانید یک ترانسفارمر متن به معنوی آموزش دهید  لغت بسیار کوچکتر از رفتن مستقیم به صوتی. سپس یک حالت جداگانه از شکل صوتی به شکل موج در یک مرجع سخنران.

### مرحله 4: چرا AR LM بر روی توکن های کدک کار می کند

براي كليپ 10 ثانيه در كد كتابي 12.5 هرتز × 8 ميامي:

```math
N_{\text{tokens}} = 10 \times 12.5 \times 8 = 1000 \text{ tokens}
```

1000 توکن یک زمینه معمولی برای یک ترانسفورمتر است. ترانسفورمتر 256M می تواند 10 ثانیه سخنرانی را در میلی ثانیه در یک GPU مدرن تولید کند.

## ازش استفاده کن

مشکل نقشه → کدک:

| Task | Codec |
|------|-------|
| General music generation | EnCodec-24k |
| Highest-fidelity reconstruction | DAC-44.1k |
| AR LM over speech (TTS) | SNAC or Mimi |
| Streaming full-duplex speech | Mimi (12.5 Hz) |
| Sound-effect library with text | EnCodec + T5 condition |
| Fine-grained audio editing | DAC + inpainting |

قانون عمومي:**if you're building a generative model, start with Mimi or SNAC. If you're building a compression pipeline, use Opus.**

## دام ها

- **Too many codebooks.**اضافه کردن کتاب های کد صداقت را خطی افزایش می دهد اما طول ردیف LM نیز خطی.
- **Frame-rate mismatch.**آموزش LM در 12.5 هرتز میمی سپس تنظیم دقیق در 50 هرتز EnCodec خاموش شکست می خورد.
- **Assuming all codebooks equal.**در میمی، کد بوک 0 محتوای خود را دارد؛ از دست دادن آن درک پذیری را نابود می کند. از دست دادن کد بوک 7 به سختی قابل توجه است.
- **Using reconstruction quality as the only metric.**یک کدک می تواند بازسازی عالی داشته باشد اما برای نسل مبتنی بر LM بی فایده باشد اگر ساختار معنوی بد باشد.

## -باده

پس از`outputs/skill-codec-picker.md`.کدک براي يک کار توليدي يا فشرده سازي خاص انتخاب کنيد

## تمرینات

1. **Easy.**فرار کن`code/main.py`. این یک کوائنتایزر اسکالری + باقی مانده بازی را اجرا می کند و در هنگام اضافه کردن کتاب های کد، خطای بازسازی را اندازه گیری می کند.
2. **Medium.**نصب کنید`encodec`و مقایسه کتاب های کد 1، 4، 8، 32 در یک کلیپ سخنرانی طولانی.
3. **Hard.**ممی را بارگذاری کنید. کلیپ را رمزگذاری کنید. کد بوک 0 را با اعداد کامل تصادفی جایگزین کنید؛ کد بوک 7 را همچنین جایگزین کنید. دو فساد را مقایسه کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| RVQ | Residual quantization | Cascade of small codebooks; each quantizes the previous residual. |
| Frame rate | Codec speed | How many token-frames per second. Lower = faster LM. |
| Semantic codebook | Codebook 0 (Mimi) | Codebook distilled from SSL features; encodes content. |
| Acoustic codebooks | Everything else | Timbre, prosody, noise, fine detail. |
| PESQ / ViSQOL | Perceptual quality | Objective metrics correlating with MOS. |
| EnCodec | Meta codec | The RVQ baseline; used by MusicGen. |
| Mimi | Kyutai codec | 12.5 Hz frame rate; semantic-acoustic split; powers Moshi. |

## خواندن بیشتر

- [Défossez et al. (2023). EnCodec](https://arxiv.org/abs/2210.13438) خط اصلی RVQ
- [Kumar et al. (2023). Descript Audio Codec (DAC)](https://arxiv.org/abs/2306.06546) با بالاترين وفاداري باز
- [Siuzdak (2024). SNAC](https://arxiv.org/abs/2410.14411) RVQ چند مقیاس
- [Kyutai (2024). Mimi codec](https://kyutai.org/codec-explainer) تقسیم معنوی-آکوستیک، لوله سازی WavLM
- [Borsos et al. (2023). AudioLM](https://arxiv.org/abs/2209.03143) پارادایم دو مرحله ای معنوی / صدا
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) کدک اصلی پخش شده RVQ
