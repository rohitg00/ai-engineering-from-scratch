# النظام الأساسي المتعدد اللغات

> نموذج واحد، أكثر من 100 لغة، صفر بيانات تدريبية بالنسبة لمعظمهم. الانتقال عبر اللغات هو المعجزة العملية للعام 2020.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 04 (GloVe, FastText, Subword), Phase 5 · 11 (Machine Translation)
**Time:** ~45 minutes

## المشكلة

اللغة الإنجليزية لديها مليارات الأمثلة الملصقة. اللغة الأردية لديها الآلاف. اللغة الماثيلية لديها تقريباً أي واحدة. أي نظام عملي لإن إل بي الذي يخدم جمهور عالمي يجب أن يعمل على ذيل طويل من اللغات حيث لا توجد بيانات تدريب محددة للمهام.

نموذجات متعددة اللغات تحل هذا الأمر عن طريق تدريب نموذج واحد على العديد من اللغات في وقت واحد. تمثيل المشترك يسمح لنموذج نقل المهارات المتعلمة في لغات ذات الموارد العالية إلى لغات ذات الموارد المنخفضة. تحسين النموذج على تحليل المشاعر الإنجليزية، و ينتج توقعات المشاعر الجيدة بشكل مفاجئ على الأردو خارج الصندوق. هذا هو نقل عبر اللغات بدون إطلاق، وقد أعاد تشكيل كيفية نقل النفط النووي إلى العالم.

هذه الدروس تعبر عن التنازلات والنماذج القنونيّة والقرار الوحيد الذي يُحاول أن يُساعد الفرق الجديدة في العمل متعدّدة اللغات: اختيار لغة مصدر للتنقل.

## المفهوم

![Cross-lingual transfer via shared multilingual embedding space](../assets/multilingual.svg)

**Shared vocabulary.**تستخدم النماذج متعددة اللغات رمز SentencePiece أو WordPiece المدرب على النص من جميع اللغات المستهدفة. يتم مشاركة المفردات: تمثل وحدة الكلمات الفرعية نفس المورفيم عبر اللغات ذات الصلة. `anti-`في الإنجليزية والإيطالية يحصلون على نفس الرمز.

**Shared representation.**يتعلم محول مدرب مسبقًا على نمذجة اللغة المخفية عبر العديد من اللغات أن الجمل المماثلة في اللغات المختلفة تنتج حالات مخفية مماثلة. يظهر mBERT و XLM-R و NLLB هذا جميعًا. تضمينات "قطة" في اللغة الإنجليزية تشكل مجموعة بالقرب من "التحدث" بالفرنسية و "gato" باللغة الإسبانية ، وكذلك تضمينات الجملة الكاملة.

**Zero-shot transfer.**قم بتحسين النموذج على البيانات المسموحة باللغة الواحدة (عادة الإنجليزية). عند الاستنتاج، قم بتشغيله على أي لغة أخرى يدعمها النموذج. لا حاجة إلى علامات اللغة المستهدفة. النتائج قوية بالنسبة للغات ذات صلة بالتصميم والضعيفة بالنسبة للغات البعيدة.

**Few-shot fine-tuning.**إضافة 100-500 مثال معلّم في اللغة المستهدفة. يرتفع الدقة إلى 95-98% من الخط الأساسي الإنجليزي في مهام التصنيف. هذا هو الرافعة الوحيدة الأكثر فعالية من حيث التكلفة في اللغة متعددة اللغات.

## النماذج

| Model | Year | Coverage | Notes |
|-------|------|----------|-------|
| mBERT | 2018 | 104 languages | Trained on Wikipedia. First practical multilingual LM. Weak on low-resource. |
| XLM-R | 2019 | 100 languages | Trained on CommonCrawl (much larger than Wikipedia). Sets the cross-lingual baseline. Base 270M, Large 550M. |
| XLM-V | 2023 | 100 languages | XLM-R with 1M-token vocabulary (vs 250k). Better on low-resource. |
| mT5 | 2020 | 101 languages | T5 architecture for multilingual generation. |
| NLLB-200 | 2022 | 200 languages | Meta's translation model; includes 55 low-resource languages. |
| BLOOM | 2022 | 46 languages + 13 programming | Open 176B LLM trained multilingually. |
| Aya-23 | 2024 | 23 languages | Cohere's multilingual LLM. Strong on Arabic, Hindi, Swahili. |

