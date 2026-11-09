# برت  نموذج لغة مخفية

> يتنبأ GPT الكلمة التالية. يتنبأ BERT كلمة مفقودة. جملة واحدة من الفرق  و نصف عقد من كل شيء على شكل إضافة.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 5 · 02 (Text Representation)
**Time:** ~45 minutes

## المشكلة

في عام 2018 ، تدرب كل مهمة NLP  المشاعر ، NER ، QA ، entailment  نموذجها الخاص من الصفر على بياناتها المسموحة بها. لم يكن هناك نقطة تفتيش "فهم الإنجليزية" مقدمة التدريب التي يمكنك ضبطها. أظهرت ELMo (2018) أنه يمكنك تدريب إضافة سياقية مقدمة مع LSTM ثنائي الاتجاه ؛ ساعدت ولكنها لم تعاملها.

سأل بيرت (ديفلين وزملاء 2018): ماذا لو أخذنا مُشفّر محول، ودرّبناه على كل جملة على الإنترنت، وجبره على التنبؤ بالكلمات المفقودة من السياق على كلا الجانبين؟ ثم تقوم بتحسين رأس واحد على مهمتك التدريجية. كان كفاءة المعايير كشفًا.

النتيجة: في غضون 18 شهراً كانت BERT ومتغيراتها (RoBERTa ، ALBERT ، ELECTRA) تهيمن على كل قائمة قائمة لإنل بي الموجودة. بحلول عام 2020 كانت لكل محرك بحث ، وخط أنابيب اعتدال المحتوى ، ونظام بحث معنوي على الأرض لديه BERT داخلها.

في عام 2026 ماثلة المكشف فقط لا تزال الأداة المناسبة للتصنيف والانتشاط والاستخرج المهيكلي  أنها تعمل 510 × أسرع لكل رمز من المكشفين وتشبكاتها هي العمود الفقري لكل كومة استرداد حديثة. دفع ModernBERT (ديسمبر 2024) الهندسة المعمارية إلى سياق 8K مع فلاش انتباه + روبي + GeGLU.

## المفهوم

![Masked language modeling: pick tokens, mask them, predict originals](../assets/bert-mlm.svg)

### إشارة التدريب

خذ جملة:`the quick brown fox jumps over the lazy dog`. . .

غطاء 15% من الرموز عشوائياً:

```
input:  the [MASK] brown fox jumps [MASK] the lazy dog
target: the  quick brown fox jumps  over  the lazy dog
```

تدريب النموذج للتنبؤ بالرموز الأصلية في المواقف المخفية. لأن المُرمز هو ثنائي الاتجاه، التنبؤ `[MASK]`في الموقف 1 يمكن استخدام `brown fox jumps`هذا ما لا يستطيع (جبت) فعله

### قواعد قناع بيرت

من 15% من الرموز المختارة للتنبؤ:

- يتم استبدال 80% بـ `[MASK]`. . .
- يتم استبدال 10% بوهمة عشوائية.
- 10% يبقى دون تغيير

لماذا لا دائماً`[MASK]`لأن`[MASK]`لا يظهر أبدا في وقت الاستنتاج. تدريب النموذج على التوقع`[MASK]`في 100% من المواقف المخفية سيخلق تحول في التوزيع بين التدريب قبل التدريب والتحسين. 10% عشوائي + 10% غير متغير يبقى النموذج صادق.

### التنبؤ بالجملة التالية (NSP)  ولماذا تم إسقاطها

تم تدريب BERT الأصلي أيضًا على NSP: إعطاء جملتين A و B ، التنبؤ إذا كانت B تتبع A. قام RoBERTa (2019) بإزالة ذلك وأظهر أن NSP أذيت ، وليس ساعدت. تخطي المبرمجيات الحديثة ذلك.

### ما تغير في عام 2026: ModernBERT

ورقة 2024 ModernBERT أعادت بناء الكتلة مع 2026 البدائية:

| Component | Original BERT (2018) | ModernBERT (2024) |
|-----------|----------------------|-------------------|
| Positional | Learned absolute | RoPE |
| Activation | GELU | GeGLU |
| Normalization | LayerNorm | Pre-norm RMSNorm |
| Attention | Full dense | Alternating local (128) + global |
| Context length | 512 | 8192 |
| Tokenizer | WordPiece | BPE |

وعلى عكس كومة 2018، هو فلاش-تباين-أصل. إنفرنس هو 23 × أسرع في طول التسلسل 8K من ديبرتا-v3 مع أفضل نقاط GLUE.

### قضايا استخدام لا تزال تحصل على مبرمج في 2026

| Task | Why encoder beats decoder |
|------|---------------------------|
| Retrieval / semantic search embeddings | Bidirectional context = better embedding quality per token |
| Classification (sentiment, intent, toxicity) | One forward pass; no generation overhead |
| NER / token labeling | Per-position output, natively bidirectional |
| Zero-shot entailment (NLI) | Classifier head on top of encoder |
| Reranker for RAG | Cross-encoder scoring, 10x faster than LLM rerankers |

```figure
transformer-residual
```

## بناءها

### الخطوة الأولى: تزويد المنطق

انظر`code/main.py`. الوظيفة`create_mlm_batch`يأخذ قائمة من أجهزة الهوية الرمزية، وحجم الكلمات، واحتمال القناع. يعيد أجهزة الهوية المدخلة (مع تطبيق الأقنعة) والعلامات التسمية (فقط في المواقف المخفية، -100 في أماكن أخرى  قاعدة مؤشر Ignore PyTorch).

