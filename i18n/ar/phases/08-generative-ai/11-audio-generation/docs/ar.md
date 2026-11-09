# إنتاج الصوت

> الصوت هو إشارة 1-D عند 16-48 كيلوهرتز. كليب خمس ثواني يبلغ 80-240 كيلوهرتز. لا يوجد محول يتابع هذا التسلسل مباشرة. الحل لكل نموذج صوتي إنتاج في 2026 هو نفسه: كوديك عصبي (Encodec، SoundStream، DAC) يضغط الصوت إلى رموز منفصلة عند 50-75 هرتز، ونموذج محول أو انتشار يولد رموز.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Audio Features), Phase 6 · 04 (ASR), Phase 8 · 06 (DDPM)
**Time:** ~45 minutes

## المشكلة

ثلاثة مهام توليد الصوت:

1. **Text-to-speech.**في إطار النص، قم بتوليد الكلام. الكلام النقي هو ذو النطاق الضيق ويتمتع بهيكل صوتي قوي  يتم حلها بشكل جيد بواسطة محولات الجيول. VALL-E (مايكروسوفت) ، NaturalSpeech 3 ، ElevenLabs ، OpenAI TTS.
2. **Music generation.**إعطاء الإرشاد (نص، الميلودة، تقدم الأوراق، النوع) ، إنتاج الموسيقى. توزيع أوسع بكثير. MusicGen (Meta) ، سيبل أوديو 2.5، سونو v4، أوديو، ريفوزيون.
3. **Audio effects / sound design.**عند الإشارة، قم بتصنيع صوت محيط أو فولي.

كل ثلاثة يعملون على نفس الأساس: codec الصوت العصبي + رمز-AR أو مولد التوزيع.

## المفهوم

![Audio generation: codec tokens + transformer or diffusion](../assets/audio-generation.svg)

### كوديكات الصوت العصبي

إنكودك (ميتا، 2022) ، SoundStream (غوغل، 2021) ، Descript Audio Codec (داك، 2023). يقوم مرموزة مغلقة بتقليص شكل الموجة إلى متجه لكل خطوة زمنية؛ يقوم تقليص المتجهات المتبقية (RVQ) بتحويل كل متجه إلى سلسلة من مؤشرات K الكودبوك. يقوم مرموزة بتعديلها. يستخدم 24 كيلوغرتز الصوت عند 2 كيبس باستخدام 8 كودبوك RVQ عند 75 هرتز = 600 رمز / ثانية.

```
waveform (16000 samples/sec)
    └─ encoder conv ─┐
                     ├─ RVQ layer 1 → indices at 75 Hz
                     ├─ RVQ layer 2 → indices at 75 Hz
                     ├─ ...
                     └─ RVQ layer 8
```

### نموذجين مولدين فوق

**Token-autoregressive.**تسطح رموز RVQ إلى تسلسل ، تشغيل محول مقطع فقط. يستخدم MusicGen "موازة تأخرت" لإصدار تيار K كودكوب بالتوازي مع تعويضات التدفق. تولد VALL-E رموز خطاب من عرض نصي + 3 ثواني عينة صوت.

**Latent diffusion.**إعداد رموز الكوديك كمتواصلات متخفية أو نموذجها مع انتشار فوري. تستخدم أوديوه استيبل 2.5 مطابقة التدفق على متواصلات التخفيف الصوتي. تستخدم أوديوه إل دي إم 2 انتشار نص إلى ميل إلى صوت.

الاتجاه 2024-2026: تطابق التدفق يفوز للموسيقى (الاستنتاج السريع، عينات أكثر نظافة) في حين لا يزال التكنولوجيا الذكية تهيمن على الكلام لأنه سبب طبيعي وتدفق بشكل جيد.

## منظومة الإنتاج

