# التصنيف الصوتي  من k-NN على MFCC إلى AST و BEATs

> كل شيء من "كلب اللحوم مقابل السيرين" إلى "أي لغة هي هذه" هو تصنيف الصوت. الميزات هي التآكل. تتحرك الهندسة المعمارية كل عقد. تبقى التقييم AUC، F1، والذكرى لكل فئة.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 3 · 06 (CNNs), Phase 5 · 08 (CNNs & RNNs for Text)
**Time:** ~75 minutes

## المشكلة

تحصل على مقطع لمدة 10 ثوان. تريد أن تعرف: "ما هو؟" الصوت الحضري (سيرين، حفرة، كلب) ، أوامر الكلام (نعم / لا / توقف) ، و ID اللغة (en / es / ar) ، أو عاطفة المتحدث (غضب / محايد) ، أو صوت البيئة (داخل / خارج، تُذَمّر). كل هذه هي * تصنيف الصوت*، وفي عام 2026 تكون الهندسة المعمارية الأساسية ناضجة: Log-mel → CNN أو Transformer → softmax.

الصعوبة الأساسية ليست الشبكة. إنها البيانات. مجموعة البيانات الصوتية لديها عدم توازن فصلي وحشي ، وتحويل نطاق قوي (نظيف مقابل ضجيج) ، وضجيج العلامات التجارية (من قرر "المرحلة الحضرية" مقابل "ضجيج المطعم"؟ 80% من المشكلة هي التركيب والتكبير والتقييم ، وليس تبادل CNN لتحويل.

## المفهوم

![Audio classification ladder: k-NN on MFCCs to AST to BEATs](../assets/audio-classification.svg)

**k-NN on MFCCs (the 1990s baseline).**المفروضات المفروضة على كل مقطع، حساب تشابه كوسين مع البنك الملصق، العودة الأصوات الأغلبية من أعلى K. قوية بشكل مفاجئ على مجموعة بيانات نظيفة صغيرة (تفويضات الكلام، ESC-50). يعمل دون GPU.

**2D CNN on log-mels (2015-2019).**معالجة`(T, n_mels)`التطبيق ResNet-18 أو VGG نمط. متوسط العالم تجمع المحور الوقت. Softmax على الفصول. لا يزال خط الأساس في معظم مسابقات كاغل 2026

**Audio Spectrogram Transformer, AST (2021-2024).**إصبع الملفات السجلية (مثل 16 × 16 ملصقات) ، إضافة إضافة وضعيات، إرسال إلى ViT. حالة الفن على AudioSet (mAP 0.485) للتعلم المشرف عليه.

**BEATs and WavLM-base (2024-2026).**التدريب المسبق المراقب الذاتي على ملايين الساعات. ضبط مهامك مع 1-10٪ من البيانات المراقبة التي كنت ستحتاج إليها. في عام 2026 هذه هي نقطة البداية الافتراضية للصوت غير الكلام. Beat-iter3 يتغلب على AST بنسبة 1-2 mAP على AudioSet بينما تستخدم 1/4 الحساب.

**Whisper-encoder as a frozen backbone (2024).**خذ رمز "ويسبر" ، اترك جهاز القيادة ، ورسم تصنيف خطي. تقرب من "SOTA" على معرف اللغة وتصنيف الأحداث بسيطًا مع زيادة الصوت صفر. خط أساس "غداء مجاني".

### عدم توازن الطبقات هو التحدي الحقيقي

ESC-50: 50 فئة، 40 شريطا كل  متوازنة، سهلة. UrbanSound8K: 10 فئة، غير متوازنة 10:1. AudioSet: 632 فئة مع 100,000:1 ذيل طويل. تقنيات تعمل:

- أخذ العينات المتوازن أثناء التدريب (ليس في التقييم).
- الاختلاط: التقاطع خطيا بين شريطين (وتصريحاتهم) كإضاف.
- المضمونة: غطاء الوقت والتيارات العشوائية. بسيط؛ حرج.

### التقييم

- حصرية متعددة الفئات (أوامر الكلام): دقة من أعلى 1، دقة من أعلى 5.
- المختصات متعددة الفئة (AudioSet، UrbanSound-style): متوسط دقة (mAP).
- عدم التوازن الكبير: استدعاء لكل فئة + ماكرو F1.

أرقام 2026 يجب أن تعرفها:

| Benchmark | Baseline | SOTA 2026 | Source |
|-----------|----------|-----------|--------|
| ESC-50 | 82% (AST) | 97.0% (BEATs-iter3) | BEATs paper (2024) |
| AudioSet mAP | 0.485 (AST) | 0.548 (BEATs-iter3) | HEAR leaderboard 2026 |
| Speech Commands v2 | 98% (CNN) | 99.0% (Audio-MAE) | HEAR v2 results |

```figure
mfcc-pipeline
```

## بناءها

### الخطوة 1: التميز

```python
def featurize_mfcc(signal, sr, n_mfcc=13, n_mels=40, frame_len=400, hop=160):
    mag = stft_magnitude(signal, frame_len, hop)
    fb = mel_filterbank(n_mels, frame_len, sr)
    mels = apply_filterbank(mag, fb)
    log = log_transform(mels)
    return [dct_ii(frame, n_mfcc) for frame in log]
```

### الخطوة الثانية: ملخص طول ثابت

```python
def summarize(mfcc_frames):
    n = len(mfcc_frames[0])
    mean = [sum(f[i] for f in mfcc_frames) / len(mfcc_frames) for i in range(n)]
    var = [
        sum((f[i] - mean[i]) ** 2 for f in mfcc_frames) / len(mfcc_frames) for i in range(n)
    ]
    return mean + var
```

بسيط ولكن قوي: المتوسط + التباين عبر الزمن يعطي إضافة ثابتة 26 بعدة لـ 13 كوف MFCC. يعمل على الفور. يضرب خطوط أساسية NN الحديثة على ESC-50 في الآونة الأخيرة 2017.

### الخطوة الثالثة: k-NN

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

### الخطوة الرابعة: تحديث إلى CNN على الملفات المقطوعة

في (بيتورش):

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

3M المعلمات. القطارات في ~ 10 دقيقة على ESC-50 مع RTX 4090 واحد. 80٪ + دقة.

### الخطوة 5: ضبط محول الصوت المُدرب مسبقًا (مظهر AST)

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

مثال تحديد المفاتيح AST من المركبة. BEATs، افتراضي 2026، ليس على مركبة Hugging Face: تنزيل نقطة تفتيش من المركبة [BEATs release in microsoft/unilm](https://github.com/microsoft/unilm/tree/master/beats)و تحمله مع ذلك الاحتفاظ`BEATs`و`BEATsConfig`فصول، حلقة التنسيق الدقيق تبقى نفس الشكل.

## استخدمها

"مجموعة 2026"

| Situation | Start with |
|-----------|-----------|
| Tiny dataset (<1000 clips) | k-NN on MFCC means (your baseline) + audio augmentation |
| Medium dataset (1K–100K) | BEATs or AST fine-tune |
| Large dataset (>100K) | Train from scratch or fine-tune Whisper-encoder |
| Real-time, edge | 40-MFCC CNN, quantized to int8 (KWS-style) |
| Multi-label (AudioSet) | BEATs-iter3 with BCE loss + mixup + SpecAugment |
| Language ID | MMS-LID, SpeechBrain VoxLingua107 baseline |

قاعدة القرار: **start with a frozen backbone, not a fresh model**تحسين رأس "بييتز" يحصل على 95% من "سوتا" في ساعات وليس أسابيع

## أرسله

إبقوا`outputs/skill-classifier-designer.md`. اختيار الهندسة المعمارية، وتعزيزات، استراتيجية توازن الطبقات، وتقييم المقاييس لمهمة تصنيف الصوت معينة.

## التمارين

1. **Easy.**أركض`code/main.py`. يدرّب خط أساس K-NN MFCC على مجموعة بيانات اصطناعية من 4 فئات (أصوات نقية في مستويات مختلفة).
2. **Medium.**استبدل`summarize`مع [متوسط، var، منحرف، كورتوس] هل 4 اللحظات تجمع ضرب المتوسط + var على نفس مجموعة البيانات الاصطناعية؟
3. **Hard.**استخدام`torchaudio`1 إبلغ دقة التحقق المتقاطع 5 مرات إضافة SpecAugment (قناع الزمن = 20 ، قناع التردد = 10) وإبلاغ دلتا.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| AudioSet | The ImageNet of audio | Google's 2M-clip, 632-class weakly-labeled YouTube dataset. |
| ESC-50 | Small classification benchmark | 50 classes × 40 clips of environmental sounds. |
| AST | Audio Spectrogram Transformer | ViT on log-mel patches; 2021 SOTA. |
| BEATs | Self-supervised audio | Microsoft model, iter3 leads AudioSet as of 2026. |
| Mixup | Pair augmentation | `x = λ·x1 + (1-λ)·x2; y = λ·y1 + (1-λ)·y2`. |
| SpecAugment | Mask-based augmentation | Zero-out random time and frequency bands of the spectrogram. |
| mAP | Main multi-label metric | Mean average precision across classes and thresholds. |

## المزيد من القراءة

- [Gong, Chung, Glass (2021). AST: Audio Spectrogram Transformer](https://arxiv.org/abs/2104.01778) الهندسة المعمارية السجلية من 20212024.
- [Chen et al. (2022, rev. 2024). BEATs: Audio Pre-Training with Acoustic Tokenizers](https://arxiv.org/abs/2212.09058) الاكتفاء في 2024+
- [Park et al. (2019). SpecAugment](https://arxiv.org/abs/1904.08779) التوسع السمعي المهيمن.
- [Piczak (2015). ESC-50 dataset](https://github.com/karolpiczak/ESC-50) مقياس 50 فئة التي تعيش على.
- [Gemmeke et al. (2017). AudioSet](https://research.google.com/audioset/) تصنيف يوتيوب من فئة 632؛ لا يزال معيار الذهب.
