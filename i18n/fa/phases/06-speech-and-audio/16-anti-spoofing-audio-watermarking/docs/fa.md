# صدای ضد جعلی و آڈیو آبیاری  ASVspoof 5, AudioSeal, WaveVerify

> کلون صدا سریعتر از دفاعی ارسال می شود. سیستم های صدا تولید 2026 به دو چیز نیاز دارند: یک آشکارساز (AASIST، RawNet2) که گفتار واقعی و جعلی را طبقه بندی می کند و یک آبی نشان (AudioSeal) که از فشرده سازی و ویرایش زنده می ماند. هر دو یا کلون صدا را ارسال نکنید.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 08 (Voice Cloning)
**Time:** ~75 minutes

## مشکل

سه دفاع مرتبط:

1. **Anti-spoofing / deepfake detection.**به نظر می رسد که یک کلیپ صوتی، مصنوعی است یا واقعی؟ معیار ASVspoof (ASVspoof 2019 → 2021 → 5) استاندارد طلا است.
2. **Audio watermarking.**یک سیگنال غیر قابل تشخیص را در صدا تولید کنید که یک آشکارگر بعداً می تواند استخراج کند. AudioSeal (Meta) و WavMark گزینه های باز هستند.
3. **Authenticated provenance.**امضای رمزنگاری فایل های صوتی + متاداتا. C2PA / ابتکار مصداقیت محتوا.

تشخیص با مخالفانی که همکاری نمی کنند کار می کند. آبنشان سازی با رعایت قوانین عمل می کند. آدی تولید شده توسط هوش مصنوعی باید به عنوان چنین شناسایی شود. هر دو مورد در سال 2026 مورد نیاز است.

## مفهوم

![Anti-spoofing vs watermarking vs provenance — three defense layers](../assets/spoofing-watermark.svg)

### ASVspoof 5  معیار 2024-2025

بزرگترين تغيير از نسخه هاي قبل:

- **Crowdsourced data**(ستوديو پاک نيست)  شرایط واقعي
- **~2000 speakers**(با 100 تا قبل)
- **32 attack algorithms.**TTS + تبدیل صدا + اختلال در مقابل
- **Two tracks.**اقدامات ضد (CM) تشخیص مستقل؛ ASV (SASV) برای سیستم های بیومتریک.

حالت پیشرفته در ASVspoof 5: ~ 7.23٪ EER. در ASVspoof قدیمی تر 2019 LA: 0.42% EER. انتشار دنیای واقعی: انتظار 5-10٪ EER در کلیپ های وحشی.

### خانواده های مدل های تشخیص AASIST و RawNet2 

**AASIST**(2021، به روز شده تا 2026). توجه گرافیک به ویژگی های طیف. SOTA فعلی در مورد ASVspoof 5 وظیفه مقابله.

**RawNet2.**کنولوشن جلو در شکل موج خام + نخاع TDNN. پایه ساده تر؛ هنوز هم با تنظیم دقیق رقابتی است.

**NeXt-TDNN + SSL features.**نسخه 2025: ECAPA-style + WavLM ویژگی های + از دست دادن فوکال. به دست می آورد 0.42% EER در ASVspoof 2019 LA.

### AudioSeal  نماد آب 2024

متاس**AudioSeal**(جنوری 2024, v0.2 دسامبر 2024) طرح اصلی:

- **Localized.**شناسایی آبی نشان در هر فریم در 16 kHz رزولوشن نمونه (1/16000s).
- **Generator + detector jointly trained.**ژنراتور یاد می گیرد که سیگنال غیر قابل شنوایی را در خود قرار دهد؛ آشکارگر یاد می گیرد که از طریق افزایش آن آن را پیدا کند.
- **Robust.**فشرده سازی MP3 / AAC، EQ، تغییر سرعت ±10٪، مخلوط شور +10 dB SNR زنده می ماند.
- **Fast.**رادتر با سرعت 485x زمان واقعی 1000x سریعتر از WavMark اجرا می شود.
- **Capacity.**16 بیت بار مفید (می تواند کد ID مدل، زمان مهر تولید، ID کاربر) در هر اظهارات گنجانده می شود.

