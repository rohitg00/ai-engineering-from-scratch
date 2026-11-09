# اكتشاف نشاط الصوت وتحويل الدوام  سيلرو وكوبرا وخدعة الفلاش

> كل وكيل صوتي يعيش أو يموت على قرارين: هل يتحدث المستخدم الآن، وهل انتهوا؟ VAD يجيب على الأول. تحديد التحول (VAD + صمت-توقف + نموذج نقطة نهاية معنوية) يجيب على الثاني. إما أن تكون خاطئة ومساعدك إما يقطع المستخدمين أو لا يخرس أبدا.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 11 (Real-Time Audio), Phase 6 · 12 (Voice Assistant)
**Time:** ~45 minutes

## المشكلة

ثلاثة قرارات مختلفة يقوم بها وكيل الصوت على كل 20 ميس:

1. **Is this frame speech?**-فاد، ثنائي، لكل إطار
2. **Has the user started a new utterance?** اكتشاف بداية
3. **Has the user finished?** الإشارة النهائية (التحول النهائي).

الجواب البديهي (عتبة الطاقة) يفشل في أي ضجيج  حركة المرور، لوحة المفاتيح، حركة الجمهور. الجواب 2026: Silero VAD (فتح، متعلم بعمق) + نموذج الكشف عن التحول (التوجيه النهائي المفروض) + صمت مؤقّن VAD.

## المفهوم

![VAD cascade: energy → Silero → turn-detector → flush trick](../assets/vad-turn-taking.svg)

### الصفوف الثلاثية للـ VAD

**Tier 1: energy gate.**أرخص، حد RMS عند -40 dBFS، يُصفّر الصمت الواضح، لكنه يُطلق النار على أي ضجيج فوق العد.

**Tier 2: Silero VAD**(2020-2026 ، MIT). 1M المعلمات. تدرب على 6000+ لغة. يعمل في ~ 1 ms لكل 30 ms قطعة على خيط واحد من CPU. 87.7% TPR عند 5% FPR. افتراضية المصدر المفتوح.

**Tier 3: semantic turn detector.**نموذج لويف كيت للكشف عن التحول (2024-2026) أو تصنيفك الصغير الخاص. يفرق بين "وقف في منتصف الجملة" و "تحدثاً قد تم". يستخدم السياق اللغوي (التعبير + الكلمات الأخيرة) ، وليس مجرد الصمت.

### المعلمات الرئيسية وتعديلاتها

- **Threshold.**سيلرو يخرج احتمالًا؛ تصنيف الخطاب عند &gt; 0.5 (الديفالت) أو &gt; 0.3 (الحساسة). العد الأدنى = أقل مقاطع الكلمة الأولى ، المزيد من الإيجابيات الكاذبة.
- **Minimum speech duration.**رفض الكلام أقصر من 250 ms  عادة السعال أو ضجيج الكرسي.
- **Silence hangover (end-pointing).**بعد عودة VAD إلى 0، انتظر 500-800 ms قبل الإعلان عن نهاية التحول. قصيرة جدا → توقف المستخدم. طويل جدا → يشعر بطيئة.
- **Pre-roll buffer.**حافظ على 300-500 ملم من الصوت قبل أن يطلق VAD. يمنع "هي" من التقطيع.

### خدعة التسرب (كيوتاي 2025)

نموذجات STT التدفقية لديها تأخير النظر إلى الأمام (500 ms لـ Kyutai STT-1B، 2.5 ثانية لـ STT-2.6B). عادة كنت تنتظر ذلك الوقت بعد نهاية الخطاب لنسخة. خدعة التدفق: عندما يقوم VAD بإطلاق نهاية الخطاب،**send a flush signal to the STT**وذلك يفرض الخروج الفوري. تقوم عمليات STT بـ 4 × في الوقت الحقيقي، لذا فإن 500 ms البفر ينتهي في ~ 125 ms.

نهاية إلى نهاية: 125 ms VAD + flush STT = تأخير المحادثة.

### 2026 مقارنة VAD

| VAD | TPR @ 5% FPR | Latency | License |
|-----|--------------|---------|---------|
| WebRTC VAD (Google, 2013) | 50.0% | 30 ms | BSD |
| Silero VAD (2020-2026) | 87.7% | ~1 ms | MIT |
| Cobra VAD (Picovoice) | 98.9% | ~1 ms | commercial |
| pyannote segmentation | 95% | ~10 ms | MIT-ish |

سيلرو هو الاختيار الاختياري الصحيح. كوبرا هو الامتثال / تحديث الدقة. فقط الطاقة VAD ليس لها مكان في 2026 الإنتاج.

```figure
sp-vad-cascade
```

## بناءها

### الخطوة الأولى: بوابة الطاقة

```python
def energy_vad(chunk, threshold_dbfs=-40.0):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    dbfs = 20.0 * math.log10(max(rms, 1e-10))
    return dbfs > threshold_dbfs
```

### الخطوة الثانية: Silero VAD في Python

```python
from silero_vad import load_silero_vad, get_speech_timestamps

vad = load_silero_vad()
audio = torch.tensor(waveform_16k, dtype=torch.float32)
segments = get_speech_timestamps(
    audio, vad, sampling_rate=16000,
    threshold=0.5,
    min_speech_duration_ms=250,
    min_silence_duration_ms=500,
    speech_pad_ms=300,
)
for s in segments:
    print(f"{s['start']/16000:.2f}s - {s['end']/16000:.2f}s")
```

