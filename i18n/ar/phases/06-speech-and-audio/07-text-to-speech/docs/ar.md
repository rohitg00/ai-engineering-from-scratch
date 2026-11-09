# النص إلى الكلام (TTS)  من تاكوترون إلى F5 وكوكورو

> تحويل ASR من الكلام إلى النص؛ تحويل TTS من النص إلى الكلام. تتكون كومة 2026 من ثلاثة أجزاء: نص → رموز، رموز → mel، mel → شكل موجة. لكل جزء نموذج افتراضي يناسب في جهاز كمبيوتر محمول.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 09 (Seq2Seq), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## المشكلة

لديك سلسلة: "رجاءً تذكرني بتسقيط النباتات في الساعة 6 مساءً". تحتاج إلى مقطع صوتي لمدة 3 ثوانٍ يبدو طبيعياً، ويكون له مزودية صحيحة (توقفات، ضغط) ، ويقول "النباتات" بالصوت الصحيح، ويتم تشغيله في أقل من 300 ms على جهاز المعالجة المركزية لمساعد صوت مباشر. تحتاج أيضًا إلى تبادل الأصوات، ومعالجة المدخلات المتحولة بالرمز ("تذكري بي في الساعة 6 مساءً، دايجوبو؟") ، وعدم إحراج نفسك من الأسماء.

خطوط الأنابيب الحديثة لـ TTS تبدو هكذا:

1. **Text frontend.**عادي النص (تاريخ، أرقام، رسائل البريد الإلكتروني) ، وتحويل إلى أسم أو رموز الكلمات الفرعية، وتنبؤ ميزات البروزودي.
2. **Acoustic model.**النص → الطيف الميل. Tacotron 2 (2017) ، FastSpeech 2 (2020) ، VITS (2021) ، F5-TTS (2024) ، كوكورو (2024).
3. **Vocoder.**الميل → شكل الموجة. WaveNet (2016) ، WaveRNN ، HiFi-GAN (2020) ، BigVGAN (2022) ، مدبرات المودع العصبي في 2024 +.

في عام 2026، يزول الجهاز الصوتي + الصوتي مع نموذجات التوزيع من النهاية إلى النهاية ومطابقة التدفق. ولكن النموذج العقلي من ثلاثة أجزاء لا يزال يحمل التحليل.

## المفهوم

![Tacotron, FastSpeech, VITS, F5/Kokoro side-by-side](../assets/tts.svg)

**Tacotron 2 (2017).**Seq2seq: إضافة الرقائق → مرموز BiLSTM → اهتمام حساس للموقع → مرموز LSTM autoregressive ينبعث إطارات mel. بطيئة (AR) ، متذبذبة على النص الطويل. لا يزال يُشار إليه كخط أساسي.

**FastSpeech 2 (2020).**غير متراجعة. تنبؤ المدة يخرج عدد الإطارات الميل كل صوتي يحصل. 1 مرور، 10 × أسرع من تاكوترون. يفقد بعض الطبيعية (التواءي المتوحد) ولكن السفن في كل مكان.

**VITS (2021).**تدرب المشاركة المشاركة المشاركة في إكودر + مدة القياس القائمة على التدفق + موجهة صوتية HiFi-GAN من نهاية إلى نهاية مع استنتاج التباين. عالية الجودة، نموذج واحد. TTS مفتوح المصدر المهيمن 20222024.

**F5-TTS (2024).**محول التخريب على مطابقة التدفق. البروسودي الطبيعية، استنساخ الصوت الصوتي مع 5 ثوان من الصوت المرجعي. أعلى قائمة التسويق المفتوحة 2026.

**Kokoro (2024).**صغير (82M) ، قابل لإدارة المعالجة المركزية ، أفضل TTS الإنجليزية في الفصل لاستخدامها في الوقت الحقيقي.

**OpenAI TTS-1-HD, ElevenLabs v2.5, Google Chirp-3.**حالة التجارة من الفن. علامات العاطفة "[تهمس]" و "[ضحك]" في ElevenLabs v2.5 وصوت الشخصيات تهيمن على إنتاج الكتب السمعية في عام 2026.

