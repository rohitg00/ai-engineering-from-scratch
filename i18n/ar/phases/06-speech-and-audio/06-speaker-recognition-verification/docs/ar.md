# التعرف على المتحدثين والتحقق منها

> يسأل ASR "ماذا قالوا؟" يسأل التعرف على المتحدث "من قال ذلك؟" تبدو الرياضيات نفسها  التوابع زائد كوسين  ولكن كل قرار إنتاج يعتمد على رقم واحد EER.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 22 (Embedding Models)
**Time:** ~45 minutes

## المشكلة

يقول المستخدم كلمة مرور. تريد أن تعرف: هل هذا الشخص الذي يدعي أنه (* التحقق*: 1) ، أو هل هو أول شخص في بنك التسجيل الخاص بك (* التعرف*: 1) ؟ أو لا  هل هذا متحدث مجهول (* مفتوح *) ؟

قبل عام 2018: GMM-UBM + i-متجهات. EER معقولة ولكن هشة للتحول إلى القناة (الهاتف مقابل الكمبيوتر المحمول) والعاطفة. 20182022: متجهات x (تدريب العمود الفقري TDNN مع الهامش الزاوي). 2022+: ECAPA-TDNN و WavLM-التركيبات الكبيرة. بحلول عام 2026 يهيمن على المجال ثلاثة نماذج ومريتر واحد.

المقياس هو**EER** معدل الأخطاء المتساوي. حدد عتبة قرارك بحيث يصل معدل قبول كاذب = معدل رفض كاذب. التقاطع هو EER. يستخدم في كل ورقة، كل قائمة، كل دعوة المشتريات.

## المفهوم

![Enrollment + verification pipeline with embedding + cosine + EER](../assets/speaker-verification.svg)

**The pipeline.**التسجيل: تسجيل 530 ثانية من مكبر الصوت المستهدف؛ حساب إضافة ذات الأبعاد الثابتة (192-d بالنسبة لـ ECAPA-TDNN، 256-d بالنسبة لـ WavLM-large). التحقق: الحصول على إضافة التصريحات الاختبارية؛ حساب تشابه الكوزين؛ مقارنة مع عتبة.

**ECAPA-TDNN (2020, still dominant 2026).**أكد الاهتمام القناة والانتشار والجمع - شبكة عصبية تأخير الوقت. كتلة 1D conv مع إثارة الضغط ، جمع الاهتمام متعدد الرؤوس ، تليها طبقة خطية إلى 192-d. تدرب على VoxCeleb 1 + 2 (2،700 مكبر ، 1.1M تصريحات) مع فقدان هامش زاوية إضافية (AAM-softmax).

**WavLM-SV (2022+).**ضبط العمود الفقري SSL الكبير المميزة مسبقاً مع فقدان AAM. جودة أعلى ولكن أبطأ  300+ MB مقابل 15 MB.

**x-vector (baseline).**تجمع إحصائيات TDNN +. كلاسيكي؛ لا يزال مفيدًا على CPU / edge.

**AAM-softmax.**المعدل القياسي لينة مع حافة إضافية `m`في المساحة الزاوية: `cos(θ + m)`للطبقة الصحيحة. قوى الفصل الزاوي بين الفئات. نموذجية `m=0.2`، حجم`s=30`. . .

### تسجيل النتيجة

- **Cosine**بين التسجيل والإختبار. القرار القائم على العدوان.
- **PLDA (Probabilistic LDA).**إضافة المشروع إلى مساحة مختفية حيث يكون لدى المتحدث نفسه مقابل المتحدث المختلف نسبة احتمالية في شكل مغلق. إضافة فوق الكوسين لخفض 1020% من EER. معيار قبل عام 2020؛ لا يستخدم الآن إلا في إعدادات مجموعة مغلقة.
- **Score normalization.** `S-norm`أو`AS-norm`: تعاديل كل نتيجة مقابل مجموعة من الوسائل والمعدات المزيفة.

### الأرقام التي يجب أن تعرفها (2026)

| Model | VoxCeleb1-O EER | Params | Throughput (A100) |
|-------|-----------------|--------|-------------------|
| x-vector (classic) | 3.10% | 5 M | 400× RT |
| ECAPA-TDNN | 0.87% | 15 M | 200× RT |
| WavLM-SV large | 0.42% | 316 M | 20× RT |
| Pyannote 3.1 segmentation + embedding | 0.65% | 6 M | 100× RT |
| ReDimNet (2024) | 0.39% | 24 M | 100× RT |

### الإسهال