اختيار حسب حالة الاستخدام. التصنيف يعمل بشكل جيد مع XLM-R-base باعتبارها الافتراض المعقول. مهام الجيل تتطلب mT5 أو NLLB اعتمادا على الترجمة مقابل الجيل المفتوح. أزواج عمل في نمط LLM مع Aya-23 أو Claude باستخدام استئناف متعدد اللغات صريح.

## قرار اللغة المصدرة (بحث 2026)

معظم الفرق تُخَلِّف اللغة الإنجليزية كمصدر للتحديث. أظهرت الأبحاث الأخيرة (2026) أن هذا غالباً ما يكون خاطئاً.

يتنبأ التشابه اللغوي بجودة النقل بشكل أفضل من حجم الجسم الخام. بالنسبة للأهداف السلافية، غالبًا ما يتغلب الألمانية أو الروسية على الإنجليزية. بالنسبة للأهداف الهندية، غالبًا ما تتغلب الهندية على الإنجليزية.**qWALS**مقياس التشابه (2026, على أساس ميزات اطلس العالمي لهياكل اللغة) يقدر هذا. **LANGRANK**(لين وآخرون، ACL 2019) هي طريقة منفصلة سابقة تصنف لغات المصدر المرشح من مزيج من التشابه اللغوي، وحجم الجسم، والترابط الوراثي.

قاعدة عملية: إذا كانت لغتك المستهدفة لها قريبة من نوعها من ذوي الموارد العالية، حاول تحسين ذلك أولاً، ثم مقارنة مع اللغة الإنجليزية.

```figure
n5-crosslingual-bridge
```

## بناءها

### الخطوة الأولى: تصنيف متعدد اللغات

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

tok = AutoTokenizer.from_pretrained("joeddav/xlm-roberta-large-xnli")
model = AutoModelForSequenceClassification.from_pretrained("joeddav/xlm-roberta-large-xnli")


def classify(text, candidate_labels, hypothesis_template="This text is about {}."):
    scores = {}
    for label in candidate_labels:
        hypothesis = hypothesis_template.format(label)
        inputs = tok(text, hypothesis, return_tensors="pt", truncation=True)
        with torch.no_grad():
            logits = model(**inputs).logits[0]
        entail_score = torch.softmax(logits, dim=-1)[2].item()
        scores[label] = entail_score
    return dict(sorted(scores.items(), key=lambda x: -x[1]))


print(classify("I love this product!", ["positive", "negative", "neutral"]))
print(classify("मुझे यह उत्पाद पसंद है!", ["positive", "negative", "neutral"]))
print(classify("J'adore ce produit !", ["positive", "negative", "neutral"]))
```

نموذج واحد، ثلاث لغات، نفس API. XLM-R تدرب على NLI نقل البيانات جيدا إلى التصنيف عن طريق خدعة التمسك.

### الخطوة الثانية: مساحة إدراج متعددة اللغات

```python
from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

pairs = [
    ("The cat is sleeping.", "Le chat dort."),
    ("The cat is sleeping.", "El gato está durmiendo."),
    ("The cat is sleeping.", "Die Katze schläft."),
    ("The cat is sleeping.", "The dog is barking."),
]

for eng, other in pairs:
    emb_eng = model.encode([eng], normalize_embeddings=True)[0]
    emb_other = model.encode([other], normalize_embeddings=True)[0]
    sim = float(np.dot(emb_eng, emb_other))
    print(f"  {eng!r} <-> {other!r}: cos={sim:.3f}")
```

الترجمات تقع بالقرب من مساحة الإدخال. جملة إنجليزية مختلفة تقع أبعد. هذا ما يجعل الاستخدام عبر اللغات، والجمع، والشبه يعمل.

### الخطوة الثالثة: استراتيجية ضبط دقيقة

```python
from transformers import TrainingArguments, Trainer
from datasets import Dataset


def few_shot_finetune(base_model, base_tokenizer, examples):
    ds = Dataset.from_list(examples)

    def tokenize_fn(ex):
        out = base_tokenizer(ex["text"], truncation=True, max_length=128)
        out["labels"] = ex["label"]
        return out

    ds = ds.map(tokenize_fn)
    args = TrainingArguments(
        output_dir="out",
        per_device_train_batch_size=8,
        num_train_epochs=5,
        learning_rate=2e-5,
        save_strategy="no",
    )
    trainer = Trainer(model=base_model, args=args, train_dataset=ds)
    trainer.train()
    return base_model