### تطور المستخدمين

| Era | Vocoder | Latency | Quality |
|-----|---------|---------|---------|
| 2016 | WaveNet | offline only | SOTA at release |
| 2018 | WaveRNN | ~realtime | good |
| 2020 | HiFi-GAN | 100× realtime | near-human |
| 2022 | BigVGAN | 50× realtime | generalizes across speakers/langs |
| 2024 | SNAC, DAC (neural codecs) | integrated with AR models | discrete tokens, bit-efficient |

بحلول عام 2026 تكون معظم نماذج "تتس" من نهاية إلى نهاية من النص إلى شكل موجة؛ فإن طيف الميل هو تمثيل داخلي.

### التقييم

- **MOS (Mean Opinion Score).**مقياس 1 5، من مصادر جماعية، لا يزال معيار الذهب، بطيء بشكل مؤلم.
- **CMOS (Comparative MOS).**تفضيل A مقابل B فترات ثقة أقصى لكل ملاحظة
- **UTMOS, DNSMOS.**متنبؤات العصبية المجانية المجانية المستخدمة في قائمة الدرجات
- **CER (Character Error Rate) via ASR.**أطلق إصدار TTS عبر "سيسبر" و أحسب "سي آر إيه" ضد النص المدخل
- **SECS (Speaker Embedding Cosine Similarity).**جودة تخصيص الصوت

أرقام 2026 على اختبار LibriTTS:

| Model | UTMOS | CER (via Whisper) | Size |
|-------|-------|-------------------|------|
| Ground truth | 4.08 | 1.2% | — |
| F5-TTS | 3.95 | 2.1% | 335M |
| XTTS v2 | 3.81 | 3.5% | 470M |
| VITS | 3.62 | 3.1% | 25M |
| Kokoro v0.19 | 3.87 | 1.8% | 82M |
| Parler-TTS Large | 3.76 | 2.8% | 2.3B |

```figure
sp-tts-stack
```

## بناءها

### الخطوة 1: إضافة صوتية

```python
from phonemizer import phonemize
ph = phonemize("Hello world", language="en-us", backend="espeak")
# 'həloʊ wɜːld'
```

الفونيمات هي الجسر العالمي تجنب إطعام النص الخام لأي شيء أقل من جودة مستوى VITS.

### الخطوة 2: تشغيل Kokoro (2026 CPU افتراضي)

```python
from kokoro import KPipeline
tts = KPipeline(lang_code="a")  # "a" = American English
audio, sr = tts("Please remind me to water the plants at 6 pm.", voice="af_bella")
# audio: float32 tensor, sr=24000
```

يعمل خارج الاتصال، ملف واحد، 82M المعلمات.

### الخطوة 3: تشغيل F5-TTS مع استنساخ الصوت

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="my_voice_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please remind me to water the plants.",
)
```

إضافة شريط مرجع لمدة 5 ثوانٍ + نسخته، F5 ينسخ البروسودي والنغمة.

### الخطوة الرابعة: الجهاز الصوتي الـ HiFi-GAN من الصفر

ضخم جداً للاستقرار في نص التعليمات، لكن الشكل هو:

```python
class HiFiGAN(nn.Module):
    def __init__(self, mel_channels=80, upsample_rates=[8, 8, 2, 2]):
        super().__init__()
        # 4 upsample blocks, total 256x to go from mel-rate to audio-rate
        ...
    def forward(self, mel):
        return self.blocks(mel)  # -> waveform