```python
def create_mlm_batch(tokens, vocab_size, mask_prob=0.15, rng=None):
    input_ids = list(tokens)
    labels = [-100] * len(tokens)
    for i, t in enumerate(tokens):
        if rng.random() < mask_prob:
            labels[i] = t
            r = rng.random()
            if r < 0.8:
                input_ids[i] = MASK_ID
            elif r < 0.9:
                input_ids[i] = rng.randrange(vocab_size)
            # else: keep original
    return input_ids, labels
```

### الخطوة الثانية: تشغيل تنبؤات إدارة الأعمال على مجموعة صغيرة

تدريب مُرمّد طبقة 2 + رأس MLM على قاموس 20 كلمة، 200 جملة. لا تراجيع  نحن نفعل فحص الصواب الأمامي. التدريب الكامل يحتاج PyTorch.

### الخطوة الثالثة: مقارنة أنواع القناع

أظهر كيف أن قاعدة الثلاثة الأطراف تبقي النموذج قابلاً للاستخدام بدون `[MASK]`التنبؤ على جملة غير مقبورة وعلى جملة مقبورة يجب أن تنتج كل منهما توزيعات رمزية معقولة لأن النموذج رأى كلا النمطين في التدريب.

### الخطوة الرابعة: رأس التنسيق

استبدل رأس MLM برأس تصنيف على مجموعة بيانات مشاعر الألعاب. فقط الرأس تدير؛ يتم تجميد المشفير. هذا هو النمط الذي يتبعه كل تطبيق BERT.

## استخدمها

```python
from transformers import AutoModel, AutoTokenizer

tok = AutoTokenizer.from_pretrained("answerdotai/ModernBERT-base")
model = AutoModel.from_pretrained("answerdotai/ModernBERT-base")

text = "Attention is all you need."
inputs = tok(text, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, N, 768)
```

**Embedding models are fine-tuned BERT.** `sentence-transformers`النماذج مثل`all-MiniLM-L6-v2`إنّهُم مُدرّبون بـ (بي إر تي) مع خسارة مُقارنة، ويكون المُشفّر نفسه، فقد تغيّر الخسارة.

**Cross-encoder rerankers are also fine-tuned BERT.**التصنيف المزدوج على`[CLS] query [SEP] doc [SEP]`الاهتمام الثنائي الإتجاه بين الاستفسار والوثيقة هو بالضبط ما يعطي المترجمين المتقاطعين حافة جودةهم على المترجمين الثنائي.

**When not to pick BERT in 2026.**أي شيء مولد. لا يوجد طريقة معقولة لإنتاج الرموز بشكل مستقل. أيضا: أي شيء تحت 1B المعلمات حيث يمكن للكشف الصغير أن يطابق الجودة مع مزيد من المرونة (Phi-3-Mini ، Qwen2-1.5B).

## أرسله

انظر`outputs/skill-bert-finetuner.md`. تتحكم المهارات في تحسينات (اختيار العمود الفقري، تحديد رأس، بيانات، تقييم، وقف) لمهام تصنيف أو استخراج جديدة.

## التمارين

1. **Easy.**أركض`code/main.py`وطباعة توزيع القناع على 10000 رمز. تأكد ~ 15% يتم اختيارها، ومن تلك ~ 80% يصبح `[MASK]`. . .
2. **Medium.**تنفيذ تخفيض الكلمات الكاملة: إذا تم تعريف كلمة إلى كلمات فرعية ، قم بتخفيض جميع الكلمات الفرعية معاً أو لا. قياس ما إذا كان هذا يحسن دقة MLM على مجموعة من 500 جملة.
3. **Hard.**تدريب صغير (2 طبقة، d=64) BERT على 10،000 جمل من مجموعة بيانات عامة.`[CLS]`مقارنة مع خط أساسي فقط للكشف في المماثلة

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MLM | "Masked language modeling" | Training signal: randomly replace 15% of tokens with `[MASK]`, predict the originals. |
| Bidirectional | "Looks both ways" | Encoder attention has no causal mask — every position sees every other position. |
| `[CLS]` | "The pooler token" | A special token prepended to every sequence; its final embedding is used as the sentence-level representation. |
| `[SEP]` | "Segment separator" | Separates paired sequences (e.g. query/doc, sentence A/B). |
| NSP | "Next sentence prediction" | BERT's second pretraining task; shown to be useless in RoBERTa, dropped after 2019. |
| Fine-tuning | "Adapt to a task" | Keep the encoder mostly frozen; train a small head on top for the downstream task. |
| Cross-encoder | "A reranker" | A BERT that takes both query and doc as input, outputs a relevance score. |
| ModernBERT | "2024 refresh" | Encoder rebuilt with RoPE, RMSNorm, GeGLU, alternating local/global attention, 8K context. |

## المزيد من القراءة

- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding](https://arxiv.org/abs/1810.04805)ورقة أصلية
- [Liu et al. (2019). RoBERTa: A Robustly Optimized BERT Pretraining Approach](https://arxiv.org/abs/1907.11692)كيف تدرب برت بشكل صحيح؟ يقتل النظام النووي.
- [Clark et al. (2020). ELECTRA: Pre-training Text Encoders as Discriminators Rather Than Generators](https://arxiv.org/abs/2003.10555) تحديد الوهم المبدل يفوق MLM عند الحساب المماثل.
- [Warner et al. (2024). Smarter, Better, Faster, Longer: A Modern Bidirectional Encoder](https://arxiv.org/abs/2412.13663)ورقة "مودرنبيرت"
- [HuggingFace `modeling_bert.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/bert/modeling_bert.py) إشارة مُرمّدة القنونيّة.
