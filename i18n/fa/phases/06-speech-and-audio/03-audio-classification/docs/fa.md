# طبقه بندی صوتی  از k-NN در MFCC تا AST و BEAT

> همه چیز از "سرگ با صدای سرن" تا "چه زبان است" طبقه بندی صوتی است. ویژگی ها می شوند. معماری هر دهه حرکت می کند. ارزیابی AUC، F1 و هر کلاس به یاد می آید.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 3 · 06 (CNNs), Phase 5 · 08 (CNNs & RNNs for Text)
**Time:** ~75 minutes

## مشکل

شما یک کلیپ ۱۰ ثانیه را دریافت می کنید. می خواهید بدانید: "چه چیزی است؟" صدا شهری (سیرین، حفاری، سگ) ، فرمان سخنران (بله / نه / توقف) ، شناسه زبان (en / es / ar) ، احساسات سخنران (غضب / خنثی) یا صدا محیطی (در داخل / بیرون، بابل) . همه اینها * طبقه بندی صوتی* هستند، و در سال 2026 معماری پایه بالغ است: log-mel → CNN یا Transformer → softmax.

مشکل اصلی شبکه نیست. این داده ها است. مجموعه داده های آڈیو عدم تعادل کلاس وحشیانه، تغییر دامنه قوی (صاف و شور) و سر و صدای برچسب (که تصمیم گرفت "بابل شهری" در مقابل "سر و صدای رستوران" است).

## مفهوم

![Audio classification ladder: k-NN on MFCCs to AST to BEATs](../assets/audio-classification.svg)

**k-NN on MFCCs (the 1990s baseline).**MFCC های صاف در هر کلیپ، شبیه سازی کوسین با یک بانک برچسب گذاری شده، بازگشت اکثریت رای K بالا. به طرز شگفت انگیزی در مجموعه داده های کوچک و تمیز (امر زبان، ESC-50) قوی است. بدون GPU اجرا می شود.

**2D CNN on log-mels (2015-2019).**درمان`(T, n_mels)`به عنوان یک تصویر، Log-mail را اعمال کنید. ResNet-18 یا VGG را بکار ببرید. محور زمان را به طور متوسط جمع کنید. نرمترین سطح در کلاس ها. هنوز هم در اکثر مسابقات 2026 kaggle.

**Audio Spectrogram Transformer, AST (2021-2024).**برچسب های ثبت شده را (به عنوان مثال 16×16 پیچ) پیوند دهید، ورودی های موقعیت را اضافه کنید، به یک ViT تغذیه کنید. حالت فن در AudioSet (mAP 0.485) برای یادگیری تحت نظارت.

**BEATs and WavLM-base (2024-2026).**پیش تمرین خود نظارت بر میلیون ها ساعت. با 1-10٪ از داده های تحت نظارت که نیاز دارید، کار خود را خوب تنظیم کنید. در سال 2026 این نقطه افتراضی برای صدا غیر گفتاری است. BEATs-iter3 AST را 1-2 mAP در AudioSet با استفاده از 1/4 محاسبه می کند.

**Whisper-encoder as a frozen backbone (2024).**کدر ویسپر رو بردارید، کدر را رها کنید، یک طبقه بندی خطی متصل کنید. نزدیک به SOTA در شناسه زبان و طبقه بندی رویداد ساده با افزایش صوتی صفر. خط اصلی "عشق ناهار رایگان".

### عدم تعادل کلاس ها چالش واقعی است

ESC-50: 50 کلاس، 40 کلیپ هر  متعادل، آسان. UrbanSound8K: 10 کلاس، نامتوازن 10:1. AudioSet: 632 کلاس با دم طولانی 100,000:1. تکنیک هایی که کار می کنند:

- نمونه گیری متعادل در طول آموزش (نه در ارزیابی)
- مخلوط کردن: دو کلیپ (و برچسب های آنها) را به صورت خطی به عنوان افزایشی بین قرار دهید.
- SpecAugment: ماسک زمان تصادفی و باند های فرکانس. ساده؛ مهم.

