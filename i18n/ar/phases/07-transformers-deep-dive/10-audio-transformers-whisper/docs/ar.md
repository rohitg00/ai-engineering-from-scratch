# محولات الصوت  هيكل التهوس

> الصوت هو صورة من التردد مع مرور الوقت و التهمس هو جهاز ViT الذي يأكل الطيفيات الميل و يتحدث مرة أخرى

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 08 (Encoder-Decoder), Phase 7 · 09 (ViT)
**Time:** ~45 minutes

## المشكلة

قبل Whisper (OpenAI ، Radford وآخرون 2022) ، كان التعرف الآلي على الكلام (ASR) المتطور يعني wav2vec 2.0 و HuBERT  استخرجات الميزات ذاتية الإشراف بالإضافة إلى رأس محسن. خطوط البيانات عالية الجودة والكلفة ، ودونة هشة. كان التعرف على الكلام متعدد اللغات يحتاج إلى نماذج منفصلة لكل عائلة لغة.

ويشبر) قام بثلاث رهانات)

1. **Train on everything.**680,000 ساعة من الصوت الضعيف اللقب من الانترنت عبر 97 لغة لا وجود للكتابة الأكاديمية نظيفة لا وجود لقب صوتي
2. **Multi-task single model.**أحد المقررين تدرب بشكل مشترك على النسخة والترجمة وكشف النشاط الصوتي و معرف اللغة و خيارات الزمنية من خلال رموز المهام.
3. **Standard encoder-decoder transformer.**المُشفّر يستهلك طيفيات الملفات المُطبقة. المُشفّر ينتج رموز النص بشكلٍ متسلّط. لا يوجد مُشفّر صوتي، لا يوجد CTC، لا يوجد HMM.

النتيجة: Whisper large-v3 قوية عبر الاهتزازات والضوضاء واللغات التي لديها بيانات خالية من العلامات. إنها نهاية الخطاب الأمامية الافتراضية لكل مساعد صوت مفتوح المصدر وأكثر التجارية في عام 2026.

## المفهوم

![Whisper pipeline: audio → mel → encoder → decoder → text](../assets/whisper.svg)

### الخطوة 1  إعادة العينة + النافذة

الصوت عند 16 kHz. كليب / بورد إلى 30 ثانية. حساب لوج ميل: 80 مل بينز، 10 ms خطوة → ~ 3000 إطار × 80 ميزات. هذه هي "صورة المدخل" التي يرى وسبر.

### الخطوة 2  جذع التخويف

طبقتين من Conv1D مع النواة 3 والخطوة 2 تقلل من 3000 إطار إلى 1500. تقلل طول التسلسل دون إضافة الكثير من المعلمات.

### الخطوة 3  مُشفّر

مُخترف محول 24 طبقة (للكبار) على مدار 1500 خطوة زمنية. تشفير الموقف السينوسويدي، الاهتمام الذاتي، GELU FFN. ينتج 1500 × 1,280 حالة مخفية.

### الخطوة 4  المفكّر

جهاز تشخيص تحويلات 24 طبقة. ينتج بشكل مستقل رموز من مخزون كلمات BPE الذي هو مجموعة كبيرة من GPT-2 مع عدد قليل من رموز خاصة الصوت.

### الخطوة 5  رموز المهمة

يبدأ عرض المفكّر بـ "الرموز" التي تخبر النموذج بما يجب فعله:

```
<|startoftranscript|>  <|en|>  <|transcribe|>  <|0.00|>
```

أو

```
<|startoftranscript|>  <|fr|>  <|translate|>   <|0.00|>
```

تم تدريب النموذج على هذه الاتفاقية، يمكنك التحكم في المهمة بواسطة المُسجلات، ما يعادلها بتنسيق التعليمات في عام 2026، ولكن يتم تطبيقها على الكلام.

### الخطوة 6  الخروج

البحث عن الشعاع (الربع 5) مع عتبة التسجيل. يتم التنبؤ بخطات الوقت كل 0.02 ثانية من الصوت عندما `<|notimestamps|>`الـ (توكين) غائب

### أحجام التهوس

| Model | Params | Layers | d_model | Heads | VRAM (fp16) |
|-------|--------|--------|---------|-------|-------------|
| Tiny | 39M | 4 | 384 | 6 | ~1 GB |
| Base | 74M | 6 | 512 | 8 | ~1 GB |
| Small | 244M | 12 | 768 | 12 | ~2 GB |
| Medium | 769M | 24 | 1024 | 16 | ~5 GB |
| Large | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3 | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3-turbo | 809M | 32 | 1280 | 20 | ~6 GB (4-layer decoder) |

خفض Large-v3-turbo (2024) المفكّر من 32 طبقة إلى 4.8 × أسرع في التشخيص مع تراجع نقطة WER <1. هذا التشخيص بسرعة إفراز هو السبب في أن Whisper-turbo هو الافتراض لأجهزة الصوت في الوقت الحقيقي في عام 2026.

### ما لا يفعله " السمس "

- لا يوجد مذكرات (من يتحدث) ، إزواج مع (بيانوت) لهذا
- لا توجد تسجيلات في الوقت الحقيقي بشكل أصلي  نافذة 30 ثانية ثابتة.`faster-whisper`،`WhisperX`) التدفق على التدفق عبر التداخلات الفاد +.
- لا توجد سياقات طويلة الأطوال بعد 30 ثانية دون تكسير خارجي. يعمل بشكل جيد في الممارسة لأن الكلام البشري نادرا ما يحتاج إلى سياقات طويلة الأطول لترانسكيب.

### 2026 المشهد

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

## بناءها