"من تحدث عندما" في مقطع متعدد المتحدثين. خط الأنابيب: VAD → قطاع → تضمين كل قطعة → مجموعة (مجموعية أو طيفية) → حدود سلسة. كومة حديثة: `pyannote.audio`3.1 ، الذي يجمع قسم المتكبرين + إدراجهم + تجميعهم وراء مكالمة واحدة. 2026 SOTA DER على AMI هو ~ 15% (انخفض من 23% في 2022).

```figure
sp-eer-crossover
```

## بناءها

### الخطوة الأولى: إدراج الألعاب من إحصاءات المجلس

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

ليس من أجل التدريس فقط`code/main.py`يستخدم هذا كدليل على المفهوم على بيانات مكبرات صوتية اصطناعية.

### الخطوة الثانية: تشابه الكوسين + عتبة

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0

def verify(enroll, test, threshold=0.75):
    return cosine(enroll, test) >= threshold
```

### الخطوة الثالثة: EER من أزواج التشابه

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

العائدات (eer، threshold_at_eer).

### الخطوة الرابعة: إنتاج مع SpeechBrain

```python
from speechbrain.pretrained import EncoderClassifier

clf = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")

# enroll: average the embeddings of 3-5 clean samples
enroll = torch.stack([clf.encode_batch(load(x)) for x in enrollment_clips]).mean(0)
# verify
score = clf.similarity(enroll, clf.encode_batch(load("test.wav"))).item()
verdict = score > 0.25   # ECAPA typical threshold; tune on your data
```

### الخطوة 5: قم بتدوين يومياتك مع بيانوت

```python
from pyannote.audio import Pipeline

pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
diarization = pipe("meeting.wav", num_speakers=None)
for turn, _, speaker in diarization.itertracks(yield_label=True):
    print(f"{turn.start:.1f}–{turn.end:.1f}  {speaker}")
```

## استخدمها

"مجموعة 2026"

| Situation | Pick |
|-----------|------|
| Closed-set 1:1 verification, edge | ECAPA-TDNN + cosine threshold |
| Open-set verification, cloud | WavLM-SV + AS-norm |
| Diarization (meetings, podcasts) | `pyannote/speaker-diarization-3.1` |
| Anti-spoofing (replay / deepfake detection) | AASIST or RawNet2 |
| Tiny embedded (KWS + enrollment) | Titanet-Small (NeMo) |

## الفخاخ

- **Channel mismatch.**نموذج تدرب على VoxCeleb (فيديو الويب) ≠ صوت مكالمة الهاتف. دائما تقييم على القناة المستهدفة.
- **Short utterances.**يحتقر EER بشكل حاد تحت 3 ثوان من الصوت التجريبي.
- **Enrollment with noise.**واحد من المشاركات الضوضاء تسمم المُرسومة. استخدم ≥3 عينات نظيفة ومتوسط.
- **Fixed threshold across conditions.**دائماً ضبط العد على مجموعة من المطورين المحتملين من النطاق المستهدف.
- **Cosine on non-normalized embeddings.**L2 تطبيع أولاً؛ وإلا فإن الحجم يهيمن.

## أرسله

إبقوا`outputs/skill-speaker-verifier.md`- نموذج اختيار، بروتوكول التسجيل، خطة تحديد العدوان، وحماية الاحتيال.

## التمارين

1. **Easy.**أركض`code/main.py`. يُبني "المكبرين" الاصطناعيين (ملفات صوت مختلفة) ، ويتسجل ويحسب EER على قائمة تجريبية من 100 زوج.
2. **Medium.**استخدم SpeechBrain ECAPA على 30 كلمة VoxCeleb1 (كل 5 مكبرات صوت × 6) احسب EER مع cosine مقابل PLDA.
3. **Hard.**بناء التسجيل الكامل → يومي → التحقق من خط الأنابيب مع `pyannote.audio`تقييم DER على جهاز AMI

## الشروط الرئيسية

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

## المزيد من القراءة

- [Snyder et al. (2018). X-Vectors: Robust DNN Embeddings for Speaker Recognition](https://www.danielpovey.com/files/2018_icassp_xvectors.pdf)ورقة عميقة
- [Desplanques et al. (2020). ECAPA-TDNN](https://arxiv.org/abs/2005.07143) الهندسة المعمارية المهيمنة 20202026.
- [Chen et al. (2022). WavLM: Large-Scale Self-Supervised Pre-Training for Full Stack Speech Processing](https://arxiv.org/abs/2110.13900) العمود الفقري SSL لـ SV و يوميّة
- [Bredin et al. (2023). pyannote.audio 3.1](https://github.com/pyannote/pyannote-audio) إعادة التأجيل في الإنتاج + وضع كومة
- [VoxCeleb leaderboard (updated 2026)](https://www.robots.ox.ac.uk/~vgg/data/voxceleb/) تصنيفات EER الحالية على مستوى الطرازات.