### ارزیابی

- کلاس های چندگانه (امر زبان): دقت بالا-1، دقت بالا-5.
- برچسب چند طبقه (AudioSet، UrbanSound-style): متوسط دقت متوسط (mAP).
- عدم تعادل شدید: بازپس گرفتن در هر کلاس + ماکرو F1.

شماره 2026 که باید بدونی:

| Benchmark | Baseline | SOTA 2026 | Source |
|-----------|----------|-----------|--------|
| ESC-50 | 82% (AST) | 97.0% (BEATs-iter3) | BEATs paper (2024) |
| AudioSet mAP | 0.485 (AST) | 0.548 (BEATs-iter3) | HEAR leaderboard 2026 |
| Speech Commands v2 | 98% (CNN) | 99.0% (Audio-MAE) | HEAR v2 results |

```figure
mfcc-pipeline
```

## آن را بسازید

### مرحله ی اول: Featurise

```python
def featurize_mfcc(signal, sr, n_mfcc=13, n_mels=40, frame_len=400, hop=160):
    mag = stft_magnitude(signal, frame_len, hop)
    fb = mel_filterbank(n_mels, frame_len, sr)
    mels = apply_filterbank(mag, fb)
    log = log_transform(mels)
    return [dct_ii(frame, n_mfcc) for frame in log]
```

### مرحله دوم: خلاصه ی طول ثابت

```python
def summarize(mfcc_frames):
    n = len(mfcc_frames[0])
    mean = [sum(f[i] for f in mfcc_frames) / len(mfcc_frames) for i in range(n)]
    var = [
        sum((f[i] - mean[i]) ** 2 for f in mfcc_frames) / len(mfcc_frames) for i in range(n)
    ]
    return mean + var
```

ساده اما قوی: میانگین + متغیر در طول زمان به یک 26 بعدی ثابت برای 13 کوف MFCC می دهد. بلافاصله اجرا می شود.

### مرحله سوم: k-NN

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1e-12
    nb = math.sqrt(sum(x * x for x in b)) or 1e-12
    return dot / (na * nb)

def knn_classify(q, bank, labels, k=5):
    sims = sorted(range(len(bank)), key=lambda i: -cosine(q, bank[i]))[:k]
    votes = Counter(labels[i] for i in sims)
    return votes.most_common(1)[0][0]
```

### مرحله 4: ارتقا به CNN در Log-Mels

در PyTorch:

```python
import torch.nn as nn

class AudioCNN(nn.Module):
    def __init__(self, n_mels=80, n_classes=50):
        super().__init__()
        self.body = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(64, 128, 3, padding=1), nn.ReLU(),
            nn.AdaptiveAvgPool2d(1),
        )
        self.head = nn.Linear(128, n_classes)

    def forward(self, x):  # x: (B, 1, T, n_mels)
        return self.head(self.body(x).flatten(1))
```

پارامترهای 3M. قطار ها در ~ 10 دقیقه بر روی ESC-50 با یک RTX 4090 . 80٪ + دقت.

### مرحله 5: تنظیم دقیق یک ترانسفورماتور صوتی پیش از آموزش (AST نشان داده شده)

```python
from transformers import ASTFeatureExtractor, ASTForAudioClassification

ext = ASTFeatureExtractor.from_pretrained("MIT/ast-finetuned-audioset-10-10-0.4593")
model = ASTForAudioClassification.from_pretrained(
    "MIT/ast-finetuned-audioset-10-10-0.4593",
    num_labels=50,
    ignore_mismatched_sizes=True,
)

