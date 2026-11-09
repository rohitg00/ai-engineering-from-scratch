# صوت مكافحة التزوير والصوت علامة مياه  ASVspoof 5، AudioSeal، WaveVerify

> يتم شحن نسخ الصوت أسرع من الدفاعات. تحتاج أنظمة الصوت الإنتاجية لعام 2026 إلى شيئين: جهاز كشف (AASIST ، RawNet2) الذي يصنف الخطاب الحقيقي مقابل الكلام المزيف ، و علامة مائية (AudioSeal) التي تتعافى من الضغط والتحرير. شحن كل من أو لا شحن نسخ الصوت.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 06 (Speaker Recognition), Phase 6 · 08 (Voice Cloning)
**Time:** ~75 minutes

## المشكلة

ثلاثة دفاعات ذات صلة:

1. **Anti-spoofing / deepfake detection.**نظرا لقطع صوتية ، هل هو مصنوعي أم حقيقي؟ مقارنات ASVspoof (ASVspoof 2019 → 2021 → 5) هي المعيار الذهبي.
2. **Audio watermarking.**إضافة إشارة غير قابلة للاكتشاف في الصوت المولود الذي يمكن أن يستخرجه جهاز كشف لاحقا. AudioSeal (Meta) و WavMark هي الخيارات المفتوحة.
3. **Authenticated provenance.**توقيع رمزي لملفات الصوت + البيانات المعدنية مبادرة C2PA / المحتويات المصداقية.

الكشف يتعامل مع المعارضين الذين لا يتعاونونون. التعامل مع التشابه مع علامات المياه  يجب أن يكون الصوت الذي يولد به الذكاء الاصطناعي قابلا للتعرف على أنه. كلا من ذلك مطلوب في عام 2026.

## المفهوم

![Anti-spoofing vs watermarking vs provenance — three defense layers](../assets/spoofing-watermark.svg)

### ASVspoof 5  مقياس 2024-2025

أكبر تغيير من الإصدارات السابقة:

- **Crowdsourced data**(ليس استوديو نظيف)  الظروف الواقعية.
- **~2000 speakers**(مقابل 100 قبل).
- **32 attack algorithms.**TTS + تحويل الصوت + اضطراب معادلة.
- **Two tracks.**الاكتشاف المستقل للقيام بالعكس (CM) ؛ ASV القوية للتخريب (SASV) للأنظمة البيومترية.

أحدث التطورات على ASVspoof 5: ~ 7.23% EER. على ASVspoof القديمة 2019 LA: 0.42% EER. نشر في العالم الحقيقي: توقع 5-10% EER على المقاطع في البرية.

### أسلوب أسلوب الكشف AASIST و RawNet2 

**AASIST**(2021، تم تحديثه حتى 2026). الاهتمام الرسمي على الخصائص الطيفية. SOTA الحالية على واجب ASVspoof 5 المضادة.

**RawNet2.**المواجهة المتحركة على شكل موجة خام + العمود الفقري TDNN. خط أساسي أبسط؛ لا يزال تنافسيا مع ضبط دقيقة.

**NeXt-TDNN + SSL features.**2025: إيكابا-طراز + ميزات ويفلم + فقدان التركيز. يصل إلى 0.42% EER على ASVspoof 2019 LA.

### AudioSeal  علامة المائية 2024 الافتراضية

الميتا **AudioSeal**(كانون الثاني/ يناير 2024, v0.2 ديسمبر 2024)

- **Localized.**يكتشف علامة المياه لكل إطار عند قرار العينة 16 كيلوهرتز (1/16000 ثانية).
- **Generator + detector jointly trained.**يتعلم المولد إدراج إشارة غير مسموعة، ويتعلم الكاشف العثور عليها من خلال التكثيف.
- **Robust.**ينجو من ضغط MP3 / AAC ، EQ ، وتحويل السرعة ±10٪ ، مزيج الضوضاء + 10 dB SNR.
- **Fast.**الكشف يعمل في 485× في الوقت الحقيقي؛ 1000× أسرع من واف مارك.
- **Capacity.**الحمل المفيد 16-bit (يمكن تشفير معرف النموذج، طابع الوقت التوليد، معرف المستخدم) قابلة للتثبيت في كل تصريح.

### (واف مارك)

"الخط الأساسي المفتوح قبل "آودي سيل شبكة عصبية قابلة للتعديل، 32 بت/ ثانية

- التزامن القوة الخام بطيئة
- يمكن إزالتها بواسطة ضجيج غوسيان أو ضغط MP3.
- ليس صديقاً في الوقت الحقيقي

### "ويف فيريفي" (يوليو 2025)

يُصدى إلى نقاط ضعف أوديوسيل  بشكل خاص للتلاعب بالوقت (العكس، السرعة). يستخدم مولدًا قائمًا على FiLM + كاشف مزيج من الخبراء. تنافس مع أوديوسيل في الهجمات القياسية؛ يتعامل مع التحريرات الزمنية.

### الفجوة التي يستغلونها خصومها

من AudioMarkBench: "في ظل تغيير الصوت، جميع علامات المياه تظهر دقة استعادة البيت أقل من 0.6، مما يشير إلى إزالة شبه كاملة". **Pitch-shift is the universal attack.**علامة المائية رقم 2026 قوية تماماً لتعديل الوصول العنيف. لهذا السبب تحتاج إلى الكشف (AASIST) إلى جانب علامة المائية.