```

بالنسبة لـ 100-500 مثال لغة هدف، `num_train_epochs=5`و`learning_rate=2e-5`وتسبب معدل التعلم العالي في انهيار التوافق متعدد اللغات وتحصل على نموذج إنجليزي فقط.

## تقييم يعمل فعلاً

- **Per-language accuracy on held-out sets.**ليس مجتمعاً، المجمّع يخفي الذيل الطويل
- **Benchmark against monolingual baseline.**بالنسبة للغات التي لديها بيانات كافية، نموذج واحد اللغات المدرب من الصفر أحيانا يفوق المتعدد اللغات. اختبار.
- **Entity-level tests.**الكيانات المسمى في اللغة المستهدفة. غالبا ما تكون النماذج متعددة اللغات لديها علامات ضعيفة للكتب البعيدة عن اللاتينية.
- **Cross-lingual consistency.**نفس المعنى في لغتين يجب أن ينتج نفس التنبؤ. قياس الفجوة.

## استخدمها

"مجموعة 2026"

| Task | Recommended |
|-----|-------------|
| Classification, 100 languages | XLM-R-base (~270M) fine-tuned |
| Zero-shot text classification | `joeddav/xlm-roberta-large-xnli` |
| Multilingual sentence embeddings | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| Translation, 200 languages | `facebook/nllb-200-distilled-600M` (see lesson 11) |
| Generative multilingual | Claude, GPT-4, Aya-23, mT5-XXL |
| Low-resource language NLP | XLM-V or a domain-specific fine-tune on related high-resource language |

دائماً ميزانية للتحسين في لغة الهدف إذا كان الأداء مهماً. الصفر هو نقطة البداية وليس الإجابة النهائية.

### ضريبة التكنولوجيا (ما الذي يذهب خطأ للغات منخفضة الموارد)

النماذج متعددة اللغات تشارك رمزًا واحدًا في جميع لغاتها. يتم تدريب هذه المفردات على مجموعة تهيمن عليها الإنجليزية والفرنسية والإسبانية والصينية والألمانية. بالنسبة لأي لغة خارج مجموعة المهيمنة، يتم تركيب ثلاثة ضرائب بصمت:

- **Fertility tax.**يستخدم النص اللغوي منخفض الموارد في إشارات إلى الكثير من الرموز لكل كلمة من اللغة الإنجليزية. يمكن أن تحتاج جملة هندية إلى 3-5x الرموز من جملة إنجليزية معادلة. وهذا 3-5x يأكل نافذة السياق الخاص بك، كفاءة التدريب، والبطء.
- **Variant recovery tax.**كل خطأ في النص، والفراز الدياكريتي، أو عدم مطابقة تطبيق يونيكود، أو اختلاف الحالة يصبح تسلسلًا غير مرتبطًا بدءًا باردًا في مساحة التضمين. لا يمكن للنموذج تعلم المراسلات التخطيطية التي يعتبرها الناطق الأصلي واضحًا.
- **Capacity spillover tax.**تستهلك الضرائب 1 و 2 مواقف السياق ، وعمق الطبقة ، وأبعاد التضمين. ما تبقى للبرأى الفعلي هو أقل منهجيا مما يحصل عليه لغة ذات موارد عالية من نفس النموذج.

الأعراض العملية: نموذجك يتدرب عادة على الهندية، ويعتبر منحنى الخسارة صحيحا، والتحيرات التقييم تبدو معقولة، ومخرجات الإنتاج خاطئة بشكل خفيف. الانحرافات المورفولوجية تنهار في منتصف الجملة. الانحرافات النادرة لا يمكن استعادتها. **You cannot data-scale your way out of a broken tokenizer.**

التخفيف: اختيار رمزية ذات تغطية جيدة لغتك المستهدفة (ملف المفردات 1M-token XLM-V هو تصحيح مباشر) ؛ التحقق من خصوبة رمزية على النص المستهدف المحتفظ به قبل التدريب؛ استخدام مستوى البايت fallback (SentencePiece `byte_fallback=True`(بيت مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي) على مستوى (بي بي بي) على مستوى (بي بي بي) على مستوى (بي بي بي) على مستوى (بي بي بي) على مستوى) على مستوى (بي بي بي) على مستوى (بي بي بي سي) على مستوى) على مستوى (بي بي بي سي) على مستوى) على مستوى (بي بي سي) على مستوى (بي) على مستوى (بي بي سي) على مستوى) على مستوى (بي) على مستوى) على مستوى (بي) على مستوى (بي بي سي) على مستوى) على مستوى (بي) على مستوى) على مستوى (بي) على مستوى (بي) على مستوى) على مستوى (بي) على مستوى (بي)

## أرسله

إبقوا`outputs/skill-multilingual-picker.md`:

```markdown
---
name: multilingual-picker
description: Pick source language, target model, and evaluation plan for a multilingual NLP task.
version: 1.0.0
phase: 5
lesson: 18
tags: [nlp, multilingual, cross-lingual]
---

