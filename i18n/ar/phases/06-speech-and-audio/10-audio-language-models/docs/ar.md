# النماذج الصوتية للغة  Qwen2.5-Omni, الصوت فلامينغو, GPT-4o الصوت

> 2026 نماذج اللغة الصوتية تقرر على الكلام + الصوت البيئي + الموسيقى. Qwen2.5-Omni-7B يطابق GPT-4o Audio على MMAU-Pro. صوت Flamingo Next يفوق Gemini 2.5 Pro على LongAudioBench. الفجوة بين المفتوحة والغلقة مغلقة بشكل أساسي  باستثناء المهام متعددة الصوت ، حيث يكون الجميع تقريبا عشوائي.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04 (ASR), Phase 12 · 03 (Vision-Language Models), Phase 7 · 10 (Audio Transformers)
**Time:** ~45 minutes

## المشكلة

لديك 5 ثوان من الصوت: كلب يرن، شخص ما يصرخ "وقف!" ثم الصمت. الأسئلة المفيدة تتجاوز محاور متعددة:

- **Transcription.**"ما الذي قيل؟"  منطقة أس آر.
- **Semantic reasoning.**"هل الشخص في خطر؟"  يتطلب فهم مشترك للنوح + الصراخ + الصمت.
- **Music reasoning.**"ما هي الأدوات التي تعزف الميلودية؟"
- **Long-audio retrieval.**"أين في هذه المحاضرة التي استمرت 90 دقيقة شرح المعلم انخفاض التسلسل؟"

نموذج واحد يرد على كل هذه مع طلب واحد هو **audio-language model**(LALM / ALM). منفصلة عن ASR النقي: LALM تنتج إجابات في اللغة الطبيعية في شكل حر ، وليس مجرد نسخ.

## المفهوم

![Audio-language model: audio encoder + projector + LLM decoder](../assets/alm-architecture.svg)

### نموذج ثلاثي المكونات

كل لالا 2026 لديه نفس العظم:

1. **Audio encoder.**مُرمّع "سيسبر" · "بييتس" · "كلاب" · "ويفلم" · أو مُرمّع "تخصيص" لكل نموذج.
2. **Projector.**ميزات رمز الصوت السري أو MLP الجسر في مساحة إدراج الرمزية في LLM.
3. **LLM.**إلاما / Qwen / Gemma القائمة على المفكّر. يأخذ النص المتداخل + رموز الصوت؛ توليد النص.

التدريب:

- **Stage 1.**إيقاف إيقاف + LLM؛ مشروع القطار فقط على بيانات ASR / عنوان.
- **Stage 2.**التنسيق الدقيق كامل / LoRA على المهام الصوتية التي تتبع التعليمات (QA ، التفكير ، فهم الموسيقى).
- **Stage 3 (optional).**إضافة صوت / صوت خارج إضافة مُعبرة للخطاب. Qwen2.5 Omni و AF3-Chat تفعل هذا.

### خريطة نموذج 2026

| Model | Backbone | Audio encoder | Output modality | Access |
|-------|----------|---------------|-----------------|--------|
| Qwen2.5-Omni-7B | Qwen2.5-7B | Custom + Whisper | text + speech | Apache-2.0 |
| Qwen3-Omni | Qwen3 | Custom | text + speech | Apache-2.0 |
| Audio Flamingo 3 | Qwen2 | AF-CLAP | text | NVIDIA non-commercial |
| Audio Flamingo Next | Qwen2 | AF-CLAP v2 | text | NVIDIA non-commercial |
| SALMONN | Vicuna | Whisper + BEATs | text | Apache-2.0 |
| LTU / LTU-AS | Llama | CAV-MAE | text | Apache-2.0 |
| GAMA | Llama | AST + Q-Former | text | Apache-2.0 |
| Gemini 2.5 Flash/Pro (closed) | Gemini | proprietary | text + speech | API |
| GPT-4o Audio (closed) | GPT-4o | proprietary | text + speech | API |

### التحقق من الواقع (2026)

**MMAU-Pro.**1800 زوجات QA تغطي الكلام / الصوت / الموسيقى / المختلطة.