| System | Task | Backbone | Latency |
|--------|------|----------|---------|
| ElevenLabs V3 | TTS | Token-AR + neural vocoder | ~300ms first token |
| OpenAI GPT-4o audio | Full-duplex speech | End-to-end multimodal AR | ~200ms |
| NaturalSpeech 3 | TTS | Latent flow matching | Non-streaming |
| Stable Audio 2.5 | Music / SFX | DiT + flow matching on audio latents | ~10s for 1-minute clip |
| Suno v4 | Full songs | Undisclosed; token-AR suspected | ~30s per song |
| Udio v1.5 | Full songs | Undisclosed | ~30s per song |
| MusicGen 3.3B | Music | Token-AR on Encodec 32kHz | Real-time |
| AudioCraft 2 | Music + SFX | Flow matching | ~5s for 5s clip |
| Riffusion v2 | Music | Spectrogram diffusion | ~10s |

```figure
score-matching
```

## بناءها

`code/main.py`يحاكي الفكرة الأساسية: تدريب محول صغيري للبرمجة التالية على تسلسلات "برمجة صوتية" اصطناعية تم إنشاؤها من "أنماط" مختلفة (التبديل بين الرموز المنخفضة والعالية للنموذج A، والرامب المتوحدة للنموذج B).

### الخطوة الأولى: رموز صوتية اصطناعية

```python
def make_tokens(style, length, vocab_size, rng):
    if style == 0:  # "speech-like": alternating
        return [i % vocab_size for i in range(length)]
    # "music-like": ramp
    return [(i * 3) % vocab_size for i in range(length)]
```

### الخطوة الثانية: تدريب جهاز تنبؤ رمز صغير

متنبؤ في نمط البيغرام مشروط على نمط. النقطة هي النمط: رموز كوديك → تدريب عبر الانتروبيا → أخذ العينات السريعة.

### الخطوة الثالثة: العينة مشروطة

بالنظر إلى رمز النمط والرمز البدائي، قم بعمل عينة من الرمز التالي من التوزيع المتوقع. استمر لمدة 20-40 رمزا.

## الفخاخ

- **Codec quality caps output quality.**إذا كان الكوديك لا يمكن أن تمثل الصوت بشكل مخلص، لا كمية من جنيتر جودة تساعد.
- **RVQ error accumulation.**كل طبقة RVQ تمثيل بقايا الطبقة السابقة. تتكاثر الأخطاء في الطبقة 1. العينات مع درجة حرارة 0 على الطبقات العليا يساعد.
- **Musical structure.**30 ثانية من الرموز هي 20k + الرموز عند 75 هرتز. صعب على المحولات. MusicGen يستخدم النافذة المنزلقة + استمرار سريع؛ صوت مستقر يستخدم مقاطع أقصر + التقاطع.
- **Artifacts at boundaries.**التشابه بين المقاطع المولدة يحتاج إلى إضافة متداخلة دقيقة.
- **Clean-data appetite.**تحتاج مولدات الموسيقى إلى عشرات الآلاف من ساعات الموسيقى المرخصة. أظهرت دعوى Suno / Udio RIAA (2024) هذا الأمر.
- **Voice cloning ethics.**نموذج ثنائي بالإضافة إلى طلب نص يكفي لـ VALL-E / XTTS / ElevenLabs لتقليد صوت. يحتاج كل نموذج إنتاج إلى اكتشاف إساءة استخدام + قوائم إلغاء الاختيار.

## استخدمها

| Task | 2026 stack |
|------|------------|
| Commercial TTS | ElevenLabs, OpenAI TTS, or Azure Neural |
| Voice cloning (consent-verified) | XTTS v2 (open) or ElevenLabs Pro |
| Background music, fast | Stable Audio 2.5 API, Suno, or Udio |
| Music with lyrics | Suno v4 or Udio v1.5 |
| Sound effects / Foley | AudioCraft 2, ElevenLabs SFX, or Stable Audio Open |
| Real-time voice agent | GPT-4o realtime or Gemini Live |
| Open-weights music research | MusicGen 3.3B, Stable Audio Open 1.0, AudioLDM 2 |
| Dubbing / translation | HeyGen, ElevenLabs Dubbing |

## أرسله

إنقاذ`outputs/skill-audio-brief.md`. تتخذ مهارة قصيرة صوتية (المهمة، المدة، النمط، الصوت، الترخيص) والمخرجات: النموذج + الاستضافة، النمط السريع (ملامح النوع، وصف الأسلوب، علامات هيكلية) ، الموديك + مولد + سلسلة vocoder، بروتوكول البذور، وخطة تقييم (MOS / CLAP درجة / CER ل TTS / المستخدم A / B).