انظر`code/main.py`نحن لا نعمل على تدريب "سيسبر" نحن نبني خط الأنابيب لـ "لوج ميل" + "مصمم عرض مهمة" هذه هي الأجزاء التي تلمسها في الواقع في الإنتاج

### الخطوة الأولى: قم بتجميع الصوت

إنتاج موجة سينوسية ثانية واحدة عند 440 هرتز عينة عند 16 كيلوهرتز 16000 عينة

### الخطوة الثانية: طيف المعلومات (بإسهولة)

الطيف المكمل الكامل يحتاج إلى FFT. نحن نفعل إطار مبسط + إصدار طاقة لكل إطار الذي يظهر خط الأنابيب دون الحاجة `librosa`:

```python
def frame_signal(x, frame_size=400, hop=160):
    frames = []
    for start in range(0, len(x) - frame_size + 1, hop):
        frames.append(x[start:start + frame_size])
    return frames
```

الإطار = 25 ms، هوب = 10 ms. يطابق نافذة فيسبر. طاقة لكل إطار تعوض عن حاويات الميل للتدريس.

### الخطوة الثالثة: إصلاح إلى 30 ثانية

ويشير دائماً إلى قطع 30 ثانية، ويقوم بتصوير الطيف إلى 3000 إطار

### الخطوة الرابعة: قم بإنشاء الرموز الإستعارة

```python
def whisper_prompt(lang="en", task="transcribe", timestamps=True):
    tokens = ["<|startoftranscript|>", f"<|{lang}|>", f"<|{task}|>"]
    if not timestamps:
        tokens.append("<|notimestamps|>")
    return tokens
```

هذه هي سطح التحكم بأكمله، إضافة 4 رموز

## استخدمها

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("meeting.wav", language="en", task="transcribe")
print(result["text"])
print(result["segments"][0]["start"], result["segments"][0]["end"])
```

أسرع، متوافقة مع OpenAI:

```python
from faster_whisper import WhisperModel
model = WhisperModel("large-v3-turbo", compute_type="int8_float16")
segments, info = model.transcribe("meeting.wav", vad_filter=True)
for s in segments:
    print(f"{s.start:.2f} - {s.end:.2f}: {s.text}")
```

**When to pick Whisper in 2026:**

- ASR متعددة اللغات مع نموذج واحد.
- نسخة قوية من الصوت الضوضاء المتنوعة
- البحث / النموذج الأول ASR  نقطة البداية الأسرع.

**When to pick something else:**

- التدفقات المتأخرة للغاية على الحافة  Moonshine تفوق Whisper بمعدل متطابق.
- الذكاء الاصطناعي المحادثات في الوقت الحقيقي يحتاج <200 ms  التدفق المخصص ASR.
- الساعين يوميّة  السّمّة لا تفعل هذا؛ المقبّل على المُخطط.

## أرسله

انظر`outputs/skill-asr-configurator.md`. المهارة تختار نموذج ASR، وفرص فك الشفرة، وخط الأنابيب التدريب المسبق لتطبيق حديث جديد.

## التمارين

1. **Easy.**أركض`code/main.py`تأكيد عدد الإطار لترقية ثانية واحدة عند 16 كيلوهرتز مع 10 ميس هوب هو ~ 100 إطار. لمدة 30 ثانية: ~ 3000 إطار.
2. **Medium.**قم ببناء الطيف الكامل من خلال استخدام `numpy.fft`. تأكد من مطابقة 80 مل بين`librosa.feature.melspectrogram(n_mels=80)`في غضون الخطأ الرقمي
3. **Hard.**تنفيذ استنتاجات التدفق: قطع صوتية في نافذة 10 ثانية مع تداخل 2 ثانية، تشغيل Whisper على كل قطعة، دمج النصوص. قياس معدل خطأ الكلمة مقابل مرور واحد على عينة البودكاست لمدة 5 دقائق.

## الشروط الرئيسية

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

## المزيد من القراءة

- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356)-حسابات الورق
- [OpenAI Whisper repo](https://github.com/openai/whisper) رمز المرجعية + أوزان النموذج. اقرأ `whisper/model.py`لرى جذع Conv1D + مرموز + مرموز من أعلى إلى أسفل في ~ 400 سطر.
- [OpenAI Whisper — `whisper/decoding.py`](https://github.com/openai/whisper/blob/main/whisper/decoding.py) منطق البحث عن الشعاع + رمز المهمة الموصوف في الخطوات 56 هنا ؛ 500 سطر ، قابلة للقراءة بالكامل.
- [Baevski et al. (2020). wav2vec 2.0: A Framework for Self-Supervised Learning of Speech Representations](https://arxiv.org/abs/2006.11477) مقدم؛ لا يزال SOTA ميزات في بعض الإعدادات.
- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper)غلاف الإنتاج، أسرع 4x من المرجعية.
- [Jia et al. (2024). Moonshine: Speech Recognition for Live Transcription and Voice Commands](https://arxiv.org/abs/2410.15608) 2024 ASR صديقة للحافة، شكلها مثل الصمغ ولكن أصغر.
- [HuggingFace blog — "Fine-Tune Whisper For Multilingual ASR with 🤗 Transformers"](https://huggingface.co/blog/fine-tune-whisper) وصفة تحسينات القنوني بما في ذلك معالجة المقبلات من طراز الميل و معالجة علامات الزمنية.
- [HuggingFace `modeling_whisper.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/whisper/modeling_whisper.py) تنفيذ كامل (مُرمّد، مُرمّد، إلتحاق بالاهتمام المتبادل، توليد) الذي يعكس رسمية هندسة الدروس.