| Model | Overall | Speech | Sound | Music | Multi-audio |
|-------|---------|--------|-------|-------|-------------|
| Gemini 2.5 Pro | ~60% | 73.4% | 51.9% | 64.9% | ~22% |
| Gemini 2.5 Flash | ~57% | 73.4% | 50.5% | 64.9% | 21.2% |
| GPT-4o Audio | 52.5% | — | — | — | 26.5% |
| Qwen2.5-Omni-7B | 52.2% | 57.4% | 47.6% | 61.5% | ~20% |
| Audio Flamingo 3 | ~54% | — | — | — | — |
| Audio Flamingo Next | SOTA on LongAudioBench | — | — | — | — |

- نعم**multi-audio column is damning for everyone.**فرصة عشوائية على اختيار متعددة 4 خيارات = 25%؛ معظم النماذج تسجل حول هناك. لا يزال LALM يكافح مقارنة شريطين.

### أين تكون الـ LALM مفيدة في عام 2026

- **Compliance audit of call-center recordings.**"هل ذكر العميل الإفصاح المطلوب؟"
- **Accessibility.**وصف الأحداث الصوتية للمستخدمين الصمّين (وليس فقط النسخة).
- **Content moderation.**اكتشاف اللغة العنيفة + النغمة التهديدية + السياق الخلفي.
- **Podcast / meeting chaptering.**ملخص معنوي، وليس فقط محادثات.
- **Music catalog analysis.**"عثر على جميع المسارات مع تغيير مفتاح قسم "ب".

### حيث لا تكون مفيدة (حتى الآن)

- نظرية الموسيقى ذات الحبوب الدقيقة (أقل من مستوى الأكورد).
- التفكير الذي يعطيه المتحدث على المحادثات الطويلة (الدرجات التي تصل إلى 10 دقائق).
- مقارنة متعددة الصوت (22-26٪ هي بالكاد فوق العشوائية).
- التفكير في التدفق في الوقت الحقيقي (معظمها استنتاجات اللحوم غير متصلة بالإنترنت).

```figure
v4-alm-tokens
```

## بناءها

### الخطوة 1: استفسار Qwen2.5-Omni

```python
from transformers import AutoModelForCausalLM, AutoProcessor

processor = AutoProcessor.from_pretrained("Qwen/Qwen2.5-Omni-7B")
model = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-Omni-7B", torch_dtype="auto")

audio, sr = load_wav("clip.wav", sr=16000)
messages = [{
    "role": "user",
    "content": [
        {"type": "audio", "audio": audio},
        {"type": "text", "text": "What sounds do you hear, and what's happening?"},
    ],
}]
inputs = processor.apply_chat_template(messages, tokenize=True, return_tensors="pt")
output = model.generate(**inputs, max_new_tokens=200)
print(processor.decode(output[0], skip_special_tokens=True))
```

### الخطوة الثانية: نمط المضرب

```python
import torch.nn as nn

class AudioProjector(nn.Module):
    def __init__(self, audio_dim=1280, llm_dim=4096):
        super().__init__()
        self.down = nn.Linear(audio_dim, llm_dim)
        self.act = nn.GELU()
        self.up = nn.Linear(llm_dim, llm_dim)

    def forward(self, audio_features):
        return self.up(self.act(self.down(audio_features)))
```

هذا هو الأمر. المُرَاكِب عادةً ما تكون 1-3 طبقة خطية. تدريبها على أزواج ASR (صوت → نسخة) هو مهمة الحجة الأولى.

### الخطوة الثالثة: تقييم مقارنة MMAU / LongAudioBench

```python
from datasets import load_dataset
mmau = load_dataset("gamma-lab-umd/MMAU-Pro", split="test")
mcq = mmau.filter(lambda item: len(item["choices"] or []) > 1)

correct = 0
for item in mcq:
    answer = call_model(item["audio_path"], item["question"], item["choices"])
    if answer == item["answer"]:
        correct += 1
print(f"Accuracy: {correct / len(mcq):.3f}")
```