```

التدريب: معارضة (تمييز على نوافذ قصيرة) + فقدان إعادة بناء الطيف الميل + فقدان مطابقة الميزات.`hifi-gan`(ريبو) أو (نفيديا-نيمو)

### الخطوة 5: خط الأنابيب الكامل (مخطط زائف)

```python
text = "Please remind me at 6 pm."
phones = phonemize(text)
mel = acoustic_model(phones, speaker=alice)      # [T, 80]
wav = vocoder(mel)                                # [T * 256]
soundfile.write("out.wav", wav, 24000)
```

## استخدمها

"مجموعة 2026"

| Situation | Pick |
|-----------|------|
| Real-time English voice assistant | Kokoro (CPU) or XTTS v2 (GPU) |
| Voice cloning from 5 s reference | F5-TTS |
| Commercial character voices | ElevenLabs v2.5 |
| Audiobook narration | ElevenLabs v2.5 or XTTS v2 + fine-tune |
| Low-resource language | Train VITS on 5–20 h target-lang data |
| Expressive / emotion tags | ElevenLabs v2.5 or StyleTTS 2 fine-tune |

قائد المصدر المفتوح اعتبارا من 2026: **F5-TTS for quality, Kokoro for efficiency**لا تتصل بـ (تاكوترون) إلا إذا كنت مؤرخًا

## الفخاخ

- **No text normalizer.**"دكتور سميث" يقرأ "دكتور" أو "درايك"؟ "2026" "عشرون و ستة" أو "ثنان صفر اثنان ستة"؟
- **OOV proper nouns.**"غومار" → "غيو-ماير"؟ أرسل نموذج غرافيم إلى فونيم للرموز غير معروفة.
- **Clipping.**إنتاج الصوت نادرا ما يرتفع، ولكن عدم توافق مقياس الميل عند الاستنتاج يمكن أن يتجاوز ±1.0.`np.clip(wav, -1, 1)`. . .
- **Sample-rate mismatch.**كوكورو يخرج 24 كيلوهرتز؛ خط الأنابيب الخاص بك أسفل التيار يتوقع 16 كيلوهرتز → إعادة العينة أو الحصول على الاسم الأليف.

## أرسله

إبقوا`outputs/skill-tts-designer.md`تصميم خط أنابيب TTS لمستهدف صوت معين، ومدة تأخير، و لغة.

## التمارين

1. **Easy.**أركض`code/main.py`يُبني قاموس صوتي من لغة ألعاب، ويحسب مدة كل صوتي، ويقوم بطبع جدول "ميل" مزيف.
2. **Medium.**إضافة كوكورو، وتجميع نفس الجملة في الصوت`af_bella`و`am_adam`- مقارنة مدة الصوت والجودة الذاتية
3. **Hard.**سجل شريط مرجعي لمدة 5 ثواني من نفسك، استخدم F5-TTS لتقليده، وبلغ SECS بين المرجع والإخراج المستنسخ.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Phoneme | Sound unit | Abstract sound class; 39 in English (ARPABet). |
| Duration predictor | How long each phoneme lasts | Non-AR model output; integer frames per phoneme. |
| Vocoder | Mel → waveform | Neural net mapping mel-spec to raw samples. |
| HiFi-GAN | Standard vocoder | GAN-based; dominant 2020–2024. |
| MOS | Subjective quality | 1–5 mean opinion score from human raters. |
| SECS | Voice-clone metric | Cosine similarity between target and output speaker embedding. |
| F5-TTS | 2024 open-source SOTA | Flow-matching diffusion; zero-shot cloning. |
| Kokoro | CPU English leader | 82M-param model, Apache 2.0. |

## المزيد من القراءة

- [Shen et al. (2017). Tacotron 2](https://arxiv.org/abs/1712.05884) خط أساسي
- [Kim, Kong, Son (2021). VITS](https://arxiv.org/abs/2106.06103) على أساس التدفق من نهاية إلى نهاية.
- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) SOTA المفتوحة الموارد الحالية.
- [Kong, Kim, Bae (2020). HiFi-GAN](https://arxiv.org/abs/2010.05646)-المُصطلح الذي لا يزال يُُرسل في عام 2026
- [Kokoro-82M on HuggingFace](https://huggingface.co/hexgrad/Kokoro-82M) 2024 TTS الإنجليزية صديقة للمعالج.
