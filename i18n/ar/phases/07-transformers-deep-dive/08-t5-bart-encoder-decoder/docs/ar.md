# T5، BART  نماذج تشفير-تشفير

> المرموزات تفهم. المرموزات تولد. قم بتجميعها معاً وتحصل على نموذج بني لمهام الإدخال → الخروج: الترجمة، التجميع، إعادة الكتابة، النسخ.

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## المشكلة

GPT فقط المفكّر و BERT فقط المفكّر كلّ شريط أسفل بنية 2017 لهدف مختلف. ولكن العديد من المهام هي بطبيعة الحال إدخال-إخراج:

- ترجمة: الإنجليزية → الفرنسية.
- المقالة المكونة من 5000 رمز → 200 رمز
- التعرف على الكلام: رموز الصوت → رموز النص.
- استخراج مهيكل: النص → JSON.

بالنسبة لهذه، يقوم المُشفّر-المُفَكِّر بتصميم المُفَكِّر الأكثر نظافة. يقوم المُفَكِّر بإنتاج تمثيل كثيف للمصدر. يقوم المُفَكِّر بإنتاج الخروج، ويحقق هذا التمثيل في كل خطوة. يتم تدريب التحول بموجب واحد على جانب الخروج. نفس الخسارة مثل GPT، فقط مشروطة على خروج المُفَكِّر.

ورقتان حددت كتاب اللعب الحديث:

1. **T5**(رافيل وزملاءه 2019). "تحول النص إلى النص". كل مهمة من NLP تم إعادة تشكيلها على أنها نص إدخال، نص خارج. بنية واحدة، مفردة واحدة، خسارة واحدة. تدرب على توقعات المدة المخفية (الفترات الفاسدة في المدخل، فكها في الخروج).
2. **BART**(لويس وزملاء 2019). "متحول ثنائي الاتجاه والتحويل الذاتي". تنفيذ المترجم الذاتي: إدخال فاسد بطرق متعددة (الارتباك والقناع والحذف والدورة) ، اطلب من المترجم إعادة بناء الأصلي.

في عام 2026، تنشأ تنسيق المُشفّر-المُفَكّر على حيث يُهم هيكل المدخلات:

- * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
- كومة ترجمة جوجل
- بعض نماذج إكمال الكود / إصلاح التي لديها هيكلات سياقية وتحرير متميزة.
- فلان-T5 والإختلافات لمهمات التفكير المهيكلة.

فقط المُفكّر فاز في الضوء، لكن المُفكّر لم يذهب أبداً.

## المفهوم

![Encoder-decoder with cross-attention](../assets/encoder-decoder.svg)

### الحلقة الأمامية

```
source tokens ─▶ encoder ─▶ (N_src, d_model)  ──┐
                                                 │
target tokens ─▶ decoder block                   │
                 ├─▶ masked self-attention       │
                 ├─▶ cross-attention ◀───────────┘
                 └─▶ FFN
                ↓
              next-token logits
```

أهم شيء، فإن المرسم يعمل مرة واحدة لكل مدخل. يقوم المرسم بالتحكم في التنفيذ بشكل متراجع ولكن يتناسب مع * نفس * خروج المرسم في كل خطوة. تخزين خروج المرسم هو تسريع مجاني للمدخلات الطويلة.

### T5 قبل التدريب  الفساد في المدى

اختر فترات عشوائية من المدخل (متوسط طول 3 رموز، 15٪ إجمالي). استبدل كل فترة مع حارس فريد: `<extra_id_0>`،`<extra_id_1>`، إلخ. المفكّر يخرج فقط المقاطع المفسدة مع مقدمة الحرس:

```
source: The quick <extra_id_0> fox jumps <extra_id_1> dog
target: <extra_id_0> brown <extra_id_1> over the lazy
```

إشارة أرخص من التنبؤ بالترتيب بأكمله. تنافسية مع MLM (BERT) والإشارة-LM (UniLM) في إزالة ورقة T5.

### التدريب المسبق لـ BART  التخفيض المتعدد الضوضاء

يُجرب (بارت) خمس وظائف ضوضاء:

1. -تخفيض الوسائل
2. إزالة الرمز
3. إضافة النص (قنع المجال، إضافة المقطع المقصود بالطول الصحيح).
4. تحويل الجملة
5. -دورة الوثائق

إن الجمع بين إضافة النص + تحويل الجملة أدى إلى تحديد أفضل الأرقام التدريجية. يقوم المفكّر دائمًا بإعادة بناء الأصلي. إنتاج BART هو التسلسل الكامل، وليس فقط المدة المفسدة  لذلك يكون حساب التدريب المسبق أعلى من T5.

### الإستثمار

نفس الجيل السريع والمرجعية مثل GPT. يتم تطبيق العينات الشريعة / الشعاع / أعلى-p. البحث الشعاعي (الربع 45) هو معيار لترجمة وتجميع لأن توزيع الخروج أصغر من الدردشة.

### متى يجب اختيار كل فاركس في 2026

| Task | Encoder-decoder? | Why |
|------|------------------|-----|
| Translation | Yes, usually | Clear source sequence; fixed output distribution; beam search works |
| Speech-to-text | Yes (Whisper) | Input modality differs from output; encoder shapes audio features |
| Chat / reasoning | No, decoder-only | No persistent "input" — the conversation is the sequence |
| Code completion | Usually no | Decoder-only with long context wins; code models like Qwen 2.5 Coder are decoder-only |
| Summarization | Either works | BART, PEGASUS beat earlier decoder-only baselines; modern decoder-only LLMs match them |
| Structured extraction | Either | T5 is clean because "text → text" absorbs any output format |