## التمارين

1. **Easy.**أركض`code/main.py`وتحدد النمط صراحة. التحقق من تسلسلات تولد تتطابق مع نمط النمط.
2. **Medium.**إضافة تشفير متوازي متأخر: محاكاة 2 تيار من الرموز التي يجب أن تبقى معززة بخطوة واحدة. تدريب المتوقع المشترك.
3. **Hard.**استخدم محولات HuggingFace لتشغيل MusicGen-small محلياً. تولد شريطًا لمدة 10 ثوانٍ مع ثلاث طلبات مختلفة؛ A / B لالتزام الأسلوب.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Codec | "Neural compression" | Encoder / decoder for audio; typical output is 50-75 Hz tokens. |
| RVQ | "Residual VQ" | Cascade of K quantizers; each models the residual of the previous. |
| Token | "One codec symbol" | Discrete index into a codebook; 1024 or 2048 typical. |
| Delayed parallel | "Offset codebooks" | Emit K token streams with staggered offsets to reduce sequence length. |
| Flow matching | "The 2024 win for audio" | Straighter-path alternative to diffusion; faster sampling. |
| Voice prompt | "3-second sample" | Speaker embedding or token prefix that steers the cloned voice. |
| Mel spectrogram | "The visual" | Log-magnitude perceptual spectrogram; used by many TTS systems. |
| Vocoder | "Mel to wave" | Neural component that converts mel spectrograms back to audio. |

## ملاحظة الإنتاج: الصوت مشكلة في التدفق

الصوت هو طريقة الخروج الوحيدة التي يتوقعها المستخدمون وصولها * كما يتم إنشاؤها * ، وليس كل مرة واحدة. من حيث الإنتاج يعني هذا TPOT (Time Per Output Token) لأن سرعة الاستماع للمستخدم هي التوصيل المستهدف  وليس سرعة قراءتها. بالنسبة إلى الصوت 16kHz الذي يتم توكينه عند ~ 75 رمز / ثانية (Encodec) ، يجب على الخادم إنتاج ≥75 رمز / ثانية لكل مستخدم للحفاظ على تسريع التشغيل.

عواقب معمارية:

- **Flow-matching audio models cannot stream trivially.**أوديوه استيبل 2.5 وآوديوكرافت 2 يعرضون طول المقطع الثابت في مرسلة واحدة. لتشغيل، تقوم بتقسيم المقطع والحدود المتداخلة  تفكر في انتشار النافذة المنزلق  إضافة 100-300ms من التأخير فوق مقابل نموذج AR كوديك.

إذا كان المنتج "محادثة صوتية حية" أو "استمرار الموسيقى في الوقت الحقيقي"، اختر مسار AR codec. إذا كان "إعطاء مقطع 30 ثانية على الإرسال"، فان تطابق التدفق يفوز على الجودة والتكامل التأخير.

## المزيد من القراءة

- [Défossez et al. (2022). Encodec: High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) معيار المكونات
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) أول كوديك صوتي عصبي يستخدم على نطاق واسع.
- [Kumar et al. (2023). High-Fidelity Audio Compression with Improved RVQGAN (DAC)](https://arxiv.org/abs/2306.06546) DAC
- [Wang et al. (2023). Neural Codec Language Models are Zero-Shot Text to Speech Synthesizers (VALL-E)](https://arxiv.org/abs/2301.02111)-فالي-إي
- [Copet et al. (2023). Simple and Controllable Music Generation (MusicGen)](https://arxiv.org/abs/2306.05284) الموسيقى
- [Liu et al. (2023). AudioLDM 2: Learning Holistic Audio Generation with Self-supervised Pretraining](https://arxiv.org/abs/2308.05734) AudioLDM 2.
- [Stability AI (2025). Stable Audio 2.5](https://stability.ai/news-updates/stability-ai-introduces-stable-audio-25-the-first-audio-model-built-for-enterprise-sound-production-at-scale) 2025 نص إلى الموسيقى مع مطابقة التدفق.