`audio_path`نقاط في إعادة التأمينات مجموعة البيانات `data.zip`(حوالي 47 جيجا غاي) ، لذا تحميل و فك الزيله قبل تسجيل النقاط. هذه الحلقة المتماثقة الدقيقة هي فحص الصواب، وليس مستحق النتيجة المرجعية، لذلك لا يمكن مقارنة عددها مع نتائج MMAU-Pro المنشورة. يطابق المقيّم الرسمي إجابات الاختيار المتعدد عن طريق إدراج التشابه (NV-Embed-v2) ، ويضع علامات على الإجابات المفتوحة مع قاضي ماجستير في القانون، ويتحقق من الإجابات التي تتبع التعليمات بقواعد regex: كتابة التنبؤات إلى`model_output`العمود والعمل`evaluate_mmau_pro_comprehensive.py`من[MMAU-Pro repo](https://github.com/sonalkum/MMAUPro). أبلغ كل واحد`category`(الحديث والصوت والموسيقى والمتعدد وغيره) بشكل منفصل. الأرقام الإجمالية تختبئ حيث يفشل النموذج.

## استخدمها

| Task | 2026 pick |
|------|-----------|
| Free-form audio QA (open) | Qwen2.5-Omni-7B |
| Best open on long audio | Audio Flamingo Next |
| Best closed | Gemini 2.5 Pro |
| Voice-in / voice-out agent | Qwen2.5-Omni or GPT-4o Audio |
| Music reasoning | Audio Flamingo 3 or 2 (music-specialized AF-CLAP) |
| Call-center audit | Gemini 2.5 Pro via API, with RAG over your policy docs |

## الفخاخ

- **Over-trust on multi-audio.**إذا كانت مهمتك تحتاج إلى "أي شريط له X"، فإن أداء على مستوى الرفض عشوائي حقيقي.
- **Long-audio degradation.**بعد 10 دقائق، تفقد معظم النماذج إخصائص المتحدثين، قم بتدوين الأقوال أولاً (الدرس 6) ، ثم قم بتجميعها.
- **Hallucinations on silence.**نفس مشكلة في شكل "سيسبر" التي ورثتها "الالام" التي تستخدم "سيسبر"
- **Benchmark cherry-picking.**مشاركات الموردين في المدونات تبرز أفضل فئات الحالة. تشغيل MMAU-Pro متعددة الأذاعة الفرعية بنفسك.

## أرسله

إبقوا`outputs/skill-alm-picker.md`. اختر LALM + مجموعة فرعية للمراجعة + طريقة الخروج (نص مقابل الكلام) لمهمة معينة لفهم الصوت.

## التمارين

1. **Easy.**أركض`code/main.py`لمشاهدة نمط مشروع لعبة + توجيه LALM مزيف ل (الذي يدمج الصوت، الرموز النصية) → الرموز الإخراجية.
2. **Medium.**تقدم Qwen2.5 Omni-7B على 100 عنصر خطاب MMAU-Pro. مقارنة مع الرقم الذي تم الإبلاغ عنه في الورقة.
3. **Hard.**قم ببناء خط أساسي للحصول على أسمائ صوتية ضئيلة: بييتس مُرمّع + مُرّيّد طبقة 2 + Llama-3.2-1B المجمد. قم بتحسين المُرّيّد فقط على أوديوكابس. قم بالمقارنة مع SALMONN على كلوتو-AQA.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| LALM | Audio ChatGPT | Audio encoder + projector + LLM decoder. |
| Projector | Adapter | Small MLP mapping audio features into LLM embedding space. |
| MMAU | The benchmark | 10k audio-QA pairs across speech, sound, music. |
| MMAU-Pro | Harder MMAU | 1800 multi-audio / reasoning-heavy questions. |
| LongAudioBench | Long-form eval | Multi-minute clips with semantic queries. |
| Voice-in / voice-out | Speech-native | Model ingests speech and emits speech without text detour. |

## المزيد من القراءة

- [Chu et al. (2024). Qwen2-Audio](https://arxiv.org/abs/2407.10759)- معمارة مرجعية
- [Alibaba (2025). Qwen2.5-Omni](https://huggingface.co/Qwen/Qwen2.5-Omni-7B)- الكلام في الكلام خارج
- [NVIDIA (2025). Audio Flamingo 3](https://arxiv.org/abs/2507.08128)القائد المفتوح للصوت الطويل
- [NVIDIA (2026). Audio Flamingo Next](https://arxiv.org/abs/2604.10905) LongAudioBench SOTA
- [Tang et al. (2023). SALMONN](https://arxiv.org/abs/2310.13289)الرائدين في تشفير المزدوج
- [MMAU-Pro leaderboard](https://sonalkum.github.io/mmau-pro/) ترتيبات حية لعام 2026