### مبادرة C2PA / مصداقية المحتوى

لا تقنية ML  شكل واضح. الملفات الصوتية تحمل بيانات متفرغة موقعة عن أداة الإنشاء، المؤلف، التاريخ. أودوبوكس / سليم لا تستخدمها. جيد للمصدر؛ لا يفعل شيئا إذا كان لاعب سيء إعادة تشفير وتقطيع البيانات المتفرقة.

```figure
v4-audio-watermark
```

## بناءها

### الخطوة الأولى: جهاز كشف أشكال الطيف بسيط (لعبة)

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

الكلام الاصطناعي غالباً ما يكون لديه طاقة عالية التردد المستقرة بشكل غير عادي. أجهزة الكشف عن الإنتاج تستخدم AASIST، ليس هذا. ولكن الحدس ينطبق.

### الخطوة الثانية: إدراج AudioSeal + اكتشاف

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

### الخطوة الثالثة: التقييم  الإطار الإقليمي

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

### الخطوة الرابعة: تكامل الإنتاج

```python
def safe_tts(text, voice, clone_reference=None):
    if clone_reference is not None:
        verify_consent(user_id, clone_reference)
    audio = tts_model.synthesize(text, voice)
    audio_with_wm = audioseal_embed(audio, payload=build_payload(user_id, model_id))
    manifest = c2pa_sign(audio_with_wm, user_id, timestamp=now())
    return audio_with_wm, manifest
```

كل جيل من السفن: (1) علامة المائية، (2) مذكرة توقيع، (3) سجل مراجعة مطابقة بسياسة الاحتفاظ.

## استخدمها

| Use case | Defense |
|----------|---------|
| Shipping TTS / voice cloning | AudioSeal embed on every output (non-negotiable) |
| Biometric voice unlock | AASIST + ECAPA ensemble; liveness challenge |
| Call-center fraud detection | AASIST on 20% sample of incoming calls |
| Podcast authenticity | C2PA signing on upload, AudioSeal if AI-generated |
| Research / training detectors | ASVspoof 5 train/dev/eval sets |

## الفخاخ

- **Watermark without detector ever running.**لا فائدة من ذلك، أرسلي الكاشف في المعلومات
- **Detection without calibration.**أُدرّبُ (أيسست) على عمليات إعادة التأثير في (لوس أنجلوس) ، وتقليل دقة العالم الحقيقي، وتصفّح على مستوى مجالك.
- **Pitch-shift gap.**تغيير الوضع العنيف يزيل معظم علامات المياه
- **Metadata strip-and-rehost.**C2PA يمكن تجاهلها بشكل بسيط عن طريق إعادة التشفير. دائماً أضف الدفاع الرموزي + التدقيقي (علامات المائية) معاً.
- **Liveness as detection.**اطلب من المستخدم قول عبارة عشوائية، يمنع هجمات التكرار ولكن لا التنسيق في الوقت الحقيقي.

## أرسله

إبقوا`outputs/skill-spoof-defender.md`. اختر نموذج الكشف ، علامة مياه ، دليل المأصل ، و دليل تشغيل لتشغيل الجين الصوتي.

## التمارين

1. **Easy.**أركض`code/main.py`. جهاز كشف الألعاب + علامة مياه للاعب تضمين/كشف على الصوت الاصطناعي.
2. **Medium.**إثباط`audioseal`، تضمين حمولة مفيدة 16 بت في خروج TTS، إعادة تشكيل، تفسد الصوت مع الضوضاء وتقييم دقة استرداد البيت.
3. **Hard.**ضبط RAWNet2 أو AASIST على ASVspoof 2019 LA. قياس EER. اختبار على مجموعة متواصلة من المقاطع التي تم إنشاؤها من F5-TTS  انظر كيف يتدهور الكشف عن OOD.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| ASVspoof | The benchmark | Biennial challenge; 2024 = ASVspoof 5. |
| CM (countermeasure) | Detector | Classifier: real speech vs synthetic / converted. |
| SASV | Speaker verif + CM | Integrated biometric + spoof detection. |
| AudioSeal | Meta watermark | Localized, 16-bit payload, 485× faster than WavMark. |
| Bit Recovery Accuracy | Watermark survival | Fraction of payload bits recovered after attack. |
| C2PA | Provenance manifest | Cryptographic metadata about creation / authorship. |
| AASIST | Detector family | Graph-attention-based anti-spoofing SOTA. |

## المزيد من القراءة

- [Todisco et al. (2024). ASVspoof 5](https://dl.acm.org/doi/10.1016/j.csl.2025.101825) المعيار المرجعي الحالي.
- [Defossez et al. (2024). AudioSeal](https://arxiv.org/abs/2401.17264) علامة المياه الافتراضية.
- [Chen et al. (2025). WaveVerify](https://arxiv.org/abs/2507.21150)جهاز كشف الجهاز المتحرك للهجمات الزمنية
- [Jung et al. (2022). AASIST](https://arxiv.org/abs/2110.01200)العمود الفقري للكشف عن SOTA
- [AudioMarkBench (2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/5d9b7775296a641a1913ab6b4425d5e8-Paper-Datasets_and_Benchmarks_Track.pdf) تقييم الصمود
- [C2PA specification](https://spec.c2pa.org/specifications/specifications/2.4/index.html) صيغة بيان المصلحة.