### الخطوة الثالثة: آلة الحالة التحولية

```python
class TurnDetector:
    def __init__(self, silence_hangover_ms=500, min_speech_ms=250):
        self.state = "idle"
        self.speech_ms = 0
        self.silence_ms = 0
        self.silence_hangover_ms = silence_hangover_ms
        self.min_speech_ms = min_speech_ms

    def update(self, is_speech, chunk_ms=20):
        if is_speech:
            self.speech_ms += chunk_ms
            self.silence_ms = 0
            if self.state == "idle" and self.speech_ms >= self.min_speech_ms:
                self.state = "speaking"
                return "START"
        else:
            self.silence_ms += chunk_ms
            if self.state == "speaking" and self.silence_ms >= self.silence_hangover_ms:
                self.state = "idle"
                self.speech_ms = 0
                return "END"
        return None
```

### الخطوة الرابعة: هيكل الحيلة

```python
def flush_on_end(stt_client, audio_buffer):
    stt_client.send_audio(audio_buffer)
    stt_client.send_flush()
    return stt_client.recv_transcript(timeout_ms=150)
```

يجب على STT (Kyutai ، Deepgram ، AssemblyAI) دعم الشاشة لكي يعمل هذا. لا يقوم التسريب الهزئ بـ  إنه مقاعد على الكتل وينتظر دائمًا قطعًا.

## استخدمها

| Situation | VAD choice |
|-----------|-----------|
| Open, fast, general | Silero VAD |
| Commercial call center | Cobra VAD |
| On-device (phone) | Silero VAD ONNX |
| Research / diarization | pyannote segmentation |
| Zero-dependency fallback | WebRTC VAD (legacy) |
| Need turn-ending quality | Silero + LiveKit turn-detector layered |

قاعدة عامة: لا ترسل أبداً VAD الطاقة فقط إلا إذا لم يكن لديك خيار آخر

## الفخاخ

- **Fixed threshold.**يعمل في الهدوء، يفشل في الضوضاء إما أن يُعدل على الجهاز أو أن يُحول إلى "سيلرو".
- **Too-short silence hangover.**الوكيل يقاطع منتصف الجملة 500-800 ميس هو المكان المفضل للخطاب المحادث
- **Too-long hangover.**يبدو بطيئًا اختبار A/B مع المستخدمين المستهدفين
- **No pre-roll buffer.**أول 200-300 ملم من صوت المستخدم ضائع دائماً حافظ على التدفق قبل التدفق
- **Ignoring semantic endpointing.**"دعني أفكر" تحتوي على توقفات طويلة المستخدمون يكرهون أن يقطعوا في منتصف التفكير

## أرسله

إبقوا`outputs/skill-vad-tuner.md`اختر نموذج VAD، العدالة، الخمر، قبل التدفق، واستراتيجية الكشف عن التحول لحمل العمل.

## التمارين

1. **Easy.**أركض`code/main.py`يحتاكي تسلسل الكلام + الصمت + الكلام + السعال ويحاول ثلاثة مستويات من VAD.
2. **Medium.**إثباط`silero-vad`، معالجة تسجيل لمدة 5 دقائق، ضبط عتبة لتقليل كل من المقاطع الكلمة الأولى والتحفيزات الكاذبة.
3. **Hard.**قم ببناء جهاز كشف التحول الصغير: Silero VAD + 3 طبقات MLP على إدخال الكلمات الـ 10 الأخيرة (استخدم محولات الجملة). قم بتدريب مجموعة بيانات التحول المُشيرة يدوياً. هزيمة Silero فقط بنسبة 10% F1.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| VAD | Voice detector | Binary per-frame: is this speech? |
| Turn detection | End-pointing | VAD + silence-hangover + semantic endpoint. |
| Silence hangover | Wait-after-speech | Time to wait before declaring turn end; 500-800 ms. |
| Pre-roll | Pre-speech buffer | Keep 300-500 ms audio before VAD fires. |
| Flush trick | Kyutai hack | VAD → flush-STT → 125 ms instead of 500 ms delay. |
| Semantic endpoint | "Did they mean to stop?" | ML classifier that looks at words, not just silence. |
| TPR @ FPR 5% | ROC point | Standard VAD benchmark; 87.7% for Silero, 50% WebRTC. |

## المزيد من القراءة

- [Silero VAD](https://github.com/snakers4/silero-vad) إفتتاح المرجعية VAD.
- [Picovoice Cobra VAD](https://picovoice.ai/products/voice/voice-activity-detection/) قائد الدقة التجارية.
- [Kyutai — Unmute + flush trick](https://kyutai.org/stt)خدعة الهندسة تحت 200 م.
- [LiveKit — turn detection](https://docs.livekit.io/agents/logic/turns/) التوصل إلى نهاية تعريفية في الإنتاج.
- [WebRTC VAD](https://webrtc.googlesource.com/src/) خط أساسي المتكرر
- [pyannote segmentation](https://github.com/pyannote/pyannote-audio) التقسيم على مستوى التسجيل.
