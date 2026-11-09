# تشخیص و تأیید سخنرانان

> ASR می پرسد "آن ها چه گفتند؟" تشخیص سخنران می پرسد "چه کسی گفته است؟" ریاضیات شبیه به  گنجانده شده و به علاوه کوسین  است اما هر تصمیم تولید بر روی یک شماره EER منحصر است.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 22 (Embedding Models)
**Time:** ~45 minutes

## مشکل

یک کاربر یک کلمه عبور می گوید. می خواهید بدانید: آیا این شخص ادعا می کند (* تایید*: 1) است یا اولین شخص در بانک ثبت نام شما (* شناسایی*: 1N) است؟ یا نه  این یک سخنران ناشناخته (* باز-set*) است؟

قبل از سال ۲۰۱۸: GMM-UBM + i-وکتورها. EER منطقی اما شکننده برای تغییر کانال (فون در مقابل لپ تاپ) و احساسات. 20182022: x-وکتورها (هک ستون فقرات TDNN با حاشیه زاویه ای آموزش دیده است). 2022+: ECAPA-TDNN و WavLM-بند های بزرگ. تا سال ۲۰۲۶ این زمینه توسط سه مدل و یک متریک تحت سلطه قرار دارد.

اندازه گیری اینه**EER** نرخ اشتباهات برابر. حد قرار گیری خود را تنظیم کنید تا نرخ پذیرش غلط = نرخ رد غلط. کراسور EER است. در هر مقاله، هر لیست رتبه بندی، هر تماس خرید استفاده می شود.

## مفهوم

![Enrollment + verification pipeline with embedding + cosine + EER](../assets/speaker-verification.svg)

**The pipeline.**ثبت: ثبت 530 ثانیه از بلندگو هدف؛ محاسبه یک ورق گذاری با ابعاد ثابت (192-d برای ECAPA-TDNN، 256-d برای WavLM- بزرگ). تایید: دریافت ورق گذاری بیان آزمون؛ محاسبه شباهت cosine؛ مقایسه با یک حد.

**ECAPA-TDNN (2020, still dominant 2026).**تاکید بر توجه، گسترش و جمع آوری کانال - شبکه عصبی زمان-خاموشی. بلوک های 1D conv با تحریک فشار، جمع آوری توجه چند سر، و سپس لایه خطی به 192-d. آموزش دیده در VoxCeleb 1+2 (2،700 سخنران، 1.1M اظهارات) با ضایعات ضمیمه زاویه ای (AAM-softmax).

**WavLM-SV (2022+).**تنظیم دقیق یک ستون فقرات SSL WavLM بزرگ با از دست دادن AAM. کیفیت بالاتر اما کند تر  300+ MB در مقابل 15 MB.

**x-vector (baseline).**جمع آوری آمار TDNN +. کلاسیک؛ هنوز هم در CPU / کناره مفید است.

**AAM-softmax.**نرم ترین استاندارد با مرزهای اضافه شده `m`در فضای زاویه ای: `cos(θ + m)`برای کلاس درست. نیروی جداسازی زاویه بین کلاس ها.`m=0.2`، مقیاس`s=30`. .

### امتیاز

- **Cosine**بین ثبت نام و امتحانات ثبت نام.
- **PLDA (Probabilistic LDA).**گنجانده شدن پروژه به فضای پنهان که در آن همان سخنران در مقابل سخنران مختلف نسبت احتمال شکل بسته دارد. اضافه شده در بالای cosine برای کاهش +1020% EER. استاندارد قبل از سال 2020؛ اکنون فقط در تنظیمات بسته استفاده می شود.
- **Score normalization.** `S-norm`یا`AS-norm`: هر نمره را با یک گروه از وسائل و موارد دیگر عادی سازی کنید.

### اعداد که باید بدانید (2026)

| Model | VoxCeleb1-O EER | Params | Throughput (A100) |
|-------|-----------------|--------|-------------------|
| x-vector (classic) | 3.10% | 5 M | 400× RT |
| ECAPA-TDNN | 0.87% | 15 M | 200× RT |
| WavLM-SV large | 0.42% | 316 M | 20× RT |
| Pyannote 3.1 segmentation + embedding | 0.65% | 6 M | 100× RT |
| ReDimNet (2024) | 0.39% | 24 M | 100× RT |

### آبهام

"چه کسی زمانی صحبت کرد" در یک کلیپ چند صدایی. لوله: VAD → بخش → هر بخش → خوشه (گروه یا طیف) → مرزهای صاف.`pyannote.audio`3.1 که بخش بندی بلندگو + گنجانده شدن + جمع بندی را در پشت یک تماس ترکیب می کند. در سال 2026 SOTA DER در AMI ~ 15٪ (از 23٪ در سال 2022 کاهش یافته است).

```figure
sp-eer-crossover
```

## آن را بسازید

### مرحله ی اول: گنجانده شدن اسباب بازی از آمار MFCC

```python
def embed_mfcc_stats(signal, sr):
    frames = featurize_mfcc(signal, sr, n_mfcc=13)
    mean = [sum(f[i] for f in frames) / len(frames) for i in range(13)]
    std = [
        math.sqrt(sum((f[i] - mean[i]) ** 2 for f in frames) / len(frames))
        for i in range(13)
    ]
    return mean + std  # 26-d
```

