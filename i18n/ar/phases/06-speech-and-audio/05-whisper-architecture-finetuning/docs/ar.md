# التهمس والعمارة والتنظيم

> ويسبر هو محول نافذة مُعدل لـ 30 ثانية، مدرب على 680 ألف ساعة من أزواج الصوت والنص الضعيفة الإشراف على اللغات المتعددة. بنية واحدة، مهام متعددة، قوية عبر 99 لغة. ASR 2026 المرجعية.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04 (ASR), Phase 5 · 10 (Attention), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## المشكلة

كانت Whisper ، التي أصدرتها OpenAI في سبتمبر 2022 ، أول نموذج ASR يتم شحنها كسلع: ضغط الصوت ، الحصول على النص ، 99 لغة ، قوية على الضوضاء ، تعمل على جهاز محمول. بحلول عام 2024 ، أطلقت OpenAI تغيرات Large-v3 و Turbo ؛ بحلول عام 2026 ، Whisper هي الخط الأساسي الافتراضي لكل شيء من النسخة البودكاستية إلى مساعدات الصوت إلى ترجمات YouTube.

لكن "السمس" ليس خط أنابيب يمكنك التعامل معه كصندوق أسود إلى الأبد.

1. ما هو عليه في الداخل
2. كيفية إعطائه بصوتًا مقسمًا أو مدموعًا أو طويلًا بشكل صحيح
3. متى و كيف

## المفهوم

![Whisper encoder-decoder, tasks, chunked inference, fine-tune](../assets/whisper.svg)

**Architecture.**محول مُصطدر مُصطدر مُصطدر