### WavMark

خط بازي قبل از آڊيو سيل، شبکه عصبی برگشتي، 32 بيت/دقيقه

- هم زماني با نیروی خام آهسته است
- می تواند با استفاده از صداهای گوس یا فشرده سازی MP3 حذف شود.
- دوستانه در زمان واقعي نيست

### WaveVerify (ژوئیه 2025)

حل ضعف های آدیو سیل  به طور خاص دستکاری های زمانی (عكس، سرعت) استفاده می کند. از ژنراتور مبتنی بر FiLM + دیتکتور ترکیبی از کارشناسان استفاده می کند. در حملات استاندارد با آدیو سیل رقابت می کند؛ ویرایش های زمانی را اداره می کند.

### دشمنان شکاف از آن بهره مند می شوند

از آدیومارک بنچ: "در زیر تغییر ارتفاع، تمام آبی نشان ها دقت بازیابی بیت را کمتر از 0.6 نشان می دهند، که نشان دهنده حذف تقریبا کامل است". **Pitch-shift is the universal attack.**آبی نشان No 2026 کاملاً قابل تغییر است. به همین دلیل شما نیاز به تشخیص (AASIST) در کنار آبی نشان دارید.

### C2PA / ابتکار مصداقیت محتوا

یک تکنیک ML نیست  یک قالب آشکار. فایل های صوتی دارای متاداتا امضا شده رمزنگاری شده در مورد ابزار ایجاد، نویسنده، تاریخ است. Audobox / Seamless از آن استفاده کنید. برای اصل خوب است؛ هیچ کاری نمی کند اگر یک بازیگر بد دوباره کدگذاری و استریپ متاداتا.

```figure
v4-audio-watermark
```

## آن را بسازید

### مرحله اول: یک آشکارساز ویژگی های طیف ساده (لوی)

```python
def spectral_rolloff(spec, percentile=0.85):
    cum = 0
    total = sum(spec)
    if total == 0:
        return 0
    threshold = total * percentile
    for k, v in enumerate(spec):
        cum += v
        if cum >= threshold:
            return k
    return len(spec) - 1

def is_suspicious(audio):
    spec = magnitude_spectrum(audio)
    rolloff = spectral_rolloff(spec)
    return rolloff / len(spec) > 0.92
```

گفتار مصنوعی اغلب انرژی فراخ فرکانس غیرمعمولا را دارد. آشکارسازهای تولید از AASIST استفاده می کنند، نه این. اما حس درست است.

### مرحله 2: AudioSeal embed + detect

```python
from audioseal import AudioSeal
import torch

generator = AudioSeal.load_generator("audioseal_wm_16bits")
detector = AudioSeal.load_detector("audioseal_detector_16bits")

audio = load_wav("generated.wav", sr=16000)[None, None, :]
payload = torch.tensor([[1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0]])
watermark = generator.get_watermark(audio, sample_rate=16000, message=payload)
watermarked = audio + watermark

result, decoded_payload = detector.detect_watermark(watermarked, sample_rate=16000)
# result: float in [0, 1] — probability of watermark presence
# decoded_payload: 16 bits; match against embedded payload
```

### مرحله سوم: ارزیابی  EER

```python
def eer(real_scores, fake_scores):
    thresholds = sorted(set(real_scores + fake_scores))
    best = (1.0, 0.0)
    for t in thresholds:
        far = sum(1 for s in fake_scores if s >= t) / len(fake_scores)
        frr = sum(1 for s in real_scores if s < t) / len(real_scores)
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), (far + frr) / 2)
    return best[1]
```

### مرحله چهارم: ادغام تولید

```python
def safe_tts(text, voice, clone_reference=None):
    if clone_reference is not None:
        verify_consent(user_id, clone_reference)
    audio = tts_model.synthesize(text, voice)
    audio_with_wm = audioseal_embed(audio, payload=build_payload(user_id, model_id))
    manifest = c2pa_sign(audio_with_wm, user_id, timestamp=now())
    return audio_with_wm, manifest
```