نه فقط براي آموزش`code/main.py`این را به عنوان اثبات مفهوم در داده های بلندگو مصنوعی استفاده می کند.

### مرحله دوم: شباهت کوسین + حد

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0

def verify(enroll, test, threshold=0.75):
    return cosine(enroll, test) >= threshold
```

### مرحله سوم: EER از جفت های مشابه

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 1.0, 0.0)  # (fa, fr, threshold)
    for t in thresholds:
        fr = sum(1 for s in same_scores if s < t) / len(same_scores)
        fa = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        if abs(fa - fr) < abs(best[0] - best[1]):
            best = (fa, fr, t)
    return (best[0] + best[1]) / 2, best[2]
```

بازپرداخت (eer, threshold_at_eer). هر دو را گزارش کنید.

### مرحله 4: تولید با SpeechBrain

```python
from speechbrain.pretrained import EncoderClassifier

clf = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")

# enroll: average the embeddings of 3-5 clean samples
enroll = torch.stack([clf.encode_batch(load(x)) for x in enrollment_clips]).mean(0)
# verify
score = clf.similarity(enroll, clf.encode_batch(load("test.wav"))).item()
verdict = score > 0.25   # ECAPA typical threshold; tune on your data
```

### مرحله 5: با پیانوت روزانه سازی کنید

```python
from pyannote.audio import Pipeline

pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
diarization = pipe("meeting.wav", num_speakers=None)
for turn, _, speaker in diarization.itertracks(yield_label=True):
    print(f"{turn.start:.1f}–{turn.end:.1f}  {speaker}")
```

## ازش استفاده کن

دسته 2026:

| Situation | Pick |
|-----------|------|
| Closed-set 1:1 verification, edge | ECAPA-TDNN + cosine threshold |
| Open-set verification, cloud | WavLM-SV + AS-norm |
| Diarization (meetings, podcasts) | `pyannote/speaker-diarization-3.1` |
| Anti-spoofing (replay / deepfake detection) | AASIST or RawNet2 |
| Tiny embedded (KWS + enrollment) | Titanet-Small (NeMo) |

## دام ها

- **Channel mismatch.**مدل آموزش دیده در VoxCeleb (ویدیو وب) ≠ صدا تماس تلفنی. همیشه در کانال هدف ارزیابی کنید.
- **Short utterances.**EER به شدت کمتر از 3 ثانیه از صدا آزمون کاهش می یابد.
- **Enrollment with noise.**یک ثبت نام شور و صدای پر از زهر به لنگر می رسد.
- **Fixed threshold across conditions.**همیشه حد را روی یک مجموعه توسعه داده شده از دامنه هدف تنظیم کنید.
- **Cosine on non-normalized embeddings.**اول L2-معمولی سازی کنید، در غیر این صورت شدت غالب می شود.

## -باده

پس از`outputs/skill-speaker-verifier.md`مدل انتخاب، پروتکل ثبت نام، برنامه تنظیم حد و محافظت از کلاهبرداری

## تمرینات

1. **Easy.**فرار کن`code/main.py`. ساخت "سپیکر" مصنوعی (پروفیل های مختلف صدا) ، ثبت نام، محاسبه EER در یک لیست آزمایشی 100 جفت.
2. **Medium.**از SpeechBrain ECAPA در 30 سخنان VoxCeleb1 استفاده کنید (5 سخنران × 6 هر کدام).
3. **Hard.**ثبت نام کامل را بسازید → روزانه → لوله های تایید با `pyannote.audio`. در مورد DER در سييت توسعه امي

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| EER | The headline metric | Threshold where False Accept = False Reject. |
| Verification | 1:1 | "Is this Alice?" |
| Identification | 1:N | "Who is speaking?" |
| Open-set | Unknown possible | Test set can contain unenrolled speakers. |
| Enrollment | Registering | Computing a speaker's reference embedding. |
| AAM-softmax | The loss | Softmax with additive angular margin; forces cluster separation. |
| PLDA | Classic scoring | Probabilistic LDA; likelihood-ratio scoring on top of embeddings. |
| DER | Diarization metric | Diarization Error Rate — miss + false alarm + confusion. |

## خواندن بیشتر

- [Snyder et al. (2018). X-Vectors: Robust DNN Embeddings for Speaker Recognition](https://www.danielpovey.com/files/2018_icassp_xvectors.pdf) کاغذی کلاسیک عمیق
- [Desplanques et al. (2020). ECAPA-TDNN](https://arxiv.org/abs/2005.07143) معماری غالب 20202026
- [Chen et al. (2022). WavLM: Large-Scale Self-Supervised Pre-Training for Full Stack Speech Processing](https://arxiv.org/abs/2110.13900) ستون فقرات SSL برای SV و دایریزاسیون
- [Bredin et al. (2023). pyannote.audio 3.1](https://github.com/pyannote/pyannote-audio) روزرسانی تولید + پسته های گنجانده شدن
- [VoxCeleb leaderboard (updated 2026)](https://www.robots.ox.ac.uk/~vgg/data/voxceleb/) رتبه بندی فعلی EER در هر مدل