Given requirements (target languages, task type, available labeled data per language), output:

1. Source language for fine-tuning. Default English; check LANGRANK or qWALS if target language has a typologically close high-resource language.
2. Base model. XLM-R (classification), mT5 (generation), NLLB (translation), Aya-23 (generative LLM).
3. Few-shot budget. Start with 100-500 target-language examples if available. Zero-shot only if labeling is infeasible.
4. Evaluation plan. Per-language accuracy (not aggregate), cross-lingual consistency, entity-level F1 on non-Latin scripts.

Refuse to ship a multilingual model without per-language evaluation — aggregate metrics hide long-tail failures. Flag scripts with low tokenization coverage (Amharic, Tigrinya, many African languages) as needing a model with byte-fallback (SentencePiece with byte_fallback=True, or byte-level tokenizer like GPT-2).
```

## التمارين

1. **Easy.**قم بتشغيل خط الأنابيب التصنيفية الصفرية على 10 جمل لكل لغة عبر اللغة الإنجليزية والفرنسية والهندية والعربية. قم بتقديم تقرير دقة على كل واحدة. يجب أن ترى الفرنسية القوية، الهندية العادلة، العربية المتغيرة.
2. **Medium.**استخدام`paraphrase-multilingual-MiniLM-L12-v2`لبناء جهاز استرداد متعدد اللغات على مجموعة صغيرة من اللغات المختلطة. استفسار باللغة الإنجليزية، استرداد المستندات في أي لغة. قياس recall@5.
3. **Hard.**مقارنة المصدر الإنجليزي ومصدر الهندي للتحسين لمهمة تصنيف الهندي. استخدم 500 مثال لغة هدف للتحسينات الدقيقة القليلة في كل من النظم. تقرير أي مصدر ينتج دقة هندي أفضل ومقدار. هذه هي أطروحة LANGRANK في الصغر.

## الشروط الرئيسية

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Multilingual model | One model, many languages | Shared vocabulary and parameters across languages. |
| Cross-lingual transfer | Train on one language, run on another | Fine-tune on source, evaluate on target without target-language labels. |
| Zero-shot | No target-language labels | Transfer without fine-tuning on the target language. |
| Few-shot | Small target labels | 100-500 target-language examples used for fine-tuning. |
| mBERT | First multilingual LM | 104-language BERT pretrained on Wikipedia. |
| XLM-R | Standard cross-lingual baseline | 100-language RoBERTa pretrained on CommonCrawl. |
| NLLB | Meta's 200-language MT | No Language Left Behind. Includes 55 low-resource languages. |

## المزيد من القراءة

- [Conneau et al. (2019). Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116)ورقة XLM-R
- [Pires, Schlinger, Garrette (2019). How Multilingual is Multilingual BERT?](https://arxiv.org/abs/1906.01502) ورقة التحليل التي بدأت خط بحث النقل عبر اللغات.
- [Costa-jussà et al. (2022). No Language Left Behind](https://arxiv.org/abs/2207.04672) ورقة NLLB-200.
- [Üstün et al. (2024). Aya Model: An Instruction Finetuned Open-Access Multilingual Language Model](https://arxiv.org/abs/2402.07827)آيا، ماجستير كوهير متعدد اللغات
- [Language Similarity Predicts Cross-Lingual Transfer Learning Performance (2026)](https://www.mdpi.com/2504-4990/8/3/65) ورقة لغة المصدر QWALS / LANGRANK.