هر نسل کشتی: (1) آبی نشان، (2) مانیفیت امضا شده، (3) دفترچه بازرسی مطابق با سیاست حفظ.

## ازش استفاده کن

| Use case | Defense |
|----------|---------|
| Shipping TTS / voice cloning | AudioSeal embed on every output (non-negotiable) |
| Biometric voice unlock | AASIST + ECAPA ensemble; liveness challenge |
| Call-center fraud detection | AASIST on 20% sample of incoming calls |
| Podcast authenticity | C2PA signing on upload, AudioSeal if AI-generated |
| Research / training detectors | ASVspoof 5 train/dev/eval sets |

## دام ها

- **Watermark without detector ever running.**بی فایده ، آشکارساز رو به اطلاعات رسانا بفرست
- **Detection without calibration.**AASIST آموزش داده شده در مورد ASVspoof LA overfits، دقت در دنیای واقعی کاهش می یابد.
- **Pitch-shift gap.**تغيير تندتيري بسياري از نشانه هاي آب رو از بين مي برد
- **Metadata strip-and-rehost.**C2PA با رمزگذاری مجدد قابل عبور است. همیشه دفاع رمزنگاری + درک (سماه آب) را با هم اضافه کنید.
- **Liveness as detection.**از کاربر بخواهید تا یک عبارت تصادفی بگوید. از حملات تکرار جلوگیری می کند اما کلون سازی در زمان واقعی نیست.

## -باده

پس از`outputs/skill-spoof-defender.md`. مدل تشخیص، آبی نشان، مانیست اصل و کتاب بازی عملیاتی برای انتشار ژن صدا را انتخاب کنید.

## تمرینات

1. **Easy.**فرار کن`code/main.py`. آشکارساز اسباب بازی + آب نشان اسباب بازی در آدیو مصنوعی قرار داده شده / شناسایی شده
2. **Medium.**نصب کنید`audioseal`، بار 16 بت رو توي خروجی TTS قرار بده دوباره رمزگشایی کن صدا رو با صدا خراب کن و دقت بازپرداخت بيت رو اندازه بگيري
3. **Hard.**تنظیم دقیق یک RawNet2 یا AASIST در ASVspoof 2019 LA. اندازه گیری EER. آزمایش روی مجموعه ای از کلیپ های تولید شده F5-TTS  ببینید که تشخیص OOD چگونه کاهش می یابد.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| ASVspoof | The benchmark | Biennial challenge; 2024 = ASVspoof 5. |
| CM (countermeasure) | Detector | Classifier: real speech vs synthetic / converted. |
| SASV | Speaker verif + CM | Integrated biometric + spoof detection. |
| AudioSeal | Meta watermark | Localized, 16-bit payload, 485× faster than WavMark. |
| Bit Recovery Accuracy | Watermark survival | Fraction of payload bits recovered after attack. |
| C2PA | Provenance manifest | Cryptographic metadata about creation / authorship. |
| AASIST | Detector family | Graph-attention-based anti-spoofing SOTA. |

## خواندن بیشتر

- [Todisco et al. (2024). ASVspoof 5](https://dl.acm.org/doi/10.1016/j.csl.2025.101825) شاخص مرجع فعلی
- [Defossez et al. (2024). AudioSeal](https://arxiv.org/abs/2401.17264) نماد آبی پیش فرض
- [Chen et al. (2025). WaveVerify](https://arxiv.org/abs/2507.21150) دستگاه تشخیصي MoE براي حملات زماني
- [Jung et al. (2022). AASIST](https://arxiv.org/abs/2110.01200) ستون فقرات تشخیص SOTA
- [AudioMarkBench (2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/5d9b7775296a641a1913ab6b4425d5e8-Paper-Datasets_and_Benchmarks_Track.pdf) ارزیابی ثبات
- [C2PA specification](https://spec.c2pa.org/specifications/specifications/2.4/index.html) شکل مانیست اصل