الاتجاه منذ ~2022: يتولى المقرر فقط المهام التي كان يمتلكها المقرر فقط لأن (أ) التوجيهات المنسقة المقرر فقط LLM يجميع إلى أي شيء عن طريق التقاضيح ، (ب) يسهل معدل الهندسة المعمارية على اثنين ، (ج) يفترض RLHF المقرر. يحتفظ المقرر-المقرر حيث يختلف طريقة المدخل (الحديث ، الصور) أو حيث تعتبر جودة البحث عن شعاع مهمة.

```figure
encoder-decoder
```

## بناءها

انظر`code/main.py`نطبق إفساد فترة التعبئة على طراز T5 لـ "كوربوس اللعبة" وهو أكثر قطع الدروس فائدة لأنه يظهر في كل وصفة قبل تدريب المُشفّر-المُفَكِّر منذ ذلك الحين.

### الخطوة الأولى: فساد المدى

```python
def corrupt_spans(tokens, mask_rate=0.15, mean_span=3.0, rng=None):
    """Pick spans summing to ~mask_rate of tokens. Return (corrupted_input, target)."""
    n = len(tokens)
    n_mask = max(1, int(n * mask_rate))
    n_spans = max(1, int(round(n_mask / mean_span)))
    ...
```

النموذج المستهدف هو اتفاقية T5: `<sent0> span0 <sent1> span1 ...`. المدخل المفسد يترك رموز غير متغيرة مع رموز الحارس في مواقع المدة.

### الخطوة الثانية: التحقق من رحلة ذهاب وإياب

بالنظر إلى المدخلات والهدف المفسدة، اعيد بناء الجملة الأصلية. إذا كان الفساد قابلًا للعكس، فإن المرور إلى الأمام محددًا جيدًا. هذه هي فحص الصحة العقلية  التدريب الحقيقي لا يفعل هذا أبدًا، ولكن الاختبار رخيص ويقوم بتقاط أخطاء واحدة في حسابات فترة عملك.

### الخطوة الثالثة: ضجيج BART

خمسة وظائف:`token_mask`،`token_delete`،`text_infill`،`sentence_permute`،`document_rotate`.أكتب اثنين منهم وأظهر النتيجة

## استخدمها

إشارة " HuggingFace "

```python
from transformers import T5ForConditionalGeneration, T5Tokenizer
tok = T5Tokenizer.from_pretrained("google/flan-t5-base")
model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-base")

inputs = tok("translate English to French: Attention is all you need.", return_tensors="pt")
out = model.generate(**inputs, max_new_tokens=32)
print(tok.decode(out[0], skip_special_tokens=True))
```

خدعة T5: يدخل اسم المهمة في نص المدخل. نفس النموذج يتعامل مع عشرات المهام لأن كل مهمة هي نص-إدخال، نص-خارج. في عام 2026 تم تعميم هذا النموذج من قبل نماذج التعليمات المنسقة المعدلة فقط، ولكن T5 قام بتعديلها أولا.

## أرسله

انظر`outputs/skill-seq2seq-picker.md`. المهارة تختار بين إكودر-كودر و إكودر-كودر فقط لمهمة جديدة نظراً إلى هيكل المدخلات والخروج والخلفية والهدف الجودة.

## التمارين

1. **Easy.**أركض`code/main.py`، تطبيق الفساد في المدى على جملة 30 رمزية، التحقق من أن التواصل بين رموز المصدر غير السنتينيل مع المدى المستهدف المفكّر يعيد النسخة الأصلية.
2. **Medium.**تنفيذ نظام "بارت" `text_infill`الضجيج: استبدال المدة العشوائية بمادة واحدة `<mask>`و يجب على المُعبر أن يستنتج طول المُدّة الصحيحة بالإضافة إلى المحتوى.
3. **Hard.**-حسناً`flan-t5-small`على مجموعة صغيرة من اللغة الإنجليزية → الخنزير اللاتينية (200 زوج) قياس BLEU على مجموعة 50 زوجاً متواصلة. مقارنة مع التنسيق الدقيق `Llama-3.2-1B`على نفس البيانات بنفس الحساب

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Encoder-decoder | "Seq2seq transformer" | Two stacks: bidirectional encoder for input, causal decoder with cross-attention for output. |
| Cross-attention | "Where source talks to target" | Decoder's Q × encoder's K/V. The only place encoder information enters the decoder. |
| Span corruption | "T5's pretraining trick" | Replace random spans with sentinel tokens; decoder outputs the spans. |
| Denoising objective | "BART's game" | Apply a noise function to the input, train the decoder to reconstruct the clean sequence. |
| Sentinel token | "The `<extra_id_N>` placeholder" | Special tokens that tag corrupted spans in the source and re-tag them in the target. |
| Flan | "Instruction-tuned T5" | T5 fine-tuned on >1,800 tasks; made encoder-decoder competitive at instruction-following. |
| Beam search | "Decoding strategy" | Keep top-k partial sequences at each step; standard for translation/summarization. |
| Teacher forcing | "Training-time input" | During training, feed the true previous output token to the decoder, not the sampled one. |

## المزيد من القراءة

- [Raffel et al. (2019). Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer](https://arxiv.org/abs/1910.10683) T5
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training for Natural Language Generation, Translation, and Comprehension](https://arxiv.org/abs/1910.13461)-بارت
- [Chung et al. (2022). Scaling Instruction-Finetuned Language Models](https://arxiv.org/abs/2210.11416) طائرة T5
- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356)-سيسبر، رمز التشفير و التشفير القديس لعام 2026.
- [HuggingFace `modeling_t5.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/t5/modeling_t5.py) تنفيذ مرجعي