inputs = ext(audio, sampling_rate=16000, return_tensors="pt")
logits = model(**inputs).logits
```

مثال تنظیمات دقیق AST از مرکز. BEATs، پیش فرض 2026، در Hugging Face Hub نیست: یک نقطه بازرسی را از [BEATs release in microsoft/unilm](https://github.com/microsoft/unilm/tree/master/beats)و با اون ریپو شلوارش کنم`BEATs`و`BEATsConfig`کلاس ها، حلقه تنظیم دقیق شکل مشابهی را حفظ می کند.

## ازش استفاده کن

دسته 2026:

| Situation | Start with |
|-----------|-----------|
| Tiny dataset (<1000 clips) | k-NN on MFCC means (your baseline) + audio augmentation |
| Medium dataset (1K–100K) | BEATs or AST fine-tune |
| Large dataset (>100K) | Train from scratch or fine-tune Whisper-encoder |
| Real-time, edge | 40-MFCC CNN, quantized to int8 (KWS-style) |
| Multi-label (AudioSet) | BEATs-iter3 with BCE loss + mixup + SpecAugment |
| Language ID | MMS-LID, SpeechBrain VoxLingua107 baseline |

قانون تصمیم گیری: **start with a frozen backbone, not a fresh model**.حساب خوبي از سر بياتس باعث ميشه 95 درصد سوتا رو در چند ساعت، نه چند هفته بدست بياري

## -باده

پس از`outputs/skill-classifier-designer.md`. معماری، افزونه ها، استراتژی تعادل کلاس و ارزیابی متریک برای یک کار طبقه بندی صوتی خاص را انتخاب کنید.

## تمرینات

1. **Easy.**فرار کن`code/main.py`. این k-NN MFCC پایه را بر روی مجموعه داده های مصنوعی 4 کلاس (نمای خالص در نقاط مختلف) آموزش می دهد. ماتریس سردرگمی را گزارش کنید.
2. **Medium.**جایگزینش کن`summarize`با [معادل، var، منحرف، کورتوز] آیا جمع آوری 4 لحظه بر معادل + var در همان مجموعه داده های مصنوعی غلبه می کند؟
3. **Hard.**استفاده کردن`torchaudio`، یک سی ان ان 2D را بر روی ESC-50 فولد آموزش دهید. دقت اعتبار 5 برابر را گزارش کنید. SpecAugment (ماسک زمان = 20, ماسک فرکانس = 10) را اضافه کنید و دلتا را گزارش کنید.

## اصطلاحات کلیدی

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| AudioSet | The ImageNet of audio | Google's 2M-clip, 632-class weakly-labeled YouTube dataset. |
| ESC-50 | Small classification benchmark | 50 classes × 40 clips of environmental sounds. |
| AST | Audio Spectrogram Transformer | ViT on log-mel patches; 2021 SOTA. |
| BEATs | Self-supervised audio | Microsoft model, iter3 leads AudioSet as of 2026. |
| Mixup | Pair augmentation | `x = λ·x1 + (1-λ)·x2; y = λ·y1 + (1-λ)·y2`. |
| SpecAugment | Mask-based augmentation | Zero-out random time and frequency bands of the spectrogram. |
| mAP | Main multi-label metric | Mean average precision across classes and thresholds. |

## خواندن بیشتر

- [Gong, Chung, Glass (2021). AST: Audio Spectrogram Transformer](https://arxiv.org/abs/2104.01778) معماری ثبت شده از سال 20212024.
- [Chen et al. (2022, rev. 2024). BEATs: Audio Pre-Training with Acoustic Tokenizers](https://arxiv.org/abs/2212.09058) پیش فرض 2024+
- [Park et al. (2019). SpecAugment](https://arxiv.org/abs/1904.08779) افزایش صوتی غالب
- [Piczak (2015). ESC-50 dataset](https://github.com/karolpiczak/ESC-50) معیار ۵۰ کلاس که زنده است
- [Gemmeke et al. (2017). AudioSet](https://research.google.com/audioset/) طبقه بندی یوتیوب 632؛ هنوز استاندارد طلا.