- المدخل: 30 ثانية من طيف الملفات المختلفة، 80 ميل، 10 ميس ارتفاع → 3000 إطار. المقاطع أقصر هي صفر-مغطاة، المقاطع أطول هي شق.
- رمز: نموذج صبغي (خطوة 2) + `N`كتلة تحويل، لـ (جيرج-ف3: 32 طبقة، 1280 عمق، 20 رأس
- مُفكّر: `N`كتلة محول مع التأثير الذاتي السبب + التأثير المتقاطع إلى خروج المُشفّر. نفس الحجم من المُشفّر.
- الناتج: رموز BPE على كلمة 51 865 رمزا.

يحتوي Large-v3 على معايير 1.55B. يستخدم Turbo جهاز تشخيص 4 طبقات (من 32 ، ويقصر التأخير 8 × مع ضرب WER < 1٪.

**The prompt format.**ويشبر هو نموذج متعددة المهام يتم تحكمها بواسطة رموز خاصة في عرض المفكّر:

```
<|startoftranscript|><|en|><|transcribe|><|notimestamps|> Hello world.<|endoftext|>
```

- `<|en|>`: علامة اللغة؛ أسماء اللغة المتحدثة في الصوت. اتركها خارج و Whisper يكتشف اللغة أولا.
- `<|transcribe|>`أو`<|translate|>`: علامة المهمة؛ نقل الخطاب إلى لغته الأصلية، أو ترجمته إلى نص إنجليزي.
- `<|notimestamps|>`: تخطي العلامات الزمنية على مستوى الكلمات (أسرع).

الإشارة هي ما يسمح لنموذج واحد القيام بمعظم المهام. تغيير `<|en|>`إلى`<|fr|>`ويقوم بنسخ الفرنسية

**30-second window.**كل شيء محصن إلى 30 ثانية. تحتاج المقاطع الطويلة إلى التجزئة؛ المقاطع القصيرة ملوية. النوافذ لا يتم تشغيلها بشكل طبيعي  هذا هو السبب في وجود WhisperX، Whisper-Streaming، و أسرع-سوسر.

**Log-mel normalization.** `(log_mel - mean) / std`حيث تأتي الإحصاءات من مجموعة تدريبية من قبل (ويسبر)`whisper.audio.log_mel_spectrogram`), لا `librosa.feature.melspectrogram`. . .

### الإختلافات في عام 2026

| Variant | Params | Latency (A100) | WER (LibriSpeech-clean) |
|---------|--------|----------------|------------------------|
| Tiny | 39M | 1× realtime | 5.4% |
| Base | 74M | 1× | 4.1% |
| Small | 244M | 1× | 3.0% |
| Medium | 769M | 1× | 2.7% |
| Large-v3 | 1.55B | 2× | 1.8% |
| Large-v3-turbo | 809M | 8× | 1.58% |
| Whisper-Streaming (2024) | 1.55B | streaming | 2.0% |

### التنسيق الدقيق

سير العمل القنوني في عام 2026:

1. جمع 10100 ساعة من الصوت المستهدف مع النسخ المتحالفة.
2. أركض`transformers.Seq2SeqTrainer`مع`generate_with_loss`إعادة الاتصال
3. فعالية المعلم: إدخال المعدل`q_proj`،`k_proj`،`v_proj`من الطبقات الاهتمام يقلل من ذاكرة GPU 4 × مع < 0.3 WER تكلفة.
4. قم بتجميد المُشفّر إذا كان لديك <10 ساعات فقط قم بتحديد المُشفّر
5. استخدم رمز التوهج الخاص بـ (ويسبر) و تنسيق الإستعلام؛ لا تغير أبداً رمز التوهج.

نتائج المجتمع: ضبط دقيقة متوسط على 20 ساعة من التنظيم الطبي يقلل من WER من 12% إلى 4.5% على المفردات الطبية.

```figure
sp-asr-attention
```

## بناءها

### الخطوة الأولى: إشغيل "سيسبر" خارج الصندوق

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe(
    "clip.wav",
    language="en",
    task="transcribe",
    temperature=0.0,
    condition_on_previous_text=False,  # prevents runaway repetition
)
print(result["text"])
for seg in result["segments"]:
    print(f"[{seg['start']:.2f}–{seg['end']:.2f}] {seg['text']}")
```

الاختيارات الرئيسية يجب عليك دائماً إلغاءها: `temperature=0.0`(معدل الاختيارات الافتراضية إلى 0.0 → 0.2 → 0.4 ... سلسلة الردع) ، `condition_on_previous_text=False`(منع مشكلة الهلوسة في القصص) ، و`no_speech_threshold=0.6`(اكتشاف الصمت)

### الخطوة الثانية: شكل طويل

```python
# whisperx is the 2026 reference for long-form with word-level timestamps
import whisperx
model = whisperx.load_model("large-v3-turbo", device="cuda", compute_type="float16")
segments = model.transcribe("1hour.mp3", batch_size=16, chunk_size=30)
```

يضيف WhisperX (1) إغلاق Silero VAD، (2) تحديد مستوى الكلمات عبر wav2vec 2.0، (3) تحديث اليومي عبر `pyannote.audio`. "الفرس العمل لعام 2026" "للتنسيق الإنتاجي"

### الخطوة الثالثة: ضبطها مع LoRA

```python
from transformers import WhisperForConditionalGeneration, WhisperProcessor
from peft import LoraConfig, get_peft_model

model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-large-v3-turbo")
lora = LoraConfig(
    r=16, lora_alpha=32, target_modules=["q_proj", "v_proj"],
    lora_dropout=0.1, bias="none", task_type="SEQ_2_SEQ_LM",
)
model = get_peft_model(model, lora)
# model.print_trainable_parameters()  -> ~3M trainable / 809M total
```

ثم حلقة مدربة قياسية نقطة تفتيش كل 1000 خطوة تقيم مع WER على الاحتفاظ.

### الخطوة الرابعة: تحقق ما يتعلمه كل طبقة

```python
# Grab cross-attention weights during decode to see what the decoder attends to.
with torch.inference_mode():
    out = model.generate(
        input_features=features,
        return_dict_in_generate=True,
        output_attentions=True,
    )
# out.cross_attentions: layer × head × step × src_len
```

قم بتصور مع خريطة حرارة سترى التنحي الأفقي كما تقوم عملية مسح خطوات المعدل عبر إطر المعدل. هذه الأفقية هي مفهوم Whisper لخططات زمنية الكلمة.

## استخدمها

"مجموعة 2026"

| Situation | Pick |
|-----------|------|
| General English, offline | Large-v3-turbo via `whisperx` |
| Mobile / edge | Whisper-Tiny quantized (int8) or Moonshine |
| Multilingual long-form | Large-v3 via `whisperx` + diarization |
| Low-resource language | Fine-tune Medium or Turbo with LoRA |
| Streaming (2 s latency) | Whisper-Streaming or Parakeet-TDT |
| Word-level timestamps | WhisperX (forced alignment via wav2vec 2.0) |

`faster-whisper`(CTranslate2 backend) هو أسرع وقت تشغيل استنتاج CPU + GPU في 2026  4x أسرع من الفانيليا مع نفس الخروج.

## الفخاخ التي لا تزال تشغل في عام 2026

- **Hallucinated text on silence.**تشمل التهمس المدربة على العناوين الفضائية "شكراً على مشاهدتكم!"، "تسجيل الدخول!"، كلمات الأغاني.
- **`condition_on_previous_text` cascade.**تلوث الهلوسة واحدة النوافذ التالية`False`إلا إذا كنت بحاجة إلى السرعة عبر القطاعات.
- **Short-clip padding.**مقطع ثنائي يُمَكّنُ من الهلوسة في الصمتِ التالي.`pad=False`أو بوابة الفاد
- **Wrong mel stats.**استخدام ملفات "ليبروزا" بدلاً من "سيسبر" ينتج إنتاج عشوائي تقريباً.`whisper.audio.log_mel_spectrogram`. . .

## أرسله

إبقوا`outputs/skill-whisper-tuner.md`تصميم خط إضافية أو استنتاجية من Whisper لسلطة معينة.

## التمارين

1. **Easy.**أركض`code/main.py`.إنه يرمز على عرض على شكل "سيسبر" يحسب ميزانيات الشكل المفكورة ويقوم بطبع جدول المقطع لقطة لمدة 10 دقائق
2. **Medium.**إثباط`faster-whisper`، نسخ تقنية بودكاست لمدة 10 دقائق، مقارنة WER مع نسخة بشرية.`language="auto"`مقابل الإجبار`language="en"`. . .
3. **Hard.**استخدام HF `datasets`، اختيار لغة تكافح معها (على سبيل المثال ، الأردو) ، تحسين متوسط مع لورا لمدة 2 فترات على مدار ساعتين ، وتقرير WER دلتا.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| 30-sec window | Whisper's limit | Hard input cap; chunk longer audio. |
| SOT | Start-of-transcript | `<\|startoftranscript\|>` kicks off the decoder prompt. |
| Timestamps token | Temporal alignment | Every 0.02 s offset is a special token in the 51k vocab. |
| Turbo | The fast variant | 4-decoder layers, 8× faster, <1% WER regression. |
| WhisperX | The long-form wrapper | VAD + Whisper + wav2vec alignment + diarization. |
| LoRA fine-tune | Efficient tuning | Add low-rank adapters to attention; train ~0.3% of params. |
| Hallucination | The silent failure | Whisper produces fluent English from noise/silence. |

## المزيد من القراءة

- [Radford et al. (2022). Whisper paper](https://arxiv.org/abs/2212.04356) المعماري الأصلي وصفة التدريب.
- [OpenAI (2024). Whisper Large-v3-turbo release](https://github.com/openai/whisper/discussions/2363)-مُشفّر 4 طبقات، تسريع 8 مرات
- [Bain et al. (2023). WhisperX](https://arxiv.org/abs/2303.00747)-شكل طويل، مصطفى بالكلمات، مذكر
- [Systran — faster-whisper repo](https://github.com/SYSTRAN/faster-whisper) CTranslate2 مدعوم، 4× أسرع.
- [HuggingFace — Whisper fine-tune tutorial](https://huggingface.co/blog/fine-tune-whisper) القنوني لورا / كامل-FT المشي من خلال.
